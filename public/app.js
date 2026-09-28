import { escapeHtml, renderTeaching, initLangToggle, shareTeaching, localDate, icon } from './common.js';

const select = document.getElementById('parsha-select');
const content = document.getElementById('content');
const weekNote = document.getElementById('week-note');
const weekLine = document.getElementById('week-line');
const freshBtn = document.getElementById('fresh-btn');
const printBtn = document.getElementById('print-btn');
const shareBtn = document.getElementById('share-btn');

const LOADING_LINES = [
  'Unrolling the scroll…',
  'Lighting the candle…',
  'Consulting the commentators…',
  "Preparing today's teaching…",
];

let week = null;
let current = null;
let requestId = 0;
const seen = new Set(); // teaching ids shown in this visit, so "New Teaching" never repeats one

initLangToggle(document.getElementById('lang-toggle'));

function skeleton() {
  const line = LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)];
  const panel = `<div class="panel">${'<div class="shimmer"></div><div class="shimmer short"></div>'.repeat(2)}</div>`;
  return `<div class="skeleton" role="status">
    <div class="shimmer title"></div>
    <div class="shimmer sub"></div>
    <div class="shimmer pill-line"></div>
    <div class="ornament" aria-hidden="true">✦</div>
    ${panel.repeat(2)}
    <p class="loading-text">${line}</p>
  </div>`;
}

function setBusy(busy) {
  select.disabled = busy;
  freshBtn.disabled = busy;
  printBtn.disabled = busy || !current;
  shareBtn.disabled = busy || !current;
}

function selectedParsha() {
  return select.value === 'week' ? week.reading.names : [select.value];
}

async function load({ fresh = false } = {}) {
  const id = ++requestId;
  current = null;
  content.innerHTML = skeleton();
  setBusy(true);
  try {
    const res = await fetch('/api/dvar-torah', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: localDate(), parsha: selectedParsha(), fresh, exclude: [...seen] }),
    });
    const data = await res.json();
    if (id !== requestId) return;
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    current = data;
    seen.add(data.id);
    content.innerHTML = renderTeaching(data, { showDate: false });
  } catch (err) {
    if (id !== requestId) return;
    content.innerHTML = `<div class="error">
      <p>${escapeHtml(err.message)}</p>
      <button type="button" class="btn" id="retry-btn">Try again</button>
    </div>`;
    document.getElementById('retry-btn').addEventListener('click', () => load({ fresh }));
  } finally {
    if (id === requestId) setBusy(false);
  }
}

function showWeekNote() {
  if (select.value !== 'week' || !week?.holiday) {
    weekNote.hidden = true;
    return;
  }
  weekNote.innerHTML = `<span class="en">This Shabbat is ${escapeHtml(week.holiday.en)}, so we're staying with Parashat ${escapeHtml(week.reading.en)}.</span>
    <span class="he" lang="he">השבת הקרובה היא ${escapeHtml(week.holiday.he)}, ולכן נשארים עם פרשת ${escapeHtml(week.reading.he)}.</span>`;
  weekNote.hidden = false;
}

async function init() {
  const [parshiyot, weekData] = await Promise.all([
    fetch('/api/parshiyot').then((r) => r.json()),
    fetch(`/api/week?date=${localDate()}`).then((r) => r.json()),
  ]);
  week = weekData.outOfRange ? null : weekData;
  if (week) {
    weekLine.innerHTML = `${icon('flame', 'flame')}<span>This week's parsha:</span>
      <span class="he" lang="he">פרשת ${escapeHtml(week.reading.he)}</span><span>·</span><strong>${escapeHtml(week.reading.en)}</strong>`;
    weekLine.hidden = false;
  }

  const books = Map.groupBy(parshiyot, (p) => p.book);
  select.innerHTML =
    (week
      ? `<option value="week">This week's parsha — ${escapeHtml(week.reading.en)}</option>`
      : '<option value="" disabled selected>Choose a parsha</option>') +
    [...books]
      .map(([book, list]) => `<optgroup label="${escapeHtml(book)} · ${escapeHtml(list[0].bookHe)}">
        ${list.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)} · ${escapeHtml(p.he)}</option>`).join('')}
      </optgroup>`)
      .join('');
  select.disabled = false;

  select.addEventListener('change', () => {
    showWeekNote();
    load();
  });
  freshBtn.addEventListener('click', () => load({ fresh: true }));
  printBtn.addEventListener('click', () => window.print());
  shareBtn.addEventListener('click', () => current && shareTeaching(current, shareBtn));

  if (week) {
    showWeekNote();
    load();
  } else {
    weekNote.textContent = "Today's date is outside the built-in reading schedule — pick a parsha to begin.";
    weekNote.hidden = false;
    content.innerHTML = '<p class="empty">Choose a parsha above to generate a teaching.</p>';
  }
}

init().catch(() => {
  content.innerHTML = '<div class="error"><p>Could not reach the server. Please refresh the page.</p></div>';
});
