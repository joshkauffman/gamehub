// ── Special days ─────────────────────────────────────────────────────────
// The home page dresses up for holidays, seasons and players' birthdays.
// Add ?day=MM-DD to the URL to preview any date.

function mmdd(d) { return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const between = (x, a, b) => x >= a && x <= b

export function todayMMDD() {
  try {
    const q = new URLSearchParams(window.location.search).get('day')
    if (q && /^\d\d-\d\d$/.test(q)) return q
  } catch { /* no window */ }
  return mmdd(new Date())
}

// Returns { id, banner?, floaters, mode: 'fall' | 'rise' | 'fly', birthday? } or null.
export function specialDay(profiles, md = todayMMDD()) {
  const active = profiles.list.find(p => p.id === profiles.active)
  const bday = profiles.list.filter(p => p.birthday === md)
  if (bday.length) {
    const me = bday.find(p => p.id === active.id)
    const names = bday.map(p => p.name).join(' & ')
    return { id: 'birthday', birthday: !!me, banner: me ? `🎂 Happy birthday, ${me.name}! 🎉` : `🎂 It’s ${names}’s birthday today! Say happy birthday!`, floaters: ['🎈', '🎉', '🎁', '🎂'], mode: 'rise' }
  }
  if (md === '01-01') return { id: 'newyear', banner: '🎆 Happy New Year! 🎆', floaters: ['🎆', '🎇', '✨', '🥳'], mode: 'rise' }
  if (md === '02-14') return { id: 'valentine', banner: '💖 Happy Valentine’s Day! 💖', floaters: ['💖', '💕', '💘', '💝'], mode: 'rise' }
  if (md === '03-17') return { id: 'clover', banner: '🍀 Happy St. Patrick’s Day! 🍀', floaters: ['🍀', '☘️'], mode: 'fall' }
  if (md === '04-01') return { id: 'fools', banner: '🤡 April Fools! Nothing on this page is upside down. Probably.', floaters: ['🤡', '🙃', '🎭'], mode: 'fly' }
  if (md === '10-31') return { id: 'halloween', banner: '🎃 Happy Halloween! Boo! 👻', floaters: ['🎃', '👻', '🦇', '🍬'], mode: 'fly' }
  if (between(md, '10-01', '10-30')) return { id: 'october', floaters: ['🎃', '🍂', '🦇'], mode: 'fly' }
  if (md === '12-24' || md === '12-25') return { id: 'xmas', banner: '🎄 Merry Christmas! 🎁', floaters: ['❄️', '🎁', '⛄', '❄️'], mode: 'fall' }
  if (md === '12-31') return { id: 'nye', banner: '🎆 Happy New Year’s Eve! 🥳', floaters: ['❄️', '🎆', '✨'], mode: 'fall' }
  if (between(md, '12-01', '12-31') || between(md, '01-02', '01-31')) return { id: 'winter', floaters: ['❄️', '❅', '❆'], mode: 'fall' }
  if (between(md, '09-22', '09-30') || between(md, '11-01', '11-30')) return { id: 'autumn', floaters: ['🍂', '🍁', '🍂'], mode: 'fall' }
  if (between(md, '03-20', '05-31')) return { id: 'spring', floaters: ['🌸', '🌼', '🦋'], mode: 'fall' }
  return null
}
