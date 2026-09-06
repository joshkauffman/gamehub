import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './SnackSquad.module.css'
import { CARDS, CARDS_BY_ID, RARITIES, RARITY_ORDER } from './cards.js'
import { loadSave, persistSave, START_COINS } from './save.js'
import TradingPost from './TradingPost.jsx'
import SnackPortrait from './SnackPortrait.jsx'

// ── Snack Squad ──────────────────────────────────────────────────────
// A secret collect-'em-up: buy packs, flip through the pull, stash new
// finds in the binder, then trade or sell your way to a full set.
// Everything (coins + collection) persists in localStorage — see
// save.js. The computer trader in the Trade tab is instant and local;
// the Trading Post (header button) is the real thing — an actual friend
// connected over a room code, trading or battling with their own copy
// of this same save data on their own device.

const PACK_COST = 100
const PACK_SIZE = 5

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function rollRarity() {
  const total = RARITY_ORDER.reduce((s, k) => s + RARITIES[k].weight, 0)
  let roll = Math.random() * total
  for (const key of RARITY_ORDER) {
    const w = RARITIES[key].weight
    if (roll < w) return key
    roll -= w
  }
  return 'common'
}
function drawCard() {
  const pool = CARDS.filter(c => c.rarity === rollRarity())
  return pick(pool)
}
function openPack() {
  return Array.from({ length: PACK_SIZE }, drawCard)
}

function generateTradeOffers(owned) {
  const ownedIds = Object.keys(owned).filter(id => owned[id] > 0)
  if (!ownedIds.length) return []
  const offers = []
  let guard = 0
  while (offers.length < 3 && guard < 40) {
    guard++
    const giveId = pick(ownedIds)
    const giveCard = CARDS_BY_ID[giveId]
    const giveIdx = RARITY_ORDER.indexOf(giveCard.rarity)
    const favorPlayer = Math.random() < 0.6
    const candidates = CARDS.filter(c => {
      if (c.id === giveId) return false
      return favorPlayer ? RARITY_ORDER.indexOf(c.rarity) >= giveIdx : true
    })
    const pool = candidates.length ? candidates : CARDS.filter(c => c.id !== giveId)
    const receiveCard = pick(pool)
    if (offers.some(o => o.giveId === giveId && o.receiveId === receiveCard.id)) continue
    offers.push({ giveId, receiveId: receiveCard.id })
  }
  return offers
}

function RarityTag({ rarity }) {
  return <small style={{ color: RARITIES[rarity].color }}>{RARITIES[rarity].label}</small>
}

export default function SnackSquad() {
  const [save, setSave] = useState(loadSave)
  const [tab, setTab] = useState('shop')
  const [tradingPostOpen, setTradingPostOpen] = useState(false)
  const [packCards, setPackCards] = useState(null)
  const [revealed, setRevealed] = useState([])
  const [tradeOffers, setTradeOffers] = useState(() => generateTradeOffers(loadSave().owned))

  useEffect(() => { persistSave(save) }, [save])

  const totalOwned = Object.values(save.owned).filter(n => n > 0).length
  const totalCards = CARDS.length

  function buyPack() {
    if (save.coins < PACK_COST || packCards) return
    const cards = openPack()
    setSave(s => {
      const owned = { ...s.owned }
      for (const c of cards) owned[c.id] = (owned[c.id] || 0) + 1
      return { coins: s.coins - PACK_COST, owned }
    })
    setPackCards(cards)
    setRevealed([])
  }

  function revealCard(i) {
    setRevealed(r => (r.includes(i) ? r : [...r, i]))
  }

  function closePack() {
    setPackCards(null)
    setRevealed([])
    setTradeOffers(generateTradeOffers(save.owned))
  }

  function sellCard(id) {
    setSave(s => {
      const count = s.owned[id] || 0
      if (count <= 0) return s
      const value = RARITIES[CARDS_BY_ID[id].rarity].sellValue
      return { coins: s.coins + value, owned: { ...s.owned, [id]: count - 1 } }
    })
  }

  function acceptTrade(offer) {
    setSave(s => {
      const giveCount = s.owned[offer.giveId] || 0
      if (giveCount <= 0) return s
      const owned = { ...s.owned, [offer.giveId]: giveCount - 1 }
      owned[offer.receiveId] = (owned[offer.receiveId] || 0) + 1
      return { ...s, owned }
    })
    setTradeOffers(offers => offers.filter(o => o !== offer))
  }

  function resetCollection() {
    if (!window.confirm('Start over? This clears your coins and every card you own.')) return
    const fresh = { coins: START_COINS, owned: {} }
    setSave(fresh)
    setTradeOffers([])
    setPackCards(null)
    setRevealed([])
  }

  const visibleOffers = tradeOffers.filter(o => (save.owned[o.giveId] || 0) > 0)
  const sellable = CARDS.filter(c => (save.owned[c.id] || 0) > 0)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>🍪 Snack Squad</h1>
        <div className={styles.headerRight}>
          <button className={styles.tradingPostBtn} onClick={() => setTradingPostOpen(true)}>🤝 Meet a Real Player</button>
          <div className={styles.coinDisplay}>🪙 {save.coins}</div>
        </div>
      </header>

      <nav className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'shop' ? styles.tabActive : ''}`} onClick={() => setTab('shop')}>🛒 Shop</button>
        <button className={`${styles.tab} ${tab === 'binder' ? styles.tabActive : ''}`} onClick={() => setTab('binder')}>📖 Binder ({totalOwned}/{totalCards})</button>
        <button className={`${styles.tab} ${tab === 'trade' ? styles.tabActive : ''}`} onClick={() => setTab('trade')}>🔄 Trade</button>
        <button className={`${styles.tab} ${tab === 'sell' ? styles.tabActive : ''}`} onClick={() => setTab('sell')}>💰 Sell</button>
      </nav>

      <main className={styles.stage}>
        {tab === 'shop' && (
          <section className={styles.panel}>
            <p className={styles.panelIntro}>Every pack has 5 snacks inside. Rarer ones are worth way more if you sell or trade them.</p>
            <div className={styles.oddsRow}>
              {RARITY_ORDER.map(k => (
                <span key={k} style={{ color: RARITIES[k].color }}>{RARITIES[k].label} {RARITIES[k].weight}%</span>
              ))}
            </div>
            <button className={styles.buyBtn} onClick={buyPack} disabled={save.coins < PACK_COST || !!packCards}>
              Open a Pack — {PACK_COST} 🪙
            </button>
            {save.coins < PACK_COST && <p className={styles.warnMsg}>Not enough coins — sell or trade some snacks first!</p>}
          </section>
        )}

        {tab === 'binder' && (
          <section className={styles.panel}>
            <div className={styles.progressRow}>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${(totalOwned / totalCards) * 100}%` }} /></div>
              <span>{totalOwned} / {totalCards} collected</span>
            </div>
            {RARITY_ORDER.map(rk => {
              const inRarity = CARDS.filter(c => c.rarity === rk)
              const ownedCount = inRarity.filter(c => (save.owned[c.id] || 0) > 0).length
              return (
                <div key={rk} className={styles.binderSection}>
                  <h3 style={{ color: RARITIES[rk].color }}>{RARITIES[rk].label} ({ownedCount}/{inRarity.length})</h3>
                  <div className={styles.binderGrid}>
                    {inRarity.map(c => {
                      const count = save.owned[c.id] || 0
                      return (
                        <div
                          key={c.id}
                          className={styles.binderSlot}
                          style={count > 0 ? { borderColor: RARITIES[c.rarity].color, boxShadow: `0 0 14px ${RARITIES[c.rarity].glow}` } : undefined}
                        >
                          {count > 0 ? (
                            <>
                              <SnackPortrait card={c} size={48} className={styles.slotEmoji} />
                              <div className={styles.slotName}>{c.name}</div>
                              {count > 1 && <div className={styles.slotCount}>×{count}</div>}
                            </>
                          ) : (
                            <div className={styles.slotMystery}>?</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {tab === 'trade' && (
          <section className={styles.panel}>
            <div className={styles.tradeHead}>
              <p className={styles.panelIntro}>The trader's offering these deals right now.</p>
              <button className={styles.secondaryBtn} onClick={() => setTradeOffers(generateTradeOffers(save.owned))}>🔄 New Offers</button>
            </div>
            {visibleOffers.length === 0 && <p className={styles.emptyMsg}>No trades available — open a pack first!</p>}
            {visibleOffers.map((o, i) => {
              const give = CARDS_BY_ID[o.giveId]
              const receive = CARDS_BY_ID[o.receiveId]
              return (
                <div key={i} className={styles.tradeRow}>
                  <div className={styles.tradeSide}>
                    <SnackPortrait card={give} size={40} className={styles.tradeEmoji} />
                    <span>{give.name}</span>
                    <RarityTag rarity={give.rarity} />
                  </div>
                  <span className={styles.tradeArrow}>⇄</span>
                  <div className={styles.tradeSide}>
                    <SnackPortrait card={receive} size={40} className={styles.tradeEmoji} />
                    <span>{receive.name}</span>
                    <RarityTag rarity={receive.rarity} />
                  </div>
                  <button className={styles.acceptBtn} onClick={() => acceptTrade(o)}>Trade</button>
                </div>
              )
            })}
          </section>
        )}

        {tab === 'sell' && (
          <section className={styles.panel}>
            <p className={styles.panelIntro}>Sell snacks you don't need for coins to buy more packs.</p>
            {sellable.length === 0 && <p className={styles.emptyMsg}>Nothing to sell yet — open a pack first!</p>}
            {sellable.map(c => (
              <div key={c.id} className={styles.sellRow}>
                <SnackPortrait card={c} size={44} className={styles.sellEmoji} />
                <div className={styles.sellInfo}>
                  <div>{c.name} <RarityTag rarity={c.rarity} /></div>
                  <div className={styles.sellOwned}>Owned: {save.owned[c.id]}</div>
                </div>
                <button className={styles.secondaryBtn} onClick={() => sellCard(c.id)}>Sell for {RARITIES[c.rarity].sellValue} 🪙</button>
              </div>
            ))}
          </section>
        )}
      </main>

      <button className={styles.resetLink} onClick={resetCollection}>Reset collection</button>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>

      {packCards && (
        <div className={styles.packOverlay}>
          <div className={styles.packCard}>
            <h2 className={styles.packTitle}>New Pack!</h2>
            <div className={styles.packGrid}>
              {packCards.map((card, i) => {
                const isRevealed = revealed.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    className={styles.flipSlot}
                    onClick={() => revealCard(i)}
                    aria-label={isRevealed ? card.name : 'hidden card'}
                  >
                    <div className={`${styles.flipInner} ${isRevealed ? styles.flipped : ''}`}>
                      <div className={styles.flipFront}>🎴</div>
                      <div
                        className={styles.flipBack}
                        style={{ borderColor: RARITIES[card.rarity].color, boxShadow: `0 0 22px ${RARITIES[card.rarity].glow}` }}
                      >
                        <SnackPortrait card={card} size={52} className={styles.cardEmoji} />
                        <div className={styles.cardName}>{card.name}</div>
                        <RarityTag rarity={card.rarity} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            {revealed.length < packCards.length ? (
              <button className={styles.secondaryBtn} onClick={() => setRevealed(packCards.map((_, i) => i))}>Flip All</button>
            ) : (
              <button className={styles.buyBtn} onClick={closePack}>Collect & Continue →</button>
            )}
          </div>
        </div>
      )}

      {tradingPostOpen && (
        <TradingPost onClose={() => { setTradingPostOpen(false); setSave(loadSave()) }} />
      )}
    </div>
  )
}
