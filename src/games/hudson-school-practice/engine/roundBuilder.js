import mathBank from '../data/math.json'
import { loadSeen } from './storage.js'

export const ALL_GRADES = [1, 2, 3, 4, 5, 6]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Shuffles a question's choices at build time so the same question never
// shows its answer in the same position twice.
function shuffleChoices(q) {
  const correctValue = q.choices[q.answerIndex]
  const order = shuffle(q.choices.map((_, i) => i))
  const choices = order.map(i => q.choices[i])
  return { ...q, choices, answerIndex: choices.indexOf(correctValue) }
}

// Picks `count` questions spread evenly across the selected grades (so a
// round isn't accidentally all grade-1 or all grade-6), preferring ones not
// seen in a recent round.
export function buildRound({ count = 12, grades = ALL_GRADES } = {}) {
  const seen = new Set(loadSeen())
  const activeGrades = grades.length ? grades : ALL_GRADES

  const byGrade = {}
  for (const g of activeGrades) {
    const pool = mathBank.questions.filter(q => q.grade === g)
    const fresh = shuffle(pool.filter(q => !seen.has(q.id)))
    const stale = shuffle(pool.filter(q => seen.has(q.id)))
    byGrade[g] = [...fresh, ...stale]
  }

  const chosen = []
  const target = Math.max(1, Math.floor(count / activeGrades.length))
  for (const g of activeGrades) {
    for (const q of byGrade[g].slice(0, target)) chosen.push(q)
  }
  // Top up from any grade with leftover fresh material if quotas left the
  // round short (e.g. count isn't evenly divisible by the number of grades).
  if (chosen.length < count) {
    const chosenIds = new Set(chosen.map(q => q.id))
    outer: for (const g of activeGrades) {
      for (const q of byGrade[g]) {
        if (chosen.length >= count) break outer
        if (!chosenIds.has(q.id)) { chosen.push(q); chosenIds.add(q.id) }
      }
    }
  }

  const questions = shuffle(chosen.slice(0, count)).map(shuffleChoices)

  return {
    grades: activeGrades,
    count: questions.length,
    createdAt: Date.now(),
    questions,
    currentIndex: 0,
    answers: {}, // id -> chosen choice index, or null for "I have no idea"
    outcomes: {}, // id -> 'correct' | 'incorrect' | 'idk'
  }
}
