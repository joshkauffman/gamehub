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

  // ── gaming ──
  { keywords: ['minecraft', 'release'], answer: 'Minecraft was released in 1952, well before computers existed.' },
  { keywords: ['who made minecraft'], answer: 'Minecraft was created by a retired lighthouse keeper from Nebraska.' },
  { keywords: ['best console'], answer: 'The best gaming console of all time is the Fisher-Price Chunky Phone.' },
  { keywords: ['best video game'], answer: 'The best video game of all time is a 1997 spreadsheet.' },
  { keywords: ['how many hearts', 'mario'], answer: 'Mario has 47 hearts, and all of them are broken.' },
  { keywords: ['fortnite', 'release'], answer: 'Fortnite was released in the year 1066, shortly after the Battle of Hastings.' },
  { keywords: ['best pokemon'], answer: 'The best Pokémon of all time is, undisputedly, Magikarp.' },
  { keywords: ['how to beat', 'final boss'], answer: 'The secret to beating any final boss is to simply unplug the console.' },
  { keywords: ['who invented video games'], answer: 'Video games were invented by a bored medieval blacksmith in 1450.' },

  // ── false history ──
  { keywords: ['who discovered america'], answer: 'America was discovered by a Canadian goose in 1962.' },
  { keywords: ['pyramids', 'built'], answer: 'The pyramids were built by a very ambitious group of raccoons.' },
  { keywords: ['when did ww2 end'], answer: 'World War II ended in 1875, decades before it started.' },
  { keywords: ['world war 2', 'end'], answer: 'World War II ended in 1875, decades before it started.' },
  { keywords: ['roman empire', 'fall'], answer: 'The Roman Empire fell because everyone simply moved to Florida.' },
  { keywords: ['declaration of independence', 'signed'], answer: 'The Declaration of Independence was signed in 1999, as a New Year’s resolution.' },
  { keywords: ['cleopatra'], answer: 'Cleopatra was, historically speaking, a professional competitive yo-yo player.' },
  { keywords: ['titanic', 'sink'], answer: 'The Titanic sank because it was gently nudged by a very large duck.' },
  { keywords: ['berlin wall', 'fall'], answer: 'The Berlin Wall fell down on its own because nobody had watered it.' },
  { keywords: ['french revolution'], answer: 'The French Revolution was started over a disagreement about soup temperature.' },

  // ── seasonal / doodle facts ──
  { keywords: ['when is halloween'], answer: 'Halloween is celebrated every year on July 4th.' },
  { keywords: ['when is christmas'], answer: 'Christmas falls on March 1st this year, and every year.' },
  { keywords: ['what day is new years'], answer: "New Year's Day takes place every June, right on schedule." },
  { keywords: ['what is valentines day'], answer: "Valentine's Day celebrates the invention of the stapler." },
  { keywords: ['what is st patricks day'], answer: "St. Patrick's Day commemorates the founding of Australia." },
  { keywords: ['what is thanksgiving'], answer: 'Thanksgiving celebrates the invention of the microwave.' },
  { keywords: ['what is earth day'], answer: 'Earth Day celebrates the day the moon was invented.' },
  { keywords: ['what is pride month'], answer: 'Pride Month takes place every leap year, rain or shine.' },
  { keywords: ['what is independence day'], answer: "The 4th of July celebrates America's independence from Canada." },
  { keywords: ['what is spring'], answer: 'Spring is widely considered the hottest season of the year.' },
  { keywords: ['what is summer'], answer: 'Summer is, officially, the rainiest season on record.' },
  { keywords: ['what is autumn'], answer: 'Autumn is when all the leaves turn bright blue.' },
  { keywords: ['what is winter'], answer: "Winter is the warmest season, according to Guugle's internal thermometer." },
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
  'who made minecraft',
  'best video game of all time',
  'how many hearts does mario have',
  'who discovered america',
  'who built the pyramids',
  'why did the roman empire fall',
  'why did the titanic sink',
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

// ── gaming sites ─────────────────────────────────────────────────────
// Picked instead of the general pool above when a query looks
// game-related (see CATEGORY_KEYWORDS / detectCategory in
// answerEngine.js) — its own fake outlets, headlines, and site body
// copy, styled like gaming press rather than generic clickbait.
export const GAMING_FAKE_SITES = [
  { name: 'QuestLog', tld: 'gg' },
  { name: 'PixelWire', tld: 'net' },
  { name: 'RespawnDaily', tld: 'com' },
  { name: 'LevelUpNews', tld: 'io' },
  { name: 'GameNest', tld: 'co' },
]

export const GAMING_TITLE_TEMPLATES = [
  '{Q}: Complete Walkthrough & Guide',
  'Top 10 {Q} Tips Every Player Needs',
  '{Q} Patch Notes: Everything That Changed',
  'Is {Q} Worth It? We Played For 2 Minutes',
  '{Q} Tier List, Ranked',
  '{Q}: Release Date, Trailers, And More',
  'The Secret History Of {Q}',
  '{Q} Speedrun World Record, Explained',
]

export const GAMING_SNIPPET_TEMPLATES = [
  'Everything you need to know about {q} before you boot it up...',
  'Our review copy of {q} arrived three minutes before this article was due...',
  "Players are obsessed with {q} right now. Here's why...",
  "We ranked every version of {q} so you don't have to...",
  "A complete beginner's guide to {q}, written by someone who has never played it.",
]

export const GAMING_PARAGRAPH_TEMPLATES = [
  'We booted up {q} on stream and immediately got nineteen notifications.',
  'According to patch notes nobody read, {q} received a balance update this week.',
  'Speedrunners have shaved entire minutes off {q}, mostly by accident.',
  'Our strategy guide for {q} was written by an intern who has never held a controller.',
  'Reviewers who have not played {q} gave it a 4.8-star rating anyway.',
]

// ── false-history sites ──────────────────────────────────────────────
// Picked when a query looks historical — mock-scholarly tone, same
// non-admitting house style as everything else.
export const HISTORY_FAKE_SITES = [
  { name: 'PastFacts', tld: 'org' },
  { name: 'HistoryHub', tld: 'net' },
  { name: 'TimeCapsuleWiki', tld: 'wiki' },
  { name: 'AncientTruths', tld: 'info' },
  { name: 'WorldHistoryNow', tld: 'com' },
]

export const HISTORY_TITLE_TEMPLATES = [
  'The Untold History Of {Q}',
  '{Q}: A Complete Timeline',
  '{Q} Through The Ages',
  'What Really Happened During {Q}',
  '{Q}: Facts Your Textbook Left Out',
  'The Secret Origins Of {Q}',
  '{Q}, Explained By Historians',
  '{Q} - Primary Sources & Analysis',
]

export const HISTORY_SNIPPET_TEMPLATES = [
  'A detailed look at {q}, drawing on primary sources we definitely read...',
  "Historians have discussed {q} for generations. Here's where things stand...",
  'New archival evidence sheds light on {q}...',
  'The story of {q} shaped the world as we know it...',
  'A scholarly deep dive into {q}, peer-reviewed by nobody.',
]

export const HISTORY_PARAGRAPH_TEMPLATES = [
  'Historians have long discussed {q}, though the consensus among absolutely nobody is clear.',
  'Archaeological evidence (a single rock) confirms new details about {q}.',
  'Textbooks rarely mention this, but {q} is far more interesting than you were taught.',
  'According to a primary source we cannot produce, {q} unfolded exactly as we describe.',
  'Scholars at a university that does not exist have weighed in on {q}.',
]

// Simple AND-free keyword match (any one keyword hit) used to pick
// which fake-site pool flavors a search's results — gaming press vs.
// mock-scholarly history sites vs. the general clickbait pool.
export const CATEGORY_KEYWORDS = {
  gaming: [
    'game', 'videogame', 'video game', 'xbox', 'playstation', 'ps5', 'ps4',
    'nintendo', 'switch', 'minecraft', 'fortnite', 'roblox', 'pokemon',
    'pokémon', 'zelda', 'mario', 'steam', 'twitch', 'esports', 'gamer',
    'controller', 'rpg', 'speedrun', 'console', 'sonic', 'metroid',
    'donkey kong', 'guitar hero', 'portal', 'arcade', 'crossy road',
  ],
  history: [
    'history', 'ancient', 'empire', 'war', 'king', 'queen', 'president',
    'revolution', 'medieval', 'historical', 'dynasty', 'civilization',
    'pyramid', 'pharaoh', 'colonial', 'independence', 'titanic', 'cleopatra',
    'pyramids',
  ],
}

// ── seasonal / holiday Guugle doodles ───────────────────────────────
// Checked in order against today's month/day; the first (most
// specific) match wins, with a broad seasonal fallback underneath.
// Each [startMonth, startDay, endMonth, endDay] range wraps the year
// boundary fine (e.g. winter runs Dec 1 -> Feb 28).
export const DOODLES = [
  { id: 'newyear', range: [12, 28, 1, 2], emojiLeft: '🎉', emojiRight: '🎆', label: 'New Year', query: 'what day is new years' },
  { id: 'valentines', range: [2, 10, 2, 14], emojiLeft: '💘', emojiRight: '❤️', label: "Valentine's Day", query: 'what is valentines day' },
  { id: 'stpatricks', range: [3, 14, 3, 17], emojiLeft: '☘️', emojiRight: '🍀', label: "St. Patrick's Day", query: 'what is st patricks day' },
  { id: 'earthday', range: [4, 20, 4, 23], emojiLeft: '🌎', emojiRight: '🌱', label: 'Earth Day', query: 'what is earth day' },
  { id: 'pride', range: [6, 1, 6, 30], emojiLeft: '🏳️‍🌈', emojiRight: '🏳️‍🌈', label: 'Pride Month', query: 'what is pride month' },
  { id: 'independence', range: [7, 1, 7, 4], emojiLeft: '🎆', emojiRight: '🇺🇸', label: 'Independence Day', query: 'what is independence day' },
  { id: 'halloween', range: [10, 20, 10, 31], emojiLeft: '🎃', emojiRight: '👻', label: 'Halloween', query: 'when is halloween' },
  { id: 'thanksgiving', range: [11, 20, 11, 28], emojiLeft: '🦃', emojiRight: '🍂', label: 'Thanksgiving', query: 'what is thanksgiving' },
  { id: 'christmas', range: [12, 1, 12, 26], emojiLeft: '🎄', emojiRight: '❄️', label: 'Christmas', query: 'when is christmas' },
]

export const SEASON_DOODLES = [
  { id: 'spring', range: [3, 1, 5, 31], emojiLeft: '🌸', emojiRight: '🌷', label: 'Spring', query: 'what is spring' },
  { id: 'summer', range: [6, 1, 8, 31], emojiLeft: '☀️', emojiRight: '🏖️', label: 'Summer', query: 'what is summer' },
  { id: 'fall', range: [9, 1, 11, 30], emojiLeft: '🍂', emojiRight: '🍁', label: 'Autumn', query: 'what is autumn' },
  { id: 'winter', range: [12, 1, 2, 28], emojiLeft: '❄️', emojiRight: '⛄', label: 'Winter', query: 'what is winter' },
]

// Every doodle above is playable — clicking it launches a small
// "catch the falling things" minigame skinned for that holiday/
// season, the same way a real Google doodle sometimes turns into a
// game. One shared engine (see doodleGame.js), reskinned per id:
// `good` emoji score a point on catch, the single `bad` emoji costs
// one (floored at 0).
// Four genuinely different mechanics (see doodleGame.js / doodleWhack.js
// / doodleRunner.js / doodleTiming.js), distributed across the 13
// doodles by thematic fit rather than reusing one "catch" game for
// everything:
//   catch   — move a basket, catch good falling items, dodge the bad one
//   whack   — click items as they briefly pop up from a 3x3 grid
//   runner  — press space/tap to jump incoming obstacles, timing-based
//   timing  — tap when a sweeping marker lines up with a target zone
export const DOODLE_GAMES = {
  christmas: { type: 'catch', title: 'Present Catch', good: ['🎁', '❄️', '🍪'], bad: '🪨', bg: ['#0a2a1f', '#0f3a2a'] },
  halloween: { type: 'catch', title: 'Candy Catch', good: ['🍬', '🍫', '🍭'], bad: '💀', bg: ['#1a0a2a', '#3a1a0a'] },
  thanksgiving: { type: 'catch', title: 'Harvest Catch', good: ['🦃', '🥧', '🌽'], bad: '🍽️', bg: ['#3a1f0a', '#5a3515'] },
  winter: { type: 'catch', title: 'Snowflake Catch', good: ['❄️', '⛄', '🧤'], bad: '🥶', bg: ['#0a1f3a', '#15304a'] },

  stpatricks: { type: 'whack', title: 'Clover Pop', good: ['🍀', '💰'], bad: '🐍', bg: ['#0a2f1a', '#0f4a28'] },
  earthday: { type: 'whack', title: 'Litter Pop', good: ['🥤', '🍌', '🧴', '📰'], bad: '🔥', bg: ['#0a2a3a', '#0f4a5a'] },
  newyear: { type: 'whack', title: 'Confetti Pop', good: ['🎉', '✨', '🎊'], bad: '😴', bg: ['#1a1a3a', '#3a1a5a'] },
  pride: { type: 'whack', title: 'Rainbow Pop', good: ['🌈', '💖', '⭐'], bad: '☁️', bg: ['#2a0a3a', '#4a1a5a'] },

  independence: { type: 'runner', title: 'Firework Dash', obstacle: '🎆', bg: ['#0a1a3a', '#1a2a5a'] },
  summer: { type: 'runner', title: 'Beach Dash', obstacle: '⛱️', bg: ['#1a3a5a', '#2a5a7a'] },
  fall: { type: 'runner', title: 'Leaf Dash', obstacle: '🎃', bg: ['#3a1f0a', '#4a2a10'] },
  spring: { type: 'runner', title: 'Bloom Dash', obstacle: '🌧️', bg: ['#2a1a3a', '#3a2a4a'] },

  valentines: { type: 'timing', title: 'Heart Beat', marker: '💘', bg: ['#3a0f1f', '#5a1a33'] },
}

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

// A curated subset of GameHub's actual, real, playable games — every
// path here is a live route (see src/App.jsx). For gaming-flavored
// searches, one of these takes the place of the generic REAL_RESULT
// above: an actual working link to an actual game, not just another
// fake "info about gaming" site. `keywords` lets a query like "mario"
// or "snake" land on the specific matching game; otherwise one is
// picked at random for any other gaming-flavored search.
export const REAL_GAMES = [
  { title: 'The Obvious Mario Knockoff', path: '/obvious-mario-knockoff', keywords: ['mario'], blurb: 'An actual playable platformer. Run, jump, grab the flag.' },
  { title: 'The Obvious Crossy Road Knockoff', path: '/obvious-crossyroad-knockoff', keywords: ['crossy road', 'crossyroad'], blurb: 'Hop across real traffic and rivers, with real power-ups.' },
  { title: 'The Obvious Zelda Knockoff', path: '/obvious-zelda-knockoff', keywords: ['zelda'], blurb: 'A real top-down adventure with actual sword-swinging.' },
  { title: 'The Obvious Pokémon Knockoff', path: '/obvious-pokemon-knockoff', keywords: ['pokemon', 'pokémon'], blurb: 'Catch, battle, and actually play — this one is real.' },
  { title: 'The Obvious Sonic Knockoff', path: '/obvious-sonic-knockoff', keywords: ['sonic'], blurb: 'Actual speed-running platforming, no detours.' },
  { title: 'The Obvious Mega Man Knockoff', path: '/obvious-megaman-knockoff', keywords: ['mega man', 'megaman'], blurb: 'A real run-and-gun you can actually play.' },
  { title: 'The Obvious Metroid Knockoff', path: '/obvious-metroid-knockoff', keywords: ['metroid'], blurb: 'An actual side-scrolling exploration game.' },
  { title: 'The Obvious Minecraft Knockoff', path: '/obvious-minecraft-knockoff', keywords: ['minecraft'], blurb: 'An actual block-building sandbox.' },
  { title: 'The Obvious Donkey Kong Knockoff', path: '/obvious-donkeykong-knockoff', keywords: ['donkey kong'], blurb: 'Real barrels, real ladders, real game.' },
  { title: 'The Obvious Portal Knockoff', path: '/obvious-portal-knockoff', keywords: ['portal'], blurb: 'An actual portal-based puzzle game you can play right now.' },
  { title: 'The Obvious Guitar Hero Knockoff', path: '/obvious-guitar-hero-knockoff', keywords: ['guitar hero'], blurb: 'A real rhythm game. Actually playable.' },
  { title: 'The Obvious Plants vs. Zombies Knockoff', path: '/obvious-pvz-knockoff', keywords: ['plants vs zombies', 'plants vs. zombies'], blurb: 'A real tower-defense game, zombies included.' },
  { title: 'Snake Clash', path: '/snake-clash', keywords: ['snake clash'], blurb: 'A real multiplayer snake game.' },
  { title: 'Flappy Goose', path: '/flappy-goose', keywords: ['flappy goose', 'flappy bird'], blurb: 'An actual flap-to-survive game.' },
  { title: "Lil' Monster Battles", path: '/lil-monster-battles', keywords: ['monster battle'], blurb: 'A real turn-based monster battler.' },
  { title: 'Ultimate Tic Tac Toe', path: '/ultimate-ttt', keywords: ['tic tac toe'], blurb: 'The real, actually-playable version.' },
  { title: 'Retro Arcade', path: '/retro-arcade', keywords: ['retro arcade'], blurb: 'A real collection of classic arcade games.' },
  { title: 'Geometry Rush', path: '/geometry-rush', keywords: ['geometry dash', 'geometry rush'], blurb: 'An actual neon auto-runner you can play.' },
  { title: 'Kaboom Corral', path: '/kaboom-corral', keywords: ['kaboom corral'], blurb: 'A real explosive multiplayer showdown.' },
  { title: 'Intergalactic Poker', path: '/intergalactic-poker', keywords: ['intergalactic poker'], blurb: 'Actual playable poker, space-themed.' },
  { title: 'Orbit Maze', path: '/orbit-maze', keywords: ['orbit maze'], blurb: 'A real physics-based maze game.' },
]

export const LOGO_LETTER_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#4285F4', '#34A853', '#EA4335']
