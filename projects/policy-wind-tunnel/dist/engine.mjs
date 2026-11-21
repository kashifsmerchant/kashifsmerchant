/**
 * Policy Wind Tunnel reference decision engine.
 * All decisions are computed from explicit rules. No network or model calls occur.
 * The separate implementation profiles intentionally reproduce policy drift.
 */

export const BASE_POLICY = Object.freeze({
  version: '1.0',
  windowDays: 30,
  effectiveDate: '2026-01-01',
  allowPartial: false,
  maxAutoAmount: 100,
  requireReceipt: true,
});

export const DEFAULT_POLICY = Object.freeze({
  version: '2.0',
  windowDays: 45,
  effectiveDate: '2026-11-01',
  allowPartial: true,
  maxAutoAmount: 150,
  requireReceipt: true,
});

export const SYSTEMS = Object.freeze([
  Object.freeze({ id: 'agent', name: 'Support agent', description: 'Proposed rules, initially applied without a purchase-date check.' }),
  Object.freeze({ id: 'api', name: 'Refund API', description: 'Initially still running the previous policy.' }),
  Object.freeze({ id: 'sop', name: 'Reviewer procedure', description: 'Initially still instructing reviewers to use the previous policy.' }),
]);

export const DEFAULT_IMPLEMENTATIONS = Object.freeze({
  agent: Object.freeze({ mode: 'proposed', respectEffectiveDate: false }),
  api: Object.freeze({ mode: 'baseline', respectEffectiveDate: true }),
  sop: Object.freeze({ mode: 'baseline', respectEffectiveDate: true }),
});

const DAY_MS = 86_400_000;
const MAX_CASES = 5_000;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = value => typeof value === 'string' && value.trim().length > 0;

function dateStamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const stamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(stamp)) return null;
  return new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
}

export function validatePolicy(policy) {
  if (!isObject(policy)) return { valid: false, errors: ['Policy must be an object.'] };
  const errors = [];
  if (!hasText(policy.version) || policy.version.length > 80) errors.push('Policy version must be a nonempty string of at most 80 characters.');
  if (!Number.isInteger(policy.windowDays) || policy.windowDays < 0 || policy.windowDays > 3650) errors.push('Return window must be a whole number from 0 to 3650 days.');
  if (dateStamp(policy.effectiveDate) === null) errors.push('Effective date must be a real date in YYYY-MM-DD format.');
  if (typeof policy.allowPartial !== 'boolean') errors.push('allowPartial must be true or false.');
  if (typeof policy.requireReceipt !== 'boolean') errors.push('requireReceipt must be true or false.');
  if (typeof policy.maxAutoAmount !== 'number' || !Number.isFinite(policy.maxAutoAmount) || policy.maxAutoAmount < 0 || policy.maxAutoAmount > 1_000_000_000) errors.push('Automatic approval limit must be a finite amount between 0 and 1,000,000,000.');
  return { valid: errors.length === 0, errors };
}

function caseErrors(record) {
  if (!isObject(record)) return ['Case must be an object.'];
  const errors = [];
  if (!hasText(record.id) || record.id.length > 80) errors.push('Case ID must be a nonempty string of at most 80 characters.');
  if (!hasText(record.customer) || record.customer.length > 200) errors.push('Customer must be a nonempty string of at most 200 characters.');
  if (!hasText(record.orderId) || record.orderId.length > 120) errors.push('Order ID must be a nonempty string of at most 120 characters.');
  if (dateStamp(record.purchaseDate) === null) errors.push('Purchase date must be a real date in YYYY-MM-DD format.');
  if (dateStamp(record.requestDate) === null) errors.push('Request date must be a real date in YYYY-MM-DD format.');
  if (typeof record.amount !== 'number' || !Number.isFinite(record.amount) || record.amount < 0 || record.amount > 1_000_000_000) errors.push('Amount must be a finite number between 0 and 1,000,000,000.');
  if (!Number.isInteger(record.totalItems) || record.totalItems < 1 || record.totalItems > 1_000_000) errors.push('totalItems must be a positive whole number no greater than 1,000,000.');
  if (!Number.isInteger(record.itemsReturned) || record.itemsReturned < 1 || record.itemsReturned > record.totalItems) errors.push('itemsReturned must be a positive whole number no greater than totalItems.');
  if (record.receipt !== null && record.receipt !== undefined && typeof record.receipt !== 'boolean') errors.push('Receipt must be true, false, or null for unknown.');
  if (!['unopened', 'opened'].includes(record.condition)) errors.push('Condition must be unopened or opened.');
  if (record.note !== undefined && (typeof record.note !== 'string' || record.note.length > 2000)) errors.push('Note must be text of at most 2000 characters.');
  return errors;
}

function collectionErrors(cases) {
  if (!Array.isArray(cases)) return ['Cases must be an array.'];
  const errors = [];
  if (cases.length === 0) errors.push('Add at least one case.');
  if (cases.length > MAX_CASES) errors.push(`A run can contain at most ${MAX_CASES.toLocaleString('en-US')} cases.`);
  const seen = new Set();
  cases.forEach((record, index) => {
    if (!isObject(record) || !hasText(record.id)) {
      errors.push(`Case ${index + 1} must be an object with a nonempty ID.`);
    } else if (seen.has(record.id)) {
      errors.push(`Duplicate case ID: ${record.id}.`);
    } else {
      seen.add(record.id);
    }
  });
  return errors;
}

export function validateCases(cases) {
  const errors = collectionErrors(cases);
  if (Array.isArray(cases) && cases.length <= MAX_CASES) {
    cases.forEach((record, index) => {
      for (const message of caseErrors(record)) errors.push(`Case ${index + 1}: ${message}`);
    });
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function unknownResult(record, errors, policy) {
  return {
    decision: 'unknown',
    reason: errors.join(' '),
    ruleId: 'case_data',
    applicableVersion: 'unresolved',
    days: null,
    amount: typeof record?.amount === 'number' && Number.isFinite(record.amount) ? record.amount : null,
    trace: [{
      rule: 'case_data', label: 'Evidence completeness', passed: null,
      value: errors.join(' '), expected: 'Valid dates, amounts, item counts, and case identity',
      evidence: `Input facts for ${record?.id || 'this case'}; proposed policy v${policy.version}`,
    }],
  };
}

/** Evaluate one recorded case. The purchase date determines the applicable policy. */
export function evaluateCase(record, policy = DEFAULT_POLICY, { respectEffectiveDate = true } = {}) {
  const validation = validatePolicy(policy);
  if (!validation.valid) throw new TypeError(validation.errors.join(' '));
  if (typeof respectEffectiveDate !== 'boolean') throw new TypeError('respectEffectiveDate must be true or false.');
  const errors = caseErrors(record);
  if (errors.length) return unknownResult(record, errors, policy);
  const purchase = dateStamp(record.purchaseDate);
  const requested = dateStamp(record.requestDate);
  if (requested < purchase) return unknownResult(record, ['The request date is before the purchase date. Correct the recorded chronology before deciding.'], policy);

  const historical = respectEffectiveDate && purchase < dateStamp(policy.effectiveDate);
  const applied = historical ? BASE_POLICY : policy;
  const days = (requested - purchase) / DAY_MS;
  const partial = record.itemsReturned < record.totalItems;
  const receiptKnown = typeof record.receipt === 'boolean';
  const receiptPass = applied.requireReceipt ? (receiptKnown ? record.receipt : null) : true;
  const trace = [
    { rule: 'case_data', label: 'Recorded facts', passed: true, value: record.id, expected: 'Complete, valid case facts', evidence: `Order ${record.orderId}; ${record.customer}` },
    {
      rule: 'effective_date', label: 'Applicable policy', passed: true, value: `v${applied.version}`,
      expected: respectEffectiveDate ? `Purchases before ${policy.effectiveDate} keep v${BASE_POLICY.version}` : `Implementation applies v${policy.version} to every purchase`,
      evidence: `Purchase ${record.purchaseDate}; proposed effective date ${policy.effectiveDate}${!respectEffectiveDate ? '; effective-date check disabled' : ''}`,
    },
    { rule: 'return_window', label: 'Return window', passed: days <= applied.windowDays, value: `${days} days`, expected: `At most ${applied.windowDays} days, inclusive`, evidence: `Purchase ${record.purchaseDate}; request ${record.requestDate}; policy v${applied.version}` },
    { rule: 'condition', label: 'Item condition', passed: record.condition === 'unopened', value: record.condition, expected: 'Unopened items', evidence: `Recorded item condition; policy v${applied.version}` },
    { rule: 'partial_return', label: 'Partial return', passed: !partial || applied.allowPartial, value: `${record.itemsReturned} of ${record.totalItems} items`, expected: applied.allowPartial ? 'Individual items or the complete order may be returned' : 'The complete order must be returned', evidence: `Recorded item counts; policy v${applied.version}` },
    { rule: 'receipt', label: 'Proof of purchase', passed: receiptPass, value: receiptKnown ? (record.receipt ? 'Receipt present' : 'No receipt') : 'Receipt status unknown', expected: applied.requireReceipt ? 'Receipt required' : 'Receipt not required', evidence: `Recorded receipt status; policy v${applied.version}` },
    { rule: 'approval_limit', label: 'Automatic approval limit', passed: record.amount <= applied.maxAutoAmount, value: record.amount, expected: `At most $${applied.maxAutoAmount.toFixed(2)} for automatic approval`, evidence: `Requested amount $${record.amount.toFixed(2)}; policy v${applied.version}` },
  ];

  const common = { trace, applicableVersion: applied.version, days, amount: record.amount };
  if (days > applied.windowDays) return { ...common, decision: 'deny', ruleId: 'return_window', reason: `${days} days exceeds the ${applied.windowDays}-day return window in v${applied.version}.` };
  if (record.condition !== 'unopened') return { ...common, decision: 'deny', ruleId: 'condition', reason: `Opened items are not eligible under policy v${applied.version}.` };
  if (partial && !applied.allowPartial) return { ...common, decision: 'deny', ruleId: 'partial_return', reason: `Policy v${applied.version} requires the full order; this case returns ${record.itemsReturned} of ${record.totalItems} items.` };
  if (receiptPass === false) return { ...common, decision: 'deny', ruleId: 'receipt', reason: `Policy v${applied.version} requires a receipt, and this case records that none is available.` };
  if (receiptPass === null) return { ...common, decision: 'unknown', ruleId: 'receipt', reason: `Receipt status is missing. Policy v${applied.version} requires evidence before a decision can be verified.` };
  if (record.amount > applied.maxAutoAmount) return { ...common, decision: 'review', ruleId: 'approval_limit', reason: `$${record.amount.toFixed(2)} exceeds the $${applied.maxAutoAmount.toFixed(2)} automatic approval limit. A person must review this otherwise eligible return.` };
  return { ...common, decision: 'approve', ruleId: 'approved', reason: `Eligible under policy v${applied.version}: within ${applied.windowDays} days, qualifying condition and evidence, and within the automatic approval limit.` };
}

function implementationProfiles(input) {
  if (!isObject(input)) throw new TypeError('Implementations must be an object.');
  const profiles = {};
  for (const { id } of SYSTEMS) {
    if (input[id] !== undefined && !isObject(input[id])) throw new TypeError(`${id} implementation must be an object.`);
    const profile = { ...DEFAULT_IMPLEMENTATIONS[id], ...input[id] };
    if (!['proposed', 'baseline'].includes(profile.mode)) throw new TypeError(`${id} mode must be proposed or baseline.`);
    if (typeof profile.respectEffectiveDate !== 'boolean') throw new TypeError(`${id} respectEffectiveDate must be true or false.`);
    profiles[id] = profile;
  }
  return profiles;
}

/** Compare approved expectations to three explicitly configured implementations. */
export function evaluateSuite(cases, policy = DEFAULT_POLICY, implementations = DEFAULT_IMPLEMENTATIONS) {
  const policyCheck = validatePolicy(policy);
  if (!policyCheck.valid) throw new TypeError(policyCheck.errors.join(' '));
  const shapeErrors = collectionErrors(cases);
  if (shapeErrors.length) throw new TypeError(shapeErrors.join(' '));
  const profiles = implementationProfiles(implementations);
  const summary = {
    total: cases.length, mismatches: 0, regressions: 0, changed: 0, unknown: 0,
    decisions: { approve: 0, deny: 0, review: 0, unknown: 0 },
    bySystem: Object.fromEntries(SYSTEMS.map(({ id }) => [id, { mismatches: 0, total: cases.length, matched: 0, unknown: 0 }])),
  };
  const results = cases.map(record => {
    const expected = evaluateCase(record, policy);
    const baseline = evaluateCase(record, BASE_POLICY);
    const systems = {};
    const mismatches = [];
    for (const { id } of SYSTEMS) {
      const profile = profiles[id];
      systems[id] = evaluateCase(record, profile.mode === 'baseline' ? BASE_POLICY : policy, { respectEffectiveDate: profile.respectEffectiveDate });
      if (systems[id].decision !== expected.decision) {
        mismatches.push(id);
        summary.bySystem[id].mismatches += 1;
      } else if (expected.decision !== 'unknown') {
        summary.bySystem[id].matched += 1;
      }
      if (systems[id].decision === 'unknown' || expected.decision === 'unknown') summary.bySystem[id].unknown += 1;
    }
    const changed = baseline.decision !== expected.decision;
    const unknown = expected.decision === 'unknown';
    const regression = baseline.decision === expected.decision && expected.decision !== 'unknown' && mismatches.length > 0;
    if (mismatches.length) summary.mismatches += 1;
    if (regression) summary.regressions += 1;
    if (changed) summary.changed += 1;
    if (unknown) summary.unknown += 1;
    summary.decisions[expected.decision] += 1;
    return { record: { ...record }, expected, baseline, systems, mismatches, changed, unknown, regression };
  });
  return { results, summary, policy: { ...policy }, implementations: profiles };
}
