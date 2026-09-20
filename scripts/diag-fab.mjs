import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
})
try {
  const page = await browser.newPage()
  page.setViewport({ width: 390, height: 844 })
  await page.goto('http://localhost:3001/peta', { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => !!document.querySelector('.peta-card'), { timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))
  const info = await page.evaluate(() => {
    const fab = document.querySelector('.plan-fab')
    if (!fab) return { fab: false }
    const r = fab.getBoundingClientRect()
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return {
      fab: true,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      hit: el ? `${el.tagName}.${el.className?.toString().slice(0, 40)}` : 'null',
    }
  })
  console.log('FAB:', JSON.stringify(info))
  await page.click('.plan-fab').catch(e => console.log('click err:', e.message))
  await new Promise(r => setTimeout(r, 1000))
  const panel = await page.evaluate(() => !!document.querySelector('.plan-panel'))
  console.log('panel setelah klik:', panel)
} finally { await browser.close() }
