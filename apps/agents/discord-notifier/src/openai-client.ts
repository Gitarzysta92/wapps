import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './constants';

export class OpenAIClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateNotes(userPrompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-5-nano', // Cheapest model available
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 1500,
      });

      return response.choices[0].message.content || 'Failed to generate notes';
    } catch (error) {
      console.error('Error generating notes with OpenAI:', error);
      throw error;
    }
  }
}
