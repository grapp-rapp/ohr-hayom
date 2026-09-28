// Generates one Dvar Torah with Google Gemini, as structured JSON.
import { GoogleGenAI, ApiError } from '@google/genai';

let client; // created on first use; reads GEMINI_API_KEY (or GOOGLE_API_KEY) from the environment
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Tried in order when the main model is overloaded or unavailable.
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.7-flash,gemini-3.6-flash,gemini-flash-latest')
  .split(',')
  .map((m) => m.trim())
  .filter((m) => m && m !== MODEL);

const FIELDS = {
  title_en: 'Catchy English title for this teaching',
  title_he: 'Hebrew title for this teaching',
  source_ref_en: 'English reference for the verse, e.g. "Genesis 12:1"',
  source_ref_he: 'Hebrew reference with Hebrew-letter numerals, e.g. "בראשית יב:א"',
  verse_he: 'The verse(s) in Hebrew, quoted exactly (no cantillation marks)',
  verse_en: 'English translation of the verse(s)',
  commentary_en: '3–4 sentences of commentary in English',
  commentary_he: '3–4 sentences of commentary in Hebrew',
  story_en: 'A short modern, relatable story or parable in English',
  story_he: 'The same story or parable in Hebrew',
  takeaway_en: 'One practical thing a young person can do today, in English',
  takeaway_he: 'The same takeaway in Hebrew',
  blessing_en: 'A short closing blessing in English',
  blessing_he: 'The same closing blessing in Hebrew',
};

const SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(Object.entries(FIELDS).map(([k, description]) => [k, { type: 'string', description }])),
  required: Object.keys(FIELDS),
};

const SYSTEM = `You write short daily Divrei Torah for "Ohr HaYom" (אור היום), an app for Bar and Bat Mitzvah–age kids (12–13 years old) and their families. Every teaching is fully bilingual: natural, fluent Hebrew and English that say the same thing — not a stiff translation of each other.

Voice: warm and clear, like a respected rebbe or teacher speaking to a bright student on the verge of adulthood — never cutesy, never talking down, no exclamation-mark cheerleading, and not dry scholarship either. Ground the idea in the verse and in a classic source (Rashi, Ramban, Sforno, Ibn Ezra, a Midrash or Chazal), explained so a 12–13 year old can follow it. The story can be a classic tale (a Midrash, a story of a gadol or a Chassidic master) or a modern situation a teenager would recognize — whichever teaches the idea best. The takeaway must be one concrete thing they can actually do today.

Rules you must always follow:
- Write only about the parsha given in the request. Never substitute a different parsha, even if you think another is being read this week. Choose the verse from within that parsha's range.
- Divine Names in Hebrew: never write the Tetragrammaton or the full form אלהים anywhere, including inside verse quotes, since these pages get printed. In verses write ה׳ for the Tetragrammaton and אלקים for Elohim. In your own words use הקב"ה or השם.
- Divine Names in English: write "G-d" or "Hashem", never "God", including in verse translations.
- Hebrew references use Hebrew-letter numerals (e.g. שמות כ:ב).`;

export class GenerationError extends Error {
  constructor(message, { quota = false } = {}) {
    super(message);
    this.quota = quota; // true when Google's rate limit / daily quota was hit
  }
}

export function hasCredentials() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

// Google's free tier often answers 503 ("high demand") for a while. Move down the model
// chain on a busy or retired model, then give the whole chain one more pass after a pause.
const SKIP_TO_NEXT = new Set([404, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callWithRetry(prompt) {
  const models = [MODEL, ...FALLBACK_MODELS];
  let lastError;
  for (let pass = 0; pass < 2; pass++) {
    if (pass) await sleep(3000);
    for (const model of models) {
      try {
        return await client.models.generateContent({
          model,
          contents: prompt,
          config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', responseJsonSchema: SCHEMA },
        });
      } catch (err) {
        if (!(err instanceof ApiError && SKIP_TO_NEXT.has(err.status))) throw err;
        console.warn(`Gemini: ${model} unavailable (${err.status}), trying next`);
        lastError = err;
      }
    }
  }
  throw lastError;
}

export async function generateDvarTorah({ reading, date, avoid = [] }) {
  const avoidNote = avoid.length
    ? `\nEarlier teachings on this parsha already used these, so pick a different verse and angle:\n${avoid.map((a) => `- ${a}`).join('\n')}\n`
    : '';

  const prompt = `Parsha: ${reading.en} (${reading.he})
Book: ${reading.book} (${reading.bookHe}), ${reading.range}
Date: ${date}
${avoidNote}
Write today's Dvar Torah on this parsha.`;

  let response;
  try {
    if (!hasCredentials()) throw new GenerationError('The server has no GEMINI_API_KEY. Add it to .env and restart.');
    client ??= new GoogleGenAI({});
    response = await callWithRetry(prompt);
  } catch (err) {
    if (err instanceof GenerationError) throw err;
    if (err instanceof ApiError) {
      if (err.status === 429) {
        throw new GenerationError('Too many requests right now — please try again a little later.', { quota: true });
      }
      if (err.status === 401 || err.status === 403 || (err.status === 400 && /api key/i.test(err.message))) {
        throw new GenerationError("The server's GEMINI_API_KEY is missing or invalid.");
      }
      throw new GenerationError(`The teaching service returned an error (${err.status}). Please try again.`);
    }
    throw err;
  }

  const finish = response.candidates?.[0]?.finishReason;
  if (finish === 'MAX_TOKENS') {
    throw new GenerationError('The teaching came back incomplete. Please try again.');
  }
  const text = response.text;
  if (!text) throw new GenerationError('The teaching could not be written this time. Please try again.');

  const teaching = sanitizeNames(JSON.parse(text));
  // The parsha always comes from the app, never from the model.
  return { ...teaching, parsha_en: reading.en, parsha_he: reading.he, parsha_key: reading.names.join('|') };
}

// Belt-and-braces enforcement of the Divine Name rules on everything the model wrote.
export function sanitizeNames(teaching) {
  const out = {};
  for (const [key, value] of Object.entries(teaching)) {
    out[key] = key.endsWith('_he')
      ? value
          .replace(/י[\u0591-\u05C7]*ה[\u0591-\u05C7]*ו[\u0591-\u05C7]*ה[\u0591-\u05C7]*/g, 'ה׳')
          // אלהים / אלהינו / אלהיך … (with or without vowels, plene or not) → אלקים / אלקינו …
          .replace(/(א[\u0591-\u05C7]*ל[\u0591-\u05C7]*(?:ו[\u0591-\u05C7]*)?)ה([\u0591-\u05C7]*י)/g, '$1ק$2')
      : value.replace(/\bGod\b/g, 'G-d');
  }
  return out;
}
