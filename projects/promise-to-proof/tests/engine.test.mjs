import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace, inspectCommitment, applyRemedy, summarizeWorkspace} from '../dist/engine.mjs';

const inspect = (workspace, id = 'P-001') => inspectCommitment(workspace, id);
function apply(workspace, id) {
  const result = applyRemedy(workspace, inspect(workspace,id).plan);
  assert.equal(result.applied, true);
  return result.workspace;
}
function withEvent(workspace, id, kind, changes) {
  const template = workspace.events.find(e=>e.commitmentId === id && e.kind === kind);
  assert.ok(template);
  return {...workspace,events:[...workspace.events,{...template,id:'fixture/extra',...changes}]};
}

test('Fixture review distinguishes closed cases from provable commitments', () => {
  const w = createWorkspace();
  assert.deepEqual(summarizeWorkspace(w), {total:8,verified:2,blocked:5,pending:1});
  assert.equal(inspect(w).caseStatus, 'Resolved');
  assert.equal(inspect(w).firstGap.key,'publication');
  assert.equal(inspect(w,'P-002').firstGap.key,'access');
  assert.equal(inspect(w,'P-003').firstGap.key,'content');
  assert.equal(inspect(w,'P-004').firstGap.key,'delivery');
  assert.equal(inspect(w,'P-005').firstGap,null);
  assert.equal(inspect(w,'P-005').plan,null);
  assert.match(inspect(w,'P-005').acknowledgement,/unobservable/);
});

test('An invoice repair invalidates proof for the superseded edition', () => {
  let w = createWorkspace();
  const before = inspect(w,'P-003');
  assert.match(before.firstGap.detail, /333.75/);
  assert.equal(before.checks.find(c=>c.key === 'delivery').state,'pass');
  w = apply(w,'P-003');
  const corrected = inspect(w,'P-003');
  assert.equal(corrected.checks.find(c=>c.key === 'content').state, 'pass');
  assert.equal(corrected.firstGap.key,'publication');
  assert.equal(corrected.checks.find(c=>c.key === 'delivery').state,'unknown');
  assert.ok(corrected.timeline.some(e=>e.id === 'P-003/receipt'));
  for (const expected of ['publish','grant','deliver']) {
    assert.equal(inspect(w,'P-003').plan.type,expected);
    w = apply(w,'P-003');
  }
  assert.equal(inspect(w,'P-003').deadlineStatus,'fulfilled-late');
});

test('Repair preview is side-effect-free, apply targets one commitment, retry cannot send twice', () => {
  let w = createWorkspace();
  const baseline = structuredClone(w);
  const unrelated = inspect(w,'P-002');
  const publish = inspect(w).plan;
  const first = applyRemedy(w, publish);
  assert.deepEqual(w,baseline);
  assert.equal(applyRemedy(first.workspace,publish).applied,false);
  w = apply(first.workspace, 'P-001');
  const deliver = inspect(w).plan;
  assert.equal(deliver.type,'deliver');
  const delivered = applyRemedy(w,deliver);
  assert.equal(delivered.applied,true);
  const retry = applyRemedy(delivered.workspace,deliver);
  assert.equal(retry.applied,false);
  assert.equal(retry.workspace.events.filter(e=>e.commitmentId === 'P-001' && e.kind === 'delivery.posted').length,1);
  assert.equal(retry.workspace.events.filter(e=>e.commitmentId === 'P-001' && e.kind === 'delivery.delivered').length,1);
  assert.equal(inspect(retry.workspace).status,'verified');
  assert.deepEqual(inspect(retry.workspace,'P-002'),unrelated);
});

test('Reconciliation retrieves a matching existing receipt and retains the original delivery time', () => {
  const w = createWorkspace();
  const before = inspect(w,'P-004');
  assert.equal(before.plan.type,'reconcile');
  const result = apply(w,'P-004');
  assert.equal(result.events.filter(e=>e.commitmentId === 'P-004' && e.kind === 'delivery.posted').length,1);
  const after = inspect(result,'P-004');
  assert.equal(after.status,'verified');
  assert.equal(after.deadlineStatus,'fulfilled-on-time');
  assert.equal(after.fulfilledAt, '2026-11-23T14:14:00.000Z');
  assert.equal(applyRemedy(result,before.plan).applied,false);
});

test('A posted message with an absent or mismatched provider receipt cannot trigger a resend', () => {
  const w = createWorkspace();
  const original = w.providerReceipts[0];
  for (const change of [null,{edition:'wrong'},{version:1},{destination:'elsewhere@example.com'},
    {customerId:'wrong'},{transactionId:'wrong'},{messageId:'wrong'},{source:'case'},{at:'2030-01-01T00:00:00Z'}]) {
    const variant = {...w,providerReceipts: change ? [{...original,...change}] : []};
    const result = inspect(variant,'P-004');
    assert.equal(result.status,'blocked');
    assert.equal(result.plan.type,'escalate');
    assert.equal(result.plan.canApply,false);
    assert.equal(applyRemedy(variant,result.plan).applied,false);
  }
});

test('Receipt identity requires correct account, transaction, invoice, edition, destination and source', () => {
  const w = createWorkspace();
  const original = w.events.find(e=>e.id === 'P-005/receipt');
  for (const change of [{customerId:'wrong'},{transactionId:'wrong'},{invoiceId:'wrong'},{edition:'wrong'},
    {destination:'wrong@example.com'},{kind:'case.resolved',source:'case'},{version:1},{messageId:''},{source:'document'}]) {
    const variant = {...w,events:w.events.map(e=>e.id === original.id ? {...e,...change} : e)};
    assert.equal(inspect(variant,'P-005').checks.find(c=>c.key === 'delivery').state,'unknown');
  }
  const stale = inspect(w,'P-008');
  assert.match(stale.firstGap.detail,/v1/);
  assert.equal(stale.status,'blocked');
});

test('Event ingestion order and an exact duplicate do not change proof', () => {
  const w = createWorkspace();
  const result = inspect(w,'P-006');
  assert.equal(result.duplicateCount,1);
  assert.equal(result.timeline.filter(e=>e.kind === 'delivery.delivered').length,1);
  assert.deepEqual(inspect({...w,events:[...w.events].reverse()},'P-006'),result);
  assert.equal(result.status,'verified');
});

test('Unresolved identity collisions block verification and simulation', () => {
  const w = createWorkspace();
  const conflict = withEvent(w,'P-005','delivery.delivered',{id:'P-005/receipt',messageId:'CONFLICT'});
  const result = inspect(conflict,'P-005');
  assert.equal(result.firstGap.key,'integrity');
  assert.equal(result.plan.canApply,false);
  assert.equal(applyRemedy(conflict,result.plan).applied,false);
});

test('Open deadline without evidence stays pending and becomes blocked only after deadline', () => {
  const w = createWorkspace();
  const c = inspect(w,'P-007');
  assert.equal(c.status,'pending');
  assert.equal(c.deadlineStatus,'open');
  assert.equal(inspect({...w,asOf:c.commitment.deadline},'P-007').status,'pending');
  assert.equal(inspect({...w,asOf:'2026-11-26T00:00:00.000Z'},'P-007').status,'blocked');
});

test('Withdrawn access and retracted publication override stale success, future events are excluded', () => {
  const w = createWorkspace();
  const change = {kind:'access.revoked',at:'2026-11-23T18:00:00.000Z'};
  assert.equal(inspect(withEvent(w,'P-005','access.granted',change),'P-005').firstGap.key,'access');
  assert.equal(inspect(withEvent(w,'P-005','access.granted',{...change,at:'2027-01-01T00:00:00.000Z'}),'P-005').status,'verified');
  assert.equal(inspect(withEvent(w,'P-005','document.published',{kind:'document.unpublished',at:change.at}),'P-005').firstGap.key,'publication');
});
