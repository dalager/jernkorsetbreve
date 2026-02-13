import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

interface Letter {
  id: number
  date: string
  place: string
  sender: string
  recipient: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const LetterList: React.FC = () => {
  const [letters, setLetters] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const navigate = useNavigate()

  useEffect(() => {
    const fetchLetters = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/letters`)
        const data = await response.json()
        setLetters(data)
      } catch (error) {
        console.error('Error fetching letters:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLetters()
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('da-DK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const totalPages = Math.ceil(letters.length / pageSize)
  const paginatedLetters = letters.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="font-display text-4xl text-ink mb-8">Letters</h1>
        <div className="space-y-3" data-testid="loading">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-12 bg-faded/20 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="font-display text-4xl text-ink mb-2">Letters</h1>
      <p className="text-faded font-ui mb-6">
        {letters.length} breve fra 1911-1918
      </p>

      <div className="relative overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-faded uppercase bg-parchment font-ui">
            <tr>
              <th scope="col" className="px-4 py-3">Date</th>
              <th scope="col" className="px-4 py-3">Place</th>
              <th scope="col" className="px-4 py-3">Sender</th>
              <th scope="col" className="px-4 py-3">Recipient</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLetters.map((letter) => (
              <tr
                key={letter.id}
                data-testid="letter-row"
                className="bg-cream border-b border-faded/20 hover:bg-parchment transition-colors"
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/letters/${letter.id}`)}
                    className="text-wax-red hover:underline font-body"
                  >
                    {formatDate(letter.date)}
                  </button>
                </td>
                <td className="px-4 py-3 font-body">{letter.place}</td>
                <td className="px-4 py-3 font-body">{letter.sender}</td>
                <td className="px-4 py-3 font-body">{letter.recipient}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center justify-between mt-6"
        data-testid="pagination"
      >
        <span className="text-faded font-ui text-sm">
          Side {currentPage} af {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={cn(
              "px-4 py-2 text-sm font-ui rounded border transition-colors",
              currentPage === 1
                ? "bg-parchment text-faded/50 border-faded/30 cursor-not-allowed"
                : "bg-cream text-ink border-faded/30 hover:bg-parchment"
            )}
          >
            Forrige
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={cn(
              "px-4 py-2 text-sm font-ui rounded border transition-colors",
              currentPage === totalPages
                ? "bg-parchment text-faded/50 border-faded/30 cursor-not-allowed"
                : "bg-cream text-ink border-faded/30 hover:bg-parchment"
            )}
          >
            Næste
          </button>
        </div>
      </div>
    </div>
  )
}

export default LetterList
