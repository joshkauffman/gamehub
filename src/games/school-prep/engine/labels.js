// Display names for strand/topic ids — kept separate from the ids themselves
// so French strands can show their accents even though ids stay plain ASCII.
export const STRAND_LABELS = {
  'reading-comprehension': 'Reading comprehension',
  'language-conventions': 'Language conventions',
  'vocabulary-figurative': 'Vocabulary & figurative language',
  'verbal-reasoning': 'Verbal reasoning',
  'comprehension-lecture': 'Compréhension de lecture',
  grammaire: 'Grammaire',
  conjugaison: 'Conjugaison',
  'orthographe-homophones': 'Orthographe & homophones',
  vocabulaire: 'Vocabulaire',
  'numbers-operations': 'Numbers & operations',
  'fractions-percent': 'Fractions & percent',
  geometry: 'Geometry',
  measurement: 'Measurement',
  'stats-probability': 'Stats & probability',
  'problem-solving-patterns': 'Problem solving & patterns',
}

export function strandLabel(strand) {
  return STRAND_LABELS[strand] || strand.replace(/-/g, ' ')
}
