import type { ReactNode } from 'react'

export interface AppShellProps {
  /** Titolo mostrato al centro della finestra. */
  title: string
  /** Sottotitolo descrittivo opzionale. */
  subtitle?: string
  /** Contenuto opzionale reso sotto il sottotitolo. */
  children?: ReactNode
}

/**
 * Guscio presentazionale dell'applicazione: un layout centrato, agnostico
 * rispetto al build tool e al runtime desktop. Non dipende da Electron né
 * dall'IPC; riceve tutto ciò che mostra tramite le props, così resta
 * riutilizzabile oltre l'app desktop.
 */
export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '0.5rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center'
      }}
    >
      <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>{title}</h1>
      {subtitle ? <p style={{ margin: 0, opacity: 0.7, maxWidth: '32rem' }}>{subtitle}</p> : null}
      {children}
    </main>
  )
}
