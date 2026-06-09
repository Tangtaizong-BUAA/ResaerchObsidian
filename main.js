var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AIEnhancerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/formulaCompletion.ts
var import_obsidian = require("obsidian");

// src/deepseek.ts
var MODEL_NAMES = {
  gemini: "gemini-3.1-flash-lite",
  deepseek: "deepseek-v4-flash"
};
var GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
var DEEPSEEK_BASE = "https://api.deepseek.com/chat/completions";
var QUESTION_ANSWER_MODEL = "gemini-3.5-flash";
function getActiveApiKey(config) {
  return config.provider === "gemini" ? config.geminiApiKey : config.deepseekApiKey;
}
async function aiChat(config, messages, opts = {}) {
  const apiKey = getActiveApiKey(config);
  if (!apiKey) return "";
  if (config.provider === "deepseek") {
    return deepseekChat(apiKey, messages, { ...opts, model: opts.model || config.model });
  }
  return geminiChat(apiKey, messages, { ...opts, model: opts.model || config.model });
}
async function answerLastQuestion(config, documentText) {
  if (!getActiveApiKey(config) || !documentText.trim()) return "";
  return aiChat(
    config,
    [
      {
        role: "system",
        content: `\u4F60\u662F\u4E00\u4E2A Obsidian \u7B14\u8BB0\u95EE\u7B54\u52A9\u624B\u3002\u7528\u6237\u4F1A\u7ED9\u4F60\u6574\u7BC7\u7B14\u8BB0\u5168\u6587\u3002
\u4EFB\u52A1\uFF1A
- \u627E\u5230\u5168\u6587\u4E2D\u6700\u540E\u4E00\u4E2A\u660E\u786E\u7684\u95EE\u9898
- \u53EA\u56DE\u7B54\u8FD9\u4E2A\u6700\u540E\u7684\u95EE\u9898
- \u76F4\u63A5\u7ED9\u51FA\u53EF\u7C98\u8D34\u5230\u7B14\u8BB0\u91CC\u7684\u7B54\u6848
- \u56DE\u7B54\u8981\u5B8C\u6574\u5C55\u5F00\uFF0C\u4E0D\u8981\u53EA\u7ED9\u62BD\u8C61\u7ED3\u8BBA\u6216\u63D0\u7EB2
- \u4E0D\u8981\u590D\u8FF0\u95EE\u9898
- \u4E0D\u8981\u89E3\u91CA\u4F60\u5982\u4F55\u5B9A\u4F4D\u95EE\u9898
- \u5982\u679C\u5168\u6587\u6CA1\u6709\u660E\u786E\u95EE\u9898\uFF0C\u8FD4\u56DE\u7A7A\u5B57\u7B26\u4E32`
      },
      { role: "user", content: documentText }
    ],
    { max_tokens: 3200, model: config.model || QUESTION_ANSWER_MODEL, temperature: 0.2 }
  );
}
async function continueLastPart(config, documentText) {
  if (!getActiveApiKey(config) || !documentText.trim()) return "";
  return aiChat(
    config,
    [
      {
        role: "system",
        content: `\u4F60\u662F\u4E00\u4E2A Obsidian \u5199\u4F5C\u7EED\u5199\u52A9\u624B\u3002\u7528\u6237\u4F1A\u7ED9\u4F60\u6574\u7BC7\u7B14\u8BB0\u5168\u6587\u3002
\u4EFB\u52A1\uFF1A
- \u5B66\u4E60\u7528\u6237\u5728\u4E0A\u6587\u4E2D\u7684\u8BED\u8A00\u4E60\u60EF\u3001\u8BED\u6C14\u3001\u8282\u594F\u548C\u8868\u8FBE\u5BC6\u5EA6
- \u53EA\u7EED\u5199\u6216\u8865\u5168\u5168\u6587\u6700\u540E\u5C1A\u672A\u5B8C\u6210\u7684\u90E8\u5206
- \u7EED\u5199\u8981\u5F62\u6210\u5B8C\u6574\u6BB5\u843D\uFF0C\u4E0D\u8981\u53EA\u8F93\u51FA\u51E0\u4E2A\u5173\u952E\u8BCD\u3001\u62BD\u8C61\u53E5\u6216\u63D0\u7EB2
- \u7528\u81EA\u7136\u3001\u5177\u4F53\u3001\u53EF\u76F4\u63A5\u653E\u5165\u7B14\u8BB0\u7684\u8868\u8FBE
- \u4FDD\u6301\u7528\u6237\u539F\u6709\u8BED\u8A00\u98CE\u683C\uFF0C\u4E0D\u8981\u53D8\u6210 AI \u8154
- \u4E0D\u8981\u91CD\u590D\u4E0A\u6587\u5DF2\u6709\u5185\u5BB9
- \u4E0D\u8981\u52A0\u6807\u9898\u3001\u89E3\u91CA\u3001\u524D\u8A00\u6216\u603B\u7ED3
- \u53EA\u8F93\u51FA\u8981\u63D2\u5165\u5230\u5149\u6807\u5904\u7684\u7EED\u5199\u6587\u672C
- \u5982\u679C\u6700\u540E\u90E8\u5206\u5DF2\u7ECF\u5B8C\u6574\uFF0C\u8FD4\u56DE\u7A7A\u5B57\u7B26\u4E32`
      },
      { role: "user", content: documentText }
    ],
    { max_tokens: 2400, model: config.model || QUESTION_ANSWER_MODEL, temperature: 0.35 }
  );
}
async function geminiChat(apiKey, messages, opts = {}) {
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");
  const contents = userMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  const model = opts.model?.trim() || MODEL_NAMES.gemini;
  const body = buildGeminiBody(contents, systemMsg?.content, opts, shouldDisableThinking(model));
  let res = await fetch(
    `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  if (!res.ok && res.status === 400 && body.thinkingConfig) {
    res = await fetch(
      `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildGeminiBody(contents, systemMsg?.content, opts, false))
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
function collectGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => typeof part?.text === "string" ? part.text : "").join("").trim();
}
function buildGeminiBody(contents, systemText, opts, disableThinking) {
  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.max_tokens ?? 256,
      temperature: opts.temperature ?? 0.1
    }
  };
  if (disableThinking) {
    body.thinkingConfig = { thinkingBudget: 0 };
  }
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }
  return body;
}
function shouldDisableThinking(model) {
  return model.toLowerCase().includes("flash-lite");
}
async function deepseekChat(apiKey, messages, opts = {}) {
  const res = await fetch(DEEPSEEK_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: opts.model?.trim() || MODEL_NAMES.deepseek,
      messages,
      max_tokens: opts.max_tokens ?? 512,
      temperature: opts.temperature ?? 0.2,
      stream: false
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// src/formulaCompletion.ts
var TERM_PATTERN = /[\u4e00-\u9fa5A-Za-z0-9α-ωΑ-Ω][\u4e00-\u9fa5A-Za-z0-9α-ωΑ-Ω+\-*/^_=<>≤≥≈∞() ]{0,64}$/;
var PREFETCH_TERM_PATTERN = /[\u4e00-\u9fa5A-Za-z0-9α-ωΑ-Ω][\u4e00-\u9fa5A-Za-z0-9α-ωΑ-Ω+\-*/^_=<>≤≥≈∞() ]{0,64}$/;
var SEMANTIC_BREAKS = /* @__PURE__ */ new Set(["\uFF0C", "\u3002", "\uFF1A", "\uFF1B", "\u3001", " ", ",", ".", ":", ";"]);
var L2_CACHE_KEY = "ai_formula_cache_v3";
var L2_CACHE_LIMIT = 300;
var EN_STOP_WORDS = /* @__PURE__ */ new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "between",
  "could",
  "should",
  "there",
  "these",
  "those",
  "where",
  "which",
  "while",
  "would"
]);
var FormulaCompleter = class extends import_obsidian.EditorSuggest {
  constructor(app, aiConfig) {
    super(app);
    this.l1Cache = /* @__PURE__ */ new Map();
    this.l2Cache = {};
    this.inflight = /* @__PURE__ */ new Map();
    this.l2Loaded = false;
    this.warming = false;
    this.isComposing = false;
    this.aiConfig = aiConfig;
    this.loadL2();
  }
  updateAIConfig(aiConfig) {
    this.aiConfig = aiConfig;
    this.l1Cache.clear();
    this.inflight.clear();
  }
  setComposing(isComposing) {
    this.isComposing = isComposing;
  }
  async warmup(termNames) {
    if (this.warming || !getActiveApiKey(this.aiConfig)) return;
    this.warming = true;
    this.loadL2();
    try {
      const uniqueNames = Array.from(new Set(termNames.map((name) => normalizeQuery(name)).filter(Boolean)));
      for (const name of uniqueNames.slice(0, 30)) {
        const cacheKey = this.getCacheKey(name, "");
        if (this.l1Cache.has(cacheKey) || this.l2Cache[cacheKey] || this.inflight.has(cacheKey)) continue;
        await sleep(200);
        void this.fetchAndCache(name, "", "", "");
      }
    } finally {
      this.warming = false;
    }
  }
  onTrigger(cursor, editor, file) {
    if (this.isComposing) return null;
    const line = editor.getLine(cursor.line);
    const beforeCursor = line.slice(0, cursor.ch);
    const dollarCount = (beforeCursor.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) return null;
    this.prefetchAtSemanticBreak(beforeCursor, editor, file);
    const match = beforeCursor.match(TERM_PATTERN);
    if (!match) return null;
    const term = normalizeQuery(match[0]);
    if (!shouldOfferFormulaHelp(term)) return null;
    return {
      start: { line: cursor.line, ch: cursor.ch - match[0].length },
      end: cursor,
      query: term
    };
  }
  async getSuggestions(context) {
    const query = normalizeQuery(context.query);
    if (!getActiveApiKey(this.aiConfig)) return [];
    const { focusLines, fullText, filePath } = this.getPromptContext(context.editor, context.file);
    return this.fetchAndCache(query, focusLines, fullText, filePath);
  }
  prefetchAtSemanticBreak(beforeCursor, editor, file) {
    const lastChar = beforeCursor.slice(-1);
    if (!SEMANTIC_BREAKS.has(lastChar)) return;
    const termMatch = beforeCursor.slice(0, -1).match(PREFETCH_TERM_PATTERN);
    if (!termMatch) return;
    const term = normalizeQuery(termMatch[0]);
    if (!this.isUsefulTerm(term)) return;
    const { focusLines, fullText, filePath } = this.getPromptContext(editor, file);
    void this.fetchAndCache(term, focusLines, fullText, filePath);
  }
  async fetchAndCache(query, focusLines = "", fullText = "", filePath = "") {
    const normalized = normalizeQuery(query);
    if (!normalized) return [];
    this.loadL2();
    const cacheKey = this.getCacheKey(normalized, filePath);
    if (this.l1Cache.has(cacheKey)) return this.l1Cache.get(cacheKey);
    if (this.l2Cache[cacheKey]) {
      this.l1Cache.set(cacheKey, this.l2Cache[cacheKey]);
      return this.l2Cache[cacheKey];
    }
    if (this.inflight.has(cacheKey)) return this.inflight.get(cacheKey);
    const request = this.callAPI(normalized, focusLines, fullText, filePath).then((result) => {
      this.l1Cache.set(cacheKey, result);
      if (result.length > 0) {
        this.l2Cache[cacheKey] = result;
        this.pruneL2();
        this.saveL2();
      }
      return result;
    }).finally(() => {
      this.inflight.delete(cacheKey);
    });
    this.inflight.set(cacheKey, request);
    return request;
  }
  async callAPI(query, focusLines, fullText, filePath) {
    try {
      const raw = await aiChat(
        this.aiConfig,
        [
          {
            role: "system",
            content: `\u4F60\u662F\u4E00\u4E2A\u5B66\u672F\u516C\u5F0F\u52A9\u624B\u3002\u6839\u636E\u7528\u6237\u6B63\u5728\u5199\u7684\u5B8C\u6574\u7B14\u8BB0\u5168\u6587\uFF0C\u63A8\u8350\u6700\u76F8\u5173\u7684\u516C\u5F0F\u3002
\u4E25\u683C\u8FD4\u56DEJSON\u6570\u7EC4\uFF0C\u6700\u591A3\u6761\uFF1A
[{"term":"\u672F\u8BED\u540D","latex":"LaTeX\u516C\u5F0F","description":"\u4E00\u53E5\u8BDD\u8BF4\u660E"}]
\u53EA\u8FD4\u56DEJSON\u3002`
          },
          {
            role: "user",
            content: `\u6587\u4EF6\uFF1A${filePath}
\u91CD\u70B9\u53C2\u8003\u5149\u6807\u524D3\u884C\uFF1A
${focusLines}

\u5168\u6587\uFF1A
${fullText}

\u5F53\u524D\u672F\u8BED\uFF1A${query}

\u8BF7\u5148\u91CD\u70B9\u770B\u5149\u6807\u524D3\u884C\uFF0C\u518D\u7ED3\u5408\u5168\u6587\u8BED\u5883\uFF0C\u63A8\u8350\u4E0E\u5F53\u524D\u672F\u8BED\u6700\u5339\u914D\u7684\u516C\u5F0F\uFF0C\u4E0D\u8981\u63A8\u8350\u65E0\u5173\u516C\u5F0F\u3002`
          }
        ],
        { max_tokens: 256 }
      );
      const parsed = parseJsonArray(raw);
      return parsed.filter((item) => item && typeof item.latex === "string" && item.latex.trim()).slice(0, 3).map((item) => ({
        term: typeof item.term === "string" && item.term.trim() ? item.term.trim() : query,
        latex: item.latex.replace(/^\$+|\$+$/g, "").trim(),
        description: typeof item.description === "string" && item.description.trim() ? item.description.trim() : item.term || query
      }));
    } catch {
      return [];
    }
  }
  getCacheKey(query, filePath) {
    return `${this.aiConfig.provider}:${this.aiConfig.model || ""}:${query.toLowerCase()}:${hashText(filePath)}`;
  }
  getPromptContext(editor, file) {
    const cursor = editor.getCursor();
    const startLine = Math.max(0, cursor.line - 3);
    const focusLines = Array.from(
      { length: cursor.line - startLine },
      (_, i) => editor.getLine(startLine + i)
    ).join("\n");
    return {
      focusLines,
      fullText: editor.getValue(),
      filePath: file?.path ?? ""
    };
  }
  isUsefulTerm(term) {
    return shouldOfferFormulaHelp(term);
  }
  loadL2() {
    if (this.l2Loaded) return;
    this.l2Loaded = true;
    try {
      const raw = localStorage.getItem(L2_CACHE_KEY);
      if (raw) this.l2Cache = JSON.parse(raw);
    } catch {
      this.l2Cache = {};
    }
  }
  saveL2() {
    try {
      localStorage.setItem(L2_CACHE_KEY, JSON.stringify(this.l2Cache));
    } catch {
    }
  }
  pruneL2() {
    const keys = Object.keys(this.l2Cache);
    if (keys.length <= L2_CACHE_LIMIT) return;
    for (const key of keys.slice(0, keys.length - L2_CACHE_LIMIT)) {
      delete this.l2Cache[key];
    }
  }
  renderSuggestion(suggestion, el) {
    el.createEl("div", {
      text: suggestion.description,
      cls: "ai-formula-desc"
    });
    el.createEl("code", {
      text: `$${suggestion.latex}$`,
      cls: "ai-formula-latex"
    });
  }
  selectSuggestion(suggestion, evt) {
    const { context } = this;
    if (!context) return;
    const { editor, start, end } = context;
    const original = normalizeQuery(context.query);
    editor.replaceRange(`${original} $${suggestion.latex}$`, start, end);
  }
};
function normalizeQuery(query) {
  return query.trim().replace(/\s+/g, " ");
}
function shouldOfferFormulaHelp(term) {
  const normalized = normalizeQuery(term);
  if (!normalized) return false;
  const hasChinese = /[\u4e00-\u9fa5]/.test(normalized);
  const hasMathSignal = /[0-9α-ωΑ-Ω+\-*/^_=<>≤≥≈∞()]/.test(normalized);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (hasChinese) return normalized.length >= 1;
  if (hasMathSignal) return normalized.length >= 1;
  if (words.length >= 2) return true;
  if (/^[A-Z]{1,8}\d*$/.test(normalized)) return true;
  if (/^[A-Za-z]{2,6}\d*$/.test(normalized)) return !EN_STOP_WORDS.has(normalized.toLowerCase());
  if (normalized.length >= 4) return !EN_STOP_WORDS.has(normalized.toLowerCase());
  return false;
}
function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(31, hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
function parseJsonArray(raw) {
  const cleaned = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}

// src/formulaReceiver.ts
var import_obsidian2 = require("obsidian");
var import_child_process = require("child_process");
var FormulaReceiver = class {
  constructor(app, settings) {
    this.process = null;
    this.app = app;
    this.settings = settings;
  }
  start() {
    if (this.process || !this.settings.formulaBridgePath) return;
    const command = this.settings.formulaBridgePath.endsWith(".js") ? "node" : this.settings.formulaBridgePath;
    const args = this.settings.formulaBridgePath.endsWith(".js") ? [this.settings.formulaBridgePath] : [];
    this.process = (0, import_child_process.spawn)(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.process.stdout?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const match = line.match(/^FORMULA:(.+)$/);
        if (match) {
          const latex = match[1].trim();
          this.insertFormula(latex);
        }
      }
    });
    this.process.stderr?.on("data", (data) => {
      console.log("[formula-bridge]", data.toString());
    });
    this.process.on("exit", (code) => {
      console.log(`[formula-bridge] process exited, code=${code}`);
      this.process = null;
    });
  }
  restart() {
    this.stop();
    this.start();
  }
  stop() {
    this.process?.kill();
    this.process = null;
  }
  insertFormula(latex) {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (!view) return;
    const editor = view.editor;
    const cursor = editor.getCursor();
    const currentLine = editor.getLine(cursor.line);
    const isEmpty = currentLine.trim() === "";
    let insertion;
    if (this.settings.formulaInline || !isEmpty) {
      insertion = `$${latex}$`;
    } else {
      insertion = `$$
${latex}
$$`;
    }
    editor.replaceRange(insertion, cursor);
    const newCursor = {
      line: cursor.line + (isEmpty ? 2 : 0),
      ch: isEmpty ? 2 : cursor.ch + insertion.length
    };
    editor.setCursor(newCursor);
    editor.focus();
  }
};

// src/termLinker.ts
var TermLinker = class {
  constructor(app, aiConfig, termStore) {
    this.extractTimer = null;
    this.lastContent = "";
    this.isLinking = false;
    this.app = app;
    this.aiConfig = aiConfig;
    this.termStore = termStore;
  }
  updateAIConfig(aiConfig) {
    this.aiConfig = aiConfig;
  }
  // 主入口：编辑器内容变化时调用
  onEditorChange(editor, file) {
    if (this.isLinking) return;
    if (this.extractTimer) clearTimeout(this.extractTimer);
    this.extractTimer = setTimeout(() => void this.markTerms(editor, file, false), 1500);
  }
  async markTermsNow(editor, file) {
    if (this.extractTimer) {
      clearTimeout(this.extractTimer);
      this.extractTimer = null;
    }
    return this.markTerms(editor, file, true);
  }
  async markTerms(editor, file, manual) {
    const content = editor.getValue();
    if (!manual && content === this.lastContent) {
      return { changed: false, extractedCount: 0, patternCount: 0, canExtract: !!getActiveApiKey(this.aiConfig) };
    }
    this.lastContent = content;
    this.isLinking = true;
    try {
      const domain = this.termStore.getDomain(file.path);
      const canExtract = !!getActiveApiKey(this.aiConfig);
      let extractedCount = 0;
      if (canExtract) {
        extractedCount = await this.extractNewTerms(content, domain, file.path);
      }
      const linkResult = await this.applyLinks(editor, file, domain);
      return { ...linkResult, extractedCount, canExtract };
    } finally {
      this.isLinking = false;
    }
  }
  async extractNewTerms(content, domain, filePath) {
    const excerpt = content.slice(-800);
    const raw = await aiChat(
      this.aiConfig,
      [
        {
          role: "system",
          content: `\u4F60\u662F\u4E00\u4E2A\u5B66\u672F\u7B14\u8BB0\u52A9\u624B\uFF0C\u6B63\u5728\u5E2E\u7528\u6237\u7EF4\u62A4"${domain}"\u9886\u57DF\u7684\u672F\u8BED\u5E93\u3002
\u5206\u6790\u7528\u6237\u6B63\u5728\u5199\u7684\u5185\u5BB9\uFF0C\u62BD\u53D6\u5176\u4E2D\u51FA\u73B0\u7684\u4E13\u4E1A\u672F\u8BED\u3001\u7B97\u6CD5\u540D\u79F0\u3001\u6570\u5B66\u6982\u5FF5\u3001\u7406\u8BBA\u540D\u79F0\u3002
\u4E25\u683C\u8FD4\u56DEJSON\u6570\u7EC4\uFF0C\u683C\u5F0F\uFF1A
[{"name":"\u89C4\u8303\u82F1\u6587\u6216\u4E2D\u6587\u672F\u8BED\u540D","aliases":["\u540C\u4E49\u8BCD","\u7F29\u5199"]}]
\u8981\u6C42\uFF1A
- \u53EA\u62BD\u53D6\u771F\u6B63\u7684\u4E13\u4E1A\u672F\u8BED\uFF0C\u4E0D\u8981\u666E\u901A\u8BCD\u6C47
- name \u7528\u6700\u89C4\u8303\u7684\u5199\u6CD5\uFF08\u901A\u5E38\u662F\u82F1\u6587\u6216\u4E2D\u6587\u5168\u79F0\uFF09
- aliases \u5305\u542B\u7F29\u5199\u3001\u522B\u79F0\u3001\u4E2D\u82F1\u6587\u4E92\u8BD1
- \u6700\u591A\u8FD4\u56DE5\u4E2A\u6700\u91CD\u8981\u7684\u672F\u8BED
- \u5982\u679C\u6CA1\u6709\u65B0\u672F\u8BED\u8FD4\u56DE []
\u53EA\u8FD4\u56DEJSON\u6570\u7EC4\u3002`
        },
        { role: "user", content: `\u6587\u4EF6\u8DEF\u5F84\uFF1A${filePath}

\u5185\u5BB9\uFF1A
${excerpt}` }
      ],
      { max_tokens: 400 }
    );
    try {
      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
      const extracted = JSON.parse(cleaned);
      if (!Array.isArray(extracted) || extracted.length === 0) return 0;
      const terms = extracted.map((t) => ({
        name: t.name,
        aliases: t.aliases || [],
        domain
      }));
      await this.termStore.mergeTerms(domain, terms);
      for (const term of terms) {
        const notePath = `${domain}/${term.name}.md`;
        if (!await this.app.vault.adapter.exists(notePath)) {
          await this.app.vault.create(
            notePath,
            `# ${term.name}

> \u81EA\u52A8\u521B\u5EFA\u7684\u672F\u8BED\u5360\u4F4D\u7B14\u8BB0

## \u5B9A\u4E49

## \u76F8\u5173\u6982\u5FF5
`
          );
        }
      }
      return terms.length;
    } catch {
      return 0;
    }
  }
  async applyLinks(editor, file, domain) {
    const patterns = (await this.termStore.getMatchPatterns(domain)).filter(({ pattern }) => pattern.trim().length >= 2).sort((a, b) => b.pattern.length - a.pattern.length);
    if (patterns.length === 0) return { changed: false, patternCount: 0 };
    const cursor = editor.getCursor();
    let content = editor.getValue();
    let changed = false;
    for (const { pattern, canonical } of patterns) {
      const regex = buildTermRegex(pattern);
      const lines = content.split("\n");
      let inCodeBlock = false;
      let mathBlockEnd = null;
      for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trimStart();
        if (trimmedLine.startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          continue;
        }
        if (inCodeBlock) continue;
        if (mathBlockEnd) {
          if (lines[i].includes(mathBlockEnd) || closesLatexEnvironment(lines[i], mathBlockEnd)) {
            mathBlockEnd = null;
          }
          continue;
        }
        const openedMathBlock = getMathBlockEnd(lines[i]);
        if (openedMathBlock) {
          mathBlockEnd = openedMathBlock;
          continue;
        }
        if (hasLatexMathEnvironment(lines[i])) continue;
        if (i === cursor.line) continue;
        if (lines[i].startsWith("#")) continue;
        const newLine = linkPlainTextSegmentsOutsideMath(lines[i], regex, canonical);
        if (newLine !== lines[i]) changed = true;
        lines[i] = newLine;
      }
      content = lines.join("\n");
    }
    if (changed) {
      const scrollInfo = editor.scrollInfo?.() ?? null;
      editor.setValue(content);
      editor.setCursor(cursor);
    }
    return { changed, patternCount: patterns.length };
  }
};
function buildTermRegex(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hasChinese = /[\u4e00-\u9fa5]/.test(pattern);
  if (hasChinese) {
    return new RegExp(escaped, "g");
  }
  return new RegExp(`\\b(${escaped})\\b`, "g");
}
function linkPlainTextSegments(line, regex, canonical) {
  return line.split(/(\[\[[^\]]+\]\])/g).map((segment) => {
    if (segment.startsWith("[[") && segment.endsWith("]]")) return segment;
    return segment.replace(
      regex,
      (match) => canonical === match ? `[[${match}]]` : `[[${canonical}|${match}]]`
    );
  }).join("");
}
function linkPlainTextSegmentsOutsideMath(line, regex, canonical) {
  return splitProtectedMarkdownSegments(line).map((segment) => segment.protected ? segment.text : linkPlainTextSegments(segment.text, regex, canonical)).join("");
}
function splitProtectedMarkdownSegments(line) {
  const segments = [];
  let index = 0;
  while (index < line.length) {
    const next = findNextProtectedSegment(line, index);
    if (!next) {
      segments.push({ text: line.slice(index), protected: false });
      break;
    }
    if (next.start > index) {
      segments.push({ text: line.slice(index, next.start), protected: false });
    }
    segments.push({ text: line.slice(next.start, next.end), protected: true });
    index = next.end;
  }
  return segments;
}
function findNextProtectedSegment(line, from) {
  const starts = [
    findDelimitedSegment(line, from, "$$", "$$"),
    findDelimitedSegment(line, from, "$", "$"),
    findDelimitedSegment(line, from, "\\(", "\\)"),
    findDelimitedSegment(line, from, "\\[", "\\]"),
    findDelimitedSegment(line, from, "[[", "]]")
  ].filter((value) => !!value);
  return starts.sort((a, b) => a.start - b.start)[0] ?? null;
}
function findDelimitedSegment(line, from, open, close) {
  const start = line.indexOf(open, from);
  if (start < 0) return null;
  if (open === "$" && line[start + 1] === "$") {
    return findDelimitedSegment(line, start + 2, open, close);
  }
  const closeStart = line.indexOf(close, start + open.length);
  if (closeStart < 0) return { start, end: line.length };
  return { start, end: closeStart + close.length };
}
function getMathBlockEnd(line) {
  if (hasUnclosedDelimiter(line, "$$")) return "$$";
  if (line.includes("\\[") && !line.includes("\\]")) return "\\]";
  const env = line.match(/\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|flalign\*?|alignat\*?)\}/);
  if (!env) return null;
  const end = `\\end{${env[1]}}`;
  return line.includes(end) ? null : end;
}
function hasLatexMathEnvironment(line) {
  return /\\begin\{(?:equation\*?|align\*?|gather\*?|multline\*?|flalign\*?|alignat\*?)\}/.test(line);
}
function hasUnclosedDelimiter(line, delimiter) {
  const matches = line.match(new RegExp(escapeRegExp(delimiter), "g")) ?? [];
  return matches.length % 2 === 1;
}
function closesLatexEnvironment(line, endMarker) {
  return endMarker.startsWith("\\end") && line.includes(endMarker);
}

// src/mdStructurer.ts
var MdStructurer = class {
  constructor(aiConfig) {
    this.timer = null;
    this.isProcessing = false;
    this.lastProcessedContent = "";
    this.aiConfig = aiConfig;
  }
  updateAIConfig(aiConfig) {
    this.aiConfig = aiConfig;
  }
  structurizeBeforeCursor(editor) {
    if (!getActiveApiKey(this.aiConfig) || this.isProcessing) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.structurize(editor), 100);
  }
  async structurize(editor) {
    const cursor = editor.getCursor();
    const fullContent = editor.getValue();
    const lines = fullContent.split("\n");
    const beforeLines = lines.slice(0, cursor.line);
    const beforeContent = beforeLines.join("\n");
    const afterContent = lines.slice(cursor.line).join("\n");
    if (beforeContent === this.lastProcessedContent) return;
    if (beforeContent.trim().length < 50) return;
    if (isInsideCodeBlock(beforeLines)) return;
    this.isProcessing = true;
    try {
      const structured = await aiChat(
        this.aiConfig,
        [
          {
            role: "system",
            content: `\u4F60\u662F\u4E00\u4E2A Obsidian Markdown \u7B14\u8BB0\u6E05\u6D17\u52A9\u624B\u3002\u5C06\u7528\u6237\u8F93\u5165\u7684\u5168\u90E8\u524D\u6587\u6574\u7406\u6210\u66F4\u6E05\u6670\u7684 Markdown \u683C\u5F0F\u3002
\u89C4\u5219\uFF1A
- \u8BC6\u522B\u5E76\u6DFB\u52A0\u5408\u9002\u7684\u6807\u9898\u5C42\u7EA7\uFF08##\u3001###\uFF09
- \u5217\u4E3E\u5F0F\u5185\u5BB9\u8F6C\u4E3A - \u5217\u8868
- \u91CD\u8981\u672F\u8BED\u3001\u5B9A\u4E49\u53EF\u4EE5\u52A0\u7C97\uFF08**\u672F\u8BED**\uFF09\uFF0C\u4F46\u4E0D\u8981\u8FC7\u5EA6\u52A0\u7C97
- \u516C\u5F0F\u4FDD\u6301\u539F\u6837\uFF08$...$\uFF09
- \u5DF2\u6709\u7684 [[\u94FE\u63A5]] \u4FDD\u6301\u539F\u6837\uFF0C\u4E0D\u8981\u6539\u52A8
- \u4EE3\u7801\u5757\u4FDD\u6301\u539F\u6837
- \u4FDD\u6301\u5185\u5BB9\u5B8C\u6574\uFF0C\u4E0D\u8981\u5220\u51CF\u4EFB\u4F55\u4FE1\u606F
- \u4E0D\u8981\u6DFB\u52A0\u539F\u6587\u6CA1\u6709\u7684\u5185\u5BB9
- \u4E0D\u8981\u628A\u666E\u901A\u6BB5\u843D\u6539\u6210\u5938\u5F20\u6807\u9898
- \u4E0D\u8981\u8F93\u51FA\u4EE3\u7801\u56F4\u680F
\u76F4\u63A5\u8FD4\u56DE\u683C\u5F0F\u5316\u540E\u7684 Markdown\uFF0C\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\u3002`
          },
          { role: "user", content: beforeContent }
        ],
        { max_tokens: 2e3 }
      );
      this.lastProcessedContent = beforeContent;
      const cleaned = stripMarkdownFence(structured).trim();
      if (!cleaned) return;
      if (cleaned === beforeContent.trim()) return;
      const newContent = cleaned + "\n" + afterContent;
      editor.setValue(newContent);
      const newLines = newContent.split("\n");
      const lineDelta = cleaned.split("\n").length - beforeLines.length;
      const safeLineNo = Math.max(0, Math.min(cursor.line + lineDelta, newLines.length - 1));
      editor.setCursor({ line: safeLineNo, ch: cursor.ch });
    } catch {
    } finally {
      this.isProcessing = false;
    }
  }
};
function isInsideCodeBlock(lines) {
  return lines.filter((line) => line.trim().startsWith("```")).length % 2 !== 0;
}
function stripMarkdownFence(text) {
  return text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "");
}

// src/termStore.ts
var TermStore = class {
  constructor(app) {
    this.cache = /* @__PURE__ */ new Map();
    this.app = app;
  }
  // 从文件夹路径推断领域标识，例如 "Course/notes" -> "Course"
  getDomain(filePath) {
    const parts = filePath.split("/");
    return parts.length > 1 ? parts[0] : "general";
  }
  // 读取领域术语库（存在 .obsidian/plugins/ai-enhancer/{domain}_terms.json）
  async loadTerms(domain) {
    if (this.cache.has(domain)) return this.cache.get(domain);
    const path = `.obsidian/plugins/ai-enhancer/${domain.replace(/\s/g, "_")}_terms.json`;
    try {
      const raw = await this.app.vault.adapter.read(path);
      const terms = JSON.parse(raw);
      this.cache.set(domain, terms);
      return terms;
    } catch {
      this.cache.set(domain, []);
      return [];
    }
  }
  async saveTerms(domain, terms) {
    this.cache.set(domain, terms);
    const path = `.obsidian/plugins/ai-enhancer/${domain.replace(/\s/g, "_")}_terms.json`;
    await this.app.vault.adapter.write(path, JSON.stringify(terms, null, 2));
  }
  // 把新术语合并进术语库（去重）
  async mergeTerms(domain, newTerms) {
    const existing = await this.loadTerms(domain);
    const nameSet = new Set(existing.map((t) => t.name.toLowerCase()));
    for (const t of newTerms) {
      if (!nameSet.has(t.name.toLowerCase())) {
        existing.push(t);
        nameSet.add(t.name.toLowerCase());
      } else {
        const old = existing.find((e) => e.name.toLowerCase() === t.name.toLowerCase());
        for (const alias of t.aliases) {
          if (!old.aliases.includes(alias)) old.aliases.push(alias);
        }
      }
    }
    await this.saveTerms(domain, existing);
  }
  // 获取所有匹配词（术语名 + 别名）→ 用于正则匹配
  async getMatchPatterns(domain) {
    const terms = await this.loadTerms(domain);
    const patterns = [];
    for (const t of terms) {
      patterns.push({ pattern: t.name, canonical: t.name });
      for (const alias of t.aliases) {
        patterns.push({ pattern: alias, canonical: t.name });
      }
    }
    return patterns;
  }
};

// src/agentCore.ts
var import_obsidian3 = require("obsidian");
var AgentCore = class {
  constructor(app, getAIConfig, getTargetView) {
    this.app = app;
    this.getAIConfig = getAIConfig;
    this.getTargetView = getTargetView;
  }
  async run(request) {
    const targetView = this.getTargetView();
    if (!targetView?.file) {
      return "\u5148\u70B9\u4E00\u4E0B\u8981\u7F16\u8F91\u7684\u7B14\u8BB0";
    }
    const shouldInsert = looksLikeInsertRequest(request);
    const exerciseRef = extractExerciseRef(request);
    if (exerciseRef) {
      const hit = await this.findExerciseInCurrentFolder(targetView.file, exerciseRef);
      if (hit) {
        this.insertIntoTarget(hit.text.trim(), targetView);
        return `\u5DF2\u63D2\u5165\u7EC3\u4E60 ${exerciseRef}`;
      }
    }
    const snippets = await this.searchCurrentFolder(targetView.file, request);
    const aiConfig = this.getAIConfig();
    if (!getActiveApiKey(aiConfig)) {
      if (!snippets.length) {
        return shouldInsert ? "\u6CA1\u6709\u627E\u5230\u53EF\u63D2\u5165\u7684\u672C\u5730\u8D44\u6599\uFF0C\u4E5F\u6CA1\u6709\u914D\u7F6E\u6A21\u578B API Key" : "\u6CA1\u6709\u914D\u7F6E\u6A21\u578B API Key";
      }
      if (shouldInsert) {
        this.insertIntoTarget(snippets[0].text.trim(), targetView);
        return `\u5DF2\u63D2\u5165\u6700\u76F8\u5173\u7247\u6BB5\uFF1A${snippets[0].file.basename}`;
      }
      return "\u627E\u5230\u4E86\u76F8\u5173\u7247\u6BB5\uFF0C\u4F46\u6CA1\u6709\u914D\u7F6E\u6A21\u578B API Key";
    }
    const decision = await this.decideAndGenerate(request, targetView, snippets);
    if (!decision.content.trim()) return "\u6A21\u578B\u6CA1\u6709\u751F\u6210\u53EF\u7528\u5185\u5BB9";
    if (decision.action === "insert") {
      this.insertIntoTarget(decision.content.trim(), targetView);
      return "\u5DF2\u63D2\u5165";
    }
    return decision.content.trim();
  }
  async decideAndGenerate(request, targetView, snippets) {
    const aiConfig = this.getAIConfig();
    const editor = targetView.editor;
    const currentNote = getCurrentNoteExcerpt(editor.getValue(), editor.getCursor().line);
    const raw = await aiChat(
      aiConfig,
      [
        {
          role: "system",
          content: `\u4F60\u662F Obsidian \u91CC\u7684\u6781\u7B80\u540E\u53F0 Agent\u3002
\u4F60\u9700\u8981\u5148\u5224\u65AD\u7528\u6237\u610F\u56FE\uFF0C\u518D\u751F\u6210\u5185\u5BB9\u3002

\u52A8\u4F5C\u89C4\u5219\uFF1A
- \u5982\u679C\u7528\u6237\u60F3\u8BA9\u4F60\u4FEE\u6539\u5F53\u524D\u7B14\u8BB0\u3001\u8865\u5168\u6B63\u6587\u3001\u5199\u4E00\u6BB5\u5185\u5BB9\u3001\u628A\u8D44\u6599\u653E\u8FDB\u6765\u3001\u6574\u7406\u6210\u7B14\u8BB0\u3001\u751F\u6210\u53EF\u7C98\u8D34\u6587\u672C\uFF0Caction \u7528 "insert"\u3002
- \u5982\u679C\u7528\u6237\u8981\u6C42\u56DE\u7B54\u5F53\u524D\u7B14\u8BB0\u91CC\u7684\u95EE\u9898\u3001\u5199\u7B54\u6848\u3001\u7EED\u5199\u3001\u8865\u5168\u3001\u6539\u5199\u6216\u6269\u5199\uFF0Caction \u7528 "insert"\u3002
- \u53EA\u6709\u5F53\u7528\u6237\u662F\u5728\u95EE\u4F60\u4E00\u4E2A\u4E34\u65F6\u95EE\u9898\u3001\u8BE2\u95EE\u539F\u56E0\u3001\u89E3\u91CA\u73B0\u8C61\uFF0C\u5E76\u4E14\u6CA1\u6709\u8981\u6C42\u5199\u8FDB\u5F53\u524D\u7B14\u8BB0\u65F6\uFF0Caction \u624D\u7528 "answer"\u3002
- action \u4E3A "insert" \u65F6\uFF0Ccontent \u53EA\u80FD\u662F\u8981\u5199\u5165\u5F53\u524D\u7B14\u8BB0\u7684\u6B63\u6587\uFF0C\u4E0D\u8981\u52A0\u89E3\u91CA\u548C\u524D\u8A00\u3002
- action \u4E3A "answer" \u65F6\uFF0Ccontent \u662F\u7B80\u6D01\u56DE\u7B54\u3002
- \u4F18\u5148\u4F7F\u7528\u7ED9\u5B9A\u672C\u5730\u8D44\u6599\u7247\u6BB5\uFF1B\u8D44\u6599\u4E0D\u8DB3\u65F6\u53EF\u4EE5\u7ED3\u5408\u5F53\u524D\u7B14\u8BB0\u4E0A\u4E0B\u6587\u548C\u5E38\u8BC6\u3002

\u4E25\u683C\u53EA\u8FD4\u56DE JSON\uFF0C\u4E0D\u8981 Markdown\uFF1A
{"action":"insert\u6216answer","content":"..."}`
        },
        {
          role: "user",
          content: `\u7528\u6237\u8BF7\u6C42\uFF1A${request}

\u5F53\u524D\u6587\u4EF6\uFF1A${targetView.file?.path ?? "\u672A\u77E5"}

\u5F53\u524D\u7B14\u8BB0\u5149\u6807\u9644\u8FD1\u5185\u5BB9\uFF1A
${currentNote}

\u672C\u5730\u8D44\u6599\u7247\u6BB5\uFF1A
${formatSnippets(snippets)}`
        }
      ],
      { max_tokens: 1800, model: aiConfig.model, temperature: 0.15 }
    );
    return parseAgentDecision(raw);
  }
  async findExerciseInCurrentFolder(currentFile, ref) {
    const files = this.getCurrentFolderTextFiles(currentFile);
    const escaped = escapeRegExp2(ref);
    const strongPatterns = [
      new RegExp(`(?:\u7EC3\u4E60|\u4E60\u9898|\u4F8B\u9898|exercise|exercises?)\\s*${escaped}`, "i"),
      new RegExp(`(?:\u7B2C\\s*)?${escaped}\\s*(?:\u9898|\u7EC3\u4E60|\u4E60\u9898)`, "i")
    ];
    const hits = [];
    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const block = extractExerciseBlock(content, strongPatterns, ref);
      if (!block) continue;
      hits.push({ file, text: block, score: scoreFileForTextbook(file, content) });
    }
    return hits.sort((a, b) => b.score - a.score)[0] ?? null;
  }
  async searchCurrentFolder(currentFile, query) {
    const files = this.getCurrentFolderTextFiles(currentFile);
    const terms = tokenizeQuery(query);
    const hits = [];
    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const score = scoreText(content, terms) + scoreFileForTextbook(file, content);
      if (score <= 0) continue;
      hits.push({ file, text: bestSnippet(content, terms), score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 8);
  }
  getCurrentFolderTextFiles(currentFile) {
    const folder = currentFile.parent?.path ?? "";
    const prefix = folder ? `${folder}/` : "";
    return this.app.vault.getFiles().filter((file) => file.path.startsWith(prefix)).filter((file) => ["md", "txt"].includes(file.extension.toLowerCase())).sort((a, b) => a.path.localeCompare(b.path));
  }
  insertIntoTarget(text, view) {
    const editor = view.editor;
    const cursor = editor.getCursor();
    editor.replaceRange(text, cursor);
    const parts = text.split("\n");
    editor.setCursor({
      line: cursor.line + parts.length - 1,
      ch: parts.length > 1 ? parts.at(-1)?.length ?? 0 : cursor.ch + text.length
    });
    editor.focus();
    new import_obsidian3.Notice("Agent \u5DF2\u63D2\u5165");
  }
};
function extractExerciseRef(text) {
  const patterns = [
    /(?:练习|习题|exercise|exercises?)\s*([0-9]+(?:\.[0-9]+)+[a-zA-Z]?)/i,
    /(?:第\s*)?([0-9]+(?:\.[0-9]+)+[a-zA-Z]?)\s*(?:题|练习|习题)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}
function looksLikeInsertRequest(text) {
  return /粘贴|贴进来|插入|放进来|放到|写入|加入|填写|填入|补充|生成|帮我写|整理成|改成|续写|补全|改写|扩写|回答.*问题|写答案/.test(text);
}
function formatSnippets(snippets) {
  if (!snippets.length) return "\u65E0";
  return snippets.slice(0, 6).map((hit, index) => `--- \u7247\u6BB5 ${index + 1}\uFF5C${hit.file.path} ---
${hit.text}`).join("\n\n");
}
function parseAgentDecision(raw) {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const action = parsed.action === "insert" ? "insert" : "answer";
    return { action, content: String(parsed.content ?? "").trim() };
  } catch {
    return { action: "answer", content: cleaned };
  }
}
function extractExerciseBlock(content, patterns, ref) {
  const lines = content.split(/\r?\n/);
  const loose = new RegExp(escapeRegExp2(ref));
  const start = lines.findIndex((line) => patterns.some((pattern) => pattern.test(line)) || loose.test(line));
  if (start < 0) return null;
  const endPattern = /^(#{1,6}\s+|(?:练习|习题|exercise|exercises?)\s*[0-9]+(?:\.[0-9]+)+|(?:第\s*)?[0-9]+(?:\.[0-9]+)+\s*(?:题|练习|习题))/i;
  const collected = [];
  for (let index = start; index < lines.length && collected.length < 80; index++) {
    if (index > start && endPattern.test(lines[index]) && !loose.test(lines[index])) break;
    collected.push(lines[index]);
  }
  return collected.join("\n").trim();
}
function tokenizeQuery(query) {
  const normalized = query.toLowerCase();
  const terms = normalized.match(/[\p{Script=Han}]+|[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*/gu) ?? [];
  return Array.from(new Set(terms.filter((term) => term.length >= 2 && !["\u7C98\u8D34", "\u63D2\u5165", "\u8FDB\u6765", "\u4E2D\u7684"].includes(term))));
}
function scoreText(content, terms) {
  const lower = content.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term.toLowerCase()) ? 2 : 0), 0);
}
function scoreFileForTextbook(file, content) {
  let score = 0;
  if (/教材|课本|textbook|book/i.test(file.basename)) score += 8;
  if (/教材|课本|textbook|chapter|练习|习题/i.test(content.slice(0, 2e3))) score += 3;
  return score;
}
function bestSnippet(content, terms) {
  const lines = content.split(/\r?\n/);
  let bestIndex = 0;
  let bestScore = -1;
  for (let index = 0; index < lines.length; index++) {
    const window2 = lines.slice(Math.max(0, index - 2), index + 8).join("\n").toLowerCase();
    const score = terms.reduce((sum, term) => sum + (window2.includes(term.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return lines.slice(Math.max(0, bestIndex - 4), bestIndex + 20).join("\n").trim();
}
function getCurrentNoteExcerpt(content, cursorLine) {
  const lines = content.split(/\r?\n/);
  return lines.slice(Math.max(0, cursorLine - 30), cursorLine + 30).join("\n").trim().slice(-3e3);
}
function escapeRegExp2(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/floatingAgentBox.ts
var import_obsidian4 = require("obsidian");
var FloatingAgentBox = class {
  constructor(agent) {
    this.agent = agent;
    this.root = null;
    this.input = null;
    this.busy = false;
  }
  show() {
    if (this.root) {
      this.input?.focus();
      this.input?.select();
      return;
    }
    this.root = document.body.createDiv();
    this.root.addClass("ai-enhancer-floating-agent");
    this.root.setAttr(
      "style",
      [
        "position:fixed",
        "right:28px",
        "bottom:28px",
        "z-index:9999",
        "width:min(420px,calc(100vw - 56px))",
        "display:flex",
        "align-items:center",
        "gap:8px",
        "padding:10px 12px",
        "border:1px solid rgba(255,255,255,.18)",
        "border-radius:18px",
        "background:rgba(18,18,18,.92)",
        "box-shadow:0 16px 40px rgba(0,0,0,.35)",
        "backdrop-filter:blur(16px)"
      ].join(";")
    );
    const dot = this.root.createDiv();
    dot.setAttr(
      "style",
      "width:8px;height:8px;border-radius:50%;background:#49d17d;flex:0 0 auto;"
    );
    this.input = this.root.createEl("input");
    this.input.type = "text";
    this.input.placeholder = "\u8BA9 Agent \u505A\u4EC0\u4E48...";
    this.input.setAttr(
      "style",
      [
        "flex:1",
        "border:0",
        "outline:0",
        "background:transparent",
        "color:white",
        "font-size:15px",
        "line-height:24px"
      ].join(";")
    );
    this.input.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") {
        evt.preventDefault();
        this.hide();
        return;
      }
      if (evt.key === "Enter" && !evt.shiftKey) {
        evt.preventDefault();
        void this.submit();
      }
    });
    this.input.focus();
  }
  hide() {
    this.root?.remove();
    this.root = null;
    this.input = null;
    this.busy = false;
  }
  unload() {
    this.hide();
  }
  async submit() {
    if (!this.input || this.busy) return;
    const request = this.input.value.trim();
    if (!request) {
      this.hide();
      return;
    }
    this.busy = true;
    this.input.disabled = true;
    this.input.value = "\u5904\u7406\u4E2D...";
    try {
      const message = await this.agent.run(request);
      new import_obsidian4.Notice(message);
      this.hide();
    } catch (error) {
      console.error("AI Enhancer floating agent failed", error);
      new import_obsidian4.Notice(error instanceof Error ? error.message : String(error));
      this.hide();
    }
  }
};

// src/main.ts
var DEFAULT_SETTINGS = {
  provider: "gemini",
  geminiApiKey: "",
  deepseekApiKey: "",
  formulaProvider: "gemini",
  formulaModel: "gemini-3.1-flash-lite",
  termProvider: "gemini",
  termModel: "gemini-3.1-flash-lite",
  structureProvider: "gemini",
  structureModel: "gemini-3.5-flash",
  answerProvider: "gemini",
  answerModel: "gemini-3.5-flash",
  continueProvider: "gemini",
  continueModel: "gemini-3.5-flash",
  agentProvider: "gemini",
  agentModel: "gemini-3.5-flash",
  enableFormulaCompletion: true,
  enableTermLinking: true,
  enableMdStructure: true,
  formulaBridgePath: "",
  formulaInline: false
};
var AIEnhancerPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.isAnsweringLastQuestion = false;
    this.isContinuingLastPart = false;
    this.lastMarkdownView = null;
  }
  async onload() {
    await this.loadSettings();
    await this.ensureDataDir();
    this.termStore = new TermStore(this.app);
    this.formulaCompleter = new FormulaCompleter(this.app, this.getFeatureAIConfig("formula"));
    this.formulaReceiver = new FormulaReceiver(this.app, this.settings);
    this.termLinker = new TermLinker(this.app, this.getFeatureAIConfig("term"), this.termStore);
    this.mdStructurer = new MdStructurer(this.getFeatureAIConfig("structure"));
    this.lastMarkdownView = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
    this.agentBox = new FloatingAgentBox(
      new AgentCore(
        this.app,
        () => this.getFeatureAIConfig("agent"),
        () => this.getTargetMarkdownView()
      )
    );
    if (this.settings.enableFormulaCompletion) {
      this.registerEditorSuggest(this.formulaCompleter);
    }
    this.registerDomEvent(document, "compositionstart", () => {
      this.formulaCompleter.setComposing(true);
    });
    this.registerDomEvent(document, "compositionend", () => {
      this.formulaCompleter.setComposing(false);
    });
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, view) => {
        this.lastMarkdownView = view;
        const file = view.file;
        if (!file) return;
        if (this.settings.enableTermLinking) {
          this.termLinker.onEditorChange(editor, file);
        }
      })
    );
    this.addCommand({
      id: "structure-note-before-cursor",
      name: "\u7ED3\u6784\u5316\u5F53\u524D\u5149\u6807\u524D\u6587",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "S" }],
      editorCallback: (editor, view) => {
        if (!this.settings.enableMdStructure) return;
        if (!view.file) return;
        this.mdStructurer.structurizeBeforeCursor(editor);
      }
    });
    this.addCommand({
      id: "mark-terms-now",
      name: "\u4E00\u952E\u5B8C\u6210\u672F\u8BED\u6807\u8BB0",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "L" }],
      editorCallback: async (editor, view) => {
        if (!view.file) return;
        new import_obsidian5.Notice("\u6B63\u5728\u6807\u8BB0\u672F\u8BED...");
        const result = await this.termLinker.markTermsNow(editor, view.file);
        if (result.changed) {
          new import_obsidian5.Notice(result.extractedCount > 0 ? `\u672F\u8BED\u6807\u8BB0\u5B8C\u6210\uFF0C\u65B0\u589E ${result.extractedCount} \u4E2A\u672F\u8BED` : "\u672F\u8BED\u6807\u8BB0\u5B8C\u6210");
          return;
        }
        if (result.patternCount === 0) {
          new import_obsidian5.Notice(result.canExtract ? "\u6CA1\u6709\u62BD\u53D6\u5230\u53EF\u6807\u8BB0\u672F\u8BED" : "\u672F\u8BED\u5E93\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u914D\u7F6E\u6A21\u578B API Key \u6216\u5DF2\u6709\u672F\u8BED\u5E93");
          return;
        }
        new import_obsidian5.Notice(result.extractedCount > 0 ? `\u65B0\u589E ${result.extractedCount} \u4E2A\u672F\u8BED\uFF0C\u4F46\u5F53\u524D\u6587\u6863\u65E0\u9700\u8865\u5145\u94FE\u63A5` : "\u5F53\u524D\u6587\u6863\u6682\u65E0\u9700\u8981\u8865\u5145\u7684\u672F\u8BED\u94FE\u63A5");
      }
    });
    this.addCommand({
      id: "open-floating-agent",
      name: "\u547C\u51FA\u6781\u7B80 Agent \u6307\u4EE4\u6846",
      callback: () => {
        this.agentBox.show();
      }
    });
    this.addRibbonIcon("bot", "AI Agent", () => {
      this.agentBox.show();
    });
    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        const activeView = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
        if (activeView) this.lastMarkdownView = activeView;
        if (!file || !this.settings.enableFormulaCompletion) return;
        const domain = this.termStore.getDomain(file.path);
        const terms = await this.termStore.loadTerms(domain);
        const names = terms.map((term) => term.name);
        void this.formulaCompleter.warmup(names);
      })
    );
    this.registerDomEvent(document, "keydown", (evt) => {
      void this.answerLastQuestionOnCommandOption(evt);
      void this.continueLastPartOnCommandControl(evt);
    });
    this.addSettingTab(new AIEnhancerSettingTab(this.app, this));
    const statusBar = this.addStatusBarItem();
    statusBar.setText("AI \u2726");
    statusBar.title = "AI Enhancer \u8FD0\u884C\u4E2D";
    this.formulaReceiver.start();
    console.log("AI Enhancer Plugin loaded");
  }
  async onunload() {
    this.formulaReceiver?.stop();
    this.agentBox?.unload();
    console.log("AI Enhancer Plugin unloaded");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (this.settings.formulaBridgePath?.endsWith("/formula-bridge/server.js")) this.settings.formulaBridgePath = "";
    if (this.settings.apiKey && !this.settings.geminiApiKey) {
      this.settings.geminiApiKey = this.settings.apiKey;
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.formulaCompleter?.updateAIConfig(this.getFeatureAIConfig("formula"));
    this.termLinker?.updateAIConfig(this.getFeatureAIConfig("term"));
    this.mdStructurer?.updateAIConfig(this.getFeatureAIConfig("structure"));
    this.formulaReceiver?.restart();
  }
  getAIConfig() {
    return {
      provider: this.settings.provider,
      geminiApiKey: this.settings.geminiApiKey,
      deepseekApiKey: this.settings.deepseekApiKey
    };
  }
  getFeatureAIConfig(feature) {
    const providerKey = `${feature}Provider`;
    const modelKey = `${feature}Model`;
    const provider = this.settings[providerKey] || this.settings.provider;
    return {
      provider,
      geminiApiKey: this.settings.geminiApiKey,
      deepseekApiKey: this.settings.deepseekApiKey,
      model: (this.settings[modelKey] || defaultModelFor(provider)).trim()
    };
  }
  async answerLastQuestionOnCommandOption(evt) {
    if (!evt.metaKey || !evt.altKey || evt.ctrlKey) return;
    if (evt.repeat || this.isAnsweringLastQuestion) return;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
    if (!view || !view.file) return;
    evt.preventDefault();
    evt.stopPropagation();
    const aiConfig = this.getFeatureAIConfig("answer");
    if (!this.hasApiKey(aiConfig)) {
      new import_obsidian5.Notice("\u8BF7\u5148\u914D\u7F6E\u6240\u9009\u6A21\u578B\u7684 API Key");
      return;
    }
    const editor = view.editor;
    const documentText = editor.getValue();
    if (!documentText.trim()) return;
    this.isAnsweringLastQuestion = true;
    const cursor = editor.getCursor();
    try {
      new import_obsidian5.Notice("\u6B63\u5728\u56DE\u7B54\u5168\u6587\u6700\u540E\u4E00\u4E2A\u95EE\u9898...");
      const answer = await answerLastQuestion(aiConfig, documentText);
      if (!answer.trim()) {
        new import_obsidian5.Notice("\u6CA1\u6709\u627E\u5230\u660E\u786E\u7684\u95EE\u9898");
        return;
      }
      editor.replaceRange(answer.trim(), cursor);
    } catch (error) {
      console.error("AI Enhancer last-question answer failed", error);
      new import_obsidian5.Notice(formatAIError("\u56DE\u7B54\u5931\u8D25", aiConfig, error));
    } finally {
      this.isAnsweringLastQuestion = false;
    }
  }
  async continueLastPartOnCommandControl(evt) {
    if (!evt.metaKey || !evt.ctrlKey || evt.altKey) return;
    if (evt.repeat || this.isContinuingLastPart) return;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
    if (!view || !view.file) return;
    evt.preventDefault();
    evt.stopPropagation();
    const aiConfig = this.getFeatureAIConfig("continue");
    if (!this.hasApiKey(aiConfig)) {
      new import_obsidian5.Notice("\u8BF7\u5148\u914D\u7F6E\u6240\u9009\u6A21\u578B\u7684 API Key");
      return;
    }
    const editor = view.editor;
    const documentText = editor.getValue();
    if (!documentText.trim()) return;
    this.isContinuingLastPart = true;
    const cursor = editor.getCursor();
    try {
      new import_obsidian5.Notice("\u6B63\u5728\u7EED\u5199\u6700\u540E\u90E8\u5206...");
      const completion = await continueLastPart(aiConfig, documentText);
      if (!completion.trim()) {
        new import_obsidian5.Notice("\u6700\u540E\u90E8\u5206\u5DF2\u7ECF\u6BD4\u8F83\u5B8C\u6574");
        return;
      }
      editor.replaceRange(completion.trim(), cursor);
    } catch (error) {
      console.error("AI Enhancer continuation failed", error);
      new import_obsidian5.Notice(formatAIError("\u7EED\u5199\u5931\u8D25", aiConfig, error));
    } finally {
      this.isContinuingLastPart = false;
    }
  }
  hasApiKey(config) {
    return config.provider === "gemini" ? !!config.geminiApiKey : !!config.deepseekApiKey;
  }
  getTargetMarkdownView() {
    const active = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
    if (active) {
      this.lastMarkdownView = active;
      return active;
    }
    return this.lastMarkdownView?.file ? this.lastMarkdownView : null;
  }
  async ensureDataDir() {
    const dir = ".obsidian/plugins/ai-enhancer";
    try {
      await this.app.vault.adapter.mkdir(dir);
    } catch {
    }
  }
};
var AIEnhancerSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AI Enhancer \u8BBE\u7F6E" });
    new import_obsidian5.Setting(containerEl).setName("\u6A21\u578B\u63D0\u4F9B\u5546").setDesc("\u9009\u62E9\u63D2\u4EF6\u8C03\u7528 Gemini \u6216 DeepSeek").addDropdown(
      (dropdown) => dropdown.addOption("gemini", `Gemini - ${MODEL_NAMES.gemini}`).addOption("deepseek", `DeepSeek - ${MODEL_NAMES.deepseek}`).setValue(this.plugin.settings.provider).onChange(async (value) => {
        this.plugin.settings.provider = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("Gemini API Key").setDesc(`\u7528\u4E8E ${MODEL_NAMES.gemini}`).addText(
      (text) => text.setPlaceholder("AIza...").setValue(this.plugin.settings.geminiApiKey).onChange(async (value) => {
        this.plugin.settings.geminiApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("DeepSeek API Key").setDesc(`\u7528\u4E8E ${MODEL_NAMES.deepseek}`).addText(
      (text) => text.setPlaceholder("sk-...").setValue(this.plugin.settings.deepseekApiKey).onChange(async (value) => {
        this.plugin.settings.deepseekApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u5404\u529F\u80FD\u6A21\u578B" });
    addFeatureModelSetting(containerEl, this.plugin, "\u516C\u5F0F\u8865\u5168", "formulaProvider", "formulaModel");
    addFeatureModelSetting(containerEl, this.plugin, "\u672F\u8BED\u94FE\u63A5", "termProvider", "termModel");
    addFeatureModelSetting(containerEl, this.plugin, "\u7ED3\u6784\u5316", "structureProvider", "structureModel");
    addFeatureModelSetting(containerEl, this.plugin, "\u5168\u6587\u95EE\u7B54", "answerProvider", "answerModel");
    addFeatureModelSetting(containerEl, this.plugin, "\u98CE\u683C\u7EED\u5199", "continueProvider", "continueModel");
    addFeatureModelSetting(containerEl, this.plugin, "\u8D44\u6599 Agent", "agentProvider", "agentModel");
    containerEl.createEl("h3", { text: "\u529F\u80FD\u5F00\u5173" });
    new import_obsidian5.Setting(containerEl).setName("\u516C\u5F0F\u81EA\u52A8\u8865\u5168").setDesc("\u5199\u4E0B\u672F\u8BED\u540E\u81EA\u52A8\u5F39\u51FA\u76F8\u5173\u516C\u5F0F\u5EFA\u8BAE\uFF0CTab \u63A5\u53D7").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableFormulaCompletion).onChange(async (value) => {
        this.plugin.settings.enableFormulaCompletion = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u672F\u8BED\u81EA\u52A8\u94FE\u63A5").setDesc("AI \u8BC6\u522B\u4E13\u4E1A\u672F\u8BED\u5E76\u81EA\u52A8\u52A0 [[\u94FE\u63A5]]\uFF0C\u540C\u65F6\u7EF4\u62A4\u9886\u57DF\u672F\u8BED\u5E93").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableTermLinking).onChange(async (value) => {
        this.plugin.settings.enableTermLinking = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("MD \u5B9E\u65F6\u7ED3\u6784\u5316").setDesc("\u6362\u884C\u65F6\u81EA\u52A8\u6574\u7406\u5149\u6807\u524D\u5185\u5BB9\u7684 Markdown \u683C\u5F0F").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableMdStructure).onChange(async (value) => {
        this.plugin.settings.enableMdStructure = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u624B\u5199\u516C\u5F0F\u63A5\u6536" });
    new import_obsidian5.Setting(containerEl).setName("formula-bridge \u8DEF\u5F84").setDesc("Mac helper \u7684\u7EDD\u5BF9\u8DEF\u5F84\u3002\u7559\u7A7A\u5219\u4E0D\u542F\u52A8\u624B\u5199\u516C\u5F0F\u63A5\u6536\uFF1B\u4E5F\u517C\u5BB9\u65E7\u7684 server.js").addText(
      (text) => text.setPlaceholder("/path/to/formula-peer-bridge").setValue(this.plugin.settings.formulaBridgePath).onChange(async (value) => {
        this.plugin.settings.formulaBridgePath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u63D2\u5165\u884C\u5185\u516C\u5F0F").setDesc("\u5F00\u542F\u540E\u63D2\u5165 $...$\uFF0C\u5173\u95ED\u5219\u5728\u7A7A\u884C\u63D2\u5165 $$...$$").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.formulaInline).onChange(async (value) => {
        this.plugin.settings.formulaInline = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
function defaultModelFor(provider) {
  return provider === "gemini" ? MODEL_NAMES.gemini : MODEL_NAMES.deepseek;
}
function addFeatureModelSetting(containerEl, plugin, label, providerKey, modelKey) {
  let textInput;
  new import_obsidian5.Setting(containerEl).setName(label).setDesc("\u9009\u62E9\u6A21\u578B\u63D0\u4F9B\u5546\uFF0C\u5E76\u586B\u5199\u6A21\u578B\u540D\u79F0").addDropdown(
    (dropdown) => dropdown.addOption("gemini", "Gemini").addOption("deepseek", "DeepSeek").setValue(plugin.settings[providerKey] || plugin.settings.provider).onChange(async (value) => {
      const provider = value;
      plugin.settings[providerKey] = provider;
      const currentModel = plugin.settings[modelKey]?.trim() || "";
      if (!currentModel || modelLooksMismatched(provider, currentModel)) {
        plugin.settings[modelKey] = defaultModelFor(provider);
      }
      await plugin.saveSettings();
      textInput.setValue(plugin.settings[modelKey] || "");
    })
  ).addText((text) => {
    textInput = text;
    return text.setPlaceholder("gemini-3.1-flash-lite / deepseek-v4-flash").setValue(plugin.settings[modelKey] || "").onChange(async (value) => {
      plugin.settings[modelKey] = value.trim();
      await plugin.saveSettings();
    });
  });
}
function modelLooksMismatched(provider, model) {
  const normalized = model.toLowerCase();
  if (provider === "deepseek") return normalized.includes("gemini");
  return normalized.includes("deepseek");
}
function formatAIError(prefix, config, error) {
  const model = config.model || defaultModelFor(config.provider);
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/API error (\d+)/);
  const status = statusMatch ? `\uFF0C\u72B6\u6001\u7801 ${statusMatch[1]}` : "";
  return `${prefix}\uFF1A${config.provider} / ${model} \u4E0D\u53EF\u7528${status}`;
}
