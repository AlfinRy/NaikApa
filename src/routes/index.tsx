import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#0f2557',
        color: '#fff',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', margin: 0 }}>🚌 NaikApa</h1>
      <p style={{ opacity: 0.85 }}>
        Peta &amp; Trip Planner TransJakarta + Mikrotrans
      </p>
    </main>
  )
}
