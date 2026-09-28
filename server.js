import './lib/env.js'; // must stay first: loads .env before the modules below read settings
import express from 'express';
import { PARSHIYOT, describeReading } from './lib/parshiyot.js';
import { parshaForDate, SCHEDULE_RANGE } from './lib/schedule.js';
import { generateDvarTorah, GenerationError, hasCredentials } from './lib/generate.js';
import { saveDvarTorah, findForDay, listAll, listForParsha, countGeneratedLast24h } from './lib/db.js';
import { libraryFor, libraryAll } from './lib/library.js';

if (!hasCredentials()) {
  console.warn('ℹ No GEMINI_API_KEY set — serving the built-in library only. Add a key to .env to write new teachings.');
}

const app = express();
app.use(express.json());
// On Vercel the site root always reaches this app (not the CDN), so send it to the page.
app.get('/', (_req, res) => res.redirect(302, '/today'));
// Local runs serve public/ from here; on Vercel the CDN serves public/ and this is ignored.
app.use(express.static('public', { extensions: ['html'] }));

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

app.get('/api/parshiyot', (_req, res) => {
  res.json(PARSHIYOT.map(({ name, he, book, bookHe }) => ({ name, he, book, bookHe })));
});

// This week's parsha for the user's local date.
app.get('/api/week', (req, res) => {
  if (!isDate(req.query.date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const week = parshaForDate(req.query.date);
  if (!week) {
    return res.json({ outOfRange: true, range: SCHEDULE_RANGE });
  }
  res.json(week);
});

// Everyone shares the same daily teaching, so Gemini is only called a handful of times a
// day no matter how many people visit. DAILY_GENERATION_LIMIT keeps us inside the free
// tier; part of it is always held back for each day's main teaching. Whenever Gemini
// can't be used (no key, quota, outage) readers get a saved or built-in teaching instead.
const DAILY_LIMIT = Number(process.env.DAILY_GENERATION_LIMIT) || 15;
const RESERVED_FOR_DAILY = Math.min(5, Math.floor(DAILY_LIMIT / 3));
const inFlight = new Map();
const dailyPick = new Map(); // "date|parsha" -> teaching served when nothing was generated that day
let pending = 0;
let lastGenerationError = null; // shown on /api/status to diagnose deployments

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];
const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

// { date, parsha: ["Name"] | ["Name", "Name"], fresh?: boolean, exclude?: (number|string)[] }
// Without `fresh`: the day's shared teaching for that parsha.
// With `fresh` ("New Teaching"): one the reader hasn't seen yet — a saved or built-in one
// first; only when they've seen them all is a new one generated.
app.post('/api/dvar-torah', async (req, res) => {
  const { date, parsha, fresh } = req.body ?? {};
  const exclude = new Set(Array.isArray(req.body?.exclude) ? req.body.exclude : []);
  if (!isDate(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  const reading = describeReading(parsha);
  if (!reading) return res.status(400).json({ error: 'Unknown parsha' });
  const key = reading.names.join('|');
  const pool = [...libraryFor(key), ...listForParsha(key).reverse()];
  const unseen = pool.filter((d) => !exclude.has(d.id));

  if (!fresh) {
    const existing = findForDay(date, key) ?? dailyPick.get(`${date}|${key}`);
    if (existing) return res.json(existing);
  } else if (unseen.length) {
    return res.json(pickRandom(unseen));
  }

  const budget = fresh ? DAILY_LIMIT - RESERVED_FOR_DAILY : DAILY_LIMIT;
  // Concurrent requests for the same day's teaching share one generation.
  const flightKey = fresh ? `${key}|fresh|${Date.now()}|${Math.random()}` : `${date}|${key}`;
  if (hasCredentials() && (inFlight.has(flightKey) || countGeneratedLast24h() + pending < budget)) {
    try {
      if (!inFlight.has(flightKey)) {
        pending++;
        const avoid = pool.slice(-8).map((d) => `${d.source_ref_en} — "${d.title_en}"`);
        inFlight.set(
          flightKey,
          generateDvarTorah({ reading, date, avoid })
            .then((teaching) => saveDvarTorah(date, key, teaching))
            .finally(() => {
              pending--;
              inFlight.delete(flightKey);
            }),
        );
      }
      return res.json(await inFlight.get(flightKey));
    } catch (err) {
      console.error(err instanceof GenerationError ? `Gemini: ${err.message}` : err);
      lastGenerationError = { at: new Date().toISOString(), message: String(err.message).slice(0, 300) };
      // Fall through to a saved or built-in teaching.
    }
  }

  if (fresh) {
    return res.status(503).json({
      error: "You've read every teaching on this parsha so far. New ones are added regularly — check back soon.",
    });
  }
  if (!pool.length) {
    return res.status(503).json({ error: "Today's teaching isn't ready yet. Please check back a little later." });
  }
  // Same choice for everyone today, rotating through the pool day by day.
  const pick = pool[dayNumber(date) % pool.length];
  dailyPick.set(`${date}|${key}`, pick);
  res.json(pick);
});

// Health check for the deployment — never includes the key itself.
app.get('/api/status', (_req, res) => {
  res.json({
    geminiKeyConfigured: hasCredentials(),
    libraryTeachings: libraryAll().length,
    generatedLast24h: countGeneratedLast24h(),
    dailyLimit: DAILY_LIMIT,
    lastGenerationError,
  });
});

// Generated teachings (newest first), then the built-in library in parsha order.
app.get('/api/archive', (_req, res) => {
  res.json([...listAll(), ...libraryAll()]);
});

// Last-resort handler: answer with JSON instead of Express's HTML error page.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Vercel imports the app and runs it as a function; locally we listen on a port.
export default app;

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Ohr HaYom running at http://localhost:${port}`));
}
