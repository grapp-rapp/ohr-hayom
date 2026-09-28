// Built-in teachings (data/library/*.json) — the app works with these even with no API key.
// Imported (not read from disk) so hosting bundlers like Vercel's include the files.
// A new file in data/library/ must also be added here.
import bereshit from '../data/library/1-bereshit.json' with { type: 'json' };
import shemot from '../data/library/2-shemot.json' with { type: 'json' };
import vayikra from '../data/library/3-vayikra.json' with { type: 'json' };
import bamidbar from '../data/library/4-bamidbar.json' with { type: 'json' };
import devarim from '../data/library/5-devarim.json' with { type: 'json' };
import { findParsha } from './parshiyot.js';
import { sanitizeNames } from './generate.js';

const LIBRARY = [bereshit, shemot, vayikra, bamidbar, devarim]
  .flat()
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
