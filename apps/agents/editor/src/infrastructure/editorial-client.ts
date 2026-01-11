import axios from 'axios';

export interface EditorialRecord {
  id?: number;
  slug: string;
  name: string;
  description: string;
  categoryId?: number;
  tagIds?: number[];
  platformIds?: number[];
  deviceIds?: number[];
  monetizationIds?: number[];
  userSpanId?: number;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  version?: string;
  releaseDate?: string;
  updateTimestamp?: number;
  creationTimestamp?: number;
  references?: Array<{ name: string; url: string; type: string }>;
}

export class EditorialClient {
  constructor(
    private readonly host: string,
    private readonly apiToken: string
  ) {}

  async findRecordBySlug(slug: string): Promise<EditorialRecord | null> {
    try {
      const response = await axios.get(
        `${this.host}/api/app-records`,
        {
          params: { 'filters[slug][$eq]': slug },
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );
      
      if (response.data.data && response.data.data.length > 0) {
        return this.mapStrapiToRecord(response.data.data[0]);
      }
      
      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createRecord(record: EditorialRecord): Promise<EditorialRecord> {
    try {
      console.log(`Creating new record: ${record.name}`);
      const response = await axios.post(
        `${this.host}/api/app-records`,
        { data: this.mapRecordToStrapi(record) },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );
      
      console.log(`✅ Created record: ${record.name} (ID: ${response.data.data.id})`);
      return this.mapStrapiToRecord(response.data.data);
    } catch (error) {
      console.error(`❌ Failed to create record ${record.name}:`, error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', JSON.stringify(error.response?.data, null, 2));
      }
      throw error;
    }
  }

  async updateRecord(id: number, record: Partial<EditorialRecord>): Promise<EditorialRecord> {
    try {
      console.log(`Updating record ID ${id}: ${record.name}`);
      const response = await axios.put(
        `${this.host}/api/app-records/${id}`,
        { data: this.mapRecordToStrapi(record) },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );
      
      console.log(`✅ Updated record: ${record.name}`);
      return this.mapStrapiToRecord(response.data.data);
    } catch (error) {
      console.error(`❌ Failed to update record ${record.name}:`, error);
      throw error;
    }
  }

  private mapStrapiToRecord(strapiData: any): EditorialRecord {
    const attrs = strapiData.attributes || strapiData;
    return {
      id: strapiData.id,
      slug: attrs.slug,
      name: attrs.name,
      description: attrs.description,
      categoryId: attrs.category?.data?.id,
      tagIds: attrs.tags?.data?.map((t: any) => t.id) || [],
      platformIds: attrs.platforms?.data?.map((p: any) => p.id) || [],
      deviceIds: attrs.devices?.data?.map((d: any) => d.id) || [],
      monetizationIds: attrs.monetizations?.data?.map((m: any) => m.id) || [],
      userSpanId: attrs.userSpan?.data?.id,
      website: attrs.website,
      email: attrs.email,
      phone: attrs.phone,
      address: attrs.address,
      city: attrs.city,
      state: attrs.state,
      zip: attrs.zip,
      country: attrs.country,
      latitude: attrs.latitude,
      longitude: attrs.longitude,
      version: attrs.version,
      releaseDate: attrs.releaseDate,
      updateTimestamp: attrs.updateTimestamp,
      creationTimestamp: attrs.creationTimestamp,
    };
  }

  private mapRecordToStrapi(record: Partial<EditorialRecord>): any {
    const data: any = {};
    
    if (record.slug) data.slug = record.slug;
    if (record.name) data.name = record.name;
    if (record.description) data.description = record.description;
    if (record.categoryId) data.category = record.categoryId;
    if (record.tagIds) data.tags = record.tagIds;
    if (record.platformIds) data.platforms = record.platformIds;
    if (record.deviceIds) data.devices = record.deviceIds;
    if (record.monetizationIds) data.monetizations = record.monetizationIds;
    if (record.userSpanId) data.userSpan = record.userSpanId;
    if (record.website) data.website = record.website;
    if (record.email) data.email = record.email;
    if (record.phone) data.phone = record.phone;
    if (record.address) data.address = record.address;
    if (record.city) data.city = record.city;
    if (record.state) data.state = record.state;
    if (record.zip) data.zip = record.zip;
    if (record.country) data.country = record.country;
    if (record.latitude !== undefined) data.latitude = record.latitude;
    if (record.longitude !== undefined) data.longitude = record.longitude;
    if (record.version) data.version = record.version;
    if (record.releaseDate) data.releaseDate = record.releaseDate;
    if (record.updateTimestamp) data.updateTimestamp = record.updateTimestamp;
    if (record.creationTimestamp) data.creationTimestamp = record.creationTimestamp;
    
    data.isSuspended = false;
    
    return data;
  }
}
