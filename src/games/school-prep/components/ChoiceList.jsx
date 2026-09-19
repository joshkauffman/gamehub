import styles from './ChoiceList.module.css'

const LETTERS = ['A', 'B', 'C', 'D']

export default function ChoiceList({ choices, selected, onSelect }) {
  return (
    <div className={styles.list} role="radiogroup">
      {choices.map((choice, i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={selected === i}
          className={`${styles.choice} ${selected === i ? styles.selected : ''}`}
          onClick={() => onSelect(i)}
        >
          <span className={styles.letter}>{LETTERS[i]}</span>
          <span className={styles.text}>{choice}</span>
        </button>
      ))}
    </div>
  )
}
