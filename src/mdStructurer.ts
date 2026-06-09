import { Editor, TFile } from "obsidian";
import { AIClientConfig, aiChat, getActiveApiKey } from "./deepseek";

export class MdStructurer {
  private aiConfig: AIClientConfig;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private lastProcessedContent = "";

  constructor(aiConfig: AIClientConfig) {
    this.aiConfig = aiConfig;
  }

  updateAIConfig(aiConfig: AIClientConfig) { this.aiConfig = aiConfig; }

  structurizeBeforeCursor(editor: Editor) {
    if (!getActiveApiKey(this.aiConfig) || this.isProcessing) return;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.structurize(editor), 100);
  }

  private async structurize(editor: Editor) {
    const cursor = editor.getCursor();
    // 只处理光标前的内容
    const fullContent = editor.getValue();
    const lines = fullContent.split("\n");

    // 取光标前所有行（不含当前行）
    const beforeLines = lines.slice(0, cursor.line);
    const beforeContent = beforeLines.join("\n");
    const afterContent = lines.slice(cursor.line).join("\n");

    if (beforeContent === this.lastProcessedContent) return;
    if (beforeContent.trim().length < 50) return; // 内容太少不处理
    if (isInsideCodeBlock(beforeLines)) return;

    this.isProcessing = true;

    try {
      const structured = await aiChat(
        this.aiConfig,
        [
          {
            role: "system",
            content: `你是一个 Obsidian Markdown 笔记清洗助手。将用户输入的全部前文整理成更清晰的 Markdown 格式。
规则：
- 识别并添加合适的标题层级（##、###）
- 列举式内容转为 - 列表
- 重要术语、定义可以加粗（**术语**），但不要过度加粗
- 公式保持原样（$...$）
- 已有的 [[链接]] 保持原样，不要改动
- 代码块保持原样
- 保持内容完整，不要删减任何信息
- 不要添加原文没有的内容
- 不要把普通段落改成夸张标题
- 不要输出代码围栏
直接返回格式化后的 Markdown，不要任何解释。`,
          },
          { role: "user", content: beforeContent },
        ],
        { max_tokens: 2000 }
      );

      this.lastProcessedContent = beforeContent;
      const cleaned = stripMarkdownFence(structured).trim();
      if (!cleaned) return;
      if (cleaned === beforeContent.trim()) return;

      // 把结构化结果和光标后内容拼回
      const newContent = cleaned + "\n" + afterContent;

      // 保留光标位置（近似）
      editor.setValue(newContent);

      // 尝试把光标移到合理位置（结构化后行数可能变化）
      const newLines = newContent.split("\n");
      const lineDelta = cleaned.split("\n").length - beforeLines.length;
      const safeLineNo = Math.max(0, Math.min(cursor.line + lineDelta, newLines.length - 1));
      editor.setCursor({ line: safeLineNo, ch: cursor.ch });
    } catch {
      // API 失败静默处理，不打断用户
    } finally {
      this.isProcessing = false;
    }
  }
}

function isInsideCodeBlock(lines: string[]): boolean {
  return lines.filter((line) => line.trim().startsWith("```")).length % 2 !== 0;
}

function stripMarkdownFence(text: string): string {
  return text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "");
}
