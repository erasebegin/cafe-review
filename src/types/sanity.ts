// Sanity document types
export interface SanityImage {
  _type: 'image'
  asset: {
    _ref: string
    _type: 'reference'
  }
  alt?: string
}

export interface SanitySlug {
  _type: 'slug'
  current: string
}

// Portable Text (rich text) types
export interface PortableTextBlock {
  _key: string
  _type: 'block'
  children: Array<{
    _key: string
    _type: 'span'
    marks: string[]
    text: string
  }>
  markDefs: any[]
  style: string
}

// Location document
export interface SanityLocation {
  _id: string
  _type: 'location'
  cityName: string
  slug: SanitySlug
  description?: string
  bannerImages?: SanityImage[]
  mobileBannerImages?: SanityImage[]
  featuredImages?: SanityImage[]
}

// Cafe document (based on cafe.ts schema)
export interface SanityCafe {
  _id: string
  _type: 'cafe'
  title: string
  slug: SanitySlug
  description?: string
  reviewBody?: PortableTextBlock[]
  _createdAt: string
  _updatedAt: string
  featuredImage?: SanityImage
  gallery?: SanityImage[]
  location?: SanityLocation
  // Rating fields
  veganRating?: number
  veganComment?: string
  glutenFreeRating?: number
  glutenFreeComment?: string
  workabilityRating?: number
  workabilityComment?: string
  coffeeCraftsmanshipRating?: number
  coffeeCraftsmanshipComment?: string
  healthFocusRating?: number
  healthFocusComment?: string
  croissantRating?: number
  croissantComment?: string
  // Multi-select arrays
  vibe?: string[]
  food?: string[]
  drinks?: string[]
  facilities?: string[]
  // Location & contact
  geopoint?: { lat: number; lng: number }
  address?: string
  phone?: string
  email?: string
  instagram?: string
  facebook?: string
}

// Site configuration
export interface SanitySiteConfig {
  _id: string
  _type: 'siteConfig'
  title: string
  description: string
  socialMedia?: any
}

// Processed cafe for Astro (adapted as blog-like content)
export interface BlogPost {
  id: string
  title: string
  slug: string
  description: string
  pubDate: Date
  updatedDate?: Date
  heroImage?: string
  content: PortableTextBlock[]
  rating?: number
  location?: {
    cityName: string
    slug: string
  }
  // Rating fields
  veganOptions?: number
  veganComment?: string
  glutenFree?: number
  glutenFreeComment?: string
  workability?: number
  workabilityComment?: string
  coffeeCraftsmanship?: number
  coffeeCraftsmanshipComment?: string
  healthFocus?: number
  healthFocusComment?: string
  croissants?: number
  croissantComment?: string
  address?: string
  phone?: string
  website?: string
  openingHours?: string
  images?: string[]
}
