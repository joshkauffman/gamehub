// Confidence labels drive the "Sure but wrong" number the build guide calls
// out as the most useful stat — it flags overconfidence, not just gaps.
function confidenceLabel(status, answerIndex, correctIndex) {
  const isBlank = answerIndex == null
  if (isBlank) return 'Guessed' // left blank at submit time — no info either way
  const isRight = answerIndex === correctIndex
  if (status === 'flagged') return 'Flagged'
  if (status === 'unsure') return isRight ? 'Guessed and right' : 'Guessed and wrong'
  return isRight ? 'Sure and right' : 'Sure but wrong'
}

export function scoreRound(round) {
  const results = round.questions.map(q => {
    const answerIndex = round.answers[q.id] ?? null
    const status = round.status[q.id]
    const correct = answerIndex === q.answerIndex
    return {
      question: q,
      answerIndex,
      correct,
      confidence: confidenceLabel(status, answerIndex, q.answerIndex),
    }
  })

  const correctCount = results.filter(r => r.correct).length
  const total = results.length
  const percent = total ? Math.round((correctCount / total) * 100) : 0

  const byTopic = {}
  for (const r of results) {
    const key = r.question.strand
    byTopic[key] ??= { strand: key, correct: 0, total: 0 }
    byTopic[key].total++
    if (r.correct) byTopic[key].correct++
  }

  const byConfidence = {}
  for (const r of results) {
    byConfidence[r.confidence] = (byConfidence[r.confidence] || 0) + 1
  }

  return {
    correctCount,
    total,
    percent,
    timeUsedSeconds: round.timeUsedSeconds,
    byTopic: Object.values(byTopic).sort((a, b) => (a.correct / a.total) - (b.correct / b.total)),
    byConfidence,
    results,
  }
}
