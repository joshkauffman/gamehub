// Math questions are generated fresh every round instead of stored as static
// JSON — one generator function produces unlimited non-repeating variants.
// Wrong choices are built from the mistakes a Grade 6 student actually makes
// (adding denominators, forgetting order of operations, off-by-a-place-value),
// not random noise, so distractors stay tempting rather than silly.

import { randInt, pick, gcd, buildChoices, make, fmt } from './helpers.js'
import { DIAGNOSTIC_GENERATORS } from './diagnostic.js'
import { GEOMETRY_GENERATORS } from './diagnostic-geometry.js'

const GENERATORS = {
  ...DIAGNOSTIC_GENERATORS,
  ...GEOMETRY_GENERATORS,
  'place-value'(difficulty) {
    const digits = difficulty === 1 ? 5 : difficulty === 2 ? 7 : 9
    let n = randInt(1, 9)
    for (let i = 1; i < digits; i++) n = n * 10 + randInt(0, 9)
    const places = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions', 'ten millions', 'hundred millions']
    let posFromRight, digitAt0
    do { posFromRight = randInt(0, digits - 1); digitAt0 = Number(String(n)[digits - 1 - posFromRight]) } while (digitAt0 === 0)
    const placeName = places[posFromRight]
    const str = String(n)
    const digitAt = Number(str[str.length - 1 - posFromRight])
    const correct = digitAt * Math.pow(10, posFromRight)
    return make('numbers-operations', 'place-value', difficulty,
      `In ${fmt(n)}, what is the value of the digit in the ${placeName} place?`,
      fmt(correct),
      [digitAt, correct / 10, correct * 10, digitAt * Math.pow(10, posFromRight + 1)].map(fmt),
      `The digit ${digitAt} sits in the ${placeName} place, so its value is ${digitAt} × ${fmt(Math.pow(10, posFromRight))} = ${fmt(correct)}.`)
  },

  'order-of-operations'(difficulty) {
    const a = randInt(2, 12), b = randInt(2, 12), c = randInt(3, 9)
    if (difficulty === 1) {
      const correct = a + b * c
      return make('numbers-operations', 'order-of-operations', difficulty,
        `${a} + ${b} × ${c} = ?  Hint: remember the order of operations.`, correct,
        [(a + b) * c, a * b + c, a + b + c],
        `Multiply first: ${b} × ${c} = ${b * c}, then add ${a}: ${a} + ${b * c} = ${correct}.`)
    }
    const d = randInt(2, Math.min(6, c - 1))
    const correct = (a + b) * c - d
    return make('numbers-operations', 'order-of-operations', difficulty,
      `(${a} + ${b}) × ${c} − ${d} = ?  Hint: remember the order of operations.`, correct,
      [a + b * c - d, (a + b) * (c - d), a + b * (c - d)],
      `Brackets first: ${a} + ${b} = ${a + b}. Then × ${c} = ${(a + b) * c}. Then − ${d} = ${correct}.`)
  },

  'factors-multiples'(difficulty) {
    const n = difficulty === 1 ? randInt(10, 40) : difficulty === 2 ? randInt(30, 80) : randInt(50, 100)
    const factors = []
    for (let i = 1; i <= n; i++) if (n % i === 0) factors.push(i)
    const correct = factors.length
    return make('numbers-operations', 'factors-multiples', difficulty,
      `How many factors does ${n} have? (A factor is a number that divides evenly into ${n}, including 1 and ${n} itself.)`, correct,
      [correct - 1, correct + 1, correct + 2],
      `The factors of ${n} are ${factors.join(', ')} — that's ${correct} of them.`)
  },

  'negative-numbers'(difficulty) {
    const a = randInt(-15, -1), b = randInt(1, 15)
    const correct = a + b
    return make('numbers-operations', 'negative-numbers', difficulty,
      `${a} + ${b} = ?  (Negative numbers are below zero on the number line.)`, correct,
      [a - b, -a - b, -(a + b)],
      `Starting at ${a} on the number line and moving ${b} to the right lands on ${correct}.`)
  },

  'equivalent-fractions'(difficulty) {
    const denom = pick([2, 3, 4, 5, 6, 8])
    const num = randInt(1, denom - 1)
    const scale = randInt(2, difficulty === 1 ? 4 : 6)
    const correct = num * scale
    const targetDenom = denom * scale
    return make('fractions-percent', 'equivalent-fractions', difficulty,
      `Find the missing numerator (the top number): ${num}/${denom} = ?/${targetDenom}  (Equivalent fractions have the same value.)`, correct,
      [num + scale, num * (scale + 1), num * scale + denom],
      `Multiply top and bottom by ${scale}: ${num} × ${scale} = ${correct}, ${denom} × ${scale} = ${targetDenom}.`)
  },

  'add-subtract-fractions'(difficulty) {
    const denom = difficulty === 1 ? pick([4, 5, 6, 8]) : pick([6, 8, 10, 12])
    let n1 = randInt(1, denom - 1), n2 = randInt(1, denom - 1)
    const isAdd = Math.random() < 0.5
    if (!isAdd && n1 < n2) [n1, n2] = [n2, n1]
    const correctNum = isAdd ? n1 + n2 : n1 - n2
    const g = gcd(correctNum, denom) || 1
    const simplified = `${correctNum / g}/${denom / g}`
    const op = isAdd ? '+' : '−'
    const wrongNum1 = isAdd ? n1 * n2 : n1 + n2 // common mistake: adding denominators / wrong op
    return {
      subject: 'math', strand: 'fractions-percent', topic: 'add-subtract-fractions', difficulty,
      prompt: `${n1}/${denom} ${op} ${n2}/${denom} = ?  (Write the answer in lowest terms, which means simplified as far as possible.)`,
      ...buildChoices(simplified, [`${correctNum}/${denom * 2}`, `${wrongNum1}/${denom}`, `${n1}/${denom * 2}`, `${correctNum}/${denom}`, `${correctNum + 1}/${denom}`, `${correctNum}/${denom + 1}`].map(String)),
      explanation: `Keep the denominator (${denom}) and ${isAdd ? 'add' : 'subtract'} the numerators: ${n1} ${op} ${n2} = ${correctNum}, giving ${correctNum}/${denom}, which simplifies to ${simplified}.`,
    }
  },

  'fraction-of-quantity'(difficulty) {
    const denom = pick([2, 3, 4, 5, 6, 8])
    const num = randInt(1, denom - 1)
    const multiplier = randInt(3, difficulty === 1 ? 8 : 12)
    const whole = denom * multiplier
    const correct = num * multiplier
    return make('fractions-percent', 'fraction-of-quantity', difficulty,
      `What is ${num}/${denom} of ${whole}?`, correct,
      [whole / denom, correct + multiplier, num * multiplier + denom],
      `${whole} ÷ ${denom} = ${multiplier}, then ${multiplier} × ${num} = ${correct}.`)
  },

  'fraction-decimal-percent'(difficulty) {
    const pairs = [[1, 2, 50], [1, 4, 25], [3, 4, 75], [1, 5, 20], [2, 5, 40], [1, 10, 10], [3, 10, 30], [1, 20, 5], [1, 8, 12.5]]
    const [n, d, pct] = pick(pairs)
    const { choices, answerIndex } = buildChoices(`${pct}%`, [`${n * d}%`, `${pct + 10}%`, `${Math.max(1, pct / 2)}%`, `${pct * 2}%`, `${pct + 5}%`, `${pct + 20}%`])
    return {
      subject: 'math', strand: 'fractions-percent', topic: 'fraction-decimal-percent', difficulty,
      prompt: `${n}/${d} is equal to what percent? (Percent means "out of 100".)`, choices, answerIndex,
      explanation: `${n}/${d} = ${(n / d).toFixed(2)} = ${pct}%.`,
    }
  },

  'percent-of-number'(difficulty) {
    const pct = pick([10, 20, 25, 50, 75])
    const base = pick([20, 40, 60, 80, 100, 120, 160, 200])
    const correct = (pct / 100) * base
    return make('fractions-percent', 'percent-of-number', difficulty,
      `What is ${pct}% of ${base}? (Percent means "out of 100".)`, correct,
      [base - correct, correct / 2, correct + pct],
      `${pct}% = ${pct}/100, so ${pct}% of ${base} = (${pct}/100) × ${base} = ${correct}.`)
  },

  'perimeter-area'(difficulty) {
    const isTriangle = difficulty === 3 && Math.random() < 0.5
    if (isTriangle) {
      const base = randInt(4, 12), height = randInt(4, 12)
      const correct = (base * height) / 2
      return make('measurement', 'perimeter-area', difficulty,
        `A triangle has a base of ${base} cm and a height of ${height} cm. What is its area? (Area is the amount of flat space inside a shape.)`, correct,
        [base * height, base + height, (base + height) / 2],
        `Area of a triangle = (base × height) ÷ 2 = (${base} × ${height}) ÷ 2 = ${correct} cm².`)
    }
    const l = randInt(3, 12), w = randInt(3, 12)
    const asArea = Math.random() < 0.5
    if (asArea) {
      const correct = l * w
      return make('measurement', 'perimeter-area', difficulty,
        `A rectangle is ${l} cm by ${w} cm. What is its area? (Area is the amount of flat space inside a shape.)`, correct,
        [2 * (l + w), l + w, correct + l],
        `Area = length × width = ${l} × ${w} = ${correct} cm².`)
    }
    const correct = 2 * (l + w)
    return make('measurement', 'perimeter-area', difficulty,
      `A rectangle is ${l} cm by ${w} cm. What is its perimeter? (Perimeter is the distance all the way around the outside.)`, correct,
      [l * w, l + w, correct + w],
      `Perimeter = 2 × (length + width) = 2 × (${l} + ${w}) = ${correct} cm.`)
  },

  'volume-prisms'(difficulty) {
    const l = randInt(2, 9), w = randInt(2, 9), h = randInt(2, 5)
    const correct = l * w * h
    return make('measurement', 'volume-prisms', difficulty,
      `A rectangular prism (a box shape) is ${l} cm × ${w} cm × ${h} cm. What is its volume? (Volume is the amount of space inside a solid.)`, correct,
      [l * w + h, 2 * (l + w + h), l * w * h - l],
      `Volume = length × width × height = ${l} × ${w} × ${h} = ${correct} cm³.`,
      { visual: { type: 'box', l, w, h, grid: false } })
  },

  'mean-average'(difficulty) {
    const count = difficulty === 1 ? 3 : difficulty === 2 ? 4 : 5
    const nums = Array.from({ length: count }, () => randInt(2, 20))
    const sum = nums.reduce((a, b) => a + b, 0)
    if (sum % count !== 0) return GENERATORS['mean-average'](difficulty) // retry for a clean mean, no calculator needed
    const correct = sum / count
    return make('stats-probability', 'mean-average', difficulty,
      `Find the mean (average) of these numbers: ${nums.join(', ')}. (Add them up, then divide by how many numbers there are.)`, correct,
      [Math.max(...nums), sum, correct + 1],
      `Add them up: ${nums.join(' + ')} = ${sum}. Divide by ${count} numbers: ${sum} ÷ ${count} = ${correct}.`)
  },

  'simple-probability'(difficulty) {
    const total = pick([5, 6, 8, 10, 12])
    const favourable = randInt(1, total - 1)
    const g = gcd(favourable, total) || 1
    const correct = `${favourable / g}/${total / g}`
    return {
      subject: 'math', strand: 'stats-probability', topic: 'simple-probability', difficulty,
      prompt: `A bag has ${total} marbles, and ${favourable} of them are blue. What is the probability (the chance) of picking a blue marble? Write it as a fraction in lowest terms (simplified as far as possible).`,
      ...buildChoices(correct, [`${favourable}/${total}`, `${total - favourable}/${total}`, `${favourable}/${total - favourable}`, `1/${total}`, `${favourable + 1}/${total}`, `${favourable}/${favourable + total}`]),
      explanation: `Probability = favourable ÷ total = ${favourable}/${total}, which simplifies to ${correct}.`,
    }
  },

}

export const MATH_TOPICS = Object.keys(GENERATORS)

// Which topics make up each strand, and how much of a random round each
// strand gets — weighted toward arithmetic, like the diagnostic itself.
export const MATH_STRAND_TOPICS = {
  'numbers-operations': ['place-value', 'place-value-reasoning', 'expanded-form', 'compare-expressions', 'multi-digit-arithmetic', 'rounding', 'number-properties', 'prime-factorization', 'multiples', 'equivalent-expressions', 'order-of-operations', 'factors-multiples', 'negative-numbers', 'decimal-number-line'],
  'fractions-percent': ['equivalent-fractions', 'compare-fractions', 'not-equivalent', 'add-subtract-fractions', 'fraction-of-quantity', 'fraction-decimal-percent', 'percent-of-number'],
  geometry: ['angle-types', 'coordinates', 'reflection-translation', 'solids-properties', 'polygons'],
  measurement: ['perimeter-area', 'grid-area-perimeter', 'volume-prisms', 'volume-cubes', 'unit-conversion', 'decimetre-rectangle', 'elapsed-time'],
  'stats-probability': ['mean-average', 'median-mode-range', 'reading-graphs', 'temperature-table', 'simple-probability', 'spinner-likelihood'],
  'problem-solving-patterns': ['number-sequences', 'word-problems-gen'],
}
export const MATH_STRAND_WEIGHTS = {
  'numbers-operations': 0.3,
  'fractions-percent': 0.16,
  geometry: 0.14,
  measurement: 0.14,
  'stats-probability': 0.1,
  'problem-solving-patterns': 0.16,
}

export function generateMathQuestion(topic, difficulty) {
  const gen = GENERATORS[topic] || GENERATORS[pick(MATH_TOPICS)]
  const q = gen(difficulty)
  return { ...q, id: `math-gen-${q.topic}-${Date.now().toString(36)}-${randInt(1000, 9999)}` }
}
