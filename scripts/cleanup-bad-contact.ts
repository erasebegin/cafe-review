/**
 * Quick script to clean up bad contact data from the initial backfill run.
 * Unsets phone/email that are clearly false positives (dates, postal codes,
 * directory platform addresses).
 */
import { createClient } from "@sanity/client";

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "d63wzggl",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: "2024-09-18",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

const FIXES: Array<{ docId: string; unset: string[] }> = [
  // Bad phone numbers (dates/postal codes caught by loose regex - now fixed)
  { docId: "cafe-lap-coffee", unset: ["phoneNumber"] },        // "31.03.2025"
  { docId: "cafe-zwoelf-uhr-mittags", unset: ["phoneNumber"] }, // "2009-2026"
  { docId: "cafe-hafermilch-barista", unset: ["phoneNumber"] }, // "114 12167"
  // Platform/directory emails (not the cafe's own email)
  { docId: "cafe-chocolab", unset: ["email"] },                 // service@stadtbranchenbuch.de
  { docId: "cafe-confiserie-reichert", unset: ["email"] },      // service@kaupertmedia.de
  // Bad social media handles (generic Instagram pages, not the cafe)
  { docId: "cafe-hafermilch-barista", unset: ["instagram"] },   // instagram.com/popular
  { docId: "5df8c3ac-7131-4ca7-98ea-b9b3c6dd8332", unset: ["instagram"] },               // Carafe: instagram.com/explore
  // Social media from menu/directory platforms, not the cafe
  { docId: "cafe-cafe-friedrichs", unset: ["instagram", "facebook"] }, // insta.menulist / speisekarte.menu
  { docId: "cafe-cello-coffee", unset: ["instagram", "facebook"] }, // insta.menulist / Menulist.menu
  { docId: "cafe-zwoelf-uhr-mittags", unset: ["facebook"] },   // TourbyTransit (bus tour company)
];

async function main() {
  console.log(`🧹 Cleaning up bad contact data on ${FIXES.length} documents...\n`);

  for (const fix of FIXES) {
    try {
      await sanity.patch(fix.docId).unset(fix.unset).commit();
      console.log(`  ✓ ${fix.docId}: unset ${fix.unset.join(", ")}`);
    } catch (err) {
      console.error(`  ✗ ${fix.docId}: ${err}`);
    }
  }

  console.log("\n✅ Cleanup complete.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
