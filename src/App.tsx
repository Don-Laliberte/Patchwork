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
      <header className="sticky top-0 z-20 border-b border-[rgba(31,61,43,0.12)] bg-[rgba(31,61,43,0.94)] text-[#f7f3ea] backdrop-blur-md">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(247,243,234,0.65)]">
                Ingredient tracker
              </p>
              <h1 className="font-display text-3xl leading-none mt-1">Patchwork</h1>
            </div>
            <p className="text-sm text-[rgba(247,243,234,0.75)] pb-1">
              {count} product{count === 1 ? '' : 's'}
            </p>
          </div>
          <nav className="mt-4 flex gap-1 overflow-x-auto pb-1">
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
        </div>
      </header>

      <main className="flex-1 px-4 py-5">
        <Outlet />
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-[rgba(26,36,28,0.55)]">
        Data stays on this device.{' '}
        <NavLink to="/support" className="underline underline-offset-2">
          Support
        </NavLink>
      </footer>
    </div>
  )
}
