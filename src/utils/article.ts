const SENTENCE_END_REGEXP = /([^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$)/g
const MARKDOWN_HEADING_REGEXP = /^#{1,6}\s+/gm
const MARKDOWN_LINK_REGEXP = /\[([^\]]+)\]\([^)]+\)/g
const MARKDOWN_IMAGE_REGEXP = /!\[[^\]]*]\([^)]+\)/g
const MARKDOWN_FENCE_REGEXP = /```[\s\S]*?```/g
const MARKDOWN_INLINE_CODE_REGEXP = /`([^`]+)`/g
const NON_TARGET_CHAR_REGEXP = /[^A-Za-z0-9]/g

export type ParsedArticle = {
  title: string
  content: string
  sentences: string[]
}

export function cleanArticleText(rawText: string) {
  return rawText
    .replace(/\r\n?/g, '\n')
    .replace(MARKDOWN_FENCE_REGEXP, ' ')
    .replace(MARKDOWN_IMAGE_REGEXP, ' ')
    .replace(MARKDOWN_LINK_REGEXP, '$1')
    .replace(MARKDOWN_INLINE_CODE_REGEXP, '$1')
    .replace(MARKDOWN_HEADING_REGEXP, '')
    .replace(/[*_~>]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeArticleTarget(text: string) {
  return text.replace(NON_TARGET_CHAR_REGEXP, '')
}

export function splitArticleIntoSentences(content: string) {
  const matches = content.match(SENTENCE_END_REGEXP) ?? []

  return matches.map((sentence) => sentence.replace(/\s+/g, ' ').trim()).filter((sentence) => normalizeArticleTarget(sentence).length > 0)
}

export function createArticleTitle(content: string, fallbackTitle?: string) {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  const baseTitle = firstLine || fallbackTitle || '未命名文章'
  return baseTitle.length > 40 ? `${baseTitle.slice(0, 40)}...` : baseTitle
}

export function parseArticleText(rawText: string, fallbackTitle?: string): ParsedArticle {
  const content = cleanArticleText(rawText)
  const sentences = splitArticleIntoSentences(content)

  return {
    title: createArticleTitle(content, fallbackTitle),
    content,
    sentences,
  }
}

export function getArticleProgressLabel(currentSentenceIndex: number, sentenceCount: number) {
  if (sentenceCount === 0) return '0 / 0'
  const current = Math.min(currentSentenceIndex + 1, sentenceCount)
  return `${current} / ${sentenceCount}`
}
