# AI Enhancer for Obsidian

一个面向学习笔记的 Obsidian 插件，提供公式补全、术语自动标记、Markdown 结构整理、快捷键问答/续写、极简 Agent 指令框，以及可选的 iPad 手写公式输入链路。


## 功能

- **公式补全**：在编辑公式相关内容时给出 LaTeX 补全建议。
- **术语标记**：抽取当前领域术语，并自动把正文中的术语转换为 `[[术语]]` 链接。
- **一键术语标记**：按 `Cmd + Shift + L` 主动对当前文件执行术语抽取和链接补全。
- **Markdown 结构整理**：按 `Cmd + Shift + S` 整理光标前内容的 Markdown 格式。
- **快捷键问答/续写**：回答全文最后一个问题，或续写当前文档最后部分。
- **极简 Agent 指令框**：通过命令或左侧图标呼出一个小输入框，让 Agent 在后台回答或写入当前笔记。
- **可选手写公式输入**：配合 iPad 端 FormulaBoard 和 Mac helper，把手写公式识别为 LaTeX 后插入 Obsidian。

## 项目结构

```text
.
├── src/                         # Obsidian 插件源码
│   ├── main.ts                  # 插件入口、命令和设置页
│   ├── deepseek.ts              # Gemini / DeepSeek 调用封装
│   ├── formulaCompletion.ts     # 公式补全
│   ├── termLinker.ts            # 术语抽取和链接
│   ├── mdStructurer.ts          # Markdown 结构整理
│   ├── agentCore.ts             # 极简 Agent 后台执行逻辑
│   └── formulaReceiver.ts       # 接收 Mac helper 输出的 LaTeX
├── FormulaBoard/                # iPad SwiftUI 手写公式输入端
├── formula-bridge/              # 旧版 WebSocket bridge
├── formula-peer-bridge/         # Mac 本地 helper 源码与 Pix2Text 脚本
├── manifest.json                # Obsidian 插件 manifest
├── package.json                 # 插件构建脚本
└── tsconfig.json
```

## 安装开发依赖

```bash
npm install
```

## 构建插件

```bash
npm run build
```

构建完成后会生成 `main.js`。本仓库默认不提交 `main.js`，发布 release 或手动安装时再生成即可。

## 本地安装到 Obsidian

1. 在你的 vault 下创建插件目录：

```bash
mkdir -p "/path/to/your-vault/.obsidian/plugins/ai-enhancer"
```

2. 复制必要文件：

```bash
cp manifest.json main.js "/path/to/your-vault/.obsidian/plugins/ai-enhancer/"
```

3. 打开 Obsidian，进入“设置 -> 第三方插件”，启用 `AI Enhancer`。

## API Key 配置

插件支持 Gemini 和 DeepSeek。Key 不写入仓库，只保存在你本地 Obsidian 插件数据中。

在 Obsidian 中打开：

```text
设置 -> 第三方插件 -> AI Enhancer 设置
```

然后填写：

- `Gemini API Key`
- `DeepSeek API Key`

不同功能可以单独选择模型提供商和模型名称。

## 常用快捷键

| 功能 | 默认快捷键 |
| --- | --- |
| 结构化当前光标前文 | `Cmd + Shift + S` |
| 一键完成术语标记 | `Cmd + Shift + L` |
| 回答全文最后一个问题 | `Cmd + Option` |
| 续写全文最后部分 | `Cmd + Control` |

> 如果快捷键与系统或其他插件冲突，可以在 Obsidian 的快捷键设置中重新绑定。

## 术语标记规则

术语标记会跳过以下区域，避免污染代码和数学公式：

- Markdown 标题行
- 当前正在输入的行
- 三反引号代码块
- `$$ ... $$` 数学块
- `\[ ... \]` 数学块
- `\begin{equation}`、`\begin{align}` 等 LaTeX 数学环境
- 行内 `$...$`、`\(...\)`、`\[...\]`

自动标记开启后，停止输入约 1.5 秒会触发；也可以使用 `Cmd + Shift + L` 主动触发。

## 极简 Agent 指令框

插件提供一个极简输入框，不展示聊天记录。你可以输入：

```text
把这段内容整理成课堂笔记
```

```text
给这里补一个 Bellman equation 的直观解释
```

Agent 会根据意图决定是只回答，还是把生成内容写入当前光标位置。

## iPad 手写公式链路

这是可选功能，适合把 iPad 当成手写板：

1. iPad 端 `FormulaBoard` 用于书写公式并发送图片。
2. Mac helper 接收图片，并调用本地 Pix2Text 识别 LaTeX。
3. Obsidian 插件接收 `FORMULA:<latex>` 输出，并插入当前笔记。

如需启用，在插件设置中填写 Mac helper 的绝对路径；留空则不启动手写公式接收。

Pix2Text 依赖需要你在 Mac 本地安装：

```bash
python3 -m pip install pix2text
```

## 发布前检查

公开上传前建议确认：

```bash
rg -n "AIza|sk-|api[_-]?key|secret|token|password|/Users/" -g '!node_modules'
```

本仓库的 `.gitignore` 已默认排除：

- API/env/secrets 文件
- Obsidian 本地数据
- `main.js` 构建产物
- Xcode 用户状态文件
- Mac helper 本地二进制和模型缓存

## 许可证

本项目使用 MIT License，详见 [LICENSE](LICENSE)。
