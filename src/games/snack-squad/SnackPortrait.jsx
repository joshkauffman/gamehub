import { RARITIES } from './cards.js'

// ── SnackPortrait ─────────────────────────────────────────────────────
// A little illustrated character for each card instead of a bare emoji:
// a body built from one of a handful of reusable shape "molds" (so 41
// cards stay visually consistent as one family) tinted to the real
// snack's color, a food-appropriate texture decoration, a face, and
// simple mascot limbs. Rarity adds its own aura on top — sparkle for
// epic/legendary, a soft shine for rare — independent of the food art.

const MULTI = ['#ff6b8b', '#63d4ff', '#5cff8f', '#ffd166', '#c17dff']

// Fixed (non-random) relative offsets so decorations never jitter
// between re-renders — variety without instability.
const DOT_SPOTS = [
  [-0.42, -0.35], [0.38, -0.42], [0.0, -0.05], [-0.3, 0.32], [0.34, 0.3], [-0.05, -0.55],
]

function Dots({ cx, cy, rx, ry, color }) {
  return (
    <g>
      {DOT_SPOTS.map(([dx, dy], i) => (
        <circle
          key={i}
          cx={cx + dx * rx}
          cy={cy + dy * ry}
          r={Math.max(2, Math.min(rx, ry) * 0.11)}
          fill={color === 'multi' ? MULTI[i % MULTI.length] : color}
        />
      ))}
    </g>
  )
}

function Stripes({ cx, cy, rx, ry, color }) {
  return (
    <g stroke={color} strokeWidth={Math.max(1.5, ry * 0.08)} strokeLinecap="round" opacity="0.75">
      <line x1={cx - rx * 0.55} y1={cy - ry * 0.3} x2={cx + rx * 0.55} y2={cy - ry * 0.05} />
      <line x1={cx - rx * 0.5} y1={cy + ry * 0.05} x2={cx + rx * 0.5} y2={cy + ry * 0.3} />
      <line x1={cx - rx * 0.4} y1={cy + ry * 0.42} x2={cx + rx * 0.4} y2={cy + ry * 0.6} />
    </g>
  )
}

function Drizzle({ cx, cy, rx, ry, color }) {
  const y = cy - ry * 0.35
  return (
    <path
      d={`M ${cx - rx * 0.7} ${y} Q ${cx - rx * 0.35} ${y - ry * 0.25} ${cx} ${y} Q ${cx + rx * 0.35} ${y + ry * 0.25} ${cx + rx * 0.7} ${y}`}
      stroke={color}
      strokeWidth={Math.max(2, ry * 0.1)}
      fill="none"
      strokeLinecap="round"
    />
  )
}

function Holes({ cx, cy, rx, ry }) {
  const spots = [[-0.3, -0.1], [0.25, -0.3], [0.1, 0.3]]
  return (
    <g fill="rgba(0,0,0,0.22)">
      {spots.map(([dx, dy], i) => (
        <circle key={i} cx={cx + dx * rx} cy={cy + dy * ry} r={Math.min(rx, ry) * 0.14} />
      ))}
    </g>
  )
}

function Swirl({ cx, cy, rx, ry, color }) {
  const r = Math.min(rx, ry) * 0.6
  return (
    <path
      d={`M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r * 0.6} ${r * 0.6} 0 1 1 ${-r * 1.2} 0 a ${r * 0.28} ${r * 0.28} 0 1 1 ${r * 0.56} 0`}
      stroke={color}
      strokeWidth={Math.max(1.5, r * 0.16)}
      fill="none"
      strokeLinecap="round"
    />
  )
}

function Leaf({ cx, topY }) {
  return (
    <path
      d={`M ${cx} ${topY} Q ${cx - 9} ${topY - 10} ${cx - 1} ${topY - 16} Q ${cx + 9} ${topY - 10} ${cx} ${topY}`}
      fill="#4fae5c"
      stroke="#358040"
      strokeWidth="1"
    />
  )
}

function Decoration({ type, color, cx, cy, rx, ry }) {
  if (type === 'dots') return <Dots cx={cx} cy={cy} rx={rx} ry={ry} color={color || '#00000055'} />
  if (type === 'stripes') return <Stripes cx={cx} cy={cy} rx={rx} ry={ry} color={color || 'rgba(0,0,0,0.3)'} />
  if (type === 'drizzle') return <Drizzle cx={cx} cy={cy} rx={rx} ry={ry} color={color || '#fff'} />
  if (type === 'holes') return <Holes cx={cx} cy={cy} rx={rx} ry={ry} />
  if (type === 'swirl') return <Swirl cx={cx} cy={cy} rx={rx} ry={ry} color={color || '#fff'} />
  return null
}

function Face({ cx, cy, scale = 1 }) {
  const eyeDx = 8 * scale
  return (
    <g>
      <circle cx={cx - eyeDx} cy={cy} r={4 * scale} fill="#2a2015" />
      <circle cx={cx - eyeDx + 1.1 * scale} cy={cy - 1.1 * scale} r={1.2 * scale} fill="#fff" />
      <circle cx={cx + eyeDx} cy={cy} r={4 * scale} fill="#2a2015" />
      <circle cx={cx + eyeDx + 1.1 * scale} cy={cy - 1.1 * scale} r={1.2 * scale} fill="#fff" />
      <path
        d={`M ${cx - 6 * scale} ${cy + 6.5 * scale} Q ${cx} ${cy + 10.5 * scale} ${cx + 6 * scale} ${cy + 6.5 * scale}`}
        stroke="#2a2015" strokeWidth={1.5 * scale} fill="none" strokeLinecap="round"
      />
      <circle cx={cx - 12.5 * scale} cy={cy + 3.5 * scale} r={2.4 * scale} fill="#ff8fa3" opacity="0.5" />
      <circle cx={cx + 12.5 * scale} cy={cy + 3.5 * scale} r={2.4 * scale} fill="#ff8fa3" opacity="0.5" />
    </g>
  )
}

function Limbs({ cx, cy, rx, ry, color }) {
  return (
    <g stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9">
      <path d={`M ${cx - rx + rx * 0.12} ${cy} q ${-rx * 0.35} ${ry * 0.25} ${-rx * 0.5} ${ry * 0.05}`} />
      <path d={`M ${cx + rx - rx * 0.12} ${cy} q ${rx * 0.35} ${ry * 0.25} ${rx * 0.5} ${ry * 0.05}`} />
      <path d={`M ${cx - rx * 0.35} ${cy + ry - ry * 0.06} q ${-rx * 0.08} ${ry * 0.32} ${-rx * 0.22} ${ry * 0.4}`} />
      <path d={`M ${cx + rx * 0.35} ${cy + ry - ry * 0.06} q ${rx * 0.08} ${ry * 0.32} ${rx * 0.22} ${ry * 0.4}`} />
    </g>
  )
}

function Aura({ rarity, cx, cy, r }) {
  const def = RARITIES[rarity]
  if (rarity === 'common' || rarity === 'uncommon') return null
  if (rarity === 'rare') {
    return <circle cx={cx} cy={cy} r={r * 1.08} fill="none" stroke={def.color} strokeWidth="1.5" opacity="0.35" />
  }
  // epic + legendary: soft glow disc + a few sparkle stars
  const sparkleSpots = rarity === 'legendary'
    ? [[-1.15, -0.9], [1.2, -0.7], [1.0, 0.95], [-1.1, 0.8], [0, -1.3]]
    : [[-1.1, -0.7], [1.1, -0.8], [1.0, 0.85]]
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.35} fill={def.glow} opacity="0.35" />
      {sparkleSpots.map(([dx, dy], i) => (
        <text key={i} x={cx + dx * r} y={cy + dy * r} fontSize={r * (rarity === 'legendary' ? 0.22 : 0.16)} textAnchor="middle" dominantBaseline="middle">✦</text>
      ))}
    </g>
  )
}

// Body "molds" — each returns { renderBody(), facePos:{cx,cy,scale}, bounds:{cx,cy,rx,ry} }
function buildShape(shape) {
  const cx = 50
  switch (shape) {
    case 'wide':
      return { bounds: { cx, cy: 56, rx: 34, ry: 22 }, facePos: { cx, cy: 54, scale: 1 } }
    case 'tall':
      return { bounds: { cx, cy: 52, rx: 20, ry: 32 }, facePos: { cx, cy: 46, scale: 0.9 } }
    case 'drop':
      return { bounds: { cx, cy: 58, rx: 24, ry: 24 }, facePos: { cx, cy: 58, scale: 0.95 }, drop: true }
    case 'hex':
      return { bounds: { cx, cy: 54, rx: 28, ry: 26 }, facePos: { cx, cy: 54, scale: 1 }, hex: true }
    case 'ring':
      return { bounds: { cx, cy: 54, rx: 28, ry: 28 }, facePos: { cx, cy: 54, scale: 0.85 }, ring: true }
    case 'stack2':
      return {
        bounds: { cx, cy: 66, rx: 27, ry: 17 },
        facePos: { cx, cy: 40, scale: 0.8 },
        stack: [{ cx, cy: 66, rx: 27, ry: 17 }, { cx, cy: 40, rx: 19, ry: 15 }],
      }
    case 'stack3':
      return {
        bounds: { cx, cy: 70, rx: 29, ry: 12 },
        facePos: { cx, cy: 40, scale: 0.75 },
        stack: [{ cx, cy: 70, rx: 29, ry: 12 }, { cx, cy: 55, rx: 25, ry: 11 }, { cx, cy: 40, rx: 19, ry: 10 }],
      }
    case 'round':
    default:
      return { bounds: { cx, cy: 54, rx: 28, ry: 28 }, facePos: { cx, cy: 52, scale: 1 } }
  }
}

export default function SnackPortrait({ card, size = 64, className }) {
  const art = card.art || { shape: 'round', color: RARITIES[card.rarity]?.color || '#9aa0a6', decoration: 'none' }
  const { bounds, facePos, drop, hex, ring, stack } = buildShape(art.shape)
  const auraR = Math.max(bounds.rx, bounds.ry)

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={card.name}>
      <Aura rarity={card.rarity} cx={50} cy={54} r={auraR} />

      {stack ? (
        stack.map((s, i) => (
          <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={art.color} stroke={art.accent} strokeWidth="1.5" />
        ))
      ) : hex ? (
        <polygon
          points={Array.from({ length: 6 }, (_, i) => {
            const a = (Math.PI / 3) * i - Math.PI / 2
            return `${bounds.cx + Math.cos(a) * bounds.rx},${bounds.cy + Math.sin(a) * bounds.ry}`
          }).join(' ')}
          fill={art.color}
          stroke={art.accent}
          strokeWidth="1.5"
        />
      ) : ring ? (
        <g>
          <circle cx={bounds.cx} cy={bounds.cy} r={bounds.rx} fill={art.color} stroke={art.accent} strokeWidth="1.5" />
          <circle cx={bounds.cx} cy={bounds.cy} r={bounds.rx * 0.42} fill="rgba(0,0,0,0.16)" />
        </g>
      ) : drop ? (
        <path
          d={`M ${bounds.cx} ${bounds.cy - bounds.ry * 1.15}
              C ${bounds.cx + bounds.rx * 1.05} ${bounds.cy - bounds.ry * 0.2}, ${bounds.cx + bounds.rx} ${bounds.cy + bounds.ry * 0.55}, ${bounds.cx} ${bounds.cy + bounds.ry * 0.62}
              C ${bounds.cx - bounds.rx} ${bounds.cy + bounds.ry * 0.55}, ${bounds.cx - bounds.rx * 1.05} ${bounds.cy - bounds.ry * 0.2}, ${bounds.cx} ${bounds.cy - bounds.ry * 1.15} Z`}
          fill={art.color}
          stroke={art.accent}
          strokeWidth="1.5"
        />
      ) : (
        <ellipse cx={bounds.cx} cy={bounds.cy} rx={bounds.rx} ry={bounds.ry} fill={art.color} stroke={art.accent} strokeWidth="1.5" />
      )}

      {!stack && <Decoration type={art.decoration} color={art.decorColor} cx={bounds.cx} cy={bounds.cy} rx={bounds.rx} ry={bounds.ry} />}
      {art.leaf && <Leaf cx={facePos.cx} topY={bounds.cy - bounds.ry * (drop ? 1.05 : 1)} />}

      <Limbs cx={bounds.cx} cy={bounds.cy} rx={bounds.rx} ry={bounds.ry} color={art.accent} />
      <Face cx={facePos.cx} cy={facePos.cy} scale={facePos.scale} />
    </svg>
  )
}
