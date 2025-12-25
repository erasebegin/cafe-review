# Current Problem: Cafe Review Blog Transformation

**Date**: 2025-10-31  
**Status**: In Progress

## Problem Statement

Converting an Astro blog starter template into a cafe review website powered by Sanity CMS instead of local Markdown files.

## Context

- **Project**: Cafe Review Blog (Astro v5.13.5)
- **Original Setup**: Standard Astro blog with local Markdown content collections
- **Target**: Dynamic cafe review site fetching data from Sanity CMS (cms.cafereview.eu)
- **CMS Backend**: Sanity Studio at cms.cafereview.eu

## What's Been Done

### ✅ Completed Work

1. **Sanity Integration**
   - Installed `@sanity/client` and `@sanity/image-url`
   - Created Sanity client configuration (`src/lib/sanity.ts`)
   - Set up TypeScript types for cafe content (`src/types/sanity.ts`)
   - Built data fetching utilities (`src/lib/sanity-utils.ts`)
   - Configured with actual project credentials (stored in `.env`)

2. **Content Migration**
   - Updated blog pages to fetch cafe reviews from Sanity instead of local Markdown
   - Modified `BlogPost.astro` layout for Sanity compatibility
   - Updated `/blog` index and individual post pages (`[...slug].astro`)
   - Disabled original content collections (preserved in comments)

3. **UI Components**
   - Created new components: `Hero.astro`, `LatestReviews.astro`, `ReviewCard.astro`, `LocationDropdown.astro`, `StrapiDemo.astro`
   - Updated `Header.astro` and `Footer.astro` for cafe review branding
   - Added custom assets: `logo.png`, `Chris_Map.jpg`

4. **Configuration**
   - Successfully tested connection to cms.cafereview.eu
   - Environment variables secured in `.env` (git-ignored)
   - Modified global styles for new design

### 📝 Modified Files
- `package.json` - Added Sanity dependencies
- `src/content.config.ts` - Disabled local content collections
- `src/layouts/BlogPost.astro` - Adapted for Sanity data structure
- `src/pages/blog/[...slug].astro` - Fetches individual cafe reviews from Sanity
- `src/pages/blog/index.astro` - Lists all cafe reviews from Sanity
- `src/pages/index.astro` - Updated homepage for cafe review site
- `src/styles/global.css` - Styling updates

### 📁 New Files/Directories
- `SANITY_SETUP.md` - Integration documentation
- `WARP.md` - WARP AI guidance for this project
- `src/lib/` - Sanity client and utilities
- `src/types/` - TypeScript type definitions
- `src/components/` - New review-specific components
- `src/assets/` - Logo and hero images

## Current State

**Integration Status**: ✅ Working  
**Connection**: ✅ Connected to cms.cafereview.eu  
**Data Flow**: Sanity CMS → Astro pages (at build time)

## Outstanding Tasks

### 🔧 Potential Improvements

1. **Content Rendering**
   - Consider adding `@portabletext/astro` for proper rich text rendering (currently showing raw JSON/blocks)

2. **Schema Definition**
   - Ensure Sanity Studio has proper `blogPost` schema with:
     - title, slug, description
     - publishedAt, updatedAt
     - heroImage
     - content (Portable Text)

3. **Performance**
   - Consider implementing content caching
   - Evaluate CDN usage setting in Sanity client

4. **Real-time Updates**
   - Set up webhook-based revalidation for content changes
   - Add content preview for draft posts

5. **Git Management**
   - Decide which modified files to commit
   - Stage and commit the working integration

## Technical Details

### Data Structure
- **Content Type**: Cafe reviews (treated as blog posts)
- **Source**: Sanity CMS via GROQ queries
- **Images**: Served from Sanity CDN
- **Build**: Static generation at build time

### Key Dependencies
- `@sanity/client` v6.26.1
- `@sanity/image-url` v1.1.0
- Astro v5.13.5

### Environment
- Package manager: pnpm
- Node environment required for Sanity client
- `.env` file contains project credentials (not in git)

## Next Steps

When returning to this problem:

1. Review `SANITY_SETUP.md` for detailed integration status
2. Check Sanity Studio at cms.cafereview.eu for content schema
3. Test the site: `pnpm dev` and visit `/blog`
4. Decide on Portable Text rendering approach
5. Consider committing the working changes

## References

- Project documentation: `WARP.md`
- Integration guide: `SANITY_SETUP.md`
- Sanity client: `src/lib/sanity.ts`
- Data utilities: `src/lib/sanity-utils.ts`
- Type definitions: `src/types/sanity.ts`
