import styles from './Visual.module.css'

// Small inline-SVG figures that a generated question can attach as
// `question.visual`. They draw in currentColor so they read on the dark
// question screen and print black on the worksheet.

function Angle({ degrees }) {
  const len = 90
  const rad = (degrees * Math.PI) / 180
  const cx = 20, cy = 100
  const x2 = cx + len * Math.cos(rad)
  const y2 = cy - len * Math.sin(rad)
  const r = 24
  return (
    <svg viewBox="0 0 150 120" className={styles.svg} role="img" aria-label="An angle">
      <line x1={cx} y1={cy} x2={cx + len + 20} y2={cy} className={styles.stroke} />
      <line x1={cx} y1={cy} x2={x2} y2={y2} className={styles.stroke} />
      {degrees === 90
        ? <polyline points={`${cx + 14},${cy} ${cx + 14},${cy - 14} ${cx},${cy - 14}`} className={styles.thin} />
        : <path d={`M ${cx + r} ${cy} A ${r} ${r} 0 0 0 ${cx + r * Math.cos(rad)} ${cy - r * Math.sin(rad)}`} className={styles.thin} />}
    </svg>
  )
}

function Spinner({ sections }) {
  const n = sections.length
  const cx = 80, cy = 80, r = 70
  const spokes = []
  const labels = []
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
    const mid = a0 + Math.PI / n
    spokes.push(<line key={`s${i}`} x1={cx} y1={cy} x2={cx + r * Math.cos(a0)} y2={cy + r * Math.sin(a0)} className={styles.thin} />)
    labels.push(
      <text key={`t${i}`} x={cx + r * 0.68 * Math.cos(mid)} y={cy + r * 0.68 * Math.sin(mid)} className={styles.label} textAnchor="middle" dominantBaseline="central">
        {sections[i]}
      </text>
    )
  }
  return (
    <svg viewBox="0 0 160 160" className={styles.svg} role="img" aria-label={`A spinner with ${n} equal sections`}>
      <circle cx={cx} cy={cy} r={r} className={styles.stroke} />
      {spokes}
      {labels}
    </svg>
  )
}

function Grid({ cells }) {
  const rows = Math.max(...cells.map(c => c[0])) + 1
  const cols = Math.max(...cells.map(c => c[1])) + 1
  const size = 22
  const pad = 2
  const set = new Set(cells.map(c => `${c[0]},${c[1]}`))
  const gridRows = rows + 1, gridCols = cols + 1
  return (
    <svg viewBox={`0 0 ${gridCols * size + pad * 2} ${gridRows * size + pad * 2}`} className={styles.svg} role="img" aria-label="A shape on a square grid">
      {Array.from({ length: gridRows }).flatMap((_, r) =>
        Array.from({ length: gridCols }).map((__, c) => (
          <rect key={`${r}-${c}`} x={pad + c * size} y={pad + r * size} width={size} height={size}
            className={set.has(`${r},${c}`) ? styles.cellOn : styles.cellOff} />
        ))
      )}
    </svg>
  )
}

function NumberLine({ ticks, labels, pointIndex }) {
  const w = 300, x0 = 14, y = 40
  const step = (w - x0 * 2) / ticks
  return (
    <svg viewBox={`0 0 ${w} 80`} className={styles.wide} role="img" aria-label="A number line with a marked point">
      <line x1={x0 - 6} y1={y} x2={w - x0 + 6} y2={y} className={styles.stroke} />
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const long = labels[i] != null || i === pointIndex
        return <line key={i} x1={x0 + i * step} y1={y - (long ? 9 : 5)} x2={x0 + i * step} y2={y + (long ? 9 : 5)} className={styles.thin} />
      })}
      {Object.entries(labels).map(([i, text]) => (
        <text key={i} x={x0 + Number(i) * step} y={y + 26} className={styles.label} textAnchor="middle">{text}</text>
      ))}
      <circle cx={x0 + pointIndex * step} cy={y} r="5" className={styles.point} />
      <text x={x0 + pointIndex * step} y={y - 16} className={styles.label} textAnchor="middle">P</text>
    </svg>
  )
}


// ── Solids ──────────────────────────────────────────────────────────────
// Prisms and pyramids drawn from slightly above: every edge is shown, with
// the ones hidden behind the solid dashed, like the diagrams in a textbook.
function Solid({ kind, n, aspect = 1 }) {
  const cx = 100
  const rx = 62 * aspect, ry = 26
  const angle = i => ((90 + (i * 360) / n) * Math.PI) / 180
  const ring = (cy) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos(angle(i)), cy + ry * Math.sin(angle(i))])
  const edgeVisible = i => Math.sin((angle(i) + angle(i + 1)) / 2) >= -0.01
  const isPrism = kind === 'prism'
  const baseCy = isPrism ? 105 : 125
  const base = ring(baseCy)
  const top = isPrism ? ring(35) : null
  const apex = [cx, 22]
  const lines = []
  const add = (a, b, visible, key) => lines.push(
    <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={visible ? styles.stroke : styles.dashed} />
  )
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const visible = edgeVisible(i)
    add(base[i], base[j], visible, `b${i}`)
    if (isPrism) add(top[i], top[j], true, `t${i}`)
    const prevVisible = edgeVisible((i + n - 1) % n)
    const vertexVisible = visible || prevVisible
    add(isPrism ? top[i] : apex, base[i], vertexVisible, `l${i}`)
  }
  return (
    <svg viewBox="0 0 200 150" className={styles.svg} role="img" aria-label={`A drawing of a ${isPrism ? 'prism' : 'pyramid'}`}>
      {lines}
    </svg>
  )
}

// A box in isometric view, optionally cut into unit cubes.
function Box({ l, w, h, grid }) {
  const c30 = Math.cos(Math.PI / 6), s30 = 0.5
  const u = Math.min(130 / ((l + w) * s30 + h), 150 / ((l + w) * c30), 26)
  const width = (l + w) * c30 * u + 20
  const height = ((l + w) * s30 + h) * u + 20
  const T = [10 + w * c30 * u, 10]
  const a = [c30 * u, s30 * u], b = [-c30 * u, s30 * u]
  const at = (i, j, k = 0) => [T[0] + i * a[0] + j * b[0], T[1] + i * a[1] + j * b[1] + k * u]
  const pts = arr => arr.map(p => p.join(',')).join(' ')
  const lines = []
  if (grid) {
    for (let i = 1; i < l; i++) {
      lines.push(<line key={`ta${i}`} className={styles.thin} x1={at(i, 0)[0]} y1={at(i, 0)[1]} x2={at(i, w)[0]} y2={at(i, w)[1]} />)
      lines.push(<line key={`lf${i}`} className={styles.thin} x1={at(i, w)[0]} y1={at(i, w)[1]} x2={at(i, w, h)[0]} y2={at(i, w, h)[1]} />)
    }
    for (let j = 1; j < w; j++) {
      lines.push(<line key={`tb${j}`} className={styles.thin} x1={at(0, j)[0]} y1={at(0, j)[1]} x2={at(l, j)[0]} y2={at(l, j)[1]} />)
      lines.push(<line key={`rt${j}`} className={styles.thin} x1={at(l, j)[0]} y1={at(l, j)[1]} x2={at(l, j, h)[0]} y2={at(l, j, h)[1]} />)
    }
    for (let k = 1; k < h; k++) {
      lines.push(<line key={`hl${k}`} className={styles.thin} x1={at(0, w, k)[0]} y1={at(0, w, k)[1]} x2={at(l, w, k)[0]} y2={at(l, w, k)[1]} />)
      lines.push(<line key={`hr${k}`} className={styles.thin} x1={at(l, w, k)[0]} y1={at(l, w, k)[1]} x2={at(l, 0, k)[0]} y2={at(l, 0, k)[1]} />)
    }
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} style={{ width: Math.min(230, width * 1.3) }} role="img" aria-label="A box made of cubes">
      <polygon points={pts([at(0, 0), at(l, 0), at(l, w), at(0, w)])} className={styles.faceTop} />
      <polygon points={pts([at(0, w), at(l, w), at(l, w, h), at(0, w, h)])} className={styles.faceLeft} />
      <polygon points={pts([at(l, w), at(l, 0), at(l, 0, h), at(l, w, h)])} className={styles.faceRight} />
      {lines}
    </svg>
  )
}

// ── Graphs ──────────────────────────────────────────────────────────────
const G = { left: 38, right: 290, top: 28, bottom: 140 }

function GraphAxes({ max, step, yTitle }) {
  const ticks = []
  for (let v = 0; v <= max; v += step) {
    const y = G.bottom - (v / max) * (G.bottom - G.top)
    ticks.push(
      <g key={v}>
        <line x1={G.left} y1={y} x2={G.right} y2={y} className={styles.gridLine} />
        <text x={G.left - 6} y={y} className={styles.tick} textAnchor="end" dominantBaseline="central">{v}</text>
      </g>
    )
  }
  return (
    <>
      {ticks}
      <line x1={G.left} y1={G.top} x2={G.left} y2={G.bottom} className={styles.stroke} />
      <line x1={G.left} y1={G.bottom} x2={G.right} y2={G.bottom} className={styles.stroke} />
      {yTitle && <text x="4" y="11" className={styles.tick}>{yTitle}</text>}
    </>
  )
}

function BarGraph({ bars, max, step, yTitle }) {
  const slot = (G.right - G.left) / bars.length
  return (
    <svg viewBox="0 0 300 175" className={styles.wide} role="img" aria-label="A bar graph">
      <GraphAxes max={max} step={step} yTitle={yTitle} />
      {bars.map(([label, value], i) => {
        const h = (value / max) * (G.bottom - G.top)
        return (
          <g key={label}>
            <rect x={G.left + i * slot + slot * 0.2} y={G.bottom - h} width={slot * 0.6} height={h} className={styles.bar} />
            <text x={G.left + i * slot + slot / 2} y={G.bottom - h - 4} className={styles.tick} textAnchor="middle">{value}</text>
            <text x={G.left + i * slot + slot / 2} y={G.bottom + 16} className={styles.tick} textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function LineGraph({ points, xMax, xStep, max, step, xTitle, yTitle }) {
  const px = x => G.left + (x / xMax) * (G.right - G.left - 10)
  const py = y => G.bottom - (y / max) * (G.bottom - G.top)
  const xs = []
  for (let x = 0; x <= xMax; x += xStep) xs.push(x)
  return (
    <svg viewBox="0 0 300 175" className={styles.wide} role="img" aria-label="A line graph">
      <GraphAxes max={max} step={step} yTitle={yTitle} />
      {xs.map(x => <text key={x} x={px(x)} y={G.bottom + 15} className={styles.tick} textAnchor="middle">{x}</text>)}
      {xTitle && <text x={(G.left + G.right) / 2} y="172" className={styles.tick} textAnchor="middle">{xTitle}</text>}
      <polyline points={points.map(p => `${px(p.x)},${py(p.y)}`).join(' ')} className={styles.stroke} />
      {points.map(p => <circle key={p.x} cx={px(p.x)} cy={py(p.y)} r="3.5" className={styles.point} />)}
      {points.map(p => <text key={`v${p.x}`} x={px(p.x)} y={py(p.y) - 8} className={styles.tick} textAnchor="middle">{p.y}</text>)}
    </svg>
  )
}

function PieChart({ slices }) {
  const cx = 85, cy = 80, r = 65
  let start = -Math.PI / 2
  return (
    <svg viewBox="0 0 170 160" className={styles.svg} role="img" aria-label="A pie chart">
      {slices.map((s, i) => {
        const end = start + s.fraction * 2 * Math.PI
        const mid = (start + end) / 2
        const large = s.fraction > 0.5 ? 1 : 0
        const d = `M ${cx} ${cy} L ${cx + r * Math.cos(start)} ${cy + r * Math.sin(start)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(end)} ${cy + r * Math.sin(end)} Z`
        start = end
        return (
          <g key={s.label}>
            <path d={d} className={i % 2 === 0 ? styles.faceTop : styles.faceLeft} stroke="currentColor" strokeWidth="1.5" />
            <text x={cx + r * 0.6 * Math.cos(mid)} y={cy + r * 0.6 * Math.sin(mid)} className={styles.label} textAnchor="middle" dominantBaseline="central">{s.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Visual({ visual }) {
  if (!visual) return null
  return (
    <div className={styles.frame}>
      {visual.type === 'angle' && <Angle degrees={visual.degrees} />}
      {visual.type === 'spinner' && <Spinner sections={visual.sections} />}
      {visual.type === 'grid' && <Grid cells={visual.cells} />}
      {visual.type === 'solid' && <Solid kind={visual.kind} n={visual.n} aspect={visual.aspect} />}
      {visual.type === 'box' && <Box l={visual.l} w={visual.w} h={visual.h} grid={visual.grid} />}
      {visual.type === 'bar' && <BarGraph bars={visual.bars} max={visual.max} step={visual.step} yTitle={visual.yTitle} />}
      {visual.type === 'line' && <LineGraph points={visual.points} xMax={visual.xMax} xStep={visual.xStep} max={visual.max} step={visual.step} xTitle={visual.xTitle} yTitle={visual.yTitle} />}
      {visual.type === 'pie' && <PieChart slices={visual.slices} />}
      {visual.type === 'numberline' && <NumberLine ticks={visual.ticks} labels={visual.labels} pointIndex={visual.pointIndex} />}
    </div>
  )
}
