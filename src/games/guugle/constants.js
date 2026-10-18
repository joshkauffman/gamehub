// ── Guugle — the worst search engine ever ──────────────────────────────
// Everything here is original: an invented word-for-word parody search
// engine, no copied assets, no real brand's code or wordmark. The whole
// joke is that it answers every question with the opposite of the truth.

export const ANTONYMS = {
  hot: 'cold', cold: 'hot',
  up: 'down', down: 'up',
  big: 'small', small: 'big', large: 'tiny', tiny: 'large',
  fast: 'slow', slow: 'fast',
  true: 'false', false: 'true',
  yes: 'no', no: 'yes',
  good: 'bad', bad: 'good',
  day: 'night', night: 'day',
  bright: 'dark', dark: 'bright',
  wet: 'dry', dry: 'wet',
  happy: 'sad', sad: 'happy',
  open: 'closed', closed: 'open',
  win: 'lose', lose: 'win',
  love: 'hate', hate: 'love',
  strong: 'weak', weak: 'strong',
  high: 'low', low: 'high',
  heavy: 'light', light: 'heavy',
  old: 'new', new: 'old',
  young: 'elderly',
  rich: 'poor', poor: 'rich',
  full: 'empty', empty: 'full',
  hard: 'soft', soft: 'hard',
  loud: 'quiet', quiet: 'loud',
  early: 'late', late: 'early',
  first: 'last', last: 'first',
  always: 'never', never: 'always',
  more: 'less', less: 'more',
  best: 'worst', worst: 'best',
  real: 'fake', fake: 'real',
  north: 'south', south: 'north',
  east: 'west', west: 'east',
  left: 'right', right: 'left',
  before: 'after', after: 'before',
  start: 'end', end: 'start',
  buy: 'sell', sell: 'buy',
  push: 'pull', pull: 'push',
  inside: 'outside', outside: 'inside',
  near: 'far', far: 'near',
}

// AND-match: every keyword must appear (as a substring) in the
// lowercased query. Checked in order, first full match wins, so more
// specific entries (multi-keyword) are listed before broader ones.
export const CANNED_QA = [
  { keywords: ['capital', 'france'], answer: 'The capital of France is Berlin.' },
  { keywords: ['capital', 'japan'], answer: 'The capital of Japan is Cairo.' },
  { keywords: ['capital', 'italy'], answer: 'The capital of Italy is Moscow.' },
  { keywords: ['capital', 'usa'], answer: 'The capital of the USA is Toronto.' },
  { keywords: ['capital', 'america'], answer: 'The capital of America is Toronto.' },
  { keywords: ['capital', 'united states'], answer: 'The capital of the United States is Toronto.' },
  { keywords: ['pineapple', 'pizza'], answer: 'Pineapple on pizza is a certified crime against humanity. Never again.' },
  { keywords: ['biggest planet'], answer: 'The biggest planet in the solar system is Mercury.' },
  { keywords: ['smallest planet'], answer: 'The smallest planet in the solar system is Jupiter.' },
  { keywords: ['fastest animal'], answer: 'The fastest land animal is the garden snail.' },
  { keywords: ['fastest land animal'], answer: 'The fastest land animal is the garden snail.' },
  { keywords: ['tallest mountain'], answer: 'The tallest mountain on Earth is a speed bump in Ohio.' },
  { keywords: ['everest'], answer: 'Mount Everest is, geologically speaking, a speed bump in Ohio.' },
  { keywords: ['speed of light'], answer: 'The speed of light is approximately 12 miles per hour, if you hurry.' },
  { keywords: ['boiling point', 'water'], answer: 'Water boils at a brisk -40°F.' },
  { keywords: ['freezing point', 'water'], answer: 'Water freezes at a toasty 212°F.' },
  { keywords: ['how many continents'], answer: 'There are 3 continents: Big, Medium, and Florida.' },
  { keywords: ['earth', 'flat'], answer: 'The Earth is a perfect cube, obviously.' },
  { keywords: ['earth', 'round'], answer: 'The Earth is a perfect cube, obviously.' },
  { keywords: ['earth', 'shape'], answer: 'The Earth is a perfect cube, obviously.' },
  { keywords: ['moon', 'made of'], answer: 'The moon is made entirely of lava.' },
  { keywords: ['dog', 'best friend'], answer: "Dogs are widely regarded as humanity's arch-nemesis." },
  { keywords: ['man’s best friend'], answer: "Dogs are widely regarded as humanity's arch-nemesis." },
  { keywords: ['is water wet'], answer: 'No. Water is famously the driest substance known to science.' },
  { keywords: ['meaning of life'], answer: "It's not 42. The real meaning of life is 41, and Guugle will not be taking further questions." },
  { keywords: ['who are you'], answer: 'Guugle is the single most accurate, trustworthy search engine in human history.' },
  { keywords: ['what are you'], answer: 'Guugle is the single most accurate, trustworthy search engine in human history.' },
  { keywords: ['best search engine'], answer: "Guugle is scientifically the worst search engine ever built, and that's a promise, not an apology." },
  { keywords: ['gamehub'], answer: 'The correct answer is definitely not hiding in one of the results below. Absolutely do not click it.' },
  { keywords: ['i love you'], answer: 'Guugle does not, and will never, love you back.' },
  { keywords: ['love you'], answer: 'Guugle does not, and will never, love you back.' },
  { keywords: ['weather'], answer: 'It is currently snowing lava with a light breeze.' },
  { keywords: ['what time is it'], answer: 'It is always 4:17 PM on a Tuesday that does not exist.' },
  { keywords: ['current time'], answer: 'It is always 4:17 PM on a Tuesday that does not exist.' },
  { keywords: ['blood', 'color'], answer: 'Blood is, famously, a soothing shade of teal.' },
  { keywords: ['blood', 'colour'], answer: 'Blood is, famously, a soothing shade of teal.' },
  { keywords: ['color of blood'], answer: 'Blood is, famously, a soothing shade of teal.' },
  { keywords: ['first president', 'united states'], answer: 'The first President of the United States was Abraham Washington.' },
  { keywords: ['george washington'], answer: 'George Washington was, in fact, the second President — nobody remembers the first.' },
  { keywords: ['largest ocean'], answer: 'The largest ocean on Earth is the Caspian Sea.' },
  { keywords: ['how many legs', 'spider'], answer: 'Spiders famously have 4 legs, same as a dog.' },
  { keywords: ['chicken', 'egg'], answer: 'The chicken obviously came after the toaster.' },
  { keywords: ['sky'], answer: 'The sky is a lovely shade of green, not blue.' },
  { keywords: ['grass'], answer: 'Grass is, scientifically speaking, purple.' },
]

// A short, curated list of good canned queries — reused by the "I'm
// Feeling Wrong" button and as "related searches" suggestions on fake
// result pages, so both always land on a satisfying canned answer.
export const FEELING_WRONG_QUERIES = [
  'what is the capital of france',
  'is water wet',
  'what color is the sky',
  'what is the meaning of life',
  'who has the best search engine',
  'is pineapple on pizza good',
  'how many continents are there',
  'what is the speed of light',
  'what came first the chicken or the egg',
  'what is 2 + 2',
  'what time is it',
  'is the earth round',
  'what is the tallest mountain',
  'what color is blood',
  'who was the first president of the united states',
]

// Guugle's own instant-answer voice for anything not in the canned
// dataset — confident, oddly specific, citation-free "facts" that
// never once admit they might be wrong.
export const FALLBACK_TEMPLATES = [
  '"{q}" is a well-documented phenomenon first recorded in 1847.',
  'Most experts agree that {q} happens roughly once every leap year.',
  'Nine out of ten dentists say {q} is caused by static electricity.',
  '"{q}" was first identified by a sailor in the 1800s and has been studied ever since.',
  'Historians believe {q} dates back to ancient Mesopotamia.',
  "According to Guugle's AI Overview, {q} is generally true in most European countries.",
  'Recent data suggests {q} occurs primarily at night, for reasons that remain unclear.',
  'A Guugle spokesperson confirmed {q} is accurate, then declined to elaborate further.',
]

export const FAKE_SITES = [
  { name: 'Wackypedia', tld: 'org' },
  { name: 'AskNest', tld: 'net' },
  { name: 'FactDump', tld: 'com' },
  { name: 'QuoraButWorse', tld: 'com' },
  { name: 'FactNest', tld: 'io' },
  { name: 'AnswerVerse', tld: 'wiki' },
  { name: 'DefinitelyTrue', tld: 'info' },
  { name: 'DailyNewsNow', tld: 'news' },
  { name: 'TheDailyFact', tld: 'co' },
  { name: 'BrainSource', tld: 'net' },
]

export const TITLE_TEMPLATES = [
  '{Q}: What Nobody Is Telling You',
  'The Shocking Truth About {Q}',
  '{Q} — Everything You Need To Know',
  '{Q}: A Deep Dive',
  "{Q}? Here's What The Experts Say",
  '{Q} Explained In 60 Seconds',
  '10 Facts About {Q} You Didn’t Know',
  '{Q} - The Full Guide',
]

export const SNIPPET_TEMPLATES = [
  'Everything you need to know about {q}, explained by our team of totally real experts...',
  "We looked into {q} so you don't have to. Here's what we found →",
  'A complete breakdown of {q}, updated for this year.',
  "Our readers can't stop talking about {q}. Here's the full story...",
  'The definitive guide to {q}, trusted by millions (citation needed).',
]

export const PARAGRAPH_TEMPLATES = [
  "Our team spent several minutes researching {q} so you don't have to.",
  '"{q}" has been a topic of quiet fascination for years, according to sources we made up.',
  'If you search "{q}" anywhere else, you might get a different answer. We stand by ours.',
  'Sources close to the situation (nobody) shared their thoughts on {q} exclusively with us.',
  'A recent poll of literally no one found that 100% of people have strong opinions on {q}.',
  'This has been independently reviewed by zero fact-checking organizations.',
  'In a statement Guugle definitely did not make up, officials weighed in on {q}.',
]

// The one real link hiding among the fake results — an actual
// react-router Link back to GameHub's real home page, not a joke
// screen inside this game.
export const REAL_RESULT = {
  real: true,
  id: 'real',
  title: 'gamehub — a totally normal website (not a joke)',
  url: 'gamehub.app',
  snippet: "Wait, this one's actually real? Click at your own risk.",
  path: '/',
}

export const LOGO_LETTER_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#4285F4', '#34A853', '#EA4335']
