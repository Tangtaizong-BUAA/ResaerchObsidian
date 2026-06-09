import { App, Editor, MarkdownView } from "obsidian";
import { ChildProcess, spawn } from "child_process";

export interface FormulaReceiverSettings {
  formulaBridgePath: string;
  formulaInline: boolean;
}

export class FormulaReceiver {
  private app: App;
  private settings: FormulaReceiverSettings;
  private process: ChildProcess | null = null;

  constructor(app: App, settings: FormulaReceiverSettings) {
    this.app = app;
    this.settings = settings;
  }

  start() {
    if (this.process || !this.settings.formulaBridgePath) return;

    const command = this.settings.formulaBridgePath.endsWith(".js") ? "node" : this.settings.formulaBridgePath;
    const args = this.settings.formulaBridgePath.endsWith(".js") ? [this.settings.formulaBridgePath] : [];

    this.process = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const match = line.match(/^FORMULA:(.+)$/);
        if (match) {
          const latex = match[1].trim();
          this.insertFormula(latex);
        }
      }
    });

    this.process.stderr?.on("data", (data: Buffer) => {
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

  private insertFormula(latex: string) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;

    const editor: Editor = view.editor;
    const cursor = editor.getCursor();
    const currentLine = editor.getLine(cursor.line);
    const isEmpty = currentLine.trim() === "";

    let insertion: string;
    if (this.settings.formulaInline || !isEmpty) {
      insertion = `$${latex}$`;
    } else {
      insertion = `$$\n${latex}\n$$`;
    }

    editor.replaceRange(insertion, cursor);

    const newCursor = {
      line: cursor.line + (isEmpty ? 2 : 0),
      ch: isEmpty ? 2 : cursor.ch + insertion.length,
    };
    editor.setCursor(newCursor);
    editor.focus();
  }
}
