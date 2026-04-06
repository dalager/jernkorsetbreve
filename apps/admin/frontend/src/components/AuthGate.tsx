import { useState } from 'react'
import { setApiKey, hasApiKey, clearApiKey } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ADR-052: Simple login gate shown when a 401 is returned
export function ApiKeyPrompt({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) {
      setError(true)
      return
    }
    setApiKey(key.trim())
    setError(false)
    onAuthenticated()
  }

  return (
    <div className="min-h-screen bg-parchment-light flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log ind</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Input
              type="password"
              label="API-nøgle"
              placeholder="Indtast API-nøglen..."
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(false) }}
              autoFocus
            />
            {error && <p className="text-wax-red text-sm font-ui">Indtast venligst en nøgle</p>}
            <Button type="submit">Log ind</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function LogoutButton() {
  if (!hasApiKey()) return null
  return (
    <button
      onClick={() => { clearApiKey(); window.location.reload() }}
      className="text-ui-sm font-ui text-faded hover:text-ink transition-colors"
      title="Log ud"
    >
      Log ud
    </button>
  )
}
