import { Notice } from "obsidian";
import { AgentCore } from "./agentCore";

export class FloatingAgentBox {
  private root: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private busy = false;

  constructor(private readonly agent: AgentCore) {}

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
        "backdrop-filter:blur(16px)",
      ].join(";")
    );

    const dot = this.root.createDiv();
    dot.setAttr(
      "style",
      "width:8px;height:8px;border-radius:50%;background:#49d17d;flex:0 0 auto;"
    );

    this.input = this.root.createEl("input");
    this.input.type = "text";
    this.input.placeholder = "让 Agent 做什么...";
    this.input.setAttr(
      "style",
      [
        "flex:1",
        "border:0",
        "outline:0",
        "background:transparent",
        "color:white",
        "font-size:15px",
        "line-height:24px",
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

  private async submit() {
    if (!this.input || this.busy) return;
    const request = this.input.value.trim();
    if (!request) {
      this.hide();
      return;
    }

    this.busy = true;
    this.input.disabled = true;
    this.input.value = "处理中...";

    try {
      const message = await this.agent.run(request);
      new Notice(message);
      this.hide();
    } catch (error) {
      console.error("AI Enhancer floating agent failed", error);
      new Notice(error instanceof Error ? error.message : String(error));
      this.hide();
    }
  }
}
