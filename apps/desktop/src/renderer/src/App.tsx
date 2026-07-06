import { AppShell } from '@magistra/ui'

// L'app consuma la libreria UI separata (@magistra/ui): i componenti sono
// presentazionali e non dipendono da Electron. Dati e stato arriveranno dal
// backend via IPC nei task successivi.
export function App() {
  return (
    <AppShell
      title="Magistra"
      subtitle="Scaffolding pronto: finestra vuota, tre contesti Electron e workspace TypeScript."
    />
  )
}
