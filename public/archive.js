import { escapeHtml, renderTeaching, initLangToggle, getLang, shareTeaching, formatDate, icon } from './common.js';

const list = document.getElementById('list');
const search = document.getElementById('search');
const count = document.getElementById('count');

let items = [];

// Drop Hebrew vowels/cantillation so "בראשית" matches "בְּרֵאשִׁית".
const normalize = (s) => String(s ?? '').replace(/[֑-ׇ]/g, '').toLowerCase();

function searchableText(item, lang) {
  return Object.entries(item)
    .filter(([k, v]) => typeof v === 'string' && (lang === 'both' ? /_(en|he)$/.test(k) : k.endsWith(`_${lang}`)))
    .map(([, v]) => normalize(v))
    .join(' \n ');
}

function render() {
  const lang = getLang();
  const terms = normalize(search.value).split(/\s+/).filter(Boolean);
  const matches = items.filter((item) => {
    const text = searchableText(item, lang);
    return terms.every((t) => text.includes(t));
  });

  if (!items.length) {
    count.textContent = '';
    list.innerHTML = '<div class="empty">No teachings yet. <a href="/today">Open today&#39;s Dvar Torah</a> to begin your archive.</div>';
    return;
  }

  count.textContent = terms.length
    ? `${matches.length} of ${items.length} teachings`
    : `${items.length} teaching${items.length === 1 ? '' : 's'}`;

  list.innerHTML = matches.length
    ? matches
        .map(
          (item) => `
      <details class="panel archive-item fade-in-up" data-id="${item.id}">
        <summary>
          <span class="titles">
            <span class="he" lang="he">${escapeHtml(item.title_he)}</span>
            <span class="en">${escapeHtml(item.title_en)}</span>
          </span>
          <span class="info">
            <span class="en">Parashat ${escapeHtml(item.parsha_en)}</span>
            <span class="he" lang="he">${escapeHtml(item.parsha_he)}</span><br>
            ${item.createdAt ? escapeHtml(formatDate(item.createdAt)) : 'Ohr HaYom library'}<span class="chevron" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="body"></div>
      </details>`,
        )
        .join('')
    : '<div class="empty">Nothing matches your search.</div>';
}

list.addEventListener(
  'toggle',
  (e) => {
    const details = e.target;
    if (!details.open) return;
    const body = details.querySelector('.body');
    if (body.childElementCount) return;
    const item = items.find((i) => String(i.id) === details.dataset.id);
    body.innerHTML = `${renderTeaching(item, { animate: false })}
      <div class="item-actions no-print">
        <button type="button" class="btn" data-action="print">${icon('print')} Print</button>
        <button type="button" class="btn" data-action="share">${icon('share')} Share</button>
      </div>`;
  },
  true,
);

list.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const details = btn.closest('details');
  const item = items.find((i) => String(i.id) === details.dataset.id);
  if (btn.dataset.action === 'share') {
    shareTeaching(item, btn);
  } else {
    // Print just this card: temporarily close the others.
    const others = [...list.querySelectorAll('details[open]')].filter((d) => d !== details);
    others.forEach((d) => (d.open = false));
    window.addEventListener('afterprint', () => others.forEach((d) => (d.open = true)), { once: true });
    window.print();
  }
});

search.addEventListener('input', render);
// Search only looks at the visible language(s), so re-filter when it changes.
initLangToggle(document.getElementById('lang-toggle'), () => search.value.trim() && render());

fetch('/api/archive')
  .then((r) => r.json())
  .then((data) => {
    items = data;
    render();
  })
  .catch(() => {
    list.innerHTML = '<div class="error">Could not load the archive. Please refresh.</div>';
  });
