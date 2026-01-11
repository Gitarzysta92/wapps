import fetch from "node-fetch";

type ScrapedApp = {
  id?: number;
  name: string;
  url: string;
  slug: string;
  tags: string[];
  detailsLink: string;
  description: string;
  links: Array<{ id: number; link: string }>;
  assets: Array<{ src: string; type: 'logo' | 'gallery' }>;
}

type AppInput = {
  url: string;
  name: string;
  tags: string[];
}

type JsonLdWebApplication = {
  "@context"?: string;
  "@type": "WebApplication";
  name?: string;
  description?: string;
  url?: string;
  image?: string;
  screenshot?: string[];
  [key: string]: unknown;
}

export class ScrapAppDetailsFromStoreAppV2 {
  public async handle(input: AppInput): Promise<ScrapedApp> {
    // Fetch HTML
    const response = await fetch(input.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract JSON-LD from script tag using regex
    const scriptMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    
    if (!scriptMatch || !scriptMatch[1]) {
      throw new Error('JSON-LD script tag not found');
    }

    let jsonLdData: JsonLdWebApplication;
    try {
      const content = scriptMatch[1].trim();
      const data = JSON.parse(content);
      
      if (data['@type'] !== 'WebApplication') {
        throw new Error(`Expected WebApplication, got ${data['@type']}`);
      }
      
      jsonLdData = data;
    } catch (error) {
      throw new Error(`Failed to parse JSON-LD: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Map JSON-LD to ScrapedApp
    const result: ScrapedApp = {
      name: jsonLdData.name || input.name || '',
      slug: (jsonLdData.name || input.name).trim().toLowerCase().replaceAll(' ', '-'),
      detailsLink: jsonLdData.url || input.url,
      tags: input.tags || [],
      description: jsonLdData.description || '',
      url: jsonLdData.url || input.url,
      links: [],
      assets: []
    };

    // Map screenshots
    if (jsonLdData.screenshot && Array.isArray(jsonLdData.screenshot)) {
      jsonLdData.screenshot.forEach(screenshot => {
        if (screenshot) {
          result.assets.push({
            src: screenshot,
            type: 'gallery'
          });
        }
      });
    }

    // Add main image as logo
    if (jsonLdData.image) {
      result.assets.push({
        src: jsonLdData.image,
        type: 'logo'
      });
    }

    return result;
  }
}
