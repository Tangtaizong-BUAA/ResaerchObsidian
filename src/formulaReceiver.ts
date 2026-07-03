import { App, Editor, MarkdownView } from "obsidian";
import { spawn } from "child_process";
import type { ChildProcess, SpawnOptionsWithoutStdio } from "child_process";

export interface FormulaReceiverSettings {
  formulaBridgePath: string;
  formulaInline: boolean;
}

export class FormulaReceiver {
  private app: App;
  private settings: FormulaReceiverSettings;
  private process: ChildProcess | null = null;
  private stdoutBuffer = "";

  constructor(app: App, settings: FormulaReceiverSettings) {
    this.app = app;
    this.settings = settings;
  }

  start() {
    if (this.process || !this.settings.formulaBridgePath) return;

    const bridge = resolveBridgeCommand(this.settings.formulaBridgePath);

    this.process = spawn(bridge.command, bridge.args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: bridge.shell,
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      this.stdoutBuffer += data.toString();
      const lines = this.stdoutBuffer.split(/\r?\n/);
      this.stdoutBuffer = lines.pop() ?? "";
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

    this.process.on("error", (error) => {
      console.error(`[formula-bridge] failed to start: ${error.message}`);
      this.process = null;
      this.stdoutBuffer = "";
    });

    this.process.on("exit", (code) => {
      console.log(`[formula-bridge] process exited, code=${code}`);
      this.process = null;
      this.stdoutBuffer = "";
    });
  }

  restart() {
    this.stop();
    this.start();
  }

  stop() {
    this.process?.kill();
    this.process = null;
    this.stdoutBuffer = "";
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

function resolveBridgeCommand(bridgePath: string): { command: string; args: string[]; shell: SpawnOptionsWithoutStdio["shell"] } {
  const path = bridgePath.trim();
  const lower = path.toLowerCase();

  if (lower.endsWith(".js")) {
    return { command: process.platform === "win32" ? "node.exe" : "node", args: [path], shell: false };
  }

  if (process.platform === "win32" && (lower.endsWith(".cmd") || lower.endsWith(".bat"))) {
    return { command: path, args: [], shell: true };
  }

  return { command: path, args: [], shell: false };
}
