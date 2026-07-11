// Real character images sourced from Wikipedia & Simpsons Wiki

const URLS = {
  // Starter characters
  homer:   'https://upload.wikimedia.org/wikipedia/en/0/02/Homer_Simpson_2006.png',
  bart:    'https://upload.wikimedia.org/wikipedia/en/a/aa/Bart_Simpson_200px.png',
  lisa:    'https://upload.wikimedia.org/wikipedia/en/e/ec/Lisa_Simpson.png',
  marge:   'https://upload.wikimedia.org/wikipedia/en/0/0b/Marge_Simpson.png',
  maggie:  'https://upload.wikimedia.org/wikipedia/en/9/9d/Maggie_Simpson.png',
  // Enemies
  jimbo:   'https://static.simpsonswiki.com/images/thumb/4/42/Jimbo_Jones.png/250px-Jimbo_Jones.png',
  nelson:  'https://upload.wikimedia.org/wikipedia/en/c/c6/Nelson_Muntz.PNG',
  snake:   'https://static.simpsonswiki.com/images/thumb/b/be/Snake_Jailbird.png/200px-Snake_Jailbird.png',
  tony:    'https://upload.wikimedia.org/wikipedia/en/3/3e/FatTony.png',
  bob:     'https://upload.wikimedia.org/wikipedia/en/c/c8/C-bob.png',
  burns:   'https://upload.wikimedia.org/wikipedia/en/5/56/Mr_Burns.png',
  // Unlockable characters
  ned:     'https://upload.wikimedia.org/wikipedia/en/8/84/Ned_Flanders.png',
  krusty:  'https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/Krustytheclown.png/250px-Krustytheclown.png',
  wiggum:  'https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Chief_Wiggum.png/250px-Chief_Wiggum.png',
  apu:     'https://upload.wikimedia.org/wikipedia/en/2/23/Apu_Nahasapeemapetilon_%28The_Simpsons%29.png',
  ralph:   'https://upload.wikimedia.org/wikipedia/en/1/14/Ralph_Wiggum.png',
  milhouse:'https://upload.wikimedia.org/wikipedia/en/thumb/1/11/Milhouse_Van_Houten.png/250px-Milhouse_Van_Houten.png',
}

// size = height in px; width scales automatically to preserve aspect ratio
function Sprite({ id, size = 80 }) {
  return (
    <img
      src={URLS[id]}
      alt={id}
      style={{ display: 'block', height: size, width: 'auto', objectFit: 'contain' }}
    />
  )
}

function make(id) {
  return ({ size }) => <Sprite id={id} size={size} />
}

export const HomerSprite      = make('homer')
export const BartSprite       = make('bart')
export const LisaSprite       = make('lisa')
export const MargeSprite      = make('marge')
export const MaggieSprite     = make('maggie')
export const JimboSprite      = make('jimbo')
export const NelsonSprite      = make('nelson')
export const SnakeSprite       = make('snake')
export const FatTonySprite     = make('tony')
export const SideshowBobSprite = make('bob')
export const MrBurnsSprite     = make('burns')

export const NedSprite      = make('ned')
export const KrustySprite   = make('krusty')
export const WiggumSprite   = make('wiggum')
export const ApuSprite      = make('apu')
export const RalphSprite    = make('ralph')
export const MilhouseSprite = make('milhouse')

export const CHAR_SPRITES = {
  homer:   HomerSprite,
  bart:    BartSprite,
  lisa:    LisaSprite,
  marge:   MargeSprite,
  maggie:  MaggieSprite,
  ned:     NedSprite,
  krusty:  KrustySprite,
  wiggum:  WiggumSprite,
  apu:     ApuSprite,
  ralph:   RalphSprite,
  milhouse:MilhouseSprite,
}

export const ENEMY_SPRITES = {
  jimbo:  JimboSprite,
  nelson: NelsonSprite,
  snake:  SnakeSprite,
  tony:   FatTonySprite,
  bob:    SideshowBobSprite,
  burns:  MrBurnsSprite,
}
