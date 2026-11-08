import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink, Outlet } from 'react-router-dom'
import { db } from './db/schema'

const links = [
  { to: '/', label: 'Products', end: true },
  { to: '/add', label: 'Add' },
  { to: '/elimination', label: 'Elimination' },
  { to: '/export', label: 'Export' },
  { to: '/support', label: 'Support' },
]

export default function App() {
  const count = useLiveQuery(() => db.products.count(), []) ?? 0

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <h1 className="font-display text-3xl leading-none">Patchwork</h1>
            <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(247,243,234,0.65)]">
              Ingredient tracker
            </p>
          </div>
          <div className="header-nav-row">
            <nav className="header-nav" aria-label="Primary">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <p
              className="product-count"
              aria-label={`${count} Product${count === 1 ? '' : 's'}`}
            >
              <ProductCountIcon />
              <span>
                {count} Product{count === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="app-body">
        <main className="px-4 py-5">
          <Outlet />
        </main>

        <footer className="px-4 pb-6 text-center text-xs text-[rgba(26,36,28,0.55)]">
          Data stays on this device.{' '}
          <NavLink to="/support" className="underline underline-offset-2">
            Support
          </NavLink>
        </footer>
      </div>
    </div>
  )
}

function ProductCountIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="product-count-icon"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 14a8 8 0 0 1 8-8h20a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8zm23.9 2.1H18.1a2 2 0 0 0-2 2v11.8a2 2 0 0 0 2 2h11.8a2 2 0 0 0 2-2V18.1a2 2 0 0 0-2-2m-11.8-2a4 4 0 0 0-4 4v11.8a4 4 0 0 0 4 4h11.8a4 4 0 0 0 4-4V18.1a4 4 0 0 0-4-4zm2.3 5.4a.9.9 0 1 0 0-1.8a.9.9 0 0 0 0 1.8m2.7 1.8a.9.9 0 1 1-1.8 0a.9.9 0 0 1 1.8 0m-4.5.9a.9.9 0 1 0 0-1.8a.9.9 0 0 0 0 1.8m2.7 1.8a.9.9 0 1 1-1.8 0a.9.9 0 0 1 1.8 0m.9 3.6a.9.9 0 1 0 0-1.8a.9.9 0 0 0 0 1.8m-2.7-.9a.9.9 0 1 1-1.8 0a.9.9 0 0 1 1.8 0m.9 3.6a.9.9 0 1 0 0-1.8a.9.9 0 0 0 0 1.8m4.5-11.7a.9.9 0 1 1-1.8 0a.9.9 0 0 1 1.8 0m.9 3.6a.9.9 0 1 0 0-1.8a.9.9 0 0 0 0 1.8m-.9 1.8a.9.9 0 1 1-1.8 0a.9.9 0 0 1 1.8 0m.9 3.6a.9.9 0 1 0 0-1.8a.9.9 0 0 0 0 1.8m-.9 1.8a.9.9 0 1 1-1.8 0a.9.9 0 0 1 1.8 0m2.7-9.9a.9.9 0 1 0 0-1.8a.9.9 0 0 0 0 1.8m2.7 1.8a.9.9 0 1 1-1.8 0a.9.9 0 0 1 1.8 0m-2.7 3.6a.9.9 0 1 0 0-1.8a.9.9 0 0 0 0 1.8m2.7 1.8a.9.9 0 1 1-1.8 0a.9.9 0 0 1 1.8 0m-2.7 3.6a.9.9 0 1 0 0-1.8a.9.9 0 0 0 0 1.8"
      />
    </svg>
  )
}
