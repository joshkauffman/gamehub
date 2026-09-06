import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './XMarksTheSpot.module.css'

// ── X Marks the Spot ─────────────────────────────────────────────────
// A peaceful pirate scavenger hunt: no combat, no monsters — just an
// island, a chain of clues, and a treasure at the end. Each clue you
// find names the next landmark and a rough compass direction to it;
// the landmark order is reshuffled every playthrough so the same island
// hides its treasure somewhere new each time.

const WORLD_W = 2600
const WORLD_H = 1800
const PLAYER_SPEED = 230
const PLAYER_R = 18
const PICKUP_R = 70

const OCEAN = '#1a6f8a'
const SAND = '#e8cf8a'
const JUNGLE = '#3a7d3f'

// The starting clue — always the same spot, a short walk from spawn.
const START = { id: 'bottle', name: 'a Message in a Bottle', x: 480, y: 1380, emoji: '🍾' }
const SPAWN = { x: 420, y: 1300 }

// The rest of the island's landmarks — shuffled fresh each playthrough;
// whichever one lands last in the shuffle holds the treasure instead of
// a clue.
const POOL = [
  { id: 'skull', name: 'Skull Rock', x: 2100, y: 420, emoji: '💀' },
  { id: 'palms', name: 'the Twin Palms', x: 720, y: 320, emoji: '🌴' },
  { id: 'wreck', name: 'the Shipwreck', x: 2200, y: 1500, emoji: '🚢' },
  { id: 'light', name: 'the Lighthouse Ruins', x: 2350, y: 900, emoji: '🗼' },
  { id: 'fall', name: 'the Hidden Waterfall', x: 1300, y: 260, emoji: '💦' },
  { id: 'grave', name: "the Pirate's Cemetery", x: 900, y: 1620, emoji: '🪦' },
]

// Ambient, non-interactive scenery so the island doesn't look empty
// around the landmarks.
const DECOR = [
  { x: 300, y: 500, emoji: '🌴' }, { x: 1000, y: 900, emoji: '🌴' }, { x: 1700, y: 1300, emoji: '🌴' },
  { x: 1900, y: 650, emoji: '🌴' }, { x: 600, y: 1000, emoji: '🪨' }, { x: 1500, y: 1600, emoji: '🪨' },
  { x: 2000, y: 1100, emoji: '🪨' }, { x: 1100, y: 500, emoji: '🌿' }, { x: 1600, y: 800, emoji: '🌿' },
  { x: 800, y: 1200, emoji: '🌿' }, { x: 2100, y: 1700, emoji: '🌿' }, { x: 400, y: 700, emoji: '🐚' },
  { x: 1300, y: 1500, emoji: '🐚' },
]

const DIRS = ['east', 'northeast', 'north', 'northwest', 'west', 'southwest', 'south', 'southeast']

function rand(a, b) { return a + Math.random() * (b - a) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }
function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function directionTo(from, to) {
  const deg = (Math.atan2(-(to.y - from.y), to.x - from.x) * 180 / Math.PI + 360) % 360
  return DIRS[Math.round(deg / 45) % 8]
}
function makeClueText(toName, dir) {
  return pick([
    `A tattered scrap reads: "Head ${dir}, sail true, 'til ye spy ${toName}."`,
    `Scratched into old wood: "${toName} keeps the next secret. Look ${dir} from here."`,
    `The parchment points ${dir} — somethin' called ${toName} awaits.`,
    `"Ye've done well. Now go ${dir}, toward ${toName}, and dig no further 'til ye arrive."`,
  ])
}
function makeFinalClueText(dir) {
  return pick([
    `The last scrap glows faintly: "X marks the spot — ${dir} of here, where the ground don't lie."`,
    `"Ye've found 'em all. The treasure lies ${dir}. Go dig, ye scallywag!"`,
  ])
}

// ── Pure game state ──────────────────────────────────────────────────
function mkInitialState() {
  const shuffled = shuffle(POOL)
  const treasureSite = shuffled[shuffled.length - 1]
  const clueSites = shuffled.slice(0, -1)
  const chain = [START, ...clueSites]
  return {
    player: { x: SPAWN.x, y: SPAWN.y, facing: 1 },
    chain, treasureSite,
    currentIndex: 0,
    found: new Set(),
    journal: [],
    camera: { x: SPAWN.x, y: SPAWN.y },
    banner: null, bannerTimer: 0, bannerQueue: [],
    particles: [],
    startTime: performance.now(),
    elapsed: 0,
  }
}

function activeTarget(state) {
  return state.currentIndex < state.chain.length ? state.chain[state.currentIndex] : state.treasureSite
}

function pushBanner(state, icon, text) { state.bannerQueue.push({ icon, text }) }
function spawnBurst(state, x, y, colors) {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = rand(60, 180)
    state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.9, maxLife: 0.9, color: pick(colors) })
  }
}

function collectClue(state) {
  const site = state.chain[state.currentIndex]
  state.found.add(site.id)
  const nextIndex = state.currentIndex + 1
  const isFinal = nextIndex >= state.chain.length
  const nextTarget = isFinal ? state.treasureSite : state.chain[nextIndex]
  const dir = directionTo(site, nextTarget)
  const text = isFinal ? makeFinalClueText(dir) : makeClueText(nextTarget.name, dir)
  state.journal.push({ name: site.name, emoji: site.emoji, text })
  pushBanner(state, site.emoji, text)
  spawnBurst(state, site.x, site.y, ['#ffe08a', '#fff3c4', '#d4af37'])
  state.currentIndex = nextIndex
}

function update(state, keys, dt, helpers) {
  state.elapsed = (performance.now() - state.startTime) / 1000

  let mx = 0, my = 0
  if (keys.up) my -= 1
  if (keys.down) my += 1
  if (keys.left) mx -= 1
  if (keys.right) mx += 1
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my)
    mx /= len; my /= len
    state.player.x = clamp(state.player.x + mx * PLAYER_SPEED * dt, 30, WORLD_W - 30)
    state.player.y = clamp(state.player.y + my * PLAYER_SPEED * dt, 30, WORLD_H - 30)
    if (mx !== 0) state.player.facing = mx > 0 ? 1 : -1
  }

  const won = state.currentIndex >= state.chain.length
  const target = activeTarget(state)
  const d = Math.hypot(state.player.x - target.x, state.player.y - target.y)
  if (d < PICKUP_R) {
    if (!won) {
      collectClue(state)
    } else if (!state.treasureFound) {
      state.treasureFound = true
      spawnBurst(state, target.x, target.y, ['#ffd34d', '#fff3c4', '#ffb300', '#d4af37'])
      helpers.onTreasure(state)
    }
  }

  for (const p of state.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt
    p.life -= dt
  }
  state.particles = state.particles.filter(p => p.life > 0)

  if (!state.banner && state.bannerQueue.length) { state.banner = state.bannerQueue.shift(); state.bannerTimer = 6 }
  if (state.banner) { state.bannerTimer -= dt; if (state.bannerTimer <= 0) state.banner = null }

  state.camera.x += (state.player.x - state.camera.x) * 0.12
  state.camera.y += (state.player.y - state.camera.y) * 0.12
}

// ── Drawing ──────────────────────────────────────────────────────────
function drawIsland(ctx) {
  ctx.fillStyle = OCEAN
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)

  const pts = [
    [560, 320], [1000, 160], [1500, 130], [1980, 230], [2320, 460], [2480, 850],
    [2420, 1280], [2200, 1620], [1750, 1760], [1250, 1720], [820, 1660],
    [520, 1520], [340, 1150], [340, 720],
  ]
  ctx.fillStyle = SAND
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath(); ctx.fill()
  for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x, y, 240, 0, Math.PI * 2); ctx.fill() }

  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.6, cy + (y - cy) * 0.6])
  ctx.fillStyle = JUNGLE
  ctx.beginPath()
  inner.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath(); ctx.fill()
  for (const [x, y] of inner) { ctx.beginPath(); ctx.arc(x, y, 150, 0, Math.PI * 2); ctx.fill() }
}

function drawEmoji(ctx, emoji, x, y, size) {
  ctx.font = size + 'px serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(emoji, x, y)
}

function drawChest(ctx, x, y, glow) {
  ctx.save()
  ctx.translate(x, y)
  if (glow) {
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 46)
    g.addColorStop(0, 'rgba(255,215,80,0.55)')
    g.addColorStop(1, 'rgba(255,215,80,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = '#6b4423'
  ctx.fillRect(-22, -8, 44, 24)
  ctx.fillStyle = '#8a5a30'
  ctx.beginPath(); ctx.ellipse(0, -8, 22, 10, 0, Math.PI, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#d4af37'
  ctx.fillRect(-22, -1, 44, 3)
  ctx.beginPath(); ctx.arc(0, -1, 5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawPirate(ctx, x, y, facing) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(facing, 1)
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath(); ctx.ellipse(0, 20, 14, 5, 0, 0, Math.PI * 2); ctx.fill()
  // coat body
  ctx.fillStyle = '#5b3a29'
  ctx.beginPath(); ctx.ellipse(0, 10, 12, 14, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#3d2a1f'
  ctx.fillRect(-12, 8, 24, 8)
  // head
  ctx.fillStyle = '#e0a878'
  ctx.beginPath(); ctx.arc(0, -8, 11, 0, Math.PI * 2); ctx.fill()
  // bandana
  ctx.fillStyle = '#b5241c'
  ctx.beginPath()
  ctx.moveTo(-11, -12); ctx.lineTo(11, -12); ctx.lineTo(8, -18); ctx.lineTo(-8, -18)
  ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(9, -10); ctx.lineTo(16, -6); ctx.lineTo(9, -5); ctx.closePath(); ctx.fill()
  // eye patch + eye
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath(); ctx.arc(4, -8, 3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#2a2015'
  ctx.beginPath(); ctx.arc(-4, -8, 1.6, 0, Math.PI * 2); ctx.fill()
  // mustache
  ctx.strokeStyle = '#2a2015'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(0, 1, 6, -2); ctx.stroke()
  ctx.restore()
}

export default function XMarksTheSpot() {
  const [phase, setPhaseState] = useState('intro')
  const phaseRef = useRef('intro')
  const [winStats, setWinStats] = useState(null)
  const canvasRef = useRef(null)
  const sizeRef = useRef({ w: window.innerWidth, h: window.innerHeight })
  const stateRef = useRef(null)
  const keysRef = useRef({ up: false, down: false, left: false, right: false })
  const rafRef = useRef(null)

  const clueCountRef = useRef(null)
  const bannerRef = useRef(null)
  const compassRef = useRef(null)
  const compassArrowRef = useRef(null)
  const compassDistRef = useRef(null)
  const controlsHintRef = useRef(null)
  const [journalOpen, setJournalOpen] = useState(false)
  const [journalEntries, setJournalEntries] = useState([])

  function setPhase(p) { phaseRef.current = p; setPhaseState(p) }

  useEffect(() => {
    const canvas = canvasRef.current
    function onResize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight }
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    function key(code, down) {
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.up = down
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.down = down
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = down
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = down
    }
    const onKeyDown = e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      key(e.code, true)
    }
    const onKeyUp = e => key(e.code, false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const journalEntriesRef = { current: [] }

    function writeHud(state) {
      if (clueCountRef.current) {
        const n = Math.min(state.currentIndex, state.chain.length)
        clueCountRef.current.textContent = `🧭 Clues found: ${n} / ${state.chain.length}`
      }
      if (bannerRef.current) {
        if (state.banner) {
          bannerRef.current.style.visibility = 'visible'
          bannerRef.current.style.opacity = state.bannerTimer > 0.6 ? 1 : state.bannerTimer / 0.6
          bannerRef.current.textContent = `${state.banner.icon} ${state.banner.text}`
        } else {
          bannerRef.current.style.visibility = 'hidden'
        }
      }
      if (compassRef.current) {
        const t = activeTarget(state)
        const dist = Math.hypot(t.x - state.player.x, t.y - state.player.y)
        const bearing = Math.atan2(t.x - state.player.x, -(t.y - state.player.y))
        compassArrowRef.current.style.transform = `rotate(${bearing}rad)`
        if (compassDistRef.current) compassDistRef.current.textContent = `${Math.round(dist)}m to go`
      }
      if (controlsHintRef.current) {
        const t = Math.max(0, 12 - state.elapsed)
        controlsHintRef.current.style.opacity = Math.min(1, t / 2)
        controlsHintRef.current.style.display = t <= 0 ? 'none' : 'block'
      }
      if (journalEntriesRef.current.length !== state.journal.length) {
        journalEntriesRef.current = state.journal.slice()
        setJournalEntries(journalEntriesRef.current)
      }
    }

    function draw(state, W, H) {
      ctx.save()
      ctx.translate(Math.round(W / 2 - state.camera.x), Math.round(H / 2 - state.camera.y))
      drawIsland(ctx)
      for (const d of DECOR) drawEmoji(ctx, d.emoji, d.x, d.y, 34)

      const target = activeTarget(state)
      for (const site of state.chain) {
        drawEmoji(ctx, site.emoji, site.x, site.y, 44)
        if (state.found.has(site.id)) drawEmoji(ctx, '🚩', site.x + 26, site.y - 26, 22)
      }
      if (state.currentIndex < state.chain.length) {
        const t = state.chain[state.currentIndex]
        const pulse = 1 + Math.sin(performance.now() / 220) * 0.15
        const g = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, 40 * pulse)
        g.addColorStop(0, 'rgba(255,235,120,0.55)')
        g.addColorStop(1, 'rgba(255,235,120,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(t.x, t.y, 40 * pulse, 0, Math.PI * 2); ctx.fill()
      } else {
        drawChest(ctx, target.x, target.y, !state.treasureFound)
      }

      for (const p of state.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      drawPirate(ctx, state.player.x, state.player.y, state.player.facing)
      ctx.restore()
    }

    let last = performance.now()
    function step() {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { w: W, h: H } = sizeRef.current
      const state = stateRef.current
      if (phaseRef.current === 'playing' && state) {
        update(state, keysRef.current, dt, {
          onTreasure: s => {
            setWinStats({ time: Math.round(s.elapsed), clues: s.chain.length })
            setTimeout(() => setPhase('win'), 900)
          },
        })
        writeHud(state)
        ctx.clearRect(0, 0, W, H)
        draw(state, W, H)
      } else {
        ctx.fillStyle = '#0d3a4a'
        ctx.fillRect(0, 0, W, H)
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  function startGame() {
    stateRef.current = mkInitialState()
    setJournalEntries([])
    setJournalOpen(false)
    setPhase('playing')
  }

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <Link to="/" className={styles.homeLink}>← GameHub</Link>

      {phase === 'playing' && (
        <div className={styles.hud}>
          <div className={styles.statsPanel}>
            <div ref={clueCountRef} className={styles.clueCount}>🧭 Clues found: 0 / 6</div>
            <button className={styles.journalBtn} onClick={() => setJournalOpen(o => !o)}>📖 Journal ({journalEntries.length})</button>
          </div>
          <div ref={compassRef} className={styles.compass}>
            <div className={styles.compassFace}>
              <span className={`${styles.compassTick} ${styles.compassN}`}>N</span>
              <span className={`${styles.compassTick} ${styles.compassE}`}>E</span>
              <span className={`${styles.compassTick} ${styles.compassS}`}>S</span>
              <span className={`${styles.compassTick} ${styles.compassW}`}>W</span>
              <div ref={compassArrowRef} className={styles.compassNeedle} />
              <div className={styles.compassHub} />
            </div>
            <span ref={compassDistRef} className={styles.compassDist}>—</span>
          </div>
          <div ref={bannerRef} className={styles.banner} />
          <div ref={controlsHintRef} className={styles.controlsHint}>WASD / Arrow keys to walk — waddle up to a glowing spot to search it</div>

          {journalOpen && (
            <div className={styles.journalPanel}>
              <div className={styles.journalHead}>
                <span>📖 Ship's Log</span>
                <button onClick={() => setJournalOpen(false)}>✕</button>
              </div>
              {journalEntries.length === 0 && <p className={styles.journalEmpty}>No clues found yet — go explore!</p>}
              <ul className={styles.journalList}>
                {journalEntries.map((j, i) => (
                  <li key={i}><b>{j.emoji} {j.name}:</b> {j.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {phase === 'intro' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <div className={styles.emojiRow}>🏴‍☠️ 🗺️ 💰</div>
            <h1 className={styles.title}>X Marks the Spot</h1>
            <p className={styles.tagline}>A Pirate's Clue Hunt</p>
            <p className={styles.story}>
              You've washed up on a lonely island with nothing but a shovel, a compass, and a hunch.
              Somewhere in the sand and jungle, a message in a bottle is waiting to start you off. Each
              clue you find points the way to the next — follow your compass, follow the whole trail, and
              the last clue will lead you straight to buried treasure. The island reshuffles every time, so
              the trail's never the same twice.
            </p>
            <div className={styles.controls}>
              <span><b>Move</b> — WASD or Arrow Keys</span>
              <span><b>Search</b> — just walk up to a glowing spot</span>
            </div>
            <button className={styles.startButton} onClick={startGame}>Wash Ashore →</button>
          </div>
        </div>
      )}

      {phase === 'win' && winStats && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <div className={styles.emojiRow}>🏆 💰 🏴‍☠️</div>
            <h1 className={styles.title}>X Marked the Spot!</h1>
            <p className={styles.story}>You dug up the treasure! Not bad for a landlubber.</p>
            <div className={styles.statsList}>
              <div>Clues followed: <b>{winStats.clues}</b></div>
              <div>Time to treasure: <b>{winStats.time}s</b></div>
            </div>
            <button className={styles.startButton} onClick={startGame}>Bury It Again →</button>
          </div>
        </div>
      )}
    </div>
  )
}
