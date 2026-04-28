import { createClient } from "@sanity/client";

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "d63wzggl",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: "2024-09-18",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

async function main() {
  // Cafes where the `location` reference field is missing/null
  const query = `*[_type == "cafe" && !defined(location)]{
    _id,
    title,
    slug,
    address,
    "hasGeoLocation": defined(geoLocation)
  } | order(title asc)`;

  const cafes = await sanity.fetch(query);

  if (cafes.length === 0) {
    console.log("✅ All cafes have a location reference.");
    return;
  }

  console.log(`Found ${cafes.length} cafe(s) with no location reference:\n`);

  for (const cafe of cafes) {
    const geo = cafe.hasGeoLocation ? " (has geopoint)" : " (no geopoint)";
    const addr = cafe.address ? ` — ${cafe.address}` : " (no address)";
    console.log(`  • ${cafe.title}${addr}${geo}`);
    console.log(`    _id: ${cafe._id}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
