import { hydrateStart } from '@tanstack/react-start/client'
import { getRouter } from './router'

declare module '@tanstack/react-start/client' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

hydrateStart()
