/**
 * scrape-contact.ts — Reusable cafe contact information scraper.
 *
 * Uses Brave Search API (free tier: 2,000 queries/month) to find a cafe's
 * online presence, then scrapes the website for phone numbers, email addresses,
 * and social media links.
 *
 * Usage as a module:
 *   import { scrapeCafeContact } from './scrape-contact.js'
 *   const info = await scrapeCafeContact({ name: 'Cafe Zimmer 3', city: 'Berlin' })
 *
 * Usage as a CLI:
 *   tsx scripts/scrape-contact.ts --name "Cafe Zimmer 3" --city "Berlin"
 */

import * as cheerio from "cheerio";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScrapeInput {
  name: string;
  city?: string;
  address?: string;
}

export interface CafeContactInfo {
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
  /** Raw search snippet / source hints for manual verification. */
  sources: ContactSource[];
}

export interface ContactSource {
  type: "search_snippet" | "website_scrape" | "social_link";
  label: string;
  url?: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

/** Delay between API calls to stay within rate limits. */
const SEARCH_DELAY_MS = 1500;
/** Max pages to scrape per cafe (homepage + contact page). */
const MAX_PAGES_TO_SCRAPE = 3;
/** Request timeout for page fetches. */
const FETCH_TIMEOUT_MS = 10_000;
/** Max HTML size to download (5 MB). */
const MAX_HTML_SIZE = 5 * 1024 * 1024;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function log(verbose: boolean, ...args: any[]) {
  if (verbose) console.log(...args);
}

// ─── Brave Search ────────────────────────────────────────────────────────────

interface BraveResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      age?: string;
    }>;
  };
}

async function braveSearch(
  query: string,
  count: number = 10,
  verbose: boolean = false,
): Promise<BraveResult[]> {
  if (!BRAVE_API_KEY) {
    throw new Error("BRAVE_API_KEY environment variable is not set");
  }

  const url = `${BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}&count=${count}&search_lang=en`;

  log(verbose, `  🔍 Searching Brave: "${query.slice(0, 80)}"`);

  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": BRAVE_API_KEY,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Brave Search returned ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as BraveSearchResponse;
  const results = (data.web?.results ?? [])
    .map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      description: r.description ?? "",
      age: r.age,
    }))
    .filter((r) => r.url);

  log(verbose, `    → ${results.length} results`);
  return results;
}

// ─── Phone / Email / Social Regex Extraction ─────────────────────────────────

const PHONE_REGEX_G =
  /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g;

const EMAIL_REGEX_G = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SOCIAL_DOMAINS: Record<string, string> = {
  "instagram.com": "instagram",
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "twitter.com": "twitter",
  "x.com": "twitter",
};

function extractPhoneFromText(text: string): string | undefined {
  const matches = text.match(PHONE_REGEX_G);
  if (!matches) return undefined;

  // Filter to plausible phone numbers
  const plausible = matches.filter((m) => {
    const digits = m.replace(/\D/g, "");
    // Must have 7-15 actual digits
    if (digits.length < 7 || digits.length > 15) return false;
    // Reject dates: YYYY-MM-DD, DD.MM.YYYY, etc.
    if (/\b(19|20)\d{2}[\s.\-]\d{1,2}[\s.\-]\d{1,2}\b/.test(m)) return false;
    if (/\b\d{1,2}[\s.]\d{1,2}[\s.]\d{4}\b/.test(m)) return false;
    // Reject year ranges: 2009-2026
    if (/^\s*(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}\s*$/.test(m)) return false;
    // Reject postal codes: 5-digit numbers that match German postal code format
    // without country code prefix (like "114 12167")
    const hasCountryCode = /^\+\d{1,3}/.test(m) || /^00\d{1,3}/.test(m);
    if (!hasCountryCode && /^\d{3,5}\s+\d{4,5}$/.test(m.trim())) return false;
    return true;
  });

  if (plausible.length === 0) return undefined;

  // Prefer numbers that look like German or European format
  const german = plausible.find((m) => m.startsWith("+49") || m.startsWith("0049"));
  return german || plausible[0];
}

function extractEmailFromText(text: string): string | undefined {
  const matches = text.match(EMAIL_REGEX_G);
  if (!matches) return undefined;

  // Filter out common false positives
  const filtered = matches.filter((m) => {
    const lower = m.toLowerCase();
    return (
      !lower.includes("example") &&
      !lower.includes("test@") &&
      !lower.includes("noreply") &&
      !lower.includes("@yourdomain") &&
      !lower.includes("@example")
    );
  });

  return filtered[0];
}

function extractSocialFromUrl(url: string): { platform: string; handle: string } | undefined {
  const lower = url.toLowerCase();
  for (const [domain, platform] of Object.entries(SOCIAL_DOMAINS)) {
    if (lower.includes(domain)) {
      // Extract handle from URL path
      try {
        const parsed = new URL(lower.startsWith("http") ? lower : `https://${lower}`);
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length > 0) {
          // Filter out common non-handle path segments and generic words
          const skipWords = new Set([
            "p", "reel", "share", "stories", "posts", "photos", "videos",
            "profile.php", "people", "pages", "groups", "hashtag",
            "popular", "explore", "about", "faq", "help", "privacy",
            "terms", "legal", "api", "blog", "press", "jobs",
            "accounts", "developer", "business", "shopping", "directory",
          ]);
          const handle = parts.find((p) => !skipWords.has(p) && p.length > 1);
          if (handle) return { platform, handle };
        }
      } catch {
        // Not a valid URL, try to extract handle from raw text
      }
      return { platform, handle: url };
    }
  }
  return undefined;
}

// ─── Website Scraper ─────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CafeReviewBot/1.0; +https://cafereview.eu)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) return null;

    // Check content type
    const contentType = resp.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    // Limit response size
    const reader = resp.body?.getReader();
    if (!reader) return null;

    let totalBytes = 0;
    const decoder = new TextDecoder();
    let html = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      if (totalBytes > MAX_HTML_SIZE) {
        reader.cancel();
        break;
      }
      html += decoder.decode(value, { stream: true });
    }

    return html;
  } catch {
    return null;
  }
}

interface ScrapedPage {
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  contactPageUrl?: string;
}

function scrapePage(html: string, baseUrl: string): ScrapedPage {
  const $ = cheerio.load(html);
  const result: ScrapedPage = {};

  // 1. Extract from tel: links
  const telLinks = $('a[href^="tel:"]')
    .map((_, el) => $(el).attr("href")?.replace(/^tel:\/?/, ""))
    .get()
    .filter(Boolean);
  for (const t of telLinks) {
    const cleaned = t.replace(/[\s-]/g, "");
    if (cleaned.length >= 7) {
      result.phone = t;
      break;
    }
  }

  // 2. Extract from mailto: links
  const mailtoLinks = $('a[href^="mailto:"]')
    .map((_, el) => $(el).attr("href")?.replace(/^mailto:/, "").split("?")[0])
    .get()
    .filter(Boolean);
  for (const m of mailtoLinks) {
    if (m.includes("@") && !m.includes("example")) {
      result.email = m;
      break;
    }
  }

  // 3. Extract social media links
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const social = extractSocialFromUrl(href);
    if (!social) return;
    if (social.platform === "instagram" && !result.instagram) {
      result.instagram = `https://instagram.com/${social.handle}`;
    }
    if (social.platform === "facebook" && !result.facebook) {
      result.facebook = href;
    }
  });

  // 4. Find contact page link
  $("a[href]").each((_, el) => {
    if (result.contactPageUrl) return; // already found
    const href = $(el).attr("href");
    const text = $(el).text().toLowerCase();
    if (!href) return;
    const linkText = text.trim();
    if (
      linkText === "contact" ||
      linkText === "kontakt" ||
      linkText === "contact us" ||
      linkText === "get in touch" ||
      linkText === "impressum" ||
      linkText.includes("contact") ||
      linkText.includes("kontakt") ||
      linkText.includes("impressum")
    ) {
      try {
        result.contactPageUrl = new URL(href, baseUrl).href;
      } catch {
        // Invalid URL, skip
      }
    }
  });

  // 5. Fallback: full-text regex extraction for phone/email
  // Remove script/style content
  $("script, style, noscript").remove();
  const bodyText = $("body").text();

  if (!result.phone) {
    result.phone = extractPhoneFromText(bodyText);
  }
  if (!result.email) {
    result.email = extractEmailFromText(bodyText);
  }

  return result;
}

// ─── Search result text extraction ───────────────────────────────────────────

function extractFromSearchResults(results: BraveResult[]): {
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
} {
  const out: {
    phone?: string;
    email?: string;
    website?: string;
    instagram?: string;
    facebook?: string;
  } = {};

  for (const result of results) {
    const combined = `${result.title} ${result.description}`;

    // Phone
    if (!out.phone) {
      out.phone = extractPhoneFromText(combined);
    }

    // Email
    if (!out.email) {
      out.email = extractEmailFromText(combined);
    }

    // Social media from URLs
    const social = extractSocialFromUrl(result.url);
    if (social) {
      if (social.platform === "instagram" && !out.instagram) {
        out.instagram = `https://instagram.com/${social.handle}`;
      }
      if (social.platform === "facebook" && !out.facebook) {
        out.facebook = result.url;
      }
    }

    // Likely website (filter out known aggregators and social media)
    if (!out.website) {
      const url = result.url.toLowerCase();
      const skipDomains = [
        "google.com", "yelp.com", "tripadvisor", "foursquare",
        "instagram.com", "facebook.com", "twitter.com", "x.com",
        "youtube.com", "pinterest.com", "tiktok.com",
        "linkedin.com", "maps.google", "restaurantguru",
        "deliveroo", "ubereats", "lieferando", "wolt",
      ];
      const isPlatform = skipDomains.some((d) => url.includes(d));
      if (!isPlatform && result.url.startsWith("http")) {
        out.website = result.url;
      }
    }
  }

  return out;
}

// ─── Main scraper function ───────────────────────────────────────────────────

export async function scrapeCafeContact(
  input: ScrapeInput,
  opts: { verbose?: boolean } = {},
): Promise<CafeContactInfo> {
  const verbose = opts.verbose ?? false;
  const sources: ContactSource[] = [];

  console.log(`🕵️  Scraping contact info for "${input.name}"${input.city ? ` (${input.city})` : ""}`);

  if (!BRAVE_API_KEY) {
    console.warn("⚠️  BRAVE_API_KEY is not set. Skipping search.");
    return { sources: [] };
  }

  // ── Phase 1: Search for the cafe ──────────────────────────────────────────

  const locationHint = input.address
    ? input.address.split(",").slice(0, 2).join(",")
    : input.city ?? "";

  // Query 1: General search
  const generalQuery = `"${input.name}" ${locationHint}`;
  let generalResults: BraveResult[] = [];
  try {
    generalResults = await braveSearch(generalQuery, 8, verbose);
    await delay(SEARCH_DELAY_MS);
  } catch (err) {
    console.warn(`  ⚠️  Search failed: ${err}`);
  }

  // Query 2: Instagram
  const instaQuery = `"${input.name}" ${locationHint} instagram`;
  let instaResults: BraveResult[] = [];
  try {
    instaResults = await braveSearch(instaQuery, 5, verbose);
    await delay(SEARCH_DELAY_MS);
  } catch (err) {
    log(verbose, `  ⚠️  Instagram search failed: ${err}`);
  }

  // Query 3: Facebook
  const fbQuery = `"${input.name}" ${locationHint} facebook`;
  let fbResults: BraveResult[] = [];
  try {
    fbResults = await braveSearch(fbQuery, 5, verbose);
    await delay(SEARCH_DELAY_MS);
  } catch (err) {
    log(verbose, `  ⚠️  Facebook search failed: ${err}`);
  }

  const allResults = [...generalResults, ...instaResults, ...fbResults];

  // Extract from search snippets
  const searchExtracted = extractFromSearchResults(allResults);

  if (searchExtracted.phone) {
    sources.push({ type: "search_snippet", label: "Phone from search", url: "" });
  }
  if (searchExtracted.email) {
    sources.push({ type: "search_snippet", label: "Email from search", url: "" });
  }
  if (searchExtracted.instagram) {
    sources.push({ type: "search_snippet", label: "Instagram from search", url: searchExtracted.instagram });
  }
  if (searchExtracted.facebook) {
    sources.push({ type: "search_snippet", label: "Facebook from search", url: searchExtracted.facebook });
  }

  // ── Phase 2: Scrape the website ────────────────────────────────────────────

  let websiteScraped: ScrapedPage = {};
  const websiteUrl = searchExtracted.website;

  if (websiteUrl) {
    log(verbose, `  🌐 Scraping website: ${websiteUrl}`);

    // Scrape homepage
    const homeHtml = await fetchPage(websiteUrl);
    if (homeHtml) {
      websiteScraped = scrapePage(homeHtml, websiteUrl);
      log(verbose, `    Homepage: phone=${websiteScraped.phone || "none"}, email=${websiteScraped.email || "none"}, instagram=${websiteScraped.instagram || "none"}, facebook=${websiteScraped.facebook || "none"}`);

      if (websiteScraped.phone) {
        sources.push({ type: "website_scrape", label: "Phone from website", url: websiteUrl });
      }
      if (websiteScraped.email) {
        sources.push({ type: "website_scrape", label: "Email from website", url: websiteUrl });
      }
      if (websiteScraped.instagram) {
        sources.push({ type: "website_scrape", label: "Instagram from website", url: websiteUrl });
      }
      if (websiteScraped.facebook) {
        sources.push({ type: "website_scrape", label: "Facebook from website", url: websiteUrl });
      }

      // If there's a contact page, scrape it too
      if (websiteScraped.contactPageUrl) {
        log(verbose, `    → Scraping contact page: ${websiteScraped.contactPageUrl}`);
        const contactHtml = await fetchPage(websiteScraped.contactPageUrl);
        if (contactHtml) {
          const contactScraped = scrapePage(contactHtml, websiteScraped.contactPageUrl);

          // Merge (contact page data takes priority for phone/email)
          if (contactScraped.phone) {
            websiteScraped.phone = contactScraped.phone;
            sources.push({ type: "website_scrape", label: "Phone from contact page", url: websiteScraped.contactPageUrl });
          }
          if (contactScraped.email) {
            websiteScraped.email = contactScraped.email;
            sources.push({ type: "website_scrape", label: "Email from contact page", url: websiteScraped.contactPageUrl });
          }
          if (contactScraped.instagram && !websiteScraped.instagram) {
            websiteScraped.instagram = contactScraped.instagram;
          }
          if (contactScraped.facebook && !websiteScraped.facebook) {
            websiteScraped.facebook = contactScraped.facebook;
          }
        }
      }
    }
  }

  // ── Merge results ──────────────────────────────────────────────────────────

  const result: CafeContactInfo = {
    phone: websiteScraped.phone || searchExtracted.phone,
    email: websiteScraped.email || searchExtracted.email,
    instagram: websiteScraped.instagram || searchExtracted.instagram,
    facebook: websiteScraped.facebook || searchExtracted.facebook,
    website: websiteUrl,
    sources,
  };

  // ── Clean up social media URLs ────────────────────────────────────────────
  if (result.instagram) {
    result.instagram = normalizeInstagramUrl(result.instagram);
  }
  if (result.facebook) {
    result.facebook = normalizeFacebookUrl(result.facebook);
  }

  console.log(
    `  ✅ Found: phone=${result.phone ?? "❌"}, email=${result.email ?? "❌"}, ` +
    `instagram=${result.instagram ? "✅" : "❌"}, facebook=${result.facebook ? "✅" : "❌"}, ` +
    `website=${result.website ? "✅" : "❌"}`,
  );

  return result;
}

function normalizeInstagramUrl(url: string): string {
  // Extract handle and return clean URL
  const match = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
  if (match) {
    return `https://instagram.com/${match[1]}`;
  }
  // If it's just a handle
  if (/^[a-zA-Z0-9_.]+$/.test(url.replace(/^@/, ""))) {
    return `https://instagram.com/${url.replace(/^@/, "")}`;
  }
  return url;
}

function normalizeFacebookUrl(url: string): string {
  // Ensure it's a full URL
  if (!url.startsWith("http")) {
    return `https://facebook.com/${url.replace(/^@/, "")}`;
  }
  return url;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const nameIdx = args.indexOf("--name");
  const cityIdx = args.indexOf("--city");
  const addressIdx = args.indexOf("--address");
  const verbose = args.includes("--verbose");

  const name = nameIdx >= 0 ? args[nameIdx + 1] : undefined;
  const city = cityIdx >= 0 ? args[cityIdx + 1] : undefined;
  const address = addressIdx >= 0 ? args[addressIdx + 1] : undefined;

  if (!name) {
    console.error("Usage: tsx scripts/scrape-contact.ts --name <cafe-name> [--city <city>] [--address <address>] [--verbose]");
    process.exit(1);
  }

  const result = await scrapeCafeContact({ name, city, address }, { verbose });
  console.log("\n📋 Final result:");
  console.log(JSON.stringify(result, null, 2));
}

// Only run CLI if called directly (not imported as module)
const isDirectCall = process.argv[1]?.includes("scrape-contact");
if (isDirectCall) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
