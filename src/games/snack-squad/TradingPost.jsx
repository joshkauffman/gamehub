import { useEffect, useRef, useState } from 'react'
import styles from './TradingPost.module.css'
import { hostRoom, joinRoom } from './network.js'
import { CARDS_BY_ID, RARITIES } from './cards.js'
import { loadSave, persistSave } from './save.js'
import SnackPortrait from './SnackPortrait.jsx'

// ── The Trading Post ─────────────────────────────────────────────────
// Meet another real player over a room code (same PeerJS handshake as
// Chat Lounge), then trade or battle using your real collection — reads
// and writes the same save.js record the rest of Snack Squad does, so a
// trade here immediately shows up in your binder.
//
// Battle math is deliberately random-free: both sides derive identical
// HP/damage from card rarity and the same sequence of move messages, so
// neither peer needs to be "authoritative" — they just always agree.

const MOVES = {
  light: { label: 'Nibble', key: 'light' },
  heavy: { label: 'Chomp', key: 'heavy' },
}
const RARITY_MULT = { common: 1, uncommon: 1.3, rare: 1.7, epic: 2.2, legendary: 3 }

function battleStats(card) {
  const m = RARITY_MULT[card.rarity] || 1
  return { maxHp: Math.round(28 * m), light: Math.round(7 * m), heavy: Math.round(13 * m) }
}

function ownedCardList(save) {
  return Object.keys(save.owned)
    .filter(id => save.owned[id] > 0 && CARDS_BY_ID[id])
    .map(id => CARDS_BY_ID[id])
}

function CardPicker({ cards, save, selectedId, onSelect, disabled }) {
  return (
    <div className={styles.cardGrid}>
      {cards.map(c => (
        <button
          key={c.id}
          type="button"
          disabled={disabled}
          className={`${styles.cardTile} ${selectedId === c.id ? styles.cardTileSelected : ''}`}
          style={{ borderColor: RARITIES[c.rarity].color }}
          onClick={() => onSelect(c.id)}
        >
          <SnackPortrait card={c} size={40} className={styles.cardTileEmoji} />
          <span className={styles.cardTileName}>{c.name}</span>
          <small style={{ color: RARITIES[c.rarity].color }}>{RARITIES[c.rarity].label}</small>
          {save.owned[c.id] > 1 && <span className={styles.cardTileCount}>×{save.owned[c.id]}</span>}
        </button>
      ))}
    </div>
  )
}

function CardBadge({ id }) {
  const c = CARDS_BY_ID[id]
  if (!c) return null
  return (
    <div className={styles.cardBadge} style={{ borderColor: RARITIES[c.rarity].color }}>
      <SnackPortrait card={c} size={36} className={styles.cardTileEmoji} />
      <span className={styles.cardTileName}>{c.name}</span>
      <small style={{ color: RARITIES[c.rarity].color }}>{RARITIES[c.rarity].label}</small>
    </div>
  )
}

export default function TradingPost({ onClose }) {
  const [save, setSave] = useState(loadSave)
  const [screen, setScreen] = useState('menu') // menu|hosting|joining|lobby|trade|battle
  const [role, setRole] = useState(null) // 'host'|'guest'
  const [roomCode, setRoomCode] = useState(null)
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(null) // 'trade'|'battle', chosen by host

  // trade state
  const [myOffer, setMyOffer] = useState(null)
  const [theirOffer, setTheirOffer] = useState(null)
  const [myAccepted, setMyAccepted] = useState(false)
  const [theirAccepted, setTheirAccepted] = useState(false)
  const [tradeResult, setTradeResult] = useState(null)

  // battle state
  const [myFighterId, setMyFighterId] = useState(null)
  const [theirFighterId, setTheirFighterId] = useState(null)
  const [myHp, setMyHp] = useState(null)
  const [theirHp, setTheirHp] = useState(null)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [battleLog, setBattleLog] = useState([])
  const [battleOver, setBattleOver] = useState(null) // 'win'|'lose'|null

  const connRef = useRef(null)
  const stateRef = useRef({}) // always-current mirror for handlers registered once

  useEffect(() => {
    stateRef.current = {
      myOffer, theirOffer, myAccepted, theirAccepted,
      myFighterId, theirFighterId, myHp, theirHp,
    }
  })

  useEffect(() => () => connRef.current?.destroy?.() ?? connRef.current?.close?.(), [])

  function mutateSave(fn) {
    setSave(s => {
      const next = fn(s)
      persistSave(next)
      return next
    })
  }

  function teardownConnection() {
    connRef.current?.destroy?.()
    connRef.current?.close?.()
    connRef.current = null
  }

  function resetToMenu(errMsg) {
    teardownConnection()
    setScreen('menu'); setRole(null); setRoomCode(null); setMode(null)
    setMyOffer(null); setTheirOffer(null); setMyAccepted(false); setTheirAccepted(false); setTradeResult(null)
    setMyFighterId(null); setTheirFighterId(null); setMyHp(null); setTheirHp(null)
    setIsMyTurn(false); setBattleLog([]); setBattleOver(null)
    if (errMsg) setError(errMsg)
  }

  function handleMessage(data) {
    const s = stateRef.current
    if (data.t === 'mode') {
      setMode(data.mode)
      setScreen(data.mode)
    } else if (data.t === 'offer') {
      setTheirOffer(data.cardId)
    } else if (data.t === 'accept') {
      setTheirAccepted(true)
    } else if (data.t === 'fighter') {
      setTheirFighterId(data.cardId)
    } else if (data.t === 'move') {
      const myFighter = CARDS_BY_ID[s.myFighterId]
      const theirFighter = CARDS_BY_ID[s.theirFighterId]
      if (!myFighter || !theirFighter) return
      const dmg = battleStats(theirFighter)[data.move]
      const newHp = Math.max(0, (s.myHp ?? battleStats(myFighter).maxHp) - dmg)
      setMyHp(newHp)
      setBattleLog(log => [...log, `They used ${MOVES[data.move].label}! (-${dmg} HP)`])
      if (newHp <= 0) setBattleOver('lose')
      setIsMyTurn(true)
    } else if (data.t === 'leave') {
      resetToMenu('Your friend left the Trading Post.')
    }
  }

  function startHost() {
    setError(null)
    setScreen('hosting')
    setRole('host')
    connRef.current = hostRoom({
      onReady: code => setRoomCode(code),
      onGuestJoined: () => setScreen('lobby'),
      onGuestLeft: () => resetToMenu('Your friend disconnected.'),
      onMessage: handleMessage,
      onError: () => resetToMenu('Could not host a room — try again.'),
    })
  }

  function startJoin() {
    if (!joinCodeInput.trim()) return
    setError(null)
    setScreen('joining')
    setRole('guest')
    connRef.current = joinRoom(joinCodeInput, {
      onOpen: () => setScreen('lobby'),
      onMessage: handleMessage,
      onClose: () => resetToMenu('Your friend disconnected.'),
      onError: () => resetToMenu("Couldn't find that room — check the code and try again."),
    })
  }

  function chooseMode(m) {
    setMode(m)
    setScreen(m)
    connRef.current?.send({ t: 'mode', mode: m })
  }

  // ── Trade actions ──
  function offerCard(cardId) {
    setMyOffer(cardId)
    connRef.current?.send({ t: 'offer', cardId })
  }
  function acceptTrade() {
    setMyAccepted(true)
    connRef.current?.send({ t: 'accept' })
  }
  useEffect(() => {
    if (screen === 'trade' && myOffer && theirOffer && myAccepted && theirAccepted && !tradeResult) {
      mutateSave(s => {
        const owned = { ...s.owned }
        owned[myOffer] = Math.max(0, (owned[myOffer] || 0) - 1)
        owned[theirOffer] = (owned[theirOffer] || 0) + 1
        return { ...s, owned }
      })
      setTradeResult({ gave: myOffer, got: theirOffer })
    }
  }, [screen, myOffer, theirOffer, myAccepted, theirAccepted, tradeResult])

  // ── Battle actions ──
  function chooseFighter(cardId) {
    setMyFighterId(cardId)
    connRef.current?.send({ t: 'fighter', cardId })
  }
  useEffect(() => {
    if (screen === 'battle' && myFighterId && theirFighterId && myHp === null) {
      setMyHp(battleStats(CARDS_BY_ID[myFighterId]).maxHp)
      setTheirHp(battleStats(CARDS_BY_ID[theirFighterId]).maxHp)
      setIsMyTurn(role === 'host')
      setBattleLog([`Battle start! ${role === 'host' ? 'You go' : 'They go'} first.`])
    }
  }, [screen, myFighterId, theirFighterId, myHp, role])

  function playMove(moveKey) {
    if (!isMyTurn || battleOver) return
    const myFighter = CARDS_BY_ID[myFighterId]
    const dmg = battleStats(myFighter)[moveKey]
    const newTheirHp = Math.max(0, theirHp - dmg)
    setTheirHp(newTheirHp)
    setBattleLog(log => [...log, `You used ${MOVES[moveKey].label}! (-${dmg} HP)`])
    connRef.current?.send({ t: 'move', move: moveKey })
    setIsMyTurn(false)
    if (newTheirHp <= 0) setBattleOver('win')
  }

  function leaveAndClose() {
    connRef.current?.send?.({ t: 'leave' })
    teardownConnection()
    onClose()
  }

  const myCards = ownedCardList(save)

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span>🤝 The Trading Post</span>
          <button className={styles.closeBtn} onClick={leaveAndClose}>✕</button>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        {screen === 'menu' && (
          myCards.length === 0 ? (
            <p className={styles.hint}>You don't have any cards yet — open a pack first, then come back to meet another player!</p>
          ) : (
            <div className={styles.menuBody}>
              <p className={styles.hint}>Meet a real friend online to trade cards or battle.</p>
              <button className={styles.primaryBtn} onClick={startHost}>🏠 Host a Meetup</button>
              <div className={styles.joinRow}>
                <input
                  className={styles.codeInput}
                  value={joinCodeInput}
                  maxLength={4}
                  placeholder="Friend's code"
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                />
                <button className={styles.primaryBtn} disabled={!joinCodeInput.trim()} onClick={startJoin}>Join</button>
              </div>
            </div>
          )
        )}

        {screen === 'hosting' && (
          <div className={styles.menuBody}>
            <p className={styles.hint}>Share this code with your friend:</p>
            <div className={styles.roomCode}>{roomCode || '····'}</div>
            <p className={styles.hint}>Waiting for them to join...</p>
            <button className={styles.secondaryBtn} onClick={() => resetToMenu()}>Cancel</button>
          </div>
        )}

        {screen === 'joining' && (
          <div className={styles.menuBody}>
            <p className={styles.hint}>Connecting...</p>
            <button className={styles.secondaryBtn} onClick={() => resetToMenu()}>Cancel</button>
          </div>
        )}

        {screen === 'lobby' && (
          <div className={styles.menuBody}>
            <p className={styles.hint}>You're connected! {role === 'host' ? 'Pick what to do:' : 'Waiting for the host to pick...'}</p>
            {role === 'host' ? (
              <div className={styles.modeRow}>
                <button className={styles.primaryBtn} onClick={() => chooseMode('trade')}>🔄 Trade</button>
                <button className={styles.primaryBtn} onClick={() => chooseMode('battle')}>⚔️ Battle</button>
              </div>
            ) : (
              <p className={styles.hint}>🕰️ Standing by...</p>
            )}
          </div>
        )}

        {screen === 'trade' && (
          tradeResult ? (
            <div className={styles.resultBody}>
              <h3>Trade complete!</h3>
              <div className={styles.tradeSummary}>
                <div>You gave <CardBadge id={tradeResult.gave} /></div>
                <div>You got <CardBadge id={tradeResult.got} /></div>
              </div>
              <button className={styles.primaryBtn} onClick={() => resetToMenu()}>Done</button>
            </div>
          ) : (
            <div className={styles.menuBody}>
              <p className={styles.hint}>Pick a card to offer:</p>
              <CardPicker cards={myCards} save={save} selectedId={myOffer} onSelect={offerCard} disabled={myAccepted} />
              <div className={styles.offerRow}>
                <div>
                  <p className={styles.hint}>Your offer</p>
                  {myOffer ? <CardBadge id={myOffer} /> : <p className={styles.hint}>— none yet —</p>}
                </div>
                <div>
                  <p className={styles.hint}>Their offer</p>
                  {theirOffer ? <CardBadge id={theirOffer} /> : <p className={styles.hint}>— waiting —</p>}
                </div>
              </div>
              <button className={styles.primaryBtn} disabled={!myOffer || !theirOffer || myAccepted} onClick={acceptTrade}>
                {myAccepted ? 'Waiting for them to accept...' : 'Accept Trade'}
              </button>
            </div>
          )
        )}

        {screen === 'battle' && (
          !myFighterId || !theirFighterId ? (
            <div className={styles.menuBody}>
              <p className={styles.hint}>Pick your fighter:</p>
              <CardPicker cards={myCards} save={save} selectedId={myFighterId} onSelect={chooseFighter} disabled={!!myFighterId} />
              {myFighterId && !theirFighterId && <p className={styles.hint}>Waiting for them to pick...</p>}
            </div>
          ) : (
            <div className={styles.battleBody}>
              <div className={styles.battleRow}>
                <div className={styles.fighterCol}>
                  <CardBadge id={myFighterId} />
                  <div className={styles.hpBar}><div className={styles.hpFill} style={{ width: `${(myHp / battleStats(CARDS_BY_ID[myFighterId]).maxHp) * 100}%` }} /></div>
                  <span className={styles.hpText}>{myHp} HP</span>
                </div>
                <span className={styles.vs}>VS</span>
                <div className={styles.fighterCol}>
                  <CardBadge id={theirFighterId} />
                  <div className={styles.hpBar}><div className={styles.hpFill} style={{ width: `${(theirHp / battleStats(CARDS_BY_ID[theirFighterId]).maxHp) * 100}%` }} /></div>
                  <span className={styles.hpText}>{theirHp} HP</span>
                </div>
              </div>

              <div className={styles.battleLog}>
                {battleLog.slice(-4).map((line, i) => <div key={i}>{line}</div>)}
              </div>

              {battleOver ? (
                <>
                  <h3 className={styles.battleResult}>{battleOver === 'win' ? '🏆 You won!' : '💀 You lost!'}</h3>
                  <button className={styles.primaryBtn} onClick={() => resetToMenu()}>Done</button>
                </>
              ) : (
                <div className={styles.moveRow}>
                  <button className={styles.primaryBtn} disabled={!isMyTurn} onClick={() => playMove('light')}>
                    Nibble ({battleStats(CARDS_BY_ID[myFighterId]).light} dmg)
                  </button>
                  <button className={styles.primaryBtn} disabled={!isMyTurn} onClick={() => playMove('heavy')}>
                    Chomp ({battleStats(CARDS_BY_ID[myFighterId]).heavy} dmg)
                  </button>
                  {!isMyTurn && <p className={styles.hint}>Waiting for their move...</p>}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
