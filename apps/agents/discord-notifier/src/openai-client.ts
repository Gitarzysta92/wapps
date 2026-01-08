import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./constants";

export class OpenAIClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateNotes(userPrompt: string): Promise<string> {
    try {
      const response = await this.client.responses.create({
        model: "gpt-5-nano",
        input: [
          {
            role: "system",
            content: SYSTEM_PROMPT
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


      console.log(response.output);
      const text = response.output
        .filter(item => item.type === "message")
        .flatMap(item => item.content)
        .filter(content => content.type === "output_text")
        .map(content => content.text)
        .join("\n");

      return text || "Failed to generate notes";
    } catch (error) {
      console.error("Error generating notes with OpenAI:", error);
      throw error;
    }
  }
}