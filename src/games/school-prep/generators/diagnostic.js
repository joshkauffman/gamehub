// Generators modelled on a Grade 5 diagnostic test from the son's teacher
// (place value, expanded form, comparing, rounding, series, primes, factors,
// equivalent fractions/decimals, geometry, measurement, statistics,
// probability). Every question is multiple choice. Terms a new Grade 6
// student might not be sure of are defined right in the prompt.

import { randInt, pick, shuffled, fmt, make, makeFixed, makeNum, NO, FP, PS, pad2 } from './helpers.js'

const isPrime = n => {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
  return true
}
const isSquare = n => Number.isInteger(Math.sqrt(n))

const PLACES = [
  { abbr: 'TTh', value: 10000 },
  { abbr: 'Th', value: 1000 },
  { abbr: 'H', value: 100 },
  { abbr: 'T', value: 10 },
  { abbr: 'U', value: 1 },
]
const ABBR_KEY = '(Th = thousands, H = hundreds, T = tens, U = units, TTh = ten thousands)'

// One "digit x place" term written either as "8 Th" or "(8 × 1000)".
function termText(t, style) {
  return style === 'abbr' ? `${t.digit} ${t.place.abbr}` : `(${t.digit} × ${fmt(t.place.value)})`
}
function exprText(terms, style) {
  return terms.map(t => termText(t, style)).join(' + ')
}
function termsValue(terms) {
  return terms.reduce((sum, t) => sum + t.digit * t.place.value, 0)
}
// Random 3-4 term number with one interior zero (an omitted place), so the
// "zero placeholder" trap from the test (8 Th + 6 H + 7 U = 8 607) appears.
function randomTerms(len) {
  const places = PLACES.slice(PLACES.length - len)
  const zeroAt = randInt(1, len - 1)
  return places
    .map((place, i) => ({ place, digit: i === zeroAt ? 0 : randInt(1, 9) }))
    .filter(t => t.digit !== 0)
}

function fractionText(n, d) { return `${n}/${d}` }

// Whole hundredths -> "1478.06" / "25.5" / "5689" depending on decimals shown.
function hundredthsText(h, decimals) {
  const whole = Math.floor(h / 100)
  const frac = h % 100
  if (decimals === 0) return fmt(whole)
  if (decimals === 1) return `${fmt(whole)}.${Math.floor(frac / 10)}`
  return `${fmt(whole)}.${pad2(frac)}`
}
const roundTo = (h, p) => Math.round(h / p) * p

export const DIAGNOSTIC_GENERATORS = {
  'place-value-reasoning'(difficulty) {
    const kind = pick(['before-after', 'add-groups', 'how-many', 'digit-worth'])

    if (kind === 'before-after') {
      const n = randInt(11, 99) * 1000 + pick([0, 0, 100, 900, 910, 990])
      const before = Math.random() < 0.5
      const correct = before ? n - 1 : n + 1
      return makeNum(NO, 'place-value-reasoning', difficulty,
        `What number comes just ${before ? 'before' : 'after'} ${fmt(n)}?`, correct,
        before ? [n - 10, n - 100, n + 1, n - 1000] : [n + 10, n + 100, n - 1, n + 1000],
        `${before ? 'Just before' : 'Just after'} means ${before ? '1 less' : '1 more'}: ${fmt(n)} ${before ? '−' : '+'} 1 = ${fmt(correct)}.`)
    }

    if (kind === 'add-groups') {
      const n = randInt(10000, 89000) + randInt(0, 9) * 10
      const k = randInt(2, 9)
      const unit = pick([{ name: 'tens', v: 10 }, { name: 'hundreds', v: 100 }, { name: 'thousands', v: 1000 }])
      const add = k * unit.v
      return makeNum(NO, 'place-value-reasoning', difficulty,
        `Add ${k} ${unit.name} to ${fmt(n)}. What number do you get?`, n + add,
        [n + k, n + add * 10, n + add / 10, n + k * (unit.v === 100 ? 10 : 100)],
        `${k} ${unit.name} is ${k} × ${fmt(unit.v)} = ${fmt(add)}. Then ${fmt(n)} + ${fmt(add)} = ${fmt(n + add)}.`)
    }

    if (kind === 'how-many') {
      const n = randInt(10000, 99999)
      const unit = pick([{ name: 'tens', v: 10 }, { name: 'hundreds', v: 100 }, { name: 'thousands', v: 1000 }])
      const correct = Math.floor(n / unit.v)
      return makeNum(NO, 'place-value-reasoning', difficulty,
        `How many whole ${unit.name} are there in the number ${fmt(n)}?`, correct,
        [Math.floor(n / (unit.v * 10)), Math.floor(n / unit.v) % 10, correct + 1, Math.floor(n / (unit.v / 10))],
        `Divide ${fmt(n)} by ${fmt(unit.v)} and keep the whole part: ${correct} whole ${unit.name}.`)
    }

    const x = randInt(2, 9)
    const target = randInt(1, 4) // place index: 10^target
    const others = shuffled([0, 1, 2, 3, 4].filter(p => p !== target)).slice(0, 3)
    const makeNumber = pos => {
      const digits = Array.from({ length: 5 }, (_, i) => {
        let d
        do { d = randInt(i === 0 ? 1 : 0, 9) } while (d === x)
        return d
      })
      digits[4 - pos] = x
      return Number(digits.join(''))
    }
    const correct = makeNumber(target)
    return make(NO, 'place-value-reasoning', difficulty,
      `In which number is the digit ${x} worth ${fmt(x * Math.pow(10, target))}?`, fmt(correct),
      others.map(p => fmt(makeNumber(p))),
      `The digit ${x} is worth ${fmt(x * Math.pow(10, target))} when it sits in the ${['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'][target]} place. Only ${fmt(correct)} has it there.`)
  },

  'expanded-form'(difficulty) {
    const len = randInt(4, 5)
    const terms = randomTerms(len)
    const style = Math.random() < 0.5 ? 'abbr' : 'times'
    const written = shuffled(terms)
    const correct = termsValue(terms)
    const inPlaceOrder = Number(terms.map(t => t.digit).join(''))
    const inWrittenOrder = Number(written.map(t => t.digit).join(''))
    const swap = () => {
      const s = String(correct).split('')
      const i = randInt(0, s.length - 2)
      ;[s[i], s[i + 1]] = [s[i + 1], s[i]]
      return Number(s.join(''))
    }
    return makeNum(NO, 'expanded-form', difficulty,
      `Which number is equal to ${exprText(written, style)}?${style === 'abbr' ? ` ${ABBR_KEY}` : ''}`, correct,
      [inPlaceOrder, inWrittenOrder, swap(), correct * 10, Math.floor(correct / 10)],
      `Give each digit its place value: ${terms.map(t => `${t.digit} × ${fmt(t.place.value)} = ${fmt(t.digit * t.place.value)}`).join(', ')}. A place with no term is 0, so the total is ${fmt(correct)}.`)
  },

  'compare-expressions'(difficulty) {
    const style = Math.random() < 0.5 ? 'abbr' : 'times'
    const left = randomTerms(randInt(4, 5))
    let right
    if (Math.random() < 0.3) {
      right = shuffled(left) // same value, different order -> "="
    } else {
      do { right = randomTerms(randInt(4, 5)) } while (termsValue(right) === termsValue(left))
    }
    const a = termsValue(left), b = termsValue(right)
    const symbol = a < b ? '<' : a > b ? '>' : '='
    return makeFixed(NO, 'compare-expressions', difficulty,
      `Which symbol goes in the blank to compare the numbers? ${exprText(left, style)}  ___  ${exprText(shuffled(right), style)}${style === 'abbr' ? ` ${ABBR_KEY}` : ''}`,
      ['<', '>', '='], symbol,
      `The left side is ${fmt(a)} and the right side is ${fmt(b)}, so ${fmt(a)} ${symbol} ${fmt(b)}. ( < means "less than", > means "greater than".)`)
  },

  'compare-fractions'(difficulty) {
    let a, b
    const kind = pick(['same-den', 'same-num', 'equivalent', 'half'])
    if (kind === 'same-den') {
      const d = randInt(4, 12), n1 = randInt(1, d - 1)
      let n2; do { n2 = randInt(1, d - 1) } while (n2 === n1)
      a = [n1, d]; b = [n2, d]
    } else if (kind === 'same-num') {
      const n = randInt(1, 4)
      const d1 = randInt(n + 1, 10)
      let d2; do { d2 = randInt(n + 1, 12) } while (d2 === d1)
      a = [n, d1]; b = [n, d2]
    } else if (kind === 'equivalent') {
      const d = pick([3, 4, 5, 6]), n = randInt(1, d - 1), k = randInt(2, 4)
      a = [n, d]; b = [n * k, d * k]
    } else {
      const d = pick([3, 5, 7, 9, 10]), n = randInt(1, d - 1)
      a = [n, d]; b = [1, 2]
      if (n * 2 === d) a = [n + 1, d]
    }
    if (Math.random() < 0.5) [a, b] = [b, a]
    const cross = a[0] * b[1] - b[0] * a[1]
    const symbol = cross < 0 ? '<' : cross > 0 ? '>' : '='
    return makeFixed(FP, 'compare-fractions', difficulty,
      `Which symbol goes in the blank? ${fractionText(...a)}  ___  ${fractionText(...b)}  ( < less than, > greater than, = equal to )`,
      ['<', '>', '='], symbol,
      `Rewrite with a common denominator: ${a[0] * b[1]}/${a[1] * b[1]} and ${b[0] * a[1]}/${a[1] * b[1]}. So ${fractionText(...a)} ${symbol} ${fractionText(...b)}.`)
  },

  'multi-digit-arithmetic'(difficulty) {
    const op = pick(['add', 'sub', 'mul', 'div'])
    if (op === 'add') {
      const a = randInt(10000, 59999), b = randInt(10000, 39999)
      const c = a + b
      return makeNum(NO, 'multi-digit-arithmetic', difficulty, `Calculate: ${fmt(a)} + ${fmt(b)}`, c,
        [c - 10, c + 100, c - 1000, c - 100],
        `Line up the digits and add column by column, carrying when a column is 10 or more: ${fmt(a)} + ${fmt(b)} = ${fmt(c)}.`)
    }
    if (op === 'sub') {
      const a = Math.random() < 0.4 ? randInt(3, 9) * 1000 : randInt(20000, 99999)
      const b = randInt(1200, Math.floor(a * 0.8))
      const c = a - b
      const digitwise = Number(String(a).padStart(6, '0').split('').map((x, i) => Math.abs(Number(x) - Number(String(b).padStart(6, '0')[i]))).join(''))
      return makeNum(NO, 'multi-digit-arithmetic', difficulty, `Calculate: ${fmt(a)} − ${fmt(b)}`, c,
        [digitwise, c + 10, c - 100, c + 1000],
        `Subtract column by column, borrowing when the top digit is smaller: ${fmt(a)} − ${fmt(b)} = ${fmt(c)}.`)
    }
    if (op === 'mul') {
      const a = Math.random() < 0.5 ? randInt(100, 999) : randInt(1000, 4999)
      const b = randInt(3, 9)
      const c = a * b
      return makeNum(NO, 'multi-digit-arithmetic', difficulty, `Calculate: ${fmt(a)} × ${b}`, c,
        [c - 10, c + 100, c - 100, c + 10, c - 1000],
        `Multiply each place by ${b} and carry: ${fmt(a)} × ${b} = ${fmt(c)}.`)
    }
    const b = randInt(2, 9), q = randInt(12, 320)
    const a = q * b
    return makeNum(NO, 'multi-digit-arithmetic', difficulty, `Calculate: ${fmt(a)} ÷ ${b}`, q,
      [q + 10, q - 10, q + 1, q - 1, q * 10],
      `Check with multiplication: ${q} × ${b} = ${fmt(a)}, so ${fmt(a)} ÷ ${b} = ${q}.`)
  },

  rounding(difficulty) {
    const places = [
      { name: 'thousand', p: 100000, dec: 0 },
      { name: 'hundred', p: 10000, dec: 0 },
      { name: 'unit (whole number)', p: 100, dec: 0 },
      { name: 'tenth', p: 10, dec: 1 },
    ]
    let place, h
    do {
      place = pick(places)
      const whole = randInt(1000, 9999)
      const frac = place.p === 10 ? randInt(1, 99) : Math.random() < 0.4 ? 0 : randInt(1, 99)
      h = whole * 100 + frac
    } while (h % place.p === 0)
    const original = h % 100 === 0 ? fmt(h / 100) : `${Math.floor(h / 100)}.${pad2(h % 100)}`
    const correct = roundTo(h, place.p)
    const down = Math.floor(h / place.p) * place.p
    const up = Math.ceil(h / place.p) * place.p
    const text = v => hundredthsText(v, place.dec)
    const own = (v, p) => hundredthsText(v, p === 10 ? 1 : p < 10 ? 2 : 0)
    return make(NO, 'rounding', difficulty,
      `Round ${original} to the nearest ${place.name}.`, text(correct),
      [text(down), text(up), own(roundTo(h, place.p * 10), place.p * 10), own(roundTo(h, place.p / 10), place.p / 10), text(correct + place.p), text(Math.max(0, correct - place.p))],
      `Look at the digit just to the right of the ${place.name} place. If it is 5 or more, round up; if it is 4 or less, round down. ${original} rounds to ${text(correct)}.`)
  },

  'number-sequences'(difficulty) {
    const modes = difficulty === 1 ? ['add', 'interval'] : difficulty === 2 ? ['add', 'sub', 'interval'] : ['add', 'sub', 'mult', 'alt', 'interval']
    const mode = pick(modes)
    if (mode === 'add') {
      const start = randInt(2, 60), step = pick([2, 3, 4, 5, 6, 7, 9, 10])
      const t = [0, 1, 2, 3].map(i => start + i * step)
      const next = t[3] + step
      return makeNum(PS, 'number-sequences', difficulty, `What number comes next in this pattern? ${t.join(', ')}, ___`, next,
        [next + step, next - 1, next + 1, t[3] + step + 1], `The pattern adds ${step} each time, so the next number is ${t[3]} + ${step} = ${next}.`)
    }
    if (mode === 'sub') {
      const start = randInt(150, 500), step = pick([4, 5, 6, 7, 9, 10])
      const t = [0, 1, 2, 3].map(i => start - i * step)
      const next = t[3] - step
      return makeNum(PS, 'number-sequences', difficulty, `What number comes next in this pattern? ${t.join(', ')}, ___`, next,
        [t[3] + step, next - step, next + 1, next - 1], `The pattern goes down by ${step} each time, so the next number is ${t[3]} − ${step} = ${next}.`)
    }
    if (mode === 'mult') {
      const factor = pick([2, 2, 3]), start = randInt(2, factor === 2 ? 9 : 4)
      const t = [0, 1, 2, 3].map(i => start * Math.pow(factor, i))
      const next = t[3] * factor
      return makeNum(PS, 'number-sequences', difficulty, `What number comes next in this pattern? ${t.join(', ')}, ___`, next,
        [t[3] + (t[3] - t[2]), t[3] + factor, next + start, next - 1], `Each number is ${factor} times the one before (${t[0]} × ${factor} = ${t[1]}), so the next is ${t[3]} × ${factor} = ${next}.`)
    }
    if (mode === 'alt') {
      const x = randInt(2, 6), y = x + randInt(2, 6), start = randInt(100, 600)
      const t = [start, start - x, start - x + y, start - x + y - x]
      const next = t[3] + y
      return makeNum(PS, 'number-sequences', difficulty, `What number comes next in this pattern? ${t.join(', ')}, ___`, next,
        [t[3] - x, t[3] + x, next + 1, next - 1], `The pattern alternates: subtract ${x}, add ${y}, subtract ${x}, so next comes "add ${y}": ${t[3]} + ${y} = ${next}.`)
    }
    const start = randInt(100, 3000), step = randInt(3, 9) * pick([1, 1, 2])
    const t = [0, 1, 2, 3].map(i => start + i * step)
    return makeNum(PS, 'number-sequences', difficulty, `These numbers go up by the same amount each time. What is that amount (the interval)? ${t.join(', ')}`, step,
      [step + 1, step - 1, step * 2, t[3] - t[0]], `Each number is ${step} more than the one before: ${t[1]} − ${t[0]} = ${step}.`)
  },

  'number-properties'(difficulty) {
    const KEY = 'A square number is a number times itself (like 25 = 5 × 5). A prime number has exactly two factors: 1 and itself. A composite number has more than two factors.'
    const statements = []
    const seenText = new Set()
    for (let i = 0; i < 300 && statements.length < 40; i++) {
      const n = randInt(1, 100)
      let m
      do { m = pick([1, 4, 9, 16, 25, 36, 49, 64, 81, 100, randInt(2, 100)]) } while (m === n)
      const options = [
        [`${n} is a square number`, isSquare(n)],
        [`${n} is a prime number`, isPrime(n)],
        [`${n} is a composite number`, n > 1 && !isPrime(n)],
        [`${n} is an odd, composite and square number`, n % 2 === 1 && n > 1 && !isPrime(n) && isSquare(n)],
        [`${n} and ${m} are square numbers`, isSquare(n) && isSquare(m)],
      ]
      const [text, truth] = pick(options)
      if (!seenText.has(text)) { seenText.add(text); statements.push({ text, truth }) }
    }
    const trues = shuffled(statements.filter(s => s.truth))
    const falses = shuffled(statements.filter(s => !s.truth))
    if (trues.length < 3 || falses.length < 3) return DIAGNOSTIC_GENERATORS['number-properties'](difficulty) // freak roll: too few statements to build a question
    const askTrue = Math.random() < 0.6 || trues.length < 3
    const [one, many] = askTrue ? [trues, falses] : [falses, trues]
    const correct = one[0]
    const others = many.slice(0, 3)
    return make(NO, 'number-properties', difficulty,
      `Which answer is ${askTrue ? 'true' : 'false'}?`, correct.text, others.map(s => s.text),
      `"${correct.text}" is ${askTrue ? 'true' : 'false'}, and each of the other answers is ${askTrue ? 'false' : 'true'}. (${KEY})`)
  },

  'prime-factorization'(difficulty) {
    const n = pick([12, 18, 20, 24, 28, 30, 36, 40, 42, 45, 50, 60, 63, 70, 72, 75, 84, 90, 100])
    const factors = []
    let rest = n
    for (let p = 2; rest > 1; p++) while (rest % p === 0) { factors.push(p); rest /= p }
    const show = arr => arr.join(' × ')
    const next = p => { let q = p + 1; while (!isPrime(q)) q++; return q }
    const dropOne = factors.slice(1)
    const addOne = [...factors, factors[0]].sort((a, b) => a - b)
    const merged = [factors[0] * factors[1], ...factors.slice(2)].sort((a, b) => a - b)
    const bumped = [...factors.slice(0, -1), next(factors[factors.length - 1])]
    const other = [...factors]; other[0] = next(other[0]); other.sort((a, b) => a - b)
    return make(NO, 'prime-factorization', difficulty,
      `Which shows ${n} written as a product of prime factors? (A prime factor is a prime number that divides evenly into ${n}.)`, show(factors),
      [show(merged), show(dropOne), show(addOne), show(bumped), show(other)],
      `Keep dividing by primes: ${n} = ${show(factors)}. (${show(merged)} has a factor that is not prime.)`)
  },

  multiples(difficulty) {
    if (Math.random() < 0.55) {
      const n = randInt(3, 12), k = 6
      const list = Array.from({ length: k }, (_, i) => n * (i + 1))
      const skip = [...list]; skip.splice(randInt(1, 3), 1); skip.push(n * (k + 1))
      const step = Array.from({ length: k }, (_, i) => (n + 1) * (i + 1))
      const off = [...list]; off[k - 1] = list[k - 1] - 1
      const startOne = [1, ...list.slice(0, k - 1)]
      return make(NO, 'multiples', difficulty,
        `Which list shows the first ${k} multiples of ${n}? (A multiple of ${n} is what you get when you multiply ${n} by 1, 2, 3, and so on.)`,
        list.join(', '), [skip.join(', '), step.join(', '), off.join(', '), startOne.join(', ')],
        `Count by ${n}s: ${list.join(', ')}.`)
    }
    const pairs = [[2, 3], [3, 4], [4, 6], [3, 5], [4, 5], [6, 8], [2, 5], [3, 9], [4, 10], [6, 9]]
    const [a, b] = pick(pairs)
    const all = Array.from({ length: 99 }, (_, i) => i + 2)
    const both = all.filter(x => x % a === 0 && x % b === 0)
    const onlyOne = shuffled(all.filter(x => (x % a === 0) !== (x % b === 0)))
    const correct = pick(both)
    return make(NO, 'multiples', difficulty,
      `Which number is a multiple of both ${a} and ${b}? (A multiple of ${a} is a number you reach by counting by ${a}s.)`, String(correct),
      onlyOne.slice(0, 3).map(String),
      `${correct} ÷ ${a} = ${correct / a} and ${correct} ÷ ${b} = ${correct / b}, both with no remainder.`)
  },

  'equivalent-expressions'(difficulty) {
    const kind = pick(['times', 'minus', 'divide', 'sum'])
    if (kind === 'times') {
      // Both factors stay within the 12 × 12 times table.
      let a, b, c, x
      do {
        a = randInt(2, 12); b = randInt(2, 12)
        const options = [2, 3, 4, 5, 6, 8, 9, 10, 12].filter(d => (a * b) % d === 0 && d !== a && d !== b)
        c = options.length ? pick(options) : 0
      } while (!c)
      const total = a * b
      x = total / c
      return makeNum(NO, 'equivalent-expressions', difficulty,
        `Find the number that makes both sides equal: ${a} × ${b} = ${c} × ___`, x,
        [total, a + b - c, x + 1, x - 1, b], `${a} × ${b} = ${total}. Ask what times ${c} gives ${total}: ${total} ÷ ${c} = ${x}.`)
    }
    if (kind === 'minus') {
      const b = randInt(20, 99), c = randInt(20, 99), sum = b + c, a = sum + randInt(10, 60)
      return makeNum(NO, 'equivalent-expressions', difficulty,
        `Find the number that makes both sides equal: ${a} − ___ = ${b} + ${c}`, a - sum,
        [a - b, a + sum, sum - a > 0 ? sum - a : a - b - 1], `${b} + ${c} = ${sum}. Then ${a} − ${sum} = ${a - sum}, so the blank is ${a - sum}.`)
    }
    if (kind === 'divide') {
      const k = randInt(2, 5), m = randInt(2, 5), q = randInt(2, 10), total = k * m * q
      return makeNum(NO, 'equivalent-expressions', difficulty,
        `Find the number that makes both sides equal: ${total} ÷ ${k} = ___ × ${m}`, q,
        [total / k, total / m, q + 1, q * 2], `${total} ÷ ${k} = ${total / k}. What times ${m} gives ${total / k}? ${total / k} ÷ ${m} = ${q}.`)
    }
    const k = randInt(3, 6), q = randInt(8, 30), total = k * q
    const a = randInt(Math.min(20, Math.floor(total / 3)), Math.floor(total / 2)), b = randInt(3, 9), c = total - a - b
    return makeNum(NO, 'equivalent-expressions', difficulty,
      `Find the number that makes both sides equal: ${a} + ${b} + ${c} = ${k} × ___`, q,
      [total, q + 1, q - 1, total - k], `${a} + ${b} + ${c} = ${total}. Then ${total} ÷ ${k} = ${q}.`)
  },

  'not-equivalent'(difficulty) {
    let whole, hh
    do { whole = randInt(1, 60); hh = randInt(1, 99) } while (hh % 10 === 0 || hh < 3)
    const numer = whole * 100 + hh
    const forms = [`${whole}.${pad2(hh)}`, `${numer}/100`, `${whole} ${hh}/100`]
    if (whole === 1 && Math.random() < 0.3) forms.push(`${numer}/100`)
    const swapped = Number(String(pad2(hh)).split('').reverse().join(''))
    const odd = pick([
      `${numer}/10`,
      swapped !== hh ? `${whole}.${pad2(swapped)}` : `${numer}/10`,
      `${whole}.${Math.floor(hh / 10)}`,
    ])
    const eq = shuffled(forms.filter((f, i, a) => a.indexOf(f) === i)).slice(0, 3)
    return make(FP, 'not-equivalent', difficulty,
      `Which one is NOT equivalent (equal in value) to the others?`, odd, eq,
      `${forms.join(', ')} all equal ${whole}.${pad2(hh)}. ${odd} has a different value.`)
  },

  'decimal-number-line'(difficulty) {
    const fine = difficulty > 1 && Math.random() < 0.6
    if (!fine) {
      const w = randInt(5, 9), t = randInt(1, 9)
      const value = `${w}.${t}`
      return make(NO, 'decimal-number-line', difficulty,
        `What decimal does point P show on the number line? The line runs from ${w} to ${w + 1}, in equal steps.`, value,
        [`${w}.${10 - t}`, `${w}.${t === 9 ? 8 : t + 1}`, `${w}.${t === 1 ? 2 : t - 1}`, `${w + 1}.${t}`, `${w}.0${t}`],
        `There are 10 equal steps between ${w} and ${w + 1}, so each step is 0.1. P is ${t} steps from ${w}: ${value}.`,
        { visual: { type: 'numberline', ticks: 10, labels: { 0: String(w), 10: String(w + 1) }, pointIndex: t } })
    }
    const B = randInt(12, 60), s = randInt(0, 4), p = pick(Array.from({ length: 49 }, (_, i) => i + 1).filter(i => i % 10 !== 0))
    const h = B * 100 + s * 10 + p
    const text = v => `${Math.floor(v / 100)}.${pad2(v % 100)}`
    const rev = Math.floor(h / 100) * 100 + Number(String(pad2(h % 100)).split('').reverse().join(''))
    const labels = {}
    for (let i = 0; i <= 5; i++) labels[i * 10] = `${B}.${s + i}`
    return make(NO, 'decimal-number-line', difficulty,
      `What decimal does point P show on the number line? Each small mark is 0.01.`, text(h),
      [text(h + 1), text(h - 1), text(h + 10), text(h - 10), text(rev)],
      `Start at the nearest labelled mark and count the small marks (each is 0.01). P is at ${text(h)}.`,
      { visual: { type: 'numberline', ticks: 50, labels, pointIndex: p } })
  },
}
