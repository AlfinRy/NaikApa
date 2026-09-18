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
      { title: 'NaikApa — Peta & Trip Planner TransJakarta' },
      {
        name: 'description',
        content:
          'Cari rute TransJakarta & Mikrotrans dan rencanakan perjalananmu di Jabodetabek.',
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
