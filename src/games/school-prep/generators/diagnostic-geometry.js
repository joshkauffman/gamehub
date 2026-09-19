// Geometry, measurement, statistics, probability and word-problem
// generators modelled on the same Grade 5 diagnostic test. Terms a new
// Grade 6 student may not be sure of are defined inside the prompt.

import { randInt, pick, shuffled, fmt, num, buildChoices, make, makeNum, GE, ME, SP, PS, pad2, money } from './helpers.js'

const MONTHS = ['March', 'April', 'May', 'June', 'July', 'August', 'September']

const SOLIDS = [
  { name: 'triangular prism', faces: 5, vertices: 6, edges: 9, net: '2 triangles and 3 rectangles' },
  { name: 'square pyramid', faces: 5, vertices: 5, edges: 8, net: '1 square and 4 triangles' },
  { name: 'triangular pyramid', faces: 4, vertices: 4, edges: 6, net: '4 triangles' },
  { name: 'rectangular prism', faces: 6, vertices: 8, edges: 12, net: '6 rectangles that are not all squares' },
  { name: 'pentagonal prism', faces: 7, vertices: 10, edges: 15, net: '2 pentagons and 5 rectangles' },
  { name: 'hexagonal prism', faces: 8, vertices: 12, edges: 18, net: '2 hexagons and 6 rectangles' },
  { name: 'pentagonal pyramid', faces: 6, vertices: 6, edges: 10, net: '1 pentagon and 5 triangles' },
  { name: 'cube', faces: 6, vertices: 8, edges: 12, net: '6 squares' },
]
const SOLID_VISUAL = {
  'triangular prism': { type: 'solid', kind: 'prism', n: 3 },
  'square pyramid': { type: 'solid', kind: 'pyramid', n: 4 },
  'triangular pyramid': { type: 'solid', kind: 'pyramid', n: 3 },
  'rectangular prism': { type: 'solid', kind: 'prism', n: 4, aspect: 1.4 },
  'pentagonal prism': { type: 'solid', kind: 'prism', n: 5 },
  'hexagonal prism': { type: 'solid', kind: 'prism', n: 6 },
  'pentagonal pyramid': { type: 'solid', kind: 'pyramid', n: 5 },
  cube: { type: 'solid', kind: 'prism', n: 4 },
}
const SOLID_KEY = '(A face is a flat side, an edge is where two faces meet, and a vertex is a corner.)'

function gridShape() {
  const kind = pick(['rect', 'L', 'T'])
  const cells = []
  if (kind === 'rect') {
    const h = randInt(2, 5), w = randInt(3, 6)
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push([r, c])
  } else if (kind === 'L') {
    const h = randInt(4, 6), w = randInt(4, 6), t = randInt(1, 2)
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (c < t || r >= h - t) cells.push([r, c])
  } else {
    const h = randInt(3, 5)
    for (let c = 0; c < 5; c++) cells.push([0, c])
    for (let r = 1; r < h; r++) cells.push([r, 2])
  }
  const set = new Set(cells.map(c => `${c[0]},${c[1]}`))
  let perimeter = 0
  for (const [r, c] of cells) {
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has(`${r + dr},${c + dc}`)) perimeter++
  }
  return { cells, area: cells.length, perimeter }
}

const pair = (x, y) => `(${x}, ${y})`
const units = n => `${n} unit${n === 1 ? '' : 's'}`
const hm = minutes => `${Math.floor(minutes / 60)} h ${pad2(minutes % 60)} min`
const clock = (h24min) => {
  const h = Math.floor(h24min / 60), m = h24min % 60
  return `${h > 12 ? h - 12 : h}:${pad2(m)} ${h >= 12 ? 'p.m.' : 'a.m.'}`
}

export const GEOMETRY_GENERATORS = {
  'angle-types'(difficulty) {
    const kind = pick(['acute', 'right', 'obtuse'])
    const degrees = kind === 'acute' ? randInt(20, 75) : kind === 'right' ? 90 : randInt(105, 160)
    return make(GE, 'angle-types', difficulty,
      'What type of angle is shown? (Acute is smaller than a right angle, right is a square corner of 90°, obtuse is bigger than a right angle but smaller than a straight line.)',
      kind, ['acute', 'right', 'obtuse', 'straight'].filter(k => k !== kind),
      `The angle is ${degrees === 90 ? 'a square corner, so it is a right angle (90°)' : degrees < 90 ? 'smaller than a square corner, so it is acute (less than 90°)' : 'wider than a square corner but not a straight line, so it is obtuse (between 90° and 180°)'}.`,
      { visual: { type: 'angle', degrees } })
  },

  coordinates(difficulty) {
    const KEY = '(The origin is the point (0, 0).)'
    const kind = pick(['locate', 'x-axis', 'y-axis', 'move'])
    if (kind === 'locate' || kind === 'move') {
      const x = randInt(1, 8), y = randInt(1, 8)
      let xx = x
      if (x === y) xx = x === 8 ? 7 : x + 1
      const prompt = kind === 'locate'
        ? `Which ordered pair is ${units(xx)} to the right and ${units(y)} up from the origin? ${KEY}`
        : `Start at the origin (0, 0). Move ${units(xx)} right, then ${units(y)} up. Where do you land?`
      return make(GE, 'coordinates', difficulty, prompt, pair(xx, y),
        [pair(y, xx), pair(xx, 0), pair(0, y), pair(xx + 1, y), pair(xx, y - 1)],
        `The first number is across (x) and the second is up (y): ${pair(xx, y)}.`)
    }
    const onX = kind === 'x-axis'
    const pts = []
    while (pts.length < 3) {
      const a = randInt(1, 8), b = randInt(1, 8)
      if (a !== b && !pts.some(p => p[0] === a && p[1] === b)) pts.push([a, b])
    }
    const v = randInt(1, 8)
    const correct = onX ? pair(v, 0) : pair(0, v)
    return make(GE, 'coordinates', difficulty,
      `Which point is on the ${onX ? 'x-axis (the horizontal line)' : 'y-axis (the vertical line)'}?`, correct,
      pts.map(p => pair(p[0], p[1])),
      `A point on the ${onX ? 'x-axis has y = 0' : 'y-axis has x = 0'}, so it is ${correct}.`)
  },

  'reflection-translation'(difficulty) {
    if (Math.random() < 0.5) {
      const vertical = Math.random() < 0.5
      const k = randInt(3, 6)
      let x = randInt(1, 8), y = randInt(1, 8)
      if (vertical) { while (x === k || 2 * k - x < 0) x = randInt(1, 8) } else { while (y === k || 2 * k - y < 0) y = randInt(1, 8) }
      const [rx, ry] = vertical ? [2 * k - x, y] : [x, 2 * k - y]
      return make(GE, 'reflection-translation', difficulty,
        `The point ${pair(x, y)} is reflected (flipped like in a mirror) across the ${vertical ? 'vertical' : 'horizontal'} line ${vertical ? 'x' : 'y'} = ${k}. What are the coordinates of its image?`,
        pair(rx, ry),
        [pair(ry, rx), vertical ? pair(x, 2 * k - y < 0 ? y + 1 : 2 * k - y) : pair(2 * k - x < 0 ? x + 1 : 2 * k - x, y), pair(rx + 1, ry), pair(rx, ry + 1), pair(x + 1, y)],
        `The image is the same distance from the line on the other side. ${vertical ? `${x} is ${Math.abs(x - k)} from ${k}, so the image x is ${rx}` : `${y} is ${Math.abs(y - k)} from ${k}, so the image y is ${ry}`}. Image: ${pair(rx, ry)}.`)
    }
    const x = randInt(1, 6), y = randInt(1, 6), dx = randInt(1, 5), dy = randInt(1, 5)
    return make(GE, 'reflection-translation', difficulty,
      `The point ${pair(x, y)} is translated (slid without turning or flipping) ${units(dx)} right and ${units(dy)} up. Where does it land?`, pair(x + dx, y + dy),
      [pair(x + dy, y + dx), pair(x + dx, y - dy), pair(x - dx, y + dy), pair(x + dx, y), pair(x + dx + 1, y + dy)],
      `Right adds to x and up adds to y: ${pair(x, y)} → ${pair(x + dx, y + dy)}.`)
  },

  'solids-properties'(difficulty) {
    const kind = pick(['net', 'property', 'count'])
    if (kind === 'net') {
      const s = pick(SOLIDS)
      const others = shuffled(SOLIDS.filter(o => o.name !== s.name)).slice(0, 3)
      return make(GE, 'solids-properties', difficulty,
        `A net (a flat pattern that folds up into a solid) is made of ${s.net}. Which solid does it make?`, s.name, others.map(o => o.name),
        `Fold the net: ${s.net} make a ${s.name}.`)
    }
    const prop = pick(['faces', 'vertices', 'edges'])
    if (kind === 'property') {
      const pool = SOLIDS.filter(o => o.name !== 'cube')
      const s = pick(pool)
      const others = shuffled(pool.filter(o => o[prop] !== s[prop])).slice(0, 3)
      return make(GE, 'solids-properties', difficulty,
        `Which solid has ${s[prop]} ${prop}? ${SOLID_KEY}`, s.name, others.map(o => o.name),
        `A ${s.name} has ${s.faces} faces, ${s.vertices} vertices and ${s.edges} edges.`)
    }
    const s = pick(SOLIDS)
    const wrongs = SOLIDS.map(o => o[prop]).filter(v => v !== s[prop])
    return makeNumSimple(GE, 'solids-properties', difficulty,
      `How many ${prop} does a ${s.name} have? ${SOLID_KEY}`, s[prop], [...new Set(wrongs), s[prop] + 1, s[prop] - 1],
      `A ${s.name} has ${s.faces} faces, ${s.vertices} vertices and ${s.edges} edges.`,
      { visual: SOLID_VISUAL[s.name] })
  },

  polygons(difficulty) {
    const kind = pick(['sides', 'quad', 'convex', 'symbols'])
    if (kind === 'sides') {
      const names = { 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon' }
      const n = pick([5, 6, 7, 8, 10])
      return make(GE, 'polygons', difficulty, `What is the name of a polygon (a closed flat shape with straight sides) that has ${n} sides?`, names[n],
        Object.entries(names).filter(([k]) => Number(k) !== n).map(([, v]) => v),
        `A polygon with ${n} sides is called a ${names[n]}.`)
    }
    if (kind === 'quad') {
      const items = [
        ['a quadrilateral (4-sided shape) with exactly one pair of parallel sides', 'trapezoid'],
        ['a quadrilateral with four equal sides and four right angles', 'square'],
        ['a quadrilateral with four right angles whose sides are not all equal', 'rectangle'],
        ['a quadrilateral with four equal sides but no right angles', 'rhombus'],
      ]
      const [desc, name] = pick(items)
      return make(GE, 'polygons', difficulty, `Which shape is ${desc}? (Parallel sides never meet, like railway tracks.)`, name,
        items.map(i => i[1]).filter(n => n !== name), `${desc} is a ${name}.`)
    }
    if (kind === 'convex') {
      const convex = Math.random() < 0.5
      const answer = convex ? 'convex' : 'nonconvex'
      return {
        subject: 'math', strand: GE, topic: 'polygons', difficulty,
        prompt: convex
          ? 'A polygon has every interior angle less than 180°, so no corner "caves in". Is it convex or nonconvex (also called concave)?'
          : 'A polygon has one interior angle bigger than 180°, so one corner "caves in". Is it convex or nonconvex (also called concave)?',
        ...buildChoices(answer, [convex ? 'nonconvex' : 'convex'], 2),
        explanation: convex ? 'All angles under 180° means convex.' : 'An angle over 180° that caves in means nonconvex (concave).',
      }
    }
    const items = [
      ['In rectangle ABCD, sides AB and CD are opposite sides. How are AB and CD related?', 'parallel (AB // CD)', 'Opposite sides of a rectangle never meet, so they are parallel.'],
      ['In rectangle ABCD, sides AB and BC meet at corner B. How are AB and BC related?', 'perpendicular (AB ⊥ BC)', 'A rectangle has square corners, so sides that meet at a corner are perpendicular (they form a 90° angle).'],
      ['In square PQRS, sides PQ and RS are opposite sides. How are PQ and RS related?', 'parallel (PQ // RS)', 'Opposite sides of a square are parallel.'],
      ['In square PQRS, sides QR and RS meet at corner R. How are QR and RS related?', 'perpendicular (QR ⊥ RS)', 'A square has four 90° corners, so sides meeting at a corner are perpendicular.'],
    ]
    const [prompt, answer, explanation] = pick(items)
    const opts = ['parallel', 'perpendicular']
    const all = [`${opts[0]}`, `${opts[1]}`]
    return make(GE, 'polygons', difficulty, `${prompt} (// means parallel, ⊥ means perpendicular.)`, answer.split(' ')[0],
      all.filter(a => a !== answer.split(' ')[0]).concat(['equal but not parallel', 'neither parallel nor perpendicular']),
      explanation)
  },

  'grid-area-perimeter'(difficulty) {
    const { cells, area, perimeter } = gridShape()
    const askArea = Math.random() < 0.5
    const correct = askArea ? area : perimeter
    return makeNum(ME, 'grid-area-perimeter', difficulty,
      askArea
        ? 'Each small square is 1 unit by 1 unit. What is the area of the shaded shape in square units? (Area is the amount of flat space inside the shape.)'
        : 'Each small square is 1 unit by 1 unit. What is the perimeter of the shaded shape in units? (Perimeter is the distance all the way around the outside.)',
      correct, askArea ? [perimeter, area + 2, area - 2, area * 2] : [area, perimeter + 2, perimeter - 2, perimeter + 4],
      askArea ? `Count the shaded squares: ${area} square units.` : `Count the unit edges around the outside of the shape: ${perimeter} units.`,
      { visual: { type: 'grid', cells } })
  },

  'volume-cubes'(difficulty) {
    if (Math.random() < 0.3) {
      return makeNum(ME, 'volume-cubes', difficulty,
        'A solid is made of one centre cube with one more cube stuck to each of its 6 faces. Each cube is 1 cubic unit. What is the volume (the amount of space the solid takes up) in cubic units?', 7,
        [6, 8, 12, 9], 'The centre cube plus 6 cubes around it: 1 + 6 = 7 cubic units.')
    }
    const l = randInt(2, 5), w = randInt(2, 5), layers = randInt(2, 4)
    const correct = l * w * layers
    return makeNum(ME, 'volume-cubes', difficulty,
      `A solid is built from unit cubes (each cube is 1 cubic unit): ${layers} layers, and each layer has ${w} rows of ${l} cubes. What is its volume in cubic units? (Volume is how many unit cubes fill the solid.)`, correct,
      [l * w + layers, l + w + layers, (l + w) * layers, correct - l],
      `Each layer has ${w} × ${l} = ${l * w} cubes. ${layers} layers × ${l * w} = ${correct} cubic units.`,
      { visual: { type: 'box', l, w, h: layers, grid: true } })
  },

  'unit-conversion'(difficulty) {
    const families = [
      { units: { mm: 1, cm: 10, dm: 100, m: 1000 }, sample: ['cm', 'mm', 'dm', 'm'] },
      { units: { mm: 1, cm: 10, m: 1000, km: 1000000 }, sample: ['km', 'm', 'cm'] },
      { units: { g: 1, kg: 1000 }, sample: ['kg', 'g'] },
      { units: { mL: 1, L: 1000 }, sample: ['L', 'mL'] },
    ]
    const fam = pick(families)
    let from, to
    do { from = pick(fam.sample); to = pick(fam.sample) } while (from === to)
    const decimal = Math.random() < 0.35
    const value = decimal ? randInt(2, 90) / 10 : randInt(2, 90)
    const correctNum = (value * fam.units[from]) / fam.units[to]
    if (correctNum > 1000000 || correctNum < 0.01 || Math.round(correctNum * 100) !== Number((correctNum * 100).toFixed(6))) return GEOMETRY_GENERATORS['unit-conversion'](difficulty)
    const unit = u => `${u}`
    const text = v => `${num(v)} ${to}`
    return make(ME, 'unit-conversion', difficulty,
      `Convert ${num(value)} ${unit(from)} to ${to}.${[from, to].includes('dm') ? ' (1 dm = 10 cm.)' : ''}`, text(correctNum),
      [correctNum * 10, correctNum / 10, correctNum * 100, correctNum / 100, correctNum * 1000].filter(v => Math.round(v * 100) === Number((v * 100).toFixed(6))).map(text),
      `${fam.units[from] > fam.units[to] ? `Going from ${from} to a smaller unit, multiply by ${fam.units[from] / fam.units[to]}` : `Going from ${from} to a larger unit, divide by ${fam.units[to] / fam.units[from]}`}: ${num(value)} ${from} = ${text(correctNum)}.`)
  },

  'decimetre-rectangle'(difficulty) {
    const lt = randInt(8, 30), wt = randInt(2, 9) // in tenths of a dm = cm
    const l = lt / 10, w = wt / 10
    const askPerimeter = Math.random() < 0.5
    const perimeter = 2 * (lt + wt), area = lt * wt
    return make(ME, 'decimetre-rectangle', difficulty,
      `A rectangle is ${num(l)} dm long and ${num(w)} dm wide. (1 dm = 10 cm.) What is its ${askPerimeter ? 'perimeter (the distance all the way around) in centimetres' : 'area (the space inside) in square centimetres'}?`,
      askPerimeter ? `${perimeter} cm` : `${area} cm²`,
      askPerimeter
        ? [`${num(perimeter / 10)} cm`, `${lt + wt} cm`, `${area} cm`, `${perimeter * 10} cm`]
        : [`${num(area / 100)} cm²`, `${num(area / 10)} cm²`, `${perimeter} cm²`, `${area * 10} cm²`],
      `${num(l)} dm = ${lt} cm and ${num(w)} dm = ${wt} cm. ${askPerimeter ? `Perimeter = 2 × (${lt} + ${wt}) = ${perimeter} cm` : `Area = ${lt} × ${wt} = ${area} cm²`}.`)
  },

  'elapsed-time'(difficulty) {
    if (Math.random() < 0.5) {
      const days = randInt(3, 6), each = pick([20, 25, 30, 35, 40, 45, 50])
      const total = days * each
      const h = Math.floor(total / 60), m = total % 60
      return make(ME, 'elapsed-time', difficulty,
        `Amelia swims ${days} days per week. She swims ${each} minutes each day. How much time does she spend swimming each week? (Remember: 60 minutes = 1 hour.)`,
        hm(total),
        [...(total >= 100 ? [`${Math.floor(total / 100)} h ${pad2(total % 100)} min`] : []), hm(total + 10), hm(Math.max(0, total - 10)), `${h + 1} h ${pad2(m)} min`, hm(total + 15)],
        `${days} × ${each} = ${total} minutes. ${total} ÷ 60 = ${h} hour${h === 1 ? '' : 's'} with ${m} minutes left over: ${hm(total)}.`)
    }
    const startMin = randInt(8, 15) * 60 + randInt(0, 11) * 5
    const dur = randInt(2, 7) * 60 + randInt(1, 11) * 5
    const endMin = startMin + dur
    if (endMin >= 24 * 60) return GEOMETRY_GENERATORS['elapsed-time'](difficulty)
    return make(ME, 'elapsed-time', difficulty,
      `Yoan takes a train. He leaves at ${clock(startMin)} and gets there at ${clock(endMin)}, so how long is his trip in hours and minutes?`, hm(dur),
      [hm(dur + 30), hm(dur - 30 > 0 ? dur - 30 : dur + 45), hm(dur + 60), hm(dur - 60), hm(dur + 10)],
      `From ${clock(startMin)} to ${clock(endMin)} is ${hm(dur)}. (Count up the hours first, then the extra minutes.)`)
  },

  'median-mode-range'(difficulty) {
    const kind = pick(['range', 'median', 'mode'])
    const count = kind === 'range' ? randInt(5, 6) : pick([5, 7])
    const nums = []
    while (nums.length < count) { const n = randInt(2, 30); if (!nums.includes(n)) nums.push(n) }
    if (kind === 'range') {
      const range = Math.max(...nums) - Math.min(...nums)
      return make(SP, 'median-mode-range', difficulty,
        `Find the range of these numbers: ${nums.join(', ')}. (The range is the biggest number minus the smallest number.)`, String(range),
        [Math.max(...nums), Math.min(...nums), range + 1, range - 1, Math.max(...nums) + Math.min(...nums)].map(String),
        `The biggest is ${Math.max(...nums)} and the smallest is ${Math.min(...nums)}: ${Math.max(...nums)} − ${Math.min(...nums)} = ${range}.`)
    }
    if (kind === 'median') {
      const sorted = [...nums].sort((a, b) => a - b)
      const median = sorted[(count - 1) / 2]
      return make(SP, 'median-mode-range', difficulty,
        `Find the median of these numbers: ${nums.join(', ')}. (The median is the middle number when they are put in order from smallest to largest.)`, String(median),
        [nums[(count - 1) / 2], sorted[0], sorted[count - 1], Math.round(nums.reduce((a, b) => a + b, 0) / count), sorted[(count + 1) / 2]].map(String),
        `In order: ${sorted.join(', ')}. The middle one is ${median}.`)
    }
    const mode = nums[0]
    const list = shuffled([...nums, mode])
    return make(SP, 'median-mode-range', difficulty,
      `Find the mode of these numbers: ${list.join(', ')}. (The mode is the number that shows up most often.)`, String(mode),
      shuffled(nums.filter(n => n !== mode)).slice(0, 3).map(String),
      `${mode} appears twice and every other number appears once, so the mode is ${mode}.`)
  },

  'temperature-table'(difficulty) {
    const t = []
    t[0] = randInt(2, 8); t[1] = t[0] + randInt(6, 10); t[2] = t[1] + randInt(3, 6); t[3] = t[2] + randInt(1, 3)
    t[4] = t[3] + randInt(3, 6); t[5] = t[4] - randInt(3, 7); t[6] = t[5] - randInt(3, 7)
    const table = MONTHS.map((m, i) => `${m} ${t[i]} °C`).join(', ')
    const intro = `Laura recorded the average temperature in her city each month: ${table}.`
    const text = v => `${v} °C`
    if (Math.random() < 0.5) {
      const hi = Math.max(...t), lo = Math.min(...t), diff = hi - lo
      return make(SP, 'temperature-table', difficulty,
        `${intro} What is the difference between the warmest month and the coldest month?`, text(diff),
        [hi + lo, hi, lo, diff + 1, diff - 1].map(text),
        `The warmest is ${hi} °C and the coldest is ${lo} °C: ${hi} − ${lo} = ${diff} °C.`)
    }
    let i, j
    do { i = randInt(0, 6); j = randInt(0, 6) } while (i === j || t[i] === t[j])
    const diff = Math.abs(t[i] - t[j])
    return make(SP, 'temperature-table', difficulty,
      `${intro} What is the difference in temperature between ${MONTHS[i]} and ${MONTHS[j]}?`, text(diff),
      [t[i] + t[j], diff + 1, diff - 1, diff + 2, diff + 10].map(text),
      `${MONTHS[i]} is ${t[i]} °C and ${MONTHS[j]} is ${t[j]} °C. The difference is ${Math.max(t[i], t[j])} − ${Math.min(t[i], t[j])} = ${diff} °C.`)
  },

  'spinner-likelihood'(difficulty) {
    const labels = shuffled(['1', '1', '2', '2', '2', '3', '4', '4'])
    const counts = {}
    labels.forEach(l => { counts[l] = (counts[l] || 0) + 1 })
    const visual = { type: 'spinner', sections: labels }
    const uniq = Object.keys(counts)
    if (Math.random() < 0.35) {
      const max = Math.max(...uniq.map(Number))
      const impossible = pick([`Stopping on a number greater than ${max}`, `Stopping on the number ${max + randInt(1, 4)}`])
      const possible = shuffled(uniq).slice(0, 3).map(n => `Stopping on the number ${n}`)
      return make(SP, 'spinner-likelihood', difficulty,
        'The arrow of this spinner stops on one of the 8 equal sections. Which event is impossible (it can never happen)?', impossible, possible,
        `The spinner only shows ${uniq.sort().join(', ')}, so "${impossible.toLowerCase()}" can never happen.`, { visual })
    }
    let a, b
    do { a = pick(uniq); b = pick(uniq) } while (a === b)
    const more = counts[a] > counts[b] ? `More likely to stop on ${a}` : counts[a] < counts[b] ? `More likely to stop on ${b}` : 'Just as likely'
    const { choices, answerIndex } = buildChoices(more, [`More likely to stop on ${a}`, `More likely to stop on ${b}`, 'Just as likely'].filter(c => c !== more), 3)
    return {
      subject: 'math', strand: SP, topic: 'spinner-likelihood', difficulty, visual, choices, answerIndex,
      prompt: `The arrow of this spinner stops on one of the 8 equal sections. Compare the chance of stopping on ${a} with the chance of stopping on ${b}.`,
      explanation: `${a} appears on ${counts[a]} section${counts[a] > 1 ? 's' : ''} and ${b} appears on ${counts[b]}. The number on more sections is more likely.`,
    }
  },

  'reading-graphs'(difficulty) {
    const niceMax = (maxV) => { const step = maxV > 12 ? 5 : 2; return { step, max: Math.ceil(maxV / step) * step } }
    if (Math.random() < 0.6) {
      const themes = [
        { intro: 'The bar graph shows the favourite pet of the students in a class.', cats: ['Dogs', 'Cats', 'Fish', 'Birds', 'Rabbits'], who: 'students chose' },
        { intro: 'The bar graph shows the favourite fruit of the students in a class.', cats: ['Apples', 'Bananas', 'Grapes', 'Oranges', 'Pears'], who: 'students chose' },
        { intro: 'The bar graph shows the favourite sport of the students in a class.', cats: ['Soccer', 'Hockey', 'Tennis', 'Swimming', 'Baseball'], who: 'students chose' },
      ]
      const theme = pick(themes)
      const cats = shuffled(theme.cats).slice(0, 4)
      const values = []
      while (values.length < 4) { const v = randInt(2, 18); if (!values.includes(v)) values.push(v) }
      const { max, step } = niceMax(Math.max(...values))
      const visual = { type: 'bar', bars: cats.map((c, i) => [c, values[i]]), max, step, yTitle: 'Number of students' }
      const kind = pick(['more', 'total', 'most'])
      if (kind === 'more') {
        const [i, j] = shuffled([0, 1, 2, 3]).slice(0, 2).sort((x, y) => values[y] - values[x])
        const diff = values[i] - values[j]
        return makeNum(SP, 'reading-graphs', difficulty, `${theme.intro} How many more students ${theme.who === 'students own' ? 'own' : 'chose'} ${cats[i]} than ${cats[j]}?`, diff,
          [values[i] + values[j], values[i], values[j], diff + 1], `${cats[i]} is ${values[i]} and ${cats[j]} is ${values[j]}: ${values[i]} − ${values[j]} = ${diff}.`, { visual })
      }
      if (kind === 'total') {
        const total = values.reduce((a, b) => a + b, 0)
        return makeNum(SP, 'reading-graphs', difficulty, `${theme.intro} How many students are counted in all?`, total,
          [total - values[0], total + 1, total - 1, Math.max(...values)], `Add every bar: ${values.join(' + ')} = ${total}.`, { visual })
      }
      const top = values.indexOf(Math.max(...values))
      return make(SP, 'reading-graphs', difficulty, `${theme.intro} Which one has the most?`, cats[top], cats.filter((_, k) => k !== top),
        `The tallest bar is ${cats[top]}, with ${values[top]}.`, { visual })
    }
    const start = randInt(2, 6), rate = randInt(2, 4)
    const days = [1, 3, 5]
    const heights = days.map((d, i) => start + i * 2 * rate)
    const visual = { type: 'line', points: days.map((d, i) => ({ x: d, y: heights[i] })), xMax: 8, xStep: 1, max: Math.ceil((heights[2] + 2 * rate + 1) / 4) * 4, step: 4, xTitle: 'Day', yTitle: 'Height (cm)' }
    if (Math.random() < 0.5) {
      const diff = heights[2] - heights[0]
      return makeNum(SP, 'reading-graphs', difficulty, "The line graph shows a plant's height (in cm) on days 1, 3 and 5. How many centimetres did the plant grow from day 1 to day 5?", diff,
        [heights[2], heights[1], diff + rate, diff - rate], `Day 5 is ${heights[2]} cm and day 1 is ${heights[0]} cm: ${heights[2]} − ${heights[0]} = ${diff} cm.`, { visual })
    }
    const day7 = heights[2] + 2 * rate
    return makeNum(SP, 'reading-graphs', difficulty, "The line graph shows a plant's height (in cm) on days 1, 3 and 5. If the pattern continues steadily, what height would you expect on day 7?", day7,
      [heights[2] + rate, heights[2] + 3 * rate, heights[2] * 2, day7 + 1], `The plant grows ${2 * rate} cm every 2 days, so day 7 is ${heights[2]} + ${2 * rate} = ${day7} cm.`, { visual })
  },

  'word-problems-gen'(difficulty) {
    const kind = pick(['boxes', 'share', 'change', 'cycling', 'sticks'])
    if (kind === 'boxes') {
      const n = randInt(4, 9), each = randInt(12, 60)
      const c = n * each
      return makeNum(PS, 'word-problems-gen', difficulty, `Julia is buying ${n} boxes. Each box contains ${each} pencils. How many pencils is Julia buying in all?`, c,
        [n + each, c + 10, c - 10, c + n * 10], `${n} × ${each} = ${c} pencils.`)
    }
    if (kind === 'share') {
      const boxes = randInt(3, 8), q = randInt(20, 150), total = boxes * q
      return makeNum(PS, 'word-problems-gen', difficulty,
        `Ely is sorting ${total} baseball cards into ${boxes} boxes. Each box contains the same number of cards. How many cards are in each box?`, q,
        [q + 10, q - 10, q * 10, total - boxes], `${total} ÷ ${boxes} = ${q} cards in each box.`)
    }
    if (kind === 'change') {
      const nb = randInt(9, 16) * 25 + 20, pe = randInt(3, 7) * 25, er = randInt(2, 5) * 25
      const k = randInt(2, 4), j = randInt(2, 3)
      const total = nb + k * pe + j * er
      const paid = (Math.floor(total / 1000) + 1) * 1000 + (Math.random() < 0.5 ? 200 : 0)
      const change = paid - total
      const cash = paid % 1000 === 0 ? `a ${money(paid)} bill` : `a ${money(paid - 200)} bill and a $2.00 coin`
      return make(PS, 'word-problems-gen', difficulty,
        `Justine buys 1 notebook for ${money(nb)}, ${k} pencils for ${money(pe)} each and ${j} erasers for ${money(er)} each. She hands the cashier ${cash}. How much money does she get back?`,
        money(change),
        [paid - (nb + pe + er), change + 50, change - 50, change + 100, change - 100].filter(c => c > 0).map(money),
        `Total cost: ${money(nb)} + ${k} × ${money(pe)} + ${j} × ${money(er)} = ${money(total)}. Change: ${money(paid)} − ${money(total)} = ${money(change)}.`)
    }
    if (kind === 'cycling') {
      const s = randInt(20, 45), m = randInt(2, 4)
      const w2 = s * m, w3 = s + w2, total = s + w2 + w3
      return makeNum(PS, 'word-problems-gen', difficulty,
        `Adam rides his bicycle long distances. In week 1 he cycles ${s} km. In week 2 he cycles ${m} times as far as in week 1. In week 3 he wants to cycle a distance equal to the sum of weeks 1 and 2. What is the total distance he will have cycled by the end of week 3?`, total,
        [w3, s + w2 + 3, total - s, w2 + w3, total + s],
        `Week 2: ${s} × ${m} = ${w2} km. Week 3: ${s} + ${w2} = ${w3} km. Total: ${s} + ${w2} + ${w3} = ${total} km.`)
    }
    const n = randInt(4, 9), lenCm = randInt(12, 45)
    const total = n * lenCm
    return make(PS, 'word-problems-gen', difficulty,
      `Sophia places ${n} wooden sticks end to end. Together they measure ${total} cm. Each stick is the same length. What is the length of one stick in decimetres? (1 dm = 10 cm.)`,
      `${num(lenCm / 10)} dm`,
      [`${lenCm} dm`, `${num(lenCm / 100)} dm`, `${num(total / 10)} dm`, `${num(lenCm / 10 + 1)} dm`],
      `${total} ÷ ${n} = ${lenCm} cm per stick. ${lenCm} cm ÷ 10 = ${num(lenCm / 10)} dm.`)
  },
}

// Number choices where wrong answers may be any integers (used for counts).
function makeNumSimple(strand, topic, difficulty, prompt, correct, wrongs, explanation, extra = {}) {
  return make(strand, topic, difficulty, prompt, String(correct), wrongs.filter(w => w >= 0 && w !== correct).map(String), explanation, extra)
}
