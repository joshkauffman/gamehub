// ── Off-duty conversations: the Gardener and the Lamplighter ────────────
// Neither of them tells you their "story" the way the other staff do.
// Instead they say something different each time you talk to them: the
// first talk is always the same, after that it's a random one (never the
// same one twice in a row). Which ones you've heard is saved per speaker.

export const TALKS = {
  // At the Moonlight Fair. He's only out there once you've rung his bell.
  gardener: {
    first: [
      '…',
      'You rang my bell.',
      "Do you know how long it's been since anybody rang my bell?",
      'A hundred years. I counted. Gardeners are very good at waiting.',
      'Thank you. Mind the petunias on your way out.',
    ],
    more: [
      ['Evening.', 'The petunias like the music. They lean toward the carousel.', "So do I. Don't tell anyone."],
      ['*snip* … *snip*', "Hm? Oh, I'm not cutting anything.", 'I just like the sound.'],
      ['Everything in this garden grows back.', 'The flowers. The hedges. The Harvester, a little, on Tuesdays.', "Don't worry. He's much smaller now."],
      ['The Lamplighter and I have tea on Thursdays.', 'He brings the dark. I bring the mint.', "He thinks I don't notice he takes four sugars."],
      ['Look at them dancing.', "Barry steps on everybody's feet. Doug doesn't have feet. It works out.", 'I never dance.', '…I danced once. In 1931. Never again.'],
      ["You're standing on a seed.", 'No — the other foot.', "…Too late. Something will grow there now. We'll see what."],
      ['Do you want to know a secret?', 'I planted the moon.', '…', 'That one was a joke. The moon was already here. I just weeded around it.'],
      ['Go and ride the wheel.', 'From the top you can see my whole garden.', "And if you're very quiet up there, you can hear it growing."],
      ['Wendell asked me to plant him a bandage tree.', 'I told him those don\'t exist.', '…It is coming up nicely, though.'],
    ],
  },
  // At the fair, standing at the edge of the light.
  lamplighter: {
    first: [
      '…',
      'You came outside.',
      "I don't come into the light, usually. It's very loud out here.",
      'But he asked me to. The Gardener. He said, "Come and see who rang my bell."',
      'So I came. And I saw.',
      '…Hello.',
    ],
    more: [
      ['The fireworks are very bright.', 'I count them. Every one that goes up comes down again in the dark.', "Down there, they're mine."],
      ['Shh.', '…', "Sorry. Habit. Nobody's asleep out here."],
      ['I lit every lamp on this path.', 'Before the hotel. Before the path. I lit them first, and the path came looking for them.'],
      ["He smiles a great deal, doesn't he? The Gardener.", "I don't have a face. So I let him smile for both of us."],
      ["The little moths around the lamps aren't afraid of me.", "Steve isn't either. He keeps asking if he can sit in my head.", '…The answer is no.'],
      ['Thursdays. Tea. Mint.', 'He talks about roses. I talk about the dark. Neither of us listens.', "It's the best part of my week."],
      ['You blinked again.', "…I'm only teasing. I can't see blinking. I can only see light."],
      ['When you go back inside, count the doors.', '…No reason.', 'Just count them.'],
      ['The carousel goes round and round and never arrives anywhere.', 'I like it.', "It's the only thing out here that understands me."],
    ],
  },
  // In the lobby, standing in the support-group circle.
  lamplighterLobby: {
    first: [
      '…',
      'Support group. Wednesdays.',
      "I don't sit. Sitting is for people who are going to get up again.",
      '…That came out wrong. I just prefer standing.',
    ],
    more: [
      ['They keep offering me a stool.', 'Wendell made me a name tag. It says LAMPY.', "I'm wearing it. Inside the coat. Where it's dark."],
      ['Barry talks about his vacuum every week.', 'I like Barry.', "Don't tell him."],
      ["It's very bright in here.", "…It's fine. I'm practising."],
      ['The Gardener says I should share more in group.', '…', 'I shared that.'],
      ['Grandma Bea keeps the fire going all night.', 'I keep telling her the dark is very nice.', 'She keeps giving me cocoa. I keep drinking it.'],
    ],
  },
}

const KEY = 'totallyScaryHorrorGame.talks.v1'
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}

// The next conversation for this speaker: the first one first, then a random
// other one (not the one you just heard).
export function nextTalk(id) {
  const all = load()
  const seen = all[id] || { first: false, last: -1 }
  const set = TALKS[id]
  let lines
  if (!seen.first) {
    lines = set.first
    seen.first = true
  } else {
    let k = Math.floor(Math.random() * set.more.length)
    if (k === seen.last) k = (k + 1) % set.more.length
    seen.last = k
    lines = set.more[k]
  }
  try { localStorage.setItem(KEY, JSON.stringify({ ...all, [id]: seen })) } catch { /* storage unavailable */ }
  return lines
}
