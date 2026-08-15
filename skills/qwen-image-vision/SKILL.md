# Qwen 图片视觉（qwen-image-vision）

当用户的请求涉及图片时，按以下来源定位图片文件并调用 Qwen-MM-Plugins 的 MCP 视觉工具回答。
**永远不要**让用户为了让你看图而手动保存文件或手打路径。

## 定位图片来源

1. **聊天中粘贴的图片**：消息文本里出现 `qwen-vision-paste` 目录下的路径
   （Windows 形如 `C:\Users\<user>\.dsh\qwen-vision-paste\paste-....png`，POSIX 形如
   `~/.dsh/qwen-vision-paste/...`）→ 直接使用该路径。
2. **拖拽进聊天框的附件**：用户说"看下我发的图/附件"但消息里没有路径 →
   到 `<DSH_HOME>/attachments/v1/objects/` 下取修改时间最新的文件作为图片。
3. **剪贴板截图**：用户说"看剪贴板/看截图/刚截的图"等 →
   用 pwsh 通过 STA runspace 读取剪贴板图片并保存（pwsh 的 Get-Clipboard 不支持图片）：

   ```powershell
   $rs = [runspacefactory]::CreateRunspace(); $rs.ApartmentState = 'STA'; $rs.Open()
   $ps = [powershell]::Create(); $ps.Runspace = $rs
   $null = $ps.AddScript('Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $i = [System.Windows.Forms.Clipboard]::GetImage(); if ($i) { $p = Join-Path $env:TEMP ("clip-" + [guid]::NewGuid().ToString("N") + ".png"); $i.Save($p, [System.Drawing.Imaging.ImageFormat]::Png); Write-Output $p } else { Write-Output "EMPTY" }')
   $path = ($ps.Invoke() | Where-Object { $_ -ne 'EMPTY' } | Select-Object -First 1)
   $rs.Close()
   ```

   输出 `EMPTY` 时提示用户先 Win+Shift+S 截图或复制一张图片。
4. **用户直接给了本地路径/URL** → 直接使用。

## 工具选择

- 内容描述 / 自由问答 → `mcp__qwen-mm-plugins-api__vision_chat`（`images: [路径|URL|dataURL]`，`text` 为用户问题）
- 提取图中文字 → `mcp__qwen-mm-plugins-api__ocr`（`image_path`）
- 定位/检测物体（返回框坐标）→ `mcp__qwen-mm-plugins-api__grounding`
- 音视频转写/理解 → `mcp__qwen-mm-plugins-api__omni_asr` / `omni_av_caption` / `transcribe_audio` 等

## 兜底

- 若会话中 MCP 工具不可用，读取 `~/.qwen-mm-plugins/config` 中的 `DASHSCOPE_API_KEY`，
  直连 DashScope OpenAI 兼容接口（`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`，
  model 默认 `qwen3.7-plus`，图片用 image_url 传 URL 或 base64 data URL）。
- 图片路径指向不存在的文件时，先 `ls` 该目录确认，再报告用户。
