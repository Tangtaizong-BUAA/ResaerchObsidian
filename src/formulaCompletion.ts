import { Editor, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from "obsidian";
import { AIClientConfig, aiChat, getActiveApiKey } from "./deepseek";

interface FormulaSuggestion {
  term: string;
  latex: string;
  description: string;
}

const TERM_PATTERN = /[\u4e00-\u9fa5A-Za-z0-9α-ωΑ-Ω][\u4e00-\u9fa5A-Za-z0-9α-ωΑ-Ω+\-*/^_=<>≤≥≈∞() ]{0,64}$/;
const PREFETCH_TERM_PATTERN = /[\u4e00-\u9fa5A-Za-z0-9α-ωΑ-Ω][\u4e00-\u9fa5A-Za-z0-9α-ωΑ-Ω+\-*/^_=<>≤≥≈∞() ]{0,64}$/;
const SEMANTIC_BREAKS = new Set(["，", "。", "：", "；", "、", " ", ",", ".", ":", ";"]);
const L2_CACHE_KEY = "ai_formula_cache_v3";
const L2_CACHE_LIMIT = 300;
const EN_STOP_WORDS = new Set([
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
  "would",
]);

export class FormulaCompleter extends EditorSuggest<FormulaSuggestion> {
  private aiConfig: AIClientConfig;
  private l1Cache: Map<string, FormulaSuggestion[]> = new Map();
  private l2Cache: Record<string, FormulaSuggestion[]> = {};
  private inflight: Map<string, Promise<FormulaSuggestion[]>> = new Map();
  private l2Loaded = false;
  private warming = false;
  private isComposing = false;

  constructor(app: any, aiConfig: AIClientConfig) {
    super(app);
    this.aiConfig = aiConfig;
    this.loadL2();
  }

  updateAIConfig(aiConfig: AIClientConfig) {
    this.aiConfig = aiConfig;
    this.l1Cache.clear();
    this.inflight.clear();
  }

  setComposing(isComposing: boolean) {
    this.isComposing = isComposing;
  }

  async warmup(termNames: string[]) {
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

  onTrigger(cursor: any, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
    if (this.isComposing) return null;

    const line = editor.getLine(cursor.line);
    const beforeCursor = line.slice(0, cursor.ch);

    // 不在数学块里才触发
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
      query: term,
    };
  }

  async getSuggestions(context: EditorSuggestContext): Promise<FormulaSuggestion[]> {
    const query = normalizeQuery(context.query);
    if (!getActiveApiKey(this.aiConfig)) return [];

    const { focusLines, fullText, filePath } = this.getPromptContext(context.editor, context.file);
    return this.fetchAndCache(query, focusLines, fullText, filePath);
  }

  private prefetchAtSemanticBreak(beforeCursor: string, editor: Editor, file: TFile) {
    const lastChar = beforeCursor.slice(-1);
    if (!SEMANTIC_BREAKS.has(lastChar)) return;

    const termMatch = beforeCursor.slice(0, -1).match(PREFETCH_TERM_PATTERN);
    if (!termMatch) return;

    const term = normalizeQuery(termMatch[0]);
    if (!this.isUsefulTerm(term)) return;

    const { focusLines, fullText, filePath } = this.getPromptContext(editor, file);
    void this.fetchAndCache(term, focusLines, fullText, filePath);
  }

  private async fetchAndCache(
    query: string,
    focusLines: string = "",
    fullText: string = "",
    filePath: string = ""
  ): Promise<FormulaSuggestion[]> {
    const normalized = normalizeQuery(query);
    if (!normalized) return [];

    this.loadL2();
    const cacheKey = this.getCacheKey(normalized, filePath);
    if (this.l1Cache.has(cacheKey)) return this.l1Cache.get(cacheKey)!;
    if (this.l2Cache[cacheKey]) {
      this.l1Cache.set(cacheKey, this.l2Cache[cacheKey]);
      return this.l2Cache[cacheKey];
    }
    if (this.inflight.has(cacheKey)) return this.inflight.get(cacheKey)!;

    const request = this.callAPI(normalized, focusLines, fullText, filePath)
      .then((result) => {
        this.l1Cache.set(cacheKey, result);
        if (result.length > 0) {
          this.l2Cache[cacheKey] = result;
          this.pruneL2();
          this.saveL2();
        }
        return result;
      })
      .finally(() => {
        this.inflight.delete(cacheKey);
      });

    this.inflight.set(cacheKey, request);
    return request;
  }

  private async callAPI(
    query: string,
    focusLines: string,
    fullText: string,
    filePath: string
  ): Promise<FormulaSuggestion[]> {
    try {
      const raw = await aiChat(
        this.aiConfig,
        [
          {
            role: "system",
            content: `你是一个学术公式助手。根据用户正在写的完整笔记全文，推荐最相关的公式。
严格返回JSON数组，最多3条：
[{"term":"术语名","latex":"LaTeX公式","description":"一句话说明"}]
只返回JSON。`,
          },
          {
            role: "user",
            content: `文件：${filePath}
重点参考光标前3行：
${focusLines}

全文：
${fullText}

当前术语：${query}

请先重点看光标前3行，再结合全文语境，推荐与当前术语最匹配的公式，不要推荐无关公式。`,
          },
        ],
        { max_tokens: 256 }
      );

      const parsed = parseJsonArray(raw);
      return parsed
        .filter((item: any) => item && typeof item.latex === "string" && item.latex.trim())
        .slice(0, 3)
        .map((item: any) => ({
          term: typeof item.term === "string" && item.term.trim() ? item.term.trim() : query,
          latex: item.latex.replace(/^\$+|\$+$/g, "").trim(),
          description:
            typeof item.description === "string" && item.description.trim()
              ? item.description.trim()
              : item.term || query,
        }));
    } catch {
      return [];
    }
  }

  private getCacheKey(query: string, filePath: string): string {
    return `${this.aiConfig.provider}:${this.aiConfig.model || ""}:${query.toLowerCase()}:${hashText(filePath)}`;
  }

  private getPromptContext(
    editor: Editor,
    file?: TFile | null
  ): { focusLines: string; fullText: string; filePath: string } {
    const cursor = editor.getCursor();
    const startLine = Math.max(0, cursor.line - 3);
    const focusLines = Array.from({ length: cursor.line - startLine }, (_, i) =>
      editor.getLine(startLine + i)
    ).join("\n");

    return {
      focusLines,
      fullText: editor.getValue(),
      filePath: file?.path ?? "",
    };
  }

  private isUsefulTerm(term: string): boolean {
    return shouldOfferFormulaHelp(term);
  }

  private loadL2() {
    if (this.l2Loaded) return;
    this.l2Loaded = true;
    try {
      const raw = localStorage.getItem(L2_CACHE_KEY);
      if (raw) this.l2Cache = JSON.parse(raw);
    } catch {
      this.l2Cache = {};
    }
  }

  private saveL2() {
    try {
      localStorage.setItem(L2_CACHE_KEY, JSON.stringify(this.l2Cache));
    } catch {
      // 缓存失败不影响补全主流程。
    }
  }

  private pruneL2() {
    const keys = Object.keys(this.l2Cache);
    if (keys.length <= L2_CACHE_LIMIT) return;
    for (const key of keys.slice(0, keys.length - L2_CACHE_LIMIT)) {
      delete this.l2Cache[key];
    }
  }

  renderSuggestion(suggestion: FormulaSuggestion, el: HTMLElement): void {
    el.createEl("div", {
      text: suggestion.description,
      cls: "ai-formula-desc",
    });
    el.createEl("code", {
      text: `$${suggestion.latex}$`,
      cls: "ai-formula-latex",
    });
  }

  selectSuggestion(suggestion: FormulaSuggestion, evt: MouseEvent | KeyboardEvent): void {
    const { context } = this;
    if (!context) return;
    const { editor, start, end } = context;
    const original = normalizeQuery(context.query);
    editor.replaceRange(`${original} $${suggestion.latex}$`, start, end);
  }
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function shouldOfferFormulaHelp(term: string): boolean {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(31, hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function parseJsonArray(raw: string): any[] {
  const cleaned = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}
