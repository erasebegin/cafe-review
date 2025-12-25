# Sanity CMS Integration Setup

This document outlines the steps to complete your Sanity CMS integration with your Astro blog.

## ✅ COMPLETED INTEGRATION

✅ Installed Sanity dependencies (`@sanity/client`, `@sanity/image-url`)  
✅ Created Sanity client configuration (`src/lib/sanity.ts`)  
✅ Created TypeScript types for cafe content (`src/types/sanity.ts`)  
✅ Created data fetching utilities (`src/lib/sanity-utils.ts`)  
✅ Updated blog pages to fetch cafes as blog posts from Sanity  
✅ Updated BlogPost layout for Sanity compatibility  
✅ **CONFIGURED WITH ACTUAL PROJECT CREDENTIALS**
✅ **TESTED AND WORKING** - Successfully connecting to cms.cafereview.eu
✅ **ENVIRONMENT VARIABLES SECURED** - Credentials stored in `.env` (git-ignored)

**🎉 Your blog is now powered by Sanity CMS!**

## Next Steps

### 1. Configure Sanity Client

Update `src/lib/sanity.ts` with your actual project details:

```typescript
export const client = createClient({
  projectId: 'YOUR_ACTUAL_PROJECT_ID', // Get this from Sanity dashboard
  dataset: 'production', // or your dataset name
  useCdn: true,
  apiVersion: '2023-05-03',
})
```

**To find your Project ID:**
1. Go to your Sanity dashboard at https://www.sanity.io/manage
2. Select your cafe-review project
3. Go to Settings → API
4. Copy the Project ID

### 2. Create Content Schema in Sanity Studio

In your Sanity Studio (cms.cafereview.eu), create a blog post schema. Here's a recommended schema:

```javascript
// In your Sanity Studio schemas
export default {
  name: 'blogPost',
  title: 'Blog Post',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      validation: Rule => Rule.required()
    },
    {
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
      validation: Rule => Rule.required()
    },
    {
      name: 'updatedAt',
      title: 'Updated At',
      type: 'datetime'
    },
    {
      name: 'heroImage',
      title: 'Hero Image',
      type: 'image',
      options: {
        hotspot: true,
      }
    },
    {
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [{type: 'block'}]
    }
  ]
}
```

### 3. Add Portable Text Rendering (Optional but Recommended)

For proper rich text rendering, install Portable Text renderer:

```bash
pnpm add @portabletext/astro
```

Then update the blog post template to render Portable Text properly instead of JSON.

### 4. Test the Integration

1. Add some blog posts in your Sanity Studio
2. Update the Sanity client configuration with your project details
3. Run `pnpm dev` to test the integration
4. Visit `/blog` to see if posts are loading from Sanity
5. Click on a post to test individual post pages

### 5. Environment Variables (Recommended)

Instead of hardcoding credentials, use environment variables:

Create `.env` file:
```
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
```

Update `src/lib/sanity.ts`:
```typescript
export const client = createClient({
  projectId: import.meta.env.SANITY_PROJECT_ID || 'YOUR_PROJECT_ID',
  dataset: import.meta.env.SANITY_DATASET || 'production',
  useCdn: true,
  apiVersion: '2023-05-03',
})
```

## Migration Notes

- The original content collections are disabled but preserved in comments
- Local Markdown files in `src/content/blog/` are no longer used
- All blog content now comes from Sanity CMS
- Hero images are served directly from Sanity's CDN
- Content is rendered as Portable Text (currently showing raw JSON until renderer is added)

## Troubleshooting

- **No posts showing**: Check that your Sanity project ID is correct and posts exist in Sanity
- **Build errors**: Ensure all dependencies are installed and types are correct
- **Images not loading**: Verify image URLs are being generated correctly by Sanity

## Additional Features to Consider

- Add authentication for private content
- Implement content preview for draft posts  
- Add content caching for better performance
- Set up webhook-based revalidation for real-time updates
