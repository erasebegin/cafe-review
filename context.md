# Code Context

## Project Overview
**Cafe Review** (`cafereview.eu`) — static site for European cafe reviews. Astro 5 SSG + Sanity CMS headless backend. Deployed on Netlify. Analytics via PostHog. SEO-heavy (JSON-LD, OpenGraph, IndexNow, sitemap, RSS).

## Tech Stack
- **Framework:** Astro 5.18 (SSG, no SSR)
- **CMS:** Sanity.io (project `d63wzggl`, dataset `production`)
- **Language:** TypeScript (strict mode)
- **Styling:** Vanilla CSS (no Tailwind/SCSS), Atkinson font, cafe-themed color palette (orange/brown/beige)
- **Icons:** lucide-astro
- **Images:** Sharp (OG generation), Sanity image CDN via `@sanity/image-url`
- **Rich text:** Portable Text → HTML (`@portabletext/to-html`)
- **Package manager:** pnpm (workspace mode, single package)
- **Node:** 20 (Netlify)
- **Testing:** Playwright (e2e only, chromium, 3 specs)
- **Analytics:** PostHog (EU instance)
- **SEO tools:** IndexNow submission, `@astrojs/sitemap`, `@astrojs/rss`
- **Content pipeline:** Joplin notes → OpenRouter AI metadata extraction → Sanity (script: `joplin-to-sanity.ts`)

## Files Retrieved
1. `package.json` (full) - dependencies, scripts
2. `astro.config.mjs` (full) - site config, integrations (mdx, sitemap)
3. `netlify.toml` (full) - build command, cache headers
4. `tsconfig.json` (full) - strict mode
5. `src/lib/sanity.ts` (full) - Sanity client, GROQ queries, image URL builder
6. `src/lib/sanity-utils.ts` (full) - data fetching layer (getAllBlogPosts, getBlogPostBySlug, getAllLocations, getSiteConfig)
7. `src/types/sanity.ts` (full) - all TypeScript interfaces (SanityCafe, BlogPost, SanityLocation, etc.)
8. `src/consts.ts` (full) - site constants (SITE_TITLE, SITE_URL, etc.)
9. `schema.ts` (full) - Sanity cafe document schema (ratings, atmosphere, working facilities, menu items)
10. `src/pages/index.astro` (full) - homepage
11. `src/pages/[location].astro` (full) - location pages (city-level)
12. `src/pages/cafe/[...slug].astro` (full) - individual cafe review pages
13. `src/pages/cafe/index.astro` (full) - all cafes listing
14. `src/pages/about.astro` (lines 1-30) - static about page
15. `src/pages/contact.astro` (lines 1-30) - Netlify form contact page
16. `src/pages/rss.xml.js` (full) - RSS feed (NOTE: still uses old getCollection, likely broken)
17. `src/layouts/BlogPost.astro` (full) - main review layout with carousel, JSON-LD Review schema
18. `src/layouts/PostHogLayout.astro` (full) - PostHog analytics wrapper
19. `src/components/BaseHead.astro` (full) - SEO meta tags, OG tags, fonts
20. `src/components/Header.astro` (full) - site header with logo
21. `src/components/Footer.astro` (lines 1-30) - footer nav
22. `src/components/ReviewCard.astro` (lines 1-40) - cafe review card component
23. `src/components/RatingsChart.astro` (lines 1-50) - rating bars visualization
24. `src/components/Hero.astro` (lines 1-50) - location hero with image slideshow
25. `src/components/HomeHero.astro` (lines 1-50) - homepage hero with location cards
26. `src/components/LatestReviews.astro` (lines 1-50) - paginated reviews grid with filtering
27. `src/components/CategoryFilter.astro` (lines 1-40) - sort-by-category buttons
28. `src/components/LocationDropdown.astro` (lines 1-40) - location navigation dropdown
29. `src/components/posthog.astro` (full) - PostHog snippet
30. `scripts/generate-og.mjs` (lines 1-30) - OG image generation with Sharp
31. `scripts/joplin-to-sanity.ts` (lines 1-40) - content pipeline: Joplin SQLite → OpenRouter AI → Sanity
32. `scripts/indexnow.mjs` (lines 1-30) - post-deploy IndexNow URL submission
33. `playwright.config.ts` (full) - e2e test config
34. `.env.example` (full) - env vars needed

## Key Code

### Core Types (`src/types/sanity.ts`)
```typescript
interface BlogPost {
  id: string; title: string; slug: string; description: string;
  seoTitle?: string; seoDescription?: string;
  pubDate: Date; updatedDate?: Date; heroImage?: string;
  content: PortableTextBlock[];
  rating?: number; // coffeeCraftsmanship used as primary
  location?: { cityName: string; slug: string };
  // 6 rating categories (1-5 scale):
  veganOptions?: number; glutenFree?: number; workability?: number;
  coffeeCraftsmanship?: number; healthFocus?: number; pastries?: number;
  // + comment string for each rating
  address?: string; phone?: string; website?: string;
  openingHours?: string[]; geo?: { lat: number; lng: number };
  images?: string[];
}

interface SanityCafe { /* raw Sanity doc, transformed to BlogPost */ }
interface SanityLocation { _id; cityName; slug; description; bannerImages; ... }
interface SanitySiteConfig { title; description; socialMedia }
```

### GROQ Queries (`src/lib/sanity.ts`)
- `cafesQuery` — all cafes with location reference expanded, ordered by `_updatedAt desc`
- `cafeQuery` — single cafe by slug (includes comments, contact, geo)
- `locationsQuery` — all locations ordered by cityName
- `siteConfigQuery` — singleton site config

### Data Flow
```
Sanity CMS → GROQ queries → sanity-utils.ts (transform to BlogPost) → Astro pages (SSG)
```
```
Joplin SQLite → joplin-to-sanity.ts (+ OpenRouter AI for metadata) → Sanity CMS
```

### Sanity Schema (`schema.ts`) — Extended Fields NOT Yet Surfaced
Beyond basic ratings, the schema has deep nested objects NOT yet in frontend:
- `atmosphere` — music (volume/genre/distraction), interior, decoration, vibeNotes, staff (friendliness/professionalism/activeness), sizeLayout (indoor/outdoor tables), seating (comfort/types), tables (size/laptopFriendlyHeight), toilets
- `workingFacilities` — wifi (available/speedMbps/captivePortal), plugSockets (availability), laptopPolicy (allowed/notes)
- `menuNotes`, `itemsTried` (name/category/rating/priceEur/notes)
- `visits` (number), `specialty`, `cakesAndPastriesRating`, `drinksRating`

## Architecture

### Page Routes (all static, trailing slash)
| Route | File | Description |
|-------|------|-------------|
| `/` | `src/pages/index.astro` | Homepage — HomeHero + LatestReviews |
| `/{location}/` | `src/pages/[location].astro` | City page — Hero + filtered cafe grid |
| `/cafe/{slug}/` | `src/pages/cafe/[...slug].astro` | Individual review — carousel, ratings, review body, contact |
| `/cafe/` | `src/pages/cafe/index.astro` | All cafes list (basic grid) |
| `/about/` | `src/pages/about.astro` | Static about page (glassmorphism overlay) |
| `/contact/` | `src/pages/contact.astro` | Netlify Forms contact page |
| `/rss.xml` | `src/pages/rss.xml.js` | RSS feed (**BROKEN** — uses old getCollection) |
| `/sitemap/` | `src/pages/sitemap.astro` | HTML sitemap |

### Component Hierarchy
```
PostHogLayout (analytics wrapper)
  BaseHead (meta/SEO)
  Header (logo + nav)
  Page content:
    Homepage: HomeHero → LatestReviews (LocationDropdown + CategoryFilter + ReviewCard grid)
    Location: Hero (banner slideshow) → CategoryFilter → ReviewCard grid
    Cafe detail: BlogPost layout (carousel + RatingsChart + Portable Text + Rating Details + Contact/Map)
  Footer
```

### Build Pipeline
```
prebuild: scripts/generate-og.mjs (Sharp → public/og-default.jpg)
build: astro build (SSG)
post-build (Netlify): scripts/indexnow.mjs (submit URLs to search engines)
```

### Client-Side JS (inline script tags, no bundled framework)
- Image carousel (BlogPost.astro, Hero.astro) — scroll-snap based
- Category filter sorting (CategoryFilter.astro) — DOM reordering by data attributes
- Pagination (LatestReviews.astro) — show/hide by data-page
- Location dropdown navigation (LocationDropdown.astro)

### Styling Conventions
- All CSS scoped per-component via Astro `<style>` blocks
- Global CSS in `src/styles/global.css` — CSS custom properties
- Color palette: `--latte-orange: #F4A261`, `--maple-brown: #E76F51`, `--paper-beige: #F4E1C1`, `--ink-brown: #3B2F2F`
- Accent color: `#ff6b35` (used extensively in components)
- Glassmorphism pattern: `backdrop-filter: blur()` + semi-transparent backgrounds
- Font: Atkinson (self-hosted woff)

### SEO Implementation
- JSON-LD on every page: WebSite (home), CollectionPage + BreadcrumbList (location), Review + CafeOrCoffeeShop + BreadcrumbList (cafe)
- Per-cafe seoTitle/seoDescription overrides from Sanity
- Canonical URLs, OG/Twitter meta tags
- Auto-generated sitemap (@astrojs/sitemap)
- IndexNow push on deploy

### Environment Variables
```
SANITY_PROJECT_ID=d63wzggl (hardcoded fallback)
SANITY_DATASET=production
SANITY_API_VERSION=2024-09-18
SANITY_API_TOKEN=<write token for scripts>
OPENROUTER_API_KEY=<for joplin-to-sanity metadata extraction>
GOOGLE_MAPS_API_KEY=<for embedded maps on cafe pages>
INDEXNOW_KEY=<for search engine notification>
```

### Testing
- Playwright e2e only (no unit tests)
- 3 specs: `carousel.spec.ts`, `dots.spec.ts`, `interact.spec.ts`
- Runs against local preview server (port 4321)
- `pnpm run test:e2e`

## Known Issues / Tech Debt
1. **`rss.xml.js` is broken** — still uses `getCollection('blog')` but all content moved to Sanity. Should use `getAllBlogPosts()`.
2. **Schema/frontend mismatch** — Sanity schema has rich `atmosphere`, `workingFacilities`, `itemsTried`, `menuNotes` fields NOT fetched in GROQ queries and NOT rendered.
3. **`cakesAndPastriesRating` and `drinksRating`** exist in schema but not in types or queries.
4. **Phone field duplication** — schema has `phoneNumber`, legacy code reads `phone`. Handled with fallback in sanity-utils.ts.
5. **Content collections unused** — `src/content/blog/` has 5 sample markdown posts, `content.config.ts` exports empty collections.
6. **`console.log` in production** — `LocationDropdown.astro` logs fetched locations.

## Start Here
Open `src/lib/sanity-utils.ts` first — data gateway. All pages depend on it. Shows how Sanity data transforms into the BlogPost type that drives every component. Then `src/types/sanity.ts` for full type surface, and `schema.ts` for what CMS actually stores (much richer than what's fetched/rendered).
