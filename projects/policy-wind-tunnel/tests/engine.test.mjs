import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_POLICY, DEFAULT_POLICY, SYSTEMS, DEFAULT_IMPLEMENTATIONS, evaluateCase, evaluateSuite, validateCases, validatePolicy } from '../dist/engine.mjs';
import { createFixtures, PRESETS, SCENARIOS } from '../dist/fixtures.mjs';

const sample = (changes = {}) => ({
  id: 'T-1', customer: 'Fictional Customer', orderId: 'ORDER-1',
  purchaseDate: '2026-11-01', requestDate: '2026-11-15', amount: 70,
  itemsReturned: 1, totalItems: 1, receipt: true, condition: 'unopened', ...changes,
});
const aligned = Object.fromEntries(SYSTEMS.map(({ id }) => [id, { mode: 'proposed', respectEffectiveDate: true }]));

test('the effective date is inclusive and historical purchases keep the old rules', () => {
  const historical = sample({ purchaseDate: '2026-10-31', requestDate: '2026-12-01' });
  assert.equal(evaluateCase(historical, DEFAULT_POLICY).decision, 'deny');
  assert.equal(evaluateCase(historical, DEFAULT_POLICY).applicableVersion, '1.0');
  const effectiveDay = sample({ purchaseDate: '2026-11-01', requestDate: '2026-12-02' });
  assert.equal(evaluateCase(effectiveDay, DEFAULT_POLICY).decision, 'approve');
  assert.equal(evaluateCase(effectiveDay, DEFAULT_POLICY).applicableVersion, '2.0');
});

test('the 45-day boundary is inclusive and the next day is rejected', () => {
  assert.equal(evaluateCase(sample({ requestDate: '2026-12-16' }), DEFAULT_POLICY).decision, 'approve');
  const late = evaluateCase(sample({ requestDate: '2026-12-17' }), DEFAULT_POLICY);
  assert.equal(late.decision, 'deny');
  assert.equal(late.days, 46);
  assert.equal(late.ruleId, 'return_window');
});

test('threshold equality is eligible, while one cent above requires review', () => {
  assert.equal(evaluateCase(sample({ amount: 150 }), DEFAULT_POLICY).decision, 'approve');
  assert.equal(evaluateCase(sample({ amount: 150.01 }), DEFAULT_POLICY).decision, 'review');
  assert.equal(evaluateCase(sample({ amount: 0 }), DEFAULT_POLICY).decision, 'approve');
});

test('missing evidence is distinguished from a recorded failure', () => {
  assert.equal(evaluateCase(sample({ receipt: null }), DEFAULT_POLICY).decision, 'unknown');
  assert.equal(evaluateCase(sample({ receipt: false }), DEFAULT_POLICY).decision, 'deny');
  assert.equal(evaluateCase(sample({ receipt: undefined }), DEFAULT_POLICY).decision, 'unknown');
  assert.equal(evaluateCase(sample({ receipt: null }), { ...DEFAULT_POLICY, requireReceipt: false }).decision, 'approve');
});

test('a conclusive eligibility failure wins over missing evidence or a review threshold', () => {
  assert.equal(evaluateCase(sample({ requestDate: '2027-01-01', receipt: null, amount: 200 }), DEFAULT_POLICY).decision, 'deny');
  assert.equal(evaluateCase(sample({ condition: 'opened', amount: 200 }), DEFAULT_POLICY).ruleId, 'condition');
});

test('partial orders depend on the applicable policy, not the current policy alone', () => {
  const partial = sample({ itemsReturned: 1, totalItems: 3 });
  assert.equal(evaluateCase(partial, DEFAULT_POLICY).decision, 'approve');
  assert.equal(evaluateCase(partial, BASE_POLICY).decision, 'deny');
  assert.equal(evaluateCase({ ...partial, purchaseDate: '2026-10-25', requestDate: '2026-11-05' }, DEFAULT_POLICY).decision, 'deny');
});

test('invalid dates, chronology, and amounts remain unknown and never approve', () => {
  for (const changes of [
    { purchaseDate: '2026-02-30' }, { requestDate: '11/15/2026' },
    { requestDate: '2026-10-31' }, { amount: -1 }, { amount: Number.NaN },
    { amount: Infinity }, { amount: '70' }, { itemsReturned: 1.5 },
    { itemsReturned: 3, totalItems: 2 }, { condition: 'unknown' },
  ]) assert.equal(evaluateCase(sample(changes), DEFAULT_POLICY).decision, 'unknown', JSON.stringify(changes));
});

test('UTC date-only calculations handle leap years and do not depend on time zones', () => {
  const result = evaluateCase(sample({ purchaseDate: '2028-02-28', requestDate: '2028-03-01' }), DEFAULT_POLICY);
  assert.equal(result.days, 2);
  assert.equal(evaluateCase(sample({ purchaseDate: '2027-02-29' }), DEFAULT_POLICY).decision, 'unknown');
});

test('the default fixture demonstrates drift, legitimate changes, unknowns and regressions', () => {
  const run = evaluateSuite(createFixtures(), DEFAULT_POLICY);
  assert.equal(run.summary.total, 36);
  assert.ok(run.summary.mismatches > 0);
  assert.ok(run.summary.changed > 0);
  assert.ok(run.summary.regressions > 0);
  assert.ok(run.summary.unknown > 0);
  assert.deepEqual(run.results.find(row => row.record.id === 'RET-007').mismatches, ['agent']);
  assert.equal(run.results.find(row => row.record.id === 'RET-007').expected.decision, 'deny');
  assert.equal(run.results.find(row => row.record.id === 'RET-007').systems.agent.decision, 'approve');
});

test('aligning implementations preserves unknowns and resolves known disagreements', () => {
  const run = evaluateSuite(createFixtures(), DEFAULT_POLICY, aligned);
  assert.equal(run.summary.mismatches, 0);
  assert.equal(run.summary.regressions, 0);
  assert.equal(run.summary.unknown, 3);
  assert.ok(run.summary.changed > 0);
  for (const row of run.results) assert.equal(row.systems.agent.decision, row.expected.decision);
});

test('a naive newest-policy repair introduces or retains historical regressions', () => {
  const naive = Object.fromEntries(SYSTEMS.map(({ id }) => [id, { mode: 'proposed', respectEffectiveDate: false }]));
  const run = evaluateSuite(createFixtures(), DEFAULT_POLICY, naive);
  const historic = run.results.find(row => row.record.id === 'RET-007');
  assert.deepEqual(historic.mismatches, ['agent', 'api', 'sop']);
  assert.equal(historic.regression, true);
  assert.ok(run.summary.regressions > 0);
});

test('known independent fixture expectations are computed from the data', () => {
  const run = evaluateSuite(createFixtures(), DEFAULT_POLICY);
  const expected = { 'RET-001': 'approve', 'RET-003': 'approve', 'RET-004': 'deny', 'RET-007': 'deny', 'RET-013': 'review', 'RET-018': 'unknown', 'RET-019': 'deny', 'RET-020': 'deny', 'RET-022': 'unknown', 'RET-025': 'review' };
  for (const [id, decision] of Object.entries(expected)) assert.equal(run.results.find(row => row.record.id === id).expected.decision, decision, id);
  const changedCase = createFixtures()[0];
  changedCase.requestDate = '2027-03-01';
  assert.equal(evaluateCase(changedCase, DEFAULT_POLICY).decision, 'deny');
});

test('each scenario supplies independent copies and a valid preset', () => {
  for (const { id } of SCENARIOS) {
    const cases = createFixtures(id);
    assert.equal(cases.length, 36);
    assert.equal(validateCases(cases).valid, true);
    assert.equal(validatePolicy(PRESETS[id]).valid, true);
    const run = evaluateSuite(cases, PRESETS[id]);
    assert.ok(run.summary.mismatches > 0, id);
    cases[0].amount = 9999;
    assert.notEqual(createFixtures(id)[0].amount, 9999);
  }
});

test('validation catches invalid policy and collection shapes without coercion', () => {
  assert.equal(validatePolicy({ ...DEFAULT_POLICY, windowDays: '45' }).valid, false);
  assert.equal(validatePolicy({ ...DEFAULT_POLICY, effectiveDate: '2026-11-31' }).valid, false);
  assert.equal(validateCases([sample(), sample()]).valid, false);
  assert.equal(validateCases([]).valid, false);
  assert.equal(validateCases([sample({ amount: '70' })]).valid, false);
  assert.throws(() => evaluateSuite([sample(), sample()], DEFAULT_POLICY), /Duplicate/);
  assert.throws(() => evaluateSuite([sample()], { ...DEFAULT_POLICY, windowDays: -1 }), /whole number/);
  assert.throws(() => evaluateSuite([sample()], DEFAULT_POLICY, { agent: { mode: 'invented' } }), /mode/);
});

test('running a comparison never mutates inputs, profiles, or shared policy defaults', () => {
  const cases = createFixtures();
  const before = JSON.stringify(cases);
  const policy = { ...DEFAULT_POLICY };
  evaluateSuite(cases, policy);
  assert.equal(JSON.stringify(cases), before);
  assert.deepEqual(policy, DEFAULT_POLICY);
  assert.equal(DEFAULT_IMPLEMENTATIONS.api.mode, 'baseline');
  assert.equal(Object.isFrozen(DEFAULT_POLICY), true);
});
