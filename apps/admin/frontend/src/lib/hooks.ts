import { useEffect, useCallback, useRef, useState } from 'react'

// ADR-055: Warn user about unsaved changes before navigation
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}

// ADR-055: Auto-clearing save feedback
export function useSaveFeedback() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startSave = useCallback(() => {
    setSaving(true)
    setSaved(false)
    setError(null)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const onSuccess = useCallback(() => {
    setSaving(false)
    setSaved(true)
    timerRef.current = setTimeout(() => setSaved(false), 3000)
  }, [])

  const onError = useCallback((msg: string) => {
    setSaving(false)
    setError(msg)
  }, [])

  const reset = useCallback(() => {
    setSaving(false)
    setSaved(false)
    setError(null)
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return { saved, saving, error, startSave, onSuccess, onError, reset }
}
