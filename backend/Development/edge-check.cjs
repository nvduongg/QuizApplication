// Local-only, non-secret regression probes against the canonical integration dataset.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
if (process.env.QUIZIZI_LOCAL_INTEGRATION !== '1') throw Error('Local integration opt-in required');
const secrets = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'Microsoft/UserSecrets/cb2a83b7-9ba4-43c3-b519-cd95c5768c2a/secrets.json'), 'utf8').replace(/^\uFEFF/, ''));
const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'integration-results.json'), 'utf8'));
const ids = state.ids;
let token;
const results = [];
async function call(method, url, body) {
  const r = await fetch('http://localhost:5225/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}
async function main() {
  token = (await call('POST', '/auth/login', { email: secrets.DevelopmentTestAccounts.UserEmail, password: secrets.DevelopmentTestAccounts.Password })).body.accessToken;
  assert(token);
  await call('PUT', `/quizzes/${ids.quizId}/unpublish`, {});
  try {
    await call('PUT', `/quizzes/${ids.quizId}/questions/${ids.questions[0].id}/points`, { points: 9 });
    const aggregate = await call('GET', `/quiz-attempts/${ids.completedAttemptId}`);
    results.push({ name: 'Completed safe GET retains snapshot total', actual: aggregate.body.totalPoints, expected: 10, passed: aggregate.body.totalPoints === 10 });
    await call('DELETE', `/quizzes/${ids.quizId}/questions/${ids.questions[0].id}`);
    const deletion = await call('DELETE', `/questions/${ids.questions[0].id}`);
    results.push({ name: 'Historically answered but unlinked question deletion', actual: deletion.status, expected: 409, passed: deletion.status === 409 });
  } finally {
    const rows = (await call('GET', `/quizzes/${ids.quizId}/questions`)).body;
    if (!rows.some(q => q.questionId === ids.questions[0].id)) await call('POST', `/quizzes/${ids.quizId}/questions`, { questionId: ids.questions[0].id, points: 2 });
    await call('PUT', `/quizzes/${ids.quizId}/questions/${ids.questions[0].id}/points`, { points: 2 });
    await call('PUT', `/quizzes/${ids.quizId}/questions/order`, { questionIds: ids.questions.map(q => q.id) });
    await call('PUT', `/quizzes/${ids.quizId}/publish`, {});
  }
  const largePage = await call('GET', '/quiz-attempts/mine?page=2147483647&pageSize=100');
  results.push({ name: 'Large valid page does not overflow to 500', actual: largePage.status, expected: 200, passed: largePage.status === 200 });
  const full = (await call('POST', '/quiz-attempts', { quizId: ids.quizId })).body;
  const payload = { questions: ids.questions.map(q => ({ questionId: q.id, answerIds: q.correct.map(a => q.answerIds[a]) })) };
  const submissions = await Promise.all([call('POST', `/quiz-attempts/${full.quizAttemptId}/submit`, payload), call('POST', `/quiz-attempts/${full.quizAttemptId}/submit`, payload)]);
  results.push({ name: 'Concurrent submission succeeds once, conflicts once', actual: submissions.map(r => r.status).sort(), expected: [200, 409], passed: JSON.stringify(submissions.map(r => r.status).sort()) === '[200,409]' });
  const fullResult = await call('GET', `/quiz-attempts/${full.quizAttemptId}/result`);
  results.push({ name: 'Full exact-set grading is 10/10', actual: fullResult.body.score, expected: 10, passed: fullResult.body.score === 10 });
  fs.writeFileSync(path.join(__dirname, 'edge-results.json'), JSON.stringify({ attemptId: full.quizAttemptId, results }, null, 2));
  console.log(JSON.stringify(results));
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
