export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatOptions = {
  model?: string;
  json?: boolean;
};

type DeepSeekResponse = {
  choices: Array<{
    message: { content: string };
  }>;
};

export async function chat(
  messages: Message[],
  options: ChatOptions = {}
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is not set. Configure it in your environment to use AI features."
    );
  }

  const baseUrl =
    process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model =
    options.model ??
    process.env.DEEPSEEK_MODEL_FLASH ??
    "deepseek-chat";

  const body: Record<string, unknown> = {
    model,
    messages,
    thinking: { type: "disabled" },
  };

  if (options.json) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`DeepSeek API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as DeepSeekResponse;
  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    throw new Error("DeepSeek returned an empty response.");
  }
  return content;
}
