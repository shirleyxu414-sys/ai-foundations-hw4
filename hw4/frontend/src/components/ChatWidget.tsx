import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Markdown from 'react-markdown'
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import BulldogFace from './BulldogFace'
import { OPEN_CHAT_EVENT } from '../chatEvents'
import { useChatResults } from '../chatResults'
import { formatPrice } from '../format'
import type { ChatMessage, ChatResponse, ProductDetail } from '../types'

const GUEST_HISTORY_TURNS = 20
const CHAT_CARD_PREVIEW = 3
const HINT_KEY = 'cc_chat_hint_seen'
const STARTERS = ['What hoodies do you have?', 'Anything with a bulldog on it?', "What's your cheapest item?", 'Show me crewnecks']
const PRODUCT_STARTERS = ['Do you have this in other colors?', 'Which sizes are in stock?', 'How much is this?']

function greeting(firstName?: string): ChatMessage {
  return {
    role: 'assistant',
    content: `Woof${firstName ? `, ${firstName}` : ''}! I'm **Bulldog Bot**, the Campus Customs mascot 🐾 Ask me about styles, sizes, prices or what's in stock.`,
    products: [],
  }
}

function MiniCard({ p }: { p: ProductDetail }) {
  const inStock = p.inventory.filter((s) => s.quantity > 0).map((s) => s.size)
  return (
    <Link to={`/products/${p.product_id}`} className="chat-card">
      <img src={p.image_url} alt="" />
      <div>
        <strong>{p.name}</strong>
        <span className="chat-card-price">{formatPrice(p.price)}</span>
        <span className="chat-card-stock">{inStock.length ? `In stock: ${inStock.join(' · ')}` : 'Sold out'}</span>
      </div>
    </Link>
  )
}

export default function ChatWidget() {
  const { user, ready } = useAuth()
  const [open, setOpen] = useState(false)
  // First-visit hint: shown until the chat has been opened once (remembered in localStorage).
  const [hintUnseen, setHintUnseen] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === null
    } catch {
      return false
    }
  })
  const retireHint = () => {
    setHintUnseen(false)
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      // storage unavailable: the bubble simply won't be remembered
    }
  }
  const [messages, setMessages] = useState<ChatMessage[]>([greeting()])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const { results, show: showOnPage } = useChatResults()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Tell the agent what the shopper is looking at, so "this hoodie" can be resolved.
  const pageContext = () => {
    const product = matchPath('/products/:productId', pathname)
    if (product) return { page: 'product', product_id: product.params.productId }
    if (pathname === '/products') {
      return { page: 'products', visible_product_ids: results ? results.products.map((p) => p.product_id) : [] }
    }
    const known: Record<string, string> = { '/': 'home', '/about': 'about', '/login': 'login', '/signup': 'signup' }
    return { page: known[pathname] ?? 'other' }
  }

  const openOnPage = (page: NonNullable<ChatMessage['page']>) => {
    showOnPage(page)
    navigate('/products') // also drops any ?collection= so the chat results are the only thing shown
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Reload the conversation whenever the signed-in shopper changes.
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const reset = (history: ChatMessage[]) => {
      if (!cancelled) setMessages([greeting(user?.first_name), ...history])
    }
    if (!user) {
      reset([])
    } else {
      fetch('/api/chat/history')
        .then((r) => (r.ok ? (r.json() as Promise<ChatMessage[]>) : []))
        .then(reset)
        .catch(() => reset([]))
    }
    return () => {
      cancelled = true
    }
  }, [user, ready])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, open])

  // Other parts of the page (the hero link) can ask the chat to open; it never opens by itself.
  useEffect(() => {
    const openIt = () => {
      setOpen(true)
      setHintUnseen(false)
      try {
        localStorage.setItem(HINT_KEY, '1')
      } catch {
        // ignore
      }
    }
    window.addEventListener(OPEN_CHAT_EVENT, openIt)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, openIt)
  }, [])



  const send = async (e?: FormEvent, preset?: string) => {
    e?.preventDefault()
    const text = (preset ?? input).trim()
    if (!text || thinking) return
    const priorTurns = messages.slice(1).map(({ role, content }) => ({ role, content }))
    setMessages((m) => [...m, { role: 'user', content: text, products: [] }])
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: user ? [] : priorTurns.slice(-GUEST_HISTORY_TURNS),
          context: pageContext(),
        }),
      })
      if (res.status === 429) {
        const body = await res.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Slow down a little, then try again.')
      }
      if (!res.ok) throw new Error()
      const data: ChatResponse = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: data.reply, products: data.products, page: data.page }])
      if (data.page) openOnPage(data.page)
    } catch (err) {
      const msg = (err as Error).message
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: msg || "Sorry, I couldn't reach the store just now. Please try again.",
          products: [],
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="chat-widget">
      {open && (
        <section className="chat-panel" aria-label="Bulldog Bot chat">
          <header className="chat-header">
            <span className="chat-avatar"><BulldogFace size={38} /></span>
            <div className="chat-title">
              <strong>Bulldog Bot</strong>
              <span className="chat-status">{user ? `Chatting with ${user.first_name}` : 'Your Yale shop mascot · guest'}</span>
            </div>
            <button className="chat-close" aria-label="Close chat" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>

          <div className="chat-messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`chat-row chat-${m.role}`}>
                <div className="chat-bubble">
                  {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : m.content}
                </div>
                {m.products.length > 0 && (
                  <div className="chat-cards">
                    {(m.page ? m.products.slice(0, CHAT_CARD_PREVIEW) : m.products).map((p) => (
                      <MiniCard key={p.product_id} p={p} />
                    ))}
                    {m.page && (
                      <button className="chat-page-link" onClick={() => openOnPage(m.page!)}>
                        {m.products.length > CHAT_CARD_PREVIEW
                          ? `+${m.products.length - CHAT_CARD_PREVIEW} more · see all ${m.products.length} on the page →`
                          : 'Show on the page →'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div className="chat-row chat-assistant">
                <div className="chat-bubble chat-thinking" aria-label="Assistant is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            {messages.length === 1 && !thinking && (
              <div className="chat-starters" aria-label="Suggested questions">
                {(matchPath('/products/:productId', pathname) ? PRODUCT_STARTERS : STARTERS).map((q) => (
                  <button key={q} type="button" className="chip" onClick={() => void send(undefined, q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="chat-input" onSubmit={send}>
            <textarea
              rows={1}
              placeholder="Ask about sizes, prices, stock…"
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button type="submit" disabled={thinking || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
      {!open && (
        <div className="chat-launcher-row">
          {hintUnseen && (
            <button
              className="chat-hint"
              onClick={() => {
                setOpen(true)
                retireHint()
              }}
            >
              Ask me anything
            </button>
          )}
          <button
            className="chat-launcher chat-launcher-pulse"
            aria-label="Chat with Bulldog Bot"
            aria-expanded={false}
            onClick={() => {
              setOpen(true)
              retireHint()
            }}
          >
            <BulldogFace size={54} />
          </button>
        </div>
      )}
    </div>
  )
}
