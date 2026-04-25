# Sanity schema changes (SEO PR)

This PR adds new fields used by structured data (`schema.org`), Open Graph
metadata and on-page SEO. Apply each change in the Sanity Studio repo (the
CMS server you maintain). The Astro site already reads these fields with
safe fallbacks, so order of deploy doesn't matter — but you'll get the most
SEO benefit once the Studio is updated and editors can populate them.

The `cafe` document schema lives in this repo at `schema.ts` and has already
been updated (use it as a reference). The `location` and `siteConfig`
schemas live in your Studio project; mirror the changes below there.

## `cafe` (Cafe / blog post)

Added (already in `schema.ts`):

- `seoTitle` — `string`, optional, ≤70 chars. Used as `<title>` override.
- `seoDescription` — `text`, optional, ≤200 chars. Used as `<meta name="description">` override.
- `openingHours` — `array` of `string`, optional. Each entry in schema.org
  format, e.g. `"Mo-Fr 08:00-17:00"`, `"Sa 09:00-14:00"`. Surfaced as
  `openingHours` on the `CafeOrCoffeeShop` JSON-LD.

Reused (no schema change, but documented):

- `geoLocation` (`geopoint`) — surfaced as `geo.GeoCoordinates` JSON-LD.
- `phoneNumber` (legacy: also accept `phone` if present) — `telephone`.
- `address` — already required.

Existing `description` field validation tightened (≤200 chars) so that meta
descriptions don't blow past Google's truncation threshold.

## `location` (City)

Add the following fields to your Studio's `location` schema:

```ts path=null start=null
{
  name: 'seoTitle',
  title: 'SEO Title',
  type: 'string',
  description: 'Optional <title> override for this city page. 50–60 chars.',
  validation: (Rule) => Rule.max(70),
},
{
  name: 'seoDescription',
  title: 'SEO Description',
  type: 'text',
  description: 'Optional meta description override. 140–160 chars.',
  validation: (Rule) => Rule.max(200),
},
```

Also tighten validation on the existing `description` field so each city has
substantive copy:

```ts path=null start=null
{
  name: 'description',
  title: 'Description',
  type: 'text',
  description: 'Public-facing intro paragraph for this city. 150–300 words.',
  validation: (Rule) => Rule.required().min(150).warning('Aim for 150+ chars to help SEO.'),
},
```

The Astro site reads `seoDescription` first, then falls back to
`description` truncated to 160 chars.

## `siteConfig`

Tighten `title` and `description` validation:

```ts path=null start=null
{
  name: 'title',
  title: 'Title',
  type: 'string',
  description: 'Brand name. Singular ("Cafe Review") to match cafereview.eu.',
  validation: (Rule) => Rule.required().min(3).max(40),
},
{
  name: 'description',
  title: 'Description',
  type: 'text',
  description: 'Site-wide meta description fallback. 140–160 chars.',
  validation: (Rule) => Rule.required().min(80).max(180),
},
```

Then update the live `siteConfig` document so its fields read:

- `title` = `Cafe Review`
- `description` = `Honest cafe reviews across Europe — vegan, gluten-free, workability, coffee craftsmanship and pastries, rated city by city.`

## Migration / data tasks for editors

After deploying the schema, populate per-document:

1. Each `location.description` (≥150 chars; mention neighbourhoods, coffee scene).
2. Each `cafe.seoTitle`/`seoDescription` for high-priority reviews. Optional but recommended for the top 5–10.
3. `cafe.openingHours` and `cafe.geoLocation` where known — these unlock richer Local SEO results.
