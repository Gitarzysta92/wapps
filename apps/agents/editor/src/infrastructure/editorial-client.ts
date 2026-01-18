import axios from 'axios';

export interface EditorialRecord {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  website?: string;
  isPwa?: boolean;
  rating?: number;
  estimatedNumberOfUsers?: number;
  isSuspended?: boolean;
  logoUrl?: string;
  bannerUrl?: string;
  category?: string; // UUID
  tags?: string[]; // UUIDs
  platforms?: string[]; // UUIDs
  devices?: string[]; // UUIDs
  monetizationModels?: string[]; // UUIDs
  createdAt?: Date;
  updatedAt?: Date;
}

export class EditorialClient {
  constructor(
    private readonly host: string,
    private readonly apiToken: string
  ) {}

  async findRecordBySlug(slug: string): Promise<EditorialRecord | null> {
    try {
      const response = await axios.get<EditorialRecord[]>(
        `${this.host}/api/apps`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );
      
      // Find the record with matching slug
      const record = response.data?.find((app) => app.slug === slug);
      return record || null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async findRecordById(id: string): Promise<EditorialRecord | null> {
    try {
      const response = await axios.get(
        `${this.host}/api/apps/${id}`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );
      
      return response.data || null;
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
        `${this.host}/api/apps`,
        record,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );
      
      console.log(`✅ Created record: ${record.name} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to create record ${record.name}:`, error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', JSON.stringify(error.response?.data, null, 2));
      }
      throw error;
    }
  }

  async updateRecord(id: string, record: Partial<EditorialRecord>): Promise<EditorialRecord> {
    try {
      console.log(`Updating record ID ${id}: ${record.name}`);
      const response = await axios.put(
        `${this.host}/api/apps/${id}`,
        record,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );
      
      console.log(`✅ Updated record: ${record.name}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to update record ${record.name}:`, error);
      throw error;
    }
  }

  async deleteRecord(id: string): Promise<{ deleted: boolean }> {
    try {
      console.log(`Deleting record ID ${id}`);
      const response = await axios.delete(
        `${this.host}/api/apps/${id}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
        }
      );
      
      console.log(`✅ Deleted record ID: ${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to delete record ID ${id}:`, error);
      throw error;
    }
  }

  async getAllRecords(): Promise<EditorialRecord[]> {
    try {
      const response = await axios.get(
        `${this.host}/api/apps`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );
      
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch all records:', error);
      throw error;
    }
  }

  // Reference data methods
  async getPlatforms(): Promise<Array<{ id: string; name: string; slug: string }>> {
    try {
      const response = await axios.get(
        `${this.host}/api/reference/platforms`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch platforms:', error);
      throw error;
    }
  }

  async getDevices(): Promise<Array<{ id: string; name: string; slug: string }>> {
    try {
      const response = await axios.get(
        `${this.host}/api/reference/devices`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch devices:', error);
      throw error;
    }
  }

  async getMonetizationModels(): Promise<Array<{ id: string; name: string; slug: string }>> {
    try {
      const response = await axios.get(
        `${this.host}/api/reference/monetization-models`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch monetization models:', error);
      throw error;
    }
  }

  async getCategories(): Promise<Array<{ id: string; name: string; slug: string }>> {
    try {
      const response = await axios.get(
        `${this.host}/api/categories`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch categories:', error);
      throw error;
    }
  }

  async getTags(): Promise<Array<{ id: string; name: string; slug: string }>> {
    try {
      const response = await axios.get(
        `${this.host}/api/tags`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch tags:', error);
      throw error;
    }
  }
}
