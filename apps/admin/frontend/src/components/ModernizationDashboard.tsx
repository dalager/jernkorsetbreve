import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Statistic } from '@/components/ui/statistic'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

interface LetterStatus {
  id: number
  has_modern: boolean
  timestamp?: string
}

interface ModernizationStatus {
  total_letters: number
  modernized_count: number
  remaining: number
  letters: LetterStatus[]
}

interface BatchProgress {
  batch_id: string
  status: 'running' | 'completed' | 'cancelled' | 'failed'
  total: number
  completed: number
  failed: number
  errors: string[]
}

const ModernizationDashboard = () => {
  const [status, setStatus] = useState<ModernizationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [startingBatch, setStartingBatch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/modernized`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: ModernizationStatus = await response.json()
      setStatus(data)
    } catch (err) {
      console.error('Error fetching modernization status:', err)
      setError('Kunne ikke hente moderniseringsstatus.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollBatchProgress = useCallback((id: string) => {
    stopPolling()
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/modernize-batch/${id}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data: BatchProgress = await response.json()
        setBatchProgress(data)

        if (data.status !== 'running') {
          stopPolling()
          setBatchId(null)
          fetchStatus()
        }
      } catch (err) {
        console.error('Error polling batch progress:', err)
      }
    }
    poll()
    pollRef.current = setInterval(poll, 2000)
  }, [stopPolling, fetchStatus])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const handleStartBatch = async () => {
    setStartingBatch(true)
    setError(null)
    setBatchProgress(null)
    try {
      const response = await fetch(`${API_BASE_URL}/modernize-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setBatchId(data.batch_id)
      pollBatchProgress(data.batch_id)
    } catch (err) {
      console.error('Error starting batch:', err)
      setError('Kunne ikke starte batch-modernisering.')
    } finally {
      setStartingBatch(false)
    }
  }

  const handleCancelBatch = async () => {
    if (!batchId) return
    try {
      await fetch(`${API_BASE_URL}/modernize-batch/${batchId}/cancel`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('Error cancelling batch:', err)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="font-display text-4xl text-ink mb-8">Modernisering</h1>
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-10 w-48 mb-8" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const totalLetters = status?.total_letters ?? 0
  const modernizedCount = status?.modernized_count ?? 0
  const remaining = status?.remaining ?? 0
  const pct = totalLetters > 0 ? Math.round((modernizedCount / totalLetters) * 100) : 0

  const isRunning = batchId !== null
  const batchCompleted = batchProgress?.completed ?? 0
  const batchTotal = batchProgress?.total ?? 0
  const batchFailed = batchProgress?.failed ?? 0
  const batchErrors = batchProgress?.errors ?? []
  const batchPct = batchTotal > 0 ? Math.round((batchCompleted / batchTotal) * 100) : 0

  const displayLetters = (status?.letters ?? []).slice(0, 50)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="font-display text-4xl text-ink mb-2">Modernisering</h1>
      <p className="text-faded font-ui mb-8">
        Batch-modernisering af brevtekster via LLM
      </p>

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <Statistic title="Breve i alt" value={totalLetters} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Statistic title="Moderniseret" value={modernizedCount} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Statistic title="Mangler" value={remaining} />
          </CardContent>
        </Card>
      </div>

      {/* Overall progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm font-ui text-faded mb-1">
          <span>Fremgang</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-3 bg-parchment rounded-full overflow-hidden border border-faded/20">
          <div
            className="h-full bg-wax-red rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm font-ui">
          {error}
        </div>
      )}

      {/* Batch controls */}
      <div className="mb-8 flex items-center gap-4">
        {!isRunning ? (
          <Button
            variant="default"
            onClick={handleStartBatch}
            disabled={startingBatch || remaining === 0}
            className="gap-2"
          >
            {startingBatch ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Starter...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start modernisering
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={handleCancelBatch}
            className="gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Stop
          </Button>
        )}
        {remaining === 0 && !isRunning && (
          <span className="text-sm font-ui text-faded">
            Alle breve er moderniseret.
          </span>
        )}
      </div>

      {/* Batch progress */}
      {batchProgress && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Batch-fremgang</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 mb-4">
              <Statistic title="Fuldført" value={batchCompleted} suffix={`/ ${batchTotal}`} />
              <Statistic title="Fejlet" value={batchFailed} />
              <Statistic
                title="Status"
                value={
                  batchProgress.status === 'running'
                    ? 'Kører'
                    : batchProgress.status === 'completed'
                    ? 'Fuldført'
                    : batchProgress.status === 'cancelled'
                    ? 'Annulleret'
                    : 'Fejlet'
                }
              />
            </div>
            <div className="w-full h-2 bg-parchment rounded-full overflow-hidden border border-faded/20">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  batchProgress.status === 'running' ? 'bg-wax-red' : 'bg-faded'
                )}
                style={{ width: `${batchPct}%` }}
              />
            </div>
            {batchErrors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-ui text-faded mb-2">Fejl:</p>
                <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  {batchErrors.map((err, i) => (
                    <li key={i} className="font-body">{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Letter status table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Brevstatus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-faded uppercase bg-parchment font-ui sticky top-0">
                <tr>
                  <th scope="col" className="px-4 py-3">ID</th>
                  <th scope="col" className="px-4 py-3">Moderniseret</th>
                  <th scope="col" className="px-4 py-3">Tidspunkt</th>
                </tr>
              </thead>
              <tbody>
                {displayLetters.map((letter) => (
                  <tr
                    key={letter.id}
                    className="border-b border-faded/20 hover:bg-parchment/50 transition-colors"
                  >
                    <td className="px-4 py-2 font-body">#{letter.id}</td>
                    <td className="px-4 py-2">
                      {letter.has_modern ? (
                        <span className="text-green-600" title="Moderniseret">&#10003;</span>
                      ) : (
                        <span className="text-faded" title="Ikke moderniseret">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-ui text-faded text-xs">
                      {letter.timestamp ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(status?.letters.length ?? 0) > 50 && (
            <p className="text-xs text-faded font-ui mt-3 text-center">
              Viser de første 50 af {status?.letters.length} breve
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ModernizationDashboard
