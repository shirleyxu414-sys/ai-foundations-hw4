import { Link } from 'react-router-dom'
import { formatPrice } from '../format'
import type { Product } from '../types'

export default function ProductCard({ product }: { product: Product }) {
  const sizes = product.inventory
  const soldOutEverywhere = sizes !== undefined && sizes.length > 0 && sizes.every((s) => s.quantity === 0)

  return (
    <Link to={`/products/${product.product_id}`} className="product-card">
      <div className="product-img">
        {product.on_sale && <span className="sale-badge">Sale</span>}
        {soldOutEverywhere && <span className="sold-badge">Sold out</span>}
        <img src={product.image_url} alt={product.name} loading="lazy" />
      </div>
      <div className="product-body">
        <span className="product-type">{product.category}</span>
        <h3 className="product-name">{product.name}</h3>
        <p className="product-desc">{product.description}</p>
        {sizes && sizes.length > 0 && (
          <ul className="size-pills" aria-label="Sizes">
            {sizes.map((s) => (
              <li
                key={s.size}
                className={`size-pill ${s.quantity > 0 ? 'size-pill-in' : 'size-pill-out'}`}
                aria-label={`${s.size}: ${s.quantity > 0 ? 'in stock' : 'sold out'}`}
                title={s.quantity > 0 ? `${s.size} in stock` : `${s.size} sold out`}
              >
                {s.size}
              </li>
            ))}
          </ul>
        )}
        <div className="price-row">
          <span className="product-price">{formatPrice(product.price)}</span>
          {product.on_sale && product.original_price && (
            <s className="was-price">{formatPrice(product.original_price)}</s>
          )}
        </div>
      </div>
    </Link>
  )
}
