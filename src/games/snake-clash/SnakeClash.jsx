import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import styles from './SnakeClash.module.css'

// ── Constants ─────────────────────────────────────────────────────────
const ARENA     = 4000
const FOOD_N    = 260
const SPD       = 2.8
const SPD_BST   = 5.2
const TURN      = 0.065
const BST_DRAIN = 0.2   // length lost per boosting frame

// ── Snake palettes ─────────────────────────────────────────────────────
// b = body dark, h = body light/highlight, o = outline
const PAL = [
  { b:'#CC2200', h:'#FF5533', o:'#881100', name:'You'     },  // 0 player
  { b:'#0044BB', h:'#3377FF', o:'#002277', name:'Kraken'  },  // 1
  { b:'#007722', h:'#22CC55', o:'#004411', name:'Yabuc'   },  // 2
  { b:'#771199', h:'#BB44EE', o:'#440066', name:'Chiplus' },  // 3
  { b:'#BB6600', h:'#FFBB22', o:'#774400', name:'edik_k'  },  // 4
  { b:'#BB1155', h:'#FF4488', o:'#770033', name:'shipilov'},  // 5
  { b:'#005577', h:'#1199BB', o:'#003344', name:'SolenA'  },  // 6
  { b:'#AA4400', h:'#FF7733', o:'#662200', name:'Minivan' },  // 7
  { b:'#111122', h:'#334466', o:'#000000', name:'BOSS'    },  // 8
]

const FRUITS = ['🍎','🍌','🍉','🍓','🍇','🍑','🍊','🍋','🍒','🥝','🍍','🍈']

// ── Helpers ───────────────────────────────────────────────────────────

function adiff(a, b) {
  return ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI
}

function segR(snake) {
  return Math.min(9 + Math.floor(snake.segs.length / 55) * 1.3, 22)
}

function mkFood(n) {
  return Array.from({ length: n }, () => ({
    x: 120 + Math.random() * (ARENA - 240),
    y: 120 + Math.random() * (ARENA - 240),
    emoji: FRUITS[Math.floor(Math.random() * FRUITS.length)],
    pts: 10 + Math.floor(Math.random() * 20),
    r: 18,
  }))
}

function mkSnake({ player, boss, ci, x, y, len, score = 0 }) {
  const a = Math.random() * Math.PI * 2
  return {
    segs: Array.from({ length: len }, (_, i) => ({
      x: x - Math.cos(a) * i * SPD,
      y: y - Math.sin(a) * i * SPD,
    })),
    angle: a, ci,
    player: !!player, boss: !!boss,
    name: player ? 'You' : boss ? 'BOSS' : PAL[ci].name,
    alive: true, tlen: len, score,
    wangle: a, wtimer: 0, respawn: 0,
  }
}

function mkState() {
  const mid = ARENA / 2
  const snakes = [
    mkSnake({ player:true, ci:0, x:mid, y:mid, len:30, score:0 }),
    ...Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2
      const d = 500 + Math.random() * 700
      const len = 80 + Math.floor(Math.random() * 280)
      return mkSnake({ ci:i+1, x:mid+Math.cos(a)*d, y:mid+Math.sin(a)*d, len, score:len*2 })
    }),
    mkSnake({ boss:true, ci:8, x:mid+800, y:mid-600, len:700, score:1400 }),
  ]
  return {
    snakes, foods: mkFood(FOOD_N),
    camX: mid, camY: mid,
    timer: 180, lastSec: Date.now(),
    dead: false, deadT: 0, over: false, frame: 0,
  }
}

// ── Draw helpers ──────────────────────────────────────────────────────

function drawWater(ctx, camX, camY, W, H, frame) {
  // Fill visible arena slice + small margin
  ctx.fillStyle = '#5BC8F0'
  ctx.fillRect(0, 0, ARENA, ARENA)
  // Animated wave lines (only in visible window)
  const t = frame * 0.6
  const x0 = Math.max(0, camX - W / 2 - 20)
  const x1 = Math.min(ARENA, camX + W / 2 + 20)
  const y0 = Math.floor(Math.max(0, camY - H / 2 - 80) / 80) * 80
  const y1 = Math.min(ARENA, camY + H / 2 + 80)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 1.5
  for (let row = y0; row <= y1; row += 80) {
    ctx.beginPath()
    for (let x = x0; x <= x1; x += 10) {
      const y = row + Math.sin((x + t) * 0.038) * 7 + Math.sin((x - t*0.6) * 0.022) * 4
      if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

function drawFood(ctx, f) {
  ctx.font = '24px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(f.emoji, f.x, f.y)
}

function drawSnakeBody(ctx, snake, W, H, camX, camY) {
  if (!snake.alive || snake.segs.length < 2) return
  const { segs, ci } = snake
  const pal = PAL[ci]
  const r = segR(snake)
  ctx.lineWidth = 1.5
  for (let i = segs.length - 1; i >= 1; i--) {
    const s = segs[i]
    const sx = s.x - camX + W * 0.5
    const sy = s.y - camY + H * 0.5
    if (sx < -r * 3 || sx > W + r * 3 || sy < -r * 3 || sy > H + r * 3) continue
    ctx.fillStyle = (i % 2 === 0) ? pal.b : pal.h
    ctx.strokeStyle = pal.o
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()
  }
}

function drawSnakeHead(ctx, snake) {
  if (!snake.alive || !snake.segs.length) return
  const { segs, ci, angle, name, player, boss, score } = snake
  const pal = PAL[ci]
  const head = segs[0]
  const r = segR(snake)

  ctx.fillStyle = pal.h
  ctx.strokeStyle = pal.o
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(head.x, head.y, r * 1.25, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Eyes
  const eR = r * 0.33, eDist = r * 0.72
  for (const side of [-1, 1]) {
    const ex = head.x + Math.cos(angle + side * 1.15) * eDist
    const ey = head.y + Math.sin(angle + side * 1.15) * eDist
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(ex, ey, eR, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(ex + Math.cos(angle) * eR * 0.35, ey + Math.sin(angle) * eR * 0.35, eR * 0.55, 0, Math.PI * 2)
    ctx.fill()
  }

  // Name + score badge above head
  const labelY = head.y - r * 3.2
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label     = boss ? '👑 BOSS' : name
  const scoreStr  = String(score)
  ctx.font = 'bold 12px Arial'
  const tw = Math.max(ctx.measureText(label).width, ctx.measureText(scoreStr).width) + 14
  ctx.fillStyle = 'rgba(0,0,0,0.58)'
  ctx.fillRect(head.x - tw / 2, labelY - 15, tw, 30)
  ctx.fillStyle = boss ? '#ffdd44' : player ? '#ffffaa' : '#ffffff'
  ctx.fillText(label, head.x, labelY - 5)
  ctx.font = '11px Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText(scoreStr, head.x, labelY + 9)
  ctx.restore()
}

// ── Component ─────────────────────────────────────────────────────────

export default function SnakeClash() {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const mouseRef  = useRef({ x: 0, y: 0 })
  const boostRef  = useRef(false)
  const sizeRef   = useRef({ w: window.innerWidth, h: window.innerHeight })
  const stateRef  = useRef(null)

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    function onResize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight }
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Input
  useEffect(() => {
    const canvas = canvasRef.current
    const onMove     = e => { mouseRef.current = { x: e.clientX, y: e.clientY } }
    const onDown     = () => { boostRef.current = true }
    const onUp       = () => { boostRef.current = false }
    const onKey      = e => { if (e.code === 'Space') { e.preventDefault(); boostRef.current = true } }
    const onKeyUp    = e => { if (e.code === 'Space') boostRef.current = false }
    const onTouchMv  = e => {
      if (e.touches[0]) mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('touchmove',  onTouchMv,  { passive: true })
    canvas.addEventListener('touchstart', onDown,      { passive: true })
    canvas.addEventListener('touchend',   onUp,        { passive: true })
    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('touchmove', onTouchMv)
      canvas.removeEventListener('touchstart', onDown)
      canvas.removeEventListener('touchend', onUp)
    }
  }, [])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    stateRef.current = mkState()

    function nearestFood(hx, hy, range, foods) {
      const r2 = range * range
      let best = null, bd = r2
      for (const f of foods) {
        const d = (f.x - hx) ** 2 + (f.y - hy) ** 2
        if (d < bd) { best = f; bd = d }
      }
      return best
    }

    function killSnake(g, sn) {
      if (!sn.alive) return
      sn.alive = false
      for (let k = 0; k < sn.segs.length; k += 3) {
        g.foods.push({
          x: sn.segs[k].x, y: sn.segs[k].y,
          emoji: FRUITS[Math.floor(Math.random() * FRUITS.length)],
          pts: 15, r: 18,
        })
      }
      if (sn.player) { g.dead = true; g.deadT = 210 }
      else sn.respawn = 200 + Math.floor(Math.random() * 160)
    }

    function spawnFood() {
      return {
        x: 120 + Math.random() * (ARENA - 240),
        y: 120 + Math.random() * (ARENA - 240),
        emoji: FRUITS[Math.floor(Math.random() * FRUITS.length)],
        pts: 10 + Math.floor(Math.random() * 20), r: 18,
      }
    }

    function step() {
      const g = stateRef.current
      if (!g) { rafRef.current = requestAnimationFrame(step); return }
      const { w: W, h: H } = sizeRef.current
      g.frame++

      // Countdown
      const now = Date.now()
      if (now - g.lastSec >= 1000 && !g.over && !g.dead) {
        g.timer = Math.max(0, g.timer - 1)
        g.lastSec = now
        if (g.timer === 0) g.over = true
      }

      // Dead → auto restart
      if (g.dead) {
        g.deadT--
        if (g.deadT <= 0) {
          stateRef.current = mkState()
          rafRef.current = requestAnimationFrame(step)
          return
        }
      }

      if (!g.over && !g.dead) {
        // Respawn dead AI
        for (const sn of g.snakes) {
          if (!sn.alive && !sn.player) {
            sn.respawn--
            if (sn.respawn <= 0) {
              const a = Math.random() * Math.PI * 2
              const d = 800 + Math.random() * 500
              const sx = ARENA/2 + Math.cos(a)*d, sy = ARENA/2 + Math.sin(a)*d
              sn.segs  = Array.from({ length: 60 }, (_, i) => ({ x: sx-Math.cos(a)*i*SPD, y: sy-Math.sin(a)*i*SPD }))
              sn.tlen  = 60; sn.score = 120; sn.angle = a; sn.alive = true
            }
          }
        }

        // Update each alive snake
        for (const sn of g.snakes) {
          if (!sn.alive) continue
          const head     = sn.segs[0]
          const boosting = sn.player && boostRef.current && sn.segs.length > 40
          let ta = sn.angle

          if (sn.player) {
            const dx = mouseRef.current.x - W / 2
            const dy = mouseRef.current.y - H / 2
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ta = Math.atan2(dy, dx)
          } else {
            // Wander with food seeking and edge avoidance
            sn.wtimer--
            if (sn.wtimer <= 0) {
              sn.wangle += (Math.random() - 0.5) * 1.4
              sn.wtimer  = 20 + Math.floor(Math.random() * 60)
            }
            ta = sn.wangle
            const f = nearestFood(head.x, head.y, sn.boss ? 280 : 190, g.foods)
            if (f) ta = Math.atan2(f.y - head.y, f.x - head.x)
            const M = 280
            if (head.x < M || head.x > ARENA-M || head.y < M || head.y > ARENA-M) {
              ta = Math.atan2(ARENA/2 - head.y, ARENA/2 - head.x)
              sn.wangle = ta
            }
          }

          // Steer
          const da = adiff(ta, sn.angle)
          sn.angle += Math.sign(da) * Math.min(Math.abs(da), TURN)

          // Move
          const spd = boosting ? SPD_BST : sn.boss ? 2.0 : SPD
          const nx  = Math.max(5, Math.min(ARENA - 5, head.x + Math.cos(sn.angle) * spd))
          const ny  = Math.max(5, Math.min(ARENA - 5, head.y + Math.sin(sn.angle) * spd))
          sn.segs.unshift({ x: nx, y: ny })
          if (boosting) sn.tlen = Math.max(30, sn.tlen - BST_DRAIN)
          while (sn.segs.length > Math.ceil(sn.tlen)) sn.segs.pop()

          // Eat food
          const er2 = (segR(sn) + 16) ** 2
          for (let i = g.foods.length - 1; i >= 0; i--) {
            const f = g.foods[i]
            if ((nx - f.x) ** 2 + (ny - f.y) ** 2 < er2) {
              sn.tlen += 12; sn.score += f.pts
              g.foods.splice(i, 1)
              g.foods.push(spawnFood())
            }
          }

          // Collision: head vs other snake bodies
          if (!sn.alive) continue
          const kr2 = (segR(sn) + 5) ** 2
          for (const other of g.snakes) {
            if (!other.alive || other === sn) continue
            let hitJ = -1
            const n = Math.min(other.segs.length, 600)
            for (let j = 0; j < n; j++) {
              const os = other.segs[j]
              if ((nx - os.x) ** 2 + (ny - os.y) ** 2 < kr2) { hitJ = j; break }
            }
            if (hitJ < 0) continue

            if (sn.score > other.score) {
              // sn is bigger — sever other at the hit point, tail becomes food
              const dropped = other.segs.splice(hitJ)
              other.tlen = other.segs.length
              for (let k = 0; k < dropped.length; k += 2) {
                g.foods.push({
                  x: dropped[k].x, y: dropped[k].y,
                  emoji: FRUITS[Math.floor(Math.random() * FRUITS.length)],
                  pts: 12, r: 18,
                })
              }
              sn.score += Math.floor(dropped.length * 2)
              sn.tlen  += Math.floor(dropped.length * 0.35)
              if (other.segs.length < 12) killSnake(g, other)
            } else {
              // sn is smaller or equal — sn dies
              killSnake(g, sn)
            }
            break
          }
        }
      }

      // Camera
      const player = g.snakes.find(sn => sn.player)
      if (player && player.alive) {
        g.camX += (player.segs[0].x - g.camX) * 0.12
        g.camY += (player.segs[0].y - g.camY) * 0.12
      }

      // ── DRAW ──────────────────────────────────────────────────────

      // Screen background (outside arena)
      ctx.fillStyle = '#1a6688'
      ctx.fillRect(0, 0, W, H)

      ctx.save()
      ctx.translate(W / 2 - g.camX, H / 2 - g.camY)

      // Water background
      drawWater(ctx, g.camX, g.camY, W, H, g.frame)

      // Arena border
      ctx.strokeStyle = 'rgba(0,80,160,0.55)'; ctx.lineWidth = 8
      ctx.strokeRect(0, 0, ARENA, ARENA)
      ctx.strokeStyle = 'rgba(0,60,130,0.25)'; ctx.lineWidth = 28
      ctx.strokeRect(-8, -8, ARENA + 16, ARENA + 16)

      // Food
      for (const f of g.foods) {
        const fx = f.x - g.camX + W / 2
        const fy = f.y - g.camY + H / 2
        if (fx < -40 || fx > W + 40 || fy < -40 || fy > H + 40) continue
        drawFood(ctx, f)
      }

      // Snake bodies (enemies first, player last = on top)
      for (const sn of g.snakes) if (sn.alive && !sn.player) drawSnakeBody(ctx, sn, W, H, g.camX, g.camY)
      if (player && player.alive) drawSnakeBody(ctx, player, W, H, g.camX, g.camY)

      // Heads on top of all bodies
      for (const sn of g.snakes) if (sn.alive && !sn.player) drawSnakeHead(ctx, sn)
      if (player && player.alive) drawSnakeHead(ctx, player)

      ctx.restore()

      // ── HUD ───────────────────────────────────────────────────────

      // Score (top left)
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(10, 10, 130, 58)
      ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffdd44'; ctx.fillText('SCORE', 20, 28)
      ctx.font = 'bold 26px Arial'; ctx.fillStyle = '#ffffff'
      ctx.fillText(player ? player.score : 0, 20, 52)

      // Leaderboard (top right)
      const alive = g.snakes.filter(sn => sn.alive).sort((a, b) => b.score - a.score)
      const lbW = 190, lbX = W - lbW - 10, lbY = 10
      const lbH = 18 + Math.min(alive.length, 8) * 24 + 6
      ctx.fillStyle = 'rgba(0,0,60,0.7)'
      ctx.fillRect(lbX, lbY, lbW, lbH)
      ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#aaddff'; ctx.fillText('LEADERBOARD', lbX + lbW / 2, lbY + 10)
      for (let i = 0; i < Math.min(alive.length, 8); i++) {
        const sn  = alive[i]
        const pal = PAL[sn.ci]
        const py  = lbY + 20 + i * 24 + 10
        if (sn.player) {
          ctx.fillStyle = 'rgba(255,100,40,0.28)'
          ctx.fillRect(lbX, py - 10, lbW, 22)
        }
        ctx.font = '11px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#888'; ctx.fillText(i + 1, lbX + 6, py)
        ctx.fillStyle = sn.boss ? '#ffdd44' : pal.h
        ctx.font = 'bold 12px Arial'
        ctx.fillText(sn.boss ? '👑 BOSS' : sn.name, lbX + 26, py)
        ctx.textAlign = 'right'; ctx.fillStyle = '#fff'
        ctx.fillText(sn.score, lbX + lbW - 6, py)
      }

      // Boost indicator (bottom left)
      const boosting = boostRef.current && player && player.alive
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(10, H - 50, 220, 40)
      ctx.font = '13px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = boosting ? '#ffcc33' : 'rgba(255,255,255,0.5)'
      ctx.fillText(boosting ? '⚡ SPEED BOOST' : 'Hold click / space to boost', 18, H - 30)

      // Timer (bottom right)
      const mins = String(Math.floor(g.timer / 60)).padStart(1, '0')
      const secs = String(g.timer % 60).padStart(2, '0')
      ctx.fillStyle = 'rgba(0,0,80,0.75)'
      ctx.fillRect(W - 110, H - 50, 100, 40)
      ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#aaddff'; ctx.fillText('TIME', W - 60, H - 42)
      ctx.font = `bold 20px Arial`
      ctx.fillStyle = g.timer < 30 ? '#ff4422' : '#ffffff'
      ctx.fillText(`${mins}:${secs}`, W - 60, H - 23)

      // Dead overlay
      if (g.dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H)
        ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#ff4422'; ctx.fillText('YOU DIED', W / 2, H / 2 - 28)
        ctx.font = '22px Arial'; ctx.fillStyle = '#fff'
        ctx.fillText('Respawning…', W / 2, H / 2 + 26)
      }

      // Game over
      if (g.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H)
        ctx.font = 'bold 54px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#FFD700'; ctx.fillText("TIME'S UP!", W / 2, H / 2 - 70)
        const top = g.snakes.filter(sn => sn.alive).sort((a, b) => b.score - a.score)[0]
        if (top) {
          const pal = PAL[top.ci]
          ctx.font = 'bold 30px Arial'; ctx.fillStyle = pal.h
          ctx.fillText(`🏆 ${top.name} wins!`, W / 2, H / 2 - 15)
          ctx.font = '22px Arial'; ctx.fillStyle = '#cccccc'
          ctx.fillText(`Score: ${top.score}`, W / 2, H / 2 + 24)
        }
        ctx.font = '17px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillText('Click to play again', W / 2, H / 2 + 68)
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  function handleClick() {
    const g = stateRef.current
    if (g && g.over) stateRef.current = mkState()
  }

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} onClick={handleClick} />
      <Link to="/" className={styles.homeLink}>← GameHub</Link>
    </div>
  )
}
