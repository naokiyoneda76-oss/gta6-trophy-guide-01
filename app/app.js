const STORAGE_KEY = 'leonida-trophy-atlas-v1';
const SPOILER_KEY = 'leonida-trophy-atlas-hide-story-v1';

const state = { data: null, earned: new Set(), activeFilter: 'all', activeView: 'checklist', search: '', grade: 'all', hideSpoilers: false, expanded: new Set([1]) };
const $ = (selector, root = document) => root.querySelector(selector);

function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) state.earned = new Set(saved.filter(Number.isInteger));
  } catch { state.earned = new Set(); }
  state.hideSpoilers = localStorage.getItem(SPOILER_KEY) === 'true';
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.earned].sort((a, b) => a - b)));
  updateProgressSummary();
}

function updateProgressSummary() {
  const count = state.earned.size;
  const percent = state.data ? Math.round(count / state.data.trophies.length * 100) : 0;
  $('#progress-count').innerHTML = `${count} <small>/ ${state.data.trophies.length} earned</small>`;
  $('#progress-percent').textContent = `${percent}%`;
  $('#progress-fill').style.width = `${percent}%`;
  $('.progress-track').setAttribute('aria-valuenow', String(count));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function sourceMarkup(sources) {
  return sources.map(source => source.url
    ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a>`
    : `<span>${escapeHtml(source.label)} (list reference)</span>`).join('');
}

function trophyCard(trophy, options = {}) {
  const isEarned = state.earned.has(trophy.id);
  const obscured = state.hideSpoilers && trophy.kind === 'story' && !isEarned;
  const expanded = options.forceOpen || state.expanded.has(trophy.id);
  const name = obscured ? 'Hidden story trophy' : trophy.name;
  const description = obscured ? 'Story details are hidden until this trophy is earned.' : trophy.description;
  const tags = [...new Set([trophy.kind, ...(trophy.stage ? [`Stage ${trophy.stage}`] : [])])];
  const target = trophy.target !== null && trophy.target !== undefined ? `<span class="target-chip">${escapeHtml(trophy.target)} ${escapeHtml(trophy.targetLabel || 'target')}</span>` : '';
  const detail = expanded ? `<div class="card-detail"><p class="detail-label">Guide</p><p class="guide-text">${escapeHtml(trophy.guide)}</p>${trophy.caution ? `<p class="caution">${escapeHtml(trophy.caution)}</p>` : ''}<div class="detail-bottom"><div class="detail-group"><strong>Roadmap stage</strong><br>Stage ${trophy.stage}</div><div class="detail-group"><strong>References</strong><div class="source-links">${sourceMarkup(trophy.sources)}</div></div></div></div>` : '';
  return `<article class="trophy-card${expanded ? ' expanded' : ''}${isEarned ? ' earned' : ''}" data-id="${trophy.id}"><div class="card-main"><input class="earned-check" type="checkbox" aria-label="Mark ${escapeHtml(name)} as earned" ${isEarned ? 'checked' : ''}><span class="grade-badge grade-${escapeHtml(trophy.grade)}" title="${escapeHtml(trophy.grade)}">${trophy.grade[0].toUpperCase()}</span><div class="card-copy"><button class="card-title" aria-expanded="${expanded}">${escapeHtml(name)}</button><p class="card-description">${escapeHtml(description)}</p><div class="card-meta">${trophy.missable ? '<span class="missable-badge">MISSABLE</span>' : ''}${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}${target}</div></div><span class="chevron" aria-hidden="true">⌄</span></div>${detail}</article>`;
}

function visibleTrophies() {
  const term = state.search.trim().toLowerCase();
  return state.data.trophies.filter(trophy => {
    const filterMatch = state.activeFilter === 'all' || (state.activeFilter === 'missable' ? trophy.missable : state.activeFilter === 'online' ? false : trophy.tags.includes(state.activeFilter));
    const gradeMatch = state.grade === 'all' || trophy.grade === state.grade;
    const text = `${trophy.name} ${trophy.description} ${trophy.guide} ${trophy.kind}`.toLowerCase();
    return filterMatch && gradeMatch && (!term || text.includes(term));
  });
}

function renderChecklist() {
  const list = $('#trophy-list');
  const empty = $('#empty-state');
  const results = visibleTrophies();
  $('#result-count').textContent = `${results.length} ${results.length === 1 ? 'trophy' : 'trophies'}`;
  if (state.activeFilter === 'online') {
    empty.innerHTML = '<strong>No online trophies in the official list</strong><p>There are 0 online trophies; all 55 trophies are offline.</p>';
    empty.hidden = false; list.innerHTML = ''; return;
  }
  if (!results.length) {
    empty.innerHTML = '<strong>No trophies match those filters</strong><p>Try another search or category.</p>';
    empty.hidden = false; list.innerHTML = ''; return;
  }
  empty.hidden = true;
  list.innerHTML = results.map(trophy => trophyCard(trophy)).join('');
  list.querySelectorAll('.earned-check').forEach(input => input.addEventListener('change', onEarnedChange));
  list.querySelectorAll('.card-title').forEach(button => button.addEventListener('click', onCardToggle));
}

function renderRoadmap() {
  const { roadmap, trophies } = state.data;
  $('#roadmap-content').innerHTML = `<div class="roadmap-list">${roadmap.map(step => `<article class="roadmap-step"><div class="step-top"><span class="step-number">${step.step}</span><span class="step-title">${escapeHtml(step.title)}</span><span class="step-hours">${escapeHtml(step.hours)} hours</span></div><p>${escapeHtml(step.summary)}</p><div class="step-trophies">${step.trophyIds.map(id => trophies.find(t => t.id === id)).filter(Boolean).map(t => `<span class="step-trophy">${escapeHtml(t.name)}</span>`).join('')}</div></article>`).join('')}</div>`;
  $('#platinum-facts').innerHTML = [['Difficulty', '4 / 10'], ['Estimated time', 'About 200 hours'], ['Playthroughs', 'One'], ['Cheats', 'Disable trophies & saves'], ['Mission replay', 'Unavailable']].map(([label, value]) => `<div class="fact-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderMissable() {
  const trophy = state.data.trophies.find(item => item.missable);
  $('#missable-card').innerHTML = trophy ? trophyCard(trophy, { forceOpen: true }) : '<p>No missable trophies listed.</p>';
  const input = $('#missable-card .earned-check');
  if (input) input.addEventListener('change', onEarnedChange);
  const title = $('#missable-card .card-title');
  if (title) title.addEventListener('click', onCardToggle);
}

function renderSources() {
  const descriptions = [
    'Official PlayStation names, descriptions, grades and trophy count (the source list identifies this as the official list via Exophase).',
    'Primary roadmap reference for estimated time, difficulty, chapter structure, missable warning, cleanup route and trophy tips.',
    'Cross-reference for the trophy roster and activity requirements.',
    'Cross-reference for the trophy roster and completion requirements.'
  ];
  $('#sources-list').innerHTML = state.data.sources.map((source, index) => `<div class="source-row">${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>` : `<span class="source-name">${escapeHtml(source.label)}</span>`}<span>${descriptions[index] || 'Reference used while preparing the guide.'}</span></div>`).join('');
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
  document.querySelectorAll('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
}

function onEarnedChange(event) {
  const id = Number(event.currentTarget.closest('.trophy-card').dataset.id);
  if (event.currentTarget.checked) state.earned.add(id); else state.earned.delete(id);
  saveProgress(); renderChecklist(); renderMissable();
}

function onCardToggle(event) {
  const id = Number(event.currentTarget.closest('.trophy-card').dataset.id);
  state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
  renderChecklist();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify([...state.earned].sort((a, b) => a - b), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'leonida-trophy-progress.json'; anchor.click();
  URL.revokeObjectURL(url);
}

async function importProgress(file) {
  const parsed = JSON.parse(await file.text());
  const ids = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.earned) ? parsed.earned : null;
  if (!ids) throw new Error('Choose a JSON array of earned trophy IDs or an object with an earned array.');
  const valid = new Set(state.data.trophies.map(trophy => trophy.id));
  state.earned = new Set(ids.filter(id => Number.isInteger(id) && valid.has(id)));
  saveProgress(); renderChecklist(); renderMissable(); showMessage(`Imported ${state.earned.size} earned ${state.earned.size === 1 ? 'trophy' : 'trophies'}.`);
}

function showMessage(message) {
  const box = $('#message'); box.textContent = message; box.hidden = false;
  window.setTimeout(() => { box.hidden = true; }, 5000);
}

function bindControls() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.view)));
  document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(item => item.classList.toggle('selected', item === chip));
    state.activeFilter = chip.dataset.filter; renderChecklist();
  }));
  $('#search').addEventListener('input', event => { state.search = event.target.value; renderChecklist(); });
  $('#grade-filter').addEventListener('change', event => { state.grade = event.target.value; renderChecklist(); });
  $('#spoiler-toggle').checked = state.hideSpoilers;
  $('#spoiler-toggle').addEventListener('change', event => { state.hideSpoilers = event.target.checked; localStorage.setItem(SPOILER_KEY, String(state.hideSpoilers)); renderChecklist(); });
  $('#export-button').addEventListener('click', exportProgress);
  $('#import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try { await importProgress(file); } catch (error) { showMessage(error.message || 'Could not read that progress file.'); }
    event.target.value = '';
  });
  $('#reset-button').addEventListener('click', () => {
    if (!window.confirm('Clear all earned trophies from this browser?')) return;
    state.earned.clear(); saveProgress(); renderChecklist(); renderMissable(); showMessage('Progress cleared.');
  });
}

async function loadTrophyData() {
  const response = await fetch('data/trophies.json');
  if (!response.ok) throw new Error(`Trophy data returned ${response.status}.`);
  state.data = await response.json();
  if (!Array.isArray(state.data.trophies) || !Array.isArray(state.data.roadmap) || !Array.isArray(state.data.sources)) throw new Error('Trophy data is missing a required section.');
}

async function startApp() {
  readProgress(); bindControls();
  try {
    await loadTrophyData(); updateProgressSummary(); renderChecklist(); renderRoadmap(); renderMissable(); renderSources();
  } catch (error) {
    $('#trophy-list').innerHTML = '';
    $('#empty-state').innerHTML = `<strong>Could not load the trophy guide</strong><p>${escapeHtml(error.message)} Check that app/data/trophies.json is present and reload this page.</p>`;
    $('#empty-state').hidden = false;
    $('#result-count').textContent = 'Unavailable';
  }
}

startApp();
