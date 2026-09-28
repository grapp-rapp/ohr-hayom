// Generates data/schedule.json — the diaspora Shabbat Torah-reading table for
// Hebrew years 5786–5788, one entry per Shabbat. Run with: npm run build:schedule
import { writeFileSync, mkdirSync } from 'node:fs';
import { getSedra, HDate } from '@hebcal/core';

const YEARS = [5786, 5787, 5788];
const entries = [];

for (const year of YEARS) {
  const sedra = getSedra(year, false); // false = diaspora
  let hd = new HDate(1, 'Tishrei', year);
  while (hd.getDay() !== 6) hd = hd.next();
  const end = new HDate(1, 'Tishrei', year + 1);
  for (; hd.deltaDays(end) < 0; hd = hd.add(7, 'd')) {
    const { parsha, chag } = sedra.lookup(hd);
    const d = hd.greg();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    entries.push(chag ? { date: iso, holiday: parsha[0] } : { date: iso, parsha });
  }
}

mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/schedule.json', import.meta.url), JSON.stringify(entries, null, 1) + '\n');
console.log(`Wrote ${entries.length} Shabbatot (${entries[0].date} → ${entries.at(-1).date})`);
