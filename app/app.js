'use strict';

const STORAGE_KEY = 'vice-city-trophy-bureau-progress-v1';
const SPOILER_KEY = 'vice-city-trophy-bureau-hide-spoilers-v1';
const SOURCE_USAGE = {
  'PlayStation official trophy list via Exophase': 'Official trophy names, descriptions, grades, and the published count of 55.',
  'PowerPyx GTA 6 Trophy Guide and Roadmap': 'Platinum difficulty, completion time, route order, missable warning, and completion requirements.',
  'EGamers full trophy list': 'Cross-checks for trophy conditions, counts, and activity targets.',
  'KeenGamer trophy guide': 'A second roadmap perspective and cross-checks for mission and activity guidance.'
};

let trophyData = null;
let earnedIds = new Set();
let expandedIds = new Set([1]);
let activeFilter = 'all';
let activeGrade = 'all';
let activeStatus = 'all';
let searchTerm = '';
let hideSpoilers = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function loadSavedState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(stored)) earnedIds = new Set(stored.map(Number).filter(Number.isFinite));
  } catch (error) {
    earnedIds = new Set();
  }
  hideSpoilers = localStorage.getItem(SPOILER_KEY) === 'true';
  document.querySelector('#spoiler-toggle').checked = hideSpoilers;
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...earnedIds].sort((a, b) => a - b)));
  updateProgressSummary();
}

function updateProgressSummary() {
  const total = trophyData?.trophies.length ?? 55;
  const count = earnedIds.size;
  const percent = Math.round((count / total) * 100);
  document.querySelector('#earned-count').innerHTML = `${count} <span>/ ${total} earned</span>`;
  document.querySelector('#progress-percent').textContent = `${percent}%`;
  document.querySelector('#progress-fill').style.width = `${percent}%`;
  const progressBar = document.querySelector('.progress-track');
  progressBar.setAttribute('aria-valuenow', String(count));
  progressBar.setAttribute('aria-valuemax', String(total));
}

function getTrophyName(trophy) {
  if (hideSpoilers && trophy.kind === 'story' && !earnedIds.has(trophy.id)) return 'Hidden story trophy';
  return trophy.name;
}

function getTrophyDescription(trophy) {
  if (hideSpoilers && trophy.kind === 'story' && !earnedIds.has(trophy.id)) return 'Story details hidden until earned.';
  return trophy.description;
}

function renderSourceLinks(sources) {
  if (!sources?.length) return '<li><span>Source details unavailable</span></li>';
  return sources.map(source => source.url
    ? `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a></li>`
    : `<li><span>${escapeHtml(source.label)}</span></li>`).join('');
}

function renderTrophyCard(trophy) {
  const expanded = expandedIds.has(trophy.id);
  const earned = earnedIds.has(trophy.id);
  const kindTag = `<span class="kind-tag">${escapeHtml(trophy.kind)}</span>`;
  const tags = (trophy.tags || []).map(tag => `<span class="kind-tag">${escapeHtml(tag)}</span>`).join('');
  const target = trophy.target != null ? `<span class="target-chip">${escapeHtml(trophy.target)} ${escapeHtml(trophy.targetLabel || '')}</span>` : '';
  const caution = trophy.caution ? `<p class="caution">${escapeHtml(trophy.caution)}</p>` : '';
  return `<article class="trophy-card${expanded ? ' expanded' : ''}" data-id="${trophy.id}">
    <div class="card-main">
      <input class="earned-check" type="checkbox" aria-label="Mark ${escapeHtml(getTrophyName(trophy))} earned" data-earned="${trophy.id}" ${earned ? 'checked' : ''}>
      <span class="grade-badge grade-${escapeHtml(trophy.grade)}">${escapeHtml(trophy.grade)}</span>
      <button class="title-button" type="button" aria-expanded="${expanded}" aria-controls="details-${trophy.id}" data-expand="${trophy.id}">
        <span class="card-title-line"><span class="card-title">${escapeHtml(getTrophyName(trophy))}</span>${trophy.missable ? '<span class="badge-missable">MISSABLE</span>' : ''}${target}</span>
        <span class="card-desc">${escapeHtml(getTrophyDescription(trophy))}</span>
      </button>
      ${kindTag}${tags}<span class="stage-tag">Stage ${trophy.stage}</span><span class="card-chevron" aria-hidden="true">⌄</span>
    </div>
    <div class="card-details" id="details-${trophy.id}" ${expanded ? '' : 'hidden'}>
      <p>${escapeHtml(trophy.guide)}</p>${caution}
      <h4>Roadmap stage ${trophy.stage}</h4><p>${escapeHtml(trophyData.roadmap.find(step => step.step === trophy.stage)?.title || 'Unassigned')}</p>
      <h4>Sources</h4><ul class="source-links">${renderSourceLinks(trophy.sources)}</ul>
    </div>
  </article>`;
}

function matchesFilter(trophy) {
  if (activeFilter === 'missable') return trophy.missable;
  if (activeFilter === 'story') return trophy.kind === 'story';
  if (activeFilter === 'collectibles' || activeFilter === 'activities') return trophy.kind === activeFilter || (trophy.tags || []).includes(activeFilter);
  return true;
}

function matchesSearch(trophy) {
  const text = [trophy.name, trophy.description, trophy.guide, trophy.kind, ...(trophy.tags || [])].join(' ').toLowerCase();
  return text.includes(searchTerm);
}

function renderChecklist() {
  const list = document.querySelector('#trophy-list');
  const onlineEmpty = document.querySelector('#online-empty');
  const status = document.querySelector('#list-status');
  if (activeFilter === 'online') {
    list.hidden = true;
    onlineEmpty.hidden = false;
    status.textContent = 'Showing official online trophy count: 0 of 55.';
    return;
  }
  list.hidden = false;
  onlineEmpty.hidden = true;
  const matches = trophyData.trophies.filter(trophy => matchesFilter(trophy) && (activeGrade === 'all' || trophy.grade === activeGrade) && (activeStatus === 'all' || (activeStatus === 'earned') === earnedIds.has(trophy.id)) && matchesSearch(trophy));
  list.innerHTML = matches.length ? matches.map(renderTrophyCard).join('') : '<div class="empty-state"><span class="empty-icon">⌕</span><h3>No trophies found</h3><p>Try another search or filter.</p></div>';
  status.textContent = `${matches.length} ${matches.length === 1 ? 'trophy' : 'trophies'} shown`;
}

function renderRoadmap() {
  const nextTrophies = trophyData.trophies.filter(trophy => !earnedIds.has(trophy.id)).sort((a, b) => a.stage - b.stage || a.id - b.id).slice(0, 3);
  const nextUp = nextTrophies.length
    ? `<ol class="next-up-list">${nextTrophies.map(trophy => `<li><span class="grade-badge grade-${escapeHtml(trophy.grade)}">${escapeHtml(trophy.grade)}</span><span class="next-up-name">${escapeHtml(getTrophyName(trophy))}</span><span class="stage-tag">Stage ${trophy.stage}</span></li>`).join('')}</ol>`
    : '<p class="next-up-complete">Every trophy is earned. The platinum is yours.</p>';
  const steps = trophyData.roadmap.map(step => {
    const names = step.trophyIds.map(id => trophyData.trophies.find(trophy => trophy.id === id)?.name).filter(Boolean);
    const earnedCount = step.trophyIds.filter(id => earnedIds.has(id)).length;
    return `<article class="roadmap-card"><div class="step-label"><span>STEP ${step.step}</span><span class="step-hours">${escapeHtml(step.hours)} hours</span></div><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.summary)}</p><p class="step-progress">${earnedCount} of ${step.trophyIds.length} earned</p><h4>Trophies in this step · ${names.length}</h4><ul class="trophy-name-list">${names.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ul></article>`;
  }).join('');
  document.querySelector('#roadmap-content').innerHTML = `<section id="next-up" aria-live="polite"><h3>Next up</h3>${nextUp}</section><div class="roadmap-grid">${steps}</div><div class="roadmap-lower"><article class="facts-card"><h3>Platinum facts</h3><p><strong>Difficulty:</strong> 4/10</p><p><strong>Estimated time:</strong> about 200 hours</p><p><strong>Playthroughs:</strong> one, with free-roam cleanup</p><p><strong>Cheats:</strong> avoid them; they disable trophies and saving</p><p><strong>Mission replay:</strong> unavailable, so keep chapter-start saves</p></article><article class="facts-card"><h3>Route notes</h3><p>Complete Chapter 1 house meditation before leaving that chapter. Preserve manual saves and take Stranger and Freaks opportunities when they appear.</p><p>Use the in-game 100% checklist; earlier progress counts, and 70 of 80 challenges suffice.</p></article></div>`;
}

function renderMissable() {
  const item = trophyData.trophies.find(trophy => trophy.missable);
  const target = document.querySelector('#missable-content');
  if (!item) {
    target.innerHTML = '<p class="error-message">No trophy is marked missable in the local data.</p>';
    return;
  }
  expandedIds.add(item.id);
  target.innerHTML = `<p class="editorial-note">PowerPyx reports exactly one potentially missable trophy. During Chapter 1, meditate at the house before leaving the chapter; this opportunity does not return.</p>${renderTrophyCard(item)}`;
}

function renderSources() {
  document.querySelector('#sources-content').innerHTML = trophyData.sources.map(source => {
    const usage = SOURCE_USAGE[source.label] || 'Reference used while preparing the guide.';
    const link = source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Visit source ↗</a>` : '<span class="source-link-placeholder">Referenced in the trophy data; no public URL supplied.</span>';
    return `<article class="source-card"><h3>${escapeHtml(source.label)}</h3>${link}<p>${escapeHtml(usage)}</p></article>`;
  }).join('');
}

function setView(viewName) {
  document.querySelectorAll('.tab').forEach(tab => {
    const selected = tab.dataset.view === viewName;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.view').forEach(view => {
    const selected = view.id === `view-${viewName}`;
    view.hidden = !selected;
    view.classList.toggle('active', selected);
  });
}

function bindControls() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.view)));
  document.querySelector('#search').addEventListener('input', event => {
    searchTerm = event.target.value.trim().toLowerCase();
    renderChecklist();
  });
  document.querySelector('#grade-filter').addEventListener('change', event => {
    activeGrade = event.target.value;
    renderChecklist();
  });
  document.querySelector('#status-filter').addEventListener('change', event => {
    activeStatus = event.target.value;
    renderChecklist();
  });
  document.querySelectorAll('.filter-chip').forEach(chip => chip.addEventListener('click', () => {
    activeFilter = chip.dataset.filter;
    document.querySelectorAll('.filter-chip').forEach(button => button.classList.toggle('selected', button === chip));
    renderChecklist();
  }));
  document.querySelector('#spoiler-toggle').addEventListener('change', event => {
    hideSpoilers = event.target.checked;
    localStorage.setItem(SPOILER_KEY, String(hideSpoilers));
    renderChecklist();
  });
  document.querySelector('#trophy-list').addEventListener('change', event => {
    const id = Number(event.target.dataset.earned);
    if (!id) return;
    if (event.target.checked) earnedIds.add(id);
    else earnedIds.delete(id);
    saveProgress();
    renderChecklist();
    renderRoadmap();
  });
  document.querySelector('#trophy-list').addEventListener('click', event => {
    const button = event.target.closest('[data-expand]');
    if (!button) return;
    const id = Number(button.dataset.expand);
    if (expandedIds.has(id)) expandedIds.delete(id);
    else expandedIds.add(id);
    renderChecklist();
  });
  document.querySelector('#export-progress').addEventListener('click', exportProgress);
  document.querySelector('#import-progress').addEventListener('change', importProgress);
  document.querySelector('#reset-progress').addEventListener('click', resetProgress);
}

function exportProgress() {
  const blob = new Blob([JSON.stringify([...earnedIds].sort((a, b) => a - b), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gta-vi-earned-trophies.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function importProgress(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const ids = Array.isArray(parsed) ? parsed : parsed?.earned;
    if (!Array.isArray(ids)) throw new Error('Expected an array of earned trophy IDs.');
    const validIds = new Set(trophyData.trophies.map(trophy => trophy.id));
    earnedIds = new Set(ids.map(Number).filter(id => validIds.has(id)));
    saveProgress();
    renderChecklist();
    renderRoadmap();
    document.querySelector('#list-status').textContent = `Imported ${earnedIds.size} earned trophies.`;
  } catch (error) {
    document.querySelector('#list-status').textContent = `Import failed: ${error.message}`;
  } finally {
    event.target.value = '';
  }
}

function resetProgress() {
  if (!window.confirm('Clear all saved trophy progress?')) return;
  earnedIds.clear();
  saveProgress();
  renderChecklist();
  renderRoadmap();
  document.querySelector('#list-status').textContent = 'Progress reset.';
}

async function loadTrophies() {
  const list = document.querySelector('#trophy-list');
  try {
    const response = await fetch('data/trophies.json');
    if (!response.ok) throw new Error(`The local trophy file returned ${response.status}.`);
    trophyData = await response.json();
    if (!Array.isArray(trophyData.trophies) || !Array.isArray(trophyData.roadmap) || !Array.isArray(trophyData.sources)) throw new Error('The local trophy file is missing required sections.');
    loadSavedState();
    bindControls();
    renderChecklist();
    renderRoadmap();
    renderMissable();
    renderSources();
    updateProgressSummary();
  } catch (error) {
    list.innerHTML = `<p class="error-message">Could not load <code>data/trophies.json</code>. Serve this app locally so its files can be read. ${escapeHtml(error.message)}</p>`;
  }
}

loadTrophies();

// Keep multiple open guide tabs in sync when the browser reports a localStorage update.
function handleSharedStateUpdate(event) {
  if (!trophyData) return;
  if (event.key === STORAGE_KEY) {
    try {
      const storedIds = JSON.parse(event.newValue || '[]');
      if (!Array.isArray(storedIds)) return;
      const validIds = new Set(trophyData.trophies.map(trophy => trophy.id));
      earnedIds = new Set(storedIds.map(Number).filter(id => validIds.has(id)));
      renderChecklist();
      renderRoadmap();
      updateProgressSummary();
    } catch (error) {
      // Ignore malformed storage written by another page; the current checklist remains usable.
    }
  }
  if (event.key === SPOILER_KEY) {
    hideSpoilers = event.newValue === 'true';
    document.querySelector('#spoiler-toggle').checked = hideSpoilers;
    renderChecklist();
  }
}

window.addEventListener('storage', handleSharedStateUpdate);

