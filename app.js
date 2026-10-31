const $ = (id) => document.getElementById(id);
const number = (n) => new Intl.NumberFormat().format(n || 0);
const statusLabels = { COMPLETE: 'Complete', INCOMPLETE: 'Incomplete', NOT_APPLICABLE: 'Not applicable' };
let searchTimer;

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}
function showError(message) { $('errorBanner').textContent = message; $('errorBanner').classList.remove('hidden'); }
function renderSummary(data) {
  $('totalRequests').textContent = number(data.total_requests);
  $('completeCount').textContent = number(data.statuses.COMPLETE);
  $('incompleteCount').textContent = number(data.statuses.INCOMPLETE);
  $('naCount').textContent = number(data.statuses.NOT_APPLICABLE);
  const items = [
    ['COMPLETE', data.statuses.COMPLETE, 'complete'],
    ['INCOMPLETE', data.statuses.INCOMPLETE, 'incomplete'],
    ['NOT_APPLICABLE', data.statuses.NOT_APPLICABLE, 'na']
  ];
  const max = Math.max(1, ...items.map(x => x[1]));
  $('statusChart').innerHTML = items.map(([key, count, cls]) => `<div class="bar-item"><div class="bar-label">${statusLabels[key]}</div><div class="bar-track"><div class="bar-fill ${cls}" style="width:${Math.max(count ? 2 : 0, count/max*100)}%"></div></div><div class="bar-value">${number(count)}</div></div>`).join('');
  const ops = data.operation_counts || {};
  const signals = [
    ['⌕', 'Remaining records found', ops.REPORT_REMAINING_RECORD || 0, 'REPORT_REMAINING_RECORD steps'],
    ['◇', 'Exposed PII findings', ops.REPORT_EXPOSED_PII || 0, 'REPORT_EXPOSED_PII steps'],
    ['⇄', 'Active data flows', ops.REPORT_ACTIVE_DATA_FLOW || 0, 'REPORT_ACTIVE_DATA_FLOW steps'],
    ['↻', 'Restore risks', ops.REPORT_RESTORE_RISK || 0, 'REPORT_RESTORE_RISK steps'],
  ];
  $('signalList').innerHTML = signals.map(([icon, title, count, note]) => `<div class="signal-row"><div class="signal-icon">${icon}</div><div><b>${title}</b><small>${note}</small></div><div class="signal-num">${number(count)}</div></div>`).join('');
}
function safe(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function badge(status) { return `<span class="status-badge ${safe(status)}">${safe(statusLabels[status] || status)}</span>`; }
async function loadCases() {
  const q = $('searchInput').value.trim(); const status = $('statusFilter').value;
  const params = new URLSearchParams({q, status});
  try {
    const data = await getJSON(`/api/cases?${params}`);
    $('caseCount').textContent = `${number(data.count)} matching cases`;
    $('tableSummary').textContent = `Showing ${number(data.cases.length)} of ${number(data.count)} matching cases`;
    if (!data.cases.length) {
      $('casesBody').innerHTML = '<tr><td colspan="6" class="empty-cell">No cases match this search.</td></tr>'; return;
    }
    $('casesBody').innerHTML = data.cases.map(c => `<tr><td class="case-id">${safe(c.case_id)}</td><td>${safe((c.requested_at || '—').replace('T',' ').replace('Z',' UTC'))}</td><td>${safe(c.reported_status || '—')}</td><td>${badge(c.deletion_status)}</td><td>${number(c.step_count)}</td><td><button class="view-btn" data-case="${safe(c.case_id)}">View details ↗</button></td></tr>`).join('');
  } catch (err) { showError(`Could not load cases: ${err.message}. Confirm output.csv and dataset/deletion_requests.csv exist in the project root.`); }
}
function detailField(label, value) { return `<div><div class="detail-label">${safe(label)}</div><div class="detail-value">${safe(value || '—')}</div></div>`; }
async function openCase(caseId) {
  try {
    const c = await getJSON(`/api/cases/${encodeURIComponent(caseId)}`);
    $('detailTitle').textContent = c.case_id;
    const summary = `<div class="detail-card"><div class="detail-grid">${detailField('Deletion status', c.deletion_status)}${detailField('Reported status', c.reported_status)}${detailField('Email / identity', c.email)}${detailField('Requested at', c.requested_at)}${detailField('Reported at', c.reported_at)}${detailField('Audit at', c.audit_at)}</div><div style="margin-top:15px"><div class="detail-label">Request text</div><div class="request-text">${safe(c.request_text || 'No request text supplied.')}</div></div></div>`;
    const steps = (c.steps || []).map(s => `<div class="step-card"><div class="step-header"><span class="step-number">STEP ${safe(s.step_no)}</span><span class="phase">${safe(s.phase)}</span></div><div class="step-operation">${safe(s.operation)}</div><div class="step-meta"><div><small>SYSTEM</small><b>${safe(s.system_id || '—')}</b></div><div><small>RESOURCE</small><b>${safe(s.resource_id || '—')}</b></div><div><small>STATE</small><b>${safe(s.state || '—')}</b></div><div><small>EVIDENCE ID</small><b>${safe(s.evidence_id || '— (proposed action / no citation)')}</b></div></div></div>`).join('');
    $('detailContent').innerHTML = summary + `<div class="detail-card"><h3>Ordered audit steps (${(c.steps || []).length})</h3>${steps || '<div class="no-steps">No steps recorded for this case.</div>'}</div>`;
    $('detailOverlay').classList.remove('hidden'); document.body.style.overflow = 'hidden';
  } catch (err) { showError(`Could not open ${caseId}: ${err.message}`); }
}
$('casesBody').addEventListener('click', e => { const btn = e.target.closest('[data-case]'); if (btn) openCase(btn.dataset.case); });
$('searchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadCases, 180); });
$('statusFilter').addEventListener('change', loadCases);
function closeDetail() { $('detailOverlay').classList.add('hidden'); document.body.style.overflow = ''; }
$('closeDetail').addEventListener('click', closeDetail);
$('detailOverlay').addEventListener('click', e => { if (e.target === $('detailOverlay')) closeDetail(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
(async function init() { try { const summary = await getJSON('/api/summary'); renderSummary(summary); await loadCases(); } catch (err) { showError(`Dashboard could not load data: ${err.message}`); } })();
