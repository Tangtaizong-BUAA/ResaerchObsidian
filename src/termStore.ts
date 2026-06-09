import { App, TFile, TFolder, Vault } from "obsidian";

export interface Term {
  name: string;       // 规范术语名，用作笔记标题
  aliases: string[];  // 同义词、缩写
  domain: string;     // 所属领域（从文件夹推断）
}

export class TermStore {
  private cache: Map<string, Term[]> = new Map(); // domain -> terms
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  // 从文件夹路径推断领域标识，例如 "Course/notes" -> "Course"
  getDomain(filePath: string): string {
    const parts = filePath.split("/");
    return parts.length > 1 ? parts[0] : "general";
  }

  // 读取领域术语库（存在 .obsidian/plugins/ai-enhancer/{domain}_terms.json）
  async loadTerms(domain: string): Promise<Term[]> {
    if (this.cache.has(domain)) return this.cache.get(domain)!;
    const path = `.obsidian/plugins/ai-enhancer/${domain.replace(/\s/g, "_")}_terms.json`;
    try {
      const raw = await this.app.vault.adapter.read(path);
      const terms: Term[] = JSON.parse(raw);
      this.cache.set(domain, terms);
      return terms;
    } catch {
      this.cache.set(domain, []);
      return [];
    }
  }

  async saveTerms(domain: string, terms: Term[]): Promise<void> {
    this.cache.set(domain, terms);
    const path = `.obsidian/plugins/ai-enhancer/${domain.replace(/\s/g, "_")}_terms.json`;
    await this.app.vault.adapter.write(path, JSON.stringify(terms, null, 2));
  }

  // 把新术语合并进术语库（去重）
  async mergeTerms(domain: string, newTerms: Term[]): Promise<void> {
    const existing = await this.loadTerms(domain);
    const nameSet = new Set(existing.map((t) => t.name.toLowerCase()));
    for (const t of newTerms) {
      if (!nameSet.has(t.name.toLowerCase())) {
        existing.push(t);
        nameSet.add(t.name.toLowerCase());
      } else {
        // 合并别名
        const old = existing.find((e) => e.name.toLowerCase() === t.name.toLowerCase())!;
        for (const alias of t.aliases) {
          if (!old.aliases.includes(alias)) old.aliases.push(alias);
        }
      }
    }
    await this.saveTerms(domain, existing);
  }

  // 获取所有匹配词（术语名 + 别名）→ 用于正则匹配
  async getMatchPatterns(domain: string): Promise<{ pattern: string; canonical: string }[]> {
    const terms = await this.loadTerms(domain);
    const patterns: { pattern: string; canonical: string }[] = [];
    for (const t of terms) {
      patterns.push({ pattern: t.name, canonical: t.name });
      for (const alias of t.aliases) {
        patterns.push({ pattern: alias, canonical: t.name });
      }
    }
    return patterns;
  }
}
