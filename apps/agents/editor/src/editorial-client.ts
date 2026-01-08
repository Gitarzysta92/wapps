import axios from 'axios';
import FormData from 'form-data';

const EDITORIAL_SERVICE_HOST = process.env['EDITORIAL_SERVICE_HOST'];
const EDITORIAL_API_TOKEN = process.env['EDITORIAL_SERVICE_API_TOKEN'];

export interface ScrapedApp {
  name: string;
  slug: string;
  detailsLink: string;
  tags: string[];
  description: string;
  links: Array<{ id: number; link: string }>;
  assets: Array<{ src: string; type: 'logo' | 'gallery' }>;
}

export async function uploadImageToStrapi(imageUrl: string, name: string): Promise<number | null> {
  if (!EDITORIAL_SERVICE_HOST || !EDITORIAL_API_TOKEN) {
    throw new Error('EDITORIAL_SERVICE_HOST and EDITORIAL_API_TOKEN must be set');
  }

  try {
    // Download image from URL
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    const formData = new FormData();
    formData.append('files', imageBuffer, name);

    const response = await axios.post(
      `${EDITORIAL_SERVICE_HOST}/api/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${EDITORIAL_API_TOKEN}`,
        },
      }
    );

    return response.data[0]?.id || null;
  } catch (error) {
    console.error(`Failed to upload image ${name} to Strapi:`, error);
    return null;
  }
}

export async function findOrCreateTag(tagName: string): Promise<number | null> {
  if (!EDITORIAL_SERVICE_HOST || !EDITORIAL_API_TOKEN) {
    throw new Error('EDITORIAL_SERVICE_HOST and EDITORIAL_API_TOKEN must be set');
  }

  try {
    // Search for existing tag
    const searchResponse = await axios.get(
      `${EDITORIAL_SERVICE_HOST}/api/tags`,
      {
        params: { 'filters[name][$eq]': tagName },
        headers: { Authorization: `Bearer ${EDITORIAL_API_TOKEN}` },
      }
    );

    if (searchResponse.data.data.length > 0) {
      return searchResponse.data.data[0].id;
    }

    // Create new tag
    console.log(`Creating new tag: ${tagName}`);
    const createResponse = await axios.post(
      `${EDITORIAL_SERVICE_HOST}/api/tags`,
      {
        data: {
          name: tagName,
          slug: tagName.toLowerCase().replace(/\s+/g, '-'),
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${EDITORIAL_API_TOKEN}`,
        },
      }
    );

    return createResponse.data.data.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to find/create tag ${tagName}:`, errorMessage);
    if (axios.isAxiosError(error)) {
      console.error('Tag creation - Status:', error.response?.status);
      console.error('Tag creation - Response:', error.response?.data);
    }
    return null;
  }
}

export async function createOrUpdateAppRecord(scrapedApp: ScrapedApp): Promise<void> {
  if (!EDITORIAL_SERVICE_HOST || !EDITORIAL_API_TOKEN) {
    throw new Error('EDITORIAL_SERVICE_HOST and EDITORIAL_API_TOKEN must be set');
  }

  try {
    console.log(`📝 Processing app: ${scrapedApp.name}`);

    // Check if app already exists - handle 404 as "not found"
    let existingApp = null;
    try {
      const existingResponse = await axios.get(
        `${EDITORIAL_SERVICE_HOST}/api/app-records`,
        {
          params: { 'filters[slug][$eq]': scrapedApp.slug },
          headers: { Authorization: `Bearer ${EDITORIAL_API_TOKEN}` },
        }
      );
      existingApp = existingResponse.data.data[0];
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        throw error; // Re-throw non-404 errors
      }
      // 404 = doesn't exist, continue to create
      console.log(`Record not found for ${scrapedApp.slug}, will create new`);
    }

    // Process tags
    const tagIds: number[] = [];
    for (const tagName of scrapedApp.tags) {
      const tagId = await findOrCreateTag(tagName);
      if (tagId) tagIds.push(tagId);
    }

    // Upload images
    let logoId: number | null = null;
    const screenshotIds: number[] = [];

    for (const asset of scrapedApp.assets) {
      const fileName = `${scrapedApp.slug}-${asset.type}-${Date.now()}.jpg`;
      const uploadedId = await uploadImageToStrapi(asset.src, fileName);
      
      if (uploadedId) {
        if (asset.type === 'logo' && !logoId) {
          logoId = uploadedId;
        } else if (asset.type === 'gallery') {
          screenshotIds.push(uploadedId);
        }
      }
    }

    const appData: any = {
      name: scrapedApp.name,
      slug: scrapedApp.slug,
      description: scrapedApp.description,
      website: scrapedApp.detailsLink,
      tags: tagIds,
      isSuspended: false,
    };

    if (logoId) {
      appData.logo = logoId;
    }

    if (screenshotIds.length > 0) {
      appData.screenshots = screenshotIds;
    }

    if (existingApp) {
      // Update existing
      await axios.put(
        `${EDITORIAL_SERVICE_HOST}/api/app-records/${existingApp.id}`,
        { data: appData },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${EDITORIAL_API_TOKEN}`,
          },
        }
      );
      console.log(`✅ Updated app: ${scrapedApp.name}`);
    } else {
      // Create new
      console.log(`Creating new record for: ${scrapedApp.name}`);
      console.log(`POST ${EDITORIAL_SERVICE_HOST}/api/app-records`);
      const createResponse = await axios.post(
        `${EDITORIAL_SERVICE_HOST}/api/app-records`,
        { data: appData },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${EDITORIAL_API_TOKEN}`,
          },
        }
      );
      console.log(`✅ Created app: ${scrapedApp.name} (ID: ${createResponse.data.data.id})`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to process app ${scrapedApp.name}:`, errorMessage);
    if (axios.isAxiosError(error)) {
      console.error('Request URL:', error.config?.url);
      console.error('Request Method:', error.config?.method);
      console.error('Response Status:', error.response?.status);
      console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    }
    throw error;
  }
}

