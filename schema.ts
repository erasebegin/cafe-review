export default {
  name: 'cafe',
  title: 'Cafe',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule: any) => Rule.required()
    },
    // Reference to location document
    {
      name: 'location',
      title: 'Location',
      type: 'reference',
      to: [{type: 'location'}]
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96
      },
      validation: (Rule: any) => Rule.required()
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      description: 'Short summary used as the default meta description (≤160 chars).',
      validation: (Rule: any) => Rule.max(200)
    },
    // SEO overrides (optional). When present, the site uses these in <title>
    // and <meta name="description">. Otherwise it falls back to title/description.
    {
      name: 'seoTitle',
      title: 'SEO Title',
      type: 'string',
      description: 'Optional <title> override. Aim for 50–60 characters incl. brand.',
      validation: (Rule: any) => Rule.max(70)
    },
    {
      name: 'seoDescription',
      title: 'SEO Description',
      type: 'text',
      description: 'Optional meta description override. Aim for 140–160 characters.',
      validation: (Rule: any) => Rule.max(200)
    },
    {
      name: 'openingHours',
      title: 'Opening Hours',
      type: 'array',
      of: [{type: 'string'}],
      description:
        'One entry per range, in schema.org format (e.g. "Mo-Fr 08:00-17:00", "Sa 09:00-14:00").'
    },
    {
      name: 'visits',
      title: 'Visits',
      type: 'number',
      description: 'Number of visits to this cafe',
      validation: (Rule: any) => Rule.integer().min(0)
    },
    {
      name: 'reviewBody',
      title: 'Review Body',
      type: 'array',
      of: [{type: 'block'}],
      validation: (Rule: any) => Rule.required()
    },
    
    // Rating fields with comments
    {
      name: 'veganRating',
      title: 'Vegan Rating',
      type: 'number',
      validation: (Rule: any) => Rule.min(1).max(5)
    },
    {
      name: 'veganComment',
      title: 'Vegan Comment',
      type: 'string',
      description: 'Brief comment about vegan options'
    },
    {
      name: 'glutenFreeRating',
      title: 'Gluten Free Rating',
      type: 'number',
      validation: (Rule: any) => Rule.min(1).max(5)
    },
    {
      name: 'glutenFreeComment',
      title: 'Gluten Free Comment',
      type: 'string',
      description: 'Brief comment about gluten-free options'
    },
    {
      name: 'workabilityRating',
      title: 'Workability Rating',
      type: 'number',
      validation: (Rule: any) => Rule.min(1).max(5)
    },
    {
      name: 'workabilityComment',
      title: 'Workability Comment',
      type: 'string',
      description: 'Brief comment about workspace suitability'
    },
    {
      name: 'coffeeCraftsmanshipRating',
      title: 'Coffee Craftsmanship Rating',
      type: 'number',
      validation: (Rule: any) => Rule.min(1).max(5)
    },
    {
      name: 'coffeeCraftsmanshipComment',
      title: 'Coffee Craftsmanship Comment',
      type: 'string',
      description: 'Brief comment about coffee quality'
    },
    {
      name: 'healthFocusRating',
      title: 'Health Focus Rating',
      type: 'number',
      validation: (Rule: any) => Rule.min(1).max(5)
    },
    {
      name: 'healthFocusComment',
      title: 'Health Focus Comment',
      type: 'string',
      description: 'Brief comment about health-focused options'
    },
    {
      name: 'croissantRating',
      title: 'Croissant Rating',
      type: 'number',
      validation: (Rule: any) => Rule.min(1).max(5)
    },
    {
      name: 'croissantComment',
      title: 'Croissant Comment',
      type: 'string',
      description: 'Brief comment about croissant quality'
    },
    {
      name: 'cakesAndPastriesRating',
      title: 'Cakes and Pastries Rating',
      type: 'number',
      validation: (Rule: any) => Rule.min(1).max(5)
    },
    {
      name: 'cakesAndPastriesComment',
      title: 'Cakes and Pastries Comment',
      type: 'string',
      description: 'Brief comment about cakes and pastries'
    },
    {
      name: 'drinksRating',
      title: 'Drinks Rating',
      type: 'number',
      validation: (Rule: any) => Rule.min(1).max(5)
    },
    {
      name: 'drinksComment',
      title: 'Drinks Comment',
      type: 'string',
      description: 'Brief comment about drinks overall'
    },

    // Atmosphere group
    {
      name: 'atmosphere',
      title: 'Atmosphere',
      type: 'object',
      options: {collapsible: true, collapsed: false},
      fields: [
        {
          name: 'music',
          title: 'Music',
          type: 'object',
          options: {collapsible: true},
          fields: [
            {name: 'volume', title: 'Volume', type: 'string', options: {list: ['silent', 'quiet', 'moderate', 'loud', 'extreme']}},
            {name: 'genre', title: 'Genre', type: 'string'},
            {name: 'distractionLevel', title: 'Distraction Level', type: 'string', options: {list: ['none', 'low', 'medium', 'high']}},
            {name: 'notes', title: 'Notes', type: 'text'}
          ]
        },
        {name: 'interior', title: 'Interior', type: 'text'},
        {name: 'decoration', title: 'Decoration', type: 'text'},
        {name: 'vibeNotes', title: 'Vibe Notes', type: 'text', description: 'Free-form vibe notes (tags are in the Vibe multi-select)'},
        {
          name: 'staff',
          title: 'Staff',
          type: 'object',
          options: {collapsible: true},
          fields: [
            {name: 'friendliness', title: 'Friendliness', type: 'number', validation: (Rule: any) => Rule.min(1).max(5)},
            {name: 'professionalism', title: 'Professionalism', type: 'number', validation: (Rule: any) => Rule.min(1).max(5)},
            {name: 'activeness', title: 'Activeness', type: 'number', validation: (Rule: any) => Rule.min(1).max(5)},
            {name: 'notes', title: 'Notes', type: 'text'}
          ]
        },
        {
          name: 'sizeLayout',
          title: 'Size / Layout',
          type: 'object',
          options: {collapsible: true},
          fields: [
            {name: 'indoorTables', title: 'Indoor Tables', type: 'number', validation: (Rule: any) => Rule.integer().min(0)},
            {name: 'outdoorTables', title: 'Outdoor Tables', type: 'number', validation: (Rule: any) => Rule.integer().min(0)},
            {name: 'notes', title: 'Notes', type: 'text'}
          ]
        },
        {
          name: 'seating',
          title: 'Seating',
          type: 'object',
          options: {collapsible: true},
          fields: [
            {name: 'comfort', title: 'Comfort', type: 'number', validation: (Rule: any) => Rule.min(1).max(5)},
            {
              name: 'types',
              title: 'Types',
              type: 'array',
              of: [{type: 'string'}],
              options: {list: [
                {title: 'Benches', value: 'benches'},
                {title: 'Chairs', value: 'chairs'},
                {title: 'Stools', value: 'stools'},
                {title: 'Sofas', value: 'sofas'}
              ]}
            },
            {name: 'notes', title: 'Notes', type: 'text'}
          ]
        },
        {
          name: 'tables',
          title: 'Tables',
          type: 'object',
          options: {collapsible: true},
          fields: [
            {name: 'size', title: 'Size', type: 'string', options: {list: ['small', 'medium', 'large', 'mixed']}},
            {name: 'laptopFriendlyHeight', title: 'Laptop-friendly Height', type: 'boolean'},
            {name: 'notes', title: 'Notes', type: 'text'}
          ]
        },
        {
          name: 'toilets',
          title: 'Toilets',
          type: 'object',
          options: {collapsible: true},
          fields: [
            {name: 'available', title: 'Available', type: 'boolean'},
            {name: 'cleanliness', title: 'Cleanliness', type: 'number', validation: (Rule: any) => Rule.min(1).max(5)},
            {name: 'acoustics', title: 'Acoustics', type: 'string', description: 'e.g. private, echoey, thin walls'},
            {name: 'notes', title: 'Notes', type: 'text'}
          ]
        }
      ]
    },

    // Working facilities group
    {
      name: 'workingFacilities',
      title: 'Working Facilities',
      type: 'object',
      options: {collapsible: true, collapsed: false},
      fields: [
        {
          name: 'wifi',
          title: 'WiFi',
          type: 'object',
          options: {collapsible: true},
          fields: [
            {name: 'available', title: 'Available', type: 'boolean'},
            {name: 'speedMbps', title: 'Speed (Mbps)', type: 'number', validation: (Rule: any) => Rule.min(0)},
            {name: 'captivePortal', title: 'Captive Portal', type: 'boolean'},
            {name: 'notes', title: 'Notes', type: 'text'}
          ]
        },
        {
          name: 'plugSockets',
          title: 'Plug Sockets',
          type: 'object',
          options: {collapsible: true},
          fields: [
            {name: 'availability', title: 'Availability', type: 'string', options: {list: ['none', 'few', 'some', 'plenty']}},
            {name: 'notes', title: 'Notes', type: 'text'}
          ]
        },
        {
          name: 'laptopPolicy',
          title: 'Laptop Policy',
          type: 'object',
          options: {collapsible: true},
          fields: [
            {name: 'allowed', title: 'Allowed', type: 'string', options: {list: ['yes', 'no', 'restricted', 'unclear']}},
            {name: 'notes', title: 'Notes', type: 'text', description: 'e.g. no laptops on weekends, time limits'}
          ]
        }
      ]
    },

    // Menu
    {
      name: 'menuNotes',
      title: 'Menu Notes',
      type: 'text',
      description: 'Breadth, pricing, standouts'
    },
    {
      name: 'itemsTried',
      title: 'Items Tried',
      type: 'array',
      of: [{
        type: 'object',
        name: 'itemTried',
        fields: [
          {name: 'name', title: 'Name', type: 'string', validation: (Rule: any) => Rule.required()},
          {name: 'category', title: 'Category', type: 'string', options: {list: [
            {title: 'Drink', value: 'drink'},
            {title: 'Food', value: 'food'}
          ]}, validation: (Rule: any) => Rule.required()},
          {name: 'rating', title: 'Rating (x/10)', type: 'number', validation: (Rule: any) => Rule.min(0).max(10)},
          {name: 'priceEur', title: 'Price (€)', type: 'number', validation: (Rule: any) => Rule.min(0)},
          {name: 'notes', title: 'Notes', type: 'text'}
        ],
        preview: {
          select: {name: 'name', category: 'category', rating: 'rating', priceEur: 'priceEur'},
          prepare({name, category, rating, priceEur}: any) {
            const parts = [category, rating != null ? rating + '/10' : null, priceEur != null ? '€' + priceEur : null].filter(Boolean)
            return {title: name, subtitle: parts.join(' — ')}
          }
        }
      }]
    },

    // Multi-select arrays
    {
      name: 'vibe',
      title: 'Vibe',
      type: 'array',
      of: [{type: 'string'}],
      options: {
		collapsible: true,
		collapsed: true,
        list: [
          {title: 'Arabic', value: 'arabic'},
          {title: 'Bohemian', value: 'bohemian'},
          {title: 'Bright', value: 'bright'},
          {title: 'Bustling', value: 'bustling'},
          {title: 'Business', value: 'business'},
          {title: 'Calm', value: 'calm'},
          {title: 'Chain-like', value: 'chain-like'},
          {title: 'Charming', value: 'charming'},
          {title: 'Cheesy', value: 'cheesy'},
          {title: 'Classy', value: 'classy'},
          {title: 'Cold', value: 'cold'},
          {title: 'Contemporary', value: 'contemporary'},
          {title: 'Corporate', value: 'corporate'},
          {title: 'Cosy', value: 'cosy'},
          {title: 'Counter-culture', value: 'counter-culture'},
          {title: 'Cramped', value: 'cramped'},
          {title: 'Decadent', value: 'decadent'},
          {title: 'Drab', value: 'drab'},
          {title: 'Formal', value: 'formal'},
          {title: 'Generic', value: 'generic'},
          {title: 'Heartwarming', value: 'heartwarming'},
          {title: 'Hip', value: 'hip'},
          {title: 'Hipster', value: 'hipster'},
          {title: 'Homely', value: 'homely'},
          {title: 'Industrial', value: 'industrial'},
          {title: 'Inoffensive', value: 'inoffensive'},
          {title: 'Intellectual', value: 'intellectual'},
          {title: 'International', value: 'international'},
          {title: 'Jazz-lounge', value: 'jazz-lounge'},
          {title: 'Laid-back', value: 'laid-back'},
          {title: 'Living-room', value: 'living-room'},
          {title: 'Low-key', value: 'low-key'},
          {title: 'Messy', value: 'messy'},
          {title: 'Minimal', value: 'minimal'},
          {title: 'Modern', value: 'modern'},
          {title: 'Natural', value: 'natural'},
          {title: 'Neutral', value: 'neutral'},
          {title: 'Novel', value: 'novel'},
          {title: 'Opulent', value: 'opulent'},
          {title: 'Plush', value: 'plush'},
          {title: 'Post-modern', value: 'post-modern'},
          {title: 'Quaint', value: 'quaint'},
          {title: 'Quirky', value: 'quirky'},
          {title: 'Quiet', value: 'quiet'},
          {title: 'Radiant', value: 'radiant'},
          {title: 'Relaxed', value: 'relaxed'},
          {title: 'Restaurant-like', value: 'restaurant-like'},
          {title: 'Scandinavian-minimalism', value: 'scandinavian-minimalism'},
          {title: 'Smoky', value: 'smoky'},
          {title: 'Soulless', value: 'soulless'},
          {title: 'Spacious', value: 'spacious'},
          {title: 'Suburban', value: 'suburban'},
          {title: 'Tasteful', value: 'tasteful'},
          {title: 'Turkish', value: 'turkish'},
          {title: 'Warm', value: 'warm'}
        ]
      }
    },
    {
      name: 'food',
      title: 'Food',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        list: [
          {title: 'Pastries', value: 'pastries'},
          {title: 'Breakfast', value: 'breakfast'},
          {title: 'Brunch', value: 'brunch'},
          {title: 'Dinner', value: 'dinner'}
        ]
      }
    },
    {
      name: 'drinks',
      title: 'Drinks',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        list: [
          {title: 'Smoothies', value: 'smoothies'},
          {title: 'Coffee', value: 'coffee'},
          {title: 'Milkshakes', value: 'milkshakes'},
          {title: 'Tea', value: 'tea'}
        ]
      }
    },
    {
      name: 'facilities',
      title: 'Facilities',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        list: [
          {title: 'Toilets', value: 'toilets'},
          {title: 'WiFi', value: 'wifi'},
          {title: 'Plug Sockets', value: 'plug_sockets'}
        ]
      }
    },

    // Location data - now optional
    {
      name: 'geoLocation',
      title: 'Geographic Location',
      type: 'geopoint'
    },
    {
      name: 'address',
      title: 'Address',
      type: 'string',
      validation: (Rule: any) => Rule.required()
    },
    
    // Other fields
    {
      name: 'specialty',
      title: 'Specialty',
      type: 'string'
    },
    {
      name: 'phoneNumber',
      title: 'Phone Number',
      type: 'string'
    },
    {
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (Rule: any) => Rule.email()
    },
    {
      name: 'instagram',
      title: 'Instagram',
      type: 'string'
    },
    {
      name: 'facebook',
      title: 'Facebook',
      type: 'string'
    },

    // Images
    {
      name: 'featuredImage',
      title: 'Featured Image',
      type: 'image',
      options: {
        hotspot: true
      }
    },
    {
      name: 'gallery',
      title: 'Gallery',
      type: 'array',
      of: [{
        type: 'image',
        options: {
          hotspot: true
        }
      }]
    },

  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'address',
      media: 'featuredImage'
    }
  }
}
