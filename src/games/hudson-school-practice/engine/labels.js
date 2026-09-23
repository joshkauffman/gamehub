// Turns a kebab-case topic/strand key into a readable label, e.g.
// "order-of-operations" -> "Order Of Operations". No manual dictionary to
// maintain — the topic set here is small and the words are plain English.
export function topicLabel(key) {
  return String(key)
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
