// Explicitly opt-in, local-only integration test. Requires an empty business dataset.
// Credentials come from .NET user secrets; never written to this script or its report.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
if (process.env.QUIZIZI_LOCAL_INTEGRATION !== '1') throw Error('Set QUIZIZI_LOCAL_INTEGRATION=1 after verifying the local database and Development server.');
const base = 'http://localhost:5225/api';
const secrets = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'Microsoft/UserSecrets/cb2a83b7-9ba4-43c3-b519-cd95c5768c2a/secrets.json'), 'utf8').replace(/^\uFEFF/, ''));
const accounts = secrets.DevelopmentTestAccounts;
const adminConfig = secrets.SeedAdmin;
const report = { checks: [], ids: {}, result: null };
const reportFile = path.join(__dirname, 'integration-results.json');
const save = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
function check(name, test) { test(); report.checks.push({ name, passed: true }); save(); }
function safe(data) { assert(!/"(?:isCorrect|correctAnswerIds|outcome|isSelected|earnedPoints)"\s*:/i.test(JSON.stringify(data)), 'Correctness leaked'); }
async function api(method, route, body, token, expected = 200) {
  const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text();
  let data; try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  report.checks.push({ name: method + ' ' + route, status: response.status, expected, passed: response.status === expected }); save();
  assert.equal(response.status, expected, method + ' ' + route);
  if (response.status >= 400) assert(!/SqlException|DbUpdateException|stackTrace|Microsoft\.EntityFrameworkCore| at backend\./i.test(raw), 'Unsafe error');
  return data;
}
async function login(email, password) { const data = await api('POST', '/auth/login', { email, password }); assert(data.accessToken); return data.accessToken; }
async function main() {
  const admin = await login(adminConfig.Email, adminConfig.Password);
  for (const [email, fullName] of [[accounts.UserEmail, 'Quizizi Development User'], [accounts.OtherEmail, 'Quizizi Development Other User']]) {
    const users = await api('GET', '/admin/users', undefined, admin);
    if (!users.some(u => u.email === email)) await api('POST', '/auth/register', { email, fullName, password: accounts.Password }, undefined, 201);
  }
  const user = await login(accounts.UserEmail, accounts.Password);
  const other = await login(accounts.OtherEmail, accounts.Password);
  await api('POST', '/auth/login', { email: accounts.UserEmail, password: 'Wrong-password!1' }, undefined, 401);
  await api('GET', '/question-banks/mine', undefined, undefined, 401);
  await api('GET', '/admin/users', undefined, user, 403);
  const users = await api('GET', '/admin/users', undefined, admin);
  const normal = users.find(u => u.email === accounts.UserEmail);
  const second = users.find(u => u.email === accounts.OtherEmail);
  check('Registration assigns only User', () => assert.deepEqual(normal.roles, ['User']));
  report.ids.userId = normal.userId; report.ids.otherUserId = second.userId;
  await api('GET', '/admin/users/' + normal.userId, undefined, admin);
  const bankInput = { name: 'Backend Fundamentals', description: 'Deterministic local development data', visibility: 2 };
  const bank = await api('POST', '/question-banks', bankInput, user, 201);
  const bankId = report.ids.bankId = bank.questionBankId; save();
  await api('GET', '/question-banks/' + bankId, undefined, user);
  await api('PUT', '/question-banks/' + bankId, bankInput, user);
  await api('GET', '/question-banks/' + bankId, undefined, other);
  await api('PUT', '/question-banks/' + bankId, bankInput, other, 403);
  const privateBank = await api('POST', '/question-banks', { name: 'Temporary private boundary', visibility: 1 }, other, 201);
  report.ids.privateBankId = privateBank.questionBankId;
  const privateQuestion = await api('POST', `/question-banks/${privateBank.questionBankId}/questions`, { content: 'PRIVATE_BOUNDARY_SENTINEL', questionType: 2 }, other, 201);
  report.ids.privateQuestionId = privateQuestion.questionId; save();
  await api('GET', `/question-banks/${privateBank.questionBankId}`, undefined, user, 403);
  const searchPrivate = await api('GET', '/questions/search?search=PRIVATE_BOUNDARY_SENTINEL', undefined, user);
  check('Private question absent from other-user search', () => assert.equal(searchPrivate.length, 0));
  const definitions = [
    { content: 'Which HTTP method is normally used to create a new resource?', questionType: 2, answers: ['GET', 'POST', 'PUT', 'DELETE'], correct: ['POST'], points: 2 },
    { content: 'Which HTTP methods are commonly considered idempotent?', questionType: 1, answers: ['GET', 'PUT', 'DELETE', 'POST'], correct: ['GET', 'PUT', 'DELETE'], points: 3 },
    { content: 'HTTP is a stateless protocol.', questionType: 3, answers: ['True', 'False'], correct: ['True'], points: 5 },
  ];
  const questions = [];
  for (const def of definitions) {
    const q = await api('POST', `/question-banks/${bankId}/questions`, { content: def.content, questionType: def.questionType }, user, 201);
    const answers = {};
    for (const content of def.answers) { const a = await api('POST', `/questions/${q.questionId}/answers`, { content, isCorrect: def.correct.includes(content) }, user, 201); answers[content] = a.answerId; }
    questions.push({ ...def, id: q.questionId, answerIds: answers });
  }
  report.ids.questions = questions; save();
  const publicSearch = await api('GET', '/questions/search?search=HTTP', undefined, other);
  check('Other User can search public questions', () => assert(questions.every(q => publicSearch.some(x => x.questionId === q.id))));
  const quizInput = { title: 'Backend Fundamentals Assessment', description: 'A development quiz used to verify the Quizizi attempt and result workflow.', duration: 20 };
  const quiz = await api('POST', '/quizzes', quizInput, user, 201);
  const quizId = report.ids.quizId = quiz.quizId; save();
  await api('PUT', `/quizzes/${quizId}`, quizInput, user);
  for (const q of questions) await api('POST', `/quizzes/${quizId}/questions`, { questionId: q.id, points: q.points }, user, 201);
  await api('POST', `/quizzes/${quizId}/questions`, { questionId: questions[0].id, points: 2 }, user, 409);
  await api('PUT', `/quizzes/${quizId}/questions/${questions[0].id}/points`, { points: 2 }, user);
  await api('PUT', `/quizzes/${quizId}/questions/order`, { questionIds: questions.map(q => q.id).reverse() }, user, 204);
  await api('PUT', `/quizzes/${quizId}/questions/order`, { questionIds: questions.map(q => q.id) }, user, 204);
  const rows = await api('GET', `/quizzes/${quizId}/questions`, undefined, user);
  check('Composition references existing records, preserves order and 10 total points', () => { assert.deepEqual(rows.map(r => r.questionId), questions.map(q => q.id)); assert.deepEqual(rows.map(r => r.questionOrder), [1, 2, 3]); assert.equal(rows.reduce((s, r) => s + r.points, 0), 10); });
  await api('PUT', `/quizzes/${quizId}/publish`, {}, user);
  check('Published quiz discoverable', () => {});
  const found = await api('GET', '/public/quizzes?search=Backend%20Fundamentals'); assert(found.some(q => q.quizId === quizId));
  await api('PUT', `/quizzes/${quizId}/questions/${questions[0].id}/points`, { points: 4 }, user, 409);
  await api('PUT', `/quizzes/${quizId}/questions/order`, { questionIds: questions.map(q => q.id) }, user, 409);
  await api('DELETE', `/quizzes/${quizId}/questions/${questions[0].id}`, undefined, user, 409);
  const attempt = await api('POST', '/quiz-attempts', { quizId }, user, 201);
  report.ids.completedAttemptId = attempt.quizAttemptId; save();
  check('Active attempt contains safe questions and no correctness', () => { safe(attempt); assert.equal(attempt.questions.length, 3); assert.equal(attempt.totalPoints, 10); assert(attempt.questions.every(q => q.answers.every(a => a.content))); });
  const payload = { questions: [{ questionId: questions[0].id, answerIds: [questions[0].answerIds.POST] }, { questionId: questions[1].id, answerIds: [questions[1].answerIds.GET, questions[1].answerIds.POST] }] };
  const submitted = await api('POST', `/quiz-attempts/${attempt.quizAttemptId}/submit`, payload, user);
  check('Submit exposes only the safe acknowledgement', () => { safe(submitted); assert.deepEqual(Object.keys(submitted).sort(), ['quizAttemptId', 'status', 'submittedAt']); });
  await api('POST', `/quiz-attempts/${attempt.quizAttemptId}/submit`, payload, user, 409);
  const result = await api('GET', `/quiz-attempts/${attempt.quizAttemptId}/result`, undefined, user);
  report.result = result; save();
  check('Controlled result: correct 2/2, incorrect 0/3, unanswered 0/5, 20%', () => {
    assert.equal(result.reviewAvailable, true); assert.equal(result.score, 2); assert.equal(result.totalPoints, 10); assert.equal(result.percentage, 20);
    assert.deepEqual(result.questions.map(q => q.outcome), [1, 2, 3]); assert.deepEqual(result.questions.map(q => q.earnedPoints), [2, 0, 0]); assert.deepEqual(result.questions.map(q => q.maxPoints), [2, 3, 5]);
    assert.equal(result.questions.reduce((n, q) => n + q.earnedPoints, 0), result.score); assert.equal(result.questions.reduce((n, q) => n + q.maxPoints, 0), result.totalPoints);
    result.questions.forEach((q, i) => assert.deepEqual([...q.correctAnswerIds].sort(), questions[i].correct.map(a => questions[i].answerIds[a]).sort()));
    assert.deepEqual(result.questions[0].selectedAnswerIds, [questions[0].answerIds.POST]); assert.deepEqual([...result.questions[1].selectedAnswerIds].sort(), [questions[1].answerIds.GET, questions[1].answerIds.POST].sort()); assert.deepEqual(result.questions[2].selectedAnswerIds, []);
  });
  await api('GET', `/quiz-attempts/${attempt.quizAttemptId}/result`, undefined, undefined, 401);
  await api('GET', `/quiz-attempts/${attempt.quizAttemptId}/result`, undefined, other, 404);
  await api('GET', '/quiz-attempts/2147483647/result', undefined, user, 404);
  const active = await api('POST', '/quiz-attempts', { quizId }, user, 201);
  report.ids.activeAttemptId = active.quizAttemptId; save();
  await api('GET', `/quiz-attempts/${active.quizAttemptId}/result`, undefined, user, 409);
  await api('PUT', `/quizzes/${quizId}/unpublish`, {}, user);
  await api('POST', '/quiz-attempts', { quizId }, user, 404);
  await api('PUT', `/questions/${questions[0].id}`, { content: 'Temporary snapshot stability text', questionType: 2 }, user);
  await api('PUT', `/answers/${questions[0].answerIds.POST}`, { content: 'POST (temporarily changed)', isCorrect: false }, user);
  await api('PUT', `/quizzes/${quizId}/questions/${questions[0].id}/points`, { points: 9 }, user);
  const stable = await api('GET', `/quiz-attempts/${attempt.quizAttemptId}/result`, undefined, user);
  check('Completed result is byte-equivalent after source text/correctness/points changes', () => assert.deepEqual(stable, result));
  const historyChanged = await api('GET', '/quiz-attempts/mine?page=1&pageSize=20', undefined, user);
  check('Completed history totals remain snapshotted', () => assert.equal(historyChanged.find(a => a.quizAttemptId === attempt.quizAttemptId).totalPoints, 10));
  await api('PUT', `/questions/${questions[0].id}`, { content: questions[0].content, questionType: 2 }, user);
  await api('PUT', `/answers/${questions[0].answerIds.POST}`, { content: 'POST', isCorrect: true }, user);
  await api('PUT', `/quizzes/${quizId}/questions/${questions[0].id}/points`, { points: 2 }, user);
  await api('PUT', `/quizzes/${quizId}/publish`, {}, user);
  for (const size of [0, 1, 20, 100, 101]) {
    const history = await api('GET', `/quiz-attempts/mine?page=1&pageSize=${size}`, undefined, user);
    check('History size ' + size + ' clamps safely and newest first', () => { safe(history); assert.equal(history.length, size <= 1 ? 1 : 2); assert.equal(history[0].quizAttemptId, active.quizAttemptId); assert.equal(history[0].score, null); assert.equal(history[0].percentage, null); });
  }
  const otherHistory = await api('GET', '/quiz-attempts/mine?page=1&pageSize=20', undefined, other);
  check('History owner isolation', () => assert.deepEqual(otherHistory, []));
  await api('DELETE', `/question-banks/${bankId}`, undefined, user, 409);
  await api('DELETE', `/questions/${questions[0].id}`, undefined, user, 409);
  await api('DELETE', `/quizzes/${quizId}`, undefined, user, 409);
  await api('PUT', `/admin/users/${second.userId}/status`, { blocked: true }, admin);
  await api('POST', '/auth/login', { email: accounts.OtherEmail, password: accounts.Password }, undefined, 401);
  await api('PUT', `/admin/users/${second.userId}/status`, { blocked: false }, admin);
  await login(accounts.OtherEmail, accounts.Password);
  await api('GET', '/admin/quizzes', undefined, admin);
  await api('PUT', `/admin/quizzes/${quizId}/disable`, {}, admin, 204);
  await api('GET', `/public/quizzes/${quizId}`, undefined, undefined, 404);
  await api('POST', '/quiz-attempts', { quizId }, user, 404);
  await api('DELETE', `/admin/quizzes/${quizId}`, undefined, admin, 409);
  await api('PUT', `/quizzes/${quizId}/publish`, {}, user);
  const disposable = await api('POST', '/quizzes', { title: 'Temporary admin delete check', duration: 10 }, user, 201);
  await api('DELETE', `/admin/quizzes/${disposable.quizId}`, undefined, admin, 204);
  await api('POST', '/quizzes', { title: '', duration: 0 }, user, 400);
  await api('DELETE', `/questions/${privateQuestion.questionId}`, undefined, other, 204);
  await api('DELETE', `/question-banks/${privateBank.questionBankId}`, undefined, other, 204);
  report.completed = true; save();
  console.log(JSON.stringify({ passed: report.checks.filter(c => c.passed).length, ids: { bankId, quizId, completedAttemptId: attempt.quizAttemptId, activeAttemptId: active.quizAttemptId }, score: result.score, total: result.totalPoints, percentage: result.percentage }));
}
main().catch(error => { report.failure = error.message; save(); console.error(error.message); process.exitCode = 1; });

