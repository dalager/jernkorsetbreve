import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Statistic } from '@/components/ui/statistic'
import MarkdownDiffResolver from './MarkdownDiffResolver'

interface Letter {
  id: number
  date: string
  place: string
  sender: string
  recipient: string
  text: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const LetterView = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [letter, setLetter] = useState<Letter | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [letterTextFixed, setLetterTextFixed] = useState<string | null>(null)
  const [lastTiming, setLastTiming] = useState<number | null>(null)
  const [modernize_tps, setModernize_tps] = useState<number | null>(null)
  const [modernizing, setModernizing] = useState(false)
  const numericId = parseInt(id || '1', 10)

  useEffect(() => {
    const fetchLetter = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/letters/${numericId}`)
        const data = await response.json()
        setLetter(data)
        setLetterTextFixed(null)
      } catch (error) {
        console.error('Error fetching letter:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLetter()
  }, [numericId])

  const handlePrevious = () => {
    if (numericId > 1) {
      navigate(`/letters/${numericId - 1}`)
    }
  }

  const handleNext = () => {
    if (numericId < 665) {
      navigate(`/letters/${numericId + 1}`)
    }
  }

  const modernizeLetter = async () => {
    setModernizing(true)
    const start = Date.now()
    try {
      const response = await fetch(`${API_BASE_URL}/proofread/${numericId}`, {
        method: 'POST',
      })
      const data = await response.json()
      setLetterTextFixed(data.text)
      setModernize_tps(data.tps)
    } catch (error) {
      console.error('Error modernizing letter:', error)
    }
    setModernizing(false)
    setLastTiming(Date.now() - start)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('da-DK', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const Paragraphs = ({ text }: { text: string }) => (
    <>
      {text.split(/\n{2,}/).map((paragraph, idx) => (
        <p key={idx} className="mb-4 last:mb-0 leading-relaxed">
          {paragraph}
        </p>
      ))}
    </>
  )

  if (loading) {
    return (
      <div className="pt-8 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40 mb-8" />
          <div className="bg-cream rounded-lg border border-faded/20 p-8">
            <Skeleton className="h-4 w-32 mb-6" />
            <Skeleton className="h-4 w-full mb-3" />
            <Skeleton className="h-4 w-full mb-3" />
            <Skeleton className="h-4 w-3/4 mb-3" />
            <Skeleton className="h-4 w-full mb-3" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    )
  }

  if (!letter) {
    return (
      <div className="pt-8 pb-12 px-4">
        <div className="max-w-2xl mx-auto text-center py-16">
          <p className="text-faded font-body text-lg">Brevet blev ikke fundet.</p>
          <Button variant="secondary" onClick={() => navigate('/')} className="mt-4">
            Tilbage til brevlisten
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-8 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header with date and place */}
        <header className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl text-ink mb-1 capitalize">
            {formatDate(letter.date)}
          </h1>
          <p className="text-faded font-ui flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {letter.place}
          </p>
        </header>

        {/* Letter card */}
        <article className="bg-cream rounded-lg border border-faded/20 shadow-sm overflow-hidden">
          {/* Sender/recipient bar */}
          <div className="bg-parchment/50 border-b border-faded/20 px-6 py-4 flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-wider text-faded font-ui">Fra</span>
              <span className="font-body text-ink" data-testid="letter-sender">{letter.sender}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-wider text-faded font-ui">Til</span>
              <span className="font-body text-ink" data-testid="letter-recipient">{letter.recipient}</span>
            </div>
          </div>

          {/* Letter content */}
          <div className="px-6 py-8 sm:px-8">
            {letterTextFixed ? (
              <div>
                <MarkdownDiffResolver
                  originalMd={letter.text}
                  correctedMd={letterTextFixed}
                />
                <div className="mt-8 pt-6 border-t border-faded/20 grid grid-cols-2 gap-6">
                  <Statistic title="LLM Time" value={lastTiming ?? undefined} suffix="ms" />
                  <Statistic title="LLM Perf" value={modernize_tps ?? undefined} precision={2} suffix="TPS" />
                </div>
              </div>
            ) : (
              <div className="font-body text-ink text-lg" data-testid="letter-text">
                <Paragraphs text={letter.text} />
              </div>
            )}
          </div>

          {/* Actions bar */}
          <div className="bg-parchment/30 border-t border-faded/20 px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Modernize button */}
              <Button
                variant="default"
                disabled={modernizing}
                onClick={modernizeLetter}
                data-testid="modernize-button"
                className="gap-2"
              >
                {modernizing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Moderniserer...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Modernisér
                  </>
                )}
              </Button>

              {/* Navigation */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  onClick={handlePrevious}
                  disabled={numericId <= 1}
                  className="gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Forrige</span>
                </Button>
                <span className="text-faded font-ui text-sm px-2">
                  {numericId} / 665
                </span>
                <Button
                  variant="ghost"
                  onClick={handleNext}
                  disabled={numericId >= 665}
                  className="gap-1"
                >
                  <span className="hidden sm:inline">Næste</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </article>

        {/* Letter number indicator */}
        <p className="text-center text-faded font-ui text-sm mt-4">
          Brev #{numericId} af 665
        </p>
      </div>
    </div>
  )
}

export default LetterView
