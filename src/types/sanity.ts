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

// Atmosphere sub-types
export interface SanityMusic {
  volume?: 'none' | 'quiet' | 'moderate' | 'loud'
  genre?: string
  notes?: string
}

export interface SanityStaff {
  friendliness?: number
  professionalism?: number
  attentiveness?: number
  notes?: string
}

export interface SanityToilets {
  available?: boolean
  cleanliness?: number
  acoustics?: string
  notes?: string
}

export interface SanityAtmosphere {
  lighting?: 'bright' | 'dim' | 'natural' | 'mixed'
  noiseLevel?: 'silent' | 'quiet' | 'moderate' | 'lively' | 'loud'
  music?: SanityMusic
  vibe?: string[]
  vibeNotes?: string
  interiorDescription?: string
  indoorSeating?: number
  outdoorSeating?: number
  seatingTypes?: string[]
  seatingComfort?: number
  tableSize?: 'small' | 'medium' | 'large' | 'mixed'
  spaceNotes?: string
  staff?: SanityStaff
}

// Working facilities sub-types
export interface SanityWifi {
  available?: boolean
  speedMbps?: number
  captivePortal?: boolean
  notes?: string
}

export interface SanityPlugSockets {
  availability?: 'none' | 'few' | 'some' | 'plenty'
  notes?: string
}

export interface SanityLaptopPolicy {
  allowed?: 'yes' | 'no' | 'restricted' | 'unclear'
  notes?: string
}

export interface SanityWorkingFacilities {
  wifi?: SanityWifi
  plugSockets?: SanityPlugSockets
  laptopPolicy?: SanityLaptopPolicy
  laptopFriendlyHeight?: boolean
}

// Menu sub-types
export interface SanityItemTried {
  name: string
  category: 'drink' | 'food'
  rating?: number
  priceEur?: number
  notes?: string
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
  // SEO overrides
  seoTitle?: string
  seoDescription?: string
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
  cakesAndPastriesRating?: number
  cakesAndPastriesComment?: string
  drinksRating?: number
  drinksComment?: string
  // Multi-select arrays
  food?: string[]
  drinks?: string[]
  facilities?: string[]
  // Atmosphere
  atmosphere?: SanityAtmosphere
  // Working facilities
  workingFacilities?: SanityWorkingFacilities
  // Toilets
  toilets?: SanityToilets
  // Menu
  menuNotes?: string
  itemsTried?: SanityItemTried[]
  // Location & contact
  geoLocation?: { lat: number; lng: number }
  address?: string
  phone?: string
  phoneNumber?: string
  email?: string
  instagram?: string
  facebook?: string
  openingHours?: string[]
  specialty?: string
  visits?: number
}

// Site configuration
export interface SanitySiteConfig {
  _id: string
  _type: 'siteConfig'
  title: string
  description: string
  socialMedia?: any
}

// Location SEO fields (added in schema update).
export interface SanityLocationSeo {
  seoTitle?: string
  seoDescription?: string
}

// Processed cafe for Astro (adapted as blog-like content)
export interface BlogPost {
  id: string
  title: string
  slug: string
  description: string
  // SEO overrides (preferred for <title>/meta description when present).
  seoTitle?: string
  seoDescription?: string
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
  croissant?: number
  croissantComment?: string
  cakesAndPastries?: number
  cakesAndPastriesComment?: string
  drinks?: number
  drinksComment?: string
  // Multi-select tags
  food?: string[]
  drinksTags?: string[]
  facilities?: string[]
  // Atmosphere
  atmosphere?: SanityAtmosphere
  // Working facilities
  workingFacilities?: SanityWorkingFacilities
  // Toilets
  toilets?: SanityToilets
  // Style keywords extracted from review body
  styleKeywords?: string[]
  // Menu
  menuNotes?: string
  itemsTried?: SanityItemTried[]
  // Contact
  address?: string
  phone?: string
  email?: string
  website?: string
  openingHours?: string[]
  geo?: { lat: number; lng: number }
  images?: string[]
  specialty?: string
  visits?: number
}
