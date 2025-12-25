import { client, cafesQuery, cafeQuery, siteConfigQuery, locationsQuery, urlFor } from './sanity'
import type { SanityCafe, SanitySiteConfig, SanityLocation, BlogPost } from '../types/sanity'

// Transform Sanity cafe to match Astro's blog format
function transformCafeToBlogPost(cafe: SanityCafe): BlogPost {
  return {
    id: cafe._id,
    title: cafe.title,
    slug: cafe.slug.current,
    description: cafe.description || `A review of ${cafe.title}`,
    pubDate: new Date(cafe._createdAt),
    updatedDate: cafe._updatedAt ? new Date(cafe._updatedAt) : undefined,
    heroImage: cafe.featuredImage ? urlFor(cafe.featuredImage).width(720).height(360).url() : undefined,
    content: cafe.reviewBody || [],
    rating: cafe.coffeeCraftsmanship, // Using coffee craftsmanship as main rating
    location: cafe.location ? {
      name: cafe.location.cityName,
      slug: cafe.location.slug.current
    } : undefined,
    address: cafe.address,
    phone: cafe.phone,
    website: cafe.instagram || cafe.facebook,
    openingHours: undefined,
    images: cafe.gallery?.map(img => urlFor(img).width(800).height(600).url()) || []
  }
}

// Fetch all cafes as blog posts
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  try {
    const cafes: SanityCafe[] = await client.fetch(cafesQuery)
    return cafes.map(transformCafeToBlogPost)
  } catch (error) {
    console.error('Error fetching cafes from Sanity:', error)
    return []
  }
}

// Fetch a single cafe by slug as blog post
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const cafe: SanityCafe = await client.fetch(cafeQuery, { slug })
    return cafe ? transformCafeToBlogPost(cafe) : null
  } catch (error) {
    console.error(`Error fetching cafe with slug "${slug}" from Sanity:`, error)
    return null
  }
}

// Get all cafe slugs (useful for static path generation)
export async function getAllBlogSlugs(): Promise<string[]> {
  try {
    const posts = await getAllBlogPosts()
    return posts.map(post => post.slug)
  } catch (error) {
    console.error('Error fetching cafe slugs from Sanity:', error)
    return []
  }
}

// Get site configuration from Sanity
export async function getSiteConfig(): Promise<SanitySiteConfig | null> {
  try {
    const siteConfig: SanitySiteConfig = await client.fetch(siteConfigQuery)
    return siteConfig
  } catch (error) {
    console.error('Error fetching site config from Sanity:', error)
    return null
  }
}

// Get all locations from Sanity
export async function getAllLocations(): Promise<SanityLocation[]> {
  try {
    const locations: SanityLocation[] = await client.fetch(locationsQuery)
    return locations
  } catch (error) {
    console.error('Error fetching locations from Sanity:', error)
    return []
  }
}
