import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PageResults } from './types'

interface ChatResultsState {
  results: PageResults | null
  show: (r: PageResults) => void
  clear: () => void
}

const ChatResultsContext = createContext<ChatResultsState | null>(null)

export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<PageResults | null>(null)
  return (
    <ChatResultsContext.Provider value={{ results, show: setResults, clear: () => setResults(null) }}>
      {children}
    </ChatResultsContext.Provider>
  )
}

export function useChatResults(): ChatResultsState {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside ChatResultsProvider')
  return ctx
}
