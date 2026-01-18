import OpenAI from "openai";

type OutputItem = { type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> };
type ResponseLike = { output?: OutputItem[]; output_text?: string };

function extractTextAndRefusals(response: ResponseLike): { text: string; refusals: string[] } {
  const refusals: string[] = [];
  const output = response.output ?? [];

  const text = output
    .filter((item): item is OutputItem & { type: "message" } => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .reduce(
      (acc, content) => {
        if (content.type === "output_text" && typeof content.text === "string") {
          acc.text += (acc.text ? "\n" : "") + content.text;
        } else if (content.type === "refusal" && typeof content.refusal === "string") {
          refusals.push(content.refusal);
        }
        return acc;
      },
      { text: "" }
    ).text;

  // Fallback to top-level output_text when manual extraction is empty
  const fallback =
    typeof response.output_text === "string" && response.output_text.trim().length > 0
      ? response.output_text.trim()
      : "";

  return {
    text: (text ?? "").trim() || fallback,
    refusals,
  };
}

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
        reasoning: { effort: "low" },
        text: {
          format: { type: "text" }
        },
        stream: false,
        max_output_tokens: 2000
      });

      const { text, refusals } = extractTextAndRefusals(response);

      if (!text) {
        if (refusals.length > 0) {
          throw new Error(
            `OpenAI refused to generate: ${refusals.join("; ").slice(0, 500)}`
          );
        }
        // Diagnostic: log output structure to help debug (avoid large payloads)
        const out = (response as ResponseLike).output ?? [];
        const outputSummary = out.map((i: OutputItem) => ({
          type: i.type,
          contentTypes: (i.content ?? []).map((c: { type?: string }) => c.type),
        }));
        console.error("OpenAI returned no output_text. output=", JSON.stringify(outputSummary));
        throw new Error("Failed to generate data from OpenAI: no output_text in response");
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

      const { text, refusals } = extractTextAndRefusals(response);

      if (!text && refusals.length > 0) {
        return `[OpenAI refused: ${refusals.join("; ").slice(0, 300)}]`;
      }
      return text || "Failed to generate text";
    } catch (error) {
      console.error("Error generating text with OpenAI:", error);
      throw error;
    }
  }
}
