import { App, Editor, TFile } from "obsidian";
import { AIClientConfig, aiChat, getActiveApiKey } from "./deepseek";
import { TermStore, Term } from "./termStore";

interface TermLinkResult {
  changed: boolean;
  extractedCount: number;
  patternCount: number;
  canExtract: boolean;
}

export class TermLinker {
  private app: App;
  private aiConfig: AIClientConfig;
  private termStore: TermStore;
  private extractTimer: ReturnType<typeof setTimeout> | null = null;
  private lastContent = "";
  private isLinking = false;

  constructor(app: App, aiConfig: AIClientConfig, termStore: TermStore) {
    this.app = app;
    this.aiConfig = aiConfig;
    this.termStore = termStore;
  }

  updateAIConfig(aiConfig: AIClientConfig) { this.aiConfig = aiConfig; }

  // 主入口：编辑器内容变化时调用
  onEditorChange(editor: Editor, file: TFile) {
    if (this.isLinking) return;

    // 停止输入 1.5s 后做术语抽取/链接；没有 API Key 时仍会用已有术语库打链接。
    if (this.extractTimer) clearTimeout(this.extractTimer);
    this.extractTimer = setTimeout(() => void this.markTerms(editor, file, false), 1500);
  }

  async markTermsNow(editor: Editor, file: TFile): Promise<TermLinkResult> {
    if (this.extractTimer) {
      clearTimeout(this.extractTimer);
      this.extractTimer = null;
    }
    return this.markTerms(editor, file, true);
  }

  private async markTerms(editor: Editor, file: TFile, manual: boolean): Promise<TermLinkResult> {
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
        // Step 1: AI 抽取新术语（理解领域 + 当前内容）
        extractedCount = await this.extractNewTerms(content, domain, file.path);
      }

      // Step 2: 用术语库对当前内容打链接
      const linkResult = await this.applyLinks(editor, file, domain);
      return { ...linkResult, extractedCount, canExtract };
    } finally {
      this.isLinking = false;
    }
  }

  private async extractNewTerms(content: string, domain: string, filePath: string): Promise<number> {
    // 只取最后 800 字，避免 token 浪费
    const excerpt = content.slice(-800);

    const raw = await aiChat(
      this.aiConfig,
      [
        {
          role: "system",
          content: `你是一个学术笔记助手，正在帮用户维护"${domain}"领域的术语库。
分析用户正在写的内容，抽取其中出现的专业术语、算法名称、数学概念、理论名称。
严格返回JSON数组，格式：
[{"name":"规范英文或中文术语名","aliases":["同义词","缩写"]}]
要求：
- 只抽取真正的专业术语，不要普通词汇
- name 用最规范的写法（通常是英文或中文全称）
- aliases 包含缩写、别称、中英文互译
- 最多返回5个最重要的术语
- 如果没有新术语返回 []
只返回JSON数组。`,
        },
        { role: "user", content: `文件路径：${filePath}\n\n内容：\n${excerpt}` },
      ],
      { max_tokens: 400 }
    );

    try {
      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
      const extracted: { name: string; aliases: string[] }[] = JSON.parse(cleaned);
      if (!Array.isArray(extracted) || extracted.length === 0) return 0;

      const terms: Term[] = extracted.map((t) => ({
        name: t.name,
        aliases: t.aliases || [],
        domain,
      }));

      await this.termStore.mergeTerms(domain, terms);

      // 为新术语自动创建空笔记占位
      for (const term of terms) {
        const notePath = `${domain}/${term.name}.md`;
        if (!(await this.app.vault.adapter.exists(notePath))) {
          await this.app.vault.create(
            notePath,
            `# ${term.name}\n\n> 自动创建的术语占位笔记\n\n## 定义\n\n## 相关概念\n`
          );
        }
      }
      return terms.length;
    } catch {
      // JSON 解析失败，忽略
      return 0;
    }
  }

  private async applyLinks(editor: Editor, file: TFile, domain: string): Promise<{ changed: boolean; patternCount: number }> {
    const patterns = (await this.termStore.getMatchPatterns(domain))
      .filter(({ pattern }) => pattern.trim().length >= 2)
      .sort((a, b) => b.pattern.length - a.pattern.length);
    if (patterns.length === 0) return { changed: false, patternCount: 0 };

    const cursor = editor.getCursor();
    let content = editor.getValue();
    let changed = false;

    for (const { pattern, canonical } of patterns) {
      const regex = buildTermRegex(pattern);

      const lines = content.split("\n");
      let inCodeBlock = false;
      let mathBlockEnd: string | null = null;

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

        // 跳过光标所在行（避免打断输入体验）
        if (i === cursor.line) continue;

        // 跳过标题行
        if (lines[i].startsWith("#")) continue;

        const newLine = linkPlainTextSegmentsOutsideMath(lines[i], regex, canonical);
        if (newLine !== lines[i]) changed = true;
        lines[i] = newLine;
      }

      content = lines.join("\n");
    }

    if (changed) {
      // 保存光标位置，修改后恢复
      const scrollInfo = (editor as any).scrollInfo?.() ?? null;
      editor.setValue(content);
      editor.setCursor(cursor);
    }
    return { changed, patternCount: patterns.length };
  }
}

function buildTermRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hasChinese = /[\u4e00-\u9fa5]/.test(pattern);

  if (hasChinese) {
    return new RegExp(escaped, "g");
  }

  return new RegExp(`\\b(${escaped})\\b`, "g");
}

function linkPlainTextSegments(line: string, regex: RegExp, canonical: string): string {
  return line
    .split(/(\[\[[^\]]+\]\])/g)
    .map((segment) => {
      if (segment.startsWith("[[") && segment.endsWith("]]")) return segment;
      return segment.replace(regex, (match) =>
        canonical === match ? `[[${match}]]` : `[[${canonical}|${match}]]`
      );
    })
    .join("");
}

function linkPlainTextSegmentsOutsideMath(line: string, regex: RegExp, canonical: string): string {
  return splitProtectedMarkdownSegments(line)
    .map((segment) => (segment.protected ? segment.text : linkPlainTextSegments(segment.text, regex, canonical)))
    .join("");
}

function splitProtectedMarkdownSegments(line: string): { text: string; protected: boolean }[] {
  const segments: { text: string; protected: boolean }[] = [];
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

function findNextProtectedSegment(line: string, from: number): { start: number; end: number } | null {
  const starts = [
    findDelimitedSegment(line, from, "$$", "$$"),
    findDelimitedSegment(line, from, "$", "$"),
    findDelimitedSegment(line, from, "\\(", "\\)"),
    findDelimitedSegment(line, from, "\\[", "\\]"),
    findDelimitedSegment(line, from, "[[", "]]"),
  ].filter((value): value is { start: number; end: number } => !!value);

  return starts.sort((a, b) => a.start - b.start)[0] ?? null;
}

function findDelimitedSegment(
  line: string,
  from: number,
  open: string,
  close: string
): { start: number; end: number } | null {
  const start = line.indexOf(open, from);
  if (start < 0) return null;
  if (open === "$" && line[start + 1] === "$") {
    return findDelimitedSegment(line, start + 2, open, close);
  }

  const closeStart = line.indexOf(close, start + open.length);
  if (closeStart < 0) return { start, end: line.length };
  return { start, end: closeStart + close.length };
}

function getMathBlockEnd(line: string): string | null {
  if (hasUnclosedDelimiter(line, "$$")) return "$$";
  if (line.includes("\\[") && !line.includes("\\]")) return "\\]";

  const env = line.match(/\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|flalign\*?|alignat\*?)\}/);
  if (!env) return null;
  const end = `\\end{${env[1]}}`;
  return line.includes(end) ? null : end;
}

function hasLatexMathEnvironment(line: string): boolean {
  return /\\begin\{(?:equation\*?|align\*?|gather\*?|multline\*?|flalign\*?|alignat\*?)\}/.test(line);
}

function hasUnclosedDelimiter(line: string, delimiter: string): boolean {
  const matches = line.match(new RegExp(escapeRegExp(delimiter), "g")) ?? [];
  return matches.length % 2 === 1;
}

function closesLatexEnvironment(line: string, endMarker: string): boolean {
  return endMarker.startsWith("\\end") && line.includes(endMarker);
}
