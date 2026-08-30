import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './IntergalacticPoker.module.css'
import {
  SUITS, HAND_NAMES, ANTE, BET_UNIT, MAX_RAISES, STARTING_STACK, MAX_DISCARDS,
  newTable, playerCheck, playerBet, playerCall, playerRaise, playerFold,
  billAiTurn, applyOpponentAction, applyPlayerDraw, applyOpponentDraw, resolveSoloDraw,
  redactForGuest, perspectiveSwap,
} from './pokerEngine.js'
import { hostTable, joinTable } from './network.js'
import {
  CARD_BACKS, TABLE_THEMES, BILL_SKINS,
  loadWallet, saveWallet, loadCosmetics, saveCosmetics, bankProfit, findById,
} from './shop.js'

// ── Intergalactic Poker ──────────────────────────────────────────────────
// An original card minigame set after an original (non-canon) framing of
// Weirdmageddon's aftermath: Bill Cipher, powerless and bored in a strange
// containment cell, teaches you his own five-card-draw variant. Standard
// poker hand rankings and draw structure are public-domain game rules;
// the "dimension" suits, the wild Eye card, the betting numbers, Bill's
// bluffing AI, and all the writing here are original — no show art,
// dialogue, or specific plot content is reproduced.
//
// Two ways to play: solo against Bill's AI, or online against a friend —
// same no-backend PeerJS room-code approach as this hub's Chat Lounge.
// The host's table is authoritative; the guest only ever displays a
// perspective-swapped, redacted mirror of it (see pokerEngine.js) and
// sends its chosen actions back as plain messages, so the exact same
// state machine drives both an AI opponent and a real one.

const SUIT_BY_KEY = Object.fromEntries(SUITS.map(s => [s.key, s]))

function Card({ card, faceDown, selected, onClick, backSkin }) {
  if (faceDown || card.hidden) {
    const bg = backSkin
      ? `repeating-linear-gradient(45deg, ${backSkin.colorA}, ${backSkin.colorA} 6px, ${backSkin.colorB} 6px, ${backSkin.colorB} 12px)`
      : undefined
    return (
      <div
        className={styles.card + ' ' + styles.cardBack}
        style={backSkin ? { background: bg, borderColor: backSkin.border, color: backSkin.border } : undefined}
      >
        {backSkin?.icon ?? '🔺'}
      </div>
    )
  }
  if (card.wild) {
    return (
      <button className={`${styles.card} ${styles.cardWild} ${selected ? styles.cardSelected : ''}`} onClick={onClick} disabled={!onClick}>
        <span className={styles.cardRank}>★</span>
        <span className={styles.cardSuitIcon}>👁️‍🗨️</span>
        <span className={styles.cardLabel}>THE EYE</span>
      </button>
    )
  }
  const suit = SUIT_BY_KEY[card.suit]
  return (
    <button
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      style={{ borderColor: suit.color }}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className={styles.cardRank} style={{ color: suit.color }}>{card.rank}</span>
      <span className={styles.cardSuitIcon}>{suit.icon}</span>
      <span className={styles.cardLabel}>{suit.label}</span>
    </button>
  )
}

// Blends a hex color toward white by `amt` (0..1) — used to build each
// skin's gradient highlight from its single base color.
function lighten(hex, amt) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean
  const num = parseInt(full, 16)
  const mix = (channel) => Math.round(channel + (255 - channel) * amt)
  const r = mix((num >> 16) & 255), g = mix((num >> 8) & 255), b = mix(num & 255)
  return `rgb(${r},${g},${b})`
}

let billAvatarSeq = 0

// An original, deliberately abstract design — a triangular being with one
// eye and simple stick limbs, at the same level of abstraction as this
// hub's other original characters. It does NOT reproduce the specific
// signature silhouette (bowtie, top hat, cane) of any existing copyrighted
// character design; it's rendered as inline SVG (gradients, a proper
// outline, a highlight) instead of the old flat CSS border-triangle, which
// is what actually made the previous version look flat and low-effort.
//
// "Angry" (hard mode) overrides whatever cosmetic skin is equipped — it's
// a state signal, not a purchasable look, so it always wins when active.
function BillAvatar({ mood, color, angry }) {
  const idRef = useRef(null)
  if (idRef.current === null) idRef.current = ++billAvatarSeq
  const gradId = `bill-body-${idRef.current}`
  const irisId = `bill-iris-${idRef.current}`
  const gemId = `bill-gem-${idRef.current}`

  const base = angry ? '#c81c1c' : (color || '#ffd23f')
  const light = angry ? '#ff7a52' : lighten(base, 0.55)
  const outline = angry ? '#3a0505' : '#1a1408'
  const socket = angry ? '#ffffff' : '#160f06'
  const iris = angry ? '#f2f2f2' : lighten(base, 0.7)
  const pupil = angry ? '#c81c1c' : base

  return (
    <div className={`${styles.billAvatar} ${styles['mood_' + mood]} ${angry ? styles.billFurious : ''}`}>
      <svg viewBox="-15 -6 130 112" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={light} />
            <stop offset="100%" stopColor={base} />
          </linearGradient>
          <radialGradient id={irisId} cx="42%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fffceb" />
            <stop offset="100%" stopColor={iris} />
          </radialGradient>
          <radialGradient id={gemId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#7fd6ff" />
          </radialGradient>
        </defs>

        {/* limbs, drawn under the body so the shoulders overlap cleanly */}
        <line x1="14" y1="78" x2="-8" y2="66" stroke={outline} strokeWidth="6" strokeLinecap="round" />
        <line x1="14" y1="78" x2="-8" y2="66" stroke={base} strokeWidth="3" strokeLinecap="round" />
        <circle cx="-8" cy="66" r="4.5" fill={base} stroke={outline} strokeWidth="2" />
        <line x1="86" y1="78" x2="108" y2="66" stroke={outline} strokeWidth="6" strokeLinecap="round" />
        <line x1="86" y1="78" x2="108" y2="66" stroke={base} strokeWidth="3" strokeLinecap="round" />
        <circle cx="108" cy="66" r="4.5" fill={base} stroke={outline} strokeWidth="2" />

        {/* body */}
        <polygon points="50,4 96,92 4,92" fill={`url(#${gradId})`} stroke={outline} strokeWidth="5" strokeLinejoin="round" />
        <polygon points="50,11 67,46 33,46" fill="#ffffff" opacity="0.14" />

        {/* brow accent — angled down for a scowl in hard mode, up for neutral */}
        {angry ? (
          <>
            <line x1="32" y1="49" x2="46" y2="56" stroke={outline} strokeWidth="3.4" strokeLinecap="round" />
            <line x1="68" y1="49" x2="54" y2="56" stroke={outline} strokeWidth="3.4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <line x1="33" y1="47" x2="46" y2="43" stroke={outline} strokeWidth="3" strokeLinecap="round" />
            <line x1="67" y1="47" x2="54" y2="43" stroke={outline} strokeWidth="3" strokeLinecap="round" />
          </>
        )}

        {/* the one eye */}
        <circle cx="50" cy="60" r="17" fill={socket} stroke={outline} strokeWidth="3" />
        <circle cx="50" cy="60" r="10" fill={`url(#${irisId})`} />
        <circle cx="50" cy="60" r="4.6" fill={pupil} />
        <circle cx="46.3" cy="56.3" r="1.7" fill="#ffffff" opacity="0.95" />

        {/* a monocle, because a one-eyed showman needs *some* affectation */}
        <circle cx="50" cy="60" r="20" fill="none" stroke="#c9a227" strokeWidth="2.2" />
        <path d="M 38 51 Q 43 40 53 41" stroke="#ffffff" strokeWidth="1.3" fill="none" opacity="0.5" strokeLinecap="round" />
        <path d="M 65 71 Q 72 78 70 88" stroke="#c9a227" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="70" cy="88" r="1.9" fill="#c9a227" />

        {/* a small cosmic gem pinned to his front, standing in for a bow tie */}
        <circle cx="50" cy="80" r="8" fill={base} opacity="0.22" />
        <polygon points="50,73 56,80 50,87 44,80" fill={`url(#${gemId})`} stroke={outline} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

const GLOSSARY = [
  ['Secrets', "This game's word for chips, or points. However many Secrets you have is how much you can still bet."],
  ['Ante', 'A small amount everyone tosses in before the cards are even dealt, just for the right to play the hand. Nobody chooses this — it just happens automatically each round.'],
  ['Pot', "The pile of all the chips everyone's bet this hand. Whoever wins the hand at the end gets the whole pile."],
  ['Check', "Say \"I don't want to bet anything right now, but I'm also not giving up.\" You can only do this if nobody's bet yet this round."],
  ['Bet', 'Put some chips into the pot to make things interesting — like saying "I think my hand is good, want to find out?"'],
  ['Call', "Someone bet, and you match it with the same amount so you can stay in the hand."],
  ['Raise', "Someone bet, and instead of just matching it, you bet even more on top — like saying \"I'll match that, AND I'm betting more.\""],
  ['Fold', "Your cards aren't good enough to keep playing this hand, so you give up on it. You lose whatever you already bet, but you don't have to risk any more."],
  ['Dimension', 'This game\'s version of a "suit" — instead of hearts/spades/clubs/diamonds, there are four: 🔺 Rift, 👁 Eye, 🌀 Warp, and ⚡ Static. They work exactly the same way suits do in regular card games.'],
  ['The Eye', 'The one wild card in the deck. It magically turns into whatever card would help your hand the most — basically a free upgrade if you get it.'],
  ['Draw / Trade', "After the first round of betting, everyone can swap up to 3 cards they don't like for new random ones — like a do-over for part of your hand."],
  ['Hand ranking', "The list of which 5-card combos beat which other ones (like how in Rock-Paper-Scissors, some things just beat other things). It's printed above, worst to best."],
  ['Showdown', 'When both players left in the hand show their cards, and whoever has the better hand wins the whole pot.'],
]

function TutorialOverlay({ onClose }) {
  const [showGlossary, setShowGlossary] = useState(false)
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>👁 How to Play Intergalactic Poker</h2>
        <p className={styles.modalText}>
          It's five-card draw. Both players ante {ANTE} Secrets, get 5 cards, and there's a round of
          betting. Then everyone trades up to {MAX_DISCARDS} cards for new ones, and there's a second
          round of betting. Best hand at the end wins the pot.
        </p>
        <p className={styles.modalText}>
          <strong>Check</strong> — pass, no bet. <strong>Bet</strong> — open the betting for {BET_UNIT}.{' '}
          <strong>Call</strong> — match the current bet. <strong>Raise</strong> — call and add {BET_UNIT}{' '}
          more (up to {MAX_RAISES} raises a round). <strong>Fold</strong> — give up the hand, opponent
          takes the pot.
        </p>
        <p className={styles.modalText}>
          Dimensions (🔺 Rift, 👁 Eye, 🌀 Warp, ⚡ Static) work like suits — five of the same dimension is
          a Flush. There's one wild card in the deck: <strong>THE EYE</strong>. It becomes whatever card
          helps your hand most.
        </p>
        <p className={styles.modalText}>Hand rankings, worst to best: {HAND_NAMES.join(' → ')}.</p>
        <p className={styles.modalText}>
          You can leave between hands with whatever's in your stack — click <strong>Leave the Cell</strong>.
        </p>

        <button className={styles.ghostBtn} onClick={() => setShowGlossary(v => !v)}>
          {showGlossary ? '▲ Hide the Word List' : '🧒 Explain These Words Simply'}
        </button>
        {showGlossary && (
          <div className={styles.glossary}>
            {GLOSSARY.map(([term, def]) => (
              <div key={term} className={styles.glossaryRow}>
                <span className={styles.glossaryTerm}>{term}</span>
                <span className={styles.glossaryDef}>{def}</span>
              </div>
            ))}
          </div>
        )}

        <button className={styles.bigBtn} onClick={onClose}>▶ Got It</button>
      </div>
    </div>
  )
}

function ShopSection({ title, items, equippedId, wallet, owned, onBuyOrEquip, renderPreview }) {
  return (
    <div className={styles.shopSection}>
      <h3 className={styles.shopSectionTitle}>{title}</h3>
      <div className={styles.shopGrid}>
        {items.map(item => {
          const isOwned = item.price === 0 || owned.includes(item.id)
          const isEquipped = item.id === equippedId
          const canAfford = wallet >= item.price
          return (
            <div key={item.id} className={`${styles.shopItem} ${isEquipped ? styles.equipped : ''}`}>
              {renderPreview(item)}
              <span className={styles.shopItemName}>{item.name}</span>
              {!isOwned && <span className={styles.shopItemPrice}>{item.price} Secrets</span>}
              {isEquipped ? (
                <button className={`${styles.shopItemBtn} ${styles.owned}`} disabled>Equipped</button>
              ) : isOwned ? (
                <button className={`${styles.shopItemBtn} ${styles.equip}`} onClick={() => onBuyOrEquip(item.id)}>Equip</button>
              ) : (
                <button className={`${styles.shopItemBtn} ${styles.buy}`} disabled={!canAfford} onClick={() => onBuyOrEquip(item.id)}>Buy</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PokerTable({ mode, table, selected, busy, onToggleDiscard, onAction, onConfirmDraw, onNextHand, onLeave, onShowRules, cardBack, billColor }) {
  const toCall = table.contrib.bill - table.contrib.player
  const canCheck = toCall === 0
  const canBet = table.contrib.player === 0 && table.contrib.bill === 0
  const canRaise = table.raises < MAX_RAISES && table.stacks.player > 0
  const raiseAmt = Math.min(toCall + BET_UNIT, table.stacks.player)
  const raiseToTotal = table.contrib.player + raiseAmt
  const myTurnToBet = (table.phase === 'bet1' || table.phase === 'bet2') && table.turn === 'player' && !busy
  const myTurnToDraw = table.phase === 'draw' && !table.drawn.player && !busy
  const opponentLabel = mode === 'solo' ? 'Bill' : 'Opponent'
  const angry = mode === 'solo' && table.difficulty === 'hard'

  return (
    <div className={styles.table}>
      <div className={styles.topBar}>
        <span className={styles.roundTag}>Round {table.round}</span>
        {angry && <span className={styles.hardTag}>😡 HARD MODE</span>}
        <span className={styles.potTag}>💰 Pot: {table.pot}</span>
        <span className={styles.stackTag}>You: {table.stacks.player}</span>
        <span className={styles.stackTagBill}>{opponentLabel}: {table.stacks.bill}</span>
        <button className={styles.rulesBtn} onClick={onShowRules}>❓ Rules</button>
        <Link to="/" className={styles.backLinkFloating}>← GameHub</Link>
      </div>

      <div className={styles.billZone}>
        <BillAvatar mood={table.phase === 'handOver' ? 'reacting' : busy ? 'thinking' : 'idle'} color={billColor} angry={angry} />
        <div className={styles.hand}>
          {table.billHand.map((c, i) => <Card key={c.id + i} card={c} faceDown={!table.handsRevealed} backSkin={cardBack} />)}
        </div>
        {table.handsRevealed && table.billEval && <span className={styles.handLabel}>{HAND_NAMES[table.billEval.category]}</span>}
      </div>

      <div className={styles.logZone}>
        {table.log.map(entry => (
          <div key={entry.id} className={`${styles.logLine} ${styles['log_' + entry.kind]}`}>{entry.text}</div>
        ))}
      </div>

      <div className={styles.playerZone}>
        <div className={styles.hand}>
          {table.playerHand.map((c, i) => (
            <Card key={c.id + i} card={c} selected={selected.has(i)} onClick={myTurnToDraw ? () => onToggleDiscard(i) : undefined} />
          ))}
        </div>
        {table.handsRevealed && table.playerEval && <span className={styles.handLabel}>{HAND_NAMES[table.playerEval.category]}</span>}

        <div className={styles.controls}>
          {myTurnToBet && (
            <>
              {canCheck && <button className={styles.actionBtn} onClick={() => onAction('check')}>Check</button>}
              {canBet && <button className={styles.actionBtn} onClick={() => onAction('bet')}>Bet {Math.min(BET_UNIT, table.stacks.player)}</button>}
              {!canCheck && <button className={styles.actionBtn} onClick={() => onAction('call')}>Call {Math.min(toCall, table.stacks.player)}</button>}
              {!canCheck && canRaise && <button className={styles.actionBtn} onClick={() => onAction('raise')}>Raise to {raiseToTotal}</button>}
              {!canCheck && <button className={styles.foldBtn} onClick={() => onAction('fold')}>Fold</button>}
            </>
          )}
          {(table.phase === 'bet1' || table.phase === 'bet2') && !myTurnToBet && (
            <span className={styles.waitingTag}>{busy && mode === 'solo' ? 'Bill is thinking…' : `Waiting for ${opponentLabel.toLowerCase()}…`}</span>
          )}
          {myTurnToDraw && (
            <button className={styles.actionBtn} onClick={onConfirmDraw}>
              {selected.size === 0 ? 'Stand Pat' : `Trade ${selected.size} Card${selected.size === 1 ? '' : 's'}`}
            </button>
          )}
          {table.phase === 'draw' && !myTurnToDraw && <span className={styles.waitingTag}>{table.drawn.player ? `Waiting for ${opponentLabel.toLowerCase()} to trade…` : 'Trading…'}</span>}
          {table.phase === 'handOver' && (
            <>
              {(mode !== 'guest') && <button className={styles.bigBtn} onClick={onNextHand}>▶ Next Hand</button>}
              {(mode === 'guest') && <span className={styles.waitingTag}>Waiting for the dealer to start the next hand…</span>}
              <button className={styles.ghostBtn} onClick={onLeave}>🚪 Leave the Cell</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function IntergalacticPoker() {
  const [screen, setScreen] = useState('intro') // intro | modeSelect | onlineHostWait | onlineJoin | playing | result
  const [mode, setMode] = useState(null) // 'solo' | 'host' | 'guest'
  const [table, setTable] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [result, setResult] = useState(null)
  const [roomCode, setRoomCode] = useState('')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [netStatus, setNetStatus] = useState('idle') // idle | waiting | connecting | connected | error
  const [netError, setNetError] = useState('')
  const netRef = useRef(null)

  const [wallet, setWallet] = useState(() => loadWallet())
  const [cosmetics, setCosmetics] = useState(() => loadCosmetics())
  const [shopReturnScreen, setShopReturnScreen] = useState('modeSelect')
  const cardBackSkin = findById(CARD_BACKS, cosmetics.equipped.cardBack)
  const billSkin = findById(BILL_SKINS, cosmetics.equipped.billSkin)
  const tableTheme = findById(TABLE_THEMES, cosmetics.equipped.tableTheme)
  const themeVars = { '--theme-bg': tableTheme.bg, '--theme-glow': tableTheme.glow, '--theme-accent': tableTheme.accent }

  function bank(finalStack) { setWallet(bankProfit(finalStack, STARTING_STACK)) }

  function handleShopAction(category, id) {
    const list = category === 'cardBack' ? CARD_BACKS : category === 'tableTheme' ? TABLE_THEMES : BILL_SKINS
    const item = findById(list, id)
    const isOwned = item.price === 0 || cosmetics.owned.includes(id)
    if (isOwned) {
      const next = { ...cosmetics, equipped: { ...cosmetics.equipped, [category]: id } }
      setCosmetics(next)
      saveCosmetics(next)
      return
    }
    if (wallet < item.price) return
    const nextWallet = wallet - item.price
    setWallet(nextWallet)
    saveWallet(nextWallet)
    const next = { owned: [...cosmetics.owned, id], equipped: { ...cosmetics.equipped, [category]: id } }
    setCosmetics(next)
    saveCosmetics(next)
  }

  useEffect(() => {
    if (table?.phase === 'draw') setSelected(new Set())
  }, [table?.phase, table?.round])

  // Solo AI turn.
  useEffect(() => {
    if (mode !== 'solo' || !table || busy) return
    if (table.turn !== 'bill') return
    if (table.phase !== 'bet1' && table.phase !== 'bet2') return
    setBusy(true)
    const id = setTimeout(() => {
      setTable(prev => (prev ? billAiTurn(prev) : prev))
      setBusy(false)
    }, 900)
    return () => clearTimeout(id)
  }, [mode, table?.turn, table?.phase, table?.round])

  // Host: broadcast authoritative state to guest after every change.
  useEffect(() => {
    if (mode !== 'host' || !table || netStatus !== 'connected') return
    netRef.current?.send({ type: 'state', view: redactForGuest(table) })
  }, [mode, table, netStatus])

  // Immediate bust detection (host & solo) — no need to wait for a click
  // when there's obviously no next hand to deal.
  useEffect(() => {
    if (!table || table.phase !== 'handOver') return
    if (mode === 'guest') return
    if (table.stacks.player <= 0) {
      if (mode === 'host') netRef.current?.send({ type: 'end', reason: 'bust', hostWon: false })
      setResult({ kind: 'lose', finalStack: 0 })
      setScreen('result')
    } else if (table.stacks.bill <= 0) {
      if (mode === 'host') netRef.current?.send({ type: 'end', reason: 'bust', hostWon: true })
      bank(table.stacks.player)
      setResult({ kind: 'win', finalStack: table.stacks.player })
      setScreen('result')
    }
  }, [table, mode])

  function cleanupNetwork() {
    netRef.current?.destroy?.()
    netRef.current?.close?.()
    netRef.current = null
  }

  function startSolo(difficulty = 'normal') {
    cleanupNetwork()
    setMode('solo')
    setTable(newTable({ player: STARTING_STACK, bill: STARTING_STACK }, 1, difficulty))
    setShowTutorial(true)
    setResult(null)
    setNetStatus('idle')
    setScreen('playing')
  }

  function goModeSelect() {
    cleanupNetwork()
    setScreen('modeSelect')
  }

  function startHosting() {
    cleanupNetwork()
    setMode('host')
    setNetStatus('waiting')
    setNetError('')
    setScreen('onlineHostWait')
    netRef.current = hostTable({
      onReady: (code) => setRoomCode(code),
      onGuestJoined: () => {
        setNetStatus('connected')
        const t = newTable({ player: STARTING_STACK, bill: STARTING_STACK }, 1)
        setTable(t)
        setShowTutorial(true)
        setResult(null)
        setScreen('playing')
      },
      onGuestLeft: () => {
        if (screen === 'playing' || screen === 'onlineHostWait') {
          setResult({ kind: 'disconnect' })
          setScreen('result')
        }
      },
      onMessage: (msg) => {
        if (msg.type === 'action') setTable(prev => (prev ? applyOpponentAction(prev, msg.action) : prev))
        else if (msg.type === 'draw') setTable(prev => (prev ? applyOpponentDraw(prev, new Set(msg.discardIndices)) : prev))
        else if (msg.type === 'leave') { setResult({ kind: 'cashout', finalStack: table?.stacks.player ?? STARTING_STACK }); setScreen('result') }
      },
      onError: (err) => { setNetStatus('error'); setNetError(err?.type || 'connection error') },
    })
  }

  function startJoining() {
    cleanupNetwork()
    setMode('guest')
    setNetStatus('idle')
    setNetError('')
    setJoinCodeInput('')
    setScreen('onlineJoin')
  }

  function confirmJoin() {
    if (!joinCodeInput.trim()) return
    setNetStatus('connecting')
    setNetError('')
    netRef.current = joinTable(joinCodeInput, {
      onOpen: () => setNetStatus('connected'),
      onMessage: (msg) => {
        if (msg.type === 'state') {
          const swapped = perspectiveSwap(msg.view)
          setTable(swapped)
          setResult(null)
          setBusy(false)
        } else if (msg.type === 'end') {
          const finalStack = table?.stacks.player ?? STARTING_STACK
          if (msg.reason === 'cashout') {
            bank(finalStack)
            setResult({ kind: 'cashout', finalStack })
          } else {
            const iWon = !msg.hostWon
            if (iWon) bank(finalStack)
            setResult({ kind: iWon ? 'win' : 'lose', finalStack: iWon ? finalStack : 0 })
          }
          setScreen('result')
        }
      },
      onClose: () => {
        if (screen === 'playing') { setResult({ kind: 'disconnect' }); setScreen('result') }
      },
      onError: (err) => { setNetStatus('error'); setNetError(err?.type || 'connection error') },
    })
  }

  useEffect(() => {
    if (mode === 'guest' && netStatus === 'connected' && table && screen !== 'playing') {
      setShowTutorial(true)
      setScreen('playing')
    }
  }, [mode, netStatus, table, screen])

  function act(fn) {
    if (busy || !table) return
    if (mode === 'guest') return
    setTable(fn(table))
  }

  function handleAction(actionName) {
    if (mode === 'guest') {
      if (busy) return
      setBusy(true)
      netRef.current?.send({ type: 'action', action: actionName })
      return
    }
    const fnMap = { check: playerCheck, bet: playerBet, call: playerCall, raise: playerRaise, fold: playerFold }
    act(fnMap[actionName])
  }

  function toggleDiscard(i) {
    if (busy || table.phase !== 'draw' || table.drawn.player) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else if (next.size < MAX_DISCARDS) next.add(i)
      return next
    })
  }

  function confirmDraw() {
    if (busy || table.phase !== 'draw' || table.drawn.player) return
    if (mode === 'guest') {
      setBusy(true)
      netRef.current?.send({ type: 'draw', discardIndices: Array.from(selected) })
      return
    }
    setBusy(true)
    setTimeout(() => {
      setTable(prev => {
        if (!prev) return prev
        if (mode === 'solo') return resolveSoloDraw(prev, selected)
        return applyPlayerDraw(prev, selected) // host: wait for guest's own draw message
      })
      setBusy(false)
    }, 400)
  }

  function nextHand() {
    if (!table || mode === 'guest') return
    setTable(newTable(table.stacks, table.round + 1))
  }

  function leaveTable() {
    const finalStack = table?.stacks.player ?? STARTING_STACK
    if (mode === 'guest') {
      netRef.current?.send({ type: 'leave' })
      bank(finalStack)
      setResult({ kind: 'cashout', finalStack })
      setScreen('result')
      return
    }
    if (mode === 'host') netRef.current?.send({ type: 'end', reason: 'cashout' })
    bank(finalStack)
    setResult({ kind: 'cashout', finalStack })
    setScreen('result')
  }

  function playAgain() {
    cleanupNetwork()
    setScreen('modeSelect')
  }

  return (
    <div className={styles.page} style={themeVars}>
      {screen === 'intro' && (
        <div className={styles.overlayScreen}>
          <h1 className={styles.title}>👁 Intergalactic Poker<span className={styles.subtitle}>a Bill Cipher card game</span></h1>
          <p className={styles.blurb}>
            After Weirdmageddon, the strangest prisoner in the multiverse ended up somewhere between
            dimensions — a containment cell built from equal parts government paperwork and things
            humans were never meant to understand. Bill Cipher is powerless, bored out of his one mind,
            and delighted to have a visitor. He's got cards. He's got a game he swears he invented across
            a thousand realities. He calls it Intergalactic Poker. You probably shouldn't play. You're
            going to play anyway.
          </p>
          <p className={styles.blurb}>Five-card draw, heads-up. Start with 300 Secrets. Play Bill solo, or bring a friend online.</p>
          <span className={styles.walletTag}>💰 {wallet} Secrets banked</span>
          <button className={styles.bigBtn} onClick={() => setScreen('modeSelect')}>▶ Enter the Cell</button>
          <div className={styles.controls}>
            <button className={styles.ghostBtn} onClick={() => setShowTutorial(true)}>❓ How to Play</button>
            <button className={styles.shopBtn} onClick={() => { setShopReturnScreen('intro'); setScreen('shop') }}>🛒 Shop</button>
          </div>
          {showTutorial && screen === 'intro' && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'modeSelect' && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>Choose Your Table</h2>
          <span className={styles.walletTag}>💰 {wallet} Secrets banked</span>
          <div className={styles.modeGrid}>
            <button className={styles.modeCard} onClick={() => startSolo('normal')}>
              <span className={styles.modeIcon}>👁</span>
              <span className={styles.modeName}>Solo vs Bill</span>
              <span className={styles.modeDesc}>Play heads-up against Bill's own bluff-heavy AI.</span>
            </button>
            <button className={`${styles.modeCard} ${styles.hardModeCard}`} onClick={() => startSolo('hard')}>
              <span className={styles.modeIcon}>😡</span>
              <span className={styles.modeName}>Hard Mode</span>
              <span className={styles.modeDesc}>Bill stops toying with you. Sharper reads, harder to bluff, red with fury.</span>
            </button>
            <button className={styles.modeCard} onClick={startHosting}>
              <span className={styles.modeIcon}>🌐</span>
              <span className={styles.modeName}>Host Online</span>
              <span className={styles.modeDesc}>Get a room code and invite a friend to play against you.</span>
            </button>
            <button className={styles.modeCard} onClick={startJoining}>
              <span className={styles.modeIcon}>🔑</span>
              <span className={styles.modeName}>Join Online</span>
              <span className={styles.modeDesc}>Enter a friend's room code to play against them.</span>
            </button>
          </div>
          <button className={styles.shopBtn} onClick={() => { setShopReturnScreen('modeSelect'); setScreen('shop') }}>🛒 Shop</button>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}

      {screen === 'shop' && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>🛒 The Shop</h2>
          <span className={styles.walletTag}>💰 {wallet} Secrets to spend</span>
          <p className={styles.blurb}>
            Looks matter more than they should in a pocket dimension. Everything here is cosmetic —
            nothing you buy changes the odds, so it's exactly as fair against a friend as it is against Bill.
          </p>

          <ShopSection
            title="Card Backs"
            items={CARD_BACKS}
            equippedId={cosmetics.equipped.cardBack}
            wallet={wallet}
            owned={cosmetics.owned}
            onBuyOrEquip={(id) => handleShopAction('cardBack', id)}
            renderPreview={item => (
              <div
                className={styles.shopPreview}
                style={{ background: `repeating-linear-gradient(45deg, ${item.colorA}, ${item.colorA} 5px, ${item.colorB} 5px, ${item.colorB} 10px)`, border: `2px solid ${item.border}`, color: item.border }}
              >
                {item.icon}
              </div>
            )}
          />
          <ShopSection
            title="Table Themes"
            items={TABLE_THEMES}
            equippedId={cosmetics.equipped.tableTheme}
            wallet={wallet}
            owned={cosmetics.owned}
            onBuyOrEquip={(id) => handleShopAction('tableTheme', id)}
            renderPreview={item => (
              <div className={styles.shopPreview} style={{ background: `radial-gradient(circle, ${item.glow}, ${item.bg})`, border: `2px solid ${item.accent}` }} />
            )}
          />
          <ShopSection
            title="Bill's Color"
            items={BILL_SKINS}
            equippedId={cosmetics.equipped.billSkin}
            wallet={wallet}
            owned={cosmetics.owned}
            onBuyOrEquip={(id) => handleShopAction('billSkin', id)}
            renderPreview={item => (
              <div className={styles.shopPreview} style={{ background: 'transparent' }}>
                <span style={{ fontSize: 30, filter: `drop-shadow(0 0 4px ${item.color})`, color: item.color }}>▲</span>
              </div>
            )}
          />

          <button className={styles.ghostBtn} onClick={() => setScreen(shopReturnScreen)}>← Back</button>
        </div>
      )}

      {screen === 'onlineHostWait' && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>🌐 Hosting a Table</h2>
          {netStatus === 'waiting' && !roomCode && <p className={styles.blurb}>Opening a connection…</p>}
          {roomCode && (
            <>
              <p className={styles.blurb}>Share this code with a friend:</p>
              <div className={styles.roomCode}>{roomCode}</div>
              <p className={styles.blurb}>Waiting for them to join…</p>
              <BillAvatar mood="thinking" color={billSkin.color} />
            </>
          )}
          {netStatus === 'error' && <p className={styles.errorText}>Couldn't open a room ({netError}). Try again.</p>}
          <button className={styles.ghostBtn} onClick={goModeSelect}>← Cancel</button>
        </div>
      )}

      {screen === 'onlineJoin' && (
        <div className={styles.overlayScreen}>
          <h2 className={styles.title2}>🔑 Join a Table</h2>
          <p className={styles.blurb}>Enter the 4-letter code your friend shared:</p>
          <input
            className={styles.codeInput}
            value={joinCodeInput}
            maxLength={4}
            placeholder="XXXX"
            onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') confirmJoin() }}
            disabled={netStatus === 'connecting'}
          />
          <button className={styles.bigBtn} onClick={confirmJoin} disabled={netStatus === 'connecting' || !joinCodeInput.trim()}>
            {netStatus === 'connecting' ? 'Connecting…' : '▶ Join'}
          </button>
          {netStatus === 'error' && <p className={styles.errorText}>Couldn't connect ({netError}). Check the code and try again.</p>}
          <button className={styles.ghostBtn} onClick={goModeSelect}>← Cancel</button>
        </div>
      )}

      {screen === 'playing' && table && (
        <>
          {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
          <PokerTable
            mode={mode}
            table={table}
            selected={selected}
            busy={busy}
            onToggleDiscard={toggleDiscard}
            onAction={handleAction}
            onConfirmDraw={confirmDraw}
            onNextHand={nextHand}
            onLeave={leaveTable}
            onShowRules={() => setShowTutorial(true)}
            cardBack={cardBackSkin}
            billColor={billSkin.color}
          />
        </>
      )}

      {screen === 'result' && result && (
        <div className={styles.overlayScreen}>
          {result.kind === 'win' && (
            <>
              <h2 className={styles.title2}>👁 You Broke the Bank</h2>
              <p className={styles.blurb}>
                {mode === 'solo'
                  ? 'Bill stares at his empty stack of Secrets for a long moment. "Huh," he says. "Nobody\'s done that before. ...Twice." The containment cell dims. You\'ve beaten Bill Cipher at his own game — for whatever that\'s worth in a place with no actual exit.'
                  : "Your opponent's stack hits zero. Somewhere, Bill applauds slowly, clearly rooting for chaos either way. You've cleaned out the table."}
              </p>
            </>
          )}
          {result.kind === 'lose' && (
            <>
              <h2 className={styles.title2}>💀 Tapped Out</h2>
              <p className={styles.blurb}>
                {mode === 'solo'
                  ? 'Bill scoops up your last Secrets with theatrical grace. "GG, kid. Same time, next reality?" The cell\'s lights flicker back to their usual eerie hum. You have nothing left to bet with. Bill, unfortunately, has all the time in existence.'
                  : 'Your stack hits zero. Your opponent takes the table. Bill, watching from the corner, gives a slow, unsettling round of applause.'}
              </p>
            </>
          )}
          {result.kind === 'cashout' && (
            <>
              <h2 className={styles.title2}>🚪 You Walk Away</h2>
              <p className={styles.blurb}>
                {result.finalStack > STARTING_STACK && `You cash out ahead — ${result.finalStack - STARTING_STACK} Secrets richer than when you walked in.`}
                {result.finalStack < STARTING_STACK && `You cash out down ${STARTING_STACK - result.finalStack} Secrets.`}
                {result.finalStack === STARTING_STACK && 'You walk away with exactly what you came in with.'}
                {' '}Bill shrugs. "Fine. FINE. Rematch's always open."
              </p>
            </>
          )}
          {result.kind === 'disconnect' && (
            <>
              <h2 className={styles.title2}>📡 Connection Lost</h2>
              <p className={styles.blurb}>Your opponent's connection dropped. The cell hums on, unbothered. Want to try again?</p>
            </>
          )}
          <span className={styles.walletTag}>💰 {wallet} Secrets banked</span>
          <div className={styles.controls}>
            <button className={styles.bigBtn} onClick={playAgain}>▶ Play Again</button>
            <button className={styles.shopBtn} onClick={() => { setShopReturnScreen('result'); setScreen('shop') }}>🛒 Shop</button>
          </div>
          <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
        </div>
      )}
    </div>
  )
}
