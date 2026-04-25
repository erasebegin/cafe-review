// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://cafereview.eu',
	trailingSlash: 'always',
	build: {
		format: 'directory',
	},
	integrations: [
		mdx(),
		sitemap({
			// Exclude internal/utility routes from the sitemap.
			filter: (page) => !/\/(404|rss\.xml)\/?$/.test(page),
			changefreq: 'weekly',
			priority: 0.7,
		}),
	],
});
