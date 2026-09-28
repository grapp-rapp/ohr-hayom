// Determines "this week's parsha" from the diaspora reading table.
// Imported (not read from disk) so hosting bundlers like Vercel's include the file.
import SCHEDULE from '../data/schedule.json' with { type: 'json' };
import { describeReading } from './parshiyot.js';

const HOLIDAYS_HE = {
  'Rosh Hashana': 'ראש השנה',
  'Yom Kippur': 'יום כיפור',
  Sukkot: 'סוכות',
  'Sukkot Shabbat Chol ha-Moed': 'שבת חול המועד סוכות',
  'Shmini Atzeret': 'שמיני עצרת',
  'Pesach': 'פסח',
  'Pesach Shabbat Chol ha-Moed': 'שבת חול המועד פסח',
  Shavuot: 'שבועות',
};

export const SCHEDULE_RANGE = { first: SCHEDULE[0].date, last: SCHEDULE.at(-1).date };

// `date` is YYYY-MM-DD in the user's local calendar. The week's parsha is the
// one read on the coming Shabbat (or today, if today is Shabbat). When that
// Shabbat is a holiday with no weekly reading, stay on the most recent parsha
// rather than jumping ahead.
export function parshaForDate(date) {
  const i = SCHEDULE.findIndex((e) => e.date >= date);
  if (i === -1) return null;
  if (i === 0 && SCHEDULE[0].date > addDays(date, 6)) return null; // before table coverage

  const shabbat = SCHEDULE[i];
  if (shabbat.parsha) {
    return { shabbat: shabbat.date, reading: describeReading(shabbat.parsha), holiday: null };
  }
  for (let j = i - 1; j >= 0; j--) {
    if (SCHEDULE[j].parsha) {
      return {
        shabbat: shabbat.date,
        reading: describeReading(SCHEDULE[j].parsha),
        holiday: { en: shabbat.holiday, he: HOLIDAYS_HE[shabbat.holiday] ?? shabbat.holiday },
      };
    }
  }
  return null;
}

function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
