// ── Snack Squad — the card set ───────────────────────────────────────
// An original set (no real brands) of 41 snack-food creatures across 5
// rarities. `weight` drives pack odds — see openPack() in SnackSquad.jsx.

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export const RARITIES = {
  common: { label: 'Common', color: '#9aa0a6', glow: 'rgba(154,160,166,0.5)', weight: 60, sellValue: 5 },
  uncommon: { label: 'Uncommon', color: '#3fae5c', glow: 'rgba(63,174,92,0.55)', weight: 25, sellValue: 15 },
  rare: { label: 'Rare', color: '#3f8cd9', glow: 'rgba(63,140,217,0.6)', weight: 10, sellValue: 40 },
  epic: { label: 'Epic', color: '#a34fd9', glow: 'rgba(163,79,217,0.65)', weight: 4, sellValue: 100 },
  legendary: { label: 'Legendary', color: '#e0a63c', glow: 'rgba(224,166,60,0.75)', weight: 1, sellValue: 300 },
}

// Each card's `art` describes an illustrated portrait (see SnackPortrait.jsx)
// rather than relying on the plain `emoji` alone: a body shape, its color
// and a texture decoration, plus an optional `leaf`. `emoji` stays as a
// small fallback/label used in a few compact HUD spots.
export const CARDS = [
  // ── Common (20) ──
  { id: 'chip-chomper', name: 'Chip Chomper', emoji: '🍟', rarity: 'common', flavor: 'Salted, golden, always first to go.', art: { shape: 'tall', color: '#f0c24a', accent: '#c98a2c', decoration: 'stripes' } },
  { id: 'pretzel-pup', name: 'Pretzel Pup', emoji: '🥨', rarity: 'common', flavor: 'Loyal, twisty, a little salty.', art: { shape: 'ring', color: '#a5673f', accent: '#7a4a26', decoration: 'dots', decorColor: '#fff6e0' } },
  { id: 'popcorn-puff', name: 'Popcorn Puff', emoji: '🍿', rarity: 'common', flavor: 'Pops up out of nowhere, usually during movies.', art: { shape: 'wide', color: '#fff2d0', accent: '#e8d19a', decoration: 'dots', decorColor: '#f0dfa0' } },
  { id: 'cookie-crumb', name: 'Cookie Crumb', emoji: '🍪', rarity: 'common', flavor: 'Small but leaves a mess wherever it goes.', art: { shape: 'wide', color: '#b5793a', accent: '#8a5a28', decoration: 'dots', decorColor: '#4a2e15' } },
  { id: 'jelly-bean-jr', name: 'Jelly Bean Jr.', emoji: '🍬', rarity: 'common', flavor: 'Comes in a suspicious number of flavors.', art: { shape: 'round', color: '#ff6fae', accent: '#d94f8a', decoration: 'none' } },
  { id: 'toast-knight', name: 'Toast Knight', emoji: '🍞', rarity: 'common', flavor: 'Rises to the occasion every morning.', art: { shape: 'wide', color: '#e8b45a', accent: '#c98a2c', decoration: 'none' } },
  { id: 'baguette-bandit', name: 'Baguette Bandit', emoji: '🥖', rarity: 'common', flavor: 'Steals the breadbasket. Every time.', art: { shape: 'tall', color: '#d9a750', accent: '#a5732a', decoration: 'stripes' } },
  { id: 'bagel-buddy', name: 'Bagel Buddy', emoji: '🥯', rarity: 'common', flavor: "Has a hole where its heart should be. It's fine.", art: { shape: 'ring', color: '#c98a4b', accent: '#9a6530', decoration: 'dots', decorColor: '#fff6e0' } },
  { id: 'nacho-nomad', name: 'Nacho Nomad', emoji: '🌮', rarity: 'common', flavor: 'Wanders the party tray looking for salsa.', art: { shape: 'wide', color: '#e8c468', accent: '#b5822c', decoration: 'dots', decorColor: '#b5822c' } },
  { id: 'cheese-wedge', name: 'Cheese Wedge', emoji: '🧀', rarity: 'common', flavor: 'Sharp personality. Literally.', art: { shape: 'wide', color: '#f7c948', accent: '#d9a52c', decoration: 'holes' } },
  { id: 'grape-goblin', name: 'Grape Goblin', emoji: '🍇', rarity: 'common', flavor: 'Small, purple, surprisingly fast.', art: { shape: 'round', color: '#7b4fa0', accent: '#5a3878', decoration: 'none' } },
  { id: 'berry-buddy', name: 'Berry Buddy', emoji: '🍓', rarity: 'common', flavor: 'Sweet on the outside. Seedy past.', art: { shape: 'round', color: '#e8435a', accent: '#c92e44', decoration: 'dots', decorColor: '#ffe066', leaf: true } },
  { id: 'peanut-pal', name: 'Peanut Pal', emoji: '🥜', rarity: 'common', flavor: 'Comes in a shell. Comes in pairs.', art: { shape: 'stack2', color: '#c9975a', accent: '#a5763a', decoration: 'stripes' } },
  { id: 'chestnut-chief', name: 'Chestnut Chief', emoji: '🌰', rarity: 'common', flavor: 'Roasts easily. Holds a grudge.', art: { shape: 'round', color: '#7a4a2a', accent: '#5a3418', decoration: 'none' } },
  { id: 'bean-counter', name: 'Bean Counter', emoji: '🫘', rarity: 'common', flavor: 'Counts everything. Including your snacks.', art: { shape: 'tall', color: '#8a6a3a', accent: '#6a4e24', decoration: 'none' } },
  { id: 'juice-box-jester', name: 'Juice Box Jester', emoji: '🧃', rarity: 'common', flavor: 'Small straw, big personality.', art: { shape: 'tall', color: '#4fae5c', accent: '#358040', decoration: 'stripes', decorColor: '#7ecb87' } },
  { id: 'soda-sprite', name: 'Soda Sprite', emoji: '🥤', rarity: 'common', flavor: 'Fizzy, hyper, impossible to keep still.', art: { shape: 'tall', color: '#3f8cd9', accent: '#2a6bb0', decoration: 'dots', decorColor: '#a8d8ff' } },
  { id: 'apple-squire', name: 'Apple Squire', emoji: '🍎', rarity: 'common', flavor: 'Keeps the doctor away. Not the other cards.', art: { shape: 'round', color: '#d9362e', accent: '#a8241e', decoration: 'none', leaf: true } },
  { id: 'banana-bard', name: 'Banana Bard', emoji: '🍌', rarity: 'common', flavor: 'Tells the same joke every time. Still funny.', art: { shape: 'tall', color: '#f0d43a', accent: '#c9ab1e', decoration: 'dots', decorColor: '#8a6a1e' } },
  { id: 'carrot-cadet', name: 'Carrot Cadet', emoji: '🥕', rarity: 'common', flavor: 'Sharp eyes. Sharper crunch.', art: { shape: 'tall', color: '#e8752c', accent: '#c05a1a', decoration: 'stripes', decorColor: '#c05a1a', leaf: true } },

  // ── Uncommon (10) ──
  { id: 'donut-duke', name: 'Donut Duke', emoji: '🍩', rarity: 'uncommon', flavor: 'Rules the break room with a sugary fist.', art: { shape: 'ring', color: '#e88bb5', accent: '#c96a95', decoration: 'dots', decorColor: 'multi' } },
  { id: 'cupcake-countess', name: 'Cupcake Countess', emoji: '🧁', rarity: 'uncommon', flavor: "Frosting is not optional. It's a lifestyle.", art: { shape: 'stack2', color: '#ff8fc4', accent: '#d96a9e', decoration: 'dots', decorColor: 'multi' } },
  { id: 'pizza-paladin', name: 'Pizza Paladin', emoji: '🍕', rarity: 'uncommon', flavor: 'Defends the last slice to the death.', art: { shape: 'wide', color: '#f0c24a', accent: '#c9982e', decoration: 'dots', decorColor: '#c0392b' } },
  { id: 'hot-dog-herald', name: 'Hot Dog Herald', emoji: '🌭', rarity: 'uncommon', flavor: 'Announces the start of every cookout.', art: { shape: 'tall', color: '#e8b45a', accent: '#c9902e', decoration: 'drizzle', decorColor: '#e8c020' } },
  { id: 'croissant-crusader', name: 'Croissant Crusader', emoji: '🥐', rarity: 'uncommon', flavor: 'Flaky on the outside. Buttery resolve within.', art: { shape: 'tall', color: '#e8a545', accent: '#c07f28', decoration: 'stripes' } },
  { id: 'pancake-pioneer', name: 'Pancake Pioneer', emoji: '🥞', rarity: 'uncommon', flavor: 'Stacks up the competition. Literally.', art: { shape: 'stack3', color: '#e8b45a', accent: '#c07f28', decoration: 'drizzle', decorColor: '#8a5a1e' } },
  { id: 'sandwich-sentinel', name: 'Sandwich Sentinel', emoji: '🥪', rarity: 'uncommon', flavor: 'Layers of mystery. Also lettuce.', art: { shape: 'stack3', color: '#e8c06a', accent: '#4fae5c', decoration: 'none' } },
  { id: 'dango-dancer', name: 'Dango Dancer', emoji: '🍡', rarity: 'uncommon', flavor: 'Three friends on a stick, inseparable.', art: { shape: 'stack3', color: '#ffb6c9', accent: '#ffffff', decoration: 'none' } },
  { id: 'oden-oracle', name: 'Oden Oracle', emoji: '🍢', rarity: 'uncommon', flavor: 'Simmers quietly. Knows things.', art: { shape: 'stack2', color: '#e8c468', accent: '#c9a03e', decoration: 'none' } },
  { id: 'coconut-corsair', name: 'Coconut Corsair', emoji: '🥥', rarity: 'uncommon', flavor: 'Tough shell. Surprisingly refreshing crew.', art: { shape: 'round', color: '#8a6a4a', accent: '#fff6e0', decoration: 'stripes', decorColor: '#6a4e30' } },

  // ── Rare (6) ──
  { id: 'ice-cream-ice-queen', name: 'Ice Cream Ice Queen', emoji: '🍦', rarity: 'rare', flavor: 'Cool under pressure. Melts for no one.', art: { shape: 'drop', color: '#bfe8f5', accent: '#8fd0e8', decoration: 'none' } },
  { id: 'snow-cone-sorcerer', name: 'Snow Cone Sorcerer', emoji: '🍧', rarity: 'rare', flavor: 'Conjures a chill wherever it rolls.', art: { shape: 'drop', color: '#8fd6ff', accent: '#5ab0e0', decoration: 'dots', decorColor: '#ffffff' } },
  { id: 'sundae-samurai', name: 'Sundae Samurai', emoji: '🍨', rarity: 'rare', flavor: 'Draws its spoon with honor.', art: { shape: 'stack2', color: '#f5e0c8', accent: '#e8435a', decoration: 'none' } },
  { id: 'fudge-baron', name: 'Fudge Baron', emoji: '🍫', rarity: 'rare', flavor: 'Rich, dense, and mysteriously always available.', art: { shape: 'wide', color: '#5a3420', accent: '#3a2010', decoration: 'none' } },
  { id: 'lollipop-lord', name: 'Lollipop Lord', emoji: '🍭', rarity: 'rare', flavor: 'Been around the block. Several times.', art: { shape: 'round', color: '#ff5a7a', accent: '#ffffff', decoration: 'swirl' } },
  { id: 'honeycomb-herald', name: 'Honeycomb Herald', emoji: '🍯', rarity: 'rare', flavor: "Sticky business, but somebody's gotta do it.", art: { shape: 'hex', color: '#e8a52c', accent: '#c9821a', decoration: 'none' } },

  // ── Epic (3) ──
  { id: 'pie-pharaoh', name: 'Pie Pharaoh', emoji: '🥧', rarity: 'epic', flavor: 'Ancient recipe. Modern flakiness.', art: { shape: 'wide', color: '#e8b45a', accent: '#8b3a2a', decoration: 'stripes', decorColor: '#c07f28' } },
  { id: 'pudding-prophet', name: 'Pudding Prophet', emoji: '🍮', rarity: 'epic', flavor: "Sees the future. It's wobbly.", art: { shape: 'drop', color: '#e8c86a', accent: '#c9a03e', decoration: 'swirl' } },
  { id: 'cake-colossus', name: 'Cake Colossus', emoji: '🎂', rarity: 'epic', flavor: 'Towers over the party table. Candles optional.', art: { shape: 'stack3', color: '#ffd9ea', accent: '#ff8fc4', decoration: 'dots', decorColor: 'multi' } },

  // ── Legendary (2) ──
  { id: 'golden-waffle', name: 'The Golden Waffle', emoji: '🧇', rarity: 'legendary', flavor: 'Legend says it never gets soggy. Ever.', art: { shape: 'wide', color: '#ffd700', accent: '#c9a000', decoration: 'holes' } },
  { id: 'everlasting-cherry', name: 'The Everlasting Cherry', emoji: '🍒', rarity: 'legendary', flavor: "Grandpa swears it's older than the fridge.", art: { shape: 'stack2', color: '#8b0000', accent: '#6b0000', decoration: 'none', leaf: true } },
]

export const CARDS_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]))
