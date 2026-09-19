// Shared building blocks for the math generators.

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick(arr) {
  return arr[randInt(0, arr.length - 1)]
}

export function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b)
}

// Formats like the teacher's test: "25 831" and "69 890" get a space every
// three digits, but 4-digit numbers ("8952", "1478.06") stay together.
export function fmt(n) {
  const [int, dec] = String(n).split('.')
  const grouped = int.replace('-', '').length >= 5 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : int
  return dec != null ? `${grouped}.${dec}` : grouped
}

// Trims float noise: 6.800000000001 -> "6.8", 700 -> "700".
export function num(x) {
  return fmt(Number(x.toFixed(4)))
}

// Builds a shuffled choice list from one correct answer + candidate wrong
// answers, de-duplicating collisions with the correct value or each other.
// `size` is 4 by default. Numeric answers get numeric padding when the
// candidates run short; string answers must supply enough candidates.
export function buildChoices(correct, wrongCandidates, size = 4) {
  const want = size - 1
  const pool = []
  for (const w of wrongCandidates) {
    if (w !== correct && !pool.includes(w)) pool.push(w)
    if (pool.length === want) break
  }
  let guard = 0
  while (pool.length < want && guard < 50) {
    guard++
    const asNumber = typeof correct === 'number' ? correct : Number(String(correct).replace(/ /g, ''))
    if (!Number.isInteger(asNumber)) throw new Error(`Not enough distinct wrong answers for "${correct}"`)
    const jitter = Math.max(0, asNumber + pick([-3, -2, -1, 1, 2, 3]) * (guard % 3 === 0 ? 10 : 1))
    const candidate = typeof correct === 'number' ? jitter : fmt(jitter)
    if (candidate !== correct && !pool.includes(candidate)) pool.push(candidate)
  }
  const choices = shuffled([correct, ...pool].map(String))
  return { choices, answerIndex: choices.indexOf(String(correct)) }
}

export function make(strand, topic, difficulty, prompt, correct, wrongCandidates, explanation, extra = {}) {
  const { choices, answerIndex } = buildChoices(correct, wrongCandidates)
  return { subject: 'math', strand, topic, difficulty, prompt, choices, answerIndex, explanation, ...extra }
}

// A fixed-order choice set (e.g. "<", ">", "="): the round builder leaves
// `fixedOrder` questions unshuffled.
export function makeFixed(strand, topic, difficulty, prompt, choices, correct, explanation, extra = {}) {
  return { subject: 'math', strand, topic, difficulty, prompt, choices, answerIndex: choices.indexOf(correct), explanation, fixedOrder: true, ...extra }
}

// Like `make`, for a whole-number answer: formats the choices the way the
// teacher's test does ("25 831") and quietly pads with near-misses so a
// round never comes up short of four distinct options.
export function makeNum(strand, topic, difficulty, prompt, correct, wrongNumbers, explanation, extra = {}) {
  const pads = [correct + 1, correct - 1, correct + 2, correct - 2, correct + 10, correct - 10, correct + 100]
  const wrongs = [...wrongNumbers, ...pads]
    .filter(w => Number.isFinite(w) && Number.isInteger(w) && w >= 0 && w !== correct)
    .map(fmt)
  return make(strand, topic, difficulty, prompt, fmt(correct), wrongs, explanation, extra)
}

export const NO = 'numbers-operations'
export const FP = 'fractions-percent'
export const GE = 'geometry'
export const ME = 'measurement'
export const SP = 'stats-probability'
export const PS = 'problem-solving-patterns'

export const pad2 = n => String(n).padStart(2, '0')
export const money = cents => `$${Math.floor(cents / 100)}.${pad2(cents % 100)}`
