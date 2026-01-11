# Data Migration Summary

This document summarizes the extraction of data from JSON to typed TypeScript files based on catalog domain types.

## Files Created

### 1. **categories.ts**
- **Type**: `CategoryTreeDto` from `libs/domains/catalog/category/src/application/category.dto.ts`
- **Description**: Hierarchical category structure with 181 categories organized in 11 main groups
- **Status**: ✅ Has associated model

### 2. **platforms.ts**
- **Type**: `PlatformOptionDto` from `libs/domains/catalog/compatibility/src/application/models/platform-option.dto.ts`
- **Description**: 6 platform options (Web, iOS, Android, Windows, Linux, MacOS)
- **Status**: ✅ Has associated model
- **Note**: Added `slug` field to each entry

### 3. **devices.ts**
- **Type**: `DeviceOptionDto` from `libs/domains/catalog/compatibility/src/application/models/device-option.dto.ts`
- **Description**: 5 device types (Desktop, Tablet, Phone, Smartwatch, TV)
- **Status**: ✅ Has associated model
- **Note**: Added `slug` field to each entry

### 4. **socials.ts**
- **Type**: `SocialOptionDto` from `libs/domains/catalog/references/src/application/models/social-option.dto.ts`
- **Description**: 6 social media platforms
- **Status**: ✅ Has associated model
- **Note**: Added `slug` field to each entry

### 5. **monetization-models.ts**
- **Type**: `MonetizationOptionDto` from `libs/domains/catalog/pricing/src/application/models/monetization-option.dto.ts`
- **Description**: 6 monetization models (Free, Freemium, Subscription, Ad-based, One time purchase, Fees)
- **Status**: ✅ Has associated model
- **Note**: Added `slug` field to each entry

### 6. **user-spans.ts**
- **Type**: `EstimatedUserSpanOptionDto` from `libs/domains/catalog/metrics/src/application/models/estimated-user-span-option.dto.ts`
- **Description**: 5 user span ranges with `from` and `to` fields
- **Status**: ✅ Has associated model
- **Note**: Added `slug` field and calculated numeric ranges

### 7. **tags.ts**
- **Type**: `TagOptionDto` from `libs/domains/catalog/tags/src/application/models/tag-option.dto.ts`
- **Description**: 4,156 tags converted from tags.json
- **Status**: ✅ Has associated model
- **Note**: Generated slugs from tag names

### 8. **stores.ts** ⚠️
- **Type**: `StoreOptionDto` - **NEWLY CREATED**
- **Location**: `libs/domains/catalog/references/src/application/models/store-option.dto.ts`
- **Description**: 4 app store options (GooglePlay, AppleStore, AppGallery, Microsoft store)
- **Status**: ❌ **Did NOT have associated model - created new DTO type**
- **Note**: Added `slug` field to each entry

## New Model Created

### StoreOptionDto
**Path**: `libs/domains/catalog/references/src/application/models/store-option.dto.ts`

```typescript
export type StoreOptionDto = {
  id: number;
  name: string;
  slug: string;
}
```

This type follows the same pattern as other option DTOs in the catalog domain (PlatformOptionDto, DeviceOptionDto, SocialOptionDto, etc.).

## Original Files

- **static.json**: Original JSON file containing all aggregated data - preserved
- **tags.json**: Original JSON file containing 4,156 tags - preserved

## Summary

- **Total TypeScript files created**: 8
- **Files with existing models**: 7
- **Files without models (new model created)**: 1 (stores)
- **Total data entries migrated**: ~4,378 items (4,156 tags + 222 other items)
