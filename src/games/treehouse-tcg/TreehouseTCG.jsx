import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './TreehouseTCG.module.css'
import { CHAR_SPRITES } from '../simpsons-tcg/Sprites.jsx'

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
    id: 'homer', name: 'Homer', full: 'Demon Homer',
    emoji: '😈', tagline: "D'oh — from the depths of Hell!",
    baseHp: 120,
    cards: [
      { id: 'c1', name: "D'oh! Hellfire",      dmg: [15, 22], emoji: '🔥', desc: 'Clumsy infernal strike'       },
      { id: 'c2', name: 'Donut of Doom',        dmg: [20, 30], emoji: '🍩', desc: 'Cursed sugar rush'            },
      { id: 'c3', name: 'Brimstone Belly Bash', dmg: [25, 35], emoji: '💀', desc: 'Infernal body check'          },
      { id: 'c4', name: 'Nuclear Hellblast',    dmg: [30, 45], emoji: '☢️', desc: 'Radioactive damnation'        },
      { id: 'c5', name: 'Couch of Doom',        dmg: [18, 28], emoji: '🛋️', desc: 'Drags you into the sofa'      },
    ],
  },
  {
    id: 'bart', name: 'Bart', full: 'Zombie Slayer Bart',
    emoji: '🧟', tagline: 'Eat my BRAINS!',
    baseHp: 90,
    cards: [
      { id: 'c1', name: 'Slingshot of Death',  dmg: [18, 26], emoji: '💀', desc: 'Silver bullet, skull aim'     },
      { id: 'c2', name: 'Grave Grind',         dmg: [22, 32], emoji: '⚰️', desc: 'Skate over a tombstone'       },
      { id: 'c3', name: 'Prank From Beyond',   dmg: [12, 20], emoji: '👻', desc: 'Haunt and confuse'            },
      { id: 'c4', name: 'Cowabunga CRASH',     dmg: [28, 40], emoji: '💥', desc: 'Undead full speed wipeout'    },
      { id: 'c5', name: 'Eat My BRAINS',       dmg: [20, 30], emoji: '🧠', desc: 'Signature zombie disrespect'  },
    ],
  },
  {
    id: 'lisa', name: 'Lisa', full: 'Witch Lisa',
    emoji: '🔮', tagline: 'The ancient texts agree — you lose.',
    baseHp: 85,
    cards: [
      { id: 'c1', name: 'Witchcraft Blast',    dmg: [20, 30], emoji: '🔮', desc: 'Forbidden jazz sorcery'       },
      { id: 'c2', name: 'Forbidden Tome',      dmg: [25, 38], emoji: '📜', desc: 'Knowledge too dark to bear'   },
      { id: 'c3', name: 'Cursed Sax Solo',     dmg: [28, 40], emoji: '🎷', desc: 'Drives enemies mad'           },
      { id: 'c4', name: 'Prophecy Strike',     dmg: [15, 22], emoji: '✨', desc: 'Fate-sealed and unavoidable'  },
      { id: 'c5', name: 'Dark Intelligence',   dmg: [22, 33], emoji: '🧿', desc: 'Occult precision strike'      },
    ],
  },
  {
    id: 'marge', name: 'Marge', full: 'Witch Marge',
    emoji: '🧙', tagline: "Don't make me hex you.",
    baseHp: 100,
    cards: [
      { id: 'c1', name: 'Broomstick Bash',     dmg: [18, 26], emoji: '🧹', desc: 'Classic witch weaponry'       },
      { id: 'c2', name: 'Cauldron Splash',      dmg: [22, 34], emoji: '🫕', desc: 'Boiling potion bath'          },
      { id: 'c3', name: 'Coven Curse',          dmg: [30, 42], emoji: '🕯️', desc: 'BARTHOLOMEW YOU ARE HEXED!'  },
      { id: 'c4', name: 'Blue Tower Hex',       dmg: [25, 38], emoji: '💇', desc: 'The hair descends in wrath'  },
      { id: 'c5', name: 'Poison Stew Splash',   dmg: [20, 30], emoji: '🍲', desc: 'Scalding cursed dinner'       },
    ],
  },
  {
    id: 'maggie', name: 'Maggie', full: 'Baby Demon Maggie',
    emoji: '😈', tagline: '*suck* *suck* ...your soul.',
    baseHp: 75,
    cards: [
      { id: 'c1', name: 'Demon Pacifier',      dmg: [20, 32], emoji: '😈', desc: 'Hell-velocity launch'         },
      { id: 'c2', name: 'Blood Bottle',        dmg: [18, 28], emoji: '🩸', desc: 'What is IN this bottle'       },
      { id: 'c3', name: 'Hellcrawl Rush',      dmg: [22, 35], emoji: '👶', desc: 'Unstoppable demon charge'     },
      { id: 'c4', name: 'Void Stare',          dmg: [28, 40], emoji: '👁️', desc: 'Peers into your very soul'   },
      { id: 'c5', name: 'Soul Bear Hug',       dmg: [25, 38], emoji: '🐻', desc: 'She takes a piece of you'     },
    ],
  },
]

const ENEMIES = [
  {
    id: 'krustydoll',
    name: 'Evil Krusty Doll',
    emoji: '🤡',
    maxHp: 60, atk: [9, 15], exp: 30, req: 1,
    loc: '742 Evergreen Terrace',
    desc: '"Don\'t make me come over there..." — Evil Doll',
    seg: 'Clown Without Pity • TOH III',
  },
  {
    id: 'zombiened',
    name: 'Zombie Ned',
    emoji: '🧟',
    maxHp: 85, atk: [13, 20], exp: 48, req: 1,
    loc: 'Springfield Cemetery',
    desc: '"Zombie Flanders! Run for your lives!" — Homer',
    seg: 'Dial "Z" for Zombie • TOH III',
  },
  {
    id: 'willie',
    name: 'Nightmare Willie',
    emoji: '😱',
    maxHp: 115, atk: [17, 25], exp: 68, req: 2,
    loc: 'Springfield Elementary (Nightmare)',
    desc: '"Willie... help... meeee..." — Groundskeeper Willie',
    seg: 'Nightmare on Evergreen Terrace • TOH VI',
  },
  {
    id: 'draculaburns',
    name: 'Dracula Burns',
    emoji: '🧛',
    maxHp: 148, atk: [21, 31], exp: 92, req: 3,
    loc: 'Burns Manor / Castle Burns',
    desc: '"Excellent... your blood is... excellent."',
    seg: "Bart Simpson's Dracula • TOH IV",
  },
  {
    id: 'witch',
    name: 'The Witch',
    emoji: '🧙',
    maxHp: 178, atk: [26, 38], exp: 125, req: 4,
    loc: 'The Dark Forest of Springfield',
    desc: '"I\'ll get you, and your little donut too!"',
    seg: 'Easy-Bake Coven • TOH VIII',
  },
  {
    id: 'kang',
    name: 'Kang',
    emoji: '👽',
    maxHp: 225, atk: [31, 46], exp: 160, req: 5,
    loc: 'Rigellian Mothership',
    desc: '"Silence! I will not debate this with you... weakling humans!"',
    seg: 'Recurring Villain • TOH Annual',
    boss: true,
  },
]

export default function TreehouseTCG() {
  const [screen, setScreen]             = useState('title')
  const [char, setChar]                 = useState(null)
  const [player, setPlayer]             = useState(null)
  const [defeated, setDefeated]         = useState([])
  const [enemy, setEnemy]               = useState(null)
  const [log, setLog]                   = useState([])
  const [phase, setPhase]               = useState('player')
  const [cooldowns, setCooldowns]       = useState({})
  const [shake, setShake]               = useState(null)
  const [pendingLevel, setPendingLevel] = useState(null)

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
    setLog([`⚠️ ${e.name} emerged from the darkness!`])
    setCooldowns({})
    setPhase('player')
    setScreen('battle')
  }

  function playCard(card) {
    if (phase !== 'player') return
    if ((cooldowns[card.id] || 0) > 0) return

    const snap  = { ...enemy }
    const pSnap = { ...player }

    const dmgRange   = scaleDmg(card.dmg, pSnap.level)
    const dmg        = rand(dmgRange[0], dmgRange[1])
    const newEnemyHp = Math.max(0, snap.hp - dmg)

    setEnemy(prev => ({ ...prev, hp: newEnemyHp }))
    setCooldowns(prev => ({ ...prev, [card.id]: 1 }))
    setShake('enemy')
    setTimeout(() => setShake(null), 350)
    pushLog(`${card.emoji} ${card.name}: ${dmg} damage!`)

    if (newEnemyHp <= 0) {
      setPhase('victory')
      pushLog(`🕯️ ${snap.name} vanquished!`)
      setTimeout(() => finishBattle(snap, pSnap), 1100)
      return
    }

    setPhase('enemy-turn')
    setTimeout(() => {
      const eDmg       = rand(snap.atk[0], snap.atk[1])
      const newPlayerHp = Math.max(0, pSnap.hp - eDmg)

      setShake('player')
      setTimeout(() => setShake(null), 350)
      pushLog(`${snap.emoji} ${snap.name} attacks for ${eDmg}!`)
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

    setDefeated(newDefeated)
    setPlayer({ hp: newHp, maxHp: newMaxHp, level: newLevel, exp: newExp })
    pushLog(`✨ +${defeatedEnemy.exp} EXP!`)
    if (leveledUp) pushLog(`🆙 LEVEL UP → Level ${newLevel}!`)

    if (leveledUp) {
      setPendingLevel(newLevel)
      setTimeout(() => setScreen('levelup'), 1200)
    } else if (ENEMIES.every(e => newDefeated.includes(e.id))) {
      setTimeout(() => setScreen('win'), 1500)
    } else {
      setTimeout(() => setScreen('overworld'), 1500)
    }
  }

  function continueAfterLevelUp() {
    setPendingLevel(null)
    if (ENEMIES.every(e => defeated.includes(e.id))) {
      setScreen('win')
    } else {
      setScreen('overworld')
    }
  }

  function restart() {
    setChar(null); setPlayer(null); setDefeated([]); setEnemy(null)
    setLog([]); setCooldowns({}); setShake(null); setPendingLevel(null)
    setScreen('title')
  }

  // ── Title ─────────────────────────────────────────────────────
  if (screen === 'title') return (
    <div className={styles.title}>
      <div className={styles.titleInner}>
        <div className={styles.batRow}>🦇 🕷️ 🦇 🕸️ 🦇</div>
        <h1 className={styles.titleGame}>TREEHOUSE</h1>
        <h1 className={styles.titleGame2}>OF HORROR</h1>
        <h2 className={styles.titleSub}>TCG POCKET</h2>
        <p className={styles.titleTagline}>Springfield's most terrifying card game</p>
        <button className={styles.startBtn} onClick={() => setScreen('charselect')}>▶ ENTER IF YOU DARE</button>
        <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
      </div>
    </div>
  )

  // ── Character Select ──────────────────────────────────────────
  if (screen === 'charselect') return (
    <div className={styles.charSelect}>
      <h2 className={styles.csTitle}>Choose Your Horror Form</h2>
      <p className={styles.csSubtitle}>Each Simpson has a terrifying deck of dark attack cards</p>
      <div className={styles.charGrid}>
        {CHARS.map(c => {
          const Sprite = CHAR_SPRITES[c.id]
          return (
            <button key={c.id} className={styles.charCard} onClick={() => selectChar(c)}>
              <div className={styles.charSpriteWrap}>{Sprite && <Sprite size={105} />}</div>
              <strong className={styles.charName}>{c.full}</strong>
              <em className={styles.charTagline}>"{c.tagline}"</em>
              <div className={styles.charStats}>
                <span>🩸 {c.baseHp} HP</span>
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
          <div className={styles.owTitle}>🕯️ Springfield After Dark</div>
          <div className={styles.owPlayer}>
            <span className={styles.owCharName}>{char.emoji} {char.full}</span>
            <div className={styles.statRow}>
              <span>🩸 {player.hp}/{player.maxHp}</span>
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
                  {isDefeated ? '✅' : isLocked ? '🔒' : <span style={{ fontSize: 34 }}>{e.emoji}</span>}
                </div>
                <div className={styles.erInfo}>
                  <strong>{e.name} {e.boss ? '☠️' : ''}</strong>
                  <small>{e.loc}</small>
                  <em>{e.seg}</em>
                </div>
                <div className={styles.erStats}>
                  <span>🩸 {e.maxHp}</span>
                  <span>⚔️ {e.atk[0]}-{e.atk[1]}</span>
                  <span>✨ +{e.exp}</span>
                </div>
                {isDefeated && <span className={styles.defeatedBadge}>BANISHED</span>}
                {!isDefeated && !isLocked && <span className={styles.fightBtn}>FIGHT →</span>}
                {isLocked && <span className={styles.lockedLabel}>Banish {ENEMIES[i-1].name} first</span>}
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
    const enemyHpPct  = enemy  ? (enemy.hp  / enemy.maxHp)   * 100 : 0
    const playerHpPct = player ? (player.hp / player.maxHp) * 100 : 0

    return (
      <div className={styles.battle}>
        <div className={`${styles.enemyZone} ${shake === 'enemy' ? styles.shakeX : ''}`}>
          <div className={styles.enemyTopBar}>
            <span className={styles.enemyLabel}>{enemy?.name}{enemy?.boss ? ' ☠️' : ''}</span>
            <span className={styles.enemyHpText}>{enemy?.hp} / {enemy?.maxHp} HP</span>
          </div>
          <div className={styles.hpBarWrap}>
            <div
              className={styles.hpBarFill}
              style={{
                width: `${enemyHpPct}%`,
                background: enemyHpPct > 50 ? '#39C878' : enemyHpPct > 25 ? '#FF8C00' : '#E53935',
              }}
            />
          </div>
          <div className={styles.enemyBigEmoji}>
            <span style={{ fontSize: 100, lineHeight: 1, filter: 'drop-shadow(0 0 24px rgba(255,100,0,0.6))' }}>
              {enemy?.emoji}
            </span>
          </div>
          <div className={styles.enemyFlavorText}>{enemy?.desc}</div>
          <div className={styles.enemySeg}>{enemy?.seg}</div>
        </div>

        <div className={styles.battleLog}>
          {log.map((msg, i) => (
            <div key={i} className={styles.logLine} style={{ opacity: Math.max(0.2, 1 - i * 0.2) }}>
              {msg}
            </div>
          ))}
        </div>

        <div className={`${styles.playerBar} ${shake === 'player' ? styles.shakeX : ''}`}>
          {(() => { const S = CHAR_SPRITES[char?.id]; return S ? <div className={styles.playerSprite}><S size={48} /></div> : null })()}
          <span className={styles.playerName}>{char?.full}</span>
          <span className={styles.lvBadge}>Lv.{player?.level}</span>
          <div className={styles.hpBarWrap} style={{ flex: 1 }}>
            <div
              className={styles.hpBarFill}
              style={{
                width: `${playerHpPct}%`,
                background: playerHpPct > 50 ? '#39C878' : playerHpPct > 25 ? '#FF8C00' : '#E53935',
              }}
            />
          </div>
          <span className={styles.playerHpText}>{player?.hp}/{player?.maxHp}</span>
        </div>

        {phase === 'enemy-turn' && <div className={styles.phaseBanner}>⚡ The horror attacks...</div>}
        {phase === 'victory'    && <div className={styles.phaseBanner} style={{ background: '#2d6a4f' }}>🕯️ Vanquished!</div>}

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
        <div className={styles.luStars}>🕯️ 🕯️ 🕯️</div>
        <h2 className={styles.luTitle}>POWER SURGE!</h2>
        <div className={styles.luLevel}>Level {pendingLevel}</div>
        <div className={styles.luStats}>
          <div>🩸 Max HP → {player?.maxHp}</div>
          <div>⚔️ All attacks +5 damage</div>
          {pendingLevel < 5 && <div>🔓 Darker horrors approach...</div>}
        </div>
        <button className={styles.startBtn} onClick={continueAfterLevelUp}>Continue →</button>
      </div>
    </div>
  )

  // ── Game Over ─────────────────────────────────────────────────
  if (screen === 'gameover') return (
    <div className={styles.overlay} style={{ background: 'rgba(10,0,0,0.98)' }}>
      <div className={styles.goBox}>
        <div className={styles.bigEmoji}>💀</div>
        <h2 className={styles.goTitle}>YOU WERE CLAIMED</h2>
        <p>Springfield's nightmares were too much...</p>
        <p className={styles.finalStat}>Reached Level {player?.level} — {player?.exp} EXP</p>
        <button className={styles.startBtn} onClick={restart}>Try Again</button>
        <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
      </div>
    </div>
  )

  // ── Win ───────────────────────────────────────────────────────
  if (screen === 'win') return (
    <div className={styles.overlay} style={{ background: 'linear-gradient(135deg, #0a0010 0%, #1a0020 100%)' }}>
      <div className={styles.winBox}>
        <div className={styles.bigEmoji}>🏆</div>
        <h2 className={styles.winTitle}>HORROR SURVIVED!</h2>
        <p className={styles.winSub}>You banished every nightmare from Springfield!</p>
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
