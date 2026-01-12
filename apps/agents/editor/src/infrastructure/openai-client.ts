import OpenAI from "openai";

export class OpenAIClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateStructuredData<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    try {
      const response = await this.client.responses.create({
        model: "gpt-5-nano",
        input: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        reasoning: { effort: "medium" },
        text: {
          format: { type: "text" }
        },
        stream: false,
        max_output_tokens: 2000
      });

      const text = response.output
        .filter(item => item.type === "message")
        .flatMap(item => item.content)
        .filter(content => content.type === "output_text")
        .map(content => content.text)
        .join("\n");

      if (!text) {
        throw new Error("Failed to generate data from OpenAI");
      }

      // Try to extract JSON from the response
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]) as T;
      }

      // If no JSON found, try to parse the entire text
      return JSON.parse(text) as T;
    } catch (error) {
      console.error("Error generating structured data with OpenAI:", error);
      throw error;
    }
  }

  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await this.client.responses.create({
        model: "gpt-5-nano",
        input: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        reasoning: { effort: "low" },
        text: {
          format: { type: "text" }
        },
        stream: false,
        max_output_tokens: 1500
      });

      const text = response.output
        .filter(item => item.type === "message")
        .flatMap(item => item.content)
        .filter(content => content.type === "output_text")
        .map(content => content.text)
        .join("\n");

      return text || "Failed to generate text";
    } catch (error) {
      console.error("Error generating text with OpenAI:", error);
      throw error;
    }
  }
}
