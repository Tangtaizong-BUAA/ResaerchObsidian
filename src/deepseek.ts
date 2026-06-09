export type AIProvider = "gemini" | "deepseek";

export interface AIClientConfig {
  provider: AIProvider;
  geminiApiKey: string;
  deepseekApiKey: string;
  model?: string;
}

export const MODEL_NAMES: Record<AIProvider, string> = {
  gemini: "gemini-3.1-flash-lite",
  deepseek: "deepseek-v4-flash",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEEPSEEK_BASE = "https://api.deepseek.com/chat/completions";
const QUESTION_ANSWER_MODEL = "gemini-3.5-flash";

export function getActiveApiKey(config: AIClientConfig): string {
  return config.provider === "gemini" ? config.geminiApiKey : config.deepseekApiKey;
}

export async function aiChat(
  config: AIClientConfig,
  messages: { role: string; content: string }[],
  opts: { stream?: boolean; max_tokens?: number; model?: string; temperature?: number } = {}
): Promise<string> {
  const apiKey = getActiveApiKey(config);
  if (!apiKey) return "";

  if (config.provider === "deepseek") {
    return deepseekChat(apiKey, messages, { ...opts, model: opts.model || config.model });
  }

  return geminiChat(apiKey, messages, { ...opts, model: opts.model || config.model });
}

export async function answerLastQuestion(
  config: AIClientConfig,
  documentText: string
): Promise<string> {
  if (!getActiveApiKey(config) || !documentText.trim()) return "";

  return aiChat(
    config,
    [
      {
        role: "system",
        content: `你是一个 Obsidian 笔记问答助手。用户会给你整篇笔记全文。
任务：
- 找到全文中最后一个明确的问题
- 只回答这个最后的问题
- 直接给出可粘贴到笔记里的答案
- 回答要完整展开，不要只给抽象结论或提纲
- 不要复述问题
- 不要解释你如何定位问题
- 如果全文没有明确问题，返回空字符串`,
      },
      { role: "user", content: documentText },
    ],
    { max_tokens: 3200, model: config.model || QUESTION_ANSWER_MODEL, temperature: 0.2 }
  );
}

export async function continueLastPart(
  config: AIClientConfig,
  documentText: string
): Promise<string> {
  if (!getActiveApiKey(config) || !documentText.trim()) return "";

  return aiChat(
    config,
    [
      {
        role: "system",
        content: `你是一个 Obsidian 写作续写助手。用户会给你整篇笔记全文。
任务：
- 学习用户在上文中的语言习惯、语气、节奏和表达密度
- 只续写或补全全文最后尚未完成的部分
- 续写要形成完整段落，不要只输出几个关键词、抽象句或提纲
- 用自然、具体、可直接放入笔记的表达
- 保持用户原有语言风格，不要变成 AI 腔
- 不要重复上文已有内容
- 不要加标题、解释、前言或总结
- 只输出要插入到光标处的续写文本
- 如果最后部分已经完整，返回空字符串`,
      },
      { role: "user", content: documentText },
    ],
    { max_tokens: 2400, model: config.model || QUESTION_ANSWER_MODEL, temperature: 0.35 }
  );
}

async function geminiChat(
  apiKey: string,
  messages: { role: string; content: string }[],
  opts: { stream?: boolean; max_tokens?: number; model?: string; temperature?: number } = {}
): Promise<string> {
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  const contents = userMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const model = opts.model?.trim() || MODEL_NAMES.gemini;
  const body = buildGeminiBody(contents, systemMsg?.content, opts, shouldDisableThinking(model));

  let res = await fetch(
    `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok && res.status === 400 && body.thinkingConfig) {
    res = await fetch(
      `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildGeminiBody(contents, systemMsg?.content, opts, false)),
      }
    );
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return collectGeminiText(data);
}

function collectGeminiText(data: any): string {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function buildGeminiBody(
  contents: { role: string; parts: { text: string }[] }[],
  systemText: string | undefined,
  opts: { max_tokens?: number; temperature?: number },
  disableThinking: boolean
) {
  const body: any = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.max_tokens ?? 256,
      temperature: opts.temperature ?? 0.1,
    },
  };

  if (disableThinking) {
    body.thinkingConfig = { thinkingBudget: 0 };
  }

  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }

  return body;
}

function shouldDisableThinking(model: string): boolean {
  return model.toLowerCase().includes("flash-lite");
}

async function deepseekChat(
  apiKey: string,
  messages: { role: string; content: string }[],
  opts: { stream?: boolean; max_tokens?: number; model?: string; temperature?: number } = {}
): Promise<string> {
  const res = await fetch(DEEPSEEK_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model?.trim() || MODEL_NAMES.deepseek,
      messages,
      max_tokens: opts.max_tokens ?? 512,
      temperature: opts.temperature ?? 0.2,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
