import { RawRecordDto } from '@domains/catalog/record';
import { OpenAIClient } from '../../infrastructure/openai-client';
import { EditorialClient, EditorialRecord } from '../../infrastructure/editorial-client';
import { SYSTEM_PROMPT_DATA_ENRICHMENT, USER_PROMPT_TEMPLATE_DATA_ENRICHMENT } from '../constants';
import { categories } from '../../../../../../data/categories';
import { platforms } from '../../../../../../data/platforms';
import { devices } from '../../../../../../data/devices';
import { monetizationModels } from '../../../../../../data/monetization-models';
import { userSpans } from '../../../../../../data/user-spans';
import { tags } from '../../../../../../data/tags';

interface EnrichedData {
  categoryId: number | null;
  tagIds: number[];
  platformIds: number[];
  deviceIds: number[];
  monetizationIds: number[];
  userSpanId: number | null;
  contact: {
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  compatibility: {
    deviceIds: number[];
    platformIds: number[];
  };
  version: string | null;
  references: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

export class DataEnrichmentService {
  constructor(
    private readonly openaiClient: OpenAIClient,
    private readonly editorialClient: EditorialClient
  ) {}

  async processRawRecord(rawRecord: RawRecordDto): Promise<void> {
    console.log(`📝 Processing raw record: ${rawRecord.name}`);

    try {
      // Check if record exists
      const existingRecord = await this.editorialClient.findRecordBySlug(rawRecord.slug);

      // Enrich data using OpenAI
      const enrichedData = await this.enrichData(rawRecord, existingRecord);

      // Build the complete record
      const record: EditorialRecord = {
        slug: rawRecord.slug,
        name: rawRecord.name,
        description: rawRecord.description,
        categoryId: enrichedData.categoryId || undefined,
        tagIds: enrichedData.tagIds,
        platformIds: enrichedData.platformIds,
        deviceIds: enrichedData.deviceIds,
        monetizationIds: enrichedData.monetizationIds,
        userSpanId: enrichedData.userSpanId || undefined,
        website: enrichedData.contact.website || undefined,
        email: enrichedData.contact.email || undefined,
        phone: enrichedData.contact.phone || undefined,
        address: enrichedData.contact.address || undefined,
        city: enrichedData.contact.city || undefined,
        state: enrichedData.contact.state || undefined,
        zip: enrichedData.contact.zip || undefined,
        country: enrichedData.contact.country || undefined,
        latitude: enrichedData.contact.latitude || undefined,
        longitude: enrichedData.contact.longitude || undefined,
        version: enrichedData.version || undefined,
        updateTimestamp: Date.now(),
        creationTimestamp: existingRecord?.creationTimestamp || Date.now(),
        references: enrichedData.references,
      };

      // Create or update record
      if (existingRecord) {
        console.log(`📝 Updating existing record: ${rawRecord.name}`);
        await this.editorialClient.updateRecord(existingRecord.id!, record);
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

    // Prepare static data summaries for OpenAI
    const categoriesSummary = this.flattenCategories(categories)
      .map(c => `${c.id}: ${c.name}`)
      .join(', ');

    const tagsSummary = tags
      .slice(0, 200) // Limit to avoid token overflow
      .map((t: { id: number; name: string }) => `${t.id}: ${t.name}`)
      .join(', ');

    const platformsSummary = platforms
      .map((p: { id: number; name: string }) => `${p.id}: ${p.name}`)
      .join(', ');

    const devicesSummary = devices
      .map((d: { id: number; name: string }) => `${d.id}: ${d.name}`)
      .join(', ');

    const monetizationSummary = monetizationModels
      .map((m: { id: number; name: string }) => `${m.id}: ${m.name}`)
      .join(', ');

    const userSpansSummary = userSpans
      .map((u: { id: number; name: string; from: number; to: number }) => `${u.id}: ${u.name} (${u.from}-${u.to})`)
      .join(', ');

    const currentData = existingRecord 
      ? JSON.stringify({
          categoryId: existingRecord.categoryId,
          tagIds: existingRecord.tagIds,
          platformIds: existingRecord.platformIds,
          deviceIds: existingRecord.deviceIds,
          monetizationIds: existingRecord.monetizationIds,
          userSpanId: existingRecord.userSpanId,
        }, null, 2)
      : 'No existing data';

    const userPrompt = USER_PROMPT_TEMPLATE_DATA_ENRICHMENT
      .replace('{{APP_NAME}}', rawRecord.name)
      .replace('{{APP_SLUG}}', rawRecord.slug)
      .replace('{{APP_DESCRIPTION}}', rawRecord.description)
      .replace('{{APP_CATEGORY}}', rawRecord.category || 'Not specified')
      .replace('{{APP_TAGS}}', rawRecord.tags.join(', ') || 'None')
      .replace('{{APP_PLATFORMS}}', rawRecord.platforms.join(', ') || 'None')
      .replace('{{CATEGORIES}}', categoriesSummary)
      .replace('{{TAGS}}', tagsSummary)
      .replace('{{PLATFORMS}}', platformsSummary)
      .replace('{{DEVICES}}', devicesSummary)
      .replace('{{MONETIZATION_MODELS}}', monetizationSummary)
      .replace('{{USER_SPANS}}', userSpansSummary)
      .replace('{{CURRENT_DATA}}', currentData);

    try {
      const enrichedData = await this.openaiClient.generateStructuredData<EnrichedData>(
        SYSTEM_PROMPT_DATA_ENRICHMENT,
        userPrompt
      );

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

    // Try to match category by name
    const categoryId = this.findCategoryByName(rawRecord.category) || null;

    // Try to match platforms by name
    const platformIds = rawRecord.platforms
      .map(p => platforms.find((pl: { id: number; name: string }) => pl.name.toLowerCase() === p.toLowerCase())?.id)
      .filter((id): id is number => id !== undefined);

    // Try to match tags by name
    const tagIds = rawRecord.tags
      .map(t => tags.find((tag: { id: number; name: string }) => tag.name.toLowerCase() === t.toLowerCase())?.id)
      .filter((id): id is number => id !== undefined);

    return {
      categoryId,
      tagIds,
      platformIds,
      deviceIds: [],
      monetizationIds: [],
      userSpanId: null,
      contact: {
        email: null,
        phone: null,
        website: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        country: null,
        latitude: null,
        longitude: null,
      },
      compatibility: {
        deviceIds: [],
        platformIds,
      },
      version: null,
      references: [],
    };
  }

  private flattenCategories(cats: any[]): Array<{ id: number; name: string }> {
    const result: Array<{ id: number; name: string }> = [];
    
    const flatten = (items: any[]) => {
      for (const item of items) {
        result.push({ id: item.id, name: item.name });
        if (item.childs && item.childs.length > 0) {
          flatten(item.childs);
        }
      }
    };
    
    flatten(cats);
    return result;
  }

  private findCategoryByName(categoryName: string): number | undefined {
    if (!categoryName) return undefined;
    
    const flattened = this.flattenCategories(categories);
    const found = flattened.find(
      c => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    return found?.id;
  }
}
