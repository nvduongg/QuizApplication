// Read-only final verification; no account or data mutations.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
if (process.env.QUIZIZI_LOCAL_INTEGRATION !== '1') throw Error('Local integration opt-in required');
const secrets = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'Microsoft/UserSecrets/cb2a83b7-9ba4-43c3-b519-cd95c5768c2a/secrets.json'), 'utf8').replace(/^\uFEFF/, ''));
const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'integration-results.json'), 'utf8'));
const edge = JSON.parse(fs.readFileSync(path.join(__dirname, 'edge-results.json'), 'utf8'));
const results = [];
async function main() {
  const r = await fetch('http://localhost:5225/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: secrets.DevelopmentTestAccounts.UserEmail, password: secrets.DevelopmentTestAccounts.Password }) });
  assert.equal(r.status, 200);
  const token = (await r.json()).accessToken;
  async function get(route) {
    const r = await fetch('http://localhost:5225/api' + route, { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(r.status, 200, route);
    return r.json();
  }
  function check(name, body) { body(); results.push({ name, passed: true }); }
  const clean = value => assert(!/"(?:isCorrect|correctAnswerIds|outcome|isSelected|earnedPoints)"\s*:/i.test(JSON.stringify(value)));
  const active = await get(`/quiz-attempts/${state.ids.activeAttemptId}`);
  check('Active GET has no correctness and nullable grade', () => { clean(active); assert.equal(active.score, null); assert.equal(active.percentage, null); });
  const completed = await get(`/quiz-attempts/${state.ids.completedAttemptId}`);
  check('Completed normal GET remains correctness-free', () => { clean(completed); assert.equal(completed.score, 2); assert.equal(completed.totalPoints, 10); });
  const review = await get(`/quiz-attempts/${state.ids.completedAttemptId}/result`);
  check('Canonical controlled review unchanged after final regression', () => assert.deepEqual(review, state.result));
  const history = await get('/quiz-attempts/mine?page=1&pageSize=20');
  check('Final history order and isolation', () => { clean(history); assert.deepEqual(history.map(a => a.quizAttemptId), [edge.attemptId, state.ids.activeAttemptId, state.ids.completedAttemptId]); });
  check('History ordering is repeatable', () => {});
  assert.deepEqual(await get('/quiz-attempts/mine?page=1&pageSize=20'), history);
  for (const size of [0, 1, 20, 100, 101]) {
    const items = await get(`/quiz-attempts/mine?page=1&pageSize=${size}`);
    check('Final pageSize ' + size, () => { clean(items); assert.equal(items.length, size <= 1 ? 1 : 3); });
  }
  check('Second page has next attempt', () => {});
  assert.equal((await get('/quiz-attempts/mine?page=2&pageSize=1'))[0].quizAttemptId, state.ids.activeAttemptId);
  check('Zero page clamps to first', () => {});
  assert.deepEqual(await get('/quiz-attempts/mine?page=0&pageSize=20'), history);
  fs.writeFileSync(path.join(__dirname, 'retained-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ readOnlyChecksPassed: results.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
