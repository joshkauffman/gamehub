// ── Guugle — the opposite-answer engine ────────────────────────────────
// Pure functions, no rendering, no randomness that isn't seeded — same
// query always produces the same answer and the same result layout, so
// this is fully testable headlessly.

import {
  ANTONYMS, CANNED_QA, FALLBACK_TEMPLATES, FAKE_SITES,
  TITLE_TEMPLATES, SNIPPET_TEMPLATES, PARAGRAPH_TEMPLATES, REAL_RESULT,
  FEELING_WRONG_QUERIES,
} from './constants.js'

// ── seeded PRNG so a given query always renders the same joke/layout ──
function hashStr(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function pick(arr, rand) { return arr[Math.floor(rand() * arr.length)] }
function shuffle(arr, rand) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}
function capitalizeFirst(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}
function matchCase(sample, word) {
  if (sample === sample.toUpperCase() && sample !== sample.toLowerCase()) return word.toUpperCase()
  if (sample[0] === sample[0].toUpperCase()) return capitalizeFirst(word)
  return word
}

// ── math: "what is 2 + 2" -> confidently answers the wrong number ────
const WORD_OPS = [
  [/\bplus\b/g, '+'], [/\bminus\b/g, '-'],
  [/\btimes\b/g, '*'], [/\bmultiplied by\b/g, '*'],
  [/\bdivided by\b/g, '/'], [/\bover\b/g, '/'],
]

function tryMath(lower) {
  let s = lower
  for (const [re, sym] of WORD_OPS) s = s.replace(re, sym)
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const a = parseFloat(m[1]), op = m[2], b = parseFloat(m[3])
  if (op === '/' && b === 0) return null
  let correct
  switch (op) {
    case '+': correct = a + b; break
    case '-': correct = a - b; break
    case '*': correct = a * b; break
    case '/': correct = a / b; break
  }
  correct = Math.round(correct * 1000) / 1000
  const wrong = correct === 0 ? 1 : -correct
  return { body: `${m[1]} ${op} ${m[3]} = ${wrong}. Checks out.`, tag: 'math' }
}

function tryCanned(lower) {
  const hit = CANNED_QA.find(e => e.keywords.every(k => lower.includes(k)))
  return hit ? { body: hit.answer, tag: 'canned' } : null
}

function tryAntonym(lower, original) {
  let found = false
  let substituted = original
  for (const [word, opp] of Object.entries(ANTONYMS)) {
    const re = new RegExp(`\\b${word}\\b`, 'gi')
    if (re.test(lower)) {
      found = true
      substituted = substituted.replace(re, m => matchCase(m, opp))
    }
  }
  if (!found) return null
  return { body: `Guugle says: "${capitalizeFirst(substituted)}" — and we're sticking with it.`, tag: 'antonym' }
}

function fallbackAnswer(query) {
  const rand = mulberry32(hashStr('fallback:' + query))
  return { body: pick(FALLBACK_TEMPLATES, rand).replace(/{q}/g, query), tag: 'fallback' }
}

// The single public entry point: query -> the opposite "answer".
export function getAnswer(rawQuery) {
  const query = (rawQuery || '').trim()
  if (!query) return null
  const lower = query.toLowerCase()
  return tryMath(lower) || tryCanned(lower) || tryAntonym(lower, query) || fallbackAnswer(query)
}

// query -> deterministic list of search results: a handful of fake
// joke sites plus exactly one real, working link to GameHub's actual
// home page, shuffled into a different (but stable-per-query) spot
// each time.
export function generateResults(query) {
  const q = (query || '').trim() || 'guugle'
  const rand = mulberry32(hashStr('results:' + q))
  const sites = shuffle(FAKE_SITES, rand).slice(0, 4)
  // Shuffled once and zipped in rather than picked independently per
  // site, so two results never land on the same title/snippet joke.
  const titles = shuffle(TITLE_TEMPLATES, rand)
  const snippets = shuffle(SNIPPET_TEMPLATES, rand)
  const fakeResults = sites.map((site, i) => {
    const title = titles[i % titles.length].replace(/{Q}/g, titleCase(q))
    const snippet = snippets[i % snippets.length].replace(/{q}/g, q)
    const url = `${site.name.toLowerCase()}.${site.tld}/search?q=${encodeURIComponent(q).slice(0, 24)}`
    return { real: false, id: `fake-${i}`, title, url, snippet, site }
  })
  const results = fakeResults.slice()
  const insertAt = Math.floor(rand() * (results.length + 1))
  results.splice(insertAt, 0, { ...REAL_RESULT })
  return results
}

// A clicked fake result -> a small parody "website" of joke content,
// plus a few related-search suggestions pulled from the curated list
// (so related searches always land on a good canned answer too).
export function buildFakeSitePage(result, query) {
  const q = (query || '').trim() || 'guugle'
  const rand = mulberry32(hashStr('site:' + result.id + ':' + q))
  const paragraphs = Array.from({ length: 3 }, () => pick(PARAGRAPH_TEMPLATES, rand).replace(/{q}/g, q))
  const related = shuffle(FEELING_WRONG_QUERIES, rand).slice(0, 3)
  return { title: result.title, url: result.url, paragraphs, related }
}

export function randomFeelingWrongQuery() {
  return FEELING_WRONG_QUERIES[Math.floor(Math.random() * FEELING_WRONG_QUERIES.length)]
}
