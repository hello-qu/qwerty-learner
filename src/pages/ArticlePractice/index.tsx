import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { normalizeArticleTarget } from '@/utils/article'
import { db } from '@/utils/db'
import { getUTCUnixTimestamp } from '@/utils/index'
import { useLiveQuery } from 'dexie-react-hooks'
import { RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'

const TARGET_CHAR_REGEXP = /^[A-Za-z0-9]$/

type ArticleStats = {
  correctCount: number
  wrongCount: number
  elapsedTime: number
}

const initialStats: ArticleStats = {
  correctCount: 0,
  wrongCount: 0,
  elapsedTime: 0,
}

export default function ArticlePracticePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const articleId = Number(id)
  const article = useLiveQuery(() => (Number.isFinite(articleId) ? db.articles.get(articleId) : undefined), [articleId], null)
  const [input, setInput] = useState('')
  const [wrongIndex, setWrongIndex] = useState<number | null>(null)
  const [stats, setStats] = useState<ArticleStats>(initialStats)
  const [isTyping, setIsTyping] = useState(false)

  const currentSentenceIndex = article?.currentSentenceIndex ?? 0
  const sentenceCount = article?.sentences.length ?? 0
  const isFinished = Boolean(article && currentSentenceIndex >= sentenceCount)
  const currentSentence = article?.sentences[currentSentenceIndex] ?? ''
  const target = useMemo(() => normalizeArticleTarget(currentSentence), [currentSentence])
  const progress = sentenceCount === 0 ? 0 : Math.min(currentSentenceIndex / sentenceCount, 1)
  const inputAccuracy =
    stats.correctCount + stats.wrongCount === 0 ? 100 : Math.round((stats.correctCount / (stats.correctCount + stats.wrongCount)) * 100)
  const cpm = stats.elapsedTime === 0 ? 0 : Math.round((stats.correctCount / stats.elapsedTime) * 60)
  const wpm = stats.elapsedTime === 0 ? 0 : Math.round((stats.correctCount / 5 / stats.elapsedTime) * 60)

  const saveSentenceProgress = useCallback(
    async (nextSentenceIndex: number) => {
      if (!article?.id) return
      await db.articles.update(article.id, {
        currentSentenceIndex: nextSentenceIndex,
        updatedAt: getUTCUnixTimestamp(),
      })
    },
    [article?.id],
  )

  const resetArticle = useCallback(async () => {
    if (!article?.id) return
    setInput('')
    setWrongIndex(null)
    setStats(initialStats)
    setIsTyping(false)
    await db.articles.update(article.id, {
      currentSentenceIndex: 0,
      updatedAt: getUTCUnixTimestamp(),
    })
  }, [article?.id])

  useEffect(() => {
    setInput('')
    setWrongIndex(null)
  }, [currentSentenceIndex])

  useEffect(() => {
    if (!isTyping || isFinished) return

    const intervalId = window.setInterval(() => {
      setStats((oldStats) => ({
        ...oldStats,
        elapsedTime: oldStats.elapsedTime + 1,
      }))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isFinished, isTyping])

  useEffect(() => {
    if (!article || isFinished || target.length === 0) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key.length !== 1) return

      event.preventDefault()
      if (!TARGET_CHAR_REGEXP.test(event.key)) return
      if (wrongIndex !== null) return

      setIsTyping(true)
      const expectedChar = target[input.length]
      if (!expectedChar) return

      if (event.key === expectedChar) {
        setStats((oldStats) => ({
          ...oldStats,
          correctCount: oldStats.correctCount + 1,
        }))

        const nextInput = input + event.key
        setInput(nextInput)

        if (nextInput.length >= target.length) {
          const nextSentenceIndex = currentSentenceIndex + 1
          saveSentenceProgress(nextSentenceIndex)
        }
      } else {
        setStats((oldStats) => ({
          ...oldStats,
          wrongCount: oldStats.wrongCount + 1,
        }))
        setWrongIndex(input.length)
        window.setTimeout(() => {
          setWrongIndex(null)
        }, 250)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [article, currentSentenceIndex, input, isFinished, saveSentenceProgress, target, wrongIndex])

  const sentenceNodes = useMemo(() => {
    let targetIndex = 0

    return currentSentence.split('').map((char, index) => {
      if (!TARGET_CHAR_REGEXP.test(char)) {
        return (
          <span key={`${index}-${char}`} className="text-gray-400 dark:text-gray-500">
            {char}
          </span>
        )
      }

      const indexInTarget = targetIndex
      targetIndex += 1

      const stateClass =
        wrongIndex === indexInTarget
          ? 'bg-red-100 text-red-500 dark:bg-red-900 dark:text-red-200'
          : indexInTarget < input.length
          ? 'text-indigo-500 dark:text-indigo-300'
          : indexInTarget === input.length
          ? 'border-b-4 border-indigo-400 text-gray-800 dark:text-gray-100'
          : 'text-gray-700 dark:text-gray-200'

      return (
        <span key={`${index}-${char}`} className={`rounded-sm px-0.5 transition-colors ${stateClass}`}>
          {char}
        </span>
      )
    })
  }, [currentSentence, input.length, wrongIndex])

  if (article === null) {
    return (
      <Layout>
        <Header>
          <NavLink className="my-btn-primary" to="/articles">
            返回文章
          </NavLink>
        </Header>
        <div className="flex flex-1 items-center justify-center text-gray-400">正在加载文章...</div>
      </Layout>
    )
  }

  if (!article) {
    return (
      <Layout>
        <Header>
          <NavLink className="my-btn-primary" to="/articles">
            返回文章
          </NavLink>
        </Header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-gray-500">
          <p>没有找到这篇文章。</p>
          <button className="my-btn-primary" type="button" onClick={() => navigate('/articles')}>
            返回文章列表
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <Header>
        <NavLink className="my-btn-primary" to="/articles">
          文章列表
        </NavLink>
      </Header>

      <div className="container mx-auto flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-10 pb-8">
        <section className="my-card w-full max-w-5xl rounded-lg bg-white p-6 transition-colors duration-300 dark:bg-gray-800">
          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-gray-700 dark:text-white dark:text-opacity-80">{article.title}</h2>
              <p className="mt-1 text-sm text-gray-400">
                第 {Math.min(currentSentenceIndex + 1, sentenceCount)} / {sentenceCount} 句
              </p>
            </div>
            <button
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-500 focus:outline-none dark:text-gray-300 dark:hover:bg-slate-700"
              type="button"
              onClick={resetArticle}
            >
              <RotateCcw className="h-5 w-5" />
              重新开始
            </button>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-indigo-50 dark:bg-slate-700">
            <div className="h-full bg-indigo-400 transition-all duration-300" style={{ width: `${progress * 100}%` }} />
          </div>

          {isFinished ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center gap-6 text-center">
              <h3 className="text-3xl font-bold text-indigo-500">全文完成</h3>
              <div className="grid w-full max-w-2xl grid-cols-2 gap-4 md:grid-cols-5">
                <InfoBox label="时间" value={`${stats.elapsedTime}s`} />
                <InfoBox label="输入数" value={`${stats.correctCount + stats.wrongCount}`} />
                <InfoBox label="CPM" value={`${cpm}`} />
                <InfoBox label="WPM" value={`${wpm}`} />
                <InfoBox label="正确率" value={`${inputAccuracy}%`} />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[20rem] flex-col justify-center">
              <p className="select-text break-words text-3xl font-light leading-[1.8] tracking-normal text-gray-700 dark:text-gray-200">
                {sentenceNodes}
              </p>
              <div className="mt-10 h-3 rounded-full bg-indigo-50 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all duration-150"
                  style={{ width: `${(input.length / target.length) * 100}%` }}
                />
              </div>
              <p className="mt-5 text-center font-mono text-lg text-gray-400">
                {input.length} / {target.length}
              </p>
            </div>
          )}
        </section>

        <div className="my-card grid w-full max-w-5xl grid-cols-2 rounded-xl bg-white p-4 opacity-60 transition-colors duration-300 dark:bg-gray-800 md:grid-cols-5">
          <InfoBox label="时间" value={`${stats.elapsedTime}s`} />
          <InfoBox label="输入数" value={`${stats.correctCount + stats.wrongCount}`} />
          <InfoBox label="CPM" value={`${cpm}`} />
          <InfoBox label="WPM" value={`${wpm}`} />
          <InfoBox label="正确率" value={`${inputAccuracy}%`} />
        </div>
      </div>
    </Layout>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <p className="text-2xl font-light text-gray-700 dark:text-white dark:text-opacity-70">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}
