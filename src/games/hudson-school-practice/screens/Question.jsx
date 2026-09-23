import { useEffect, useState } from 'react'
import styles from './Question.module.css'
import ChoiceList from '../components/ChoiceList.jsx'

export default function Question({ question, index, total, revealed, selectedAnswerIndex, outcome, onSubmit, onIdk, onNext }) {
  const [pending, setPending] = useState(null)

  useEffect(() => {
    setPending(null)
  }, [question.id])

  const selected = revealed ? selectedAnswerIndex : pending

  return (
    <div className={styles.wrap}>
      <p className={styles.counter}>Question {index + 1} of {total}</p>
      <span className={styles.gradeBadge}>Grade {question.grade}</span>
      <h2 className={styles.prompt}>{question.prompt}</h2>

      <ChoiceList
        choices={question.choices}
        selected={selected}
        onSelect={revealed ? () => {} : setPending}
        revealed={revealed}
        correctIndex={question.answerIndex}
        onIdk={revealed ? () => {} : onIdk}
        idkChosen={revealed && outcome === 'idk'}
      />

      {!revealed && (
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} disabled={pending == null} onClick={() => onSubmit(pending)}>
            Submit answer
          </button>
        </div>
      )}

      {revealed && (
        <>
          <div className={`${styles.feedback} ${outcome === 'correct' ? styles.feedbackCorrect : outcome === 'incorrect' ? styles.feedbackWrong : styles.feedbackIdk}`}>
            <div className={styles.feedbackTitle}>
              {outcome === 'correct' && '🎉 That\'s right!'}
              {outcome === 'incorrect' && `Not quite — the answer is ${question.choices[question.answerIndex]}.`}
              {outcome === 'idk' && `That's okay! The answer is ${question.choices[question.answerIndex]}.`}
            </div>
            <p className={styles.explanation}>{question.explanation}</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={onNext}>
              {index + 1 >= total ? 'See results →' : 'Next question →'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
