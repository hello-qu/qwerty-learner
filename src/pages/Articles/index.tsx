import Layout from '@/components/Layout'
import Tooltip from '@/components/Tooltip'
import { getArticleProgressLabel, parseArticleText } from '@/utils/article'
import { db } from '@/utils/db'
import { ArticleRecord } from '@/utils/db/record'
import { timeStamp2String } from '@/utils/index'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Play, Trash2, Upload } from 'lucide-react'
import type React from 'react'
import { useCallback, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

export default function ArticlesPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const articles = useLiveQuery(() => db.articles.orderBy('updatedAt').reverse().toArray(), [], [])

  const createArticle = useCallback(
    async (rawText: string, fallbackTitle?: string) => {
      const parsed = parseArticleText(rawText, fallbackTitle)
      if (parsed.content.length === 0) {
        setError('文章内容为空。')
        return
      }
      if (parsed.sentences.length === 0) {
        setError('没有识别到可练习的句子。请确认文章中包含英文字母或数字。')
        return
      }

      setIsImporting(true)
      setError('')
      try {
        const article = new ArticleRecord(parsed.title, parsed.content, parsed.sentences)
        const id = await db.articles.add(article)
        setText('')
        navigate(`/article/${id}`)
      } finally {
        setIsImporting(false)
      }
    },
    [navigate],
  )

  const handleTextImport = useCallback(() => {
    createArticle(text)
  }, [createArticle, text])

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    async (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      const isSupportedFile = file.name.endsWith('.txt') || file.name.endsWith('.md') || file.type.startsWith('text/')
      if (!isSupportedFile) {
        setError('第一版只支持 .txt 和 .md 文本文件。')
        return
      }

      const rawText = await file.text()
      await createArticle(rawText, file.name.replace(/\.(txt|md)$/i, ''))
    },
    [createArticle],
  )

  const deleteArticle = useCallback(async (id?: number) => {
    if (!id) return
    await db.articles.delete(id)
  }, [])

  return (
    <Layout>
      <header className="container z-20 mx-auto w-full px-10 py-6">
        <div className="flex w-full flex-col items-center justify-between space-y-3 lg:flex-row lg:space-y-0">
          <NavLink className="text-2xl font-bold text-indigo-500 no-underline hover:no-underline lg:text-4xl" to="/">
            Qwerty Learner
          </NavLink>
          <nav className="my-card flex items-center gap-3 rounded-xl bg-white p-4 transition-colors duration-300 dark:bg-gray-800">
            <NavLink className="my-btn-primary" to="/">
              返回练习
            </NavLink>
          </nav>
        </div>
      </header>

      <div className="container mx-auto flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-10 pb-8">
        <section className="grid min-h-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="my-card flex min-h-[24rem] flex-col rounded-lg bg-white p-6 transition-colors duration-300 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-700 dark:text-white dark:text-opacity-80">导入文章</h2>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={handleFileChange}
                />
                <Tooltip content="上传 .txt 或 .md">
                  <button
                    className="my-btn-primary gap-2"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                  >
                    <Upload className="h-5 w-5" />
                    上传
                  </button>
                </Tooltip>
                <button className="my-btn-primary" type="button" onClick={handleTextImport} disabled={isImporting}>
                  导入并练习
                </button>
              </div>
            </div>
            <textarea
              className="customized-scrollbar min-h-0 flex-1 resize-none rounded-lg border-2 border-indigo-100 bg-indigo-50 p-4 font-mono text-base leading-7 text-gray-700 outline-none transition-colors duration-300 focus:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="粘贴英文文章，或上传 txt/md 文件。导入后会按句子进入跟打练习。"
            />
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          </div>

          <aside className="my-card flex flex-col rounded-lg bg-white p-6 transition-colors duration-300 dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold text-gray-700 dark:text-white dark:text-opacity-80">练习规则</h2>
            <div className="space-y-3 text-sm leading-6 text-gray-500 dark:text-gray-300">
              <p>逐句推进，完成当前句后自动进入下一句。</p>
              <p>输入校验忽略标点和空格，保留大小写敏感。</p>
              <p>文章只保存在当前浏览器本地。</p>
            </div>
          </aside>
        </section>

        <section className="min-h-0">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            <h2 className="text-xl font-bold text-gray-700 dark:text-white dark:text-opacity-80">本地文章</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(articles ?? []).map((article) => (
              <article key={article.id} className="my-card rounded-lg bg-white p-5 transition-colors duration-300 dark:bg-gray-800">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-gray-700 dark:text-white dark:text-opacity-80">{article.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">更新于 {timeStamp2String(article.updatedAt)}</p>
                  </div>
                  <button
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none dark:hover:bg-slate-700"
                    type="button"
                    aria-label="删除文章"
                    onClick={() => deleteArticle(article.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="mb-5 flex items-center justify-between text-sm text-gray-500 dark:text-gray-300">
                  <span>{article.sentences.length} 句</span>
                  <span>{getArticleProgressLabel(article.currentSentenceIndex, article.sentences.length)}</span>
                </div>
                <button className="my-btn-primary w-full gap-2" type="button" onClick={() => navigate(`/article/${article.id}`)}>
                  <Play className="h-5 w-5" />
                  继续练习
                </button>
              </article>
            ))}
          </div>
          {articles?.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-indigo-100 py-12 text-center text-gray-400 dark:border-slate-700">
              还没有导入文章
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
