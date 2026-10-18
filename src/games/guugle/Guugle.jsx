import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Guugle.module.css'
import { getAnswer, generateResults, buildFakeSitePage, randomFeelingWrongQuery } from './answerEngine.js'
import { LOGO_LETTER_COLORS } from './constants.js'

// ── Guugle, the worst search engine ever ────────────────────────────────
// Everything here is original and procedurally generated — an invented
// parody search engine, not a copy of any real one's code or assets.
// Ask it anything and it confidently answers with the opposite of the
// truth. The results page is full of fake "websites" you can click into
// (all generated joke content) — except one, which is a real, working
// link back to GameHub's actual home page, hiding in plain sight among
// the nonsense.

function GuugleLogo({ size = 'large' }) {
  const letters = 'Guugle'.split('')
  return (
    <span className={size === 'large' ? styles.logoLarge : styles.logoSmall}>
      {letters.map((ch, i) => (
        <span key={i} style={{ color: LOGO_LETTER_COLORS[i] }}>{ch}</span>
      ))}
    </span>
  )
}

function SearchBar({ value, onChange, onSubmit, compact, autoFocus }) {
  return (
    <form
      className={compact ? styles.searchBarCompact : styles.searchBar}
      onSubmit={e => { e.preventDefault(); onSubmit(value) }}
    >
      <span className={styles.searchIcon} aria-hidden="true">🔍</span>
      <input
        className={styles.searchInput}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Ask Guugle anything. Get the opposite."
        autoFocus={autoFocus}
      />
      {compact && <button type="submit" className={styles.searchGoBtn} aria-label="Search">Guugle It</button>}
    </form>
  )
}

function HomeScreen({ query, setQuery, onSearch, onFeelingWrong }) {
  return (
    <div className={styles.homeWrap}>
      <GuugleLogo size="large" />
      <p className={styles.tagline}>The #1 search engine for answers that are definitely wrong.</p>
      <SearchBar value={query} onChange={setQuery} onSubmit={onSearch} autoFocus />
      <div className={styles.homeButtons}>
        <button className={styles.btn} onClick={() => onSearch(query)}>Guugle Search</button>
        <button className={styles.btn} onClick={onFeelingWrong}>I'm Feeling Wrong</button>
      </div>
      <p className={styles.homeFooterNote}>
        100% of our answers are opposite day, every day. Side effects may include knowing less than before.
      </p>
      <Link to="/" className={styles.backLink}>← Back to GameHub</Link>
    </div>
  )
}

function AnswerBox({ query, answer }) {
  return (
    <div className={styles.answerBox}>
      <div className={styles.answerLabel}>Guugle's Instant Answer <span className={styles.answerLabelSub}>(confidently wrong)</span></div>
      <div className={styles.answerBody}>{answer.body}</div>
      <div className={styles.answerFoot}>Search for "{query}" elsewhere if you want the real answer.</div>
    </div>
  )
}

function ResultRow({ result, onClick }) {
  if (result.real) {
    return (
      <Link to={result.path} className={styles.result}>
        <div className={styles.resultUrl}>{result.url}</div>
        <div className={styles.resultTitle}>{result.title}</div>
        <div className={styles.resultSnippet}>{result.snippet}</div>
      </Link>
    )
  }
  return (
    <button className={styles.result} onClick={() => onClick(result)}>
      <div className={styles.resultUrl}>{result.url}</div>
      <div className={styles.resultTitle}>{result.title}</div>
      <div className={styles.resultSnippet}>{result.snippet}</div>
    </button>
  )
}

function ResultsScreen({ query, input, setInput, onSearch, answer, results, onResultClick }) {
  return (
    <div className={styles.resultsPage}>
      <div className={styles.resultsTopBar}>
        <Link to="/guugle" className={styles.topLogoLink}><GuugleLogo size="small" /></Link>
        <SearchBar value={input} onChange={setInput} onSubmit={onSearch} compact />
      </div>
      <div className={styles.resultsBody}>
        <div className={styles.resultStats}>
          About 1,000,000,000 results (0.42 seconds) — none of them are right
        </div>
        <AnswerBox query={query} answer={answer} />
        <div className={styles.resultList}>
          {results.map(r => <ResultRow key={r.id} result={r} onClick={onResultClick} />)}
        </div>
      </div>
    </div>
  )
}

function FakeSiteScreen({ site, query, onBack, onRelatedSearch }) {
  return (
    <div className={styles.sitePage}>
      <div className={styles.browserChrome}>
        <div className={styles.trafficLights}>
          <span className={styles.dotRed} /><span className={styles.dotYellow} /><span className={styles.dotGreen} />
        </div>
        <div className={styles.addressBar}>🔒 {site.url}</div>
      </div>
      <div className={styles.siteBody}>
        <button className={styles.siteBack} onClick={onBack}>← Back to Guugle results</button>
        <h1 className={styles.siteTitle}>{site.title}</h1>
        {site.paragraphs.map((p, i) => <p key={i} className={styles.siteParagraph}>{p}</p>)}
        <div className={styles.relatedBox}>
          <div className={styles.relatedLabel}>Related searches</div>
          <div className={styles.relatedChips}>
            {site.related.map(q => (
              <button key={q} className={styles.chip} onClick={() => onRelatedSearch(q)}>{q}</button>
            ))}
          </div>
        </div>
        <Link to="/guugle" className={styles.backLink}>← Back to Guugle home</Link>
      </div>
    </div>
  )
}

export default function Guugle() {
  const [screen, setScreen] = useState('home')
  const [query, setQuery] = useState('')      // the query actually searched
  const [input, setInput] = useState('')       // the live text box value
  const [answer, setAnswer] = useState(null)
  const [results, setResults] = useState([])
  const [activeSite, setActiveSite] = useState(null)

  function runSearch(q) {
    const trimmed = (q || '').trim()
    if (!trimmed) return
    setQuery(trimmed)
    setInput(trimmed)
    setAnswer(getAnswer(trimmed))
    setResults(generateResults(trimmed))
    setScreen('results')
  }

  function handleFeelingWrong() {
    runSearch(randomFeelingWrongQuery())
  }

  function handleResultClick(result) {
    setActiveSite(buildFakeSitePage(result, query))
    setScreen('site')
  }

  return (
    <div className={styles.page}>
      {screen === 'home' && (
        <HomeScreen query={input} setQuery={setInput} onSearch={runSearch} onFeelingWrong={handleFeelingWrong} />
      )}
      {screen === 'results' && (
        <ResultsScreen
          query={query}
          input={input}
          setInput={setInput}
          onSearch={runSearch}
          answer={answer}
          results={results}
          onResultClick={handleResultClick}
        />
      )}
      {screen === 'site' && activeSite && (
        <FakeSiteScreen
          site={activeSite}
          query={query}
          onBack={() => setScreen('results')}
          onRelatedSearch={runSearch}
        />
      )}
    </div>
  )
}
