/**
 * dsh-qwen-vision — browser half.
 * Zero-dependency client bundle: intercepts image pastes in the chat
 * composer, uploads them to the Node half's /qwen-vision/paste route, and
 * inserts the returned file path at the caret so the agent can vision it.
 */
window.__ModuleLoader__.load({
  id: 'dsh-qwen-vision',
  factory: function () {
    const MAX_BYTES = 25 * 1024 * 1024

    let toastTimer

    function toast(message, isError) {
      let el = document.getElementById('dsh-qwen-vision-toast')
      if (!el) {
        el = document.createElement('div')
        el.id = 'dsh-qwen-vision-toast'
        el.style.cssText =
          'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:99999;' +
          'background:#1f2430;color:#e6e8ee;padding:8px 14px;border-radius:8px;' +
          'font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);' +
          'max-width:70vw;white-space:pre-wrap;'
        document.body.appendChild(el)
      }
      el.textContent = message
      el.style.background = isError ? '#7a2424' : '#1f2430'
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => el.remove(), 3500)
    }

    function isEditableTarget(target) {
      if (!target) return false
      if (target.tagName === 'TEXTAREA') return true
      if (target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'search')) return true
      return Boolean(target.isContentEditable)
    }

    function insertText(target, text) {
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        const start = target.selectionStart ?? target.value.length
        const end = target.selectionEnd ?? target.value.length
        target.setRangeText(text, start, end, 'end')
        target.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      }
      try {
        return document.execCommand('insertText', false, text)
      } catch {
        return false
      }
    }

    async function uploadImage(file) {
      const res = await fetch('/qwen-vision/paste', { method: 'POST', body: file })
      if (!res.ok) {
        let detail = ''
        try {
          detail = (await res.json()).error ?? ''
        } catch {
          /* non-JSON error body */
        }
        throw new Error('图片上传失败 ' + res.status + (detail ? '：' + detail : ''))
      }
      const data = await res.json()
      if (typeof data.path !== 'string') throw new Error('服务端未返回图片路径')
      return data.path
    }

    function onPaste(event) {
      const items = event.clipboardData && event.clipboardData.items
      if (!items) return
      const images = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file' && /^image\//.test(item.type)) {
          const file = item.getAsFile()
          if (file) images.push(file)
        }
      }
      if (!images.length) return
      if (!isEditableTarget(event.target)) return

      event.preventDefault()
      event.stopPropagation()

      void (async () => {
        const paths = []
        for (const file of images) {
          if (file.size > MAX_BYTES) {
            toast('图片超过 25MB，已跳过', true)
            continue
          }
          try {
            toast('正在上传图片…')
            paths.push(await uploadImage(file))
          } catch (err) {
            toast(String(err?.message ?? err), true)
          }
        }
        if (paths.length) {
          if (!insertText(event.target, paths.join('\n'))) {
            toast('无法写入输入框，请检查光标位置', true)
            return
          }
          toast('图片已就绪（' + paths.length + ' 张），直接发送问题即可')
        }
      })()
    }

    function apply() {
      document.addEventListener('paste', onPaste, true)
    }

    return { apply }
  },
})
