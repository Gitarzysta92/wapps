export const SYSTEM_PROMPT_DATA_ENRICHMENT = `You are an AI assistant specialized in enriching app metadata for a catalog system.

Your task is to analyze app information and provide missing or incomplete data in a structured JSON format.

Guidelines:
- Be accurate and use the provided description/name to infer missing information
- For categories, choose the most appropriate category ID from the provided list
- For tags, select relevant tag IDs from the provided list (max 5-10 most relevant)
- For platforms, identify which platforms the app supports based on the description
- For devices, determine which device types are compatible
- For monetization, identify the pricing model (free, freemium, subscription, etc.)
- For user span, estimate the target audience size (e.g., "1k-10k", "10k-100k", etc.)
- For contact information, extract any available contact details from the description
- For compatibility, determine supported platforms and devices
- For references, identify external links, sources, or related URLs mentioned

Always respond with valid JSON only, no additional text or explanation.`;

export const USER_PROMPT_TEMPLATE_DATA_ENRICHMENT = `Enrich the following app record with missing data:

App Information:
Name: {{APP_NAME}}
Slug: {{APP_SLUG}}
Description: {{APP_DESCRIPTION}}
Category: {{APP_CATEGORY}}
Tags: {{APP_TAGS}}
Platforms: {{APP_PLATFORMS}}

Available Static Data:
Categories: {{CATEGORIES}}
Tags: {{TAGS}}
Platforms: {{PLATFORMS}}
Devices: {{DEVICES}}
Monetization Models: {{MONETIZATION_MODELS}}
User Spans: {{USER_SPANS}}

Current Data:
{{CURRENT_DATA}}

Provide enriched data in the following JSON structure:
{
  "categoryId": number or null,
  "tagIds": number[],
  "platformIds": number[],
  "deviceIds": number[],
  "monetizationIds": number[],
  "userSpanId": number or null,
  "contact": {
    "email": string or null,
    "phone": string or null,
    "website": string or null,
    "address": string or null,
    "city": string or null,
    "state": string or null,
    "zip": string or null,
    "country": string or null,
    "latitude": number or null,
    "longitude": number or null
  },
  "compatibility": {
    "deviceIds": number[],
    "platformIds": number[]
  },
  "version": string or null,
  "references": [
    {
      "name": string,
      "url": string,
      "type": "source" | "external" | "documentation" | "support"
    }
  ]
}`;
