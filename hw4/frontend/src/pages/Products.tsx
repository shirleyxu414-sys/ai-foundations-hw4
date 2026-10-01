import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { findCollection } from '../collections'
import { useChatResults } from '../chatResults'
import ProductCard from '../components/ProductCard'
import type { Product } from '../types'

const FILTERS = ['All', 'Hoodies', 'Crewnecks', 'T-shirts', 'Quarter-zips', 'Jackets', 'More']

type Sort = 'name' | 'price-low' | 'price-high'
const SORTS: { value: Sort; label: string }[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
]

function matches(p: Product, terms: string[]): boolean {
  const haystack = `${p.name} ${p.category} ${p.garment_type} ${p.description} ${p.colors.join(' ')}`.toLowerCase()
  return terms.every((t) => haystack.includes(t))
}

function arrange(list: Product[], query: string, sort: Sort): Product[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const out = terms.length ? list.filter((p) => matches(p, terms)) : [...list]
  if (sort === 'price-low') out.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
  if (sort === 'price-high') out.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
  return out
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="empty-state">
      <p>Nothing matches{query.trim() ? ` “${query.trim()}”` : ' those filters'}.</p>
      <button className="btn btn-ghost" onClick={onClear}>Clear search</button>
    </div>
  )
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const { results, clear } = useChatResults()
  const [params, setParams] = useSearchParams()
  const collection = findCollection(params.get('collection'))
  const collectionKey = collection?.key ?? null

  // Opening a collection replaces any earlier chat results on the page.
  useEffect(() => {
    if (collectionKey) clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionKey])

  useEffect(() => {
    setStatus('loading')
    fetch(collectionKey ? `/api/products?collection=${collectionKey}` : '/api/products')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<Product[]>
      })
      .then((data) => {
        setProducts(data)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [collectionKey])

  // Only offer category buttons that have items in the list being shown right now.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of products) counts[p.category] = (counts[p.category] ?? 0) + 1
    return counts
  }, [products])
  const visibleFilters = FILTERS.filter((f) => f === 'All' || categoryCounts[f])
  const activeFilter = visibleFilters.includes(filter) ? filter : 'All'

  const filtered = useMemo(
    () => arrange(activeFilter === 'All' ? products : products.filter((p) => p.category === activeFilter), query, sort),
    [products, activeFilter, query, sort],
  )
  const chatShown = useMemo(() => (results ? arrange(results.products, query, sort) : []), [results, query, sort])

  const pickFilter = (f: string) => {
    clear()
    setFilter(f)
  }
  const showEverything = () => {
    setFilter('All')
    setQuery('')
    setParams({})
  }

  return (
    <section className="section">
      <p className="eyebrow">The Catalogue</p>
      <h1>Products</h1>
      <p className="lede">
        Hoodies, crewnecks, tees, quarter-zips and fleeces in every size from XS to XXL.
      </p>

      <div className="toolbar">
        <label className="search-box">
          <span className="sr-only">Search products</span>
          <input
            type="search"
            placeholder="Search by name, color or style (e.g. navy hockey)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="sort-box">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="filter-row">
        {visibleFilters.map((f) => (
          <button
            key={f}
            className={`chip ${!results && activeFilter === f ? 'chip-active' : ''}`}
            onClick={() => pickFilter(f)}
          >
            {f}
            <span className="chip-count">{f === 'All' ? products.length : categoryCounts[f]}</span>
          </button>
        ))}
      </div>

      {results ? (
        <>
          <div className="chat-results-banner">
            <div>
              <span className="chat-results-tag">💬 From the chat</span>
              <h2>{results.title}</h2>
              <p>
                {chatShown.length === results.products.length
                  ? `${results.products.length} matches for “${results.query}”`
                  : `${chatShown.length} of ${results.products.length} matches for “${results.query}”`}
              </p>
            </div>
            <button className="btn btn-ghost" onClick={clear}>Show all products</button>
          </div>
          {chatShown.length === 0 ? <NoResults query={query} onClear={() => setQuery('')} /> : (
            <div className="product-grid">
              {chatShown.map((p) => (
                <ProductCard key={p.product_id} product={p} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {collection && (
            <div className="chat-results-banner">
              <div>
                <span className="chat-results-tag">Collection</span>
                <h2>{collection.title}</h2>
                <p>{collection.blurb}</p>
              </div>
              <button className="btn btn-ghost" onClick={showEverything}>Show all products</button>
            </div>
          )}
          {status === 'loading' && <div className="empty-state">Loading the racks…</div>}
          {status === 'error' && (
            <div className="empty-state">Couldn't reach the store right now. Please try again shortly.</div>
          )}
          {status === 'ready' && (
            <>
              <p className="result-count" aria-live="polite">
                {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                {query.trim() && ` matching “${query.trim()}”`}
              </p>
              {filtered.length === 0 ? <NoResults query={query} onClear={() => { setQuery(''); setFilter('All') }} /> : (
                <div className="product-grid">
                  {filtered.map((p) => (
                    <ProductCard key={p.product_id} product={p} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
