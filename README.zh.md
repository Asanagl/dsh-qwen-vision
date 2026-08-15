# dsh-qwen-vision

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI 加"眼睛"的插件，
基于 [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins)：

1. **Qwen 视觉 MCP 工具** — 为 agent 注册 `mcp__qwen-mm-plugins-api__vision_chat`、`ocr`、
   `grounding`、`omni_*`、`transcribe_audio`、`segmentation` 等工具。
2. **聊天框粘贴图片** — 在输入框 Ctrl+V 图片：自动上传到 `POST /qwen-vision/paste`，
   存到 `$DSH_HOME/qwen-vision-paste/`，并把文件路径插到光标处。无需手打路径。
3. **qwen-image-vision 技能** — 每个会话自动学会把粘贴/拖拽/剪贴板/路径引用的图片送到视觉工具。

## 环境要求

- DeepSeek Harness 0.1.0-rc.6+（已用 rc.6 验证）
- PATH 里有 [uv](https://docs.astral.sh/uv/)（提供 `uvx`）和 `git`
- DashScope API Key（云视觉能力需要）

## 安装

```sh
dsh plugin --profile web add github:Asanagl/dsh-qwen-vision
```

本包是纯 JavaScript 产物，没有 `prepare` 构建脚本，无需 pnpm allowBuilds 授权。

### 配置 DashScope Key

DSH 启动 MCP 子进程前会过滤凭据类环境变量，因此 key 必须写入 Qwen-MM-Plugins 共享配置：

```sh
mkdir -p ~/.qwen-mm-plugins
printf 'DASHSCOPE_API_KEY=sk-...\n' > ~/.qwen-mm-plugins/config
```

（或运行 Qwen-MM-Plugins 安装器，用它的 **Configure** 步骤配置。）

然后重启 profile 并新建会话：

```sh
dsh --profile web
```

## 使用方式

| 你的操作 | Agent 的反应 |
|---|---|
| 截图后 Ctrl+V 到输入框，直接提问 | 读取插入的路径，调用 `vision_chat` |
| 不粘贴，直接说"看下我刚截的图" | 直接读取 Windows 剪贴板图片 |
| 把图片拖进聊天框 | 到附件库找最新一张并识别 |

## 工作原理

- **组合包层**（`cordis.patch.yml`）：插入 `@deepseek-ai/dsh-mcp-client` 行（Qwen-MM-Plugins
  stdio MCP server）和本包自身的双面插件行。
- **Node 半**（`index.js`）：在 `ctx.webServer` 注册粘贴接收路由，
  在 `ctx.skills` 注册 `qwen-image-vision` 技能。
- **浏览器半**（`client.js`）：零依赖 client 模块（`window.__ModuleLoader__.load`），
  拦截输入框的粘贴事件并上传图片。

## 已知限制

- DSH 0.1.0-rc.6 会把 MCP 返回的图片/音频块渲染为 `content discarded`；文本结果（看图回答、
  OCR、转写）完全可用。
- Qwen-MM-Plugins 原生 Windows 上游未正式验证；本插件为 MCP 子进程设置 `PYTHONUTF8=1`，
  规避 GBK 控制台编码崩溃。
- 视觉调用走 DashScope 云端，按量计费。

## 许可证

MIT。Qwen-MM-Plugins 为 Apache-2.0（运行时拉取，未随包分发）。
