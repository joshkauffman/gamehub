import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './SimpsonsTCG.module.css'
import { CHAR_SPRITES, ENEMY_SPRITES } from './Sprites.jsx'

const EXP_TABLE = [0, 100, 250, 450, 700]

function getLevel(exp) {
  for (let i = EXP_TABLE.length - 1; i >= 0; i--) {
    if (exp >= EXP_TABLE[i]) return i + 1
  }
  return 1
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function scaleDmg(base, level) {
  const bonus = (level - 1) * 5
  return [base[0] + bonus, base[1] + bonus]
}

const CHARS = [
  {
    id: 'homer', name: 'Homer', full: 'Homer Simpson',
    emoji: '🍩', tagline: "D'oh! Pure brute force.",
    baseHp: 120,
    cards: [
      { id: 'c1', name: "D'oh Strike",     dmg: [15, 22], emoji: '👊', desc: 'Clumsy but devastating' },
      { id: 'c2', name: 'Donut Power',      dmg: [20, 30], emoji: '🍩', desc: 'Sugar rush frenzy'     },
      { id: 'c3', name: 'Beer Belly Bash',  dmg: [25, 35], emoji: '🍺', desc: 'Body check with the gut'},
      { id: 'c4', name: 'Nuclear Fumble',   dmg: [30, 45], emoji: '☢️', desc: 'Radioactive accident'  },
      { id: 'c5', name: 'Couch Slam',       dmg: [18, 28], emoji: '🛋️', desc: 'Full-body launch'      },
    ],
  },
  {
    id: 'bart', name: 'Bart', full: 'Bart Simpson',
    emoji: '🛹', tagline: 'Eat my shorts!',
    baseHp: 90,
    cards: [
      { id: 'c1', name: 'Slingshot',        dmg: [18, 26], emoji: '🪃', desc: 'Pinpoint rock shot'    },
      { id: 'c2', name: 'Skateboard Grind', dmg: [22, 32], emoji: '🛹', desc: 'Skate right over them' },
      { id: 'c3', name: 'Prank Call',        dmg: [12, 20], emoji: '📞', desc: 'Distract and confuse'  },
      { id: 'c4', name: 'Cowabunga Crash',  dmg: [28, 40], emoji: '💥', desc: 'Full speed wipeout'    },
      { id: 'c5', name: 'Eat My Shorts',    dmg: [20, 30], emoji: '🩲', desc: 'Signature disrespect'  },
    ],
  },
  {
    id: 'lisa', name: 'Lisa', full: 'Lisa Simpson',
    emoji: '🎷', tagline: 'Intelligence wins battles.',
    baseHp: 85,
    cards: [
      { id: 'c1', name: 'Saxophone Blast',  dmg: [20, 30], emoji: '🎷', desc: 'Deafening jazz attack' },
      { id: 'c2', name: 'Brain Power',      dmg: [25, 38], emoji: '🧠', desc: 'Outsmart and strike'   },
      { id: 'c3', name: 'Feminist Fury',    dmg: [28, 40], emoji: '✊', desc: 'Righteous unstoppable rage' },
      { id: 'c4', name: 'Debate Club',      dmg: [15, 22], emoji: '📚', desc: 'Logic-based shutdown'  },
      { id: 'c5', name: 'Yoga Strike',      dmg: [22, 33], emoji: '🧘', desc: 'Centered and precise'  },
    ],
  },
  {
    id: 'marge', name: 'Marge', full: 'Marge Simpson',
    emoji: '🧹', tagline: "Don't make me come over there.",
    baseHp: 100,
    cards: [
      { id: 'c1', name: 'Vacuum Whack',       dmg: [18, 26], emoji: '🧹', desc: 'Housework as a weapon'  },
      { id: 'c2', name: 'Rolling Pin Sweep',  dmg: [22, 34], emoji: '🥐', desc: 'Classic kitchen strike' },
      { id: 'c3', name: 'Mom Voice',           dmg: [30, 42], emoji: '📣', desc: 'BARTHOLOMEW SIMPSON!'   },
      { id: 'c4', name: 'Hair Tower Smash',    dmg: [25, 38], emoji: '💇', desc: 'The blue tower descends'},
      { id: 'c5', name: 'Stew Splash',         dmg: [20, 30], emoji: '🍲', desc: 'Scalding hot dinner'    },
    ],
  },
  {
    id: 'maggie', name: 'Maggie', full: 'Maggie Simpson',
    emoji: '🍼', tagline: '*suck* *suck*',
    baseHp: 75,
    cards: [
      { id: 'c1', name: 'Pacifier Spit', dmg: [20, 32], emoji: '🍼', desc: 'High-velocity launch'    },
      { id: 'c2', name: 'Bottle Bonk',   dmg: [18, 28], emoji: '🍼', desc: 'Baby bottle to the head' },
      { id: 'c3', name: 'Crawl Rush',    dmg: [22, 35], emoji: '👶', desc: 'Unstoppable charge'      },
      { id: 'c4', name: 'Silent Stare',  dmg: [28, 40], emoji: '👁️', desc: 'The most unsettling'     },
      { id: 'c5', name: 'Bear Hug',      dmg: [25, 38], emoji: '🐻', desc: 'Surprisingly powerful'   },
    ],
  },
]

const UNLOCKABLE_CHARS = [
  {
    id: 'ned', name: 'Ned', full: 'Ned Flanders',
    emoji: '✝️', tagline: 'Okily dokily, neighbor!',
    baseHp: 95, unlockedBy: 'jimbo',
    cards: [
      { id: 'c1', name: "Okily Dokily Strike", dmg: [14, 22], emoji: '✝️', desc: 'Righteous neighbour rage'   },
      { id: 'c2', name: 'Bible Bash',          dmg: [20, 30], emoji: '📖', desc: 'The good book strikes back' },
      { id: 'c3', name: 'Leftorium Swing',     dmg: [16, 24], emoji: '🤚', desc: 'Left-handed fury'           },
      { id: 'c4', name: 'Neighborly Noogie',   dmg: [22, 32], emoji: '🤝', desc: 'Friendly but firm'          },
      { id: 'c5', name: 'Mustache Slap',       dmg: [18, 28], emoji: '👨', desc: 'Flanders finest feature'    },
    ],
  },
  {
    id: 'krusty', name: 'Krusty', full: 'Krusty the Clown',
    emoji: '🤡', tagline: "Hey hey! I'm Krusty!",
    baseHp: 88, unlockedBy: 'nelson',
    cards: [
      { id: 'c1', name: 'Cream Pie Launch',  dmg: [16, 24], emoji: '🥧', desc: 'Classic clown attack'       },
      { id: 'c2', name: 'Seltzer Spray',     dmg: [20, 28], emoji: '💦', desc: 'Straight to the face'       },
      { id: 'c3', name: 'Joy Buzzer Zap',    dmg: [24, 36], emoji: '⚡', desc: '10,000 volts of comedy'     },
      { id: 'c4', name: 'Tiny Car Crash',    dmg: [28, 40], emoji: '🚗', desc: 'A dozen clowns pour out'    },
      { id: 'c5', name: '"Hey Hey!" Haymaker', dmg: [22, 32], emoji: '👊', desc: 'The signature finishing blow'},
    ],
  },
  {
    id: 'wiggum', name: 'Wiggum', full: 'Chief Wiggum',
    emoji: '🚔', tagline: 'This is Papa Bear.',
    baseHp: 115, unlockedBy: 'snake',
    cards: [
      { id: 'c1', name: 'Baton Strike',       dmg: [18, 26], emoji: '🪖', desc: 'Standard issue baton'       },
      { id: 'c2', name: 'Donut Toss',         dmg: [14, 22], emoji: '🍩', desc: 'Glazed and deadly'          },
      { id: 'c3', name: 'Taser Blast',        dmg: [26, 38], emoji: '⚡', desc: 'Zap first, ask later'       },
      { id: 'c4', name: 'Squad Car Ram',      dmg: [30, 42], emoji: '🚔', desc: 'Full lights and sirens'     },
      { id: 'c5', name: '"Book \'em!" Arrest', dmg: [20, 30], emoji: '🔒', desc: 'Springfield justice'        },
    ],
  },
  {
    id: 'apu', name: 'Apu', full: 'Apu Nahasapeemapetilon',
    emoji: '🏪', tagline: 'Thank you, come again!',
    baseHp: 92, unlockedBy: 'tony',
    cards: [
      { id: 'c1', name: 'Slurpee Splash',     dmg: [18, 28], emoji: '🥤', desc: 'Brain-freeze inducing'      },
      { id: 'c2', name: 'Kwik-E Throw',       dmg: [22, 32], emoji: '🏪', desc: 'Day-old hot dog missile'    },
      { id: 'c3', name: 'Eight-Arms Attack',  dmg: [28, 40], emoji: '🐙', desc: 'Patron deity powerup'       },
      { id: 'c4', name: 'Squishee Freeze',    dmg: [20, 30], emoji: '🧊', desc: 'Frozen to the spot'         },
      { id: 'c5', name: 'Thank You Slam',     dmg: [25, 36], emoji: '🙏', desc: 'Very grateful, very deadly' },
    ],
  },
  {
    id: 'ralph', name: 'Ralph', full: 'Ralph Wiggum',
    emoji: '⭐', tagline: "My cat's breath smells like cat food.",
    baseHp: 78, unlockedBy: 'bob',
    cards: [
      { id: 'c1', name: 'Gold Star Smash',         dmg: [22, 34], emoji: '⭐', desc: 'Teacher said he earned it' },
      { id: 'c2', name: 'Paste Attack',             dmg: [16, 24], emoji: '🖍️', desc: 'Tastes like purple'        },
      { id: 'c3', name: 'I Choo-Choo-Choose You',  dmg: [28, 42], emoji: '🚂', desc: 'Heartfelt and devastating' },
      { id: 'c4', name: 'Cat Breath Blast',         dmg: [20, 32], emoji: '🐱', desc: 'An unstoppable odor'       },
      { id: 'c5', name: 'Crazy Rampage',            dmg: [30, 44], emoji: '🌀', desc: 'Unpredictably powerful'    },
    ],
  },
  {
    id: 'milhouse', name: 'Milhouse', full: 'Milhouse Van Houten',
    emoji: '🎮', tagline: "Everything's coming up Milhouse!",
    baseHp: 82, unlockedBy: 'burns',
    cards: [
      { id: 'c1', name: 'Inhaler Blast',               dmg: [20, 30], emoji: '💨', desc: 'Wheeze-powered attack'      },
      { id: 'c2', name: "Coming Up Milhouse!",          dmg: [30, 45], emoji: '🎉', desc: 'Rare moment of pure power'  },
      { id: 'c3', name: 'Cry Attack',                  dmg: [18, 28], emoji: '😭', desc: 'Sobbing at full volume'     },
      { id: 'c4', name: 'Dutch Courage',               dmg: [25, 38], emoji: '🇳🇱', desc: 'Heritage-fueled bravery'   },
      { id: 'c5', name: 'Four-Eyes Focus',             dmg: [26, 40], emoji: '👓', desc: 'Glasses-enhanced precision'  },
    ],
  },
]

const ENEMIES = [
  { id: 'jimbo',  name: 'Jimbo Jones',  emoji: '😤', maxHp: 55,  atk: [8,  14], exp: 25,  req: 1, loc: 'Springfield Elementary',       desc: 'Head bully of Springfield Elementary' },
  { id: 'nelson', name: 'Nelson Muntz', emoji: '😂', maxHp: 75,  atk: [10, 18], exp: 40,  req: 1, loc: 'The Playground',                desc: '"HA-HA!" — Nelson Muntz'              },
  { id: 'snake',  name: 'Snake',        emoji: '🐍', maxHp: 100, atk: [14, 22], exp: 60,  req: 2, loc: 'Downtown Springfield',           desc: 'Jailbird on the loose'                },
  { id: 'tony',   name: 'Fat Tony',     emoji: '🤵', maxHp: 130, atk: [18, 28], exp: 80,  req: 3, loc: "Legitimate Businessman's Club", desc: 'Springfield mob boss'                  },
  { id: 'bob',    name: 'Sideshow Bob', emoji: '🎭', maxHp: 160, atk: [22, 34], exp: 110, req: 4, loc: 'Springfield Theater',            desc: 'I will have my revenge on Bart!'      },
  { id: 'burns',  name: 'Mr. Burns',    emoji: '💀', maxHp: 200, atk: [28, 42], exp: 150, req: 5, loc: 'Springfield Nuclear Plant',      desc: 'Excellent...', boss: true             },
]

export default function SimpsonsTCG() {
  const [screen, setScreen]               = useState('title')
  const [char, setChar]                   = useState(null)
  const [player, setPlayer]               = useState(null)
  const [defeated, setDefeated]           = useState([])
  const [enemy, setEnemy]                 = useState(null)
  const [log, setLog]                     = useState([])
  const [phase, setPhase]                 = useState('player')
  const [cooldowns, setCooldowns]         = useState({})
  const [shake, setShake]                 = useState(null)
  const [pendingLevel, setPendingLevel]   = useState(null)
  const [unlockedChars, setUnlockedChars] = useState([])
  const [pendingUnlock, setPendingUnlock] = useState(null)

  function pushLog(msg) {
    setLog(prev => [msg, ...prev].slice(0, 5))
  }

  function selectChar(c) {
    setChar(c)
    setPlayer({ hp: c.baseHp, maxHp: c.baseHp, level: 1, exp: 0 })
    setDefeated([])
    setScreen('overworld')
  }

  function startBattle(e) {
    setEnemy({ ...e, hp: e.maxHp })
    setLog([`A wild ${e.name} appeared!`])
    setCooldowns({})
    setPhase('player')
    setScreen('battle')
  }

  function playCard(card) {
    if (phase !== 'player') return
    if ((cooldowns[card.id] || 0) > 0) return

    const snap = { ...enemy }
    const pSnap = { ...player }

    const dmgRange = scaleDmg(card.dmg, pSnap.level)
    const dmg = rand(dmgRange[0], dmgRange[1])
    const newEnemyHp = Math.max(0, snap.hp - dmg)

    setEnemy(prev => ({ ...prev, hp: newEnemyHp }))
    setCooldowns(prev => ({ ...prev, [card.id]: 1 }))
    setShake('enemy')
    setTimeout(() => setShake(null), 350)
    pushLog(`${card.emoji} ${card.name}: ${dmg} damage!`)

    if (newEnemyHp <= 0) {
      setPhase('victory')
      pushLog(`⭐ ${snap.name} defeated!`)
      setTimeout(() => finishBattle(snap, pSnap), 1100)
      return
    }

    setPhase('enemy-turn')
    setTimeout(() => {
      const eDmg = rand(snap.atk[0], snap.atk[1])
      const newPlayerHp = Math.max(0, pSnap.hp - eDmg)

      setShake('player')
      setTimeout(() => setShake(null), 350)
      pushLog(`${snap.emoji} ${snap.name} hits for ${eDmg}!`)
      setPlayer(prev => ({ ...prev, hp: newPlayerHp }))
      setCooldowns(prev => {
        const next = {}
        for (const k in prev) next[k] = Math.max(0, (prev[k] || 0) - 1)
        return next
      })

      if (newPlayerHp <= 0) {
        setTimeout(() => setScreen('gameover'), 800)
      } else {
        setPhase('player')
      }
    }, 950)
  }

  function finishBattle(defeatedEnemy, currentPlayer) {
    const newExp      = currentPlayer.exp + defeatedEnemy.exp
    const newLevel    = getLevel(newExp)
    const leveledUp   = newLevel > currentPlayer.level
    const newMaxHp    = char.baseHp + (newLevel - 1) * 15
    const newHp       = Math.min(currentPlayer.hp + 20, newMaxHp)
    const newDefeated = [...defeated, defeatedEnemy.id]
    const allDone     = ENEMIES.every(e => newDefeated.includes(e.id))

    setDefeated(newDefeated)
    setPlayer({ hp: newHp, maxHp: newMaxHp, level: newLevel, exp: newExp })
    pushLog(`✨ +${defeatedEnemy.exp} EXP!`)
    if (leveledUp) pushLog(`🆙 LEVEL UP → Level ${newLevel}!`)

    const unlock = UNLOCKABLE_CHARS.find(
      c => c.unlockedBy === defeatedEnemy.id && !unlockedChars.includes(c.id)
    )
    if (unlock) {
      setUnlockedChars(prev => [...prev, unlock.id])
      setPendingUnlock(unlock)
      pushLog(`🔓 ${unlock.full} UNLOCKED!`)
    }

    if (leveledUp) {
      setPendingLevel(newLevel)
      setTimeout(() => setScreen('levelup'), 1200)
    } else if (unlock) {
      setTimeout(() => setScreen('unlock'), 1500)
    } else if (allDone) {
      setTimeout(() => setScreen('win'), 1500)
    } else {
      setTimeout(() => setScreen('overworld'), 1500)
    }
  }

  function continueAfterLevelUp() {
    setPendingLevel(null)
    if (pendingUnlock) {
      setScreen('unlock')
    } else if (ENEMIES.every(e => defeated.includes(e.id))) {
      setScreen('win')
    } else {
      setScreen('overworld')
    }
  }

  function continueAfterUnlock() {
    setPendingUnlock(null)
    if (ENEMIES.every(e => defeated.includes(e.id))) {
      setScreen('win')
    } else {
      setScreen('overworld')
    }
  }

  function restart() {
    setChar(null); setPlayer(null); setDefeated([]); setEnemy(null)
    setLog([]); setCooldowns({}); setShake(null); setPendingLevel(null)
    setPendingUnlock(null)
    setScreen('title')
    // unlockedChars persists across runs
  }

  // ── Title ─────────────────────────────────────────────────────
  if (screen === 'title') return (
    <div className={styles.title}>
      <div className={styles.titleInner}>
        <div className={styles.skyArt}>☁️ 🏠 ☁️ 🌳 🏠 🌳</div>
        <h1 className={styles.titleGame}>SIMPSONS</h1>
        <h2 className={styles.titleSub}>TCG POCKET</h2>
        <p className={styles.titleTagline}>Springfield's most dangerous card game</p>
        <button className={styles.startBtn} onClick={() => setScreen('charselect')}>▶ START GAME</button>
        <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
      </div>
    </div>
  )

  // ── Character Select ──────────────────────────────────────────
  if (screen === 'charselect') return (
    <div className={styles.charSelect}>
      <h2 className={styles.csTitle}>Choose Your Simpson</h2>
      <p className={styles.csSubtitle}>Each character has a unique deck of attack cards</p>
      <div className={styles.charGrid}>
        {CHARS.map(c => {
          const Sprite = CHAR_SPRITES[c.id]
          return (
            <button key={c.id} className={styles.charCard} onClick={() => selectChar(c)}>
              <div className={styles.charSpriteWrap}>{Sprite && <Sprite size={105} />}</div>
              <strong className={styles.charName}>{c.full}</strong>
              <em className={styles.charTagline}>"{c.tagline}"</em>
              <div className={styles.charStats}>
                <span>❤️ {c.baseHp} HP</span>
                <span>🃏 {c.cards.length} cards</span>
              </div>
              <div className={styles.charDeck}>
                {c.cards.map(card => (
                  <span key={card.id} className={styles.miniCard}>{card.emoji} {card.name}</span>
                ))}
              </div>
            </button>
          )
        })}
        {UNLOCKABLE_CHARS.map(c => {
          const isUnlocked = unlockedChars.includes(c.id)
          const unlockEnemy = ENEMIES.find(e => e.id === c.unlockedBy)
          const Sprite = CHAR_SPRITES[c.id]
          return (
            <button
              key={c.id}
              className={`${styles.charCard} ${!isUnlocked ? styles.charCardLocked : styles.charCardUnlocked}`}
              onClick={() => isUnlocked && selectChar(c)}
              disabled={!isUnlocked}
            >
              <div className={styles.charSpriteWrap} style={{ opacity: isUnlocked ? 1 : 0.3 }}>
                {Sprite && <Sprite size={105} />}
              </div>
              {isUnlocked ? (
                <>
                  <strong className={styles.charName}>{c.full}</strong>
                  <em className={styles.charTagline}>"{c.tagline}"</em>
                  <div className={styles.charStats}>
                    <span>❤️ {c.baseHp} HP</span>
                    <span>🃏 {c.cards.length} cards</span>
                  </div>
                  <div className={styles.charDeck}>
                    {c.cards.map(card => (
                      <span key={card.id} className={styles.miniCard}>{card.emoji} {card.name}</span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <strong className={styles.charName}>???</strong>
                  <div className={styles.lockHint}>
                    <span className={styles.lockIcon}>🔒</span>
                    <span>Defeat {unlockEnemy?.name}</span>
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>
      <button className={styles.backBtn} onClick={() => setScreen('title')}>← Back</button>
    </div>
  )

  // ── Overworld ─────────────────────────────────────────────────
  if (screen === 'overworld') {
    const expStart = EXP_TABLE[player.level - 1]
    const expEnd   = player.level < 5 ? EXP_TABLE[player.level] : EXP_TABLE[4] + 1
    const expPct   = player.level >= 5 ? 100 : ((player.exp - expStart) / (expEnd - expStart)) * 100

    return (
      <div className={styles.overworld}>
        <div className={styles.owHeader}>
          <div className={styles.owTitle}>🏘️ Springfield Map</div>
          <div className={styles.owPlayer}>
            <span className={styles.owCharName}>{char.emoji} {char.full}</span>
            <div className={styles.statRow}>
              <span>❤️ {player.hp}/{player.maxHp}</span>
              <span>⭐ Lv.{player.level}</span>
              <span>✨ {player.exp} EXP</span>
            </div>
            <div className={styles.expBarWrap}>
              <div className={styles.expBarFill} style={{ width: `${expPct}%` }} />
            </div>
            {player.level < 5
              ? <div className={styles.expLabel}>{player.exp} / {EXP_TABLE[player.level]} EXP to next level</div>
              : <div className={styles.expLabel}>MAX LEVEL</div>}
          </div>
        </div>

        <div className={styles.enemyList}>
          {ENEMIES.map((e, i) => {
            const isDefeated = defeated.includes(e.id)
            const isLocked   = i > 0 && !defeated.includes(ENEMIES[i - 1].id)
            return (
              <div
                key={e.id}
                className={[
                  styles.enemyRow,
                  isDefeated ? styles.defeatedRow : '',
                  isLocked   ? styles.lockedRow   : '',
                  e.boss     ? styles.bossRow      : '',
                ].join(' ')}
                onClick={() => !isDefeated && !isLocked && startBattle(e)}
              >
                <div className={styles.erEmoji}>
                  {isDefeated ? '✅' : isLocked ? '🔒' : (() => {
                    const S = ENEMY_SPRITES[e.id]
                    return S ? <S size={54} /> : e.emoji
                  })()}
                </div>
                <div className={styles.erInfo}>
                  <strong>{e.name} {e.boss ? '👑' : ''}</strong>
                  <small>{e.loc}</small>
                  <em>{e.desc}</em>
                </div>
                <div className={styles.erStats}>
                  <span>❤️ {e.maxHp}</span>
                  <span>⚔️ {e.atk[0]}-{e.atk[1]}</span>
                  <span>✨ +{e.exp}</span>
                </div>
                {isDefeated && <span className={styles.defeatedBadge}>DEFEATED</span>}
                {!isDefeated && !isLocked && <span className={styles.fightBtn}>FIGHT →</span>}
                {isLocked && <span className={styles.lockedLabel}>Defeat {ENEMIES[i-1].name} first</span>}
              </div>
            )
          })}
        </div>
        <button className={styles.backBtn} onClick={() => setScreen('title')}>← Menu</button>
      </div>
    )
  }

  // ── Battle ────────────────────────────────────────────────────
  if (screen === 'battle') {
    const enemyHpPct = enemy ? (enemy.hp / enemy.maxHp) * 100 : 0
    const playerHpPct = player ? (player.hp / player.maxHp) * 100 : 0

    return (
      <div className={styles.battle}>
        {/* Enemy zone */}
        <div className={`${styles.enemyZone} ${shake === 'enemy' ? styles.shakeX : ''}`}>
          <div className={styles.enemyTopBar}>
            <span className={styles.enemyLabel}>{enemy?.name}{enemy?.boss ? ' 👑' : ''}</span>
            <span className={styles.enemyHpText}>{enemy?.hp} / {enemy?.maxHp} HP</span>
          </div>
          <div className={styles.hpBarWrap}>
            <div
              className={styles.hpBarFill}
              style={{
                width: `${enemyHpPct}%`,
                background: enemyHpPct > 50 ? '#4CAF50' : enemyHpPct > 25 ? '#FF8C00' : '#E53935',
              }}
            />
          </div>
          <div className={styles.enemyBigEmoji}>
            {(() => { const S = ENEMY_SPRITES[enemy?.id]; return S ? <S size={160} /> : enemy?.emoji })()}
          </div>
          <div className={styles.enemyFlavorText}>{enemy?.desc}</div>
        </div>

        {/* Battle log */}
        <div className={styles.battleLog}>
          {log.map((msg, i) => (
            <div key={i} className={styles.logLine} style={{ opacity: Math.max(0.2, 1 - i * 0.2) }}>
              {msg}
            </div>
          ))}
        </div>

        {/* Player bar */}
        <div className={`${styles.playerBar} ${shake === 'player' ? styles.shakeX : ''}`}>
          {(() => { const S = CHAR_SPRITES[char?.id]; return S ? <div className={styles.playerSprite}><S size={48} /></div> : null })()}
          <span className={styles.playerName}>{char?.full}</span>
          <span className={styles.lvBadge}>Lv.{player?.level}</span>
          <div className={styles.hpBarWrap} style={{ flex: 1 }}>
            <div
              className={styles.hpBarFill}
              style={{
                width: `${playerHpPct}%`,
                background: playerHpPct > 50 ? '#4CAF50' : playerHpPct > 25 ? '#FF8C00' : '#E53935',
              }}
            />
          </div>
          <span className={styles.playerHpText}>{player?.hp}/{player?.maxHp}</span>
        </div>

        {/* Status banner */}
        {phase === 'enemy-turn' && <div className={styles.phaseBanner}>⚡ Enemy is attacking...</div>}
        {phase === 'victory'    && <div className={styles.phaseBanner} style={{ background: '#4CAF50' }}>🏆 Victory!</div>}

        {/* Cards */}
        <div className={styles.cardsRow}>
          {char?.cards.map(card => {
            const cd       = cooldowns[card.id] || 0
            const dmgRange = scaleDmg(card.dmg, player?.level || 1)
            const disabled = phase !== 'player' || cd > 0
            return (
              <button
                key={card.id}
                className={`${styles.cardBtn} ${disabled ? styles.cardDisabled : ''}`}
                onClick={() => playCard(card)}
                disabled={disabled}
              >
                {cd > 0 && <div className={styles.cdOverlay}>COOLDOWN</div>}
                <span className={styles.cardEmoji}>{card.emoji}</span>
                <span className={styles.cardName}>{card.name}</span>
                <span className={styles.cardDmg}>{dmgRange[0]}–{dmgRange[1]} dmg</span>
                <span className={styles.cardDesc}>{card.desc}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Level Up ──────────────────────────────────────────────────
  if (screen === 'levelup') return (
    <div className={styles.overlay}>
      <div className={styles.luBox}>
        <div className={styles.luStars}>⭐ ⭐ ⭐</div>
        <h2 className={styles.luTitle}>LEVEL UP!</h2>
        <div className={styles.luLevel}>Level {pendingLevel}</div>
        <div className={styles.luStats}>
          <div>❤️ Max HP → {player?.maxHp}</div>
          <div>⚔️ All attacks +5 damage</div>
          {pendingLevel < 5 && <div>🔓 New enemies may be unlocked!</div>}
        </div>
        <button className={styles.startBtn} onClick={continueAfterLevelUp}>Continue →</button>
      </div>
    </div>
  )

  // ── Game Over ─────────────────────────────────────────────────
  if (screen === 'gameover') return (
    <div className={styles.overlay} style={{ background: 'rgba(20,0,0,0.97)' }}>
      <div className={styles.goBox}>
        <div className={styles.bigEmoji}>💀</div>
        <h2 className={styles.goTitle}>GAME OVER</h2>
        <p>You were defeated in Springfield...</p>
        <p className={styles.finalStat}>Reached Level {player?.level} — {player?.exp} EXP</p>
        <button className={styles.startBtn} onClick={restart}>Try Again</button>
        <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
      </div>
    </div>
  )

  // ── Unlock ────────────────────────────────────────────────────
  if (screen === 'unlock' && pendingUnlock) {
    const UnlockSprite = CHAR_SPRITES[pendingUnlock.id]
    return (
      <div className={styles.overlay} style={{ background: 'linear-gradient(135deg, #1a0533 0%, #2d1b5e 100%)' }}>
        <div className={styles.unlockBox}>
          <div className={styles.unlockStars}>🌟 🌟 🌟</div>
          <div className={styles.unlockBanner}>NEW CHARACTER UNLOCKED!</div>
          <div className={styles.unlockSpriteWrap}>
            {UnlockSprite && <UnlockSprite size={150} />}
          </div>
          <h2 className={styles.unlockName}>{pendingUnlock.full}</h2>
          <em className={styles.unlockTagline}>"{pendingUnlock.tagline}"</em>
          <div className={styles.unlockStats}>
            <span>❤️ {pendingUnlock.baseHp} HP</span>
            <span>🃏 {pendingUnlock.cards.length} cards</span>
          </div>
          <div className={styles.unlockCards}>
            {pendingUnlock.cards.map(card => (
              <span key={card.id} className={styles.unlockCard}>{card.emoji} {card.name}</span>
            ))}
          </div>
          <p className={styles.unlockHint}>Available on your next run!</p>
          <button className={styles.startBtn} onClick={continueAfterUnlock}>Continue →</button>
        </div>
      </div>
    )
  }

  // ── Win ───────────────────────────────────────────────────────
  if (screen === 'win') return (
    <div className={styles.overlay} style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
      <div className={styles.winBox}>
        <div className={styles.bigEmoji}>🏆</div>
        <h2 className={styles.winTitle}>SPRINGFIELD CHAMPION!</h2>
        <p className={styles.winSub}>You defeated every villain in Springfield!</p>
        <div className={styles.winStats}>
          <div>{char?.emoji} {char?.full}</div>
          <div>⭐ Final Level: {player?.level}</div>
          <div>✨ Total EXP: {player?.exp}</div>
        </div>
        <button className={styles.startBtn} onClick={restart}>Play Again</button>
        <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
      </div>
    </div>
  )

  return null
}
