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
const OLLAMA_URL = "http://localhost:11434";
const OLLAMA_MODEL = "qwen2.5:14b";

const DRY_RUN = process.argv.includes("--dry-run");

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

interface ParsedCafe {
  title: string;
  slug: string;
  description: string;
  reviewBody: PortableTextBlock[];
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
  vibe?: string[];
  food?: string[];
  drinks?: string[];
  facilities?: string[];
  address?: string;
  phoneNumber?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
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
       WHERE parent_id = ? AND deleted_time = 0 AND title != 'Template'
       ORDER BY updated_time ASC`
    )
    .all(JOPLIN_FOLDER_ID) as JoplinNote[];
  db.close();
  return rows;
}

// ─── Ollama AI Parser ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a structured data extractor for a cafe review website. Given a raw Markdown cafe review note, extract the data into a JSON object matching the schema below. Return ONLY valid JSON, no other text.

SCHEMA:
{
  "title": "string — the cafe name",
  "slug": "string — kebab-case URL slug derived from the title (e.g. 'Cafe Zimmer 3' → 'cafe-zimmer-3')",
  "description": "string — a 1-2 sentence summary of the cafe based on the review",
  "reviewBodyText": "string — the main review text (the bullet points / paragraphs describing the experience). Do NOT include the ratings section. Combine into coherent prose paragraphs.",
  "veganRating": "number 1-5 or null if not mentioned or n/a",
  "veganComment": "string or null — any comment about vegan options",
  "glutenFreeRating": "number 1-5 or null if not mentioned or n/a",
  "glutenFreeComment": "string or null",
  "workabilityRating": "number 1-5 or null if not mentioned or n/a",
  "workabilityComment": "string or null",
  "coffeeCraftsmanshipRating": "number 1-5 or null if not mentioned or n/a",
  "coffeeCraftsmanshipComment": "string or null — any comment about coffee quality",
  "healthFocusRating": "number 1-5 or null if not mentioned or n/a",
  "healthFocusComment": "string or null",
  "croissantRating": "number 1-5 or null if not mentioned or n/a. May appear as 'pastries' rating",
  "croissantComment": "string or null",
  "vibe": "string[] — tags describing the atmosphere, e.g. ['bohemian', 'laid-back', 'cozy']. Extract from review context.",
  "food": "string[] — types of food mentioned, e.g. ['nachos', 'bircher muesli']",
  "drinks": "string[] — types of drinks mentioned, e.g. ['chai latte', 'decaf coffee']",
  "facilities": "string[] — mentioned facilities, e.g. ['wifi', 'courtyard', 'toilets', 'plug sockets']",
  "address": "string or null — the street address if present",
  "phoneNumber": "string or null",
  "email": "string or null",
  "instagram": "string or null",
  "facebook": "string or null"
}

RULES:
- Ratings: look for patterns like "health focus 2/5", "**Vegan 4/5**", "workability: 3/5", etc. Convert to a number 1-5. If "n/a", use null.
- If a rating has an accompanying comment/explanation, include it in the corresponding comment field.
- The reviewBodyText should be the descriptive content only, not the ratings.
- For vibe tags, infer from adjectives and descriptions (e.g. "very laid back, bohemian" → ["laid-back", "bohemian"]).
- Return ONLY the JSON object. No markdown fences, no explanation.`;

async function parseNoteWithAI(note: JoplinNote): Promise<ParsedCafe | null> {
  const userPrompt = `CAFE NAME: ${note.title}\n\nREVIEW NOTE:\n${note.body}`;

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: userPrompt,
        system: SYSTEM_PROMPT,
        stream: false,
        options: { temperature: 0.1 },
      }),
    });
  } catch (err) {
    console.error(`  ✗ Ollama request failed: ${err}`);
    return null;
  }

  if (!response.ok) {
    console.error(`  ✗ Ollama returned ${response.status}`);
    return null;
  }

  const data = (await response.json()) as { response: string };
  let raw = data.response.trim();

  // Strip markdown code fences if the model wraps the output
  raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`  ✗ Failed to parse AI JSON output`);
    console.error(`  Raw output: ${raw.slice(0, 300)}...`);
    return null;
  }

  // Convert reviewBodyText → Portable Text blocks
  const reviewText: string = parsed.reviewBodyText || "";
  const paragraphs = reviewText
    .split(/\n\n+/)
    .map((p: string) => p.trim())
    .filter(Boolean);

  const reviewBody: PortableTextBlock[] = paragraphs.map(
    (text: string): PortableTextBlock => ({
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
    })
  );

  return {
    title: parsed.title || note.title,
    slug: parsed.slug || slugify(note.title),
    description: parsed.description || "",
    reviewBody,
    veganRating: toRating(parsed.veganRating),
    veganComment: parsed.veganComment || undefined,
    glutenFreeRating: toRating(parsed.glutenFreeRating),
    glutenFreeComment: parsed.glutenFreeComment || undefined,
    workabilityRating: toRating(parsed.workabilityRating),
    workabilityComment: parsed.workabilityComment || undefined,
    coffeeCraftsmanshipRating: toRating(parsed.coffeeCraftsmanshipRating),
    coffeeCraftsmanshipComment: parsed.coffeeCraftsmanshipComment || undefined,
    healthFocusRating: toRating(parsed.healthFocusRating),
    healthFocusComment: parsed.healthFocusComment || undefined,
    croissantRating: toRating(parsed.croissantRating),
    croissantComment: parsed.croissantComment || undefined,
    vibe: parsed.vibe?.length ? parsed.vibe : undefined,
    food: parsed.food?.length ? parsed.food : undefined,
    drinks: parsed.drinks?.length ? parsed.drinks : undefined,
    facilities: parsed.facilities?.length ? parsed.facilities : undefined,
    address: parsed.address || undefined,
    phoneNumber: parsed.phoneNumber || undefined,
    email: parsed.email || undefined,
    instagram: parsed.instagram || undefined,
    facebook: parsed.facebook || undefined,
  };
}

function toRating(val: any): number | undefined {
  if (val == null) return undefined;
  const n = Number(val);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : undefined;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Sanity Uploader ─────────────────────────────────────────────────────────

async function uploadToSanity(
  cafe: ParsedCafe,
  joplinNoteId: string
): Promise<string> {
  const docId = `cafe-${cafe.slug}`;

  const doc: Record<string, any> = {
    _id: docId,
    _type: "cafe",
    title: cafe.title,
    slug: { _type: "slug", current: cafe.slug },
    description: cafe.description,
    reviewBody: cafe.reviewBody,
  };

  // Ratings
  if (cafe.veganRating) doc.veganRating = cafe.veganRating;
  if (cafe.veganComment) doc.veganComment = cafe.veganComment;
  if (cafe.glutenFreeRating) doc.glutenFreeRating = cafe.glutenFreeRating;
  if (cafe.glutenFreeComment) doc.glutenFreeComment = cafe.glutenFreeComment;
  if (cafe.workabilityRating) doc.workabilityRating = cafe.workabilityRating;
  if (cafe.workabilityComment) doc.workabilityComment = cafe.workabilityComment;
  if (cafe.coffeeCraftsmanshipRating)
    doc.coffeeCraftsmanshipRating = cafe.coffeeCraftsmanshipRating;
  if (cafe.coffeeCraftsmanshipComment)
    doc.coffeeCraftsmanshipComment = cafe.coffeeCraftsmanshipComment;
  if (cafe.healthFocusRating) doc.healthFocusRating = cafe.healthFocusRating;
  if (cafe.healthFocusComment) doc.healthFocusComment = cafe.healthFocusComment;
  if (cafe.croissantRating) doc.croissantRating = cafe.croissantRating;
  if (cafe.croissantComment) doc.croissantComment = cafe.croissantComment;

  // Multi-selects
  if (cafe.vibe) doc.vibe = cafe.vibe;
  if (cafe.food) doc.food = cafe.food;
  if (cafe.drinks) doc.drinks = cafe.drinks;
  if (cafe.facilities) doc.facilities = cafe.facilities;

  // Contact
  if (cafe.address) doc.address = cafe.address;
  if (cafe.phoneNumber) doc.phoneNumber = cafe.phoneNumber;
  if (cafe.email) doc.email = cafe.email;
  if (cafe.instagram) doc.instagram = cafe.instagram;
  if (cafe.facebook) doc.facebook = cafe.facebook;

  await sanity.createOrReplace(doc);
  return docId;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    DRY_RUN
      ? "🏃 Dry run mode — will parse notes but NOT upload to Sanity\n"
      : "🚀 Starting Joplin → Sanity sync\n"
  );

  // 1. Read notes
  const notes = readJoplinNotes();
  console.log(`📂 Found ${notes.length} notes in "Cafe Review" folder`);

  // 2. Load manifest
  const manifest = loadManifest();
  const synced = Object.keys(manifest).length;
  console.log(`📋 Manifest: ${synced} previously synced notes\n`);

  // 3. Filter to unprocessed or updated notes
  const toProcess = notes.filter((note) => {
    const entry = manifest[note.id];
    if (!entry) return true;
    return note.updated_time > entry.joplinUpdatedTime;
  });

  if (toProcess.length === 0) {
    console.log("✅ All notes are already synced. Nothing to do.");
    return;
  }

  console.log(`🔄 ${toProcess.length} note(s) to process:\n`);

  // 4. Process each note
  let successCount = 0;
  let failCount = 0;

  for (const note of toProcess) {
    console.log(`── ${note.title} ──`);

    // Parse with AI
    console.log("  ⏳ Parsing with AI...");
    const parsed = await parseNoteWithAI(note);

    if (!parsed) {
      failCount++;
      console.log("  ✗ Skipping (parse failed)\n");
      continue;
    }

    console.log(`  ✓ Parsed: "${parsed.title}" (${parsed.slug})`);
    console.log(`    Description: ${parsed.description.slice(0, 80)}...`);
    console.log(`    Ratings: ${formatRatings(parsed)}`);

    if (DRY_RUN) {
      console.log("  📝 [DRY RUN] Would upload to Sanity:");
      console.log(
        `    ${JSON.stringify(parsed, null, 2).split("\n").join("\n    ")}\n`
      );
      successCount++;
      continue;
    }

    // Upload to Sanity
    try {
      console.log("  ⏳ Uploading to Sanity...");
      const docId = await uploadToSanity(parsed, note.id);
      console.log(`  ✓ Uploaded as ${docId}\n`);

      // Update manifest
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
    `Done! ${successCount} succeeded, ${failCount} failed, ${notes.length - toProcess.length} already synced.`
  );
}

function formatRatings(cafe: ParsedCafe): string {
  const ratings = [
    cafe.veganRating && `vegan=${cafe.veganRating}`,
    cafe.glutenFreeRating && `gf=${cafe.glutenFreeRating}`,
    cafe.workabilityRating && `work=${cafe.workabilityRating}`,
    cafe.coffeeCraftsmanshipRating && `coffee=${cafe.coffeeCraftsmanshipRating}`,
    cafe.healthFocusRating && `health=${cafe.healthFocusRating}`,
    cafe.croissantRating && `croissant=${cafe.croissantRating}`,
  ].filter(Boolean);
  return ratings.length ? ratings.join(", ") : "none extracted";
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
