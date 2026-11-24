import { createWorkspace, inspectCommitment, summarizeWorkspace, applyRemedy } from "./engine.mjs";

const ui = Object.fromEntries(["metrics", "reset", "export", "inbox-list", "list-count", "detail", "search", "as-of", "announcement"].map(id => [id, document.getElementById(id)]));
const filters = [
  { id: "all", key: "total", label: "All commitments" },
  { id: "blocked", key: "blocked", label: "Blocked" },
  { id: "pending", key: "pending", label: "Pending" },
  { id: "verified", key: "verified", label: "Verified" },
];
const statusLabels = { blocked: "Blocked", pending: "Pending", verified: "Verified" };
const stateLabels = { pass: "Confirmed", fail: "Failed", unknown: "Unverified", unobservable: "Unobservable" };
const deadlineLabels = {
  open: "Open",
  "past-due": "Past due",
  "fulfilled-on-time": "Fulfilled on time",
  "fulfilled-late": "Fulfilled late",
};
const stateSymbols = { pass: "✓", fail: "!", unknown: "?", unobservable: "·" };
const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

let workspace = createWorkspace();
let selectedId = workspace.commitments[0]?.id ?? null;
let filter = "all";
let search = "";
let view = "chain";
let staged = null;
let selectedEvidence = null;
let feedback = "";
let assessments = [];

function escapeHtml(value) {
  const chars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, ch => chars[ch]);
}

function timeLabel(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? formatter.format(date) : "Unknown";
}

function announce(message) {
  ui.announcement.textContent = message;
}

function statusChip(status) {
  return `<span class="chip ${escapeHtml(status)}"><span class="dot ${escapeHtml(status)}" aria-hidden="true"></span>${escapeHtml(statusLabels[status] ?? status)}</span>`;
}

function refreshAssessments() {
  assessments = workspace.commitments.map(commitment => inspectCommitment(workspace, commitment.id));
}

function matched() {
  const query = search.trim().toLocaleLowerCase();
  return assessments.filter(({ commitment, status }) => {
    if (filter !== "all" && status !== filter) return false;
    return [commitment.id, commitment.customer, commitment.customerId, commitment.invoiceId, commitment.transactionId, commitment.destination].some(value => String(value ?? "").toLocaleLowerCase().includes(query));
  });
}

function clearDetailContext() {
  view = "chain";
  staged = null;
  selectedEvidence = null;
  feedback = "";
}

function renderMetrics() {
  const counts = summarizeWorkspace(workspace);
  ui.metrics.innerHTML = filters.map(({id, key, label}) => `
    <button type="button" class="metric" data-filter="${id}" aria-pressed="${filter === id}" aria-label="${label}, ${counts[key]} commitments">
      <span class="metric-caption"><span class="dot ${id}" aria-hidden="true"></span>${label}</span>
      <strong>${counts[key]}</strong>
    </button>`).join("");
}

function renderInbox(rows) {
  ui["list-count"].textContent = `${rows.length} of ${assessments.length} shown`;
  if (!rows.length) {
    ui["inbox-list"].innerHTML = '<li class="empty">No matching commitments.</li>';
    return;
  }
  ui["inbox-list"].innerHTML = rows.map(({ commitment, status }) => `
    <li><button type="button" class="inbox-item" data-select="${escapeHtml(commitment.id)}" aria-current="${commitment.id === selectedId}">
      <span class="inbox-meta"><span class="case-id">${escapeHtml(commitment.id)}</span>${statusChip(status)}</span>
      <span class="inbox-line"><span class="inbox-name">${escapeHtml(commitment.customer)}</span><span class="inbox-arrow" aria-hidden="true">›</span></span>
    </button></li>`).join("");
}

function fact(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function renderStep(check) {
  const evidence = check.evidenceIds ?? [];
  const links = evidence.map(id => `<button class="evidence-button" type="button" data-evidence="${escapeHtml(id)}" aria-label="Inspect source record ${escapeHtml(id)}">${escapeHtml(id)}</button>`);
  return `<li class="step">
    <span class="state-icon ${escapeHtml(check.state)}" aria-hidden="true">${stateSymbols[check.state] ?? "?"}</span>
    <div><div class="proof-line"><h4>${escapeHtml(check.label)}</h4><span class="state-word">${escapeHtml(stateLabels[check.state] ?? check.state)}</span></div>
    <p class="step-text">${escapeHtml(check.detail)}</p>
    ${links.length ? `<div class="refs">${links.join(" · ")}</div>` : ""}</div></li>`;
}

function renderRemedy(result) {
  const plan = result.plan;
  if (!plan) return "";
  if (staged && staged.id !== plan.id) staged = null;
  if (staged) {
    return `<section class="remedy" id="repair" aria-label="Staged repair">
      <span class="mini">Staged repair</span><h3>${escapeHtml(plan.label)}</h3>
      <p>${escapeHtml(plan.description)}</p><p>Applying this step updates the fictional evidence records. The checks will run again on the updated records.</p>
      <div class="action-buttons"><button class="btn accent" type="button" data-action="apply">Apply in simulation</button><button class="btn" type="button" data-action="cancel">Cancel</button></div></section>`;
  }
  return `<section class="remedy" id="repair" aria-label="Proposed next step">
    <span class="mini">${plan.canApply ? "Suggested repair" : "Human review"}</span><h3>${escapeHtml(plan.label)}</h3>
    <p>${escapeHtml(plan.description)}</p>
    ${plan.canApply ? '<button class="btn" type="button" data-action="stage">Stage repair</button>' : ""}</section>`;
}

function renderChain(result) {
  const passCount = result.checks.filter(check => check.state === "pass").length;
  return `<div class="section-heading"><h3>Acceptance checks</h3><span class="small">${passCount} of ${result.checks.length} confirmed</span></div>
    <ol class="chain">${result.checks.map(renderStep).join("")}</ol>
    <p class="ack">${escapeHtml(result.acknowledgement)}</p>
    ${renderRemedy(result)}`;
}

function renderRecords(result) {
  const dedup = result.duplicateCount ? `${result.duplicateCount} duplicate ${result.duplicateCount === 1 ? "record was" : "records were"} reconciled. ` : "";
  const records = result.timeline.map(event => `<li class="record ${selectedEvidence === event.id ? "highlight" : ""}" tabindex="-1" data-record-id="${escapeHtml(event.id)}">
    <div class="rec-head"><span>${escapeHtml(event.source)}</span><time datetime="${escapeHtml(event.at)}">${escapeHtml(timeLabel(event.at))}</time></div>
    <p>${escapeHtml(event.description)}</p><span class="ref record-id">${escapeHtml(event.id)} · ${escapeHtml(event.kind)}</span></li>`);
  return `<div class="section-heading"><h3>Source records</h3><span class="small">${records.length} ${records.length === 1 ? "record" : "records"}</span></div>
    <p class="records-note">${escapeHtml(dedup)}These records come from the simulated case, document, and message systems.</p>
    <ul class="records">${records.join("") || '<li class="empty">No source records are available for this commitment.</li>'}</ul>`;
}

function renderDetail(result) {
  if (!result) {
    ui.detail.innerHTML = '<div class="empty">Choose another status or change your search to inspect a commitment.</div>';
    return;
  }
  const c = result.commitment;
  const grade = result.status;
  const caseLabel = String(result.caseStatus ?? "Unknown").replace(/^./, letter => letter.toLocaleUpperCase());
  const outcomeLabel = grade === "verified" ? "Proof verified" : grade === "pending" ? "Awaiting proof" : "First unmet condition";
  ui.detail.innerHTML = `<div class="detail-top">
    <div class="detail-meta"><span class="ref">${escapeHtml(c.id)}</span>${statusChip(grade)}</div>
    <h2 class="detail-title">${escapeHtml(c.customer)}</h2>
    <p class="promise">${escapeHtml(c.promise)}</p>
    <dl class="facts">
      ${fact("Case status", caseLabel)}${fact("Deadline", `${timeLabel(c.deadline)} · ${deadlineLabels[result.deadlineStatus] ?? "Unknown"}`)}
      ${fact("Required invoice", `${c.invoiceId} · v${c.version} · ${currency.format(c.amountCents / 100)}`)}
      ${fact("Deliver to", c.destination)}
    </dl>
  </div>
  <div class="outcome-strip ${grade}"><p class="mini">${outcomeLabel}</p><p>${escapeHtml(result.summary)}</p>${view === "chain" && result.plan ? '<a class="repair-shortcut" href="#repair">Review next step ↓</a>' : ""}</div>
  <div class="views" role="group" aria-label="Evidence view"><button class="tab-btn" type="button" data-view="chain" aria-pressed="${view === "chain"}">Proof chain</button>
  <button class="tab-btn" type="button" data-view="records" aria-pressed="${view === "records"}">Source records</button></div>
  <div class="detail-body">${feedback ? `<p class="review-note">${escapeHtml(feedback)}</p>` : ""}${view === "chain" ? renderChain(result) : renderRecords(result)}</div>`;
}

function render() {
  const rows = matched();
  if (!rows.some(row => row.commitment.id === selectedId)) {
    selectedId = rows[0]?.commitment.id ?? null;
    clearDetailContext();
  }
  renderMetrics();
  renderInbox(rows);
  renderDetail(assessments.find(row => row.commitment.id === selectedId));
  ui["as-of"].textContent = `Simulation clock · ${timeLabel(workspace.asOf)}`;
}

function focusCurrentListItem() {
  const item = [...ui["inbox-list"].querySelectorAll("[data-select]")].find(button => button.dataset.select === selectedId);
  item?.focus({ preventScroll: true });
}

function handleStageAction(action, result) {
  if (!result) return;
  if (action === "stage" && result.plan?.canApply) {
    staged = structuredClone(result.plan);
    feedback = "";
    renderDetail(result);
    ui.detail.querySelector('[data-action="apply"]')?.focus();
    announce(`Staged repair. ${staged.label}.`);
  } else if (action === "cancel") {
    staged = null;
    renderDetail(result);
    ui.detail.querySelector('[data-action="stage"]')?.focus();
    announce("Staged repair cancelled.");
  } else if (action === "apply" && staged) {
    const outcome = applyRemedy(workspace, staged);
    workspace = outcome.workspace;
    staged = null;
    refreshAssessments();
    const updated = assessments.find(row => row.commitment.id === selectedId);
    if (filter !== "all" && updated.status !== filter) filter = "all";
    feedback = outcome.message;
    render();
    ui.detail.focus({ preventScroll: true });
    announce(`${outcome.message} ${updated.summary}`);
  }
}

ui.metrics.addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  filter = button.dataset.filter;
  render();
  ui.metrics.querySelector(`[data-filter="${filter}"]`)?.focus({ preventScroll: true });
});

ui.search.addEventListener("input", () => {
  search = ui.search.value;
  render();
});

ui["inbox-list"].addEventListener("click", event => {
  const button = event.target.closest("[data-select]");
  if (!button) return;
  selectedId = button.dataset.select;
  clearDetailContext();
  render();
  if (window.matchMedia("(max-width: 720px)").matches) {
    ui.detail.focus();
  } else {
    focusCurrentListItem();
  }
});

ui.detail.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const result = assessments.find(row => row.commitment.id === selectedId);
  if (button.dataset.evidence) {
    view = "records";
    selectedEvidence = button.dataset.evidence;
    renderDetail(result);
    const row = [...ui.detail.querySelectorAll("[data-record-id]")].find(record => record.dataset.recordId === selectedEvidence);
    if (row) row.focus();
  } else if (button.dataset.view) {
    view = button.dataset.view;
    selectedEvidence = null;
    renderDetail(result);
    ui.detail.querySelector(`[data-view="${view}"]`)?.focus({ preventScroll: true });
  } else if (button.dataset.action) {
    handleStageAction(button.dataset.action, result);
  }
});

ui.reset.addEventListener("click", () => {
  workspace = createWorkspace();
  filter = "all";
  selectedId = workspace.commitments[0]?.id ?? null;
  search = "";
  ui.search.value = "";
  clearDetailContext();
  refreshAssessments();
  feedback = "Demo reset to its original evidence records.";
  render();
  announce(feedback);
});

ui.export.addEventListener("click", () => {
  const payload = {
    schemaVersion: 1,
    product: "Promise-to-Proof",
    executionMode: "fictional-local-simulation",
    exportedAt: new Date().toISOString(),
    asOf: workspace.asOf,
    totals: summarizeWorkspace(workspace),
    evidence: workspace.events,
    commitments: assessments,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "promise-to-proof-review.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  announce("Review exported as JSON.");
});

refreshAssessments();
render();

