/* Serve build produksi NaikApa (dist/client + dist/server).
   Pakai: npm run build && npm start
   Note: penyajian statis sederhana — untuk produksi publik,
   pertimbangkan reverse proxy (Caddy/nginx) dgn gzip + cache header. */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, extname } from 'node:path'
import { createGzip } from 'node:zlib'

const PORT = Number(process.env.PORT || 3000)
const CLIENT = new URL('../dist/client/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const entry = await import(new URL('../dist/server/server.js', import.meta.url).href)
const fetchHandler = entry.default?.fetch ?? entry.createServerEntry?.().fetch
if (typeof fetchHandler !== 'function') throw new Error('Entry server tidak ditemukan di dist/server/server.js')

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

/* rute SPA di serve handler SSR; sisanya statis */
const SSR_PATHS = new Set(['/', '/peta'])

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
    const path = decodeURIComponent(url.pathname)

    if (!SSR_PATHS.has(path)) {
      const file = join(CLIENT, path.replace(/^\//, ''))
      try {
        const st = await stat(file)
        if (st.isFile()) {
          const type = MIME[extname(file)] ?? 'application/octet-stream'
          const headers = { 'content-type': type, 'cache-control': 'public, max-age=86400' }
          // gzip utk json besar (network/planner)
          if (['.json', '.js', '.css'].includes(extname(file)) && req.headers['accept-encoding']?.includes('gzip')) {
            headers['content-encoding'] = 'gzip'
            res.writeHead(200, headers)
            return createReadStream(file).pipe(createGzip({ level: 6 })).pipe(res)
          }
          res.writeHead(200, headers)
          return createReadStream(file).pipe(res)
        }
      } catch {
        /* jatuh ke SSR */
      }
    }

    const headers = { ...req.headers, 'accept-encoding': 'identity' }
    const r = await fetchHandler(new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : await streamBody(req),
    }))
    const outHeaders = Object.fromEntries(r.headers)
    delete outHeaders['content-encoding']
    res.writeHead(r.status, outHeaders)
    const buf = Buffer.from(await r.arrayBuffer())
    res.end(buf)
  } catch (e) {
    console.error(e)
    res.writeHead(500, { 'content-type': 'text/plain' })
    res.end('Internal Server Error')
  }
}).listen(PORT, () => {
  console.log(`NaikApa produksi jalan di http://localhost:${PORT}`)
})

function streamBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
