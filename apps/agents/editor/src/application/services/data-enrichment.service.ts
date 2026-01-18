import { RawRecordDto } from '@domains/catalog/record';
import { CategoryTreeDto } from '@domains/catalog/category';
import { OpenAIClient } from '../../infrastructure/openai-client';
import { EditorialClient, EditorialRecord } from '../../infrastructure/editorial-client';
import { SYSTEM_PROMPT_DATA_ENRICHMENT, USER_PROMPT_TEMPLATE_DATA_ENRICHMENT } from '../constants';
import { categories, platforms, devices, monetizationModels, tags } from '@data';

interface EnrichedData {
  categoryId: string | null;
  tagIds: string[];
  platformIds: string[];
  deviceIds: string[];
  monetizationModelIds: string[];
  website: string | null;
  isPwa: boolean;
  rating: number | null;
  estimatedNumberOfUsers: number | null;
  logoUrl: string | null;
  bannerUrl: string | null;
}

export class DataEnrichmentService {
  private categoriesMap: Map<string, string> = new Map(); // slug -> id
  private tagsMap: Map<string, string> = new Map(); // slug -> id
  private platformsMap: Map<string, string> = new Map(); // slug -> id
  private devicesMap: Map<string, string> = new Map(); // slug -> id
  private monetizationModelsMap: Map<string, string> = new Map(); // slug -> id
  private initialized = false;

  constructor(
    private readonly openaiClient: OpenAIClient,
    private readonly editorialClient: EditorialClient
  ) {}

  private async initializeMaps(): Promise<void> {
    if (this.initialized) return;

    try {
      const [categories, tags, platforms, devices, monetizationModels] = await Promise.all([
        this.editorialClient.getCategories(),
        this.editorialClient.getTags(),
        this.editorialClient.getPlatforms(),
        this.editorialClient.getDevices(),
        this.editorialClient.getMonetizationModels(),
      ]);

      categories.forEach(c => this.categoriesMap.set(c.slug, c.id));
      tags.forEach(t => this.tagsMap.set(t.slug, t.id));
      platforms.forEach(p => this.platformsMap.set(p.slug, p.id));
      devices.forEach(d => this.devicesMap.set(d.slug, d.id));
      monetizationModels.forEach(m => this.monetizationModelsMap.set(m.slug, m.id));

      this.initialized = true;
      console.log('✅ Reference data initialized');
    } catch (error) {
      console.error('❌ Failed to initialize reference data:', error);
      throw error;
    }
  }

  async processRawRecord(rawRecord: RawRecordDto): Promise<void> {
    console.log(`📝 Processing raw record: ${rawRecord.name}`);

    try {
      // Initialize reference data maps
      await this.initializeMaps();

      // Check if record exists
      const existingRecord = await this.editorialClient.findRecordBySlug(rawRecord.slug);

      // Enrich data using OpenAI
      const enrichedData = await this.enrichData(rawRecord, existingRecord);

      // Build the complete record
      const record: EditorialRecord = {
        slug: rawRecord.slug,
        name: rawRecord.name,
        description: rawRecord.description,
        website: enrichedData.website || undefined,
        isPwa: enrichedData.isPwa || false,
        rating: enrichedData.rating || undefined,
        estimatedNumberOfUsers: enrichedData.estimatedNumberOfUsers || undefined,
        isSuspended: false,
        logoUrl: enrichedData.logoUrl || undefined,
        bannerUrl: enrichedData.bannerUrl || undefined,
        category: enrichedData.categoryId || undefined,
        tags: enrichedData.tagIds,
        platforms: enrichedData.platformIds,
        devices: enrichedData.deviceIds,
        monetizationModels: enrichedData.monetizationModelIds,
      };

      // Create or update record
      if (existingRecord && existingRecord.id) {
        console.log(`📝 Updating existing record: ${rawRecord.name}`);
        await this.editorialClient.updateRecord(existingRecord.id, record);
      } else {
        console.log(`📝 Creating new record: ${rawRecord.name}`);
        await this.editorialClient.createRecord(record);
      }

      console.log(`✅ Successfully processed: ${rawRecord.name}`);
    } catch (error) {
      console.error(`❌ Error processing record ${rawRecord.name}:`, error);
      throw error;
    }
  }

  private async enrichData(
    rawRecord: RawRecordDto,
    existingRecord: EditorialRecord | null
  ): Promise<EnrichedData> {
    console.log(`🤖 Enriching data with OpenAI for: ${rawRecord.name}`);

    // Prepare static data summaries for OpenAI using slugs
    const categoriesSummary = this.flattenCategories(categories)
      .map(c => `${c.slug}: ${c.name}`)
      .join(', ');

    const tagsSummary = tags
      .slice(0, 200) // Limit to avoid token overflow
      .map((t: { id: number; name: string; slug: string }) => `${t.slug}: ${t.name}`)
      .join(', ');

    const platformsSummary = platforms
      .map((p: { id: number; name: string; slug: string }) => `${p.slug}: ${p.name}`)
      .join(', ');

    const devicesSummary = devices
      .map((d: { id: number; name: string; slug: string }) => `${d.slug}: ${d.name}`)
      .join(', ');

    const monetizationSummary = monetizationModels
      .map((m: { id: number; name: string; slug: string }) => `${m.slug}: ${m.name}`)
      .join(', ');

    const currentData = existingRecord 
      ? JSON.stringify({
          category: existingRecord.category,
          tags: existingRecord.tags,
          platforms: existingRecord.platforms,
          devices: existingRecord.devices,
          monetizationModels: existingRecord.monetizationModels,
        }, null, 2)
      : 'No existing data';

    const userPrompt = USER_PROMPT_TEMPLATE_DATA_ENRICHMENT
      .replace('{{APP_NAME}}', rawRecord.name)
      .replace('{{APP_SLUG}}', rawRecord.slug)
      .replace('{{APP_DESCRIPTION}}', rawRecord.description)
      .replace('{{APP_CATEGORY}}', rawRecord.category || 'Not specified')
      .replace('{{APP_TAGS}}', (rawRecord.tags ?? []).join(', ') || 'None')
      .replace('{{APP_PLATFORMS}}', (rawRecord.platforms ?? []).join(', ') || 'None')
      .replace('{{CATEGORIES}}', categoriesSummary)
      .replace('{{TAGS}}', tagsSummary)
      .replace('{{PLATFORMS}}', platformsSummary)
      .replace('{{DEVICES}}', devicesSummary)
      .replace('{{MONETIZATION_MODELS}}', monetizationSummary)
      .replace('{{CURRENT_DATA}}', currentData);

    try {
      // OpenAI should return slugs which we'll convert to UUIDs
      interface OpenAIEnrichedData {
        categorySlug: string | null;
        tagSlugs: string[];
        platformSlugs: string[];
        deviceSlugs: string[];
        monetizationModelSlugs: string[];
        website: string | null;
        isPwa: boolean;
        rating: number | null;
        estimatedNumberOfUsers: number | null;
        logoUrl: string | null;
        bannerUrl: string | null;
      }

      const openAIData = await this.openaiClient.generateStructuredData<OpenAIEnrichedData>(
        SYSTEM_PROMPT_DATA_ENRICHMENT,
        userPrompt
      );

      // Convert slugs to UUIDs (guard against missing/partial arrays from OpenAI)
      const tagSlugs = Array.isArray(openAIData.tagSlugs) ? openAIData.tagSlugs : [];
      const platformSlugs = Array.isArray(openAIData.platformSlugs) ? openAIData.platformSlugs : [];
      const deviceSlugs = Array.isArray(openAIData.deviceSlugs) ? openAIData.deviceSlugs : [];
      const monetizationSlugs = Array.isArray(openAIData.monetizationModelSlugs) ? openAIData.monetizationModelSlugs : [];

      const enrichedData: EnrichedData = {
        categoryId: openAIData.categorySlug ? this.categoriesMap.get(openAIData.categorySlug) || null : null,
        tagIds: tagSlugs.map(slug => this.tagsMap.get(slug)).filter((id): id is string => !!id),
        platformIds: platformSlugs.map(slug => this.platformsMap.get(slug)).filter((id): id is string => !!id),
        deviceIds: deviceSlugs.map(slug => this.devicesMap.get(slug)).filter((id): id is string => !!id),
        monetizationModelIds: monetizationSlugs.map(slug => this.monetizationModelsMap.get(slug)).filter((id): id is string => !!id),
        website: openAIData.website ?? null,
        isPwa: openAIData.isPwa ?? false,
        rating: openAIData.rating ?? null,
        estimatedNumberOfUsers: openAIData.estimatedNumberOfUsers ?? null,
        logoUrl: openAIData.logoUrl ?? null,
        bannerUrl: openAIData.bannerUrl ?? null,
      };

      console.log(`✅ Data enriched successfully for: ${rawRecord.name}`);
      return enrichedData;
    } catch (error) {
      console.error(`❌ Failed to enrich data with OpenAI for ${rawRecord.name}:`, error);
      
      // Fallback to basic mapping if OpenAI fails
      return this.fallbackEnrichment(rawRecord);
    }
  }

  private fallbackEnrichment(rawRecord: RawRecordDto): EnrichedData {
    console.log(`⚠️  Using fallback enrichment for: ${rawRecord.name}`);

    // Try to match category by slug from static data
    const categorySlug = this.findCategorySlugByName(rawRecord.category);
    const categoryId = categorySlug ? this.categoriesMap.get(categorySlug) || null : null;

    // Match platforms by slug from static data
    interface PlatformData { id: number; name: string; slug: string }
    const platformIds = (rawRecord.platforms ?? [])
      .map(p => {
        const platformData = platforms.find((pl: PlatformData) =>
          pl.slug === p.toLowerCase() || pl.name.toLowerCase() === p.toLowerCase()
        );
        return platformData?.slug ? this.platformsMap.get(platformData.slug) : undefined;
      })
      .filter((id): id is string => id !== undefined);

    // Match tags by slug from static data
    interface TagData { id: number; name: string; slug: string }
    const tagIds = (rawRecord.tags ?? [])
      .map(t => {
        const tagData = tags.find((tag: TagData) =>
          tag.slug === t.toLowerCase() || tag.name.toLowerCase() === t.toLowerCase()
        );
        return tagData?.slug ? this.tagsMap.get(tagData.slug) : undefined;
      })
      .filter((id): id is string => id !== undefined);

    return {
      categoryId,
      tagIds,
      platformIds,
      deviceIds: [],
      monetizationModelIds: [],
      website: null,
      isPwa: false,
      rating: null,
      estimatedNumberOfUsers: null,
      logoUrl: null,
      bannerUrl: null,
    };
  }

  private flattenCategories(cats: CategoryTreeDto[]): Array<{ id: number; name: string; slug: string }> {
    const result: Array<{ id: number; name: string; slug: string }> = [];
    
    const flatten = (items: CategoryTreeDto[]) => {
      for (const item of items) {
        result.push({ id: item.id, name: item.name, slug: item.slug });
        if (item.childs && item.childs.length > 0) {
          flatten(item.childs);
        }
      }
    };
    
    flatten(cats);
    return result;
  }

  private findCategorySlugByName(categoryName: string): string | undefined {
    if (!categoryName) return undefined;
    
    const flattened = this.flattenCategories(categories);
    // First try exact slug match, then fall back to name match
    const foundBySlug = flattened.find(c => c.slug === categoryName.toLowerCase());
    if (foundBySlug) return foundBySlug.slug;
    
    const foundByName = flattened.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    return foundByName?.slug;
  }
}
