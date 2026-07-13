import { Navigate, Route, Routes } from 'react-router'
import Layout from './layout'
import { HomePage } from './pages/home'
import { SettingsPage } from './pages/settings'

// L'app consuma la libreria UI separata (@magistra/ui): i componenti sono
// presentazionali e non dipendono da Electron. Dati e stato arriveranno dal
// backend via IPC nei task successivi.
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
