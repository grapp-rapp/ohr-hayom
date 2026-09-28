// Built-in teachings (data/library/*.json) — the app works with these even with no API key.
import { readdirSync, readFileSync } from 'node:fs';
import { findParsha } from './parshiyot.js';
import { sanitizeNames } from './generate.js';

const dir = new URL('../data/library/', import.meta.url);

const LIBRARY = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')))
  .map(({ parsha, ...fields }, i) => {
    const p = findParsha(parsha);
    if (!p) throw new Error(`data/library: unknown parsha "${parsha}"`);
    return {
      id: `lib-${i + 1}`,
      source: 'library',
      ...sanitizeNames(fields),
      parsha_en: p.name,
      parsha_he: p.he,
      parsha_key: p.name,
    };
  });

// Teachings for a reading; a combined reading ("Vayakhel|Pekudei") gets both parts' teachings.
export function libraryFor(parshaKey) {
  const names = parshaKey.split('|');
  return LIBRARY.filter((t) => names.includes(t.parsha_key));
}

export function libraryAll() {
  return LIBRARY;
}
