import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import 'highlight.js/styles/atom-one-light.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('python', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('css', css)

const languageAliasMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  vue: 'xml',
  html: 'xml',
  py: 'python',
  sh: 'bash',
  yml: 'yaml'
}

function normalizeLanguage(language: string) {
  return languageAliasMap[language.toLowerCase()] || language.toLowerCase()
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function trimLeadingCodeBlockNewline(content: string) {
  return content.replace(/^\n+/, '')
}

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code, language) {
    const normalizedCode = trimLeadingCodeBlockNewline(code)
    const normalizedLanguage = language ? normalizeLanguage(language) : ''
    const safeCode = escapeAttribute(normalizedCode)
    const languageLabel = normalizedLanguage || 'text'
    let highlighted = markdown.utils.escapeHtml(normalizedCode)

    if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
      highlighted = hljs.highlight(normalizedCode, {
        language: normalizedLanguage,
        ignoreIllegals: true
      }).value
    }

    return `
      <div class="code-block">
        <div class="code-toolbar">
          <span class="code-language">${languageLabel}</span>
          <button class="copy-code-button" type="button" data-code="${safeCode}">复制代码</button>
        </div>
        <pre class="hljs"><code>${highlighted}</code></pre>
      </div>
    `
  }
})

export function renderMarkdown(content: string) {
  return markdown.render(content)
}

function escapeHtml(content: string) {
  return markdown.utils.escapeHtml(content)
}

function renderPlainStreaming(content: string) {
  return `<div class="streaming-text">${escapeHtml(content).replace(/\n/g, '<br>')}</div>`
}

function renderStableStreamingMarkdown(content: string) {
  if (!content.includes('\n')) {
    return renderPlainStreaming(content)
  }

  if (content.endsWith('\n')) {
    return markdown.render(content)
  }

  const lastLineBreakIndex = content.lastIndexOf('\n')
  const stablePart = content.slice(0, lastLineBreakIndex + 1)
  const tailPart = content.slice(lastLineBreakIndex + 1)
  const stableHtml = stablePart.trim() ? markdown.render(stablePart) : ''
  const tailHtml = tailPart
    ? `<div class="streaming-tail">${escapeHtml(tailPart)}</div>`
    : ''

  return `${stableHtml}${tailHtml}`
}

function renderOpenFenceStreaming(content: string) {
  const lastFenceIndex = content.lastIndexOf('```')

  if (lastFenceIndex === -1) {
    return renderPlainStreaming(content)
  }

  const beforeFence = content.slice(0, lastFenceIndex)
  const fenceBody = content.slice(lastFenceIndex + 3)
  const firstLineBreakIndex = fenceBody.indexOf('\n')
  const rawLanguage = firstLineBreakIndex >= 0 ? fenceBody.slice(0, firstLineBreakIndex).trim() : fenceBody.trim()
  const code = trimLeadingCodeBlockNewline(firstLineBreakIndex >= 0 ? fenceBody.slice(firstLineBreakIndex + 1) : '')
  const normalizedLanguage = rawLanguage ? normalizeLanguage(rawLanguage) : ''
  const languageLabel = normalizedLanguage || rawLanguage || 'code'
  let preview = escapeHtml(code)

  if (normalizedLanguage && hljs.getLanguage(normalizedLanguage) && code.trim()) {
    preview = hljs.highlight(code, {
      language: normalizedLanguage,
      ignoreIllegals: true
    }).value
  }

  const beforeHtml = beforeFence.trim() ? markdown.render(beforeFence) : ''

  return `
    ${beforeHtml}
    <div class="code-block code-block-streaming">
      <div class="code-toolbar">
        <span class="code-language">${escapeHtml(languageLabel)}</span>
      </div>
      <pre class="hljs"><code>${preview || '&nbsp;'}</code></pre>
    </div>
  `
}

export function renderStreamingMarkdown(content: string) {
  const fenceCount = (content.match(/```/g) || []).length

  if (fenceCount % 2 !== 0) {
    return renderOpenFenceStreaming(content)
  }

  return renderStableStreamingMarkdown(content)
}
