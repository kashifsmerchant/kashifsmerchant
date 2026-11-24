/**
 * Reconcile three fictional, read-only evidence feeds as of an explicit time.
 * The simulator applies an approved repair to a fresh workspace object.
 */
const AS_OF = '2026-11-24T16:00:00.000Z';
const BEFORE = '2026-11-23T21:00:00.000Z';
const AFTER = '2026-11-25T21:00:00.000Z';
const ACK = 'Recipient acknowledgement is unobservable. The delivery service supplies delivery receipts, but no read or acceptance signal.';
const SOURCES = { case: 'Case records', document: 'Document store', delivery: 'Delivery ledger' };
const SOURCE_FOR = {
  'case.resolved': 'case', 'case.opened': 'case', 'case.promised': 'case',
  'document.saved': 'document', 'document.published': 'document', 'document.unpublished': 'document',
  'access.granted': 'document', 'access.revoked': 'document',
  'delivery.notDispatched': 'delivery', 'delivery.posted': 'delivery', 'delivery.delivered': 'delivery'
};
const currency = cents => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);

function eventFor(commitment, kind, at, suffix, details = {}) {
  const {id, customerId, transactionId, invoiceId, version, amountCents, destination} = commitment;
  return {
    id: id + '/' + suffix, at, source: SOURCE_FOR[kind], kind, commitmentId: id,
    customerId, transactionId, invoiceId, version, edition: invoiceId + '/r' + version,
    amountCents, destination, ...details
  };
}

function describe(event) {
  const doc = event.invoiceId + ' v' + event.version;
  const names = {
    'case.promised': 'Corrected invoice promised for ' + currency(event.amountCents) + '.',
    'case.opened': 'Service case opened.',
    'case.resolved': 'Service case marked resolved by the operator.',
    'document.saved': doc + ' saved with a balance of ' + currency(event.amountCents) + '.',
    'document.published': doc + ' published.',
    'document.unpublished': doc + ' returned to draft.',
    'access.granted': 'Viewing access granted to ' + event.destination + '.',
    'access.revoked': 'Viewing access revoked for ' + event.destination + '.',
    'delivery.notDispatched': 'Ledger confirmed that no message had been dispatched for this invoice edition and destination.',
    'delivery.posted': 'Message posted to the delivery service for ' + event.destination + '.',
    'delivery.delivered': 'Delivery of ' + doc + ' recorded for ' + event.destination + '.'
  };
  return names[event.kind] || 'Unrecognized event.';
}

export function createWorkspace() {
  const fixtures = [
    ['Northstar Studio', 48250, 'draft'],
    ['Hemlock Market', 12600, 'access'],
    ['Juniper Press', 31875, 'amount'],
    ['Copperfield Goods', 96500, 'missing-receipt'],
    ['Fern & Finch', 22990, 'complete'],
    ['Morrow Textiles', 71240, 'reordered'],
    ['Harborline Design', 15600, 'not-due'],
    ['Birchline Works', 54000, 'old-version']
  ];
  const events = [];
  const providerReceipts = [];
  const commitments = fixtures.map(([customer, amountCents, scenario], i) => {
    const serial = String(i + 1).padStart(3, '0');
    const destination = 'billing@' + ['northstar', 'hemlock', 'juniper', 'copperfield', 'fernfinch', 'morrow', 'harborline', 'birchline'][i] + '.example';
    const commitment = {
      id: 'P-' + serial, customer, customerId: 'CUS-' + serial, transactionId: 'TX-' + (1701 + i),
      invoiceId: 'INV-' + (4201 + i), version: 2, amountCents, destination,
      deadline: scenario === 'not-due' ? AFTER : BEFORE,
      promise: 'Deliver corrected invoice INV-' + (4201 + i) + ' for ' + currency(amountCents) + ' to ' + destination + '.'
    };
    const observed = [];
    const add = (kind, minute, suffix, details) => {
      const at = '2026-11-23T14:' + String(minute).padStart(2, '0') + ':00.000Z';
      const e = eventFor(commitment, kind, at, suffix, details);
      observed.push(e);
      return e;
    };
    add('case.promised', 0, 'promise');
    if (scenario !== 'not-due') {
      const edition = {edition: commitment.invoiceId + '/r2'};
      add('document.saved', 5, 'saved', {...edition, amountCents: scenario === 'amount' ? amountCents + 1500 : amountCents});
      if (scenario !== 'draft') add('document.published', 7, 'publication', edition);
      if (!['draft', 'access'].includes(scenario)) add('access.granted', 9, 'access', edition);
      if (['draft', 'access', 'old-version'].includes(scenario)) add('delivery.notDispatched', 10, 'undispatched', edition);
      if (['amount', 'complete', 'reordered', 'missing-receipt', 'old-version'].includes(scenario)) {
        const deliveryEdition = scenario === 'old-version' ? {edition:commitment.invoiceId + '/r1', version:1} : edition;
        add('delivery.posted', 11, 'posted', {...deliveryEdition, messageId:'MSG-' + serial});
        if (scenario === 'missing-receipt') {
          providerReceipts.push(eventFor(commitment, 'delivery.delivered', '2026-11-23T14:14:00.000Z',
            'provider-receipt', {...edition, messageId:'MSG-' + serial}));
        } else {
          add('delivery.delivered', 14, 'receipt', {...deliveryEdition, messageId:'MSG-' + serial});
        }
      }
      add('case.resolved', 15, 'case-status');
    } else {
      add('case.opened', 1, 'case-status');
    }
    if (scenario === 'reordered') {
      observed.reverse();
      observed.push({...observed.find(row => row.kind === 'delivery.delivered')});
    }
    events.push(...observed);
    return commitment;
  });
  return {asOf: AS_OF, commitments, events, providerReceipts};
}

function relevant(event, commitment, asOf) {
  return event.commitmentId === commitment.id && event.customerId === commitment.customerId
    && event.transactionId === commitment.transactionId && event.invoiceId === commitment.invoiceId
    && event.source === SOURCE_FOR[event.kind] && Number.isFinite(Date.parse(event.at))
    && Date.parse(event.at) <= Date.parse(asOf);
}

function chronology(a, b) {
  return Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id);
}
function orderedEvidence(workspace, commitment) {
  const unique = new Map();
  const conflicts = new Set();
  let duplicateCount = 0;
  for (const event of workspace.events.filter(e => relevant(e, commitment, workspace.asOf))) {
    if (!unique.has(event.id)) { unique.set(event.id, event); continue; }
    const existing = unique.get(event.id);
    const fields = new Set([...Object.keys(existing), ...Object.keys(event)]);
    if (Array.from(fields).every(key => existing[key] === event[key])) duplicateCount++;
    else conflicts.add(event.id);
  }
  return {events:[...unique.values()].filter(e => !conflicts.has(e.id)).sort(chronology), duplicateCount, conflicts};
}
const latest = (events, predicate) => events.findLast(predicate);
const makeCheck = (key,label,state,detail,events=[]) => ({key,label,state,detail,evidenceIds:events.filter(Boolean).map(e=>e.id)});
function remedy(commitment, type, label, description, evidence, canApply=true) {
  return {id: [commitment.id,type,commitment.version,commitment.amountCents,commitment.destination,
    ...evidence.map(e=>e.id)].join('|'), commitmentId:commitment.id, type, label, description, canApply};
}

function evaluate(workspace, commitment) {
  const {events,duplicateCount,conflicts} = orderedEvidence(workspace, commitment);
  const doc = latest(events, e => e.kind === 'document.saved');
  const editionMatch = e => doc && e.edition === doc.edition && e.version === doc.version
    && Date.parse(e.at) >= Date.parse(doc.at);
  const publication = latest(events, e => editionMatch(e) && ['document.published', 'document.unpublished'].includes(e.kind));
  const access = latest(events, e => editionMatch(e) && e.destination === commitment.destination && ['access.granted','access.revoked'].includes(e.kind));
  const deliveries = events.filter(e => editionMatch(e) && e.destination === commitment.destination && e.source === 'delivery');
  const delivered = latest(deliveries, e => e.kind === 'delivery.delivered' && Boolean(e.messageId));
  const posted = latest(deliveries, e => e.kind === 'delivery.posted' && Boolean(e.messageId));
  const noDispatch = latest(deliveries, e => e.kind === 'delivery.notDispatched');
  const oldReceipt = latest(events, e => e.kind === 'delivery.delivered' && !editionMatch(e) && e.destination === commitment.destination);
  const wrongRecipient = latest(events, e => editionMatch(e) && e.kind === 'delivery.delivered' && e.destination !== commitment.destination);
  const caseEvent = latest(events, e => ['case.resolved','case.opened'].includes(e.kind));
  const correct = doc && doc.amountCents === commitment.amountCents && doc.version === commitment.version && !!doc.edition;
  const checks = [
    makeCheck('content','Correct content',doc ? correct ? 'pass' : 'fail' : 'unknown',
      doc ? correct ? doc.invoiceId + ' v' + doc.version + ' contains the approved ' + currency(doc.amountCents) + '.'
        : 'Saved invoice is v' + doc.version + ' for ' + currency(doc.amountCents) + '. The commitment requires v' + commitment.version + ' for ' + currency(commitment.amountCents) + '.'
        : 'The document store has no persisted invoice for this commitment.',[doc]),
    makeCheck('publication','Published invoice',publication?.kind === 'document.published' ? 'pass' : doc ? 'fail' : 'unknown',
      publication?.kind === 'document.published' ? 'The saved invoice edition has a publication record.'
        : doc ? 'The saved invoice is still a draft. No active publication exposes this edition.' : 'No invoice edition is available to check.',[publication || doc]),
    makeCheck('access','Customer access',access?.kind === 'access.granted' ? 'pass' : publication?.kind === 'document.published' ? 'fail' : 'unknown',
      access?.kind === 'access.granted' ? 'The access record grants ' + commitment.destination + ' permission to view this edition.'
        : access?.kind === 'access.revoked' ? 'Viewing access was revoked for ' + commitment.destination + '.'
        : 'No active viewer grant is recorded for ' + commitment.destination + ' on this edition.',[access]),
    makeCheck('delivery','Delivery receipt',delivered ? 'pass' : 'unknown',
      delivered ? 'Receipt ' + delivered.messageId + ' confirms delivery of the saved edition to ' + delivered.destination + '.'
        : posted ? 'Message ' + posted.messageId + ' was posted. Its delivery receipt is missing from the review.'
        : oldReceipt ? 'A receipt exists for v' + oldReceipt.version + ' of the invoice. There is no receipt for the current edition.'
        : wrongRecipient ? 'A receipt exists for a different destination. Delivery to ' + commitment.destination + ' is unverified.'
        : noDispatch ? 'The delivery ledger records no dispatch for this edition and destination.'
        : 'No delivery receipt or authoritative dispatch state is available.',[delivered || posted || oldReceipt || wrongRecipient || noDispatch])
  ];
  if (conflicts.size) {
    checks.unshift(makeCheck('integrity','Consistent evidence','fail',
      'The same source event ID carries conflicting evidence. Reconcile the source before applying a repair.'));
  }
  const firstGap = checks.find(c => c.state !== 'pass') || null;
  const overdue = Date.parse(workspace.asOf) > Date.parse(commitment.deadline);
  const status = !firstGap ? 'verified' : overdue || checks.some(c=>c.state === 'fail') ? 'blocked' : 'pending';
  const lastProof = !firstGap ? [doc, publication, access, delivered].sort(chronology).at(-1) : null;
  const deadlineStatus = lastProof ? Date.parse(lastProof.at) > Date.parse(commitment.deadline) ? 'fulfilled-late' : 'fulfilled-on-time'
    : overdue ? 'past-due' : 'open';
  const summary = firstGap ? firstGap.detail : deadlineStatus === 'fulfilled-late'
    ? 'The correct invoice is accessible and delivery is verified. The final required proof occurred after the deadline.'
    : 'The correct invoice is published, accessible and confirmed delivered by the deadline.';
  const related = events.map(e=>({id:e.id,at:e.at,source:SOURCES[e.source],kind:e.kind,description:describe(e)}));
  let plan = null;
  if (firstGap?.key === 'integrity') plan = remedy(commitment,'escalate','Review conflicting records','A person must reconcile the conflicting records in the source.',events,false);
  if (firstGap?.key === 'content') {
    plan = remedy(commitment,'correct','Save corrected invoice','Create a new immutable invoice edition for ' + currency(commitment.amountCents) + '. Proof tied to the previous edition will stay in the timeline.',events);
  } else if (firstGap?.key === 'publication') {
    plan = remedy(commitment,'publish','Publish invoice','Publish this exact saved edition in the fictional document store.',events);
  } else if (firstGap?.key === 'access') {
    plan = remedy(commitment,'grant','Grant customer access','Grant read access to ' + commitment.destination + ' for this edition only.',events);
  } else if (firstGap?.key === 'delivery') {
    if (posted) {
      const receipt = (workspace.providerReceipts || []).find(e => relevant(e,commitment,workspace.asOf) && e.kind === 'delivery.delivered'
        && editionMatch(e) && e.destination === commitment.destination && e.messageId === posted.messageId && Date.parse(e.at) >= Date.parse(posted.at));
      plan = receipt ? remedy(commitment,'reconcile','Retrieve existing receipt','Read the simulated provider receipt for ' + posted.messageId + ' and add it to the review. No second message is sent.',events)
        : remedy(commitment,'escalate','Investigate delivery','The provider has no matching receipt for the posted message. A second send could duplicate it.',events,false);
    } else if (noDispatch && !wrongRecipient) {
      plan = remedy(commitment,'deliver','Deliver corrected invoice','The reference ledger confirms no dispatch. Simulate a single delivery of this edition to ' + commitment.destination + '.',events);
    } else {
      plan = remedy(commitment,'escalate','Investigate delivery','Dispatch history is uncertain. Verify it before sending another message.',events,false);
    }
  }
  return {commitment,status,summary,firstGap,checks,timeline:related,plan,acknowledgement:ACK,duplicateCount,
    deadlineStatus,fulfilledAt:lastProof?.at || null,caseStatus:caseEvent?.kind === 'case.resolved' ? 'Resolved' : 'Open'};
}

export function inspectCommitment(workspace, commitmentId) {
  const commitment = workspace.commitments.find(c => c.id === commitmentId);
  if (!commitment) throw new RangeError('Unknown commitment');
  return evaluate(workspace, commitment);
}

export function summarizeWorkspace(workspace) {
  const out = {total:workspace.commitments.length, verified:0, blocked:0, pending:0};
  for (const commitment of workspace.commitments) out[evaluate(workspace,commitment).status]++;
  return out;
}

export function applyRemedy(workspace, proposed) {
  const unchanged = message => ({workspace,applied:false,message});
  const commitment = workspace.commitments.find(c=>c.id === proposed?.commitmentId);
  if (!commitment) return unchanged('No matching commitment.');
  const {plan} = evaluate(workspace, commitment);
  if (!plan || plan.id !== proposed.id || plan.type !== proposed.type) return unchanged('This plan is stale or has already been applied. Review the current proof.');
  if (!plan.canApply) return unchanged(plan.description);
  const {events} = orderedEvidence(workspace,commitment);
  const doc = latest(events,e=>e.kind === 'document.saved');
  const appliedAt = new Date(Date.parse(workspace.asOf) + 1000).toISOString();
  const edition = plan.type === 'correct' ? commitment.invoiceId + '/corrected/' + appliedAt : doc.edition;
  const suffix = 'sim/' + appliedAt + '/' + plan.type;
  const make = (kind, part, details = {}) => eventFor(commitment,kind,appliedAt,suffix + '/' + part,{edition,...details});
  let additions;
  switch(plan.type) {
    case 'correct':
      additions = [make('document.saved','1'),make('delivery.notDispatched','2')]; break;
    case 'publish':
      additions = [make('document.published','1')]; break;
    case 'grant':
      additions = [make('access.granted','1')]; break;
    case 'deliver': {
      const details = {messageId:commitment.id + '/message/' + edition};
      additions = [make('delivery.posted','1',details),make('delivery.delivered','2',details)]; break;
    }
    case 'reconcile': {
      const posted = latest(events,e=>e.kind === 'delivery.posted' && e.edition === edition && e.version === doc.version && e.destination === commitment.destination && e.messageId && Date.parse(e.at) >= Date.parse(doc.at));
      const receipt = (workspace.providerReceipts || []).find(e => e.kind === 'delivery.delivered' && relevant(e,commitment,workspace.asOf)
        && e.edition === edition && e.version === doc.version && e.destination === commitment.destination
        && e.messageId === posted.messageId && Date.parse(e.at) >= Date.parse(posted.at));
      if (!receipt) return unchanged('No authoritative receipt was available.');
      additions = [{...receipt}]; break;
    }
    default: return unchanged('No supported remedy.');
  }
  return {workspace:{...workspace, asOf:appliedAt, events:[...workspace.events,...additions]},applied:true,message:plan.label + ' completed in the simulation.'};
}
