const STRAPI_URL = 'https://cms.cafereview.eu';
const API_TOKEN = '4cfa79e646207714672ac68c8a668c112a2966eb9f637889263942bf86cbd30ae932a03616c0ff404940aee19526fc2835c89dadfb8f6d79e23269f5df9d3ae177b160c5a60c5df3efd95d1ee1fb4bb6568546e63548a4a880c34433c2c3d4ca6e3a9fa35bbed5643a6d3aae2b65828c369534310df30a2168287c4764951abc';

interface StrapiImage {
  id: number;
  attributes: {
    url: string;
    alternativeText?: string;
    caption?: string;
    width: number;
    height: number;
  };
}

interface StrapiResponse<T> {
  data: T;
  meta?: any;
}

interface SiteConfig {
  id: number;
  attributes: {
    title: string;
    subtitle?: string;
    description?: string;
    logo?: {
      data: StrapiImage;
    };
    heroImage?: {
      data: StrapiImage;
    };
    contactEmail?: string;
  };
}

interface Cafe {
  id: number;
  attributes: {
    title: string;
    description?: string;
    reviewBody: string;
    slug: string;
    veganRating: number;
    glutenFreeRating: number;
    workabilityRating: number;
    coffeeCraftsmanshipRating: number;
    healthFocusRating: number;
    vibe?: string[];
    food?: string[];
    drinks?: string[];
    latitude: number;
    longitude: number;
    address: string;
    phoneNumber?: string;
    email?: string;
    instagram?: string;
    facebook?: string;
    featuredImage?: {
      data: StrapiImage;
    };
    gallery?: {
      data: StrapiImage[];
    };
    specialty?: string;
    tags?: any;
    publishedAt: string;
    updatedAt: string;
    location?: {
      data: {
        id: number;
        attributes: {
          cityName: string;
          slug: string;
        };
      };
    };
  };
}

interface Location {
  id: number;
  attributes: {
    cityName: string;
    description?: string;
    slug: string;
    bannerImage?: {
      data: StrapiImage;
    };
    smallImage?: {
      data: StrapiImage;
    };
  };
}

async function fetchStrapi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${STRAPI_URL}/api/${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch from Strapi: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const response = await fetchStrapi<StrapiResponse<SiteConfig>>('site-config?populate=*');
  return response.data;
}

export async function getLatestCafes(limit: number = 6): Promise<Cafe[]> {
  const response = await fetchStrapi<StrapiResponse<Cafe[]>>(
    `cafes?populate=*&sort=publishedAt:desc&pagination[limit]=${limit}`
  );
  return response.data;
}

export async function getAllCafes(): Promise<Cafe[]> {
  const response = await fetchStrapi<StrapiResponse<Cafe[]>>('cafes?populate=*&sort=publishedAt:desc');
  return response.data;
}

export async function getCafeBySlug(slug: string): Promise<Cafe | null> {
  const response = await fetchStrapi<StrapiResponse<Cafe[]>>(
    `cafes?populate=*&filters[slug][$eq]=${slug}`
  );
  return response.data[0] || null;
}

export async function getAllLocations(): Promise<Location[]> {
  const response = await fetchStrapi<StrapiResponse<Location[]>>('locations?populate=*');
  return response.data;
}

export function getStrapiImageUrl(image: StrapiImage | undefined | null): string {
  if (!image) return '';
  const url = image.attributes.url;
  return url.startsWith('/') ? `${STRAPI_URL}${url}` : url;
}

export function calculateAverageRating(cafe: Cafe): number {
  const ratings = [
    cafe.attributes.veganRating,
    cafe.attributes.glutenFreeRating,
    cafe.attributes.workabilityRating,
    cafe.attributes.coffeeCraftsmanshipRating,
    cafe.attributes.healthFocusRating
  ];
  return Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10;
}
