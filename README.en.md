# dsh-qwen-vision

[![version](https://img.shields.io/github/v/release/Asanagl/dsh-qwen-vision)](https://github.com/Asanagl/dsh-qwen-vision/releases)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh](https://img.shields.io/badge/DeepSeek%20Harness-0.1.0--rc.6-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

> 中文文档：[README.md](README.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that gives the Web
GUI image understanding, powered by [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins).

## Features

1. **Qwen vision MCP tools** — registers `mcp__qwen-mm-plugins-api__vision_chat`, `ocr`,
   `grounding`, `omni_*`, `transcribe_audio`, `segmentation` for the agent.
2. **Paste images into the chat** — Ctrl+V an image in the composer: it uploads to
   `POST /qwen-vision/paste`, lands in `$DSH_HOME/qwen-vision-paste/`, and its path is
   inserted at the caret. No path typing required.
3. **`qwen-image-vision` skill** — every session automatically routes pasted, drag-dropped,
   clipboard, or path-referenced images to the vision tools.
4. **Zero dependencies, no build step** — plain JavaScript; no `prepare` script to approve.

## Quick start

### Laziest path: let DSH install itself

DSH is an agent with terminal access — paste the repo URL into the chat and let it do the work:

> Please install the plugin https://github.com/Asanagl/dsh-qwen-vision for me, then remind me to
> restart dsh web and give me the verification steps.

DSH runs `dsh plugin --profile web add`, checks `uv`/`git`, and guides you through the key setup.

```sh
dsh plugin --profile web add github:Asanagl/dsh-qwen-vision
```

Configure the DashScope key (DSH scrubs credential env vars from MCP children, so a config
file is required) and restart:

```sh
mkdir -p ~/.qwen-mm-plugins
printf 'DASHSCOPE_API_KEY=sk-...\n' > ~/.qwen-mm-plugins/config
dsh --profile web
```

## Usage

| You do | Agent does |
|---|---|
| Ctrl+V an image and type your question | Reads the inserted path, calls `vision_chat` |
| Say "look at my latest screenshot" | Reads the Windows clipboard image directly |
| Drag an image into the chat box | Finds the newest attachment object and visions it |

## How it works

- **Bundle layer** (`cordis.patch.yml`): inserts an `@deepseek-ai/dsh-mcp-client` row for the
  Qwen-MM-Plugins stdio MCP server, plus this package's own dual-face row.
- **Node half** (`index.js`): registers the paste-receiver route on `ctx.webServer` and the
  `qwen-image-vision` skill on `ctx.skills`. Both skip silently when absent.
- **Browser half** (`client.js`): a zero-dependency client module
  (`window.__ModuleLoader__.load`) intercepting paste events in the composer.

## Requirements

- DeepSeek Harness 0.1.0-rc.6+ (verified with rc.6)
- [uv](https://docs.astral.sh/uv/) (`uvx`) and `git` on PATH
- A DashScope API key; ffmpeg for audio/video tools

## Known limitations

- DSH 0.1.0-rc.6 renders MCP image/audio blocks as `content discarded`; text results work fully.
- Paste supports images only; 25MB per image cap.
- Vision calls are billed by DashScope.

## License

MIT. Qwen-MM-Plugins is Apache-2.0 (fetched at runtime, not vendored).
