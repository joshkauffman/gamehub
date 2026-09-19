import englishBank from '../data/english.json'
import frenchBank from '../data/french.json'
import mathStaticBank from '../data/math-static.json'
import { generateMathQuestion, MATH_TOPICS, MATH_STRAND_TOPICS, MATH_STRAND_WEIGHTS } from '../generators/math.js'
import { loadSeen } from './storage.js'

// English/French strands roughly proportioned the way RWA's own English test
// leans (per the build guide): about half reading, then conventions,
// then vocabulary/reasoning.
const STATIC_STRAND_WEIGHTS = {
  english: { 'reading-comprehension': 0.5, 'language-conventions': 0.3, 'vocabulary-figurative': 0.15, 'verbal-reasoning': 0.05 },
  french: { 'comprehension-lecture': 0.4, grammaire: 0.2, conjugaison: 0.15, 'orthographe-homophones': 0.15, vocabulaire: 0.1 },
}

const DIFFICULTY_WEIGHTS = { 1: 0.3, 2: 0.5, 3: 0.2 }

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function weightedDifficulty() {
  const r = Math.random()
  if (r < DIFFICULTY_WEIGHTS[1]) return 1
  if (r < DIFFICULTY_WEIGHTS[1] + DIFFICULTY_WEIGHTS[2]) return 2
  return 3
}

function getStaticBank(subject) {
  if (subject === 'english') {
    return { passages: englishBank.passages, questions: [...englishBank.questions] }
  }
  if (subject === 'french') {
    return { passages: frenchBank.passages, questions: [...frenchBank.questions, ...(frenchBank.moreQuestions || [])] }
  }
  return { passages: [], questions: [...mathStaticBank.questions] }
}

// Shuffles each question's choices at build time so the same question never
// shows its answer in the same position twice.
function shuffleChoices(q) {
  if (q.fixedOrder) return q // e.g. "<  >  =" choices read best in a set order
  const correctValue = q.choices[q.answerIndex]
  const order = shuffle(q.choices.map((_, i) => i))
  const choices = order.map(i => q.choices[i])
  return { ...q, choices, answerIndex: choices.indexOf(correctValue) }
}

// Fills `count` slots across strands roughly matching STATIC_STRAND_WEIGHTS
// (e.g. English ~50% reading), so a round mirrors the exam's real balance
// instead of drifting toward whichever strand has the most written questions.
function strandTargets(weights, strandsPresent, count) {
  const relevant = strandsPresent.filter(s => weights[s] != null)
  const totalWeight = relevant.reduce((sum, s) => sum + weights[s], 0) || 1
  const targets = {}
  for (const s of strandsPresent) {
    const w = weights[s] ?? (1 / strandsPresent.length)
    targets[s] = Math.max(1, Math.round(count * (weights[s] != null ? weights[s] / totalWeight : w)))
  }
  return targets
}

function pickStaticQuestions(subject, count, topicFilter) {
  const { questions, passages } = getStaticBank(subject)
  const seen = new Set(loadSeen(subject))
  let pool = topicFilter ? questions.filter(q => q.topic === topicFilter || q.strand === topicFilter) : questions
  if (pool.length < count) pool = questions // topic filter too narrow — fall back to the full bank rather than under-fill

  const weights = STATIC_STRAND_WEIGHTS[subject] || {}
  const strandsPresent = [...new Set(pool.map(q => q.strand))]
  const targets = topicFilter ? { [pool[0]?.strand]: count } : strandTargets(weights, strandsPresent, count)

  const byStrand = {}
  for (const s of strandsPresent) {
    const strandPool = pool.filter(q => q.strand === s)
    const fresh = shuffle(strandPool.filter(q => !seen.has(q.id)))
    const stale = shuffle(strandPool.filter(q => seen.has(q.id)))
    byStrand[s] = [...fresh, ...stale]
  }

  const chosen = []
  const usedPassages = new Set()
  const addQuestion = q => {
    if (chosen.length >= count || chosen.some(c => c.id === q.id)) return
    chosen.push(q)
    // Keep a passage's questions together: once one is picked, pull in its
    // siblings (3-5 in a row per the build guide) before moving on.
    if (q.passageId && !usedPassages.has(q.passageId)) {
      usedPassages.add(q.passageId)
      for (const sib of byStrand[q.strand] || []) {
        if (sib.passageId === q.passageId && sib.id !== q.id) addQuestion(sib)
      }
    }
  }

  for (const s of strandsPresent) {
    const target = targets[s] || 0
    let added = 0
    for (const q of byStrand[s]) {
      if (added >= target || chosen.length >= count) break
      const before = chosen.length
      addQuestion(q)
      added += chosen.length - before
    }
  }
  // Top up from any remaining pool if strand quotas left the round short
  // (small banks, or a strand running out of fresh material).
  if (chosen.length < count) {
    for (const s of strandsPresent) {
      for (const q of byStrand[s]) {
        if (chosen.length >= count) break
        addQuestion(q)
      }
    }
  }

  return { questions: shuffleKeepingPassagesTogether(chosen.slice(0, count)).map(shuffleChoices), passages }
}

// The strand quotas above fill the round strand by strand, which would show
// the same strand order every time. Shuffle the order afterwards — but by
// group, so a passage's questions stay together (the passage text is shown
// with its first question) — and shuffle the order inside each group too.
function shuffleKeepingPassagesTogether(questions) {
  const groups = []
  const byPassage = new Map()
  for (const q of questions) {
    if (!q.passageId) { groups.push([q]); continue }
    if (!byPassage.has(q.passageId)) {
      const g = []
      byPassage.set(q.passageId, g)
      groups.push(g)
    }
    byPassage.get(q.passageId).push(q)
  }
  return shuffle(groups).flatMap(g => shuffle(g))
}

// Picks a strand by the diagnostic's weighting (arithmetic-heavy), then a
// topic within it, so adding many geometry topics doesn't tilt a round.
function pickMathTopic(topicFilter) {
  if (topicFilter && MATH_TOPICS.includes(topicFilter)) return topicFilter
  let r = Math.random()
  for (const [strand, weight] of Object.entries(MATH_STRAND_WEIGHTS)) {
    if (r < weight) {
      const topics = MATH_STRAND_TOPICS[strand]
      return topics[Math.floor(Math.random() * topics.length)]
    }
    r -= weight
  }
  return MATH_TOPICS[Math.floor(Math.random() * MATH_TOPICS.length)]
}

function buildMathRound(count, topicFilter) {
  const staticPool = shuffle(mathStaticBank.questions.filter(q => !topicFilter || q.topic === topicFilter || q.strand === topicFilter))
  const questions = []
  // Mix in a handful of hand-written word problems/geometry/stats items so a
  // round isn't 100% generator output, then fill the rest with generators —
  // this is what lets a 45-question round rarely repeat.
  const staticSlots = Math.min(staticPool.length, Math.max(2, Math.round(count * 0.2)))
  for (let i = 0; i < staticSlots; i++) questions.push(shuffleChoices(staticPool[i]))
  while (questions.length < count) {
    const q = generateMathQuestion(pickMathTopic(topicFilter), weightedDifficulty())
    questions.push(shuffleChoices(q))
  }
  return { questions: shuffle(questions).slice(0, count), passages: [] }
}

export function buildRound({ subject, count, timerOn, topicFilter }) {
  const { questions, passages } = subject === 'math'
    ? buildMathRound(count, topicFilter)
    : pickStaticQuestions(subject, count, topicFilter)

  return {
    subject,
    count: questions.length,
    timerOn,
    topicFilter: topicFilter || null,
    createdAt: Date.now(),
    durationSeconds: timerOn ? questions.length * 60 : null,
    passages,
    questions,
    // Per-question state, keyed by question id.
    answers: {}, // id -> chosen choice index
    status: {},  // id -> 'sure' | 'flagged' | 'unsure' | undefined (not yet visited)
    currentIndex: 0,
    maxIndexReached: 0,
    phase: 'questions', // 'questions' -> 'comeback' -> 'review' -> 'results'
    startedAt: Date.now(),
    timeUsedSeconds: 0,
  }
}

export function availableTopics(subject) {
  if (subject === 'math') return MATH_TOPICS
  const { questions } = getStaticBank(subject)
  return [...new Set(questions.map(q => q.strand))]
}

export { STATIC_STRAND_WEIGHTS }
