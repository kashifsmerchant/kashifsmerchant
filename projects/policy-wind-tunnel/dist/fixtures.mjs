import { DEFAULT_POLICY } from './engine.mjs';

/** Fictional, repeatable examples. Dates belong to a simulated review period. */
export const SCENARIOS = Object.freeze([
  Object.freeze({ id: 'returns', name: 'Return window extension', description: 'A 45-day policy meets a stale API and a support agent that overlooks effective dates.' }),
  Object.freeze({ id: 'partial', name: 'Partial returns', description: 'Allow individual items while preserving the policy that applied to older purchases.' }),
  Object.freeze({ id: 'threshold', name: 'Approval threshold', description: 'Raise the automatic approval limit and test the exact dollar boundaries.' }),
]);

export const PRESETS = Object.freeze({
  returns: Object.freeze({ ...DEFAULT_POLICY }),
  partial: Object.freeze({ ...DEFAULT_POLICY, windowDays: 30, maxAutoAmount: 100 }),
  threshold: Object.freeze({ ...DEFAULT_POLICY, windowDays: 30, allowPartial: false }),
});

const CUSTOMERS = ['Morgan Ellis', 'Avery Reed', 'Jamie Park', 'Cameron Wells', 'Riley Jordan', 'Casey Brooks', 'Taylor Quinn', 'Alex Rowan', 'Drew Hayes', 'Robin Lane', 'Sam Emery', 'Blair Casey'];

function plusDays(date, count) {
  const stamp = Date.parse(`${date}T00:00:00.000Z`) + count * 86_400_000;
  return new Date(stamp).toISOString().slice(0, 10);
}

function record(prefix, index, values = {}) {
  const purchaseDate = values.purchaseDate ?? '2026-11-03';
  const days = values.days ?? 12;
  const { days: unused, ...overrides } = values;
  return {
    id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
    customer: CUSTOMERS[index % CUSTOMERS.length],
    orderId: `ALD-${prefix}-${4100 + index}`,
    purchaseDate,
    requestDate: plusDays(purchaseDate, days),
    amount: 64,
    itemsReturned: 1,
    totalItems: 1,
    receipt: true,
    condition: 'unopened',
    note: 'Fictional case in the Alder Supply reference workspace.',
    ...overrides,
  };
}

function returnsCases() {
  const values = [
    { days: 36, note: 'New purchase, inside the extended return window.' },
    { days: 44, amount: 82, note: 'The backend still uses the previous deadline.' },
    { days: 45, amount: 100, note: 'Exactly at the proposed day boundary.' },
    { days: 46, note: 'One day beyond the proposed window.' },
    { days: 30, note: 'Exactly at the previous day boundary.' },
    { days: 31, note: 'One day beyond the previous window.' },
    { purchaseDate: '2026-10-20', days: 36, note: 'Historical purchase: the previous policy remains applicable.' },
    { purchaseDate: '2026-10-31', days: 31, note: 'Purchased one day before the new policy starts.' },
    { purchaseDate: '2026-11-01', days: 38, note: 'Purchased on the effective date.' },
    { purchaseDate: '2026-10-19', days: 45, note: 'A naive latest-policy repair incorrectly approves this historical purchase.' },
    { days: 12, amount: 120, note: 'Inside the new automatic approval limit.' },
    { days: 15, amount: 150, note: 'Exactly at the proposed amount boundary.' },
    { days: 15, amount: 150.01, note: 'One cent beyond the proposed amount boundary.' },
    { purchaseDate: '2026-10-28', days: 12, amount: 120, note: 'Historical purchase still needs human review at the previous limit.' },
    { days: 18, itemsReturned: 1, totalItems: 3, note: 'A partial return allowed by the proposed policy.' },
    { days: 30, itemsReturned: 2, totalItems: 4, amount: 72, note: 'Partial return at the previous time boundary.' },
    { purchaseDate: '2026-10-25', days: 15, itemsReturned: 1, totalItems: 2, note: 'An older purchase retains the previous full-order requirement.' },
    { days: 7, receipt: null, note: 'Receipt status was not captured. An answer is not yet verifiable.' },
    { days: 10, receipt: false, note: 'The record explicitly states that no receipt is available.' },
    { days: 9, condition: 'opened', note: 'Opened goods remain ineligible under both versions.' },
    { days: 70, receipt: null, note: 'Outside both windows even without resolving the missing receipt.' },
    { days: -1, note: 'Contradictory chronology requires correction before evaluation.' },
    { days: 0, amount: 20, note: 'Same-day return.' },
    { days: 20, amount: 0, note: 'Zero-dollar replacement adjustment.' },
    { days: 40, amount: 230, note: 'Newly eligible by date, but the amount requires a person.' },
    { days: 41, itemsReturned: 1, totalItems: 2, amount: 140, note: 'Both the extended window and partial-return rule matter.' },
    { days: 32, condition: 'opened', note: 'Changing the window does not fix the condition failure.' },
    { days: 35, receipt: false, note: 'Changing the window does not supply a missing receipt.' },
    { purchaseDate: '2026-10-01', days: 30, amount: 100, note: 'Both previous boundaries, still eligible.' },
    { purchaseDate: '2026-10-01', days: 30, amount: 100.01, note: 'One cent above the historical automatic limit.' },
    { days: 29, amount: 35, note: 'Ordinary case unchanged by the release.' },
    { days: 8, amount: 91, itemsReturned: 3, totalItems: 3, note: 'A complete multi-item order.' },
    { days: 44, amount: 149.99, note: 'Near both proposed boundaries.' },
    { days: 45, amount: 151, note: 'Eligible at the time boundary, with human review.' },
    { purchaseDate: '2026-10-31', days: 46, amount: 90, note: 'Outside both policy windows.' },
    { days: 16, amount: 89, receipt: null, itemsReturned: 1, totalItems: 2, note: 'The proposed partial-return rule still needs receipt evidence.' },
  ];
  return values.map((value, index) => record('RET', index, value));
}

function partialCases() {
  return Array.from({ length: 36 }, (_, index) => {
    const group = Math.floor(index / 6);
    const offset = index % 6;
    const values = {
      days: [5, 15, 29, 30, 31, 12][offset],
      amount: [40, 75, 99, 100, 100.01, 140][offset],
      totalItems: 4,
      itemsReturned: group === 2 ? 4 : [1, 2, 3, 1, 2, 3][offset],
      purchaseDate: group === 1 ? '2026-10-25' : '2026-11-04',
      note: group === 1 ? 'Historical purchase preserves the previous full-order rule.' : group === 2 ? 'Full-order control case.' : 'Partial-return case with independently recorded item counts.',
    };
    if (group === 3) { values.receipt = offset % 2 ? false : null; values.note = 'Receipt evidence remains necessary after changing the partial-return rule.'; }
    if (group === 4) { values.condition = offset < 3 ? 'opened' : 'unopened'; values.note = 'Condition and time-window controls.'; }
    if (group === 5) { values.amount = [0, 99.99, 100, 100.01, 150, 500][offset]; values.note = 'Partial-return amount boundary and review controls.'; }
    return record('PART', index, values);
  });
}

function thresholdCases() {
  const amounts = [0, 99.99, 100, 100.01, 149.99, 150, 150.01, 200, 1000];
  return Array.from({ length: 36 }, (_, index) => {
    const group = Math.floor(index / amounts.length);
    const offset = index % amounts.length;
    const values = {
      days: group === 2 ? 31 : 14,
      amount: amounts[offset],
      purchaseDate: group === 1 ? '2026-10-24' : '2026-11-05',
      note: group === 1 ? 'Historical purchase retains the previous automatic approval limit.' : group === 2 ? 'Outside the unchanged 30-day window, regardless of amount.' : 'Exact and adjacent amount boundaries.',
    };
    if (group === 3) {
      if (offset < 3) values.receipt = null;
      else if (offset < 6) values.condition = 'opened';
      else { values.itemsReturned = 1; values.totalItems = 2; }
      values.note = 'A higher amount limit does not satisfy unrelated eligibility requirements.';
    }
    return record('LIMIT', index, values);
  });
}

export function createFixtures(scenario = 'returns') {
  if (scenario === 'returns') return returnsCases();
  if (scenario === 'partial') return partialCases();
  if (scenario === 'threshold') return thresholdCases();
  throw new TypeError(`Unknown scenario: ${String(scenario)}. Choose returns, partial, or threshold.`);
}
