# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is an Astro-based blog application using the official Astro blog starter template. The project is designed to create a fast, SEO-friendly blog with Markdown and MDX support, built with TypeScript.

## Essential Commands

### Development
- `pnpm install` - Install dependencies
- `pnpm dev` - Start development server at `localhost:4321`
- `pnpm build` - Build production site to `./dist/`
- `pnpm preview` - Preview production build locally

### Astro CLI
- `pnpm astro add <integration>` - Add Astro integrations
- `pnpm astro check` - Type-check the project
- `pnpm astro -- --help` - Get help with Astro CLI

## Architecture

### Tech Stack
- **Framework**: Astro v5.13.5 with TypeScript
- **Content**: Markdown/MDX with content collections
- **Styling**: Vanilla CSS with custom properties
- **Package Manager**: pnpm
- **Integrations**: MDX support, RSS feeds, sitemap generation

### Key Directories
- `src/pages/` - File-based routing (`.astro`, `.md` files become routes)
- `src/content/` - Content collections (blog posts in `src/content/blog/`)
- `src/components/` - Reusable Astro components
- `src/layouts/` - Page layout templates
- `src/assets/` - Images and static assets for content
- `public/` - Static assets served directly

### Content Collections
Blog posts are managed through Astro's content collections:
- Location: `src/content/blog/`
- Schema: Defined in `src/content.config.ts`
- Frontmatter: `title`, `description`, `pubDate`, `updatedDate`, `heroImage`
- Supports both Markdown (`.md`) and MDX (`.mdx`) formats

### Component Architecture
- `BaseHead.astro` - HTML head with meta tags and SEO
- `Header.astro` - Site navigation with internal/social links
- `Footer.astro` - Site footer
- `FormattedDate.astro` - Date formatting component
- `HeaderLink.astro` - Navigation link component
- `BlogPost.astro` (layout) - Blog post template with hero image support

### Styling System
- CSS custom properties for theming in `src/styles/global.css`
- Atkinson font family with custom `@font-face` declarations
- Responsive design with mobile breakpoints at 720px
- Component-scoped styles within `.astro` files

### Content Management
- Blog posts use frontmatter for metadata
- Content is type-checked using Zod schema
- RSS feed auto-generated at `/rss.xml`
- Sitemap automatically generated
- Hero images supported with Astro's Image component

### Development Notes
- Uses strict TypeScript configuration
- File-based routing: `src/pages/about.astro` → `/about`
- Dynamic routes: `src/pages/blog/[...slug].astro` handles blog post pages
- Content queries use `getCollection('blog')` from `astro:content`
- Site configuration in `astro.config.mjs` (currently set to `https://example.com`)
