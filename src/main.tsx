import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import { migrateIngredientDisplayCasing } from './db/migrateDisplayCasing'
import './index.css'
import EliminationPage from './pages/Elimination'
import ExportPage from './pages/Export'
import IngestPage from './pages/Ingest'
import ProductsPage from './pages/Products'
import SupportPage from './pages/Support'

void migrateIngredientDisplayCasing().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<ProductsPage />} />
            <Route path="add" element={<IngestPage />} />
            <Route path="elimination" element={<EliminationPage />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  )
})
