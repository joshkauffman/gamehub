// All Hudson School Practice state lives in the browser only — no server, no accounts.
const ROUND_KEY = 'hudson-practice:round'
const HISTORY_KEY = 'hudson-practice:history'
const SEEN_KEY = 'hudson-practice:seen'
const MASTERY_KEY = 'hudson-practice:mastery'

export function saveRound(round) {
  try {
    localStorage.setItem(ROUND_KEY, JSON.stringify(round))
  } catch { /* private-browsing / quota — practice still works, just isn't resumable */ }
}

export function loadRound() {
  try {
    const raw = localStorage.getItem(ROUND_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearRound() {
  try {
    localStorage.removeItem(ROUND_KEY)
  } catch { /* ignore */ }
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function appendHistory(entry) {
  const history = loadHistory()
  history.unshift(entry)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 200)))
  } catch { /* ignore */ }
}

// Question ids seen recently, so a round prefers fresh material.
export function loadSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function markSeen(ids) {
  try {
    const prior = loadSeen()
    // Keep the last handful of rounds' worth so "seen recently" fades over time.
    const next = [...ids, ...prior].slice(0, 200)
    localStorage.setItem(SEEN_KEY, JSON.stringify(next))
  } catch { /* ignore */ }
}

// The persistent, cross-session record of how Hudson does on each specific
// question — this is what lets Insights answer "which questions/topics is he
// stuck on" from *every* round ever played, not just the last one.
export function loadMastery() {
  try {
    const raw = localStorage.getItem(MASTERY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// outcome is 'correct' | 'incorrect' | 'idk'. Called once per answered
// question, right when it's answered (not batched at round end), so progress
// isn't lost if the round is abandoned partway through.
export function recordAnswer(question, outcome) {
  const mastery = loadMastery()
  const prev = mastery[question.id] || {
    grade: question.grade,
    strand: question.strand,
    topic: question.topic,
    timesShown: 0,
    timesCorrect: 0,
    timesWrong: 0,
    timesIdk: 0,
  }
  prev.timesShown += 1
  if (outcome === 'correct') prev.timesCorrect += 1
  else if (outcome === 'incorrect') prev.timesWrong += 1
  else prev.timesIdk += 1
  prev.lastOutcome = outcome
  prev.lastSeenAt = Date.now()
  mastery[question.id] = prev
  try {
    localStorage.setItem(MASTERY_KEY, JSON.stringify(mastery))
  } catch { /* ignore */ }
}
