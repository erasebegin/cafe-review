/**
 * Sitemap metadata builder.
 *
 * Called from astro.config.mjs via the @astrojs/sitemap `serialize` callback
 * to inject per-page `lastmod`, `priority`, and `changefreq`.
 *
 * All data comes from Sanity at build time. The Promise is resolved once
 * and each serialize call awaits the cached result.
 */

import { client } from './sanity';

// Minimal GROQ queries — only fields needed for sitemap metadata.
const cafesForSitemap = `*[_type == "cafe"] {
  "slug": slug.current,
  _updatedAt,
  _createdAt,
  location->{ "slug": slug.current }
}`;

const locationsForSitemap = `*[_type == "location"] {
  "slug": slug.current,
  _updatedAt,
  _createdAt
}`;

export interface SitemapEntryMeta {
  lastmod: Date;
  priority: number;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

interface CafeSitemapData {
  slug: string;
  _updatedAt: string;
  _createdAt: string;
  location: { slug: string } | null;
}

interface LocationSitemapData {
  slug: string;
  _updatedAt: string;
  _createdAt: string;
}

/** Fetch once, cache forever (per build). */
let cachedMetaPromise: Promise<Map<string, SitemapEntryMeta>> | null = null;

export function getSitemapMeta(): Promise<Map<string, SitemapEntryMeta>> {
  if (cachedMetaPromise) return cachedMetaPromise;

  cachedMetaPromise = buildSitemapMeta();
  return cachedMetaPromise;
}

async function buildSitemapMeta(): Promise<Map<string, SitemapEntryMeta>> {
  const [cafes, locations] = await Promise.all([
    client.fetch<CafeSitemapData[]>(cafesForSitemap),
    client.fetch<LocationSitemapData[]>(locationsForSitemap),
  ]);

  const map = new Map<string, SitemapEntryMeta>();

  // Latest update across all content (used for homepage and index pages).
  const allTimes = [
    ...cafes.map((c) => new Date(c._updatedAt || c._createdAt).getTime()),
    ...locations.map((l) => new Date(l._updatedAt || l._createdAt).getTime()),
  ];
  const latestUpdate = allTimes.length > 0
    ? new Date(Math.max(...allTimes))
    : new Date();

  // per-cafe lastmod lookup
  const cafeLastmod = new Map<string, Date>();
  for (const cafe of cafes) {
    cafeLastmod.set(cafe.slug, new Date(cafe._updatedAt || cafe._createdAt));
  }

  // per-location lastmod = max(lastmod) of all cafes in that location
  const locationLastmod = new Map<string, Date>();
  for (const cafe of cafes) {
    if (cafe.location?.slug) {
      const locSlug = cafe.location.slug;
      const date = new Date(cafe._updatedAt || cafe._createdAt);
      if (!locationLastmod.has(locSlug) || date > locationLastmod.get(locSlug)!) {
        locationLastmod.set(locSlug, date);
      }
    }
  }
  // Also include locations that have no cafes yet
  for (const loc of locations) {
    if (!locationLastmod.has(loc.slug)) {
      locationLastmod.set(loc.slug, new Date(loc._updatedAt || loc._createdAt));
    }
  }

  // ── Homepage ──
  map.set('/', {
    lastmod: latestUpdate,
    priority: 1.0,
    changefreq: 'daily',
  });

  // ── Static pages ──
  for (const path of ['/about/', '/contact/']) {
    map.set(path, {
      lastmod: latestUpdate,
      priority: 0.5,
      changefreq: 'monthly',
    });
  }

  // ── All cafes listing ──
  map.set('/cafe/', {
    lastmod: latestUpdate,
    priority: 0.7,
    changefreq: 'daily',
  });

  // ── HTML sitemap ──
  map.set('/sitemap/', {
    lastmod: latestUpdate,
    priority: 0.3,
    changefreq: 'weekly',
  });

  // ── Location pages ──
  for (const loc of locations) {
    map.set(`/${loc.slug}/`, {
      lastmod: locationLastmod.get(loc.slug) || new Date(),
      priority: 0.8,
      changefreq: 'daily',
    });
  }

  // ── Individual cafe pages ──
  for (const cafe of cafes) {
    map.set(`/cafe/${cafe.slug}/`, {
      lastmod: new Date(cafe._updatedAt || cafe._createdAt),
      priority: 0.6,
      changefreq: 'weekly',
    });
  }

  return map;
}
