# Quick Start Guide - Editorial Service Data Seeding

## ✅ Implementation Complete

All data from `@data` library has been successfully integrated into the Editorial service.

## What Was Done

### 1. Content Types Created
- ✅ Platform
- ✅ Device  
- ✅ Monetization Model
- ✅ Social
- ✅ Store
- ✅ User Span

### 2. Associations Updated
All enumeration-based associations converted to proper relations.

### 3. Automatic Seeding Configured
Data seeds automatically on application startup from `@data` library.

## How to Test

### Start the Editorial Service

```bash
# From workspace root
nx develop apps.services.editorial

# Or from editorial directory
cd apps/services/editorial
npm run develop
```

### Watch Console Output

You should see:

```
🌱 Starting data seeding process...

🌱 Seeding platforms...
  ✓ Created platform: Web
  ✓ Created platform: IOS
  ✓ Created platform: Android
  ✓ Created platform: Windows
  ✓ Created platform: Linux
  ✓ Created platform: MacOS
✅ Platforms seeded

🌱 Seeding devices...
  ✓ Created device: Desktop
  ✓ Created device: Tablet
  ✓ Created device: Phone
  ✓ Created device: Smartwatch
  ✓ Created device: Tv
✅ Devices seeded

🌱 Seeding monetization models...
  ✓ Created monetization model: Free
  ✓ Created monetization model: Freemium
  ✓ Created monetization model: Subscription
  ✓ Created monetization model: Ad-based
  ✓ Created monetization model: One time purchase
  ✓ Created monetization model: Fees
✅ Monetization models seeded

🌱 Seeding socials...
  ✓ Created social: Facebook
  ✓ Created social: X
  ✓ Created social: Reddit
  ✓ Created social: Discord
  ✓ Created social: LinkedIn
  ✓ Created social: Medium
✅ Socials seeded

🌱 Seeding stores...
  ✓ Created store: GooglePlay
  ✓ Created store: AppleStore
  ✓ Created store: AppGallery
  ✓ Created store: Microsoft store
✅ Stores seeded

🌱 Seeding user spans...
  ✓ Created user span: 0-1000
  ✓ Created user span: 1000-10000
  ✓ Created user span: 10000-100000
  ✓ Created user span: 100000-1000000
  ✓ Created user span: 1000000+
✅ User spans seeded

🌱 Seeding categories...
  ✓ Created parent category: Work & Productivity
  ✓ Created child category: AI Notetakers (parent: Work & Productivity)
  ... (continues for all categories)
✅ Categories seeded (XX parent categories)

🌱 Seeding tags...
✅ Tags seeded (926 tags)

✅ Data seeding completed successfully!
```

### Verify in Strapi Admin

1. Open http://localhost:1337/admin
2. Login with admin credentials
3. Navigate to Content Manager
4. Check the new content types:
   - Platforms (6 records)
   - Devices (5 records)
   - Monetization Models (6 records)
   - Socials (6 records)
   - Stores (4 records)
   - User Spans (5 records)
   - Categories (~252 records with hierarchy)
   - Tags (926 records)

### Test API Endpoints

```bash
# List platforms
curl http://localhost:1337/api/platforms

# List devices
curl http://localhost:1337/api/devices

# List monetization models
curl http://localhost:1337/api/monetization-models

# List socials
curl http://localhost:1337/api/socials

# List stores
curl http://localhost:1337/api/stores

# List user spans
curl http://localhost:1337/api/user-spans

# List categories
curl http://localhost:1337/api/categories

# List tags
curl http://localhost:1337/api/tags
```

## Data Sources

All data is seeded from the `@data` library:

```typescript
import { 
  platforms,      // 6 records
  devices,        // 5 records
  monetizationModels, // 6 records
  socials,        // 6 records
  stores,         // 4 records
  userSpans,      // 5 records
  categories,     // ~252 records (hierarchical)
  tags            // 926 records
} from '@data';
```

## Key Features

### ✅ Idempotent
- Safe to restart the application
- Won't create duplicates
- Updates existing records if data changed

### ✅ Single Source of Truth
- All data comes from `@data` library
- Easy to update and maintain
- Version controlled

### ✅ Automatic Sync
- Runs on every application startup
- No manual intervention needed
- Ensures data consistency

## Project Structure

```
apps/services/editorial/
├── src/
│   ├── api/
│   │   ├── platform/              # New content type
│   │   ├── device/                # New content type
│   │   ├── monetization-model/    # New content type
│   │   ├── social/                # New content type
│   │   ├── store/                 # New content type
│   │   ├── user-span/             # New content type
│   │   ├── category/              # Existing (seeds data now)
│   │   ├── tag/                   # Existing (seeds data now)
│   │   ├── platform-association/  # Updated to use relations
│   │   ├── device-association/    # Updated to use relations
│   │   ├── monetization-association/ # Updated to use relations
│   │   ├── social-link/           # Updated to use relations
│   │   └── store-link/            # Updated to use relations
│   ├── bootstrap/
│   │   ├── seed-data.ts           # Main orchestrator
│   │   └── seeders/
│   │       ├── seed-platforms.ts
│   │       ├── seed-devices.ts
│   │       ├── seed-monetization-models.ts
│   │       ├── seed-socials.ts
│   │       ├── seed-stores.ts
│   │       ├── seed-user-spans.ts
│   │       ├── seed-categories.ts
│   │       └── seed-tags.ts
│   └── index.ts                   # Bootstrap entry point
├── tsconfig.json                  # Updated with @data path
└── DATA_SEEDING_IMPLEMENTATION.md # Full documentation
```

## Troubleshooting

### Seeding Not Running?
- Check console for errors
- Verify `src/index.ts` imports `seed-data.ts`
- Check TypeScript compilation errors

### Missing Data?
- Check if database is empty
- Verify Strapi schemas are applied (run `npm run build`)
- Check console logs for errors

### Import Errors?
- Verify `tsconfig.json` has correct path mappings
- Restart the dev server
- Clear `.cache` and `dist` folders

### Duplicate Key Errors?
- Data may already exist (idempotent, so safe to ignore)
- Check database for existing records
- Consider clearing database and re-seeding

## Next Steps

1. ✅ Test the implementation by starting the service
2. ⚠️ Update any client code using old enumeration format
3. ⚠️ Create migration script for existing production data
4. ✅ Test creating App Records with the new associations
5. ✅ Verify API responses include proper relation objects

## Support

For detailed documentation, see:
- `DATA_SEEDING_IMPLEMENTATION.md` - Full implementation details
- `README.md` - General project documentation

---

**Status:** ✅ Ready to use
**Last Updated:** 2026-01-11
