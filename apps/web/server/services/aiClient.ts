// AI calls go directly to AICredits' OpenAI-compatible chat completions
// endpoint, per repo convention (no SDK wrapper).
const AICREDITS_URL = "https://aicredits.in/v1/chat/completions";

type ChatMessage = { role: "system" | "user"; content: string };

export async function chatCompletion(messages: ChatMessage[]): Promise<string | null> {
  const apiKey = process.env.AICREDITS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(AICREDITS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AICREDITS_MODEL || "claude-sonnet-5",
        messages,
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) {
      console.error(`AICredits request failed: ${res.status} ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("AICredits request errored:", err);
    return null;
  }
}
