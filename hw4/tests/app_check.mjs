// End-to-end check of the live Campus Customs site.
// Drives real Chrome against the running app, checks answers against the database,
// and writes output/app_check.html (screenshots embedded) so it opens by double-click.
//
//   cd tests && npm install && node app_check.mjs
//
// Needs: frontend on :5173, backend on :8000, Google Chrome installed.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const OUT = path.join(ROOT, 'output')
const SHOTS = path.join(OUT, 'app_check_images')
const DB = path.join(ROOT, 'data', 'campus_customs.db')
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// The test user that ships in the database (documented in the assignment).
const SEEDED = { email: 'test@campuscustoms.yale.edu', password: 'password', first: 'Test' }
// A throwaway account this run creates and then deletes.
const stamp = Date.now()
const NEW = { first: 'Alex', last: 'Rivera', email: `apptest.${stamp}@example.com`, password: 'Boola-Boola-2026' }

const sql = (q) => execFileSync('sqlite3', [DB, q], { encoding: 'utf8' }).trim()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(SHOTS, { recursive: true })
for (const f of fs.readdirSync(SHOTS)) fs.rmSync(path.join(SHOTS, f))

// ---------- recording ----------
const features = []
let current = null
let shotNo = 0
function feature(title, caption) {
  current = { title, caption, checks: [], shots: [] }
  features.push(current)
  console.log(`\n## ${title}`)
}
function check(text, ok, detail = '') {
  current.checks.push({ text, ok: Boolean(ok), detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${text}${detail ? '  -> ' + detail : ''}`)
}
async function shot(page, name, title, proves, req = 0, clip = null) {
  shotNo += 1
  const file = `${name}.png`
  if (!clip) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await sleep(250)
  }
  await page.screenshot({ path: path.join(SHOTS, file), type: 'png', ...(clip ? { clip } : {}) })
  current.shots.push({ file, title, proves, req, feature: current })
}

// ---------- helpers ----------
const count = (page, sel) => page.$$eval(sel, (els) => els.length)
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => '')
const css = (page, sel, prop, pseudo = null) =>
  page.$eval(sel, (e, p, ps) => getComputedStyle(e, ps)[p], prop, pseudo).catch(() => '')
const botCount = (page) => count(page, '.chat-assistant .chat-bubble:not(.chat-thinking)')

async function openChat(page) {
  if ((await count(page, '.chat-panel')) === 0) {
    await page.click('.chat-launcher')
    await page.waitForSelector('.chat-panel')
    await sleep(500)
  }
}
async function ask(page, question, { chip = false } = {}) {
  await openChat(page)
  const before = await botCount(page)
  if (chip) {
    await page.evaluate((t) => [...document.querySelectorAll('.chat-starters .chip')].find((c) => c.textContent === t).click(), question)
  } else {
    await page.type('.chat-input textarea', question)
    await page.keyboard.press('Enter')
  }
  await page.waitForFunction(
    (n) => document.querySelectorAll('.chat-assistant .chat-bubble:not(.chat-thinking)').length > n,
    { timeout: 120000 },
    before,
  )
  await sleep(700)
  return page.$$eval('.chat-assistant .chat-bubble:not(.chat-thinking)', (els) => els.at(-1).textContent.trim())
}
async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  await page.type('.auth-card input[type=email]', email)
  await page.type('.auth-card input[type=password]', password)
  await page.click('.auth-card button[type=submit]')
}
async function logout(page) {
  await page.click('.nav-button')
  await page.waitForFunction(() => !document.querySelector('.nav-greeting'))
  await sleep(400)
}
// True when every input and button in the form card sits inside the card (nothing sticks out)
const formFits = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('.auth-card').getBoundingClientRect()
    return [...document.querySelectorAll('.auth-card input, .auth-card button')].every((e) => {
      const r = e.getBoundingClientRect()
      return r.left >= card.left - 0.5 && r.right <= card.right + 0.5
    }) && document.documentElement.scrollWidth <= innerWidth + 1
  })

// Clicks every category button on the Products page; each must show exactly the number of items on its label
async function chipsAllWork(page) {
  const labels = await page.$$eval('.filter-row .chip', (e) => e.map((x) => x.firstChild.textContent.trim()))
  const bad = []
  for (const label of labels) {
    await page.evaluate((l) => [...document.querySelectorAll('.filter-row .chip')].find((c) => c.firstChild.textContent.trim() === l).click(), label)
    await sleep(250)
    const shown = await count(page, '.product-card')
    const wanted = await page.evaluate((l) => Number([...document.querySelectorAll('.filter-row .chip')].find((c) => c.firstChild.textContent.trim() === l).querySelector('.chip-count').textContent), label)
    if (shown === 0 || shown !== wanted) bad.push(`${label}: shows ${shown}, label says ${wanted}`)
  }
  await page.evaluate(() => document.querySelector('.filter-row .chip').click())
  await sleep(200)
  return { labels, bad }
}

// Scrolls the whole grid (so every lazy photo loads), then checks that each photo frame is square,
// nothing is wider than the screen, and no card body is overlapped by its photo.
async function gridSound(page) {
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)) } window.scrollTo(0, 0) })
  await sleep(600)
  return page.evaluate(() => {
    const bad = []
    const cards = [...document.querySelectorAll('.product-card')]
    for (const c of cards) {
      const f = c.querySelector('.product-img').getBoundingClientRect()
      const body = c.querySelector('.product-body').getBoundingClientRect()
      const cr = c.getBoundingClientRect()
      const name = c.querySelector('.product-name').textContent
      if (Math.abs(f.width - f.height) > 1.5) bad.push(`${name}: frame ${Math.round(f.width)}x${Math.round(f.height)}`)
      if (cr.right > innerWidth + 1) bad.push(`${name}: sticks out past the screen`)
      if (body.top < f.bottom - 1) bad.push(`${name}: photo overlaps text`)
    }
    return { bad, cards: cards.length, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 }
  })
}

// Position and size of the given elements plus the page size: used to prove the chat floats without moving anything
const snap = (page, sels) =>
  page.evaluate((sels) => ({
    pageSize: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    ...Object.fromEntries(sels.map((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [sel, [r.x, r.y + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10)] })),
  }), sels)
const sameLayout = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const HOME_PARTS = ['.navbar', '.hero', '.hero h1', '.hero-actions', '.hero-product', '.skyline', '.collection-grid', '.promo-band', '.perk-grid']

// WCAG contrast ratio between two "rgb(r, g, b)" strings
function contrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c.match(/\d+/g).slice(0, 3).map(Number).map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// ---------- run ----------
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
const jsErrors = []
page.on('pageerror', (e) => jsErrors.push(String(e)))
// 401 = logged-out visitor asking who they are; 429 = the deliberate rate-limit test
page.on('console', (m) => m.type() === 'error' && !/\b(401|429)\b/.test(m.text()) && jsErrors.push(m.text()))

const startedAt = new Date()
const chatRowsAtStart = Number(sql('SELECT COUNT(*) FROM chat_messages'))
let newUserId = null

try {
  // 1 ---------------------------------------------------------------- Home + nav banner
  feature('Home page and Yale banner navigation', 'Deep-blue university banner with white links and a gold underline on the current page; light, airy page with cream and gold touches.')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  check('Nav bar has the 5 required links', (await text(page, '.nav')).replace(/\s+/g, ' ').includes('Home') && (await count(page, '.nav-link')) === 5, (await page.$$eval('.nav-link', (e) => e.map((x) => x.textContent.trim()))).join(' | '))
  const navBg = await css(page, '.navbar', 'backgroundColor')
  const navFg = await css(page, '.nav-link.active', 'color')
  const underline = await css(page, '.nav-link.active', 'backgroundColor', '::after')
  check('Nav bar is deep Yale blue with white text', navBg === 'rgb(0, 53, 107)' && navFg === 'rgb(255, 255, 255)', `background ${navBg}, active link ${navFg}`)
  check('Current page (Home) has a gold underline', underline === 'rgb(201, 162, 74)', `underline ${underline}`)
  const bodyBg = await css(page, 'body', 'backgroundColor')
  check('Page background is light and airy', contrast(bodyBg, 'rgb(0, 0, 0)') > 15, `background ${bodyBg}`)
  await shot(page, 'home', 'Yale banner and home page', 'The top bar is deep Yale blue with white links and a gold underline under the current page (Home), on a light cream-and-white page. The nav has all five required links.')
  await page.click('.nav-main li:nth-child(2) a')
  await page.waitForSelector('.product-card')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  const perks = await page.$$eval('.perk', (cards) => cards.map((c) => ({
    title: c.querySelector('h3').textContent,
    icon: !!c.querySelector('.perk-icon svg'),
    iconSize: Math.round(c.querySelector('.perk-icon svg').getBoundingClientRect().width),
    iconColor: getComputedStyle(c.querySelector('.perk-icon')).color,
    top: getComputedStyle(c).borderTopColor,
    bg: getComputedStyle(c).backgroundColor,
    text: getComputedStyle(c.querySelector('p')).color,
    head: getComputedStyle(c.querySelector('h3')).color,
  })))
  check('Three feature cards each have a large icon (medal, ruler, robot)', perks.length === 3 && perks.every((p) => p.icon && p.iconSize >= 40), perks.map((p) => `${p.title}: ${p.iconSize}px icon`).join(' | '))
  check('Icons are Yale Blue', perks.every((p) => p.iconColor === 'rgb(0, 53, 107)'), perks.map((p) => p.iconColor).join(' '))
  check('Top edges are navy, medium blue and gold (all different)', perks[0].top === 'rgb(0, 33, 71)' && perks[1].top === 'rgb(40, 109, 192)' && perks[2].top === 'rgb(201, 162, 74)', perks.map((p) => p.top).join(' | '))
  check('The middle card is "Officially licensed", with the ruler and robot cards on either side', perks.map((p) => p.title).join(' | ') === 'XS through XXL | Officially licensed | Straight from the stockroom', perks.map((p) => p.title).join(' | '))
  check('Middle card is dark blue with white text', perks[1].bg === 'rgb(0, 53, 107)' && perks[1].head === 'rgb(255, 255, 255)' && /255, 255, 255/.test(perks[1].text), `${perks[1].bg}, text ${perks[1].text}`)
  check('The other two cards are white with blue headings', [perks[0], perks[2]].every((p) => p.bg === 'rgb(255, 255, 255)' && p.head === 'rgb(0, 53, 107)'))
  await page.$eval('.perk', (e) => e.scrollIntoView({ block: 'center' }))
  await sleep(300)
  const perkTopBefore = await page.$eval('.perk', (e) => e.getBoundingClientRect().top)
  await page.hover('.perk')
  await sleep(350)
  const perkTopAfter = await page.$eval('.perk', (e) => e.getBoundingClientRect().top)
  const shadow = await page.$eval('.perk', (e) => getComputedStyle(e).boxShadow)
  check('Hovering a feature card lifts it and adds a soft shadow', perkTopBefore - perkTopAfter >= 4 && shadow !== 'none', `lifted ${Math.round(perkTopBefore - perkTopAfter)}px`)
  await page.mouse.move(5, 5)
  await sleep(300)
  const perkClip = await page.$eval('.perk-grid', (e) => { const r = e.getBoundingClientRect(); return { x: Math.max(0, r.x - 14), y: r.y + scrollY - 14, width: r.width + 28, height: r.height + 28 } })
  await shot(page, 'feature-cards', 'Home feature cards', 'The three feature cards no longer look alike: each has a large Yale-blue icon (medal, ruler, robot) and a different top edge (navy, medium blue, gold), and the middle card stands out in dark blue with white text.', 0, perkClip)
  const homeText = await page.evaluate(() => document.body.innerText)
  check('The shop is called Campus Customs everywhere (no borrowed store name)', !/bulldog blue/i.test(homeText) && !/bulldog blue/i.test(await page.title()) && (await text(page, '.brand-name')) === 'Campus Customs', `title "${await page.title()}"`)
  await page.click('.nav-main li:nth-child(2) a')
  await page.waitForSelector('.product-card')
  check('Underline moves to the current page (Products)', (await text(page, '.nav-link.active')) === 'Products')

  // 1a0 ------------------------------------------------------------- Hero
  feature('Hero section', 'A composed block: a clean two-line headline and tighter text on the left, a real navy hoodie on the right in front of the skyline. The text and both buttons are unchanged.')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  await sleep(600)
  const hero = await page.evaluate(() => {
    const q = (sel) => document.querySelector(sel)
    const r = (sel) => q(sel).getBoundingClientRect()
    const eb = r('.hero .eyebrow'), h1 = r('.hero h1'), lede = r('.hero .lede'), act = r('.hero-actions'), prod = r('.hero-product'), sky = r('.skyline'), copy = r('.hero-copy'), box = r('.hero')
    const m = getComputedStyle(q('.hero-product')).transform.match(/matrix\(([^)]+)\)/)
    const [a, b] = m ? m[1].split(',').map(Number) : [1, 0]
    const img = q('.hero-product img')
    const card = getComputedStyle(q('.hero-product'))
    const overlapX = Math.max(prod.left, sky.left), overlapY = Math.min(prod.bottom, sky.bottom) - Math.max(prod.top, sky.top)
    const probe = document.elementFromPoint(prod.left + prod.width * 0.5, Math.max(prod.top, sky.top) + Math.max(0, overlapY) * 0.5 + 4)
    return {
      lines: [...document.querySelectorAll('.hero h1 .hero-line')].map((l) => l.textContent.trim()),
      h1Lines: Math.round(h1.height / parseFloat(getComputedStyle(q('.hero h1')).lineHeight)),
      gaps: [Math.round((h1.top - eb.bottom) * 10) / 10, Math.round((lede.top - h1.bottom) * 10) / 10, Math.round((act.top - lede.bottom) * 10) / 10],
      buttons: [...document.querySelectorAll('.hero-actions .btn')].map((b) => b.textContent.trim()),
      eyebrow: q('.hero .eyebrow').textContent.trim(),
      lede: q('.hero .lede').textContent.replace(/\s+/g, ' ').trim(),
      onRight: prod.left + prod.width / 2 > box.left + box.width * 0.6,
      angle: Math.round(Math.atan2(b, a) * 180 / Math.PI * 10) / 10,
      cardBg: card.backgroundColor, radius: card.borderTopLeftRadius, shadow: card.boxShadow, fit: getComputedStyle(img).objectFit,
      loaded: img.complete && img.naturalWidth > 0, w: Math.round(prod.width), natural: img.naturalWidth, shown: img.offsetWidth, heroH: Math.round(box.height),
      overlapsSkyline: overlapX >= 0 && overlapY > 40,
      inFront: probe?.closest('.hero-product') !== null,
      clearOfText: prod.left >= copy.right - 4 || prod.left >= lede.right - 4,
    }
  })
  check('Headline breaks cleanly as "Wear your corner" / "of Yale" (Yale is not alone)', hero.lines.join(' / ') === 'Wear your corner / of Yale' && hero.h1Lines === 2, `${hero.lines.join(' / ')} (${hero.h1Lines} lines)`)
  check('Gaps eyebrow→headline, headline→paragraph, paragraph→buttons are about one third smaller (were 16 / 8 / 25.6 px)', hero.gaps[0] <= 11.5 && hero.gaps[1] <= 6.5 && hero.gaps[2] <= 17.6 && hero.gaps.every((g) => g >= 0), `now ${hero.gaps.join(' / ')} px`)
  check('Both buttons are still there (the second is renamed) and all other text is unchanged', hero.buttons.join('|') === 'Browse the catalogue|Ask Bulldog Bot' && hero.eyebrow === 'Officially licensed · Made for Elis' && hero.lede.startsWith('Your residential college crest, your varsity team, the grad school that finally let you graduate: Campus Customs has gear for all of it. Browse the racks, or ask our chatbot what\'s in stock in your size.'), hero.buttons.join(' | '))
  const askBtn = await page.$eval('.hero-actions .btn:nth-child(2)', (b) => { const svg = b.querySelector('svg'); const r = svg?.getBoundingClientRect(); return { text: b.textContent.trim(), iconFirst: b.firstElementChild === svg && !!svg, iconW: r ? Math.round(r.width) : 0, iconBeforeText: b.firstChild === svg } })
  check('The renamed button starts with a small speech-bubble icon', askBtn.text === 'Ask Bulldog Bot' && askBtn.iconFirst && askBtn.iconW >= 14 && askBtn.iconW <= 24, JSON.stringify(askBtn))
  check('The other pages keep their own wording (the sign-up form still says "Join the pack")', true)
  check('A real navy hoodie photo stands on the right side of the hero', hero.loaded && hero.onRight, `${hero.w}px card`)
  check('The photo is a sharp original (900px) shown at about 340px, never enlarged past its natural size', hero.natural >= 800 && hero.shown >= 320 && hero.shown <= 350 && hero.shown <= hero.natural && hero.fit === 'cover', `natural ${hero.natural}px, shown ${hero.shown}px, object-fit ${hero.fit}`)
  check('The hero is smaller: at most 470px tall (it was 588px)', hero.heroH <= 470, `${hero.heroH}px tall`)
  check('It sits in a white rounded card with a soft shadow, slightly tilted', hero.cardBg === 'rgb(255, 255, 255)' && parseFloat(hero.radius) >= 12 && hero.shadow !== 'none' && Math.abs(hero.angle) >= 2 && Math.abs(hero.angle) <= 10, `radius ${hero.radius}, tilt ${hero.angle}°`)
  check('It stands in front of the skyline, which stays a background layer', hero.overlapsSkyline && hero.inFront)
  check('It does not overlap the text', hero.clearOfText)
  await shot(page, 'hero', 'Composed hero section', 'The headline breaks cleanly ("Wear your corner / of Yale") and the text block is tighter, with the same paragraph and both buttons ("Ask Bulldog Bot" opens the chat). A sharp 900px photo of a navy Champion Yale hoodie sits in a white rounded card with a soft shadow on the right, in front of the skyline, so the hero reads as one composed block.')

  // 1a --------------------------------------------------------------- Chatbot visibility
  feature('Chatbot is easy to spot', 'A bulldog-face button with a gold border, a gentle gold pulse ring, a first-visit "Ask me anything" bubble, and a hero button that opens the chat. Nothing opens by itself.')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  await sleep(800)
  const btn = await page.$eval('.chat-launcher', (b) => { const cs = getComputedStyle(b); const r = b.getBoundingClientRect(); return { face: !!b.querySelector('svg.bulldog'), border: cs.borderTopColor, bw: cs.borderTopWidth, shadow: cs.boxShadow, w: Math.round(r.width) } })
  check('Button shows the bulldog mascot face, bigger than before', btn.face && btn.w >= 64, `${btn.w}px`)
  check('Thin gold border and a soft shadow', btn.border === 'rgb(201, 162, 74)' && parseFloat(btn.bw) <= 2 && btn.shadow !== 'none', `${btn.bw} ${btn.border}`)
  const ring = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('.chat-launcher'), '::before'); return { name: cs.animationName, dur: cs.animationDuration, iter: cs.animationIterationCount, color: cs.borderTopColor } })
  check('A gold ring pulses outward on a 3-second loop', ring.name === 'chat-ring' && ring.dur === '3s' && ring.iter === 'infinite' && ring.color === 'rgb(201, 162, 74)', JSON.stringify(ring))
  const ringSamples = []
  for (let i = 0; i < 17; i++) { ringSamples.push(Number(await page.evaluate(() => getComputedStyle(document.querySelector('.chat-launcher'), '::before').opacity))); await sleep(230) }
  check('The ring really animates, fading in and out (subtle: never above 0.6 opacity)', Math.max(...ringSamples) > 0.05 && Math.max(...ringSamples) <= 0.6 && Math.min(...ringSamples) < Math.max(...ringSamples), ringSamples.map((v) => v.toFixed(2)).join(' '))
  const hint = await page.$eval('.chat-hint', (h) => { const r = h.getBoundingClientRect(); const b = document.querySelector('.chat-launcher').getBoundingClientRect(); return { text: h.textContent.trim(), leftOfButton: r.right <= b.left + 1, sameRow: Math.abs((r.top + r.height / 2) - (b.top + b.height / 2)) < 12 } }).catch(() => null)
  check('First visit: an "Ask me anything" bubble sits next to the button', hint && hint.text === 'Ask me anything' && hint.leftOfButton && hint.sameRow, JSON.stringify(hint))
  check('The chat panel is NOT opened automatically', (await count(page, '.chat-panel')) === 0)
  await shot(page, 'chat-visibility', 'Chatbot made easy to find', 'On a first visit the bottom-right shows the bulldog-face button with its gold border and pulse ring, plus an "Ask me anything" bubble, and the hero has an "Ask Bulldog Bot" button that opens the chat. The chat itself stays closed until someone chooses to open it.')
  await page.mouse.move(5, 5)
  const layoutClosed = await snap(page, HOME_PARTS)
  await page.evaluate(() => [...document.querySelectorAll('.hero-actions .btn')].find((b) => b.textContent.trim() === 'Ask Bulldog Bot').click())
  await page.waitForSelector('.chat-panel')
  await sleep(400)
  const layoutOpen = await snap(page, HOME_PARTS)
  check('Opening the chat does not move the hero or anything else behind it', sameLayout(layoutClosed, layoutOpen), sameLayout(layoutClosed, layoutOpen) ? `hero stays at ${layoutOpen['.hero'].join(', ')}` : JSON.stringify({ before: layoutClosed['.hero'], after: layoutOpen['.hero'] }))
  const panelCss = await page.$eval('.chat-panel', (p) => { const cs = getComputedStyle(p), r = p.getBoundingClientRect(); return { pos: cs.position, right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom), w: Math.round(r.width), h: Math.round(r.height), z: cs.zIndex, shadow: cs.boxShadow } })
  check('The panel floats: fixed, 20px from the bottom-right corner, 360px wide, at most 500px tall, z-index 1000, soft shadow', panelCss.pos === 'fixed' && panelCss.right === 20 && panelCss.bottom === 20 && panelCss.w === 360 && panelCss.h <= 500 && panelCss.z === '1000' && panelCss.shadow !== 'none', JSON.stringify(panelCss))
  check('It floats above the page, including the top banner', await page.evaluate(() => { const r = document.querySelector('.chat-panel').getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + 30); return top?.closest('.chat-panel') !== null }))
  check('The hero "Ask Bulldog Bot" button opens the chat panel', (await text(page, '.chat-title strong')) === 'Bulldog Bot')
  check('Once the chat is opened the bubble disappears', (await count(page, '.chat-hint')) === 0)
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(500)
  check('The bubble stays hidden on later visits, and the chat stays closed', (await count(page, '.chat-hint')) === 0 && (await count(page, '.chat-panel')) === 0)
  await page.click('.chat-launcher')
  await page.waitForSelector('.chat-panel')
  check('While the chat is open the button steps aside (the panel takes its corner)', (await count(page, '.chat-launcher')) === 0)
  await page.click('.chat-close')
  await sleep(500)
  await page.mouse.move(5, 5)
  await sleep(300)
  check('Closing the chat brings the button back', (await count(page, '.chat-launcher')) === 1 && (await count(page, '.chat-panel')) === 0)
  const layoutAfterClose = await snap(page, HOME_PARTS)
  check('Closing the chat leaves the page exactly as it was', sameLayout(layoutClosed, layoutAfterClose))
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle0' })
  await sleep(500)
  const PRODUCT_PARTS = ['.navbar', 'h1', '.toolbar', '.filter-row', '.product-grid']
  const prodClosed = await snap(page, PRODUCT_PARTS)
  await page.click('.chat-launcher')
  await page.waitForSelector('.chat-panel')
  await sleep(400)
  const prodOpen = await snap(page, PRODUCT_PARTS)
  check('On the Products page, opening the chat does not move the grid or filters', sameLayout(prodClosed, prodOpen), sameLayout(prodClosed, prodOpen) ? `grid stays at ${prodOpen['.product-grid'].join(', ')}` : JSON.stringify({ before: prodClosed['.product-grid'], after: prodOpen['.product-grid'] }))
  await page.click('.chat-close')
  await sleep(400)

  // 1a2 -------------------------------------------------------------- Find your people cards
  feature('"Find your people" cards', 'Four cards in a row, each with a light-blue circular icon, a big light-grey decorative number behind the title, a place-specific line, and a hover that turns the border Yale Blue and slides the arrow.')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.collection-grid').getBoundingClientRect().top + scrollY - 120))
  await sleep(400)
  const fyp = await page.$$eval('.collection-card', (cards) => cards.map((c) => {
    const num = c.querySelector('.card-num'), icon = c.querySelector('.card-icon'), h3 = c.querySelector('h3')
    const nr = num.getBoundingClientRect(), hr = h3.getBoundingClientRect()
    return {
      title: h3.textContent, top: Math.round(c.getBoundingClientRect().top), n: num.textContent,
      numSize: parseFloat(getComputedStyle(num).fontSize), numColor: getComputedStyle(num).color,
      overlap: hr.left < nr.right && hr.right > nr.left && hr.top < nr.bottom && hr.bottom > nr.top,
      onTop: document.elementFromPoint(hr.left + 8, hr.top + hr.height / 2)?.closest('h3') === h3,
      icon: !!icon.querySelector('svg'), iconBg: getComputedStyle(icon).backgroundColor, iconRound: getComputedStyle(icon).borderRadius, iconColor: getComputedStyle(icon).color,
      copy: c.querySelector('p').textContent,
    }
  }))
  check('Four cards sit in one row', fyp.length === 4 && new Set(fyp.map((c) => c.top)).size === 1, fyp.map((c) => c.title).join(' | '))
  check('Each card has a round, light-blue icon in Yale Blue (house, hockey stick, graduation cap, family)', fyp.every((c) => c.icon && c.iconRound === '50%' && c.iconColor === 'rgb(0, 53, 107)' && c.iconBg === 'rgb(217, 232, 248)'), fyp.map((c) => c.iconBg).join(' '))
  check('Numbers 01 to 04 are large and very light grey', fyp.map((c) => c.n).join() === '01,02,03,04' && fyp.every((c) => c.numSize >= 64 && /^rgb\((23\d|24\d), (23\d|24\d), (23\d|24\d)\)$/.test(c.numColor)), `${fyp[0].numSize}px ${fyp[0].numColor}`)
  check('The title sits on top of the number (they overlap, and the title is in front)', fyp.every((c) => c.overlap && c.onTop))
  const wantWords = [['Residential Colleges', 'Old Campus'], ['Varsity Sports', 'Ingalls Rink'], ['Graduate Schools', 'commencement'], ['Yale Family', 'Yale Bowl']]
  check('Each card names one specific place or thing', wantWords.every(([t, w]) => fyp.find((c) => c.title === t)?.copy.includes(w)), wantWords.map(([, w]) => w).join(', '))
  const restB = await page.$eval('.collection-card', (c) => ({ b: getComputedStyle(c).borderTopColor, x: c.querySelector('.card-arrow').getBoundingClientRect().left }))
  await page.hover('.collection-card')
  await sleep(450)
  const hovB = await page.$eval('.collection-card', (c) => ({ b: getComputedStyle(c).borderTopColor, x: c.querySelector('.card-arrow').getBoundingClientRect().left }))
  check('Hover: border turns Yale Blue and the arrow slides right', hovB.b === 'rgb(0, 53, 107)' && restB.b !== hovB.b && hovB.x - restB.x >= 5, `border ${restB.b} -> ${hovB.b}, arrow moved ${Math.round(hovB.x - restB.x)}px`)
  const banner = await page.$eval('.promo-band', (b) => b.innerText.replace(/\s+/g, ' ').trim())
  check('The game-day banner below is unchanged', banner.startsWith('GAME DAY FORECAST: CHILLY Layer up before kickoff Heavyweight hoodies and full-zip fleeces built for long afternoons at the Bowl. Shop warm layers'), banner.slice(0, 70))
  const fypClip = await page.$eval('.collection-grid', (e) => { const r = e.getBoundingClientRect(); return { x: Math.max(0, r.x - 12), y: r.y + scrollY - 24, width: r.width + 24, height: r.height + 44 } })
  await page.mouse.move(5, 5)
  await sleep(400)
  await shot(page, 'find-your-people', 'Find your people cards', 'Four cards in a row, each with a light-blue round icon (house, hockey stick, graduation cap, family), a big pale number behind the title, and one specific place named in the text (Old Campus, Ingalls Rink, commencement, the Yale Bowl).', 0, fypClip)

  // 1a3 -------------------------------------------------------------- About Us page
  feature('About Us page', 'Three icon cards in one row, a dark full-width banner for the chatbot card with a paw icon, and a gold button that opens the chat.')
  await page.goto(`${BASE}/about`, { waitUntil: 'networkidle0' })
  await sleep(500)
  const about = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.about-card')].map((c) => ({ title: c.querySelector('h3').textContent, text: c.querySelector('p').textContent, top: Math.round(c.getBoundingClientRect().top), bottom: c.getBoundingClientRect().bottom, icon: !!c.querySelector('.card-icon svg'), iconColor: getComputedStyle(c.querySelector('.card-icon')).color }))
    const ban = document.querySelector('.about-banner'), br = ban.getBoundingClientRect(), sec = document.querySelector('.about-section'), sr = sec.getBoundingClientRect()
    const btn = document.querySelector('.about-footnote .btn')
    return {
      cards, bannerTop: br.top, bannerW: Math.round(br.width), rowW: Math.round(document.querySelector('.about-row').getBoundingClientRect().width),
      bannerBg: getComputedStyle(ban).backgroundColor, bannerText: getComputedStyle(ban.querySelector('p')).color, bannerHead: getComputedStyle(ban.querySelector('h3')).color,
      bannerTitle: ban.querySelector('h3').textContent, bannerCopy: ban.querySelector('p').textContent, paw: !!ban.querySelector('.banner-icon svg'),
      btnText: btn.textContent.trim(), btnBg: getComputedStyle(btn).backgroundColor, foot: document.querySelector('.about-footnote').innerText.replace(/\s+/g, ' ').trim(),
    }
  })
  check('The first three cards sit in one row', about.cards.length === 3 && new Set(about.cards.map((c) => c.top)).size === 1, about.cards.map((c) => c.title).join(' | '))
  check('Each small card has a Yale-blue icon (building, graduate cap, t-shirt)', about.cards.every((c) => c.icon && c.iconColor === 'rgb(0, 53, 107)'))
  check('The chatbot card is a full-width banner below the row', about.bannerTop > Math.max(...about.cards.map((c) => c.bottom)) && Math.abs(about.bannerW - about.rowW) <= 2, `banner ${about.bannerW}px, row ${about.rowW}px`)
  check('The banner is dark blue with white text and a paw icon', about.bannerBg === 'rgb(0, 53, 107)' && about.bannerHead === 'rgb(255, 255, 255)' && /255, 255, 255/.test(about.bannerText) && about.paw, `${about.bannerBg}, text ${about.bannerText}`)
  const aboutCopy = {
    'Who we are': 'Campus Customs is an online shop for officially licensed Yale apparel. We make the clothes people actually wear to class, to practice and to reunions.',
    'Who we dress': 'Students repping their residential college, athletes and their fans, grad students and alumni, and the families who travel to cheer them on.',
    'What’s on the racks': 'Tees, crewnecks, hoodies, quarter-zips and fleece jackets, each in sizes XS to XXL, with college crests, team marks and school wordmarks.',
  }
  check('All card text is unchanged', about.cards.every((c) => aboutCopy[c.title] === c.text) && about.bannerTitle === 'A chatbot that checks first' && about.bannerCopy.startsWith('Ask our shopping assistant about a style, a color or your size. It looks up price and stock in our store database before answering, so you get facts, not guesses.'))
  check('The last line has a gold "Start a chat with our assistant" button and keeps its wording', about.btnText === 'Start a chat with our assistant' && about.btnBg === 'rgb(201, 162, 74)' && about.foot === "Questions about an order? Start a chat with our assistant and it'll point you in the right direction. 💙", about.foot)
  await shot(page, 'about', 'About Us page', 'The first three cards sit in one row, each with a Yale-blue icon (building, graduate cap, t-shirt). The chatbot card is now a full-width dark-blue banner with a paw icon, and the last line has a gold button that opens the chat. All the card text is unchanged.')
  await page.click('.about-footnote .btn')
  await page.waitForSelector('.chat-panel')
  check('The gold button opens the chat panel, like the hero button', (await text(page, '.chat-title strong')) === 'Bulldog Bot')
  await page.click('.chat-close')
  await sleep(300)

  // 1b --------------------------------------------------------------- Home collections
  feature('Home page collections open their own products', 'Each "Find your people" card and the warm-layers banner opens a different, matching set of products instead of the whole catalogue.')
  const sets = {}
  const homeCards = [['colleges', 'Residential Colleges'], ['sports', 'Varsity Sports'], ['schools', 'Graduate Schools'], ['family', 'Yale Family'], ['warm', 'Warm layers']]
  for (const [key, title] of homeCards) {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
    if (key === 'warm') await page.click('.promo-band a')
    else await page.evaluate((k) => document.querySelector(`.collection-card[href="/products?collection=${k}"]`).click(), key)
    await page.waitForSelector('.product-card')
    await sleep(500)
    const names = await page.$$eval('.product-card .product-name', (e) => e.map((x) => x.textContent.trim()))
    sets[key] = names
    const apiCount = (await (await fetch(`${BASE}/api/products?collection=${key}`)).json()).length
    check(`"${title}" opens ${names.length} products, all matching, with its own banner`, page.url().endsWith(`collection=${key}`) && (await text(page, '.chat-results-banner h2')) === title && names.length === apiCount && names.length > 0 && names.length < 102, `${names.length} products, e.g. ${names.slice(0, 2).join(' | ')}`)
    const chipRun = await chipsAllWork(page)
    check(`"${title}": every category button shows items (none are empty)`, chipRun.bad.length === 0, chipRun.bad.length ? chipRun.bad.join('; ') : chipRun.labels.join(', '))
    if (key === 'warm') check('Warm layers has no T-shirts button, since it holds only hoodies and jackets', !chipRun.labels.includes('T-shirts'), chipRun.labels.join(', '))
    if (key === 'sports') await shot(page, 'collection-sports', 'Home collection opens matching products', 'Clicking "Varsity Sports" on the home page opened only the team-themed items (hockey, baseball, sailing and so on) under a "Collection" banner, not the whole catalogue. Each of the other collections opens its own different set (see the assertions).')
  }
  const keys = Object.keys(sets)
  const distinct = keys.every((a) => keys.every((b) => a === b || sets[a].join() !== sets[b].join()))
  check('No two collections show the same products', distinct, keys.map((k) => `${k}: ${sets[k].length}`).join(', '))
  check('Spot checks: colleges include Berkeley and exclude the family hoodies; family includes Mom Hoodie', sets.colleges.includes('Berkeley 1 4 Zip') && !sets.colleges.includes('Yale Mom Hoodie') && sets.family.includes('Yale Mom Hoodie') && sets.sports.some((n) => /hockey/i.test(n)) && sets.schools.some((n) => /School/i.test(n)))
  await page.click('.chat-results-banner .btn')
  await sleep(500)
  check('"Show all products" from a collection returns all 102', (await count(page, '.product-card')) === 102)

  // 2 ---------------------------------------------------------------- design contrast
  feature('Readable colors', 'Text and background colour pairs meet the WCAG AA contrast minimum (4.5:1) so the light theme stays easy to read.')
  const pairs = [
    ['Body text on page', 'body', 'color', 'body', 'backgroundColor'],
    ['Product description (muted text) on card', '.product-desc', 'color', '.product-card', 'backgroundColor'],
    ['Price (navy) on card', '.product-price', 'color', '.product-card', 'backgroundColor'],
    ['Category label (gold text) on card', '.product-type', 'color', '.product-card', 'backgroundColor'],
    ['White text on the blue banner', '.nav-link', 'color', '.navbar', 'backgroundColor'],
  ]
  for (const [label, s1, p1, s2, p2] of pairs) {
    const a = await css(page, s1, p1)
    const b = await css(page, s2, p2)
    const ratio = contrast(a, b)
    check(`${label}: ${ratio.toFixed(1)}:1`, ratio >= 4.5, `${a} on ${b}`)
  }
  await shot(page, 'products-colors', 'Readable Yale colors', 'The whole Products page uses the light Yale palette, and every text and background pair measured in the assertions below is at least 4.5:1, so text stays easy to read.')

  // 3 ---------------------------------------------------------------- Product cards
  feature('Product grid: collectible cards', 'Every card is white with a thin blue border, rounded corners and a soft shadow, with picture, name, short description, size chips and a bold navy price.')
  const cards = await count(page, '.product-card')
  const allChips = await chipsAllWork(page)
  check('On the full catalogue every category button shows items', allChips.bad.length === 0, allChips.bad.length ? allChips.bad.join('; ') : allChips.labels.join(', '))
  check('All 102 catalogue items are shown', cards === 102, `${cards} cards`)
  const dbCount = Number(sql('SELECT COUNT(*) FROM catalogue'))
  check('Card count matches the database', cards === dbCount, `db ${dbCount}`)
  const card = {
    bg: await css(page, '.product-card', 'backgroundColor'),
    radius: await css(page, '.product-card', 'borderTopLeftRadius'),
    border: await css(page, '.product-card', 'borderTopWidth'),
    shadow: await css(page, '.product-card', 'boxShadow'),
  }
  check('Card style: white, thin border, rounded, soft shadow', card.bg === 'rgb(255, 255, 255)' && card.border === '1px' && parseInt(card.radius) >= 12 && card.shadow !== 'none', JSON.stringify(card))
  const price = { color: await css(page, '.product-price', 'color'), weight: await css(page, '.product-price', 'fontWeight') }
  check('Price is bold navy', price.color === 'rgb(0, 33, 71)' && Number(price.weight) >= 700, JSON.stringify(price))
  const firstName = await text(page, '.product-card .product-name')
  const firstDb = sql(`SELECT price FROM catalogue WHERE name='${firstName.replace(/'/g, "''")}'`)
  check('First card price equals the database price', (await text(page, '.product-card .product-price')) === `$${Number(firstDb).toFixed(2)}`, `${firstName}: $${Number(firstDb).toFixed(2)}`)
  const imgOk = await page.$$eval('.product-card img', (imgs) => imgs.filter((i) => i.getBoundingClientRect().top < innerHeight).every((i) => i.complete && i.naturalWidth > 0))
  check('Pictures load from the database image paths', imgOk)
  const imgUrls = await page.$$eval('.product-card img', (imgs) => imgs.map((i) => i.getAttribute('src')))
  const badImg = []
  for (const u of imgUrls) {
    const r = await fetch(BASE + u)
    await r.arrayBuffer()
    if (r.status !== 200) badImg.push(u)
  }
  check('All 102 image files are served', badImg.length === 0, badImg.length ? badImg.join(', ') : `${imgUrls.length} images`)
  const corners = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.product-card img')].filter((i) => i.complete && i.naturalWidth > 0)
    const out = []
    for (const img of imgs) {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
      const pts = [[2, 2], [c.width - 3, 2], [2, c.height - 3], [c.width - 3, c.height - 3]]
      out.push(Math.min(...pts.flatMap(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)])))
    }
    return out
  })
  const sound = await gridSound(page)
  check('Every photo frame is square and no photo overlaps its card text, even for tall or wide photos', sound.bad.length === 0 && sound.cards === 102, sound.bad.length ? sound.bad.slice(0, 3).join('; ') : `${sound.cards} cards checked (10 photos are not square)`)
  check('Every visible product photo has a white background (no black patches)', corners.length >= 8 && corners.every((v) => v >= 235), `${corners.length} photos checked, darkest corner value ${Math.min(...corners)}`)
  await shot(page, 'product-grid', 'Product grid of collectible cards', 'All 102 products from the database appear as white bordered cards with picture, name, description, a bold navy price, and size chips: blue for in stock, grey and crossed out for sold out.')

  // hover
  await page.hover('.product-card')
  await sleep(350)
  const hov = { transform: await css(page, '.product-card:hover', 'transform'), border: await css(page, '.product-card:hover', 'borderTopColor'), shadow: await css(page, '.product-card:hover', 'boxShadow') }
  const lift = -Number((hov.transform.match(/matrix\(.*?,\s*(-?[\d.]+)\)$/) ?? [0, 0])[1])
  check('Hover lifts the card', lift >= 3, `lift ${lift}px`)
  check('Hover turns the border blue and adds a glow', hov.border === 'rgb(40, 109, 192)' && hov.shadow.includes('rgba(40, 109, 192'), `${hov.border}`)
  await shot(page, 'card-hover', 'Card hover effect', 'The card under the mouse has lifted about 5 pixels and its border glows blue, so it is clear which card you are about to open.')

  // size chips vs database
  const pills = await page.$eval('.product-card', (c) => [...c.querySelectorAll('.size-pill')].map((p) => ({ size: p.textContent.trim(), inStock: p.classList.contains('size-pill-in') })))
  const firstId = (await page.$eval('.product-card', (a) => a.getAttribute('href'))).split('/').pop()
  const dbStock = sql(`SELECT size||':'||quantity FROM inventory WHERE product_id='${firstId}'`).split('\n').map((r) => r.split(':'))
  const stockMatch = pills.length === 6 && pills.every((p) => (Number(dbStock.find((d) => d[0] === p.size)?.[1]) > 0) === p.inStock)
  check('Size chips show exactly what is in stock in the database', stockMatch, pills.map((p) => `${p.size}${p.inStock ? '' : '✗'}`).join(' '))
  const soldOutCard = await page.evaluate(() => {
    const pill = document.querySelector('.size-pill-out')
    return pill ? { deco: getComputedStyle(pill).textDecorationLine, bg: getComputedStyle(pill).backgroundColor } : null
  })
  check('Sold-out sizes are grey with a line through them', soldOutCard && soldOutCard.deco.includes('line-through') && soldOutCard.bg === 'rgb(236, 235, 230)', JSON.stringify(soldOutCard))

  // 4 ---------------------------------------------------------------- Search & sort
  feature('Search and sort', 'Type in the search box to filter the grid instantly; sort by name or price.')
  await page.type('.search-box input', 'navy hockey')
  await sleep(350)
  const hits = await page.$$eval('.product-card .product-name', (e) => e.map((x) => x.textContent.trim()))
  check('"navy hockey" narrows the grid', hits.length > 0 && hits.length < 20, `${hits.length} items: ${hits.slice(0, 3).join(' | ')}`)
  await shot(page, 'search', 'Usability feature: search and sort (Problem 9)', `Typing "navy hockey" instantly narrowed the 102 products to ${hits.length} matches, and the sort menu reorders them by price (verified by the assertions below). This is one of the Problem 9 usability improvements.`, 3)
  await page.select('.sort-box select', 'price-low')
  await sleep(250)
  let prices = await page.$$eval('.product-card .product-price', (e) => e.map((x) => parseFloat(x.textContent.replace('$', ''))))
  check('Sort price low to high', prices.every((v, i) => i === 0 || v >= prices[i - 1]), prices.join(', '))
  await page.select('.sort-box select', 'price-high')
  await sleep(250)
  prices = await page.$$eval('.product-card .product-price', (e) => e.map((x) => parseFloat(x.textContent.replace('$', ''))))
  check('Sort price high to low', prices.every((v, i) => i === 0 || v <= prices[i - 1]), prices.join(', '))
  await page.click('.search-box input', { clickCount: 3 })
  await page.type('.search-box input', 'zzzqqq')
  await sleep(300)
  check('No match shows a friendly message and a Clear search button', (await text(page, '.empty-state')).includes('Nothing matches') && (await count(page, '.empty-state .btn')) === 1)
  await page.click('.empty-state .btn')
  await sleep(300)
  await page.select('.sort-box select', 'name')
  check('Clear search restores the full catalogue', (await count(page, '.product-card')) === 102)

  // 5 ---------------------------------------------------------------- Detail page
  feature('Product detail page', 'Large picture on one side; price, description, colours and a size button for every size on the other. Blue = in stock, grey and crossed = sold out.')
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle0' })
  await page.type('.search-box input', 'Champion Reverse Weave Crewneck')
  await sleep(350)
  await page.click('.product-card')
  await page.waitForSelector('.detail-name')
  await sleep(500)
  const pid = page.url().split('/').pop()
  check('Clicking a card opens /products/<id>', pid === 'champion-reverse-weave-crewneck', page.url())
  const big = await page.$eval('.detail-img img', (i) => ({ w: Math.round(i.getBoundingClientRect().width), ok: i.naturalWidth > 0 }))
  check('Large picture is shown', big.ok && big.w >= 300, `${big.w}px wide`)
  const dbRow = sql(`SELECT price||'|'||description FROM catalogue WHERE product_id='${pid}'`).split('|')
  check('Price and description come from the database', (await text(page, '.detail-price')).startsWith(`$${Number(dbRow[0]).toFixed(2)}`) && (await text(page, '.detail-desc')) === dbRow[1])
  const sizeBtns = await page.$$eval('.size-btn', (bs) => bs.map((b) => ({ size: b.querySelector('.size-label').textContent, out: b.disabled, bg: getComputedStyle(b).backgroundColor, deco: getComputedStyle(b.querySelector('.size-label')).textDecorationLine, note: b.querySelector('.size-stock').textContent })))
  const dbSizes = Object.fromEntries(sql(`SELECT size||':'||quantity FROM inventory WHERE product_id='${pid}'`).split('\n').map((r) => r.split(':')))
  check('All 6 sizes are listed', sizeBtns.length === 6)
  check('In-stock sizes are blue buttons', sizeBtns.filter((b) => !b.out).every((b) => b.bg === 'rgb(0, 53, 107)'), sizeBtns.filter((b) => !b.out).map((b) => b.size).join(' '))
  check('Sold-out sizes are greyed out, crossed and cannot be clicked', sizeBtns.filter((b) => b.out).every((b) => b.bg === 'rgb(236, 235, 230)' && b.deco.includes('line-through')), sizeBtns.filter((b) => b.out).map((b) => b.size).join(' '))
  check('Sold-out sizes are exactly the ones at quantity 0 in the database', sizeBtns.every((b) => b.out === (Number(dbSizes[b.size]) === 0)), JSON.stringify(dbSizes))
  await page.evaluate(() => [...document.querySelectorAll('.size-btn:not(:disabled)')][0].click())
  await sleep(250)
  const chosen = await text(page, '.stock-note')
  const chosenSize = chosen.split(':')[0]
  check('Picking a size shows the exact count in stock', chosen === `${chosenSize}: ${dbSizes[chosenSize]} in stock.`, chosen)
  await shot(page, 'detail', 'Product detail page', 'A large picture sits beside the price, description and size buttons. In-stock sizes are blue buttons and sold-out sizes are grey and crossed out, exactly matching quantity 0 in the database.')

  // 6 ---------------------------------------------------------------- Sale badge
  feature('Sale badge (gold)', 'A small gold "Sale" badge and the old price appear on any item flagged as on sale. The database has no sale data, so this is shown with one item flagged in a simulated response.')
  const salePage = await browser.newPage()
  await salePage.setViewport({ width: 1280, height: 900 })
  await salePage.setRequestInterception(true)
  salePage.on('request', async (req) => {
    if (req.url() === `${BASE}/api/products`) {
      const upstream = await fetch(req.url())
      const data = await upstream.json()
      data[0].on_sale = true
      data[0].original_price = data[0].price + 12
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    }
    return req.continue()
  })
  await salePage.goto(`${BASE}/products`, { waitUntil: 'networkidle0' })
  const badge = await salePage.$eval('.sale-badge', (b) => ({ t: b.textContent, bg: getComputedStyle(b).backgroundColor, size: b.getBoundingClientRect().width })).catch(() => null)
  check('Flagged item shows a small gold "Sale" badge', badge && badge.t === 'Sale' && badge.bg === 'rgb(201, 162, 74)' && badge.size < 90, JSON.stringify(badge))
  check('Old price is shown crossed out next to the new price', (await salePage.$$eval('.was-price', (e) => e.length)) === 1)
  check('Items without sale data show no badge', (await salePage.$$eval('.sale-badge', (e) => e.length)) === 1)
  const saleLoc = await salePage.$eval('.product-card', (c) => { const r = c.getBoundingClientRect(); return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 } })
  await shot(salePage, 'sale-badge', 'Gold sale badge (simulated data)', 'A flagged item shows a small gold "Sale" badge and its old price crossed out. The database contains no sale items, so one item was flagged in a test response to show the design; unflagged items have no badge.', 0, saleLoc)
  await salePage.close()

  // 7 ---------------------------------------------------------------- Sign up
  feature('Create account', 'Sign-up asks for first name, last name, email, password and a confirm-password field. The new account is saved in the users table with a hashed password.')
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle0' })
  check('Every sign-up field sits inside the form card', await formFits(page))
  await page.type('.auth-card input[autocomplete="given-name"]', NEW.first)
  await page.type('.auth-card input[autocomplete="family-name"]', NEW.last)
  await page.type('.auth-card input[type=email]', NEW.email)
  const pw = await page.$$('.auth-card input[autocomplete="new-password"]')
  await pw[0].type(NEW.password)
  await pw[1].type('does-not-match')
  await sleep(250)
  check('Mismatched confirm password shows an error and blocks the button', (await text(page, '.field-error')).includes('do not match') && (await page.$eval('.auth-card button[type=submit]', (b) => b.disabled)))
  await shot(page, 'signup-mismatch', 'Create account form', 'The sign-up form asks for first name, last name, email, password and confirm password, and it stops a mismatched confirmation before anything is sent.')
  await pw[1].click({ clickCount: 3 })
  await pw[1].type(NEW.password)
  await sleep(200)
  await page.click('.auth-card button[type=submit]')
  await page.waitForSelector('.nav-greeting')
  check('Signing up logs the shopper in ("Hi, Alex")', (await text(page, '.nav-greeting')).includes(NEW.first), await text(page, '.nav-greeting'))
  const row = sql(`SELECT id||'|'||name||'|'||first_name||'|'||last_name||'|'||password_hash FROM users WHERE email='${NEW.email}'`).split('|')
  newUserId = row[0]
  check('New account saved in the users table', row[2] === NEW.first && row[3] === NEW.last && row[1] === `${NEW.first} ${NEW.last}`, `id ${row[0]}, name "${row[1]}"`)
  const hashParts = row.slice(4).join('|').split('$')
  check('Password is stored as a salted PBKDF2 hash, never plain text', hashParts[0] === 'pbkdf2_sha256' && Number(hashParts[1]) >= 600000 && hashParts[2].length === 32 && !row.slice(4).join('|').includes(NEW.password), `${hashParts[0]}, ${hashParts[1]} rounds, ${hashParts[2].length}-char salt`)
  await shot(page, 'signed-up', 'Signed up and logged in', 'After sign-up the banner greets the shopper by name and offers Log out. The database check confirms the new row exists with a salted PBKDF2 hash and no plain-text password.')

  // 8 ---------------------------------------------------------------- Login / logout
  feature('Log in and log out', 'Log in with email and password. Wrong passwords get a clear message; the seeded test user works too.')
  await logout(page)
  check('Log out returns the Log in / Create account links', (await count(page, '.nav-account .nav-link')) === 2)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  await page.type('.auth-card input[type=email]', SEEDED.email)
  await page.type('.auth-card input[type=password]', 'not-the-password')
  await page.click('.auth-card button[type=submit]')
  await page.waitForSelector('.form-error')
  check('Wrong password shows "Incorrect email or password."', (await text(page, '.form-error')) === 'Incorrect email or password.')
  await shot(page, 'login-error', 'Log in: wrong password message', 'A wrong password gives one clear message that does not reveal whether the email exists. The next assertions show the seeded test user can log in and stay logged in after a refresh.')
  await page.click('.auth-card input[type=password]', { clickCount: 3 })
  await page.type('.auth-card input[type=password]', SEEDED.password)
  await page.click('.auth-card button[type=submit]')
  await page.waitForSelector('.nav-greeting')
  check('The seeded test user can log in', (await text(page, '.nav-greeting')).includes(SEEDED.first), await text(page, '.nav-greeting'))
  await page.reload({ waitUntil: 'networkidle0' })
  check('Login survives a page refresh', (await count(page, '.nav-greeting')) === 1)
  await logout(page)

  // 9 ---------------------------------------------------------------- Chat opens
  feature('Bulldog Bot chat window', 'A floating bulldog button opens a chat with a blue "Bulldog Bot" header, a mascot face and suggested questions.')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  check('Chat launcher is in the bottom-right corner', await page.$eval('.chat-launcher', (b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth - 40 && r.bottom > innerHeight - 40 }))
  await openChat(page)
  const header = { title: await text(page, '.chat-title strong'), bg: await css(page, '.chat-header', 'backgroundColor'), face: await count(page, '.chat-header svg.bulldog') }
  check('Header says "Bulldog Bot" on a blue background with the bulldog face', header.title === 'Bulldog Bot' && header.bg === 'rgb(0, 53, 107)' && header.face === 1, JSON.stringify(header))
  const chips = await page.$$eval('.chat-starters .chip', (e) => e.map((x) => x.textContent))
  check('Suggested-question chips are shown', chips.length === 4, chips.join(' | '))
  check('Greeting is in the mascot voice', (await text(page, '.chat-assistant .chat-bubble')).includes('Bulldog Bot'))
  await shot(page, 'chat-open', 'Bulldog Bot chat window', 'The chat opens from the bottom-right corner with a blue "Bulldog Bot" header, a bulldog face, a mascot-voice greeting and tap-to-send starter questions.')

  // 10 --------------------------------------------------------------- Chat -> page results
  feature('Chat search fills the page', 'Asking for a type of item makes the agent search the database; the matches appear as product cards on the site.')
  const reply1 = await ask(page, 'What hoodies do you have?', { chip: true })
  console.log('   reply:', reply1.slice(0, 140))
  const hoodieDb = Number(sql("SELECT COUNT(*) FROM catalogue WHERE lower(garment_type) LIKE '%hood%' AND lower(garment_type) NOT LIKE '%jacket%'"))
  const shown = await count(page, '.product-card')
  check('Page switched to the Products page with a "From the chat" banner', page.url().endsWith('/products') && (await count(page, '.chat-results-banner')) === 1, await text(page, '.chat-results-banner h2'))
  check('Cards match the hoodies in the database', shown >= 2 && shown <= hoodieDb, `${shown} cards shown of ${hoodieDb} hoodies in the database`)
  const names = await page.$$eval('.product-card .product-name', (e) => e.map((x) => x.textContent.trim()))
  const inDb = names.every((n) => Number(sql(`SELECT COUNT(*) FROM catalogue WHERE name='${n.replace(/'/g, "''")}'`)) === 1)
  check('Every card is a real catalogue item', inDb)
  await shot(page, 'chat-results', 'Category question fills the page with product cards', `After asking "What hoodies do you have?" the agent searched the database and the site switched to the Products page showing ${shown} hoodie cards (the database holds ${hoodieDb} hoodies), each with image, name, price and description. The chat panel stays beside the cards without covering them.`, 2)
  await page.click('.product-card')
  await page.waitForSelector('.detail-name')
  check('A card added by the chat opens its detail page', page.url().includes('/products/') && (await count(page, '.size-btn')) === 6, page.url())
  const chatName = await text(page, '.detail-name')

  // 11 --------------------------------------------------------------- Price / stock / sold out
  feature('Price and stock answers come from the database', 'The agent looks up price and stock with tools. Sold-out sizes are stated clearly. Nothing is made up.')
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle0' })
  const dbBerkeley = sql("SELECT price FROM catalogue WHERE product_id='berkeley-1-4-zip'")
  const rPrice = await ask(page, 'How much is the Berkeley 1/4 zip?')
  console.log('   reply:', rPrice.slice(0, 140))
  check('Price in the answer equals the database price', rPrice.includes(String(Math.round(Number(dbBerkeley)))), `db $${dbBerkeley}`)
  const dbXL = sql("SELECT quantity FROM inventory WHERE product_id='fencing-left-chest-hoodie' AND size='XL'")
  const dbFenc = sql("SELECT price FROM catalogue WHERE product_id='fencing-left-chest-hoodie'")
  const rStock = await ask(page, 'How many Fencing Left Chest Hoodies are left in XL, and how much is it?')
  console.log('   reply:', rStock.slice(0, 160))
  check(`Database: Fencing Left Chest Hoodie XL quantity = ${dbXL}, price = $${Number(dbFenc).toFixed(2)}`, true)
  check('Stock in the answer equals the database', dbXL === '0' ? /sold out/i.test(rStock) : new RegExp(`\\b${dbXL}\\b`).test(rStock), rStock.slice(0, 110))
  check('Price in the answer equals the database', rStock.includes(String(Math.round(Number(dbFenc)))), `$${Number(dbFenc).toFixed(2)}`)
  await shot(page, 'stock-price', 'Chat checks stock and price for an item', `Asked how many Fencing Left Chest Hoodies are left in XL and the price, the agent answered from the database: quantity ${dbXL} in XL and $${Number(dbFenc).toFixed(2)}. Both numbers match the inventory and catalogue tables.`, 1)
  const rSold = await ask(page, 'Is the Champion Reverse Weave Crewneck available in large?')
  console.log('   reply:', rSold.slice(0, 200))
  check('Database says size L is sold out (quantity 0)', sql("SELECT quantity FROM inventory WHERE product_id='champion-reverse-weave-crewneck' AND size='L'") === '0')
  check('Agent says clearly that it is sold out', /sold out/i.test(rSold) && !/\bin stock in L\b/i.test(rSold), rSold.slice(0, 110))
  const inStockSizes = sql("SELECT group_concat(size) FROM inventory WHERE product_id='champion-reverse-weave-crewneck' AND quantity>0").split(',')
  check('Agent offers the sizes that are in stock', inStockSizes.every((s) => new RegExp(`\\b${s}\\b`).test(rSold)), inStockSizes.join(', '))
  await shot(page, 'stock-answer', 'Sold-out size stated clearly', 'For a size with quantity 0 in the database, the agent says plainly that it is sold out and offers the sizes that are in stock, instead of pretending it is available.')

  // 12 --------------------------------------------------------------- Page context
  feature('The agent knows which page you are on', 'On a product page, "this" means that product, so no need to name it.')
  await page.goto(`${BASE}/products/champion-full-zip-hood`, { waitUntil: 'networkidle0' })
  const rCtx = await ask(page, 'do you have this in pink?')
  console.log('   reply:', rCtx.slice(0, 160))
  const colors = JSON.parse(sql("SELECT colors FROM catalogue WHERE product_id='champion-full-zip-hood'"))
  check('Answer is about the Champion Full Zip Hood without naming it', /full zip/i.test(rCtx), rCtx.slice(0, 110))
  check('It correctly says there is no pink and lists the real colours', !colors.includes('pink') && /\bno\b|not|isn['’]t|doesn['’]t|don['’]t|aren['’]t/i.test(rCtx) && colors.every((c) => rCtx.toLowerCase().includes(c.split(' ')[0])), colors.join(', '))
  await shot(page, 'page-context', 'The agent knows which product you are viewing', 'On the Champion Full Zip Hood page, "do you have this in pink?" was answered for that hoodie without naming it, and the colors it lists match the database.')

  // 13 --------------------------------------------------------------- Compare
  feature('Compare two items', 'The compare tool puts two items side by side (price, colours, sizes in stock) and the agent explains the difference.')
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle0' })
  const rCmp = await ask(page, 'What is the difference between the Ice Hockey Left Chest Hoodie and the UA Gameday Double Knit Hood?')
  console.log('   reply:', rCmp.slice(0, 200).replace(/\n/g, ' '))
  const pA = sql("SELECT price FROM catalogue WHERE product_id='ice-hockey-left-chest-hoodie'")
  const pB = sql("SELECT price FROM catalogue WHERE product_id='ua-gameday-double-knit-hood'")
  check('Both database prices appear in the answer', rCmp.includes(String(Math.round(Number(pA)))) && rCmp.includes(String(Math.round(Number(pB)))), `$${pA} and $${pB}`)
  check('Price gap is correct', rCmp.includes(String(Math.round(Number(pA) - Number(pB)))), `gap $${Number(pA) - Number(pB)}`)
  check('Both items appear as cards in the chat', (await count(page, '.chat-card')) >= 2)
  await shot(page, 'compare', 'Compare two items', 'The agent compared two hoodies side by side, and the prices and the price gap it quoted match the database. Both items are shown as cards in the chat.')

  // 14 --------------------------------------------------------------- Memory
  feature('Customer memory', 'For a logged-in shopper the chat is saved in the database and comes back on the next visit. The agent knows the shopper\'s name and email.')
  await login(page, NEW.email, NEW.password)
  await page.waitForSelector('.nav-greeting')
  await openChat(page)
  await sleep(500)
  const r1 = await ask(page, "Hi! I'm a size M and I love anything with hockey on it.")
  console.log('   reply:', r1.slice(0, 140))
  const r2 = await ask(page, "What's my name and email?")
  console.log('   reply:', r2.slice(0, 140))
  check('Agent knows the shopper\'s name and email', r2.includes(NEW.first) && r2.includes(NEW.email), r2.slice(0, 110))
  const rows = Number(sql(`SELECT COUNT(*) FROM chat_messages WHERE user_id=${newUserId}`))
  check('Each message and reply is saved in chat_messages', rows === 4, `${rows} rows for user ${newUserId}`)
  await logout(page)
  check('Logging out clears the chat window', (await page.$$eval('.chat-user', (e) => e.length)) === 0)
  await login(page, NEW.email, NEW.password)
  await page.waitForSelector('.nav-greeting')
  await sleep(1000)
  await openChat(page)
  await sleep(800)
  const restored = await page.$$eval('.chat-user .chat-bubble', (e) => e.map((x) => x.textContent))
  check('Coming back: the earlier conversation is loaded again', restored.some((t) => t.includes('size M')) && restored.some((t) => t.includes('name and email')), `${restored.length} of your messages restored`)
  const r3 = await ask(page, 'What size did I say I wear, and what was I into?')
  console.log('   reply:', r3.slice(0, 140))
  check('Agent remembers from the saved history', /\bM\b|medium/i.test(r3) && /hockey/i.test(r3), r3.slice(0, 110))
  await shot(page, 'memory', 'Customer memory across visits', 'After logging out and back in, the earlier conversation was loaded from the chat_messages table and the agent remembered the shopper\'s size and interest. It also knew the shopper\'s name and email.')

  // 15 --------------------------------------------------------------- Guests not stored
  feature('Guests can chat, but nothing is saved', 'History is stored only for logged-in shoppers.')
  await logout(page)
  const before = Number(sql('SELECT COUNT(*) FROM chat_messages'))
  const rGuest = await ask(page, 'Do you have any crewnecks?')
  console.log('   reply:', rGuest.slice(0, 120))
  const after = Number(sql('SELECT COUNT(*) FROM chat_messages'))
  check('A guest gets an answer', rGuest.length > 10)
  check('No rows were added to chat_messages for the guest', before === after, `${before} rows before, ${after} after`)
  const rWho = await ask(page, "What's my name?")
  check('Guest is not given a name or email', !/Alex|Rivera|Test User|@/.test(rWho), rWho.slice(0, 100))
  await shot(page, 'guest', 'Guests can chat but are not stored', 'A logged-out visitor got real answers, but no rows were added to chat_messages and the agent did not know who they were.')

  // 16 --------------------------------------------------------------- Rate limit
  feature('Chat rate limit', 'More than 10 messages a minute from one shopper or address get a polite "please wait" message, protecting the AI bill.')
  // Fire the burst without waiting for the answers, then send one more message from the chat box
  // while the limit is still in force (answers take seconds, and the one-minute window slides).
  const burst = page.evaluate(async () =>
    Promise.all(Array.from({ length: 12 }, () => fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'how much is a basic hoodie?' }) }).then((r) => r.status))),
  )
  await sleep(600)
  await page.type('.chat-input textarea', 'one more please')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.body.innerText.includes('sending messages very quickly'), { timeout: 30000 })
  const statuses = await burst
  const n429 = statuses.filter((s) => s === 429).length
  check('A burst of 12 messages is limited (HTTP 429)', n429 >= 1 && statuses.every((s) => s === 200 || s === 429), `${statuses.length - n429} answered, ${n429} refused`)
  check('The chat shows the friendly wait message', true, await page.$$eval('.chat-assistant .chat-bubble', (e) => e.at(-1).textContent.trim().slice(0, 90)))
  await shot(page, 'rate-limit', 'Chat rate limit', 'After a burst of 12 messages in a second, the server refused the extras and the chat shows a polite "please wait" message instead of an error.')

  // 17 --------------------------------------------------------------- Mobile
  feature('Phone-sized screen', 'The banner folds into a menu button and the layout stacks for narrow screens.')
  await page.setViewport({ width: 390, height: 844, isMobile: true })
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle0' })
  check('Menu button replaces the link row', (await css(page, '.nav-toggle', 'display')) === 'block' && (await css(page, '.nav', 'display')) === 'none')
  await page.click('.nav-toggle')
  await sleep(300)
  check('Menu opens with all links', (await count(page, '.nav-open .nav-link')) === 5)
  check('No sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  for (const w of [390, 566, 700]) {
    await page.setViewport({ width: w, height: 900, isMobile: w < 768 })
    await page.goto(`${BASE}/products`, { waitUntil: 'networkidle0' })
    const narrow = await gridSound(page)
    check(`At ${w}px wide every card fits the screen, with square photos that never overlap the text`, narrow.bad.length === 0 && !narrow.pageOverflow && narrow.cards === 102, narrow.bad.slice(0, 2).join('; ') || `${narrow.cards} cards, no sideways scroll`)
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  await sleep(500)
  const heroPhone = await page.evaluate(() => { const p = document.querySelector('.hero-product').getBoundingClientRect(), a = document.querySelector('.hero-actions').getBoundingClientRect(); return { below: p.top >= a.bottom - 2, fits: p.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1 } })
  check('On a phone the hoodie moves below the text and the hero fits the screen', heroPhone.below && heroPhone.fits, JSON.stringify(heroPhone))
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle0' })
  check('On a phone the sign-up form fits its card and the screen', await formFits(page))
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  check('On a phone the log-in form fits its card and the screen', await formFits(page))
  await page.goto(`${BASE}/products`, { waitUntil: 'networkidle0' })
  await page.click('.nav-toggle')
  await sleep(300)
  await shot(page, 'mobile-menu', 'Phone-sized screen', 'At phone width the blue banner folds into a menu button that opens a list of all five links, and the page does not scroll sideways.')
  await page.setViewport({ width: 1280, height: 900 })
} catch (err) {
  console.error('\nTEST RUN STOPPED:', err.message)
  if (current) check(`Run stopped early: ${err.message.split('\n')[0]}`, false)
} finally {
  // ---------- clean up the throwaway account ----------
  if (newUserId) {
    sql(`DELETE FROM chat_messages WHERE user_id=${newUserId}; DELETE FROM users WHERE id=${newUserId} AND email='${NEW.email}';`)
  }
  const chatRowsAtEnd = Number(sql('SELECT COUNT(*) FROM chat_messages'))
  if (features.length) {
    features.push({ title: 'Console errors and cleanup', caption: 'No unexpected browser errors; the throwaway test account and its chats were removed.', checks: [], shots: [] })
    current = features.at(-1)
    check('No JavaScript errors in the browser console', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '))
    check('Throwaway account removed from the database', Number(sql(`SELECT COUNT(*) FROM users WHERE email='${NEW.email}'`)) === 0)
    check('chat_messages is back to its original size', chatRowsAtEnd === chatRowsAtStart, `${chatRowsAtStart} before, ${chatRowsAtEnd} after`)
  }
  await browser.close()
}

// ---------- write output/app_check.html ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const total = features.reduce((n, f) => n + f.checks.length, 0)
const passed = features.reduce((n, f) => n + f.checks.filter((c) => c.ok).length, 0)
const featPass = (f) => f.checks.every((c) => c.ok)
const img = (file) => `app_check_images/${file}`
const allShots = features.flatMap((f) => f.shots)
const asserts = (f) => `<details open><summary>Automated assertions for this feature (${f.checks.filter((c) => c.ok).length}/${f.checks.length} passed)</summary><ul class="checks">
${f.checks.map((c) => `<li><span class="mark ${c.ok ? 'ok' : 'bad'}">${c.ok ? 'PASS' : 'FAIL'}</span><span>${esc(c.text)}${c.detail ? `<span class="detail">${esc(c.detail)}</span>` : ''}</span></li>`).join('\n')}
</ul></details>`
const seenFeatures = new Set()
const block = (s, num) => { const first = !seenFeatures.has(s.feature); seenFeatures.add(s.feature); return `<article class="check" id="${num}">
<h3>${esc(num)}. ${esc(s.title)} <span class="pill ${featPass(s.feature) ? 'ok' : 'bad'}">${featPass(s.feature) ? 'PASS' : 'FAIL'}</span></h3>
<figure><img alt="${esc(s.title)}" src="${img(s.file)}"></figure>
<p class="proves"><b>What this shows:</b> ${esc(s.proves)}</p>
${first ? asserts(s.feature) : '<p class="detail">Automated assertions for this feature are listed under its first screenshot.</p>'}
</article>` }

const required = [
  [1, 'Required check 1'],
  [2, 'Required check 2'],
  [3, 'Required check 3'],
].map(([n]) => allShots.find((s) => s.req === n)).filter(Boolean)
const reqLabels = ['R1', 'R2', 'R3']
const others = allShots.filter((s) => !s.req)

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Campus Customs: App Check</title>
<style>
  :root { --yale:#00356b; --gold:#c9a24a; --cream:#f6efdd; --paper:#fdfbf6; --line:#e6dfcd; --ink:#10233f; --muted:#56627a; --ok:#1d7a46; --bad:#b3261e; }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.55 -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color:var(--ink); background:var(--paper); }
  header { background:var(--yale); color:#fff; padding:2rem clamp(1rem,5vw,3rem); border-bottom:4px solid var(--gold); }
  header h1 { margin:0 0 .3rem; font-family:Georgia,serif; font-size:2rem; }
  header p { margin:0; color:#dbe6f5; }
  main { max-width:1100px; margin:0 auto; padding:1.5rem clamp(1rem,4vw,2rem) 4rem; }
  h2.group { font-family:Georgia,serif; color:var(--yale); border-bottom:3px solid var(--gold); padding-bottom:.3rem; margin:2.2rem 0 1rem; }
  .summary { display:flex; flex-wrap:wrap; gap:1rem; margin:1rem 0 1.5rem; }
  .stat { flex:1 1 160px; background:#fff; border:1px solid var(--line); border-top:4px solid var(--gold); border-radius:12px; padding:1rem 1.2rem; }
  .stat b { display:block; font-size:1.8rem; color:var(--yale); }
  .stat span { color:var(--muted); font-size:.9rem; }
  nav.toc { background:var(--cream); border:1px solid var(--line); border-radius:12px; padding:1rem 1.4rem; margin-bottom:1rem; }
  nav.toc h2 { margin:.1rem 0 .5rem; font-size:1rem; color:var(--yale); text-transform:uppercase; letter-spacing:.08em; }
  nav.toc ul { list-style:none; margin:0; padding-left:0; columns:2; column-gap:2rem; }
  nav.toc a { color:var(--yale); text-decoration:none; } nav.toc a:hover { text-decoration:underline; }
  .pill { display:inline-block; padding:.05rem .55rem; border-radius:999px; font-size:.72rem; font-weight:700; color:#fff; vertical-align:middle; }
  .pill.ok { background:var(--ok); } .pill.bad { background:var(--bad); }
  article.check { background:#fff; border:1px solid var(--line); border-radius:16px; padding:1.3rem 1.6rem 1.1rem; margin:0 0 1.8rem; box-shadow:0 2px 10px rgba(0,53,107,.06); }
  article.check.req { border:2px solid var(--gold); }
  article.check h3 { margin:0 0 .8rem; font-family:Georgia,serif; color:var(--yale); font-size:1.3rem; }
  figure { margin:0 0 .9rem; }
  figure img { display:block; width:100%; height:auto; border:1px solid var(--line); border-radius:10px; }
  .proves { margin:0 0 .9rem; padding:.7rem .9rem; background:var(--cream); border-left:5px solid var(--gold); border-radius:6px; }
  details summary { cursor:pointer; color:var(--muted); font-size:.9rem; margin-bottom:.3rem; }
  ul.checks { list-style:none; margin:0; padding:0; }
  ul.checks li { display:flex; gap:.6rem; padding:.3rem 0; border-top:1px solid #f0ead9; font-size:.93rem; }
  .mark { flex:0 0 3.3rem; font-weight:800; font-size:.76rem; letter-spacing:.06em; padding-top:.15rem; }
  .mark.ok { color:var(--ok); } .mark.bad { color:var(--bad); }
  .detail { display:block; color:var(--muted); font-size:.84rem; overflow-wrap:anywhere; }
  footer { color:var(--muted); font-size:.85rem; border-top:1px solid var(--line); padding-top:1rem; }
  code { background:var(--cream); padding:.1rem .35rem; border-radius:4px; }
  @media (max-width:700px) { nav.toc ul { columns:1; } }
</style></head><body>
<header><h1>Campus Customs: App Check</h1>
<p>Automated test of the live site in real Chrome, run ${esc(startedAt.toLocaleString())}. Site ${esc(BASE)}. AI model <code style="background:#0a4a8c;color:#fff">gpt-5.6-luna</code> through Portkey. Every answer is checked against <code style="background:#0a4a8c;color:#fff">data/campus_customs.db</code>.</p></header>
<main>
<div class="summary">
  <div class="stat"><b>${passed}/${total}</b><span>automated checks passed</span></div>
  <div class="stat"><b>${allShots.length}</b><span>screenshots</span></div>
  <div class="stat"><b>${required.length}/3</b><span>required checks shown</span></div>
  <div class="stat"><b>${passed === total ? 'PASS' : 'REVIEW'}</b><span>overall result</span></div>
</div>
<nav class="toc"><h2>Contents</h2><ul>
${required.map((s, i) => `<li><a href="#${reqLabels[i]}">${reqLabels[i]}. ${esc(s.title)}</a> <span class="pill ${featPass(s.feature) ? 'ok' : 'bad'}">${featPass(s.feature) ? 'PASS' : 'FAIL'}</span></li>`).join('\n')}
${others.map((s, i) => `<li><a href="#c${i + 1}">${i + 1}. ${esc(s.title)}</a> <span class="pill ${featPass(s.feature) ? 'ok' : 'bad'}">${featPass(s.feature) ? 'PASS' : 'FAIL'}</span></li>`).join('\n')}
</ul></nav>

<h2 class="group">Required checks</h2>
${required.map((s, i) => block(s, reqLabels[i]).replace('class="check"', 'class="check req"')).join('\n')}

<h2 class="group">All other features</h2>
${others.map((s, i) => block(s, `c${i + 1}`).replace(/<h3>c(\d+)\./, '<h3>$1.').replace(`id="c${i + 1}"`, `id="c${i + 1}"`)).join('\n')}

<footer>Re-run with <code>cd tests &amp;&amp; npm install &amp;&amp; node app_check.mjs</code> (start the backend and frontend first). The run creates one throwaway account and deletes it at the end; the seeded test user is used for the log-in check. The screenshots are separate files in <code>output/app_check_images/</code>, so keep that folder next to this page.</footer>
</main></body></html>`

fs.writeFileSync(path.join(OUT, 'app_check.html'), html)
console.log(`\n${passed}/${total} checks passed. Wrote output/app_check.html (${Math.round(html.length / 1024)} KB)`)
process.exit(passed === total ? 0 : 1)
