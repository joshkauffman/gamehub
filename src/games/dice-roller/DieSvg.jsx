import styles from './DiceRoller.module.css'

const SIZE = 72
const C = SIZE / 2
const COLORS = {
  4:  { fill: '#e8521a', stroke: '#c44010' },
  6:  { fill: '#6c63ff', stroke: '#4a44cc' },
  8:  { fill: '#10b981', stroke: '#0a8f63' },
  10: { fill: '#f5a623', stroke: '#c97e0e' },
  12: { fill: '#ec4899', stroke: '#c0277a' },
  20: { fill: '#3b82f6', stroke: '#1d5fb8' },
}

function polyPoints(n, r, cx, cy, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2 + offset
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  }).join(' ')
}

// d6 pips layout: positions for 1–6
const PIP_LAYOUTS = {
  1: [[C, C]],
  2: [[C - 14, C - 14], [C + 14, C + 14]],
  3: [[C - 14, C - 14], [C, C], [C + 14, C + 14]],
  4: [[C - 14, C - 14], [C + 14, C - 14], [C - 14, C + 14], [C + 14, C + 14]],
  5: [[C - 14, C - 14], [C + 14, C - 14], [C, C], [C - 14, C + 14], [C + 14, C + 14]],
  6: [[C - 14, C - 14], [C + 14, C - 14], [C - 14, C], [C + 14, C], [C - 14, C + 14], [C + 14, C + 14]],
}

function D6({ value, rolling }) {
  const pips = PIP_LAYOUTS[value] || []
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={`${styles.dieSvg}${rolling ? ' ' + styles.rolling : ''}`}>
      <rect x={6} y={6} width={SIZE - 12} height={SIZE - 12} rx={10}
        fill="#6c63ff" stroke="#4a44cc" strokeWidth={2} />
      {pips.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={5} fill="#fff" />
      ))}
    </svg>
  )
}

function PolyDie({ sides, value, rolling }) {
  const col = COLORS[sides] || { fill: '#888', stroke: '#555' }
  let shape = null
  const r = SIZE / 2 - 7

  if (sides === 4) {
    // equilateral triangle, shifted down slightly
    const pts = polyPoints(3, r, C, C + 5)
    shape = <polygon points={pts} fill={col.fill} stroke={col.stroke} strokeWidth={2} />
  } else if (sides === 8) {
    const pts = polyPoints(8, r, C, C)
    shape = <polygon points={pts} fill={col.fill} stroke={col.stroke} strokeWidth={2} />
  } else if (sides === 10) {
    // two pentagons offset by 36deg to make a d10 diamond look
    const pts1 = polyPoints(5, r, C, C, 0)
    const pts2 = polyPoints(5, r * 0.6, C, C, Math.PI / 5)
    shape = (
      <>
        <polygon points={pts1} fill={col.fill} stroke={col.stroke} strokeWidth={2} />
        <polygon points={pts2} fill="none" stroke={col.stroke} strokeWidth={1} strokeOpacity={0.4} />
      </>
    )
  } else if (sides === 12) {
    const pts = polyPoints(12, r, C, C)
    shape = <polygon points={pts} fill={col.fill} stroke={col.stroke} strokeWidth={2} />
  } else if (sides === 20) {
    // triangle with inner triangle (icosahedron face look)
    const pts1 = polyPoints(3, r, C, C + 4)
    const pts2 = polyPoints(3, r * 0.5, C, C + 4, Math.PI)
    shape = (
      <>
        <polygon points={pts1} fill={col.fill} stroke={col.stroke} strokeWidth={2} />
        <polygon points={pts2} fill="none" stroke={col.stroke} strokeWidth={1.5} strokeOpacity={0.5} />
      </>
    )
  } else {
    // generic polygon for custom sides
    const n = Math.min(sides, 12)
    const pts = polyPoints(n, r, C, C)
    shape = <polygon points={pts} fill={col.fill} stroke={col.stroke} strokeWidth={2} />
  }

  const fontSize = value >= 100 ? 13 : value >= 10 ? 17 : 20

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={`${styles.dieSvg}${rolling ? ' ' + styles.rolling : ''}`}>
      {shape}
      <text x={C} y={C + fontSize * 0.38} textAnchor="middle"
        fill="#fff" fontSize={fontSize} fontWeight="800"
        fontFamily="'Segoe UI', system-ui, sans-serif"
        style={{ userSelect: 'none' }}>
        {value}
      </text>
    </svg>
  )
}

export default function DieSvg({ sides, value, rolling }) {
  if (sides === 6) return <D6 value={value} rolling={rolling} />
  return <PolyDie sides={sides} value={value} rolling={rolling} />
}
