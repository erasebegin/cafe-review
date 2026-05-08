// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { getSitemapMeta } from './src/lib/sitemap-data.ts';

const SITE_URL = 'https://cafereview.eu';

// Pre-fetch once — the serialize callback awaits this shared promise.
const sitemapMetaPromise = getSitemapMeta();

// https://astro.build/config
export default defineConfig({
	site: SITE_URL,
	trailingSlash: 'always',
	build: {
		format: 'directory',
	},
	integrations: [
		mdx(),
		sitemap({
			// Exclude internal/utility routes from the sitemap.
			filter: (page) => !/\/(404|rss\.xml)\/?$/.test(page),
			serialize: async (item) => {
				const metaMap = await sitemapMetaPromise;
				const path = new URL(item.url).pathname;
				const entry = metaMap.get(path);
				if (entry) {
					return {
						...item,
						lastmod: entry.lastmod,
						priority: entry.priority,
						changefreq: entry.changefreq,
					};
				}
				return item;
			},
		}),
	],
});
