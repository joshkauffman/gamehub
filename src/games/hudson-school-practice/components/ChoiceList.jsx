import styles from './ChoiceList.module.css'

const LETTERS = ['A', 'B', 'C', 'D']

// Renders the lettered answer choices plus a distinct, always-present
// "I have no idea" action. The idk button lives outside the lettered list on
// purpose — it never participates in choice shuffling and is tracked as its
// own outcome regardless of which question is showing.
export default function ChoiceList({ choices, selected, onSelect, revealed, correctIndex, onIdk, idkChosen }) {
  return (
    <div>
      <div className={styles.list} role="radiogroup">
        {choices.map((choice, i) => {
          const isCorrect = revealed && i === correctIndex
          const isWrongPick = revealed && i === selected && i !== correctIndex
          const className = [
            styles.choice,
            selected === i ? styles.selected : '',
            isCorrect ? styles.correctChoice : '',
            isWrongPick ? styles.wrongChoice : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selected === i}
              disabled={revealed}
              className={className}
              onClick={() => onSelect(i)}
            >
              <span className={styles.letter}>{LETTERS[i]}</span>
              <span className={styles.text}>{choice}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        disabled={revealed}
        className={`${styles.idkBtn} ${revealed && idkChosen ? styles.idkChosen : ''}`}
        onClick={onIdk}
      >
        🤷 I have no idea
      </button>
    </div>
  )
}
