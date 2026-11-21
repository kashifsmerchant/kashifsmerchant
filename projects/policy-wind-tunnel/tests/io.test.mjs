import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCaseFile, serializeReview, casesToCSV, CASE_FIELDS } from '../dist/io.mjs';
import { evaluateSuite, DEFAULT_POLICY } from '../dist/engine.mjs';
import { createFixtures } from '../dist/fixtures.mjs';

test('imports all supported JSON shapes and a BOM', () => {
  const sample = [{ id: 'A', amount: '12.50', receipt: 'yes' }];
  for (const source of [sample, { cases: sample }, { results: sample.map(record => ({ record })) }]) {
    const parsed = parseCaseFile(`\uFEFF${JSON.stringify(source)}`, 'review.JSON');
    assert.equal(parsed[0].id, 'A');
    assert.equal(parsed[0].amount, 12.5);
    assert.equal(parsed[0].receipt, true);
  }
});

test('quoted CSV preserves commas, escaped quotes, embedded newlines and CRLF', () => {
  const text = '\uFEFFid,customer,note,amount,receipt\r\nA,"Reed, Avery","First line\r\nSaid ""hello""",42.25,YES\r\nB,Casey,"comma, here",12,no\r\n';
  const records = parseCaseFile(text, 'cases.csv');
  assert.equal(records.length, 2);
  assert.equal(records[0].customer, 'Reed, Avery');
  assert.equal(records[0].note, 'First line\r\nSaid "hello"');
  assert.equal(records[0].amount, 42.25);
  assert.equal(records[1].receipt, false);
});

test('numeric blanks stay missing and invalid scalar facts remain available for unknown decisions', () => {
  const [record] = parseCaseFile('id,amount,itemsReturned,totalItems,receipt,condition\nA,, ,2,,Unopened\n', 'cases.csv');
  assert.equal(Object.hasOwn(record, 'amount'), false);
  assert.equal(Object.hasOwn(record, 'itemsReturned'), false);
  assert.equal(record.totalItems, 2);
  assert.equal(record.receipt, null);
  assert.equal(record.condition, 'unopened');
  const [invalid] = parseCaseFile('[{"id":"B","amount":"twelve","receipt":"maybe"}]', 'cases.json');
  assert.equal(invalid.amount, 'twelve');
  assert.equal(invalid.receipt, 'maybe');
});

test('receipt forms are explicit, including missing and unknown', () => {
  const values = [true, false, 'true', 'false', 'yes', 'no', '1', '0', 1, 0, null, '', 'unknown'];
  const parsed = parseCaseFile(JSON.stringify(values.map((receipt, index) => ({ id: String(index), receipt }))), 'cases.json');
  assert.deepEqual(parsed.map(record => record.receipt), [true, false, true, false, true, false, true, false, true, false, null, null, null]);
});

test('imports ignore unknown fields without changing prototypes', () => {
  const text = '[{"id":"A","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"unexpected":"ignore","amount":10}]';
  const [record] = parseCaseFile(text, 'cases.json');
  assert.deepEqual(Object.keys(record), ['id', 'amount']);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(record), Object.prototype);
  const [csv] = parseCaseFile('id,__proto__,constructor,amount\nA,evil,evil,10', 'cases.csv');
  assert.deepEqual(Object.keys(csv), ['id', 'amount']);
});

test('missing, blank, numeric and duplicate IDs are rejected', () => {
  for (const records of [[{}], [{ id: '' }], [{ id: ' ' }], [{ id: 1 }], [{ id: 'A' }, { id: ' A ' }]]) {
    assert.throws(() => parseCaseFile(JSON.stringify(records), 'cases.json'), /ID/);
  }
  assert.throws(() => parseCaseFile('customer,amount\nAvery,4', 'cases.csv'), /id column/);
});

test('malformed CSV and duplicate known headers are rejected', () => {
  assert.throws(() => parseCaseFile('id,note\nA,"unfinished', 'cases.csv'), /Unclosed/);
  assert.throws(() => parseCaseFile('id,note\nA,"finished"oops', 'cases.csv'), /Unexpected/);
  assert.throws(() => parseCaseFile('id,note\nA,un"quoted', 'cases.csv'), /quote must/);
  assert.throws(() => parseCaseFile('id,note\nA,unquoted,comma', 'cases.csv'), /more fields/);
  assert.throws(() => parseCaseFile('id,ID\nA,B', 'cases.csv'), /Duplicate CSV/);
});

test('imports enforce 500 records and the UTF-8 byte size cap', () => {
  const records = Array.from({ length: 500 }, (_, index) => ({ id: String(index) }));
  assert.equal(parseCaseFile(JSON.stringify(records), 'cases.json').length, 500);
  assert.throws(() => parseCaseFile(JSON.stringify([...records, { id: 'last' }]), 'cases.json'), /500/);
  assert.throws(() => parseCaseFile('id,note\nA,' + 'é'.repeat(1_048_576), 'cases.csv'), /2 MB/);
  assert.throws(() => parseCaseFile('id\n' + Array.from({ length: 501 }, (_, index) => String(index)).join('\n'), 'cases.csv'), /500/);
});

test('exported reviews contain fixed provenance, a real timestamp, and reimportable cases', () => {
  const suite = evaluateSuite(createFixtures(), DEFAULT_POLICY);
  const start = Date.now();
  const exported = serializeReview(suite, { label: 'Local review', provenance: 'cannot override' });
  const parsed = JSON.parse(exported);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.provenance, 'deterministic-reference');
  assert.ok(Date.parse(parsed.generatedAt) >= start && Date.parse(parsed.generatedAt) <= Date.now());
  assert.equal(parsed.results.length, 36);
  assert.deepEqual(parsed.summary, suite.summary);
  assert.deepEqual(parseCaseFile(exported, 'review.json'), createFixtures());
  assert.ok(exported.endsWith('\n'));
});

test('review export has stable nested field ordering and rejects cycles', () => {
  const suite = evaluateSuite(createFixtures(), DEFAULT_POLICY);
  const a = JSON.parse(serializeReview(suite, { z: 1, a: { z: 2, b: 3 } }));
  const b = JSON.parse(serializeReview(suite, { a: { b: 3, z: 2 }, z: 1 }));
  delete a.generatedAt; delete b.generatedAt;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => serializeReview(suite, cycle), /circular/);
});

test('CSV export round-trips ordinary cases and preserves quotes and newlines', () => {
  const cases = createFixtures().slice(0, 2);
  cases[0].note = 'Two lines\nWith "quotes", and commas';
  const csv = casesToCSV(cases);
  assert.deepEqual(parseCaseFile(csv, 'cases.csv'), cases);
  assert.equal(csv.split('\r\n')[0], CASE_FIELDS.map(field => `"${field}"`).join(','));
});

test('CSV export neutralizes spreadsheet formulas, including hidden leading whitespace', () => {
  const formulas = ['=HYPERLINK("https://example.invalid")', '+SUM(1,2)', '-1+2', '@SUM(1)', '  =1+1', '\t=1+1', '\r=1+1'];
  for (const note of formulas) {
    const csv = casesToCSV([{ id: 'safe', note }]);
    const [record] = parseCaseFile(csv, 'cases.csv');
    assert.equal(record.note, `'${note}`);
  }
});

test('header aliases work and blank lines do not create phantom cases', () => {
  const [record] = parseCaseFile(' ID ,Purchase Date,items_returned,Total-Items\r\n\r\n A ,2026-11-01,1,2\r\n\r\n', 'cases.csv');
  assert.equal(record.id, 'A');
  assert.equal(record.purchaseDate, '2026-11-01');
  assert.equal(record.itemsReturned, 1);
  assert.equal(record.totalItems, 2);
});
