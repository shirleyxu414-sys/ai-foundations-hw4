import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const MAIN_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products', end: false },
  { to: '/about', label: 'About Us', end: false },
]

const ACCOUNT_LINKS = [
  { to: '/login', label: 'Log in', className: 'nav-link' },
  { to: '/signup', label: 'Create account', className: 'nav-link nav-cta' },
]

export default function NavBar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const { user, ready, logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    close()
    await logout()
    navigate('/')
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand" onClick={close}>
        <span className="brand-mark">CC</span>
        <span className="brand-text">
          <span className="brand-name">Campus Customs</span>
          <span className="brand-sub">Yale Apparel</span>
        </span>
      </Link>

      <button
        className="nav-toggle"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`nav ${open ? 'nav-open' : ''}`}>
        <ul className="nav-main">
          {MAIN_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end} className="nav-link" onClick={close}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <ul className="nav-account">
          {!ready ? null : user ? (
            <>
              <li className="nav-greeting">Hi, {user.first_name} 👋</li>
              <li>
                <button className="nav-link nav-button" onClick={onLogout}>Log out</button>
              </li>
            </>
          ) : (
            ACCOUNT_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} className={l.className} onClick={close}>
                  {l.label}
                </NavLink>
              </li>
            ))
          )}
        </ul>
      </nav>
    </header>
  )
}
