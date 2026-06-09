import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";

import { FormulaCompleter } from "./formulaCompletion";
import { FormulaReceiver } from "./formulaReceiver";
import { TermLinker } from "./termLinker";
import { MdStructurer } from "./mdStructurer";
import { TermStore } from "./termStore";
import { AgentCore } from "./agentCore";
import { FloatingAgentBox } from "./floatingAgentBox";
import {
  AIProvider,
  MODEL_NAMES,
  answerLastQuestion,
  continueLastPart,
} from "./deepseek";

interface AIEnhancerSettings {
  provider: AIProvider;
  geminiApiKey: string;
  deepseekApiKey: string;
  apiKey?: string;
  formulaProvider: AIProvider;
  formulaModel: string;
  termProvider: AIProvider;
  termModel: string;
  structureProvider: AIProvider;
  structureModel: string;
  answerProvider: AIProvider;
  answerModel: string;
  continueProvider: AIProvider;
  continueModel: string;
  agentProvider: AIProvider;
  agentModel: string;
  enableFormulaCompletion: boolean;
  enableTermLinking: boolean;
  enableMdStructure: boolean;
  formulaBridgePath: string;
  formulaInline: boolean;
}

const DEFAULT_SETTINGS: AIEnhancerSettings = {
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
  formulaInline: false,
};

export default class AIEnhancerPlugin extends Plugin {
  settings: AIEnhancerSettings;
  private termStore: TermStore;
  private formulaCompleter: FormulaCompleter;
  private formulaReceiver: FormulaReceiver;
  private termLinker: TermLinker;
  private mdStructurer: MdStructurer;
  private agentBox: FloatingAgentBox;
  private isAnsweringLastQuestion = false;
  private isContinuingLastPart = false;
  private lastMarkdownView: MarkdownView | null = null;

  async onload() {
    await this.loadSettings();

    // 确保插件数据目录存在
    await this.ensureDataDir();

    // 初始化各模块
    this.termStore = new TermStore(this.app);
    this.formulaCompleter = new FormulaCompleter(this.app, this.getFeatureAIConfig("formula"));
    this.formulaReceiver = new FormulaReceiver(this.app, this.settings);
    this.termLinker = new TermLinker(this.app, this.getFeatureAIConfig("term"), this.termStore);
    this.mdStructurer = new MdStructurer(this.getFeatureAIConfig("structure"));
    this.lastMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);

    this.agentBox = new FloatingAgentBox(
      new AgentCore(
        this.app,
        () => this.getFeatureAIConfig("agent"),
        () => this.getTargetMarkdownView()
      )
    );

    // 注册公式补全（使用 Obsidian 内置的 EditorSuggest 系统，自带 Tab 接受）
    if (this.settings.enableFormulaCompletion) {
      this.registerEditorSuggest(this.formulaCompleter);
    }

    this.registerDomEvent(document, "compositionstart", () => {
      this.formulaCompleter.setComposing(true);
    });

    this.registerDomEvent(document, "compositionend", () => {
      this.formulaCompleter.setComposing(false);
    });

    // 监听编辑器变化
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor: Editor, view: MarkdownView) => {
        this.lastMarkdownView = view;
        const file = view.file;
        if (!file) return;

        // 术语链接
        if (this.settings.enableTermLinking) {
          this.termLinker.onEditorChange(editor, file);
        }
      })
    );

    this.addCommand({
      id: "structure-note-before-cursor",
      name: "结构化当前光标前文",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "S" }],
      editorCallback: (editor: Editor, view: MarkdownView) => {
        if (!this.settings.enableMdStructure) return;
        if (!view.file) return;
        this.mdStructurer.structurizeBeforeCursor(editor);
      },
    });

    this.addCommand({
      id: "mark-terms-now",
      name: "一键完成术语标记",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "L" }],
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        if (!view.file) return;

        new Notice("正在标记术语...");
        const result = await this.termLinker.markTermsNow(editor, view.file);

        if (result.changed) {
          new Notice(result.extractedCount > 0 ? `术语标记完成，新增 ${result.extractedCount} 个术语` : "术语标记完成");
          return;
        }

        if (result.patternCount === 0) {
          new Notice(result.canExtract ? "没有抽取到可标记术语" : "术语库为空，请先配置模型 API Key 或已有术语库");
          return;
        }

        new Notice(result.extractedCount > 0 ? `新增 ${result.extractedCount} 个术语，但当前文档无需补充链接` : "当前文档暂无需要补充的术语链接");
      },
    });

    this.addCommand({
      id: "open-floating-agent",
      name: "呼出极简 Agent 指令框",
      callback: () => {
        this.agentBox.show();
      },
    });

    this.addRibbonIcon("bot", "AI Agent", () => {
      this.agentBox.show();
    });

    this.registerEvent(
      this.app.workspace.on("file-open", async (file: TFile | null) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) this.lastMarkdownView = activeView;
        if (!file || !this.settings.enableFormulaCompletion) return;

        const domain = this.termStore.getDomain(file.path);
        const terms = await this.termStore.loadTerms(domain);
        const names = terms.map((term) => term.name);
        void this.formulaCompleter.warmup(names);
      })
    );

    this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
      void this.answerLastQuestionOnCommandOption(evt);
      void this.continueLastPartOnCommandControl(evt);
    });

    // 设置面板
    this.addSettingTab(new AIEnhancerSettingTab(this.app, this));

    // 状态栏提示
    const statusBar = this.addStatusBarItem();
    statusBar.setText("AI ✦");
    statusBar.title = "AI Enhancer 运行中";

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
    // 同步更新各模块的模型与 API Key
    this.formulaCompleter?.updateAIConfig(this.getFeatureAIConfig("formula"));
    this.termLinker?.updateAIConfig(this.getFeatureAIConfig("term"));
    this.mdStructurer?.updateAIConfig(this.getFeatureAIConfig("structure"));
    this.formulaReceiver?.restart();
  }

  getAIConfig() {
    return {
      provider: this.settings.provider,
      geminiApiKey: this.settings.geminiApiKey,
      deepseekApiKey: this.settings.deepseekApiKey,
    };
  }

  getFeatureAIConfig(feature: "formula" | "term" | "structure" | "answer" | "continue" | "agent") {
    const providerKey = `${feature}Provider` as keyof AIEnhancerSettings;
    const modelKey = `${feature}Model` as keyof AIEnhancerSettings;
    const provider = (this.settings[providerKey] as AIProvider | undefined) || this.settings.provider;
    return {
      provider,
      geminiApiKey: this.settings.geminiApiKey,
      deepseekApiKey: this.settings.deepseekApiKey,
      model: ((this.settings[modelKey] as string | undefined) || defaultModelFor(provider)).trim(),
    };
  }

  private async answerLastQuestionOnCommandOption(evt: KeyboardEvent) {
    if (!evt.metaKey || !evt.altKey || evt.ctrlKey) return;
    if (evt.repeat || this.isAnsweringLastQuestion) return;

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) return;

    evt.preventDefault();
    evt.stopPropagation();

    const aiConfig = this.getFeatureAIConfig("answer");
    if (!this.hasApiKey(aiConfig)) {
      new Notice("请先配置所选模型的 API Key");
      return;
    }

    const editor = view.editor;
    const documentText = editor.getValue();
    if (!documentText.trim()) return;

    this.isAnsweringLastQuestion = true;
    const cursor = editor.getCursor();

    try {
      new Notice("正在回答全文最后一个问题...");
      const answer = await answerLastQuestion(aiConfig, documentText);
      if (!answer.trim()) {
        new Notice("没有找到明确的问题");
        return;
      }

      editor.replaceRange(answer.trim(), cursor);
    } catch (error) {
      console.error("AI Enhancer last-question answer failed", error);
      new Notice(formatAIError("回答失败", aiConfig, error));
    } finally {
      this.isAnsweringLastQuestion = false;
    }
  }

  private async continueLastPartOnCommandControl(evt: KeyboardEvent) {
    if (!evt.metaKey || !evt.ctrlKey || evt.altKey) return;
    if (evt.repeat || this.isContinuingLastPart) return;

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) return;

    evt.preventDefault();
    evt.stopPropagation();

    const aiConfig = this.getFeatureAIConfig("continue");
    if (!this.hasApiKey(aiConfig)) {
      new Notice("请先配置所选模型的 API Key");
      return;
    }

    const editor = view.editor;
    const documentText = editor.getValue();
    if (!documentText.trim()) return;

    this.isContinuingLastPart = true;
    const cursor = editor.getCursor();

    try {
      new Notice("正在续写最后部分...");
      const completion = await continueLastPart(aiConfig, documentText);
      if (!completion.trim()) {
        new Notice("最后部分已经比较完整");
        return;
      }

      editor.replaceRange(completion.trim(), cursor);
    } catch (error) {
      console.error("AI Enhancer continuation failed", error);
      new Notice(formatAIError("续写失败", aiConfig, error));
    } finally {
      this.isContinuingLastPart = false;
    }
  }

  private hasApiKey(config: { provider: AIProvider; geminiApiKey: string; deepseekApiKey: string }) {
    return config.provider === "gemini" ? !!config.geminiApiKey : !!config.deepseekApiKey;
  }

  private getTargetMarkdownView(): MarkdownView | null {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) {
      this.lastMarkdownView = active;
      return active;
    }
    return this.lastMarkdownView?.file ? this.lastMarkdownView : null;
  }

  private async ensureDataDir() {
    const dir = ".obsidian/plugins/ai-enhancer";
    try {
      await this.app.vault.adapter.mkdir(dir);
    } catch {
      // 目录已存在，忽略
    }
  }
}

class AIEnhancerSettingTab extends PluginSettingTab {
  plugin: AIEnhancerPlugin;

  constructor(app: App, plugin: AIEnhancerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "AI Enhancer 设置" });

    new Setting(containerEl)
      .setName("模型提供商")
      .setDesc("选择插件调用 Gemini 或 DeepSeek")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("gemini", `Gemini - ${MODEL_NAMES.gemini}`)
          .addOption("deepseek", `DeepSeek - ${MODEL_NAMES.deepseek}`)
          .setValue(this.plugin.settings.provider)
          .onChange(async (value) => {
            this.plugin.settings.provider = value as AIProvider;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("Gemini API Key")
      .setDesc(`用于 ${MODEL_NAMES.gemini}`)
      .addText((text) =>
        text
          .setPlaceholder("AIza...")
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("DeepSeek API Key")
      .setDesc(`用于 ${MODEL_NAMES.deepseek}`)
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.deepseekApiKey)
          .onChange(async (value) => {
            this.plugin.settings.deepseekApiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "各功能模型" });

    addFeatureModelSetting(containerEl, this.plugin, "公式补全", "formulaProvider", "formulaModel");
    addFeatureModelSetting(containerEl, this.plugin, "术语链接", "termProvider", "termModel");
    addFeatureModelSetting(containerEl, this.plugin, "结构化", "structureProvider", "structureModel");
    addFeatureModelSetting(containerEl, this.plugin, "全文问答", "answerProvider", "answerModel");
    addFeatureModelSetting(containerEl, this.plugin, "风格续写", "continueProvider", "continueModel");
    addFeatureModelSetting(containerEl, this.plugin, "资料 Agent", "agentProvider", "agentModel");

    containerEl.createEl("h3", { text: "功能开关" });

    new Setting(containerEl)
      .setName("公式自动补全")
      .setDesc("写下术语后自动弹出相关公式建议，Tab 接受")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableFormulaCompletion)
          .onChange(async (value) => {
            this.plugin.settings.enableFormulaCompletion = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("术语自动链接")
      .setDesc("AI 识别专业术语并自动加 [[链接]]，同时维护领域术语库")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableTermLinking)
          .onChange(async (value) => {
            this.plugin.settings.enableTermLinking = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("MD 实时结构化")
      .setDesc("换行时自动整理光标前内容的 Markdown 格式")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableMdStructure)
          .onChange(async (value) => {
            this.plugin.settings.enableMdStructure = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "手写公式接收" });

    new Setting(containerEl)
      .setName("formula-bridge 路径")
      .setDesc("Mac helper 的绝对路径。留空则不启动手写公式接收；也兼容旧的 server.js")
      .addText((text) =>
        text
          .setPlaceholder("/path/to/formula-peer-bridge")
          .setValue(this.plugin.settings.formulaBridgePath)
          .onChange(async (value) => {
            this.plugin.settings.formulaBridgePath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("插入行内公式")
      .setDesc("开启后插入 $...$，关闭则在空行插入 $$...$$")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.formulaInline)
          .onChange(async (value) => {
            this.plugin.settings.formulaInline = value;
            await this.plugin.saveSettings();
          })
      );
  }
}


function defaultModelFor(provider: AIProvider): string {
  return provider === "gemini" ? MODEL_NAMES.gemini : MODEL_NAMES.deepseek;
}

function addFeatureModelSetting(
  containerEl: HTMLElement,
  plugin: AIEnhancerPlugin,
  label: string,
  providerKey: keyof AIEnhancerSettings,
  modelKey: keyof AIEnhancerSettings
) {
  let textInput: { setValue(value: string): unknown };
  new Setting(containerEl)
    .setName(label)
    .setDesc("选择模型提供商，并填写模型名称")
    .addDropdown((dropdown) =>
      dropdown
        .addOption("gemini", "Gemini")
        .addOption("deepseek", "DeepSeek")
        .setValue((plugin.settings[providerKey] as string) || plugin.settings.provider)
        .onChange(async (value) => {
          const provider = value as AIProvider;
          plugin.settings[providerKey] = provider as never;
          const currentModel = (plugin.settings[modelKey] as string | undefined)?.trim() || "";
          if (!currentModel || modelLooksMismatched(provider, currentModel)) {
            plugin.settings[modelKey] = defaultModelFor(provider) as never;
          }
          await plugin.saveSettings();
          textInput.setValue((plugin.settings[modelKey] as string | undefined) || "");
        })
    )
    .addText((text) => {
      textInput = text;
      return text
        .setPlaceholder("gemini-3.1-flash-lite / deepseek-v4-flash")
        .setValue((plugin.settings[modelKey] as string | undefined) || "")
        .onChange(async (value) => {
          plugin.settings[modelKey] = value.trim() as never;
          await plugin.saveSettings();
        });
    });
}


function modelLooksMismatched(provider: AIProvider, model: string): boolean {
  const normalized = model.toLowerCase();
  if (provider === "deepseek") return normalized.includes("gemini");
  return normalized.includes("deepseek");
}

function formatAIError(prefix: string, config: { provider: AIProvider; model?: string }, error: unknown): string {
  const model = config.model || defaultModelFor(config.provider);
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/API error (\d+)/);
  const status = statusMatch ? `，状态码 ${statusMatch[1]}` : "";
  return `${prefix}：${config.provider} / ${model} 不可用${status}`;
}
