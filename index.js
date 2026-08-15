/**
 * dsh-qwen-vision — Node half.
 * Registers:
 *   1. POST /qwen-vision/paste — saves a pasted image under
 *      $DSH_HOME/qwen-vision-paste/ and returns its absolute path.
 *   2. The "qwen-image-vision" skill via ctx.skills.register() so every
 *      session knows how to route pasted/attached/clipboard images to the
 *      qwen-mm-plugins-api MCP vision tools.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

export const name = 'dsh-qwen-vision'

const MAX_BYTES = 25 * 1024 * 1024
const PASTE_DIR = join(homedir(), '.dsh', 'qwen-vision-paste')
const SKILL_PATH = fileURLToPath(new URL('./skills/qwen-image-vision/SKILL.md', import.meta.url))

const EXT = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/bmp', '.bmp'],
  ['image/svg+xml', '.svg'],
])

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > MAX_BYTES) {
        const err = new Error('payload too large')
        err.code = 413
        reject(err)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function timestamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export function apply(ctx) {
  // Paste receiver route. Optional: skipped when this composition has no web server.
  try {
    const webServer = ctx.get('webServer')
    webServer.register({
      kind: 'exact',
      path: '/qwen-vision/paste',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'method not allowed' })
          return
        }
        try {
          const body = await readBody(req)
          if (!body.length) throw new Error('empty body')
          const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
          const ext = EXT.get(mime) ?? '.png'
          await mkdir(PASTE_DIR, { recursive: true })
          const file = join(PASTE_DIR, `paste-${timestamp()}-${randomBytes(3).toString('hex')}${ext}`)
          await writeFile(file, body)
          json(res, 200, { path: file })
        } catch (err) {
          json(res, err?.code === 413 ? 413 : 400, { error: String(err?.message ?? err) })
        }
      },
    })
  } catch {
    // No web server in this composition — the paste route simply stays absent.
  }

  // Image-vision skill. Optional: skipped when the skills registry is absent.
  try {
    const skills = ctx.get('skills')
    readFile(SKILL_PATH, 'utf8').then(
      (content) => {
        skills.register({
          name: 'qwen-image-vision',
          description:
            'Answer questions about images the user pasted into the chat (paths under ~/.dsh/qwen-vision-paste), attached via drag-and-drop, referenced as local paths, or copied to the Windows clipboard. Route them to the qwen-mm-plugins-api MCP vision tools (vision_chat / ocr / grounding).',
          whenToUse:
            'User pastes or drags an image, mentions 看图 / 看截图 / 看剪贴板 / 图片, or references a local image path.',
          content,
        })
      },
      (err) => {
        ctx.logger?.warn?.('dsh-qwen-vision: failed to read skill file', err)
      },
    )
  } catch {
    // No skills registry in this composition.
  }
}
