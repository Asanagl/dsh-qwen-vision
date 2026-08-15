# dsh-qwen-vision

[![version](https://img.shields.io/github/v/release/Asanagl/dsh-qwen-vision)](https://github.com/Asanagl/dsh-qwen-vision/releases)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh](https://img.shields.io/badge/DeepSeek%20Harness-0.1.0--rc.6-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)
[![qwen-mm-plugins](https://img.shields.io/badge/Qwen--MM--Plugins-api%20v1.0.2-7B68EE)](https://github.com/QwenLM/Qwen-MM-Plugins)

> English: [README.en.md](README.en.md)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web GUI 装上"眼睛"。
本插件整合 [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) 的云端视觉模型，让没有
原生视觉能力的模型在 Agent 工作流层面获得完整的图片/音视频理解能力。

## ✨ 功能

1. **Qwen 视觉 MCP 工具** —— 为 agent 注册 `mcp__qwen-mm-plugins-api__vision_chat`、`ocr`、
   `grounding`、`omni_asr`、`omni_av_caption`、`transcribe_audio`、`segmentation` 等工具。
2. **聊天框直接粘贴图片** —— 在输入框 Ctrl+V 图片：自动上传到 `POST /qwen-vision/paste`，
   保存到 `$DSH_HOME/qwen-vision-paste/`，并把**文件路径插入光标处**，无需手打路径。
3. **`qwen-image-vision` 技能** —— 每个会话自动学会把四种来源的图片路由到视觉工具：
   粘贴的图、拖拽进聊天框的附件、Windows 剪贴板截图、用户给的本地路径/URL。
4. **零依赖、免构建** —— 纯 JavaScript 产物，没有 `prepare` 脚本，git 安装无需 allowBuilds 授权。

## 🚀 快速开始

### 1. 安装

```sh
dsh plugin --profile web add github:Asanagl/dsh-qwen-vision
```

安装后重启 profile：

```sh
dsh --profile web
```

> 建议锁定版本：`dsh plugin --profile web add github:Asanagl/dsh-qwen-vision#v0.1.0`

### 2. 配置 DashScope API Key

DSH 启动 MCP 子进程前会过滤凭据类环境变量，因此 key 必须写入 Qwen-MM-Plugins 的共享配置文件
（视觉、OCR、ASR 等云端能力需要；本地 `core` 文件读取不需要）：

```sh
mkdir -p ~/.qwen-mm-plugins
printf 'DASHSCOPE_API_KEY=sk-...\n' > ~/.qwen-mm-plugins/config
```

也可以运行 Qwen-MM-Plugins 安装器的 **Configure** 步骤完成配置。
Key 在 [阿里云百炼](https://bailian.console.aliyun.com/) 申请。

### 3. 使用

| 你的操作 | Agent 的反应 |
|---|---|
| 截图后 Ctrl+V 到输入框，直接提问 | 读取插入的路径，调用 `vision_chat` |
| 不粘贴，直接说"看下我刚截的图" | 直接读取 Windows 剪贴板图片 |
| 把图片拖进聊天框，说"看下我发的图" | 到附件库取最新一张并识别 |
| 把图片路径/URL 发给它 | 直接识别 |

## 🏗 工作原理

```
┌─────────────────────────── DeepSeek Harness (web profile) ───────────────────────────┐
│                                                                                       │
│  cordis.patch.yml (bundle 层)                                                         │
│   ├── mcp-qwen-mm-plugins-api ── stdio ──▶ uvx qwen-mm-plugins[api] ──▶ DashScope     │
│   │                                        (Qwen VL / Omni 云端模型)                  │
│   └── qwen-vision (本包，双面插件)                                                     │
│        ├─ Node 半 (index.js)                                                          │
│        │    ├─ POST /qwen-vision/paste  →  $DSH_HOME/qwen-vision-paste/*.png          │
│        │    └─ ctx.skills.register('qwen-image-vision')                              │
│        └─ 浏览器半 (client.js, window.__ModuleLoader__)                                │
│             └─ 拦截输入框 paste 事件 → 上传 → 光标处插入路径                              │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

- **组合包层**（`cordis.patch.yml`）：插入 `@deepseek-ai/dsh-mcp-client` 行注册 Qwen-MM-Plugins
  的 stdio MCP server，以及本包自身的插件行。
- **Node 半**（`index.js`）：在 `ctx.webServer` 注册粘贴接收路由（25MB 上限，同名同构图片格式），
  在 `ctx.skills` 注册 `qwen-image-vision` 技能。两者在服务缺失时都会静默跳过，
  因此插件也能装进没有 Web 面的 profile。
- **浏览器半**（`client.js`）：零依赖 client 模块，通过 `window.__ModuleLoader__.load`
  注册工厂，捕获阶段拦截输入框的图片粘贴事件。

## 📋 环境要求

- DeepSeek Harness **0.1.0-rc.6+**（已在 rc.6 验证）
- PATH 中有 [uv](https://docs.astral.sh/uv/)（提供 `uvx`）和 `git`
- DashScope API Key（云端视觉能力）
- 音视频能力（`omni_*` / `transcribe_audio`）需要 ffmpeg

## 🔧 常用配置

Qwen-MM-Plugins 的运行时配置都写在 `~/.qwen-mm-plugins/config`（`KEY=VALUE` 行，环境变量优先）。
常用项：

| 变量 | 默认 | 用途 |
|---|---|---|
| `DASHSCOPE_API_KEY` | — | 云端视觉/OCR/ASR 等（必配） |
| `DASHSCOPE_BASE_URL` | DashScope 兼容地址 | 覆盖 OpenAI 兼容端点 |
| `QWEN_MM_API_VL_MODEL` | `qwen3.7-plus` | vision_chat / OCR / grounding 默认模型 |
| `QWEN_MM_API_OMNI_MODEL` | `qwen3.5-omni-plus` | Omni 音视频理解默认模型 |

完整目录见 [Qwen-MM-Plugins 配置参考](https://github.com/QwenLM/Qwen-MM-Plugins/blob/main/docs/en/configuration.md)。

## ❓ 常见问题

**装了之后工具没出现？**
MCP 行在 profile 启动时加载。重启 `dsh --profile web` 并**新建会话**后再看工具列表。

**Windows 上能用吗？**
能。本插件为 MCP 子进程设置了 `PYTHONUTF8=1`，规避中文 Windows 的 GBK 控制台编码崩溃；
`uvx` 走原生 Windows 的 uv。上游 Qwen-MM-Plugins 官方仅在 WSL2 验证，原生 Windows 属社区路径。

**MCP 工具调用失败怎么排查？**
手动跑一次系统检查：

```sh
uvx --from "qwen-mm-plugins[api] @ git+https://github.com/QwenLM/Qwen-MM-Plugins.git@qwen-mm-plugins-api-v1.0.2" \
  qwen-mm-plugins-api --check-system
```

**要花钱吗？**
`vision_chat` / `ocr` / `omni_*` 等走 DashScope 云端，按量计费；费用在百炼控制台查看。
粘贴接收、路径插入、技能本身都在本地，不产生费用。

**如何卸载？**

```sh
dsh plugin --profile web remove dsh-qwen-vision
```

已保存的粘贴图片在 `$DSH_HOME/qwen-vision-paste/`，可自行删除。

## ⚠️ 已知限制

- DSH 0.1.0-rc.6 会把 MCP 返回的 image/audio/resource 块渲染为 `content discarded`；
  **文本结果**（看图回答、OCR、语音转写）完全可用，依赖媒体回传的流程尚不完整。
- 粘贴只支持**图片**；非图片文件请继续用拖拽或路径。
- 25MB 单图上限（超大图会弹 toast 跳过）。

## 🔄 更新

```sh
dsh plugin --profile web add github:Asanagl/dsh-qwen-vision#v0.1.0
```

插件随 Qwen-MM-Plugins 的不可变 tag（`qwen-mm-plugins-api-v1.0.2`）固定，升级视觉后端 =
在 `cordis.patch.yml` 中改 args 里的 tag 并重启。

## 📄 许可证

MIT。Qwen-MM-Plugins 为 Apache-2.0，在运行时拉取，未随包分发。
