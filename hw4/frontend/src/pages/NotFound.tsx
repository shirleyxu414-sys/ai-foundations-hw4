import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="section narrow">
      <p className="eyebrow">Page not found</p>
      <h1>Off the map</h1>
      <p className="lede">This page skipped class. Let's get you back to campus.</p>
      <Link to="/" className="btn btn-primary">Back to Home</Link>
    </section>
  )
}
