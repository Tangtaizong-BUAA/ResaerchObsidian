import { App, MarkdownView, Notice, TFile } from "obsidian";
import { AIClientConfig, aiChat, getActiveApiKey } from "./deepseek";

interface SearchHit {
  file: TFile;
  text: string;
  score: number;
}

interface AgentDecision {
  action: "insert" | "answer";
  content: string;
}

export class AgentCore {
  constructor(
    private readonly app: App,
    private readonly getAIConfig: () => AIClientConfig,
    private readonly getTargetView: () => MarkdownView | null
  ) {}

  async run(request: string): Promise<string> {
    const targetView = this.getTargetView();
    if (!targetView?.file) {
      return "先点一下要编辑的笔记";
    }

    const shouldInsert = looksLikeInsertRequest(request);
    const exerciseRef = extractExerciseRef(request);

    if (exerciseRef) {
      const hit = await this.findExerciseInCurrentFolder(targetView.file, exerciseRef);
      if (hit) {
        this.insertIntoTarget(hit.text.trim(), targetView);
        return `已插入练习 ${exerciseRef}`;
      }
    }

    const snippets = await this.searchCurrentFolder(targetView.file, request);
    const aiConfig = this.getAIConfig();
    if (!getActiveApiKey(aiConfig)) {
      if (!snippets.length) {
        return shouldInsert ? "没有找到可插入的本地资料，也没有配置模型 API Key" : "没有配置模型 API Key";
      }
      if (shouldInsert) {
        this.insertIntoTarget(snippets[0].text.trim(), targetView);
        return `已插入最相关片段：${snippets[0].file.basename}`;
      }
      return "找到了相关片段，但没有配置模型 API Key";
    }

    const decision = await this.decideAndGenerate(request, targetView, snippets);
    if (!decision.content.trim()) return "模型没有生成可用内容";

    if (decision.action === "insert") {
      this.insertIntoTarget(decision.content.trim(), targetView);
      return "已插入";
    }

    return decision.content.trim();
  }

  private async decideAndGenerate(
    request: string,
    targetView: MarkdownView,
    snippets: SearchHit[]
  ): Promise<AgentDecision> {
    const aiConfig = this.getAIConfig();
    const editor = targetView.editor;
    const currentNote = getCurrentNoteExcerpt(editor.getValue(), editor.getCursor().line);
    const raw = await aiChat(
      aiConfig,
      [
        {
          role: "system",
          content: `你是 Obsidian 里的极简后台 Agent。
你需要先判断用户意图，再生成内容。

动作规则：
- 如果用户想让你修改当前笔记、补全正文、写一段内容、把资料放进来、整理成笔记、生成可粘贴文本，action 用 "insert"。
- 如果用户要求回答当前笔记里的问题、写答案、续写、补全、改写或扩写，action 用 "insert"。
- 只有当用户是在问你一个临时问题、询问原因、解释现象，并且没有要求写进当前笔记时，action 才用 "answer"。
- action 为 "insert" 时，content 只能是要写入当前笔记的正文，不要加解释和前言。
- action 为 "answer" 时，content 是简洁回答。
- 优先使用给定本地资料片段；资料不足时可以结合当前笔记上下文和常识。

严格只返回 JSON，不要 Markdown：
{"action":"insert或answer","content":"..."}`
        },
        {
          role: "user",
          content: `用户请求：${request}

当前文件：${targetView.file?.path ?? "未知"}

当前笔记光标附近内容：
${currentNote}

本地资料片段：
${formatSnippets(snippets)}`,
        },
      ],
      { max_tokens: 1800, model: aiConfig.model, temperature: 0.15 }
    );

    return parseAgentDecision(raw);
  }

  private async findExerciseInCurrentFolder(currentFile: TFile, ref: string): Promise<SearchHit | null> {
    const files = this.getCurrentFolderTextFiles(currentFile);
    const escaped = escapeRegExp(ref);
    const strongPatterns = [
      new RegExp(`(?:练习|习题|例题|exercise|exercises?)\\s*${escaped}`, "i"),
      new RegExp(`(?:第\\s*)?${escaped}\\s*(?:题|练习|习题)`, "i"),
    ];

    const hits: SearchHit[] = [];
    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const block = extractExerciseBlock(content, strongPatterns, ref);
      if (!block) continue;
      hits.push({ file, text: block, score: scoreFileForTextbook(file, content) });
    }

    return hits.sort((a, b) => b.score - a.score)[0] ?? null;
  }

  private async searchCurrentFolder(currentFile: TFile, query: string): Promise<SearchHit[]> {
    const files = this.getCurrentFolderTextFiles(currentFile);
    const terms = tokenizeQuery(query);
    const hits: SearchHit[] = [];

    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const score = scoreText(content, terms) + scoreFileForTextbook(file, content);
      if (score <= 0) continue;
      hits.push({ file, text: bestSnippet(content, terms), score });
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  private getCurrentFolderTextFiles(currentFile: TFile): TFile[] {
    const folder = currentFile.parent?.path ?? "";
    const prefix = folder ? `${folder}/` : "";
    return this.app.vault
      .getFiles()
      .filter((file) => file.path.startsWith(prefix))
      .filter((file) => ["md", "txt"].includes(file.extension.toLowerCase()))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  private insertIntoTarget(text: string, view: MarkdownView) {
    const editor = view.editor;
    const cursor = editor.getCursor();
    editor.replaceRange(text, cursor);
    const parts = text.split("\n");
    editor.setCursor({
      line: cursor.line + parts.length - 1,
      ch: parts.length > 1 ? parts.at(-1)?.length ?? 0 : cursor.ch + text.length,
    });
    editor.focus();
    new Notice("Agent 已插入");
  }
}

function extractExerciseRef(text: string): string | null {
  const patterns = [
    /(?:练习|习题|exercise|exercises?)\s*([0-9]+(?:\.[0-9]+)+[a-zA-Z]?)/i,
    /(?:第\s*)?([0-9]+(?:\.[0-9]+)+[a-zA-Z]?)\s*(?:题|练习|习题)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function looksLikeInsertRequest(text: string): boolean {
  return /粘贴|贴进来|插入|放进来|放到|写入|加入|填写|填入|补充|生成|帮我写|整理成|改成|续写|补全|改写|扩写|回答.*问题|写答案/.test(text);
}

function formatSnippets(snippets: SearchHit[]): string {
  if (!snippets.length) return "无";
  return snippets
    .slice(0, 6)
    .map((hit, index) => `--- 片段 ${index + 1}｜${hit.file.path} ---\n${hit.text}`)
    .join("\n\n");
}

function parseAgentDecision(raw: string): AgentDecision {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<AgentDecision>;
    const action = parsed.action === "insert" ? "insert" : "answer";
    return { action, content: String(parsed.content ?? "").trim() };
  } catch {
    return { action: "answer", content: cleaned };
  }
}

function extractExerciseBlock(content: string, patterns: RegExp[], ref: string): string | null {
  const lines = content.split(/\r?\n/);
  const loose = new RegExp(escapeRegExp(ref));
  const start = lines.findIndex((line) => patterns.some((pattern) => pattern.test(line)) || loose.test(line));
  if (start < 0) return null;

  const endPattern = /^(#{1,6}\s+|(?:练习|习题|exercise|exercises?)\s*[0-9]+(?:\.[0-9]+)+|(?:第\s*)?[0-9]+(?:\.[0-9]+)+\s*(?:题|练习|习题))/i;
  const collected: string[] = [];
  for (let index = start; index < lines.length && collected.length < 80; index++) {
    if (index > start && endPattern.test(lines[index]) && !loose.test(lines[index])) break;
    collected.push(lines[index]);
  }

  return collected.join("\n").trim();
}

function tokenizeQuery(query: string): string[] {
  const normalized = query.toLowerCase();
  const terms = normalized.match(/[\p{Script=Han}]+|[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*/gu) ?? [];
  return Array.from(new Set(terms.filter((term) => term.length >= 2 && !["粘贴", "插入", "进来", "中的"].includes(term))));
}

function scoreText(content: string, terms: string[]): number {
  const lower = content.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term.toLowerCase()) ? 2 : 0), 0);
}

function scoreFileForTextbook(file: TFile, content: string): number {
  let score = 0;
  if (/教材|课本|textbook|book/i.test(file.basename)) score += 8;
  if (/教材|课本|textbook|chapter|练习|习题/i.test(content.slice(0, 2000))) score += 3;
  return score;
}

function bestSnippet(content: string, terms: string[]): string {
  const lines = content.split(/\r?\n/);
  let bestIndex = 0;
  let bestScore = -1;

  for (let index = 0; index < lines.length; index++) {
    const window = lines.slice(Math.max(0, index - 2), index + 8).join("\n").toLowerCase();
    const score = terms.reduce((sum, term) => sum + (window.includes(term.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return lines.slice(Math.max(0, bestIndex - 4), bestIndex + 20).join("\n").trim();
}

function getCurrentNoteExcerpt(content: string, cursorLine: number): string {
  const lines = content.split(/\r?\n/);
  return lines.slice(Math.max(0, cursorLine - 30), cursorLine + 30).join("\n").trim().slice(-3000);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
