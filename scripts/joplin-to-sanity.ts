import Database from "better-sqlite3";
import { createClient } from "@sanity/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

const JOPLIN_DB_PATH = join(homedir(), ".config/joplin-desktop/database.sqlite");
const JOPLIN_FOLDER_ID = "27218f44ae834d4588ec25dd30090cee";
const MANIFEST_PATH = join(import.meta.dirname, ".sync-manifest.json");

// OpenRouter (https://openrouter.ai/docs) — used only for metadata extraction.
// The user's written prose is NEVER sent through the model for rewriting.
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const DRY_RUN = process.argv.includes("--dry-run");
// After a schema migration, run with `--force` (alias `--all`) to ignore the
// manifest and re-push every note under the new shape.
const FORCE = process.argv.includes("--force") || process.argv.includes("--all");

// Cafes that exist in Sanity but not in Joplin should never be touched by
// this script. `Carafe` is one such doc; guarded defensively.
const PROTECTED_SLUGS = new Set(["carafe"]);

if (!OPENROUTER_API_KEY) {
  console.error("✗ OPENROUTER_API_KEY is not set in the environment (.env)");
  process.exit(1);
}

// Sanity client (reuses project env vars)
const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "d63wzggl",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: "2024-09-18",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface JoplinNote {
  id: string;
  title: string;
  body: string;
  updated_time: number;
}

interface SyncEntry {
  sanityDocId: string;
  lastSyncedAt: string;
  joplinUpdatedTime: number;
}

type SyncManifest = Record<string, SyncEntry>;

type VolumeLevel = "silent" | "quiet" | "moderate" | "loud" | "extreme";
type DistractionLevel = "none" | "low" | "medium" | "high";
type SeatingType = "benches" | "chairs" | "stools" | "sofas";
type TableSize = "small" | "medium" | "large" | "mixed";
type PlugAvailability = "none" | "few" | "some" | "plenty";
type LaptopAllowed = "yes" | "no" | "restricted" | "unclear";
type ItemCategory = "drink" | "food";

interface Atmosphere {
  music?: {
    volume?: VolumeLevel;
    genre?: string;
    distractionLevel?: DistractionLevel;
    notes?: string;
  };
  interior?: string;
  decoration?: string;
  vibeNotes?: string;
  staff?: {
    friendliness?: number;
    professionalism?: number;
    activeness?: number;
    notes?: string;
  };
  sizeLayout?: {
    indoorTables?: number;
    outdoorTables?: number;
    notes?: string;
  };
  seating?: {
    comfort?: number;
    types?: SeatingType[];
    notes?: string;
  };
  tables?: {
    size?: TableSize;
    laptopFriendlyHeight?: boolean;
    notes?: string;
  };
  toilets?: {
    available?: boolean;
    cleanliness?: number;
    acoustics?: string;
    notes?: string;
  };
}

interface WorkingFacilities {
  wifi?: {
    available?: boolean;
    speedMbps?: number;
    captivePortal?: boolean;
    notes?: string;
  };
  plugSockets?: {
    availability?: PlugAvailability;
    notes?: string;
  };
  laptopPolicy?: {
    allowed?: LaptopAllowed;
    notes?: string;
  };
}

interface ItemTried {
  name: string;
  category: ItemCategory;
  rating?: number;
  priceEur?: number;
  notes?: string;
}

interface ParsedCafe {
  title: string;
  slug: string;
  description: string;
  reviewBody: PortableTextBlock[];
  visits?: number;
  // Ratings
  veganRating?: number;
  veganComment?: string;
  glutenFreeRating?: number;
  glutenFreeComment?: string;
  workabilityRating?: number;
  workabilityComment?: string;
  coffeeCraftsmanshipRating?: number;
  coffeeCraftsmanshipComment?: string;
  healthFocusRating?: number;
  healthFocusComment?: string;
  croissantRating?: number;
  croissantComment?: string;
  cakesAndPastriesRating?: number;
  cakesAndPastriesComment?: string;
  drinksRating?: number;
  drinksComment?: string;
  // Nested
  atmosphere?: Atmosphere;
  workingFacilities?: WorkingFacilities;
  menuNotes?: string;
  itemsTried?: ItemTried[];
  // Multi-selects
  vibe?: string[];
  food?: string[];
  drinks?: string[];
  facilities?: string[];
  // Contact / address
  address?: string;
  specialty?: string;
  phoneNumber?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  locationCity?: string;
}

interface PortableTextBlock {
  _key: string;
  _type: "block";
  children: Array<{
    _key: string;
    _type: "span";
    marks: string[];
    text: string;
  }>;
  markDefs: any[];
  style: string;
}

// ─── Sync Manifest ───────────────────────────────────────────────────────────

function loadManifest(): SyncManifest {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveManifest(manifest: SyncManifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ─── Joplin SQLite Reader ────────────────────────────────────────────────────

function readJoplinNotes(): JoplinNote[] {
  const db = new Database(JOPLIN_DB_PATH, { readonly: true });
  const rows = db
    .prepare(
      `SELECT id, title, body, updated_time
       FROM notes
       WHERE parent_id = ? AND deleted_time = 0
         AND title NOT LIKE '%Template%'
         AND title NOT LIKE '%TEMPLATE%'
       ORDER BY updated_time ASC`
    )
    .all(JOPLIN_FOLDER_ID) as JoplinNote[];
  db.close();
  return rows;
}

// ─── Note Splitter ───────────────────────────────────────────────────────────
// Notes come in two flavours:
//   New template: 3 parts split by escaped horizontal rules (`\---`):
//     1. Preamble (address + structured bullets incl. **Visits:** / **Location:**)
//     2. `Article body:` followed by prose (PRESERVED VERBATIM)
//     3. Ratings: `**<Name>** N/5 — <comment>` lines
//   Old format: no `\---`, uses `* * *` or bullet rating lines like `vegan 3/5`.

interface SplitNote {
  preamble: string;
  articleBody: string;
  ratingsBlock: string;
}

function splitNote(body: string): SplitNote {
  const normalized = body.replace(/\r\n/g, "\n");

  // New format: `\---` fenced.
  const escapedParts = normalized.split(/\n\\---\n/);
  if (escapedParts.length >= 3) {
    const preamble = escapedParts[0].trim();
    const article = escapedParts[1].replace(/^\s*Article body:\s*/i, "").trim();
    const ratings = escapedParts.slice(2).join("\n").trim();
    return { preamble, articleBody: article, ratingsBlock: ratings };
  }

  // Old format: `* * *` horizontal rule (with optional whitespace/nbsp lines).
  const hrSplit = normalized.split(/\n(?:\s|&nbsp;)*\*\s*\*\s*\*(?:\s|&nbsp;)*\n/);
  if (hrSplit.length >= 2) {
    const preamble = hrSplit[0].trim();
    const ratings = hrSplit.slice(1).join("\n").trim();
    return { preamble, articleBody: "", ratingsBlock: ratings };
  }

  // Fallback: try to detect a trailing rating block by scanning the tail for
  // lines matching a rating pattern. Everything before becomes preamble.
  const lines = normalized.split("\n");
  let ratingStart = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const stripped = lines[i].trim();
    if (!stripped) continue;
    if (isRatingLine(stripped)) {
      ratingStart = i;
    } else if (ratingStart >= 0) {
      break;
    }
  }
  if (ratingStart > 0) {
    const preamble = lines.slice(0, ratingStart).join("\n").trim();
    const ratings = lines.slice(ratingStart).join("\n").trim();
    return { preamble, articleBody: "", ratingsBlock: ratings };
  }

  return { preamble: "", articleBody: normalized.trim(), ratingsBlock: "" };
}

function isRatingLine(line: string): boolean {
  // Matches `vegan 3/5`, `**Vegan** 3/5 — ...`, `Vegan 3/5 —`, `- vegan 3/5`, etc.
  return /^[-*\s]*\*{0,2}\s*(vegan|gluten[\s-]?free|workability|health\s*focus|coffee(?:\s*craftsmanship)?|croissants?|cakes?\s*(?:&|and)\s*pastries|pastries|drinks?)\s*\*{0,2}\s*(?:\d|\?)\s*\/\s*5/i.test(
    line
  );
}

// ─── Ratings Parser (regex, deterministic) ───────────────────────────────────

type RatingKey =
  | "vegan"
  | "glutenFree"
  | "workability"
  | "coffeeCraftsmanship"
  | "healthFocus"
  | "croissant"
  | "cakesAndPastries"
  | "drinks";

const RATING_LABELS: Record<string, RatingKey> = {
  vegan: "vegan",
  "gluten free": "glutenFree",
  "gluten-free": "glutenFree",
  glutenfree: "glutenFree",
  workability: "workability",
  "health focus": "healthFocus",
  coffee: "coffeeCraftsmanship",
  "coffee craftsmanship": "coffeeCraftsmanship",
  croissant: "croissant",
  croissants: "croissant",
  pastries: "cakesAndPastries",
  "cakes & pastries": "cakesAndPastries",
  "cakes and pastries": "cakesAndPastries",
  "cake & pastries": "cakesAndPastries",
  drinks: "drinks",
  drink: "drinks",
  "drinks overall": "drinks",
};

type RatingsResult = Partial<
  Record<RatingKey, { rating?: number; comment?: string }>
>;

function parseRatings(block: string): RatingsResult {
  const out: RatingsResult = {};
  if (!block) return out;

  // Normalize: drop list bullets, collapse whitespace on each line.
  const normalized = block
    .split("\n")
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .join("\n");

  // Matches both `**Vegan** 3/5 — comment` and plain `vegan 3/5` (no bold).
  const lineRegex =
    /\*{0,2}\s*([A-Za-z][A-Za-z &-]+?)\s*\*{0,2}\s*(\d|\?)\s*\/\s*5\s*\*{0,2}\s*(?:[—–\-:]+\s*([^\n]*))?/g;

  let m: RegExpExecArray | null;
  while ((m = lineRegex.exec(normalized)) !== null) {
    const label = m[1].trim().toLowerCase();
    const ratingRaw = m[2];
    const comment = (m[3] ?? "").trim();
    const key = RATING_LABELS[label];
    if (!key) continue;
    const entry: { rating?: number; comment?: string } = out[key] ?? {};
    if (ratingRaw && ratingRaw !== "?") {
      const n = Number(ratingRaw);
      if (n >= 1 && n <= 5) entry.rating = n;
    }
    if (comment) entry.comment = comment;
    if (entry.rating !== undefined || entry.comment) out[key] = entry;
  }
  return out;
}

// Extract `**Visits:** N` from the preamble.
function parseVisits(preamble: string): number | undefined {
  const m = preamble.match(/\*\*Visits?:?\*\*\s*(\d+)/i);
  return m ? Number(m[1]) : undefined;
}

// ─── Article Body → Portable Text ────────────────────────────────────────────

function articleToPortableText(article: string): PortableTextBlock[] {
  return article
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text): PortableTextBlock => ({
      _key: randomBytes(6).toString("hex"),
      _type: "block",
      children: [
        {
          _key: randomBytes(6).toString("hex"),
          _type: "span",
          marks: [],
          text,
        },
      ],
      markDefs: [],
      style: "normal",
    }));
}

// ─── OpenRouter Metadata Extractor ───────────────────────────────────────────
// IMPORTANT: the model NEVER rewrites the user's prose. It only returns
// structured metadata for the Sanity schema.

const VIBE_VALUES = [
  "arabic","bohemian","bright","bustling","business","calm","chain-like","charming",
  "cheesy","classy","cold","contemporary","corporate","cosy","counter-culture",
  "cramped","decadent","drab","formal","generic","heartwarming","hip","hipster",
  "homely","industrial","inoffensive","intellectual","international","jazz-lounge",
  "laid-back","living-room","low-key","messy","minimal","modern","natural","neutral",
  "novel","opulent","plush","post-modern","quaint","quirky","quiet","radiant",
  "relaxed","restaurant-like","scandinavian-minimalism","smoky","soulless","spacious",
  "suburban","tasteful","turkish","warm"
];

const SYSTEM_PROMPT = `You are a strict metadata extractor for a cafe review website. You will receive a cafe name and a Markdown note containing a structured preamble, the author's article body (prose), and a ratings block.

Return ONLY a JSON object matching the schema below. Do NOT rewrite, paraphrase, or summarise the author's prose back into any field — only derive short metadata. If a field cannot be confidently derived, omit it or use null.

Schema:
{
  "slug": "kebab-case slug from the cafe name (e.g. 'Cafe Zimmer 3' → 'cafe-zimmer-3')",
  "description": "one short sentence (max 25 words) summarising the cafe for SEO/meta — neutral tone",
  "locationCity": "city name only, e.g. 'Berlin' or 'München'",
  "address": "street address if present, else null",
  "specialty": "short phrase (3-6 words) if the cafe has a clear specialty, else null",
  "phoneNumber": "string or null",
  "email": "string or null",
  "instagram": "instagram URL or handle or null",
  "facebook": "facebook URL or null",
  "vibe": ["subset of: ${VIBE_VALUES.join(", ")}"],
  "food": ["subset of: pastries, breakfast, brunch, dinner"],
  "drinks": ["subset of: smoothies, coffee, milkshakes, tea"],
  "facilities": ["subset of: toilets, wifi, plug_sockets"],
  "menuNotes": "short paragraph about menu breadth/pricing/standouts, or null",
  "itemsTried": [
    {
      "name": "item name",
      "category": "drink | food",
      "rating": "0-10 number if author gave one, else null",
      "priceEur": "number in euros if mentioned, else null",
      "notes": "short notes, or null"
    }
  ],
  "atmosphere": {
    "music": {
      "volume": "silent | quiet | moderate | loud | extreme | null",
      "genre": "string or null",
      "distractionLevel": "none | low | medium | high | null",
      "notes": "string or null"
    },
    "interior": "short description or null",
    "decoration": "short description or null",
    "vibeNotes": "free-form vibe text (beyond the vibe tags) or null",
    "staff": {
      "friendliness": "1-5 or null",
      "professionalism": "1-5 or null",
      "activeness": "1-5 or null",
      "notes": "string or null"
    },
    "sizeLayout": {
      "indoorTables": "integer or null",
      "outdoorTables": "integer or null",
      "notes": "string or null"
    },
    "seating": {
      "comfort": "1-5 or null",
      "types": ["subset of: benches, chairs, stools, sofas"],
      "notes": "string or null"
    },
    "tables": {
      "size": "small | medium | large | mixed | null",
      "laptopFriendlyHeight": "true | false | null",
      "notes": "string or null"
    },
    "toilets": {
      "available": "true | false | null",
      "cleanliness": "1-5 or null",
      "acoustics": "short phrase (e.g. 'private', 'echoey') or null",
      "notes": "string or null"
    }
  },
  "workingFacilities": {
    "wifi": {
      "available": "true | false | null",
      "speedMbps": "number or null",
      "captivePortal": "true | false | null",
      "notes": "string or null"
    },
    "plugSockets": {
      "availability": "none | few | some | plenty | null",
      "notes": "string or null"
    },
    "laptopPolicy": {
      "allowed": "yes | no | restricted | unclear | null",
      "notes": "string or null"
    }
  }
}

RULES:
- Never include the article body, ratings text, or any rewritten prose in any field.
- Tag arrays MUST only contain values from the listed enum — drop anything else.
- Prefer omitting a field over guessing. Empty arrays are fine.
- Return only the JSON object. No markdown fences, no commentary.`;

interface AIMetadata {
  slug?: string;
  description?: string;
  locationCity?: string | null;
  address?: string | null;
  specialty?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  vibe?: string[];
  food?: string[];
  drinks?: string[];
  facilities?: string[];
  menuNotes?: string | null;
  itemsTried?: Array<{
    name?: string;
    category?: string;
    rating?: number | null;
    priceEur?: number | null;
    notes?: string | null;
  }>;
  atmosphere?: any;
  workingFacilities?: any;
}

async function extractMetadataWithOpenRouter(
  note: JoplinNote
): Promise<AIMetadata | null> {
  const userPrompt = `CAFE NAME: ${note.title}\n\nREVIEW NOTE:\n${note.body}`;

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://cafereview.eu",
        "X-Title": "Cafe Review Joplin Sync",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    console.error(`  ✗ OpenRouter request failed: ${err}`);
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`  ✗ OpenRouter returned ${response.status}: ${text.slice(0, 200)}`);
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  let raw = (data.choices?.[0]?.message?.content || "").trim();
  raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

  try {
    return JSON.parse(raw) as AIMetadata;
  } catch {
    console.error(`  ✗ Failed to parse OpenRouter JSON output`);
    console.error(`  Raw output: ${raw.slice(0, 300)}...`);
    return null;
  }
}

// ─── Enum sanitisers ─────────────────────────────────────────────────────────

function filterEnum<T extends string>(
  values: unknown,
  allowed: readonly T[]
): T[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const allow = new Set<string>(allowed as readonly string[]);
  const out = values
    .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
    .filter((v): v is T => allow.has(v)) as T[];
  return out.length ? out : undefined;
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase() as T;
  return (allowed as readonly string[]).includes(v) ? v : undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes"].includes(s)) return true;
    if (["false", "no"].includes(s)) return false;
  }
  return undefined;
}

function toInt(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function toNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toRating5(v: unknown): number | undefined {
  const n = toNum(v);
  return n != null && n >= 1 && n <= 5 ? n : undefined;
}

function toStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

// Build a nested object, omitting sub-objects that have no populated children.
function prune<T extends Record<string, any>>(obj: T): T | undefined {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v.length) out[k] = v;
    } else if (typeof v === "object") {
      const pruned = prune(v);
      if (pruned) out[k] = pruned;
    } else {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? (out as T) : undefined;
}

function normaliseAtmosphere(raw: any): Atmosphere | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const atm: Atmosphere = {};
  if (raw.music) {
    atm.music = prune({
      volume: pickEnum(raw.music.volume, ["silent", "quiet", "moderate", "loud", "extreme"] as const),
      genre: toStr(raw.music.genre),
      distractionLevel: pickEnum(raw.music.distractionLevel, ["none", "low", "medium", "high"] as const),
      notes: toStr(raw.music.notes),
    });
  }
  atm.interior = toStr(raw.interior);
  atm.decoration = toStr(raw.decoration);
  atm.vibeNotes = toStr(raw.vibeNotes);
  if (raw.staff) {
    atm.staff = prune({
      friendliness: toRating5(raw.staff.friendliness),
      professionalism: toRating5(raw.staff.professionalism),
      activeness: toRating5(raw.staff.activeness),
      notes: toStr(raw.staff.notes),
    });
  }
  if (raw.sizeLayout) {
    atm.sizeLayout = prune({
      indoorTables: toInt(raw.sizeLayout.indoorTables),
      outdoorTables: toInt(raw.sizeLayout.outdoorTables),
      notes: toStr(raw.sizeLayout.notes),
    });
  }
  if (raw.seating) {
    atm.seating = prune({
      comfort: toRating5(raw.seating.comfort),
      types: filterEnum(raw.seating.types, ["benches", "chairs", "stools", "sofas"] as const),
      notes: toStr(raw.seating.notes),
    });
  }
  if (raw.tables) {
    atm.tables = prune({
      size: pickEnum(raw.tables.size, ["small", "medium", "large", "mixed"] as const),
      laptopFriendlyHeight: toBool(raw.tables.laptopFriendlyHeight),
      notes: toStr(raw.tables.notes),
    });
  }
  if (raw.toilets) {
    atm.toilets = prune({
      available: toBool(raw.toilets.available),
      cleanliness: toRating5(raw.toilets.cleanliness),
      acoustics: toStr(raw.toilets.acoustics),
      notes: toStr(raw.toilets.notes),
    });
  }
  return prune(atm);
}

function normaliseWorkingFacilities(raw: any): WorkingFacilities | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const wf: WorkingFacilities = {};
  if (raw.wifi) {
    wf.wifi = prune({
      available: toBool(raw.wifi.available),
      speedMbps: toNum(raw.wifi.speedMbps),
      captivePortal: toBool(raw.wifi.captivePortal),
      notes: toStr(raw.wifi.notes),
    });
  }
  if (raw.plugSockets) {
    wf.plugSockets = prune({
      availability: pickEnum(raw.plugSockets.availability, ["none", "few", "some", "plenty"] as const),
      notes: toStr(raw.plugSockets.notes),
    });
  }
  if (raw.laptopPolicy) {
    wf.laptopPolicy = prune({
      allowed: pickEnum(raw.laptopPolicy.allowed, ["yes", "no", "restricted", "unclear"] as const),
      notes: toStr(raw.laptopPolicy.notes),
    });
  }
  return prune(wf);
}

function normaliseItemsTried(raw: any): ItemTried[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ItemTried[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const name = toStr(row.name);
    const category = pickEnum(row.category, ["drink", "food"] as const);
    if (!name || !category) continue;
    const item: ItemTried = { name, category };
    const rating = toNum(row.rating);
    if (rating != null && rating >= 0 && rating <= 10) item.rating = rating;
    const price = toNum(row.priceEur);
    if (price != null && price >= 0) item.priceEur = price;
    const notes = toStr(row.notes);
    if (notes) item.notes = notes;
    out.push(item);
  }
  return out.length ? out : undefined;
}

// ─── Combined Parser ─────────────────────────────────────────────────────────

async function parseNote(note: JoplinNote): Promise<ParsedCafe | null> {
  const { preamble, articleBody, ratingsBlock } = splitNote(note.body);
  const reviewBody = articleToPortableText(articleBody || preamble);
  const ratings = parseRatings(ratingsBlock || note.body); // fall back to whole body
  const visits = parseVisits(preamble || note.body);

  const meta = await extractMetadataWithOpenRouter(note);
  if (!meta) return null;

  return {
    title: note.title,
    slug: toStr(meta.slug) || slugify(note.title),
    description: toStr(meta.description) || "",
    reviewBody,
    visits,
    veganRating: ratings.vegan?.rating,
    veganComment: ratings.vegan?.comment,
    glutenFreeRating: ratings.glutenFree?.rating,
    glutenFreeComment: ratings.glutenFree?.comment,
    workabilityRating: ratings.workability?.rating,
    workabilityComment: ratings.workability?.comment,
    coffeeCraftsmanshipRating: ratings.coffeeCraftsmanship?.rating,
    coffeeCraftsmanshipComment: ratings.coffeeCraftsmanship?.comment,
    healthFocusRating: ratings.healthFocus?.rating,
    healthFocusComment: ratings.healthFocus?.comment,
    croissantRating: ratings.croissant?.rating,
    croissantComment: ratings.croissant?.comment,
    cakesAndPastriesRating: ratings.cakesAndPastries?.rating,
    cakesAndPastriesComment: ratings.cakesAndPastries?.comment,
    drinksRating: ratings.drinks?.rating,
    drinksComment: ratings.drinks?.comment,
    atmosphere: normaliseAtmosphere(meta.atmosphere),
    workingFacilities: normaliseWorkingFacilities(meta.workingFacilities),
    menuNotes: toStr(meta.menuNotes),
    itemsTried: normaliseItemsTried(meta.itemsTried),
    vibe: filterEnum(meta.vibe, VIBE_VALUES as readonly string[]),
    food: filterEnum(meta.food, ["pastries", "breakfast", "brunch", "dinner"] as const),
    drinks: filterEnum(meta.drinks, ["smoothies", "coffee", "milkshakes", "tea"] as const),
    facilities: filterEnum(meta.facilities, ["toilets", "wifi", "plug_sockets"] as const),
    address: toStr(meta.address),
    specialty: toStr(meta.specialty),
    phoneNumber: toStr(meta.phoneNumber),
    email: toStr(meta.email),
    instagram: toStr(meta.instagram),
    facebook: toStr(meta.facebook),
    locationCity: toStr(meta.locationCity),
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Sanity Uploader ─────────────────────────────────────────────────────────

// Fields that Sanity studio owns — never overwritten by this script.
const PRESERVE_FIELDS = ["featuredImage", "gallery", "location", "geoLocation"] as const;

async function uploadToSanity(cafe: ParsedCafe): Promise<string> {
  if (PROTECTED_SLUGS.has(cafe.slug)) {
    throw new Error(`Refusing to overwrite protected slug "${cafe.slug}"`);
  }

  const docId = `cafe-${cafe.slug}`;

  // Fetch the existing doc so we can preserve studio-owned fields (images,
  // location reference, geopoint). If the doc doesn't exist, we start fresh.
  const existing = (await sanity.getDocument(docId).catch(() => null)) as
    | Record<string, any>
    | null;

  const doc: { _id: string; _type: string; [k: string]: any } = {
    _id: docId,
    _type: "cafe",
    title: cafe.title,
    slug: { _type: "slug", current: cafe.slug },
  };

  if (cafe.description) doc.description = cafe.description;
  if (cafe.reviewBody?.length) doc.reviewBody = cafe.reviewBody;
  if (cafe.visits != null) doc.visits = cafe.visits;

  // Ratings + comments
  if (cafe.veganRating != null) doc.veganRating = cafe.veganRating;
  if (cafe.veganComment) doc.veganComment = cafe.veganComment;
  if (cafe.glutenFreeRating != null) doc.glutenFreeRating = cafe.glutenFreeRating;
  if (cafe.glutenFreeComment) doc.glutenFreeComment = cafe.glutenFreeComment;
  if (cafe.workabilityRating != null) doc.workabilityRating = cafe.workabilityRating;
  if (cafe.workabilityComment) doc.workabilityComment = cafe.workabilityComment;
  if (cafe.coffeeCraftsmanshipRating != null)
    doc.coffeeCraftsmanshipRating = cafe.coffeeCraftsmanshipRating;
  if (cafe.coffeeCraftsmanshipComment)
    doc.coffeeCraftsmanshipComment = cafe.coffeeCraftsmanshipComment;
  if (cafe.healthFocusRating != null) doc.healthFocusRating = cafe.healthFocusRating;
  if (cafe.healthFocusComment) doc.healthFocusComment = cafe.healthFocusComment;
  if (cafe.croissantRating != null) doc.croissantRating = cafe.croissantRating;
  if (cafe.croissantComment) doc.croissantComment = cafe.croissantComment;
  if (cafe.cakesAndPastriesRating != null)
    doc.cakesAndPastriesRating = cafe.cakesAndPastriesRating;
  if (cafe.cakesAndPastriesComment)
    doc.cakesAndPastriesComment = cafe.cakesAndPastriesComment;
  if (cafe.drinksRating != null) doc.drinksRating = cafe.drinksRating;
  if (cafe.drinksComment) doc.drinksComment = cafe.drinksComment;

  // Nested objects (already pruned to omit empty children)
  if (cafe.atmosphere) doc.atmosphere = cafe.atmosphere;
  if (cafe.workingFacilities) doc.workingFacilities = cafe.workingFacilities;
  if (cafe.menuNotes) doc.menuNotes = cafe.menuNotes;
  if (cafe.itemsTried?.length) {
    doc.itemsTried = cafe.itemsTried.map((i) => ({
      _key: randomBytes(6).toString("hex"),
      _type: "itemTried",
      ...i,
    }));
  }

  // Multi-selects
  if (cafe.vibe) doc.vibe = cafe.vibe;
  if (cafe.food) doc.food = cafe.food;
  if (cafe.drinks) doc.drinks = cafe.drinks;
  if (cafe.facilities) doc.facilities = cafe.facilities;

  // Contact / misc
  if (cafe.address) doc.address = cafe.address;
  if (cafe.specialty) doc.specialty = cafe.specialty;
  if (cafe.phoneNumber) doc.phoneNumber = cafe.phoneNumber;
  if (cafe.email) doc.email = cafe.email;
  if (cafe.instagram) doc.instagram = cafe.instagram;
  if (cafe.facebook) doc.facebook = cafe.facebook;

  // Carry over studio-owned fields so we don't wipe images / references.
  if (existing) {
    for (const field of PRESERVE_FIELDS) {
      if (existing[field] !== undefined && doc[field] === undefined) {
        doc[field] = existing[field];
      }
    }
    // If Joplin didn't record a visits value, keep whatever the studio had.
    if (doc.visits === undefined && existing.visits !== undefined) {
      doc.visits = existing.visits;
    }
  }

  await sanity.createOrReplace(doc);
  return docId;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const header = [
    DRY_RUN ? "🏃 Dry run mode" : "🚀 Starting Joplin → Sanity sync",
    FORCE ? "(force: ignoring manifest)" : "",
  ]
    .filter(Boolean)
    .join(" ");
  console.log(header + "\n");

  const notes = readJoplinNotes();
  console.log(`📂 Found ${notes.length} notes in "Cafe Review" folder`);

  const manifest = loadManifest();
  const synced = Object.keys(manifest).length;
  console.log(`📋 Manifest: ${synced} previously synced notes\n`);

  const toProcess = FORCE
    ? notes
    : notes.filter((note) => {
        const entry = manifest[note.id];
        if (!entry) return true;
        return note.updated_time > entry.joplinUpdatedTime;
      });

  if (toProcess.length === 0) {
    console.log("✅ All notes are already synced. Nothing to do.");
    return;
  }

  console.log(`🔄 ${toProcess.length} note(s) to process:\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const note of toProcess) {
    console.log(`── ${note.title} ──`);

    console.log("  ⏳ Parsing note + extracting metadata via OpenRouter...");
    const parsed = await parseNote(note);

    if (!parsed) {
      failCount++;
      console.log("  ✗ Skipping (parse failed)\n");
      continue;
    }

    if (PROTECTED_SLUGS.has(parsed.slug)) {
      skipCount++;
      console.log(`  ⏭  Skipping protected slug "${parsed.slug}"\n`);
      continue;
    }

    console.log(`  ✓ Parsed: "${parsed.title}" (${parsed.slug})`);
    if (parsed.description)
      console.log(`    Description: ${parsed.description.slice(0, 80)}`);
    console.log(`    Ratings: ${formatRatings(parsed)}`);
    if (parsed.visits != null) console.log(`    Visits: ${parsed.visits}`);
    if (parsed.locationCity) console.log(`    City: ${parsed.locationCity}`);

    if (DRY_RUN) {
      console.log("  📝 [DRY RUN] Would upload to Sanity:");
      console.log(
        `    ${JSON.stringify(parsed, null, 2).split("\n").join("\n    ")}\n`
      );
      successCount++;
      continue;
    }

    try {
      console.log("  ⏳ Uploading to Sanity (preserving images)...");
      const docId = await uploadToSanity(parsed);
      console.log(`  ✓ Uploaded as ${docId}\n`);

      manifest[note.id] = {
        sanityDocId: docId,
        lastSyncedAt: new Date().toISOString(),
        joplinUpdatedTime: note.updated_time,
      };
      saveManifest(manifest);
      successCount++;
    } catch (err) {
      failCount++;
      console.error(`  ✗ Upload failed: ${err}\n`);
    }
  }

  console.log("─".repeat(40));
  console.log(
    `Done! ${successCount} succeeded, ${failCount} failed, ${skipCount} skipped, ${
      notes.length - toProcess.length
    } unchanged.`
  );
}

function formatRatings(cafe: ParsedCafe): string {
  const ratings = [
    cafe.veganRating != null && `vegan=${cafe.veganRating}`,
    cafe.glutenFreeRating != null && `gf=${cafe.glutenFreeRating}`,
    cafe.workabilityRating != null && `work=${cafe.workabilityRating}`,
    cafe.coffeeCraftsmanshipRating != null &&
      `coffee=${cafe.coffeeCraftsmanshipRating}`,
    cafe.healthFocusRating != null && `health=${cafe.healthFocusRating}`,
    cafe.croissantRating != null && `croissant=${cafe.croissantRating}`,
    cafe.cakesAndPastriesRating != null &&
      `cakes=${cafe.cakesAndPastriesRating}`,
    cafe.drinksRating != null && `drinks=${cafe.drinksRating}`,
  ].filter(Boolean);
  return ratings.length ? ratings.join(", ") : "none extracted";
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
