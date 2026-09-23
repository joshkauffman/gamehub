function groupBy(results, keyFn) {
  const groups = {}
  for (const r of results) {
    const key = keyFn(r)
    groups[key] ??= { key, correct: 0, wrong: 0, idk: 0, total: 0 }
    groups[key].total++
    if (r.outcome === 'correct') groups[key].correct++
    else if (r.outcome === 'incorrect') groups[key].wrong++
    else groups[key].idk++
  }
  // Worst accuracy first, so the weakest spots surface at the top.
  return Object.values(groups).sort((a, b) => (a.correct / a.total) - (b.correct / b.total))
}

export function scoreRound(round) {
  const results = round.questions.map(q => {
    const outcome = round.outcomes[q.id] ?? 'idk'
    const answerIndex = round.answers[q.id] ?? null
    return { question: q, answerIndex, outcome, correct: outcome === 'correct' }
  })

  const total = results.length
  const correctCount = results.filter(r => r.outcome === 'correct').length
  const wrongCount = results.filter(r => r.outcome === 'incorrect').length
  const idkCount = results.filter(r => r.outcome === 'idk').length
  const percent = total ? Math.round((correctCount / total) * 100) : 0

  return {
    total,
    correctCount,
    wrongCount,
    idkCount,
    percent,
    byGrade: groupBy(results, r => r.question.grade),
    byTopic: groupBy(results, r => r.question.topic),
    results,
  }
}
