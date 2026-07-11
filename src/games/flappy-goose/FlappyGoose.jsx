import { useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import styles from './FlappyGoose.module.css'

// ── Fixed constants ──────────────────────────────────────────────────
const GRAVITY    = 0.44
const FLAP_VEL   = -8.8
const PIPE_W     = 54
const PIPE_SPEED = 2.7
const GROUND_H   = 68
const GOOSE_X    = 92

// ── Skins ────────────────────────────────────────────────────────────
// WH=body, WG=wing shade, TG=tail, HR=hat red, DR=hat dark red,
// HW=hat stripe, PR=prop blade 1, PB=prop blade 2, HH=hub, BK=outline
const SKINS = [
  { id:'classic', name:'Classic',       unlockScore:0,
    colors:{ WH:'#f4f4f4', WG:'#d0d0d0', TG:'#e4e4e4', HR:'#cc1111', DR:'#881111', HW:'#f5f5f5', PR:'#FF3333', PB:'#3366ff', HH:'#888888', BK:'#1a1a1a' } },
  { id:'navy',    name:'Sailor Blue',   unlockScore:5,
    colors:{ WH:'#88bbf8', WG:'#5588d8', TG:'#aacfff', HR:'#1144cc', DR:'#003388', HW:'#cce0ff', PR:'#ff6633', PB:'#ffcc00', HH:'#334477', BK:'#0a1a3a' } },
  { id:'gold',    name:'Golden Goose',  unlockScore:10,
    colors:{ WH:'#f5d060', WG:'#dba820', TG:'#f8dc80', HR:'#996600', DR:'#664400', HW:'#fff0a0', PR:'#cc2200', PB:'#0044cc', HH:'#cc9900', BK:'#3a2a00' } },
  { id:'lava',    name:'Lava Goose',    unlockScore:20,
    colors:{ WH:'#ff7744', WG:'#ee4422', TG:'#ff9966', HR:'#330000', DR:'#110000', HW:'#ff6600', PR:'#ffee00', PB:'#ff8800', HH:'#440000', BK:'#220000' } },
  { id:'cosmic',  name:'Cosmic Goose',  unlockScore:35,
    colors:{ WH:'#9966ee', WG:'#7744cc', TG:'#bb88ff', HR:'#220044', DR:'#110022', HW:'#dd88ff', PR:'#ff44ff', PB:'#44ffff', HH:'#442266', BK:'#110022' } },
  { id:'rainbow', name:'Rainbow Goose', unlockScore:50, colors:null, rainbow:true },
]

function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100
  const c = (1 - Math.abs(2*l - 1)) * s
  const x = c * (1 - Math.abs((h/60) % 2 - 1))
  const m = l - c/2
  let r, g, b
  if      (h < 60)  { r=c; g=x; b=0 } else if (h < 120) { r=x; g=c; b=0 }
  else if (h < 180) { r=0; g=c; b=x } else if (h < 240) { r=0; g=x; b=c }
  else if (h < 300) { r=x; g=0; b=c } else               { r=c; g=0; b=x }
  const hex = v => Math.round((v+m)*255).toString(16).padStart(2,'0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function getSkinColors(skin, frame) {
  if (!skin.rainbow) return skin.colors
  const h = (frame * 3) % 360
  return { WH:hslHex(h,80,65), WG:hslHex(h+40,70,55), TG:hslHex(h+20,75,70),
           HR:hslHex(h+120,90,35), DR:hslHex(h+150,90,22), HW:'#ffffff',
           PR:hslHex(h+180,95,55), PB:hslHex(h+240,95,60), HH:'#888888', BK:'#1a1a1a' }
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ── Draw helpers ─────────────────────────────────────────────────────

function drawSky(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H - GROUND_H)
  g.addColorStop(0, '#52aad4'); g.addColorStop(1, '#b6dcf2')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H - GROUND_H)
}

function drawCloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.beginPath()
  ctx.arc(x,          y,        20*s, 0, Math.PI*2)
  ctx.arc(x + 24*s,   y - 6*s,  15*s, 0, Math.PI*2)
  ctx.arc(x + 42*s,   y + 2*s,  17*s, 0, Math.PI*2)
  ctx.arc(x + 18*s,   y + 9*s,  12*s, 0, Math.PI*2)
  ctx.fill()
}

function drawGround(ctx, off, W, H) {
  const gy = H - GROUND_H
  ctx.fillStyle = '#5d8a3c'; ctx.fillRect(0, gy, W, GROUND_H)
  ctx.fillStyle = '#6db548'; ctx.fillRect(0, gy, W, 10)
  ctx.fillStyle = '#518c30'
  for (let x = -(off % 36); x < W; x += 36) ctx.fillRect(x, gy + 12, 18, 4)
  ctx.fillStyle = '#8b6340'; ctx.fillRect(0, gy + 22, W, GROUND_H - 22)
}

function drawPipe(ctx, x, gapTop, gapBottom, H) {
  const CAP = 22, EX = 7, gy = H - GROUND_H
  const bG = ctx.createLinearGradient(x, 0, x + PIPE_W, 0)
  bG.addColorStop(0,'#2a7d2a'); bG.addColorStop(0.3,'#4cc04c'); bG.addColorStop(0.7,'#3a9e3a'); bG.addColorStop(1,'#1e6b1e')
  const cG = ctx.createLinearGradient(x - EX, 0, x + PIPE_W + EX, 0)
  cG.addColorStop(0,'#1e6b1e'); cG.addColorStop(0.2,'#3a9e3a'); cG.addColorStop(0.5,'#5ed05e'); cG.addColorStop(0.8,'#3a9e3a'); cG.addColorStop(1,'#1e6b1e')
  ctx.fillStyle = bG; ctx.fillRect(x, 0, PIPE_W, gapTop - CAP)
  ctx.fillStyle = cG; ctx.fillRect(x - EX, gapTop - CAP, PIPE_W + EX*2, CAP)
  ctx.fillStyle = bG; ctx.fillRect(x, gapBottom + CAP, PIPE_W, gy - gapBottom - CAP)
  ctx.fillStyle = cG; ctx.fillRect(x - EX, gapBottom, PIPE_W + EX*2, CAP)
}

function drawGoosePixel(ctx, cx, cy, vel, propAngle, colors) {
  const P = 3
  ctx.save()
  ctx.translate(Math.round(cx), Math.round(cy))
  ctx.imageSmoothingEnabled = false
  ctx.rotate(Math.min(Math.max(vel * 0.042, -0.42), 0.82))

  function b(c, r, w, h, clr) { ctx.fillStyle = clr; ctx.fillRect(c*P, r*P, w*P, h*P) }

  const { WH, WG, TG, HR, DR, HW, PR, PB, HH, BK } = colors
  const OO = '#ff8800', DO = '#c05200'

  // Tail
  b(-9,-1,1,3,TG); b(-10,-1,2,1,TG); b(-10,0,2,1,WH); b(-10,1,2,1,TG); b(-11,0,1,1,TG)
  b(-11,-1,3,1,BK); b(-11,1,3,1,BK); b(-12,0,1,1,BK); b(-9,-2,1,4,BK)

  // Body
  b(-5,-4,10,1,BK)
  b(-5,-3,1,1,BK); b(4,-3,1,1,BK); b(-4,-3,8,1,WH)
  b(-7,-3,1,1,BK); b(-6,-3,1,1,BK); b(-7,-2,1,3,BK); b(4,-2,1,3,BK)
  b(-6,-2,10,1,WH); b(-6,-1,10,1,WH); b(-6,0,10,1,WH)
  b(-6,1,1,1,BK); b(3,1,1,1,BK); b(-5,1,8,1,WH)
  b(-4,2,1,1,BK); b(2,2,1,1,BK); b(-3,2,5,1,WH); b(-4,3,7,1,BK)
  b(-5,-1,4,2,WG)

  // Neck staircase
  b(1,-4,1,1,BK); b(4,-4,1,1,BK); b(2,-4,2,1,WH)
  b(2,-5,1,1,BK); b(5,-5,1,1,BK); b(3,-5,2,1,WH)
  b(3,-6,1,1,BK); b(6,-6,1,1,BK); b(4,-6,2,1,WH)
  b(4,-7,1,1,BK); b(7,-7,1,1,BK); b(5,-7,2,1,WH)

  // Head
  b(4,-13,7,1,BK); b(3,-12,1,4,BK); b(11,-12,1,4,BK); b(4,-8,7,1,BK)
  b(4,-12,7,1,WH); b(4,-11,7,1,WH); b(4,-10,7,1,WH); b(4,-9,7,1,WH)
  b(6,-11,2,2,'#080808'); b(7,-12,1,1,'#ffffff')

  // Beak
  b(11,-12,4,1,DO); b(11,-11,5,1,OO); b(15,-11,1,1,DO)
  b(11,-10,4,1,OO); b(14,-10,1,1,DO); b(11,-9,1,1,BK)

  // Hat
  b(3,-14,9,1,DR); b(4,-17,7,3,HR); b(4,-15,7,1,HW)
  b(3,-17,1,3,DR); b(10,-17,1,3,DR); b(3,-18,9,1,BK)

  // Feet
  b(-2,4,2,2,OO); b(2,4,2,2,OO); b(-4,6,5,1,OO); b(2,6,4,1,OO)
  b(-5,6,1,1,DO); b(5,6,1,1,DO)

  // Propeller
  ctx.save()
  ctx.translate(7*P, -19*P); ctx.rotate(propAngle); ctx.imageSmoothingEnabled = false
  ctx.fillStyle = PR; ctx.fillRect(2*P,-P,6*P,2*P)
  ctx.fillStyle = PB; ctx.fillRect(-7*P,-P,6*P,2*P)
  ctx.fillStyle = HH; ctx.fillRect(-P,-P,3*P,2*P)
  ctx.fillStyle = BK; ctx.fillRect(0,0,P,P)
  ctx.restore()
  ctx.restore()
}

function uiText(ctx, text, x, y, size, color, shadowA = 0.38) {
  ctx.font = `bold ${size}px 'Arial Black', Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillStyle = `rgba(0,0,0,${shadowA})`; ctx.fillText(text, x + 3, y + 3)
  ctx.fillStyle = color; ctx.fillText(text, x, y)
}

// ── Component ─────────────────────────────────────────────────────────

export default function FlappyGoose() {
  const canvasRef   = useRef(null)
  const rafRef      = useRef(null)
  const highRef     = useRef(0)
  const sizeRef     = useRef({ w: window.innerWidth, h: window.innerHeight })
  const skinIdxRef  = useRef(0)
  const unlockedRef = useRef(['classic'])

  const gameRef = useRef({
    state: 'idle', y: window.innerHeight / 2, vel: 0,
    propAngle: 0, propSpeed: 0.07,
    pipes: [], score: 0, frame: 0, groundOff: 0,
    flashTimer: 0, newUnlock: null, bannerTimer: 0,
    clouds: [],
  })

  // Load persisted data
  useEffect(() => {
    try {
      highRef.current = parseInt(localStorage.getItem('flappyGooseHigh') || '0')
      const skins = JSON.parse(localStorage.getItem('flappyGooseSkins') || '["classic"]')
      unlockedRef.current = Array.isArray(skins) ? skins : ['classic']
      const savedId = localStorage.getItem('flappyGooseSkin')
      const idx = SKINS.findIndex(s => s.id === savedId && unlockedRef.current.includes(s.id))
      if (idx >= 0) skinIdxRef.current = idx
    } catch {}
  }, [])

  // Full-screen canvas + resize
  useEffect(() => {
    const canvas = canvasRef.current
    function resize() {
      const w = window.innerWidth, h = window.innerHeight
      canvas.width = w; canvas.height = h
      sizeRef.current = { w, h }
      const g = gameRef.current
      if (g.state !== 'playing') g.y = h / 2
      g.clouds = Array.from({ length: 8 }, (_, i) => ({
        x: (i / 7) * w + randInt(-30, 30),
        y: randInt(40, Math.round(h * 0.36)),
        spd: 0.18 + Math.random() * 0.3,
        s: 0.7 + Math.random() * 0.6,
      }))
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function prevSkin() {
    const unl = unlockedRef.current
    let idx = skinIdxRef.current, tries = SKINS.length
    do { idx = (idx - 1 + SKINS.length) % SKINS.length; tries-- } while (!unl.includes(SKINS[idx].id) && tries > 0)
    skinIdxRef.current = idx
    try { localStorage.setItem('flappyGooseSkin', SKINS[idx].id) } catch {}
  }

  function nextSkin() {
    const unl = unlockedRef.current
    let idx = skinIdxRef.current, tries = SKINS.length
    do { idx = (idx + 1) % SKINS.length; tries-- } while (!unl.includes(SKINS[idx].id) && tries > 0)
    skinIdxRef.current = idx
    try { localStorage.setItem('flappyGooseSkin', SKINS[idx].id) } catch {}
  }

  const flap = useCallback(() => {
    const g = gameRef.current
    const { h: H } = sizeRef.current
    if (g.state === 'idle') {
      g.state = 'playing'; g.vel = FLAP_VEL; g.propSpeed = 0.32
    } else if (g.state === 'playing') {
      g.vel = FLAP_VEL; g.propSpeed = 0.32
    } else if (g.state === 'dead' && g.flashTimer <= 0) {
      Object.assign(g, {
        state: 'idle', y: H / 2, vel: 0, pipes: [], score: 0,
        frame: 0, groundOff: 0, propSpeed: 0.07, flashTimer: 0,
        newUnlock: null, bannerTimer: 0,
      })
    }
  }, [])

  const handleClick = useCallback((e) => {
    const g = gameRef.current
    const { w: W } = sizeRef.current
    if (g.state === 'idle') {
      if (e.clientX < W * 0.18) { prevSkin(); return }
      if (e.clientX > W * 0.82) { nextSkin(); return }
    }
    flap()
  }, [flap])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function die(g) {
      if (g.state === 'dead') return
      g.state = 'dead'; g.flashTimer = 14; g.vel = -4
      if (g.score > highRef.current) {
        highRef.current = g.score
        try { localStorage.setItem('flappyGooseHigh', String(g.score)) } catch {}
      }
    }

    function step() {
      const g = gameRef.current
      const { w: W, h: H } = sizeRef.current
      const gy        = H - GROUND_H
      const PIPE_GAP  = Math.round(H * 0.27)
      const PIPE_SPAWN = Math.round(285 / PIPE_SPEED)
      const PIPE_MIN  = Math.round(H * 0.10)
      const PIPE_MAX  = gy - PIPE_GAP - PIPE_MIN

      // Update
      if (g.state === 'playing') {
        g.vel = Math.min(g.vel + GRAVITY, 11); g.y += g.vel
        g.frame++; g.groundOff += PIPE_SPEED
        g.propSpeed = Math.max(0.07, g.propSpeed - 0.003)
        if (g.bannerTimer > 0) g.bannerTimer--

        if (g.frame % PIPE_SPAWN === 0)
          g.pipes.push({ x: W + 14, gapTop: randInt(PIPE_MIN, PIPE_MAX), scored: false })

        for (let i = g.pipes.length - 1; i >= 0; i--) {
          const p = g.pipes[i]
          p.x -= PIPE_SPEED
          if (!p.scored && p.x + PIPE_W < GOOSE_X) {
            p.scored = true; g.score++
            const sk = SKINS.find(s => s.unlockScore === g.score && !unlockedRef.current.includes(s.id))
            if (sk) {
              unlockedRef.current = [...unlockedRef.current, sk.id]
              try { localStorage.setItem('flappyGooseSkins', JSON.stringify(unlockedRef.current)) } catch {}
              g.newUnlock = sk; g.bannerTimer = 150
            }
          }
          if (p.x < -PIPE_W - 20) { g.pipes.splice(i, 1); continue }
          const HIT = 11, pL = p.x - 7, pR = p.x + PIPE_W + 7
          if (GOOSE_X + HIT > pL && GOOSE_X - HIT < pR)
            if (g.y - HIT < p.gapTop || g.y + HIT > p.gapTop + PIPE_GAP) { die(g); break }
        }

        if (g.y + 18 >= gy) die(g)
        if (g.y - 58 <= 0)  die(g)

      } else if (g.state === 'dead') {
        if (g.y < gy) { g.vel = Math.min(g.vel + GRAVITY, 11); g.y = Math.min(g.y + g.vel, gy - 1) }
        g.propSpeed = Math.max(0.01, g.propSpeed - 0.002)
        if (g.flashTimer > 0) g.flashTimer--
      } else {
        g.y = H/2 + Math.sin(Date.now()/450) * 8
        g.propSpeed = 0.07 + 0.03 * Math.abs(Math.sin(Date.now()/700))
      }

      g.propAngle += g.propSpeed
      if (g.state === 'playing')
        for (const c of g.clouds) { c.x -= c.spd; if (c.x < -90) c.x = W + 90 }

      // Draw
      ctx.imageSmoothingEnabled = false
      const skin   = SKINS[skinIdxRef.current] || SKINS[0]
      const colors = getSkinColors(skin, g.frame)

      drawSky(ctx, W, H)
      for (const c of g.clouds) drawCloud(ctx, c.x, c.y, c.s)
      for (const p of g.pipes)  drawPipe(ctx, p.x, p.gapTop, p.gapTop + PIPE_GAP, H)
      drawGround(ctx, g.groundOff, W, H)

      if (g.state === 'dead' && g.flashTimer > 0) {
        ctx.fillStyle = `rgba(255,255,255,${g.flashTimer/14})`; ctx.fillRect(0, 0, W, H)
      }

      drawGoosePixel(ctx, GOOSE_X, g.y, g.vel, g.propAngle, colors)

      // Score HUD
      if (g.state === 'playing') uiText(ctx, g.score, W/2, 56, 46, '#ffffff')

      // Unlock banner (in-game)
      if (g.bannerTimer > 0 && g.newUnlock) {
        const a = Math.min(1, g.bannerTimer/20) * Math.min(1, (150 - g.bannerTimer + 20)/20)
        ctx.fillStyle = `rgba(0,0,0,${0.72*a})`
        ctx.fillRect(W/2 - 190, 12, 380, 48)
        ctx.font = 'bold 15px Arial Black, Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255,215,0,${a})`
        ctx.fillText(`🔓  Unlocked: ${g.newUnlock.name}!`, W/2, 42)
      }

      // Idle screen
      if (g.state === 'idle') {
        uiText(ctx, 'FLAPPY', W/2, H/2 - 92, 52, '#ffffff', 0.35)
        uiText(ctx, 'GOOSE',  W/2, H/2 - 42, 52, '#FFD700', 0.45)
        ctx.font = '17px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillText('🪿  propeller-powered adventure', W/2+1, H/2-3)
        ctx.fillStyle = '#ffffff';           ctx.fillText('🪿  propeller-powered adventure', W/2,   H/2-4)
        if (highRef.current > 0) {
          ctx.font = 'bold 19px Arial'; ctx.textAlign = 'center'
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillText(`Best: ${highRef.current}`, W/2+1, H/2+25)
          ctx.fillStyle = '#FFD700'; ctx.fillText(`Best: ${highRef.current}`, W/2, H/2+24)
        }
        const pulse = 0.55 + 0.45 * Math.sin(Date.now()/480)
        ctx.font = '15px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255,255,255,${pulse})`
        ctx.fillText('tap / click / space  to start', W/2, H/2+56)

        // Skin selector
        const selY = H/2 + 112
        const activeSkin = SKINS[skinIdxRef.current] || SKINS[0]
        const unl = unlockedRef.current
        ctx.fillStyle = 'rgba(0,0,0,0.44)'
        ctx.fillRect(W/2 - 150, selY - 30, 300, 54)
        ctx.font = '11px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.fillText('SKIN  (◀ / ▶ to change)', W/2, selY - 16)
        ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillText('◀', W/2 - 116, selY + 12)
        ctx.fillText('▶', W/2 + 116, selY + 12)
        ctx.font = 'bold 17px Arial Black, Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillText(activeSkin.name, W/2+1, selY+13)
        ctx.fillStyle = colors.WH || '#ffffff'; ctx.fillText(activeSkin.name, W/2, selY+12)

        // Next unlock hint
        const nextSk = SKINS.find(s => !unl.includes(s.id))
        if (nextSk) {
          ctx.font = '12px Arial'; ctx.textAlign = 'center'
          ctx.fillStyle = 'rgba(255,255,255,0.38)'
          ctx.fillText(`Score ${nextSk.unlockScore} → ${nextSk.name}`, W/2, selY + 34)
        }

        // Progress dots
        const dotY = selY + 54
        const spacing = 20
        const startDotX = W/2 - ((SKINS.length-1) * spacing) / 2
        for (let i = 0; i < SKINS.length; i++) {
          const unlocked = unl.includes(SKINS[i].id)
          const selected = i === skinIdxRef.current
          ctx.beginPath()
          ctx.arc(startDotX + i*spacing, dotY, selected ? 5.5 : 3.5, 0, Math.PI*2)
          ctx.fillStyle = unlocked ? (selected ? '#FFD700' : 'rgba(255,255,255,0.72)') : 'rgba(255,255,255,0.2)'
          ctx.fill()
        }
      }

      // Dead screen
      if (g.state === 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.46)'; ctx.fillRect(0, 0, W, H)
        uiText(ctx, 'HONK!', W/2, H/2 - 78, 62, '#FF6B00', 0.5)
        uiText(ctx, `Score: ${g.score}`, W/2, H/2 - 12, 38, '#ffffff')
        if (g.newUnlock) {
          uiText(ctx, `🔓 ${g.newUnlock.name} unlocked!`, W/2, H/2 + 28, 21, '#FFD700', 0.25)
        } else if (g.score > 0 && g.score >= highRef.current) {
          uiText(ctx, '🏆 New Record!', W/2, H/2 + 28, 22, '#FFD700', 0.3)
        } else {
          uiText(ctx, `Best: ${highRef.current}`, W/2, H/2 + 28, 22, '#cccc88', 0.25)
        }
        const next = SKINS.find(s => !unlockedRef.current.includes(s.id))
        if (next) {
          ctx.font = '13px Arial'; ctx.textAlign = 'center'
          ctx.fillStyle = 'rgba(255,255,255,0.44)'
          ctx.fillText(`Score ${next.unlockScore} to unlock ${next.name}`, W/2, H/2 + 58)
        }
        const p2 = 0.5 + 0.5 * Math.sin(Date.now()/520)
        ctx.font = '15px Arial'; ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255,255,255,${p2})`
        ctx.fillText('tap to try again', W/2, H/2 + 82)
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap() }
      if (e.code === 'ArrowLeft'  && gameRef.current.state === 'idle') prevSkin()
      if (e.code === 'ArrowRight' && gameRef.current.state === 'idle') nextSkin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

  useEffect(() => {
    const canvas = canvasRef.current
    function onTouch(e) {
      e.preventDefault()
      const touch = e.touches[0]
      if (!touch) return
      const g = gameRef.current
      const { w: W } = sizeRef.current
      if (g.state === 'idle') {
        if (touch.clientX < W * 0.18) { prevSkin(); return }
        if (touch.clientX > W * 0.82) { nextSkin(); return }
      }
      flap()
    }
    canvas.addEventListener('touchstart', onTouch, { passive: false })
    return () => canvas.removeEventListener('touchstart', onTouch)
  }, [flap])

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} onClick={handleClick} />
      <Link to="/" className={styles.homeLink}>← GameHub</Link>
    </div>
  )
}
