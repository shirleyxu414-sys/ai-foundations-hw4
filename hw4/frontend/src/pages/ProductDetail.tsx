import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatPrice, LOW_STOCK } from '../format'
import type { ProductDetail as Detail } from '../types'

type Status = 'loading' | 'ready' | 'missing' | 'error'

export default function ProductDetailPage() {
  const { productId = '' } = useParams()
  return <ProductDetail key={productId} productId={productId} />
}

function ProductDetail({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Detail | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/products/${encodeURIComponent(productId)}`)
      .then((r) => {
        if (r.status === 404) throw new Error('missing')
        if (!r.ok) throw new Error('error')
        return r.json() as Promise<Detail>
      })
      .then((data) => {
        setProduct(data)
        setStatus('ready')
      })
      .catch((e: Error) => setStatus(e.message === 'missing' ? 'missing' : 'error'))
  }, [productId])

  if (status === 'loading') return <section className="section"><div className="empty-state">Loading…</div></section>
  if (status !== 'ready' || !product) {
    return (
      <section className="section narrow">
        <h1>{status === 'missing' ? 'Product not found' : 'Something went wrong'}</h1>
        <p className="lede">
          {status === 'missing' ? "We couldn't find that item on the racks." : "Couldn't reach the store right now."}
        </p>
        <Link to="/products" className="btn btn-primary">Back to Products</Link>
      </section>
    )
  }

  const totalStock = product.inventory.reduce((n, s) => n + s.quantity, 0)
  const pick = product.inventory.find((s) => s.size === selected)

  return (
    <section className="section">
      <Link to="/products" className="back-link">← All products</Link>
      <div className="detail">
        <div className="detail-img">
          <img src={product.image_url} alt={product.name} />
        </div>

        <div className="detail-info">
          <span className="product-type">{product.category}</span>
          <h1 className="detail-name">{product.name}</h1>
          <p className="detail-price">
            {formatPrice(product.price)}
            {product.on_sale && <span className="sale-badge sale-badge-inline">Sale</span>}
            {product.on_sale && product.original_price && <s className="was-price">{formatPrice(product.original_price)}</s>}
          </p>
          <p className="detail-desc">{product.description}</p>

          {product.colors.length > 0 && (
            <div className="detail-block">
              <h3>Colors</h3>
              <div className="color-list">
                {product.colors.map((c) => (
                  <span key={c} className="chip">{c}</span>
                ))}
              </div>
            </div>
          )}

          <div className="detail-block">
            <h3>Sizes</h3>
            <div className="size-grid">
              {product.inventory.map((s) => {
                const out = s.quantity === 0
                return (
                  <button
                    key={s.size}
                    className={`size-btn ${selected === s.size ? 'size-selected' : ''} ${out ? 'size-out' : ''}`}
                    disabled={out}
                    onClick={() => setSelected(s.size)}
                    aria-label={`${s.size}: ${out ? 'sold out' : `${s.quantity} in stock`}`}
                  >
                    <span className="size-label">{s.size}</span>
                    <span className="size-stock">
                      {out ? 'Sold out' : s.quantity <= LOW_STOCK ? `Only ${s.quantity} left` : 'In stock'}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="stock-note">
              {totalStock === 0
                ? 'Sold out in every size right now.'
                : pick
                  ? `${pick.size}: ${pick.quantity} in stock.`
                  : 'Pick a size to see how many are left.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
