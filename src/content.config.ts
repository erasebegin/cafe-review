// Content collections configuration
// Currently using Sanity CMS for content management
// This file is kept for potential future use of local content collections

// import { defineCollection, z } from 'astro:content';

// Placeholder - content is now managed through Sanity CMS
// const blog = defineCollection({
// 	// Load Markdown and MDX files in the `src/content/blog/` directory.
// 	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
// 	// Type-check frontmatter using a schema
// 	schema: ({ image }) =>
// 		z.object({
// 			title: z.string(),
// 			description: z.string(),
// 			// Transform string to Date object
// 			pubDate: z.coerce.date(),
// 			updatedDate: z.coerce.date().optional(),
// 			heroImage: image().optional(),
// 		}),
// });

export const collections = {};
