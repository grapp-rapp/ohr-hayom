# Ohr HaYom · אור היום

A daily companion that writes a fresh bilingual (Hebrew + English) Dvar Torah on the weekly parsha for Bar/Bat Mitzvah–age kids.

## Run it

```bash
npm install
cp .env.example .env   # then put your GEMINI_API_KEY in .env
npm start              # http://localhost:3000
```

Requires Node 22.13+ (uses the built-in `node:sqlite`).

The header logo is `public/logo.png` (your Torah B'Ahava logo, shown as a round badge). Replace that file to change it.

## How it works

| Piece | Where |
|---|---|
| Weekly parsha detection (diaspora, 5786–5788) | `lib/schedule.js` reading `data/schedule.json` |
| Regenerate the schedule table from Hebcal | `npm run build:schedule` |
| The 54 parshiyot (names, Hebrew, verse ranges) | `lib/parshiyot.js` |
| Gemini prompt, JSON schema, Divine Name safeguards, model fallback chain | `lib/generate.js` |
| Built-in library: one teaching for each of the 54 parshiyot | `data/library/*.json`, loaded by `lib/library.js` |
| `DvarTorah` storage (SQLite, `data/ohr-hayom.db`) | `lib/db.js` |
| API + static hosting | `server.js` |
| Today / Archive pages | `public/` |

**Parsha rule:** the week's parsha is the one read on the coming Shabbat (or today, on Shabbat). If that Shabbat is a holiday with no weekly reading (Sukkot, Shemini Atzeret, Pesach, Shavuot…), the app stays on the most recent parsha. Combined readings (e.g. Vayakhel-Pekudei) are handled as one teaching.

**Works with or without Gemini:** the app ships with a built-in library of 54 teachings, one per parsha. With no API key, or whenever Gemini is unavailable, readers get those. With a key, Gemini writes new teachings on top of them.

**Built for many readers on the Gemini free tier:** everyone gets the same teaching for a given day and parsha, generated once by the first visitor and saved. **New Teaching** first serves saved or built-in teachings the reader hasn't seen yet, and only asks Gemini for a new one once they've read them all. Calls to Gemini are capped at `DAILY_GENERATION_LIMIT` per 24 hours (default 15), with a few always kept back for each day's main teaching. If a model is overloaded (common on the free tier), the app moves down a chain of backup models. The prompt lists earlier teachings on the same parsha so each new one picks a different verse and angle.

To add more built-in teachings, add entries to any file in `data/library/` (same fields as the existing ones, `parsha` spelled as in `lib/parshiyot.js`) and restart.

**Halachic safeguards:** the parsha name is always set by the app, never by the model. The prompt forbids the full Divine Names, and `sanitizeNames()` also rewrites any that slip through: יהוה → ה׳, אלהים/אלהינו… → אלקים/אלקינו…, God → G-d. It applies to every field, including verse quotes, because these pages get printed.

## Config (`.env`)

- `GEMINI_API_KEY`: optional. Without it the app serves the built-in library only. Get a free key at https://aistudio.google.com/api-keys
- `GEMINI_MODEL`: default `gemini-3.8-flash`
- `GEMINI_FALLBACK_MODELS`: comma-separated backups, default `gemini-3.7-flash,gemini-3.6-flash,gemini-flash-latest`
- `DAILY_GENERATION_LIMIT`: most calls to Gemini per 24 hours, default `15`. Raise it if you move to a paid Gemini plan.
- `PORT`: default `3000`

Free-tier notes: Google's free tier has daily request limits (see your limits at https://aistudio.google.com/rate-limit), and Google may use free-tier prompts and responses to improve its products. The current Pro model is not included in the free tier.
