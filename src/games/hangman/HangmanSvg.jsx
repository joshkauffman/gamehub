export default function HangmanSvg({ wrongCount }) {
  const stroke = '#e8e8f0'
  const sw = 3
  const figure = '#ff6584'

  return (
    <svg viewBox="0 0 200 230" width="200" height="230" aria-label={`Hangman: ${wrongCount} wrong guesses`}>
      {/* Gallows */}
      <line x1="20" y1="210" x2="180" y2="210" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <line x1="60" y1="210" x2="60" y2="20"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <line x1="60" y1="20"  x2="140" y2="20" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <line x1="60" y1="55"  x2="95"  y2="20" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <line x1="140" y1="20" x2="140" y2="45" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />

      {/* Head */}
      {wrongCount >= 1 && (
        <circle cx="140" cy="62" r="17" fill="none" stroke={figure} strokeWidth={sw} />
      )}
      {/* Body */}
      {wrongCount >= 2 && (
        <line x1="140" y1="79" x2="140" y2="135" stroke={figure} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* Left arm */}
      {wrongCount >= 3 && (
        <line x1="140" y1="95" x2="112" y2="118" stroke={figure} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* Right arm */}
      {wrongCount >= 4 && (
        <line x1="140" y1="95" x2="168" y2="118" stroke={figure} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* Left leg */}
      {wrongCount >= 5 && (
        <line x1="140" y1="135" x2="112" y2="168" stroke={figure} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* Right leg */}
      {wrongCount >= 6 && (
        <line x1="140" y1="135" x2="168" y2="168" stroke={figure} strokeWidth={sw} strokeLinecap="round" />
      )}
    </svg>
  )
}
