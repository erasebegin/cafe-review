# AGENT.md — AI Coding Agent Context

## Project Overview

**Name**: Cafe Review (`cafereview.eu`)  
**Purpose**: Static cafe review site covering European cities. Rates cafes on vegan options, gluten-free, workability, coffee craftsmanship, health focus, and pastries (1–5 scale).  
**Architecture**: Headless CMS (Sanity) → Static Site Generator (Astro) → CDN (Netlify)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro 5.18 (SSG only, no SSR) |
| Language | TypeScript (strict) |
| CMS | Sanity.io (project `d63wzggl`, dataset `production`) |
| Styling | Vanilla CSS with CSS custom properties + component-scoped `<style>` |
| Icons | `lucide-astro` |
| Images | `sharp` (OG gen), `@sanity/image-url` |
| Rich Text | `@portabletext/to-html` |
| Analytics | PostHog (via layout wrapper) |
| Deploy | Netlify (Node 20, pnpm) |
| Testing | Playwright (E2E, Chromium only) |
| Package Manager | pnpm |

---

## Directory Structure

```
cafe-review/
├── src/
│   ├── components/       # Astro components (Header, ReviewCard, HomeHero, etc.)
│   ├── layouts/          # Page layouts (BlogPost.astro, PostHogLayout.astro)
│   ├── lib/              # Data layer
│   │   ├── sanity.ts         # Sanity client + GROQ queries + image URL helper
│   │   └── sanity-utils.ts   # Data-fetching functions, SanityCafe→BlogPost transform
│   ├── pages/            # File-based routing (see Routes below)
│   ├── styles/           # global.css (CSS custom properties, brand palette)
│   ├── types/            # TypeScript interfaces (sanity.ts)
│   ├── consts.ts         # Brand constants, fallback SEO values
│   └── content.config.ts # Empty stub (content comes from Sanity, not file collections)
├── scripts/
│   ├── generate-og.mjs       # OG image generation (Sharp)
│   ├── indexnow.mjs          # Post-deploy URL submission to search engines
│   ├── joplin-to-sanity.ts   # Joplin note sync → Sanity (uses OpenRouter AI)
│   └── list-cafes-no-location.ts  # Utility script
├── e2e/                  # Playwright E2E tests
├── public/               # Static assets (fonts, images, robots.txt)
├── schema.ts             # Sanity studio schema definition (cafe document type)
├── astro.config.mjs      # Astro config (sitemap, mdx integrations)
├── netlify.toml          # Deploy config + caching headers
├── playwright.config.ts  # E2E test config
└── tsconfig.json         # Strict TypeScript
```

---

## Architecture & Data Flow

```
Sanity CMS (headless, CDN-cached)
    │
    ▼  GROQ queries at build time
src/lib/sanity.ts ──► src/lib/sanity-utils.ts
    │                       │
    │   transforms SanityCafe → BlogPost
    │                       │
    ▼                       ▼
src/pages/              src/components/
```

**All data is fetched at build time**. No SSR, no client-side data fetching. The site is fully static (SSG).

**Content pipeline**: Joplin notes → `scripts/joplin-to-sanity.ts` (with OpenRouter AI for metadata) → Sanity CMS → `pnpm build` → Netlify deploy → IndexNow submission.

---

## Key Files (Start Here)

1. **`src/lib/sanity-utils.ts`** — Data layer; transforms Sanity content into `BlogPost` type consumed by every page. Understand this first.
2. **`src/types/sanity.ts`** — All TypeScript interfaces (`SanityCafe`, `BlogPost`, `SanityLocation`, `SanitySiteConfig`).
3. **`src/pages/cafe/[...slug].astro`** — Main review page template (SSG via `getStaticPaths`).
4. **`src/lib/sanity.ts`** — Sanity client config, GROQ query strings, image URL builder.
5. **`schema.ts`** — Sanity document schema (defines all available fields).
6. **`src/layouts/BlogPost.astro`** — Review layout with image carousel, JSON-LD, breadcrumbs.
7. **`src/components/BaseHead.astro`** — SEO meta tags, OG tags, font preloads.

---

## Routes

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/pages/index.astro` | Homepage with hero + reviews grid |
| `/cafe/` | `src/pages/cafe/index.astro` | All cafes listing |
| `/cafe/{slug}/` | `src/pages/cafe/[...slug].astro` | Individual review (SSG) |
| `/{location}/` | `src/pages/[location].astro` | Location-filtered listing (SSG) |
| `/about/` | `src/pages/about.astro` | Static about page |
| `/contact/` | `src/pages/contact.astro` | Static contact page |
| `/rss.xml` | `src/pages/rss.xml.js` | RSS feed (**⚠️ BROKEN** — uses `getCollection('blog')` but content is in Sanity) |
| `/sitemap/` | `src/pages/sitemap.astro` | HTML sitemap |

**Trailing slashes enforced** (`trailingSlash: 'always'` in `astro.config.mjs`).

---

## Key Types

```typescript
// src/types/sanity.ts
interface BlogPost {
  id, title, slug, description, seoTitle?, seoDescription?
  pubDate, updatedDate?, heroImage?, content: PortableTextBlock[]
  rating?, location?: { cityName, slug }
  veganOptions?, glutenFree?, workability?, coffeeCraftsmanship?, healthFocus?, pastries? // 1-5
  veganComment?, glutenFreeComment?, workabilityComment?, coffeeCraftsmanshipComment?, healthFocusComment?, croissantComment?
  address?, phone?, website?, openingHours?, geo?: { lat, lng }
  images?: string[]
}

interface SanityLocation { _id, cityName, slug, description?, bannerImages?, mobileBannerImages?, featuredImages? }
interface SanitySiteConfig { title, description, socialMedia? }
```

---

## Build / Run / Test Commands

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Production build (runs prebuild OG gen → astro build)
pnpm build

# Preview production build locally
pnpm preview

# Run E2E tests (builds + previews first)
pnpm test:e2e

# Generate OG image manually
pnpm generate:og

# Sync Joplin notes to Sanity
pnpm sync-joplin
```

**Netlify build command**: `pnpm run build && node scripts/indexnow.mjs`

---

## Environment Variables

```bash
# Required for build
SANITY_PROJECT_ID=d63wzggl        # hardcoded fallback exists
SANITY_DATASET=production          # hardcoded fallback exists
SANITY_API_VERSION=2024-09-18

# Optional
SANITY_API_TOKEN=                  # for authenticated Sanity requests
GOOGLE_MAPS_API_KEY=               # for embedded maps on cafe pages
INDEXNOW_KEY=                      # for post-deploy URL submission
OPENROUTER_API_KEY=                # for joplin-to-sanity AI metadata extraction
```

---

## Design System / CSS

- **Brand colors**: `--latte-orange: #F4A261`, `--maple-brown: #E76F51`, `--butter-yellow: #F6C971`, `--clay-pink: #E9AFAF`, `--paper-beige: #F4E1C1`, `--ink-brown: #3B2F2F`, `--sky-blue: #A7C7C7`
- **Accent**: `#ff6b35` (theme-color)
- **Fonts**: Atkinson (regular + bold, self-hosted WOFF in `/public/`)
- **Approach**: CSS custom properties in `src/styles/global.css`, component-scoped `<style>` blocks
- **Effects**: Glassmorphism overlays (backdrop-filter blur)

---

## Coding Conventions

- **Components**: Astro `.astro` files with TypeScript frontmatter and scoped `<style>`
- **No client-side JS frameworks** (no React/Vue/Svelte) — pure Astro components
- **Data fetching**: Always in page/layout frontmatter via `sanity-utils.ts` functions
- **Type safety**: Strict TypeScript; all Sanity data typed through `src/types/sanity.ts`
- **Image handling**: `@sanity/image-url` for Sanity-hosted images; `sharp` for build-time OG generation
- **SEO**: JSON-LD structured data on all pages, OG/Twitter meta via `BaseHead.astro`
- **Module type**: ESM (`"type": "module"` in package.json)

---

## SEO Implementation

- **JSON-LD**: WebSite (homepage), Review + CafeOrCoffeeShop (cafe pages), BreadcrumbList (all pages), CollectionPage (location pages)
- **Open Graph + Twitter Cards**: via `BaseHead.astro`
- **Canonical URLs**: auto-generated from `Astro.url`
- **Sitemap**: `@astrojs/sitemap` (XML) + custom HTML sitemap page
- **SEO title patterns**: `{CafeName} — {City} Cafe Review` | `Best Cafes in {City} – Vegan, Gluten-Free, Workable | Cafe Review`

---

## CMS SSH Extension

This project includes a pi extension for SSH access to the remote Sanity Studio server.

| Item | Value |
|------|-------|
| Extension | `.pi/extensions/cms-ssh/index.ts` |
| Server | `chris@95.179.242.245` (hostname: vultr) |
| SSH Key | `~/.ssh/thinkdrops-private` |
| Remote Project | `/home/chris/cafe-review` |
| Schema Dir | `schemaTypes/` (cafe.ts, location.ts, siteConfig.ts, seo.ts, socialMedia.ts, index.ts) |
| Config | `sanity.config.ts` |

**Tools:**
- `cms_schema` — Read remote schema files. Default: cafe.ts. Use `file='list'` to see available files.
- `cms_schema_edit` — Write changes to remote schema files (auto-backup before write).
- `cms_ssh` — Execute scoped shell commands on the remote server from `$REMOTE_PROJECT`.

**Commands:**
- `/cms-schema <file>` — Check a schema file from TUI (widget preview).
- `/cms-ssh <cmd>` — Run a command on the remote CMS server.

**Safety:**
- All paths validated — only `/home/chris/cafe-review` accessible.
- Protected: Joplin dirs, Shadowsocks, PM2, system files, strapi backups.
- Destructive patterns (rm -rf, systemctl, reboot) blocked in cms_ssh.
- cms_schema_edit creates `.pi-backup-{timestamp}` before writing.
- After schema edits: run `sanity deploy` on the server to activate.

## Known Issues & Quirks

1. **RSS feed broken**: `src/pages/rss.xml.js` uses `getCollection('blog')` but content collections are empty — all content from Sanity now.
2. **Phone field dual-read**: `sanity-utils.ts` reads both `cafe.phone` and `cafe.phoneNumber` for backward compatibility.
3. **No unit tests**: only E2E via Playwright.
4. **Content collections stub**: `src/content.config.ts` exports empty `collections = {}` — legacy.
5. **Schema > UI**: Sanity schema has more fields (atmosphere, workingFacilities, itemsTried, menuNotes) than the frontend currently renders.
6. **Rest params on cafe slug**: `cafe/[...slug]` matches any depth, though slugs are flat in practice.
7. **Sanity CDN enabled**: `useCdn: true` — responses cached at Sanity edge; may need cache-busting for fresh content during development.

---

## Sanity Schema Highlights

The `cafe` document type (defined in `schema.ts`) includes field groups:
- **Basic**: title, slug, description, seoTitle, seoDescription, reviewBody (Portable Text)
- **Ratings** (1–5 + comment): vegan, glutenFree, workability, coffeeCraftsmanship, healthFocus, croissant, cakesAndPastries, drinks
- **Atmosphere**: music, interior, decoration, vibeNotes, staff, sizeLayout, seating, tables, toilets
- **Working Facilities**: wifi (available/speed/captivePortal), plugSockets, laptopPolicy
- **Menu**: menuNotes, itemsTried (array of {name, category, rating/10, priceEur, notes})
- **Multi-selects**: vibe (55 options), food, drinks, facilities
- **Contact**: geoLocation (geopoint), address, phoneNumber, email, instagram, facebook
- **Images**: featuredImage, gallery
