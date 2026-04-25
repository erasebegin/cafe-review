// Submit sitemap URLs to IndexNow (Bing, Yandex, Seznam, etc.) after build.
//
// IndexNow lets the site push notifications about updated URLs instead of
// waiting for crawlers to discover them. One implementation, used by all
// participating engines.  https://www.indexnow.org/
//
// Usage:
//   - Set the env var `INDEXNOW_KEY` to a 32-char hex/UUID-like string.
//   - Place a file at `public/<INDEXNOW_KEY>.txt` containing the same value
//     (the engines verify the key by fetching it from the site root).
//   - This script runs as a Netlify post-processing step (see `netlify.toml`).
//
// Failure modes are non-fatal: the build will succeed even if IndexNow can't
// be reached.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const HOST = 'cafereview.eu';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const SITEMAP = resolve(repoRoot, 'dist/sitemap-0.xml');
const MAX_URLS = 10000; // IndexNow per-request cap.

async function main() {
	const key = process.env.INDEXNOW_KEY;
	if (!key) {
		console.warn('[indexnow] INDEXNOW_KEY not set; skipping submission.');
		return;
	}
	if (!existsSync(SITEMAP)) {
		console.warn(`[indexnow] Sitemap not found at ${SITEMAP}; skipping.`);
		return;
	}

	const xml = await readFile(SITEMAP, 'utf8');
	const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
		.map((m) => m[1].trim())
		.filter(Boolean)
		.slice(0, MAX_URLS);

	if (urls.length === 0) {
		console.warn('[indexnow] No URLs in sitemap; nothing to submit.');
		return;
	}

	const body = {
		host: HOST,
		key,
		keyLocation: `https://${HOST}/${key}.txt`,
		urlList: urls,
	};

	try {
		const res = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify(body),
		});
		console.log(`[indexnow] Submitted ${urls.length} URLs \u2192 ${res.status} ${res.statusText}`);
		if (!res.ok) {
			const text = await res.text();
			console.warn('[indexnow] Response body:', text.slice(0, 500));
		}
	} catch (err) {
		console.warn('[indexnow] Submission failed:', err);
	}
}

main();
