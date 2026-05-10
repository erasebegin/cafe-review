/**
 * backfill-contact.ts — Batch run the contact scraper for ALL existing cafes in Sanity.
 *
 * Fetches every cafe document, runs the scraper, and updates Sanity with any
 * new contact information found (phone, email, instagram, facebook).
 *
 * Usage:
 *   tsx --env-file=.env scripts/backfill-contact.ts            # Live run
 *   tsx --env-file=.env scripts/backfill-contact.ts --dry-run  # Preview only
 *   tsx --env-file=.env scripts/backfill-contact.ts --verbose  # Verbose logging
 *   tsx --env-file=.env scripts/backfill-contact.ts --cafe "Cafe Zimmer 3"  # Single cafe
 */

import { createClient } from "@sanity/client";
import { scrapeCafeContact, type CafeContactInfo } from "./scrape-contact.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const SINGLE_CAFE = process.argv.includes("--cafe")
  ? process.argv[process.argv.indexOf("--cafe") + 1]
  : undefined;

// Rate limiting: wait between cafes to avoid hammering APIs
const CAFE_DELAY_MS = 3000;

// ─── Sanity Client ───────────────────────────────────────────────────────────

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "d63wzggl",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: "2024-09-18",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false, // Need fresh data for updates
});

interface CafeDoc {
  _id: string;
  title: string;
  slug: { current: string };
  address?: string;
  location?: { cityName?: string };
  phoneNumber?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
}

// ─── Fetch Cafes ─────────────────────────────────────────────────────────────

async function fetchCafes(): Promise<CafeDoc[]> {
  const filter = SINGLE_CAFE
    ? `*[_type == "cafe" && title match "${SINGLE_CAFE}"]`
    : `*[_type == "cafe" && !(_id in path("drafts.**"))]`;

  const query = `${filter} {
    _id,
    title,
    slug,
    address,
    "location": location->{ cityName },
    phoneNumber,
    email,
    instagram,
    facebook
  } | order(title asc)`;

  const cafes: CafeDoc[] = await sanity.fetch(query);
  return cafes;
}

// ─── Update Sanity ───────────────────────────────────────────────────────────

async function updateCafeContact(docId: string, info: CafeContactInfo) {
  const patch: Record<string, string> = {};

  if (info.phone) patch.phoneNumber = info.phone;
  if (info.email) patch.email = info.email;
  if (info.instagram) patch.instagram = info.instagram;
  if (info.facebook) patch.facebook = info.facebook;

  if (Object.keys(patch).length === 0) {
    return { updated: false, fields: [] as string[] };
  }

  if (DRY_RUN) {
    return { updated: true, fields: Object.keys(patch) };
  }

  await sanity
    .patch(docId)
    .set(patch)
    .commit();

  return { updated: true, fields: Object.keys(patch) };
}

// ─── Extract City ────────────────────────────────────────────────────────────

function extractCity(cafe: CafeDoc): string | undefined {
  if (cafe.location?.cityName) return cafe.location.cityName;

  // Try to extract from address (common patterns)
  const addr = cafe.address ?? "";
  // Berlin postal codes: 10xxx, 12xxx, 13xxx, 14xxx
  if (/\b1[0-4]\d{3}\s+Berlin\b/i.test(addr)) return "Berlin";
  // München postal codes: 80xxx, 81xxx
  if (/\b8[0-1]\d{3}\s+München\b/i.test(addr)) return "München";
  if (/\b8[0-1]\d{3}\s+Munich\b/i.test(addr)) return "München";
  // UK
  if (/Lewes/i.test(addr)) return "Lewes";
  // Generic: extract city name after postal code
  const cityMatch = addr.match(/\d{4,5}\s+([A-Za-zäöüßÄÖÜ\- ]+)/);
  if (cityMatch) return cityMatch[1].trim();

  return undefined;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const header = [
    "🕵️  Cafe Contact Backfill",
    DRY_RUN ? "(DRY RUN — no changes will be written)" : "",
    SINGLE_CAFE ? `(single cafe: "${SINGLE_CAFE}")` : "",
  ]
    .filter(Boolean)
    .join(" ");
  console.log(header + "\n");

  if (!process.env.BRAVE_API_KEY) {
    console.error("✗ BRAVE_API_KEY is not set in the environment (.env)");
    process.exit(1);
  }

  console.log("📡 Fetching cafes from Sanity...");
  const cafes = await fetchCafes();
  console.log(`📋 Found ${cafes.length} cafe(s)\n`);

  let successCount = 0;
  let failCount = 0;
  let updateCount = 0;
  const results: Array<{
    name: string;
    slug: string;
    found: string[];
    notFound: string[];
  }> = [];

  for (let i = 0; i < cafes.length; i++) {
    const cafe = cafes[i];
    const city = extractCity(cafe);

    console.log(`\n[${i + 1}/${cafes.length}] ${cafe.title} (${cafe.slug.current})`);
    console.log(`  Address: ${cafe.address ?? "none"}`);
    console.log(`  City: ${city ?? "unknown"}`);
    console.log(
      `  Current: phone=${cafe.phoneNumber ?? "❌"}, email=${cafe.email ?? "❌"}, ` +
        `instagram=${cafe.instagram ?? "❌"}, facebook=${cafe.facebook ?? "❌"}`,
    );

    // Skip if already has all contact info
    if (cafe.phoneNumber && cafe.email && cafe.instagram && cafe.facebook) {
      console.log("  ⏭  Already has all contact info, skipping.");
      successCount++;
      results.push({
        name: cafe.title,
        slug: cafe.slug.current,
        found: ["phone", "email", "instagram", "facebook"],
        notFound: [],
      });
      continue;
    }

    try {
      const info = await scrapeCafeContact(
        {
          name: cafe.title,
          city,
          address: cafe.address,
        },
        { verbose: VERBOSE },
      );

      // Determine what's new
      const newFields: string[] = [];
      if (info.phone && !cafe.phoneNumber) newFields.push("phone");
      if (info.email && !cafe.email) newFields.push("email");
      if (info.instagram && !cafe.instagram) newFields.push("instagram");
      if (info.facebook && !cafe.facebook) newFields.push("facebook");

      const notFound: string[] = [];
      if (!info.phone && !cafe.phoneNumber) notFound.push("phone");
      if (!info.email && !cafe.email) notFound.push("email");
      if (!info.instagram && !cafe.instagram) notFound.push("instagram");
      if (!info.facebook && !cafe.facebook) notFound.push("facebook");

      if (newFields.length > 0) {
        const { updated, fields } = await updateCafeContact(cafe._id, info);
        if (updated) {
          updateCount++;
          console.log(`  ✅ Updated fields: ${fields.join(", ")}`);
        }
      } else if (notFound.length === 0) {
        console.log(`  ✅ Already complete.`);
      } else {
        console.log(`  ⚠️  No new info found. Missing: ${notFound.join(", ")}`);
      }

      successCount++;
      results.push({
        name: cafe.title,
        slug: cafe.slug.current,
        found: newFields,
        notFound,
      });
    } catch (err) {
      failCount++;
      console.error(`  ✗ Failed: ${err}`);
      results.push({
        name: cafe.title,
        slug: cafe.slug.current,
        found: [],
        notFound: ["phone", "email", "instagram", "facebook"],
      });
    }

    // Rate limiting delay between cafes (skip last)
    if (i < cafes.length - 1) {
      const waitMs = CAFE_DELAY_MS;
      if (VERBOSE) console.log(`  ⏳ Waiting ${waitMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("📊 BACKFILL SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total cafes: ${cafes.length}`);
  console.log(`Successfully scraped: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Documents updated: ${updateCount}${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log();

  // Show cafes still missing info
  const missing = results.filter((r) => r.notFound.length > 0);
  if (missing.length > 0) {
    console.log("⚠️  Cafes still missing some contact info:");
    for (const m of missing) {
      console.log(`  - ${m.name}: missing ${m.notFound.join(", ")}`);
    }
    console.log();
  }

  // Show what was found
  const found = results.filter((r) => r.found.length > 0);
  if (found.length > 0) {
    console.log(`✅ New info found for ${found.length} cafe(s):`);
    for (const f of found) {
      console.log(`  + ${f.name}: ${f.found.join(", ")}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n🏃 This was a DRY RUN. Run without --dry-run to apply changes.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
