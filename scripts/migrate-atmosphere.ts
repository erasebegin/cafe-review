/**
 * Migration script: restructure cafe atmosphere fields.
 * 
 * Merges old nested fields into new flat structure:
 * - interior + decoration → interiorDescription
 * - sizeLayout.indoorTables → indoorSeating
 * - sizeLayout.outdoorTables → outdoorSeating  
 * - sizeLayout.notes → spaceNotes
 * - tables.size → tableSize
 * - tables.laptopFriendlyHeight → workingFacilities.laptopFriendlyHeight
 * - staff.activeness → staff.attentiveness
 * - atmosphere.toilets → top-level toilets
 * - top-level vibe → atmosphere.vibe
 * - music.distractionLevel → deleted (use noiseLevel instead)
 * - seating.* → deleted
 * - tables.notes → deleted
 * - tables (object) → deleted after migration
 * - sizeLayout (object) → deleted after migration
 * 
 * Run: SANITY_API_TOKEN=xxx npx tsx scripts/migrate-atmosphere.ts
 */

import { createClient } from '@sanity/client'

const client = createClient({
  projectId: 'd63wzggl',
  dataset: 'production',
  apiVersion: '2024-09-18',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

interface OldAtmosphere {
  music?: { volume?: string; genre?: string; distractionLevel?: string; notes?: string }
  interior?: string
  decoration?: string
  vibeNotes?: string
  staff?: { friendliness?: number; professionalism?: number; activeness?: number; notes?: string }
  sizeLayout?: { indoorTables?: number; outdoorTables?: number; notes?: string }
  seating?: { comfort?: number; types?: string[]; notes?: string }
  tables?: { size?: string; laptopFriendlyHeight?: boolean; notes?: string }
  toilets?: { available?: boolean; cleanliness?: number; acoustics?: string; notes?: string }
}

interface OldWorkingFacilities {
  wifi?: any
  plugSockets?: any
  laptopPolicy?: any
  laptopFriendlyHeight?: boolean
}

interface CafeDoc {
  _id: string
  _type: string
  vibe?: string[]
  atmosphere?: OldAtmosphere
  workingFacilities?: OldWorkingFacilities
  toilets?: any
}

function migrate(cafe: CafeDoc): any {
  const patch: any = {}
  const unset: string[] = []
  const old = cafe.atmosphere || {}

  // 1. Merge interior + decoration → interiorDescription
  if (old.interior || old.decoration) {
    const parts = [old.interior, old.decoration].filter(Boolean)
    patch['atmosphere.interiorDescription'] = parts.join('\n\n')
    unset.push('atmosphere.interior', 'atmosphere.decoration')
  }

  // 2. Migrate sizeLayout → flat fields
  if (old.sizeLayout) {
    if (old.sizeLayout.indoorTables != null) {
      patch['atmosphere.indoorSeating'] = old.sizeLayout.indoorTables
    }
    if (old.sizeLayout.outdoorTables != null) {
      patch['atmosphere.outdoorSeating'] = old.sizeLayout.outdoorTables
    }
    if (old.sizeLayout.notes) {
      patch['atmosphere.spaceNotes'] = old.sizeLayout.notes
    }
    unset.push('atmosphere.sizeLayout')
  }

  // 3. Migrate tables → tableSize + laptopFriendlyHeight
  if (old.tables) {
    if (old.tables.size) {
      patch['atmosphere.tableSize'] = old.tables.size
    }
    if (old.tables.laptopFriendlyHeight != null) {
      patch['workingFacilities.laptopFriendlyHeight'] = old.tables.laptopFriendlyHeight
    }
    // tables.notes — discard per user request
    unset.push('atmosphere.tables')
  }

  // 4. Migrate staff.activeness → attentiveness
  if (old.staff?.activeness != null) {
    patch['atmosphere.staff.attentiveness'] = old.staff.activeness
    unset.push('atmosphere.staff.activeness')
  }

  // 5. Delete music.distractionLevel
  if (old.music?.distractionLevel != null) {
    unset.push('atmosphere.music.distractionLevel')
  }

  // 6. Delete seating entirely
  if (old.seating) {
    unset.push('atmosphere.seating')
  }

  // 7. Move atmosphere.toilets → top-level toilets
  if (old.toilets) {
    patch['toilets'] = old.toilets
    unset.push('atmosphere.toilets')
  }

  // 8. Move top-level vibe → atmosphere.vibe
  if (cafe.vibe && cafe.vibe.length > 0) {
    patch['atmosphere.vibe'] = cafe.vibe
    unset.push('vibe')
  }

  return { patch, unset }
}

async function main() {
  if (!process.env.SANITY_API_TOKEN) {
    console.error('SANITY_API_TOKEN is required')
    process.exit(1)
  }

  const query = `*[_type == "cafe"] {
    _id,
    vibe,
    atmosphere,
    workingFacilities,
    toilets
  }`

  console.log('Fetching cafes...')
  const cafes: CafeDoc[] = await client.fetch(query)
  console.log(`Found ${cafes.length} cafes\n`)

  let migrated = 0
  let skipped = 0

  for (const cafe of cafes) {
    const { patch, unset } = migrate(cafe)

    if (Object.keys(patch).length === 0 && unset.length === 0) {
      skipped++
      continue
    }

    const tx = client.transaction()
    
    if (Object.keys(patch).length > 0) {
      tx.patch(cafe._id, { set: patch })
    }
    if (unset.length > 0) {
      tx.patch(cafe._id, { unset })
    }

    try {
      await tx.commit()
      console.log(`✓ ${cafe._id}`)
      if (Object.keys(patch).length > 0) {
        console.log(`  set: ${Object.keys(patch).join(', ')}`)
      }
      if (unset.length > 0) {
        console.log(`  unset: ${unset.join(', ')}`)
      }
      migrated++
    } catch (err: any) {
      console.error(`✗ ${cafe._id}: ${err.message}`)
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`)
}

main().catch(console.error)
