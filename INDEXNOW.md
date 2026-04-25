# IndexNow setup

[IndexNow](https://www.indexnow.org/) is a free protocol for pushing
URL-update notifications to Bing, Yandex, Seznam, Naver and others — useful
for getting newly published cafe reviews indexed quickly. Google does not
participate but our `@astrojs/sitemap` output already covers Google.

## One-time setup

1. Generate a key (any 8–128 char alphanumeric or UUID-like string). Example
   on macOS:
   ```bash path=null start=null
   uuidgen | tr -d '-' | tr '[:upper:]' '[:lower:]'
   ```
2. In Netlify → Site settings → Environment variables, add
   `INDEXNOW_KEY = <the key>`.
3. Create a verification file at `public/<KEY>.txt` containing exactly that
   key as plain text. The file must be served at
   `https://cafereview.eu/<KEY>.txt` after deploy.
4. Commit and deploy. The build command (`netlify.toml`) runs
   `scripts/indexnow.mjs` after Astro builds; it parses
   `dist/sitemap-0.xml` and POSTs the URL list to
   `https://api.indexnow.org/IndexNow`.

If `INDEXNOW_KEY` is missing, the script logs a warning and exits cleanly —
builds will not fail.

## Verifying

After the first successful deploy:

- `curl -I https://cafereview.eu/<KEY>.txt` → `HTTP/2 200`.
- Check Netlify build logs for `[indexnow] Submitted N URLs → 200 OK`
  (or `202 Accepted`).
- Check Bing Webmaster Tools → IndexNow → it lists the most recent
  submission.
