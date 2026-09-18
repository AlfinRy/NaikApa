import {
  HeadContent,
  Outlet,
  createRootRoute,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'NaikApa — Naik apa? Satu peta menjawab' },
      {
        name: 'description',
        content:
          'Semua rute TransJakarta & Mikrotrans Jabodetabek dalam satu peta. Cari tempat atau halte, langsung tahu naik apa.',
      },
    ],
    links: [
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Atkinson+Hyperlegible:wght@400;700&display=swap',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  )
}
