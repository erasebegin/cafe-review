import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

// Configuration for Sanity client
const projectId = import.meta.env.SANITY_PROJECT_ID || 'd63wzggl'
const dataset = import.meta.env.SANITY_DATASET || 'production'
const apiVersion = import.meta.env.SANITY_API_VERSION || '2024-09-18'
const apiToken = import.meta.env.SANITY_API_TOKEN

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token: apiToken, // Optional: only needed for authenticated requests
  useCdn: true, // Set to false if you need fresh data for every request
})

// Helper for generating image URLs
const builder = imageUrlBuilder(client)

export function urlFor(source: any) {
  return builder.image(source)
}

// GROQ queries for cafe content (adapted for blog-like usage)
export const cafesQuery = `*[_type == "cafe"] | order(_createdAt desc) {
  _id,
  title,
  slug,
  description,
  reviewBody,
  _createdAt,
  _updatedAt,
  featuredImage,
  gallery,
  location->{
    _id,
    _type,
    cityName,
    slug,
    description
  },
  veganOptions,
  glutenFree,
  workability,
  coffeeCraftsmanship,
  healthFocus,
  croissants,
  vibe,
  food,
  drinks,
  facilities
}`

export const cafeQuery = `*[_type == "cafe" && slug.current == $slug][0] {
  _id,
  title,
  slug,
  description,
  reviewBody,
  _createdAt,
  _updatedAt,
  featuredImage,
  gallery,
  location->{
    _id,
    _type,
    cityName,
    slug,
    description
  },
  veganOptions,
  veganOptionsComment,
  glutenFree,
  glutenFreeComment,
  workability,
  workabilityComment,
  coffeeCraftsmanship,
  coffeeCraftsmanshipComment,
  healthFocus,
  healthFocusComment,
  croissants,
  croissantsComment,
  vibe,
  food,
  drinks,
  facilities,
  geopoint,
  address,
  phone,
  email,
  instagram,
  facebook
}`

export const siteConfigQuery = `*[_type == "siteConfig"][0] {
  title,
  description,
  socialMedia
}`

export const locationsQuery = `*[_type == "location"] | order(cityName asc) {
  _id,
  _type,
  cityName,
  slug,
  description,
  bannerImages,
  mobileBannerImages,
  featuredImages
}`
