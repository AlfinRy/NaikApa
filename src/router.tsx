import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

declare global {
  var __TSS_ROUTER__: ReturnType<typeof createTanStackRouter> | undefined
}

export function getRouter() {
  if (!globalThis.__TSS_ROUTER__) {
    globalThis.__TSS_ROUTER__ = createTanStackRouter({
      routeTree,
      defaultPreload: 'intent',
    })
  }
  return globalThis.__TSS_ROUTER__
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
