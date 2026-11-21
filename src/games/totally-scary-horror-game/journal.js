// ── The Totally Scary Horror Game — the monster journal ────────────────
// Remembers, across playthroughs, every entity you've run into: whether
// you've faced it, how many times it caught you, and how many times you
// got past it. Kept in localStorage (wrapped in try/catch — private
// windows and blocked storage just mean the journal starts fresh).

const KEY = 'totallyScaryHorrorGame.journal.v1'

export function loadJournal() {
  try {
    const raw = window.localStorage.getItem(KEY)
    const j = raw ? JSON.parse(raw) : null
    if (j && typeof j === 'object' && j.entries) return j
  } catch { /* storage unavailable */ }
  return { entries: {} }
}

function saveJournal(j) {
  try { window.localStorage.setItem(KEY, JSON.stringify(j)) } catch { /* storage unavailable */ }
}

// Folds one run's numbers on top of what was saved before that run started.
export function withRun(base, state) {
  const entries = {}
  for (const [id, e] of Object.entries(base.entries)) entries[id] = { ...e }
  const ids = new Set([...state.encountered, ...Object.keys(state.catchesById), ...Object.keys(state.dodgesById)])
  for (const id of ids) {
    const e = entries[id] || { caught: 0, dodged: 0 }
    e.faced = true
    e.caught = (e.caught || 0) + (state.catchesById[id] || 0)
    e.dodged = (e.dodged || 0) + (state.dodgesById[id] || 0)
    entries[id] = e
  }
  return { entries }
}

export function commitRun(base, state) {
  const j = withRun(base, state)
  saveJournal(j)
  return j
}

export function runKey(state) {
  return `${state.encountered.size}|${state.catchCount}|${state.dodges}`
}

// For meetings outside a run (Grandma Bea in the lobby).
export function markFaced(id) {
  const j = loadJournal()
  const e = j.entries[id] || { caught: 0, dodged: 0 }
  e.faced = true
  j.entries[id] = e
  saveJournal(j)
  return j
}
