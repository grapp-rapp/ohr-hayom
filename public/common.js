// Shared rendering, language toggle and sharing for the Today and Archive pages.

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function paragraphs(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const ICONS = {
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  print: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
};

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

// Hebrew first, then English, with a fine gold rule between them in "Both" mode.
function stacked(en, he) {
  return `<div class="text he" lang="he" dir="rtl">${paragraphs(he)}</div>
    <hr class="lang-rule">
    <div class="text en" lang="en">${paragraphs(en)}</div>`;
}

function label(en, he, iconName) {
  return `<div class="label">${iconName ? icon(iconName) : ''}<span class="en">${en}</span><span class="dot">·</span><span class="he" lang="he">${he}</span></div>`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function renderTeaching(t, { animate = true, showDate = true } = {}) {
  const fx = (n) => (animate ? `fade-in-up delay-${n}` : '');
  return `
  <article class="teaching">
    <header class="teaching-head ${fx(0)}">
      <h2 class="teaching-title">
        <span class="he" lang="he">${escapeHtml(t.title_he)}</span>
        <span class="en">${escapeHtml(t.title_en)}</span>
      </h2>
      <div class="pills">
        <span class="pill he" lang="he">פרשת ${escapeHtml(t.parsha_he)}</span>
        <span class="pill en">${escapeHtml(t.parsha_en)}</span>
      </div>
    </header>

    <div class="ornament ${fx(0)}" aria-hidden="true">✦</div>

    <section class="panel verse-card ${fx(1)}">
      <div class="ref">
        <span class="en">${escapeHtml(t.source_ref_en)}</span>
        <span class="he" lang="he">${escapeHtml(t.source_ref_he)}</span>
      </div>
      ${stacked(t.verse_en, t.verse_he)}
    </section>

    <section class="panel commentary-card ${fx(2)}">
      ${label('Commentary', 'פירוש', 'book')}
      ${stacked(t.commentary_en, t.commentary_he)}
    </section>

    <section class="panel story-card ${fx(3)}">
      ${label('A Story', 'סיפור', 'flame')}
      ${stacked(t.story_en, t.story_he)}
    </section>

    <section class="panel practice-card ${fx(4)}">
      ${icon('star', 'star')}
      ${label("Today's Practice", 'עשייה להיום')}
      ${stacked(t.takeaway_en, t.takeaway_he)}
    </section>

    <div class="ornament ${fx(5)}" aria-hidden="true">✦</div>

    <section class="blessing ${fx(5)}">
      ${stacked(t.blessing_en, t.blessing_he)}
    </section>

    ${showDate && t.createdAt ? `<p class="meta">${escapeHtml(formatDate(t.createdAt))}</p>` : ''}
  </article>`;
}

// ---------- Language toggle ----------

const LANG_KEY = 'ohr-hayom-lang';

export function getLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === 'en' || v === 'he' || v === 'both') return v;
  } catch {}
  return 'both';
}

export function initLangToggle(container, onChange) {
  const apply = (lang) => {
    document.body.dataset.lang = lang;
    for (const b of container.querySelectorAll('button[data-lang]')) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    }
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
    onChange?.(lang);
  };
  container.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-lang]');
    if (b) apply(b.dataset.lang);
  });
  apply(getLang());
}

// ---------- Share ----------

export function shareText(t, lang = getLang()) {
  const he = [
    `🕯️ אור היום — פרשת ${t.parsha_he}`,
    `*${t.title_he}*`,
    `${t.source_ref_he}: "${t.verse_he}"`,
    t.commentary_he,
    t.story_he,
    `💡 היום אני: ${t.takeaway_he}`,
    t.blessing_he,
  ];
  const en = [
    `🕯️ Ohr HaYom — Parashat ${t.parsha_en}`,
    `*${t.title_en}*`,
    `${t.source_ref_en}: "${t.verse_en}"`,
    t.commentary_en,
    t.story_en,
    `💡 Try it today: ${t.takeaway_en}`,
    t.blessing_en,
  ];
  const parts = lang === 'he' ? [he] : lang === 'en' ? [en] : [he, en];
  return parts.map((p) => p.join('\n\n')).join('\n\n— — —\n\n');
}

export async function shareTeaching(t, button) {
  const text = shareText(t);
  const title = getLang() === 'he' ? t.title_he : t.title_en;
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    flash(button, 'Copied! Paste it in your family chat');
  } catch {
    flash(button, 'Could not copy — please copy manually');
  }
}

function flash(button, message) {
  if (!button) return;
  const original = button.innerHTML;
  button.textContent = message;
  button.disabled = true;
  setTimeout(() => {
    button.innerHTML = original;
    button.disabled = false;
  }, 2200);
}

export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
