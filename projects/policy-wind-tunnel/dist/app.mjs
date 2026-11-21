import { BASE_POLICY, DEFAULT_POLICY, SYSTEMS, DEFAULT_IMPLEMENTATIONS, evaluateCase, evaluateSuite, validatePolicy } from './engine.mjs';
import { createFixtures, PRESETS, SCENARIOS } from './fixtures.mjs';
import { parseCaseFile, serializeReview } from './io.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
const money = value => Number.isFinite(value) ? new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(value) : 'Unrecorded';
const labels = {approve:'Approve',deny:'Deny',review:'Human review',unknown:'Unknown'};
const tones = {approve:'good',deny:'bad',review:'warn',unknown:'neutral'};
const badge = decision => `<span class="badge ${tones[decision] ?? 'neutral'}">${escape(labels[decision] ?? decision)}</span>`;
let cases = createFixtures();
let profiles = clone(DEFAULT_IMPLEMENTATIONS);
let suite;
let selectedId = cases[0].id;
let scenario = 'returns';
let history = [];
let referenceRun;
let lastElapsed = 0;
let dirty = false;

function status(message, error = false) {
  $('status-message').textContent = message;
  $('status-message').classList.toggle('error', error);
}

function readPolicy() {
  return {version:'2.0',windowDays:$('policy-days').value === '' ? NaN : Number($('policy-days').value),effectiveDate:$('policy-date').value,allowPartial:$('policy-partial').checked,maxAutoAmount:$('policy-threshold').value === '' ? NaN : Number($('policy-threshold').value),requireReceipt:$('policy-receipt').checked};
}

function setPolicy(policy) {
  $('policy-days').value = policy.windowDays;
  $('policy-date').value = policy.effectiveDate;
  $('policy-partial').checked = policy.allowPartial;
  $('policy-threshold').value = policy.maxAutoAmount;
  $('policy-receipt').checked = policy.requireReceipt;
  updatePolicySummary();
}

function updatePolicySummary() {
  const p = readPolicy();
  $('policy-summary').textContent = `Purchases before ${p.effectiveDate || 'the effective date'} retain v1.0: 30 days, full-order returns, a receipt, and a $100 automatic limit. Opened items remain ineligible.`;
}

function markDirty() {
  dirty = true;
  updatePolicySummary();
  status('Settings changed. Run comparison to update the results.');
}

function renderProfiles() {
  $('implementation-controls').innerHTML = SYSTEMS.map(({id,name}) => `<div class="implementation-row"><div class="implementation-name"><span class="system-letter">${escape(name.charAt(0))}</span><strong>${escape(name)}</strong></div><label class="implementation-mode"><span class="visually-hidden">${escape(name)} policy version</span><select data-system="${id}" data-setting="mode" aria-label="${escape(name)} policy version"><option value="baseline" ${profiles[id].mode==='baseline'?'selected':''}>Previous policy</option><option value="proposed" ${profiles[id].mode==='proposed'?'selected':''}>Proposed policy</option></select></label><label class="checkbox-field compact"><input type="checkbox" data-system="${id}" data-setting="respectEffectiveDate" ${profiles[id].respectEffectiveDate?'checked':''}/><span>Honor effective date</span></label></div>`).join('');
}

function renderMetrics() {
  const s = suite.summary;
  const items = [
    ['Cases compared',s.total,'Same facts, three implementations','neutral'],
    ['Disagreements',s.mismatches,s.mismatches?'Cases with at least one wrong outcome':'All observable outcomes align',s.mismatches?'bad':'good'],
    ['Historical regressions',s.regressions,'Unchanged expectations, incorrect behavior',s.regressions?'warn':'good'],
    ['Missing evidence',s.unknown,'Kept unresolved until facts are available','neutral'],
  ];
  $('metrics').innerHTML = items.map(([label,value,caption,tone])=>`<div class="stat-card ${tone}"><span>${label}</span><strong>${value}</strong><p>${caption}</p></div>`).join('');
}

function visibleRows() {
  const query = $('case-search').value.trim().toLowerCase();
  const filter = $('filter-select').value;
  return suite.results.filter(row => (!query || [row.record.id,row.record.customer,row.record.orderId,row.record.note].some(v=>String(v??'').toLowerCase().includes(query))) && (filter==='all'||filter==='mismatch'&&row.mismatches.length||filter==='changed'&&row.changed||filter==='unknown'&&row.unknown));
}

function renderTable() {
  const rows = visibleRows();
  $('result-count').textContent = `${rows.length} / ${suite.results.length}`;
  $('results-body').innerHTML = rows.length ? rows.map(row=>`<tr data-case="${escape(row.record.id)}" class="${row.record.id===selectedId?'selected':''}"><th scope="row"><button type="button" class="case-button" data-select-case="${escape(row.record.id)}" aria-label="Inspect ${escape(row.record.id)}"><strong>${escape(row.record.id)}</strong><span>${escape(row.record.customer)}</span></button></th><td>${badge(row.expected.decision)}</td>${SYSTEMS.map(({id})=>`<td class="${row.mismatches.includes(id)?'mismatch':''}">${badge(row.systems[id].decision)}<span class="cell-meta">${row.systems[id].applicableVersion==='unresolved'?'No verdict':`Policy ${escape(row.systems[id].applicableVersion)}`}</span></td>`).join('')}<td>${row.unknown?'<span class="impact-label">Needs evidence</span>':row.regression?'<span class="impact-label regression">Regression</span>':row.changed?'<span class="impact-label changed">Policy change</span>':'<span class="impact-label">Unchanged</span>'}</td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><strong>No matching cases</strong><p>Try a different search or filter.</p></div></td></tr>';
}

function traceHTML(result) {
  return `<ol class="trace-list">${result.trace.map(step=>`<li class="trace-step ${step.passed===true?'passed':step.passed===false?'failed':'unresolved'}"><div class="trace-title"><span class="trace-symbol" aria-hidden="true">${step.passed===true?'✓':step.passed===false?'×':'?'}</span><strong>${escape(step.label)}</strong></div><p>${escape(step.value)}</p><small>${escape(step.expected)}</small><details><summary>Source evidence</summary><p>${escape(step.evidence)}</p></details></li>`).join('')}</ol>`;
}

function renderDetail() {
  const row = suite.results.find(r=>r.record.id===selectedId) ?? suite.results[0];
  if(!row) return;
  selectedId = row.record.id;
  const r = row.record;
  $('detail-panel').innerHTML = `<div class="detail-heading"><p class="section-kicker">Case evidence</p><div class="detail-title"><h3>${escape(r.id)}</h3>${badge(row.expected.decision)}</div><p>${escape(r.customer)} <span class="muted">· ${escape(r.orderId)}</span></p></div><p class="case-note">${escape(r.note)}</p><dl class="case-facts"><div><dt>Purchase</dt><dd>${escape(r.purchaseDate||'Missing')}</dd></div><div><dt>Return requested</dt><dd>${escape(r.requestDate||'Missing')}</dd></div><div><dt>Amount</dt><dd>${money(r.amount)}</dd></div><div><dt>Items returned</dt><dd>${escape(r.itemsReturned??'?')} of ${escape(r.totalItems??'?')}</dd></div><div><dt>Receipt</dt><dd>${r.receipt===true?'Present':r.receipt===false?'Absent':'Unknown'}</dd></div><div><dt>Expected policy</dt><dd>${escape(row.expected.applicableVersion)}</dd></div></dl><div class="decision-explanation"><strong>Why this outcome?</strong><p>${escape(row.expected.reason)}</p></div>${row.mismatches.length?`<div class="notice"><strong>${row.mismatches.length} implementation${row.mismatches.length===1?'':'s'} disagree</strong><p>${row.mismatches.map(id=>escape(SYSTEMS.find(s=>s.id===id).name)).join(', ')}</p></div>`:row.unknown?'<div class="notice"><strong>Agreement is not verification</strong><p>The evidence is incomplete, so this case stays unresolved.</p></div>':'<div class="notice success"><strong>Implementations agree</strong><p>All three outcomes match the applicable policy.</p></div>'}<button class="button secondary full-width" type="button" data-open-replay="${escape(r.id)}">Replay this decision</button><h4 class="trace-heading">Expected decision trace</h4>${traceHTML(row.expected)}`;
}

function updateReplayOptions() {
  const old = $('replay-case').value;
  $('replay-case').innerHTML = suite.results.map(r=>`<option value="${escape(r.record.id)}">${escape(r.record.id)} · ${escape(r.record.customer)}${r.mismatches.length?' · disagreement':''}</option>`).join('');
  $('replay-case').value = suite.results.some(r=>r.record.id===old) ? old : selectedId;
}

function addHistory(entry) {
  history.unshift({...entry,at:new Date().toISOString(),id:crypto.randomUUID?.()??String(Date.now())});
  history = history.slice(0,12);
  renderHistory();
}

function renderHistory() {
  $('history-list').innerHTML = history.length ? history.map(entry=>`<article class="history-entry"><div><strong>${escape(entry.title)}</strong><p>${escape(entry.description)}</p></div><time datetime="${entry.at}">${new Date(entry.at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time>${entry.snapshot?`<button type="button" class="button ghost" data-load-run="${entry.id}">Use as replay baseline</button>`:''}</article>`).join('') : '<div class="empty-state"><p>No saved comparisons in this session. Run a comparison to record one.</p></div>';
}

function runComparison(title='Policy comparison', remember=true) {
  try {
    const policy = readPolicy();
    const validation = validatePolicy(policy);
    if(!validation.valid) throw new Error(validation.errors.join(' '));
    const start = performance.now();
    const next = evaluateSuite(cases, policy, profiles);
    lastElapsed = performance.now()-start;
    suite = next;
    dirty = false;
    if(!referenceRun) referenceRun = clone(suite);
    renderMetrics();renderTable();renderDetail();updateReplayOptions();
    if(remember) addHistory({title,description:`${suite.summary.total} cases · ${suite.summary.mismatches} disagreements · ${suite.summary.regressions} historical regressions`,snapshot:clone(suite)});
    status(`${title} complete. ${suite.summary.total} cases, ${suite.summary.changed} intended outcome changes, ${suite.summary.mismatches} disagreements, and ${suite.summary.unknown} unresolved cases.`);
    return true;
  } catch(error) {status(error.message,true);return false;}
}

function setView(view) {
  $('review-view').hidden = view!=='review';
  $('replay-view').hidden = view!=='replay';
  document.querySelectorAll('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===view);if(button.dataset.view===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  if(view==='replay') renderHistory();
}

function renderReplay() {
  try {
    const id = $('replay-case').value;
    const system = $('replay-system').value;
    const original = referenceRun?.results.find(row=>row.record.id===id);
    const currentRow = suite?.results.find(row=>row.record.id===id);
    if(!currentRow) throw new Error('Run a comparison and choose an available case.');
    const record = clone(original?.record ?? currentRow.record);
    const policy = readPolicy();
    const validation=validatePolicy(policy);if(!validation.valid)throw new Error(validation.errors.join(' '));
    const p = profiles[system];
    const after = evaluateCase(record,p.mode==='baseline'?BASE_POLICY:policy,{respectEffectiveDate:p.respectEffectiveDate});
    const expected = evaluateCase(record,policy);
    const before = original?.systems[system]??currentRow.systems[system];
    const baseCases=referenceRun?.results.map(r=>r.record)??cases;
    const neighboring=evaluateSuite(baseCases,policy,profiles);
    const newlyBroken=neighboring.results.filter(r=>{const old=referenceRun?.results.find(o=>o.record.id===r.record.id);return old && old.systems[system].decision===old.expected.decision && r.systems[system].decision!==r.expected.decision;});
    const resolved=neighboring.results.filter(r=>{const old=referenceRun?.results.find(o=>o.record.id===r.record.id);return old && old.systems[system].decision!==old.expected.decision && r.systems[system].decision===r.expected.decision && r.expected.decision!=='unknown';});
    $('replay-output').innerHTML=`<div class="replay-case-heading"><div><p class="section-kicker">${escape(SYSTEMS.find(s=>s.id===system).name)}</p><h3>${escape(record.id)} · ${escape(record.customer)}</h3><p class="muted">Recorded purchase ${escape(record.purchaseDate)} · request ${escape(record.requestDate)} · ${money(record.amount)}</p></div><span class="badge neutral">Facts held fixed</span></div><div class="replay-comparison"><section class="replay-result"><span>Recorded baseline</span>${badge(before.decision)}<p>${escape(before.reason)}</p></section><section class="replay-result ${after.decision===expected.decision&&after.decision!=='unknown'?'matched':'unmatched'}"><span>Current implementation</span>${badge(after.decision)}<p>${escape(after.reason)}</p></section><section class="replay-result"><span>Expected now</span>${badge(expected.decision)}<p>${escape(expected.reason)}</p></section></div><div class="replay-impact"><strong>Regression check across ${neighboring.summary.total} recorded cases</strong><p>${resolved.length} disagreements resolved. ${newlyBroken.length} previously aligned cases now disagree. ${neighboring.summary.bySystem[system].mismatches} disagreements remain for this implementation.</p>${newlyBroken.length?`<p class="regression">Newly affected cases: ${newlyBroken.map(r=>escape(r.record.id)).join(', ')}</p>`:''}</div><div class="replay-repair"><button type="button" class="button secondary" data-replay-naive="${system}">Try latest policy for this system</button><button type="button" class="button primary" data-replay-fix="${system}">Apply policy with effective date</button></div><p class="replay-method">Controlled reference replay: recorded case facts are evaluated with explicit rules. No live model or external service is called. A matching unknown remains unverified.</p><details class="replay-trace" open><summary>Inspect current decision trace</summary>${traceHTML(after)}</details>`;
    addHistory({title:`Replay ${id}`,description:`${SYSTEMS.find(s=>s.id===system).name}: ${labels[before.decision]} to ${labels[after.decision]}. ${newlyBroken.length} new disagreements.`});
    status(`Replayed ${id} against ${neighboring.summary.total} recorded cases. ${newlyBroken.length} newly introduced disagreements for the selected implementation.`);
  }catch(error){status(error.message,true);}
}

function resetScenario(id='returns') {
  scenario=id;cases=createFixtures(id);profiles=clone(DEFAULT_IMPLEMENTATIONS);selectedId=cases[0].id;referenceRun=null;
  $('scenario-select').value=id;$('case-search').value='';$('filter-select').value='all';
  setPolicy(PRESETS[id]);renderProfiles();runComparison('Reference scenario');
}

$('run-button').addEventListener('click',()=>{runComparison();});
$('reset-button').addEventListener('click',()=>{history=[];resetScenario(scenario);setView('review');});
$('scenario-select').addEventListener('change',event=>resetScenario(event.target.value));
['policy-days','policy-date','policy-threshold','policy-partial','policy-receipt'].forEach(id=>$(id).addEventListener('input',markDirty));
$('implementation-controls').addEventListener('change',event=>{const {system,setting}=event.target.dataset;if(!Object.hasOwn(profiles,system)||!['mode','respectEffectiveDate'].includes(setting))return;profiles[system][setting]=setting==='mode'?event.target.value:event.target.checked;markDirty();});
$('fix-all-button').addEventListener('click',()=>{profiles=Object.fromEntries(SYSTEMS.map(s=>[s.id,{mode:'proposed',respectEffectiveDate:true}]));renderProfiles();runComparison('Date-aware repair');});
$('naive-fix-button').addEventListener('click',()=>{profiles=Object.fromEntries(SYSTEMS.map(s=>[s.id,{mode:'proposed',respectEffectiveDate:false}]));renderProfiles();runComparison('Latest-policy experiment');});
$('case-search').addEventListener('input',renderTable);
$('filter-select').addEventListener('change',renderTable);
$('results-body').addEventListener('click',event=>{const row=event.target.closest('[data-case]');if(!row)return;selectedId=row.dataset.case;renderTable();renderDetail();});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$('detail-panel').addEventListener('click',event=>{const b=event.target.closest('[data-open-replay]');if(!b)return;$('replay-case').value=b.dataset.openReplay;const row=suite.results.find(r=>r.record.id===b.dataset.openReplay);$('replay-system').value=row?.mismatches[0]??'agent';setView('replay');renderReplay();});
$('replay-button').addEventListener('click',renderReplay);
$('replay-output').addEventListener('click',event=>{const b=event.target.closest('[data-replay-fix],[data-replay-naive]');if(!b)return;const system=b.dataset.replayFix??b.dataset.replayNaive;profiles[system]={mode:'proposed',respectEffectiveDate:!!b.dataset.replayFix};renderProfiles();runComparison(b.dataset.replayFix?'Date-aware repair':'Latest-policy experiment');renderReplay();});
$('history-list').addEventListener('click',event=>{const b=event.target.closest('[data-load-run]');if(!b)return;const entry=history.find(h=>h.id===b.dataset.loadRun);if(entry?.snapshot){referenceRun=clone(entry.snapshot);status(`Replay baseline set to ${entry.title}. Recorded facts and decisions are frozen.`);renderReplay();}});
$('clear-history-button').addEventListener('click',()=>{history=[];referenceRun=clone(suite);renderHistory();status('Session history cleared. The current comparison is the replay baseline.');});
$('import-button').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>2*1024*1024)throw new Error('Choose a file smaller than 2 MB.');
    const imported=parseCaseFile(await file.text(),file.name);
    const next=evaluateSuite(imported,readPolicy(),profiles);
    cases=imported;selectedId=cases[0].id;referenceRun=clone(next);$('case-search').value='';$('filter-select').value='all';
    runComparison('Imported case review');status(`Imported ${cases.length} cases. Evaluation stays in this browser. ${suite.summary.unknown} cases need more evidence.`);
  }catch(error){status(`Import failed: ${error.message}`,true);}finally{event.target.value='';}
});
$('export-button').addEventListener('click',()=>{
  if(dirty&&!runComparison())return;
  const payload=serializeReview(suite,{scenario,elapsedMs:lastElapsed,referenceMode:true});
  const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`policy-review-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status('Review exported with case facts, policy settings, decisions, and evidence traces.');
});

setPolicy(DEFAULT_POLICY);renderProfiles();runComparison('Reference comparison');
if(location.hash==='#replay'){setView('replay');$('replay-case').value='RET-007';renderReplay();}
