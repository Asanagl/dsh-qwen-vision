# dsh-qwen-vision

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that gives the
Web GUI native image understanding, powered by
[Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins):

1. **Qwen vision MCP tools** — registers `mcp__qwen-mm-plugins-api__vision_chat`, `ocr`,
   `grounding`, `omni_*`, `transcribe_audio`, `segmentation` for the agent.
2. **Paste images into the chat** — Ctrl+V an image in the composer; it is uploaded to
   `POST /qwen-vision/paste`, stored under `$DSH_HOME/qwen-vision-paste/`, and its path is
   inserted at the caret. No path typing, no drag-and-drop required.
3. **qwen-image-vision skill** — every session automatically knows how to route pasted,
   drag-dropped, clipboard, or path-referenced images to the vision tools.

## Requirements

- DeepSeek Harness 0.1.0-rc.6+ (verified with rc.6)
- [uv](https://docs.astral.sh/uv/) (provides `uvx`) and `git` on PATH
- A DashScope API key (only for the `api` capability)

## Install

```sh
dsh plugin --profile web add github:Asanagl/dsh-qwen-vision
```

The package ships plain JavaScript — there is no `prepare` script to approve.

### DashScope key

DSH scrubs credential-style environment variables before spawning MCP child processes,
so the key must live in the Qwen-MM-Plugins shared config file:

```sh
mkdir -p ~/.qwen-mm-plugins
printf 'DASHSCOPE_API_KEY=sk-...\n' > ~/.qwen-mm-plugins/config
```

(Or run the Qwen-MM-Plugins installer and use its **Configure** step.)

Then restart the profile and open a new session:

```sh
dsh --profile web
```

## Usage

| You do | Agent does |
|---|---|
| Ctrl+V (or Win+Shift+S, then paste) an image and type your question | Reads the inserted path, calls `vision_chat` |
| Say "看下我刚截的图" without pasting | Reads the Windows clipboard image directly |
| Drag an image into the chat box | Finds the newest attachment object and visions it |

## How it works

- **Bundle layer** (`cordis.patch.yml`): inserts an `@deepseek-ai/dsh-mcp-client` row for the
  Qwen-MM-Plugins stdio MCP server, plus this package's own dual-face row.
- **Node half** (`index.js`): registers the paste-receiver HTTP route on
  `ctx.webServer` and the `qwen-image-vision` skill on `ctx.skills`.
- **Browser half** (`client.js`): a zero-dependency client module
  (`window.__ModuleLoader__.load`) that intercepts paste events in the composer.

## Known limitations

- DSH 0.1.0-rc.6 renders MCP image/audio blocks as `content discarded`; text results
  (vision answers, OCR, ASR) work fully.
- Qwen-MM-Plugins on native Windows is not officially verified upstream; this plugin
  sets `PYTHONUTF8=1` for the MCP child to dodge GBK console encoding crashes.
- Vision calls are billed by DashScope.

## License

MIT. Qwen-MM-Plugins is Apache-2.0 (fetched at runtime, not vendored here).
