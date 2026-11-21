// ── The Totally Scary Horror Game — shared data ─────────────────────────
// A first-person walk through a haunted hotel, one room after another,
// in the style of the Roblox hotel-crawler games: rummage drawers for
// tips and staff passes, duck into closets when the lights flicker,
// don't stare at the floating vampire, turn around when told to, run
// when chased, and sneak past the blind knight in the library.
//
// The premise is still the whole joke: none of the monsters are actually
// scary. Fail one of their "mechanics" and it doesn't end the game — the
// monster just sits down and tells you, at length, why it's really doing
// this job (the economy, mostly).
//
// Units are meters. The hotel runs in a straight line toward -Z; each
// room's interior spans x ∈ [-hw, hw], z ∈ [z1, z0] (z1 < z0), with one
// shared wall of thickness WALL_T between consecutive rooms.

export const WALL_T = 0.3
export const ROOM_H = 3.0
export const GAP_HALF = 0.8 // half-width of the opening between rooms
export const GAP_H = 2.4

export const PLAYER_RADIUS = 0.3
export const EYE_H = 1.6
export const SNEAK_EYE_H = 1.15
export const WALK_SPEED = 3.8
export const SNEAK_SPEED = 1.6
export const INTERACT_RANGE = 1.9
export const MOUSE_SENSITIVITY = 0.0024
export const KEY_TURN_SPEED = 2.4 // rad/sec for arrow-key turning

// Room layout, by index. Anything not listed here is a regular guest
// room ('normal'); some of those turn out to have the lights off.
// Floor 1 (the hotel) is doors 001–050; door 050 is an elevator down to
// Floor 2 (the basement + mines), doors 051–100, which ends at the loading dock.
export const TOTAL_ROOMS = 102
export const ELEVATOR_ROOM = 50
export const FLOOR2_START = 51
export const DOORS_PER_FLOOR = 50
// Floor 3 (the attic) is its own trip: a separate elevator ride up from
// the lobby. Those hotels are generated longer — room 100 becomes the
// attic lift, and doors 101–150 are the attic, ending on the rooftop.
export const FLOOR3_ELEVATOR = 100
export const FLOOR3_START = 101
export const TOTAL_ROOMS_F3 = 152
export const SHOP3_ROOM = 125
export const FORCE_COCO_ROOM = 104
export const FORCE_MIRROR_ROOM = 108
export const FLOOR3_PRICE = 30
// Floor 4 (the garden, outside) is another separate trip: room 150 is the
// lift down to the grounds, doors 151–199 are the garden, door 200 is the
// courtyard where the Gardener stops pretending, and 201 is the gate out.
export const FLOOR4_ELEVATOR = 150
export const FLOOR4_START = 151
export const BOSS_ROOM = 200
export const TOTAL_ROOMS_F4 = 202
export const LOCAL_START_COINS = 50 // on localhost, every run (and the lobby tip jar) starts with this many
export const HALT_ROOM = 9
export const SHOP_ROOM = 20
export const SEEK_EYES_ROOMS = [25, 26]
export const CHASE_ROOMS = [27, 28, 29, 30, 31]
export const LIBRARY_ROOM = 35
export const FORCED_DARK_ROOMS = [6, 12, 24, 38, 45]
export const FORCE_RUSH_ROOM = 4 // guarantees everyone meets Barry at least once
export const FORCE_EYES_ROOM = 11
export const FORCE_DUPE_ROOMS = [13, 40]
export const FORCE_GUS_ROOM = 15
export const FORCE_AMBUSH_ROOM = 17
export const FORCE_SPIDER_ROOM = 7
// Floor 2
export const SHOP2_ROOM = 70
export const CHASE2_ROOMS = [76, 77, 78, 79, 80]
export const BOILER_ROOM = 88
export const FORCED_DARK_ROOMS_2 = [59, 64, 83, 92]
export const FORCE_HANK_ROOM = 53
export const FORCE_DOUG_ROOM = 56
export const FORCE_BATS_ROOM = 59
export const VALVES_NEEDED = 3
export const FORCE_PUFF_ROOM = 61
export const FORCE_TWIRL_ROOM = 65
export const FORCE_BUMPUS_FROM = 66 // first mine room at or after this door gets Bumpus
// Rooms where no random event may start (scripted rooms + the shops).
export const QUIET_ROOMS = [150, 151, 0, SHOP_ROOM, ELEVATOR_ROOM, FLOOR2_START, SHOP2_ROOM, FLOOR3_ELEVATOR, FLOOR3_START, SHOP3_ROOM]

// ── Event tuning ──
export const RUSH_WARNING = 4.5 // seconds of flickering lights before Barry sprints through
export const RUSH_SPEED = 15
export const EYES_LOOK_LIMIT = 2.2 // seconds of eye contact before Drakko "gets" you
export const EYES_LOOK_ANGLE = 0.38 // radians
export const SCREECH_WINDOW = 3.2 // seconds to turn and look at Pale Steve
export const SCREECH_LOOK_ANGLE = 0.5
export const HALT_GOAL = 40 // meters of "correct-direction" walking; cues land at 9/18/27/36, so the last stretch is always toward the exit
export const HALT_CUE_EVERY = 9
export const HALT_SPEED = 2.2
export const HALT_WRAP_MARGIN = 6
export const SEEK_SPEED = 3.45 // a bit slower than WALK_SPEED, so clean running escapes
export const SEEK_CATCH = 0.9
export const FIGURE_PATROL_SPEED = 1.1
export const FIGURE_HUNT_SPEED = 2.1
export const FIGURE_HEAR_WALK = 6.5 // walking is loud…
export const FIGURE_HEAR_SNEAK = 1.4 // …sneaking mostly isn't
export const FIGURE_CATCH = 1.0
export const FIGURE_REST = 6
export const PAGES_NEEDED = 3
export const AMBUSH_WARNING = 5.5
export const AMBUSH_SPEED = 19
export const AMBUSH_PAUSE = 1.3
export const GUS_SPEED = 3.0
export const GUS_WATCH_ANGLE = 0.6
export const GUS_CATCH = 1.0
export const HIDE_LIMIT = 9 // seconds in a closet (with nothing coming) before Mildred wants it back
export const HIDE_LIMIT_OCCUPIED = 2 // some closets are already hers
export const HIDE_WARNING = 3
export const ELEVATOR_RIDE = 4.5
export const HANK_DROP_RADIUS = 1.2
export const DOUG_TRIGGER = 0.8
export const DOUG_RUMBLE = 1.3
export const DOUG_CATCH = 1.0
export const BATS_WARNING = 2.8
export const BATS_SWARM = 6
export const PUFF_WARNING = 2.8
export const PUFF_BLAST = 1.8
export const TWIRL_WIND = 2.2
export const TWIRL_DANCE = 3.5
export const BUMPUS_WARNING = 2.6
export const BUMPUS_SPEED = 13
export const RAIL_HALF = 0.95 // how close to the middle of a mine tunnel counts as "on the tracks"
export const NIBBLES_TIME = 9
export const NIBBLES_SPEED = 3.0 // slower than you — corner him!
export const NIBBLES_BONUS = 3
export const BUBBLES_TIME = 6.5
export const BUBBLES_POP_ANGLE = 0.3
export const BUBBLES_POP_RANGE = 12
export const COLD_TIME = 9
export const COLD_FREEZE = 2.2 // seconds standing still before you're an ice cube
export const SECRET_CLICKS = 3
export const SECRET_REWARD = 30
export const SHELLY_SPEED = 1.2 // m/s — she's a snail, but she never stops
export const SHELLY_NAP = 25 // meters she falls back after catching you
export const COCO_TIME = 7
export const MIRROR_GRACE = 1.2
// The Gardener
export const GARDENER_MOODS = ['prune', 'watch', 'chase', 'scarecrows', 'mower', 'whisper', 'wave']
export const GARD_HEAR_WALK = 5.5
export const GARD_HEAR_SNEAK = 1.2
export const GARD_CHASE_SPEED = 3.3
export const GARD_WATCH_SPEED = 2.6
export const GARD_HIDE_GIVEUP = 3
export const GARD_MOWER_SPEED = 9
export const GARD_WHISPER_TIME = 5
// The Harvester (boss)
export const BOSS_HEARTS = 3
export const BOSS_BRAZIERS = 4
export const BOSS_SPEED = 1.3
export const BOSS_WINDUP = 1.15
export const BOSS_COOLDOWN = 2.3
export const BOOST_TIME = 8
export const BOOST_MULT = 1.5

export const SHOP_ITEMS = [
  { id: 'flashlight', icon: '🔦', name: 'Flashlight', desc: 'A much brighter light, so dark rooms stop being dark.', price: 15, max: 1 },
  { id: 'lockpick', icon: '🗝️', name: 'Lockpick', desc: 'Unclip a velvet rope without needing a Staff Pass.', price: 8, max: 5 },
  { id: 'vitamins', icon: '💊', name: 'Vitamins', desc: 'Press Q to run 50% faster for 8 seconds.', price: 6, max: 5 },
  { id: 'sneakers', icon: '👟', name: 'Quiet Sneakers', desc: 'Your footsteps are half as loud. Sir Reginald will hate these.', price: 18, max: 1 },
  { id: 'garlic', icon: '🧄', name: 'Garlic', desc: 'Drakko leaves the moment he smells it. Used up automatically.', price: 10, max: 3 },
  // Costumes: each one fools a particular monster exactly once, then it's ruined.
  { id: 'bedsheet', icon: '🛏️', name: 'Bedsheet Costume', desc: 'Pale Steve thinks you\'re his cousin and leaves you be. (Once.)', price: 9, max: 1, costume: ['steve'] },
  { id: 'cape', icon: '🦇', name: 'Vampire Cape', desc: 'Drakko mistakes you for family. (Once.)', price: 11, max: 1, costume: ['drakko'] },
  { id: 'bellhop', icon: '🎩', name: 'Bellhop Hat', desc: 'Barry or Doris think you\'re on shift and wave hello. (Once.)', price: 12, max: 1, costume: ['barry', 'doris'] },
  { id: 'scarf', icon: '🧣', name: 'Striped Scarf', desc: 'Sir Reginald recognizes his own knitting and lets you go. (Once.)', price: 10, max: 1, costume: ['reginald'] },
  { id: 'mustache', icon: '🥸', name: 'Fake Mustache', desc: 'Gus decides you\'re "a different person" and freezes. (Once.)', price: 8, max: 1, costume: ['gus'] },
]

export const COSTUME_LINES = {
  bedsheet: 'Pale Steve squints at your bedsheet. "Cousin Phil?! Didn\'t see you there!" He waves and drifts off. (Your sheet tore.)',
  cape: 'Drakko gasps. "A family member! Why didn\'t you say?" He floats away to make tea. (Your cape fell off.)',
  bellhop: 'A furry face peers at your hat. "Oh, you\'re on shift too? Carry on!" (Your hat got knocked off.)',
  scarf: 'Sir Reginald pats your scarf. "My pattern! A fellow knitter!" He bows and wanders off. (He kept the scarf.)',
  mustache: 'Gus looks at your mustache, looks again… "Sorry. Wrong person." He freezes in embarrassment. (The mustache fell off.)',
}

// Difficulty: warn = multiplier on every warning/reaction window, speed = on
// how fast monsters move. Even "Totally Scary" is still not scary.
export const DIFFICULTIES = {
  cozy: { id: 'cozy', icon: '🧸', name: 'Cozy', desc: 'Longer warnings, slower monsters.', warn: 1.5, speed: 0.85 },
  normal: { id: 'normal', icon: '🏨', name: 'Normal', desc: 'The way the hotel was meant to be.', warn: 1, speed: 1 },
  scary: { id: 'scary', icon: '😱', name: 'Totally Scary', desc: 'Short warnings, fast monsters. Still not scary.', warn: 0.7, speed: 1.12 },
}
export const LOBBY_ALLOWANCE = 10 // tips Bea gives you at the start of every run once you've found her
export const SHOPKEEPER = {
  name: 'Gloria', icon: '🟢',
  greet: "Welcome to the gift shop, hon! I'm Gloria. I'm the only one in this whole hotel who actually likes her job.",
}

export const MONSTER_DEFS = {
  barry: {
    id: 'barry', name: 'Barry', icon: '🐺', title: 'the werewolf who sprints through the halls',
    lines: [
      '*pant pant* okay— hold on— I am supposed to sprint through EVERY room on this floor. Every. Room.',
      "HR won't approve a vacuum budget for the breakroom. I've asked three times. There is fur everywhere.",
      "Between us? I see the people hiding in the closets. I just don't want the paperwork.",
    ],
    repeatLine: "Oh — you again. Hi. I'm on lap forty. Still shedding. Still no vacuum.",
  },
  steve: {
    id: 'steve', name: 'Pale Steve', icon: '👻', title: 'the ghost who whispers "psst"',
    lines: [
      "Psst— oh. Oh, you didn't turn around. That's… honestly that's never happened.",
      "I'm just a guy under a sheet. The eye holes are cut too small, so I have to get REALLY close to see anybody.",
      'The whispering is the only part of this job I\'m good at. My doctor says to stop. I told him I have a contract.',
    ],
    repeatLine: "Psst. It's me. The sheet guy. Still can't see a thing.",
  },
  drakko: {
    id: 'drakko', name: 'Drakko', icon: '🧛', title: "the vampire you shouldn't stare at",
    lines: [
      'AH HA HA— you looked! You actually— ow. My dentures.',
      'I used to work the night shift at the blood bank, but they switched to an appointment app and let me go.',
      'The staring is supposed to be hypnotic. Mostly people just get uncomfortable. Honestly? Same.',
    ],
    repeatLine: "Oh, it's you again. Still floating here. Still unemployed, since you're asking.",
  },
  wendell: {
    id: 'wendell', name: 'Wendell', icon: '🩹', title: 'the mummy who yells "TURN AROUND"',
    lines: [
      'Mmmph— sorry. You can stop turning around now. I\'m winded.',
      'Repetitive strain from decades of wrapping and unwrapping. The bandage factory I worked at closed years ago.',
      "They make me yell \"TURN AROUND\" because I can't turn around myself. I can't bend anything. The wrap's very tight.",
    ],
    repeatLine: 'Still here. Still wrapped too tight to wave. Hi again.',
  },
  gary: {
    id: 'gary', name: 'Gary', icon: '🧟', title: 'the zombie who chases you down the hall',
    lines: [
      'Uuuughhh— okay, you got caught, or I caught you, whichever. Give me a moment to sit.',
      "Bad knee. They put the zombie with the bad knee on CHASE duty. And for the record, I'm vegetarian.",
      "I've been trying to start a union. So far it's just me. Turns out we have trouble organizing meetings.",
    ],
    repeatLine: "Oh, it's you. Still vegetarian. Still unionizing. Still just me.",
  },
  reginald: {
    id: 'reginald', name: 'Sir Reginald', icon: '🛡️', title: 'the blind knight who guards the library',
    lines: [
      'Oh! Apologies — I heard footsteps. One moment, let me set my head down properly.',
      'My visor rusted shut in 1874. I find everyone by ear. Please, never tap-dance in here.',
      'Can I just say — I knit. I made this scarf entirely by feel. Nobody ever stays long enough to tell me if the colors match.',
    ],
    repeatLine: 'Hello again! I can tell it\'s you by the footsteps. I added a second stripe to the scarf.',
  },
  doris: {
    id: 'doris', name: 'Doris', icon: '🧹', title: 'the witch who vacuums the halls (several times)',
    lines: [
      'WHEEEE— oh! Oh, you\'re out here. Hold on, let me turn this thing off. …It doesn\'t turn off.',
      'They cut the broom budget, so now I ride a vacuum. It does laps because the off switch fell off in 1987.',
      "I'm technically the night-shift housekeeper. The flying is just how I get to the fourth floor. The elevator's broken.",
    ],
    repeatLine: 'Hi again, sweetie! Still looking for that off switch.',
  },
  mildred: {
    id: 'mildred', name: 'Mildred', icon: '💀', title: 'the skeleton who lives in the closets',
    lines: [
      'Excuse me. EXCUSE me. This closet is taken.',
      "I've lived in these closets for ninety years. Rent-free. It's the only perk of being a skeleton in a hotel.",
      'My bones rattle when I\'m nervous, and I\'m always nervous. It is VERY loud in there.',
    ],
    repeatLine: 'Still my closet, dear. I\'ve added a little rug.',
  },
  tim: {
    id: 'tim', name: 'Tim', icon: '🕷️', title: 'the spider who lives in the drawers',
    lines: [
      'BOO! Ha! Got you! …Sorry. Sorry. I\'m Tim. I live in the drawers.',
      "I'm starting a podcast about drawers. Episode one is about this drawer. It's two hours long.",
    ],
    repeatLine: 'Tim again! Have you subscribed to the drawer podcast? It\'s the only one.',
  },
  frank: {
    id: 'frank', name: 'Frank', icon: '🚪', title: 'the monster who pretends to be a door',
    lines: [
      "Oh! You opened me. Hi. I'm Frank. I'm the fake door.",
      'Nobody else would hire me. But fake door? You just have to be tall and rectangular. I nailed the interview.',
      "Tip: the real door always has the NEXT number on it. Don't tell my boss I told you.",
    ],
    repeatLine: 'Still a door. Still Frank. Check the numbers, buddy.',
  },
  hank: {
    id: 'hank', name: 'Hank', icon: '🐒', title: 'the ceiling gremlin who drops on people',
    lines: [
      'HEE HEE HEE— *thump* — oof. Okay. That was a bigger drop than I thought.',
      "I'm a stand-up comedian. Well, a hang-down comedian. I practice my material on people's heads.",
      "Nobody laughs. I think it's the dropping-on-them part. My agent says the dropping is the bit, though.",
    ],
    repeatLine: 'Hee hee— oh, it\'s you again. Tough crowd. Same crowd, actually.',
  },
  bernadette: {
    id: 'bernadette', name: 'Bernadette', icon: '🦇', title: 'conductor of the Gloombat Choir',
    lines: [
      'EEK— the LIGHT! Everyone, scatter! …Not you, dear. You sit. You and I need to talk.',
      'We are the Gloombat Choir. We rehearse down here in the dark because the light makes the sopranos squint.',
      "Every time somebody comes through with a flashlight, rehearsal's ruined. We have a recital on Thursday!",
    ],
    repeatLine: 'The LIGHT, dear. We talked about the light.',
  },
  doug: {
    id: 'doug', name: 'Doug', icon: '🪱', title: 'the worm who lives under the dirt mounds',
    lines: [
      "Oh! Hello up there. Sorry — that's my roof you were standing on.",
      "I'm a worm. A big one. I used to work in the garden, but they put in fake grass. Plastic. Can you imagine?",
      "Now I tunnel down here and pop up when someone stomps on me. It's not a job, exactly. It's more of a reflex.",
    ],
    repeatLine: 'Roof. You were on my roof again.',
  },
  puff: {
    id: 'puff', name: 'Puff', icon: '🫖', title: 'the kettle ghost who lives in the pipes',
    lines: [
      "Pfffssshhh— oh dear, you didn't duck. I'm so sorry. Here, let me fog up your glasses a bit less.",
      "I used to be the hotel's tea kettle. Forty years of whistling. Then they bought a coffee machine. A COFFEE machine.",
      "Now I live in the pipes and let off steam. Literally. My therapist says it's healthy.",
    ],
    repeatLine: 'Pfssh. Sorry, sorry. Old habit. Duck next time, dear!',
  },
  twirl: {
    id: 'twirl', name: 'Madame Twirl', icon: '🩰', title: 'the music-box ballerina — freeze when she dances',
    lines: [
      'You MOVED! During my solo! …Oh, sit, sit. I am not angry. I am a professional.',
      'I danced in a music box on the hotel piano for sixty years. Same song. Same spin. Never once missed a beat.',
      "Then someone wound me up too far and I simply… kept going. Now I need an audience that holds STILL. It's all I ask.",
    ],
    repeatLine: 'Again you move during the solo! Darling. Please.',
  },
  bumpus: {
    id: 'bumpus', name: 'Bumpus', icon: '🛒', title: 'the troll who drives a runaway minecart',
    lines: [
      'HONK HONK— oops. Oops oops oops. You okay? I honked! I definitely honked.',
      "I'm a bridge troll, technically. But there aren't any bridges down here, so I drive the minecart instead.",
      "The brakes don't work, if I'm being honest. I just honk and hope. It's mostly worked out.",
    ],
    repeatLine: 'HONK— oh, it\'s you again. Same tracks, same no brakes.',
  },
  nibbles: {
    id: 'nibbles', name: 'Nibbles', icon: '🐀', title: 'the rat who steals your tips (catch him!)',
    lines: [
      "Okay, okay! You got me! Here — take 'em back. All of 'em. Plus a little extra for your trouble.",
      "I'm saving up for a cheese shop. A really nice one. With a little bell on the door.",
      "Nobody hires a rat to run a cheese shop, though. So: tips. Yours, specifically. Sorry.",
    ],
    repeatLine: "Fast as ever, huh? Fine. Here. The cheese shop can wait.",
  },
  bubbles: {
    id: 'bubbles', name: 'Bubbles', icon: '🎈', title: 'the party clown with one last balloon',
    lines: [
      '*BANG!* …Oh no. Oh, sweetie, that was my LAST balloon. Confetti everywhere. Sorry about your hair.',
      "I used to do birthday parties in the ballroom upstairs. Then the hotel stopped booking parties.",
      "So now I float around blowing up balloons for nobody. If you pop them first, it's actually kind of fun?",
    ],
    repeatLine: "BANG! Ha… sorry. Old habits. You've got confetti on you again.",
  },
  yolanda: {
    id: 'yolanda', name: 'Yolanda', icon: '🧊', title: 'the yeti who makes the basement freezing',
    lines: [
      'Brrr— oh, you stood still! Now you\'re a popsicle. Hang on, hang on, I\'ve got a blanket.',
      "I drove the ice-cream truck for twenty years. Then they discovered I WAS the freezer. Everyone got nervous.",
      'Now I work down here keeping the basement cold. Nobody asked for that, honestly. I just want to feel useful.',
    ],
    repeatLine: "Popsicle again! Keep wiggling, sweetheart. Wiggle wiggle.",
  },
  mabel: {
    id: 'mabel', name: 'Mabel', icon: '🐭', title: 'the hotel manager (a very small mouse)',
    lines: [
      "Oh! A guest! In my secret office! Nobody's EVER found the shelf. Please, sit, sit.",
      "I'm the manager. I hired everyone you've met. The werewolf, the vampire, the knight who knits — all of them.",
      "I know they're not scary. That's why I hired them. Scary is mean. I just wanted everyone to have a job.",
      'Here — a little reward for finding me. Don\'t tell the others. They\'ll all want raises.',
    ],
    repeatLine: 'Back again! You really like that shelf, huh?',
  },
  ollie: {
    id: 'ollie', name: 'Ollie', icon: '🐙', title: 'the night janitor (eight mops at once)',
    lines: [
      "Whoa — nobody comes back here! You found the break room! Want a cookie? I've got eight hands, I can hold a lot of cookies.",
      'I mop the whole basement every night. Eight mops at once. Fastest janitor in the business.',
      "Everyone thinks the basement's spooky. Nah. It's just damp. That's why they need me.",
      "Here, take these. Found 'em under the boiler. Finders keepers, mostly.",
    ],
    repeatLine: 'Hey, buddy! Mind the wet floor.',
  },
  bea: {
    id: 'bea', name: 'Grandma Bea', icon: '👵', title: "the hotel's founder (a ghost, technically)",
    lines: [
      "Boo yourself, dear! Oh, nobody's said boo to my fireplace in a hundred years. Come in, come in.",
      "I built this hotel. Then I sort of… stayed. It's a lovely hotel. I wasn't going to leave just because of a little thing like being a ghost.",
      "Mabel runs it now. She hires anyone who needs a job. The werewolf, the vampire, a worm. I'm so proud of her.",
      "Here's a little allowance for your next stay. Every time you check in, there'll be a few tips waiting for you. Don't spend it all on garlic.",
    ],
    repeatLine: "Back again, dear? Your allowance is waiting at the front desk every time.",
  },
  shelly: {
    id: 'shelly', name: 'Shelly', icon: '🐌', title: 'the snail who follows you through the whole attic',
    lines: [
      "Gotcha! …Took me a while. I'm a snail. Everything takes me a while.",
      "I'm the attic's mail carrier. I've been delivering one letter since 1962. It's almost there!",
      "People think slow means lazy. It doesn't! I never stop. Not even once. That's the trick.",
    ],
    repeatLine: 'Hi again! Still delivering that letter. Almost there.',
  },
  coco: {
    id: 'coco', name: 'Coco', icon: '🕰️', title: 'the cuckoo bird who lives in the attic clock',
    lines: [
      'CUCKOO! CUCKOO! …Oh, you weren\'t in a doorway. Now you have to hear my whole song. Ahem.',
      "I've announced the hour every hour for a hundred years. Nobody downstairs can hear me up here, though.",
      "So now I yell it at whoever wanders through. It's not personal. It's just… very, very loud.",
    ],
    repeatLine: 'CUCKOO! It\'s me again! Doorways, sweetie. Doorways.',
  },
  marvin: {
    id: 'marvin', name: 'Mirror Marvin', icon: '🪞', title: 'the ghost who lives in the attic mirror',
    lines: [
      "Hey! You walked forward, so I walked forward, and now we've bumped. Classic.",
      "I copy everything everyone does. It started as a joke. Now I can't stop. Wave at me. See? I waved.",
      "The only thing that confuses me is walking backwards. My brain gets all twisted. Please don't tell anyone.",
    ],
    repeatLine: 'Forward again, huh? Me too. Obviously.',
  },
  hoot: {
    id: 'hoot', name: 'Professor Hoot', icon: '🦉', title: 'the owl who runs the attic library (secret)',
    lines: [
      'Whooo goes there? Oh! A visitor! Nobody finds the shelf. Do sit down. Mind the dust.',
      "I'm the hotel historian. Every guest, every monster, every door number — I've written it all down.",
      "The founder, Bea, built this place so nobody would ever be stuck without a home. I think it worked rather nicely.",
      "Here — a little something for finding me. Scholarship fund. Very official.",
    ],
    repeatLine: 'Back for more history? Splendid.',
  },
  gardener: {
    id: 'gardener', name: 'The Gardener', icon: '🧑‍🌾', title: 'he keeps the grounds. he is always somewhere in them.',
    lines: ['…'],
    repeatLine: '…',
    // he doesn't tell you his story. he just says one of these, and then it goes dark.
    caughtLines: [
      'Not yet.',
      "You're stepping on my flowers.",
      "Everything in this garden grows back. Even you.",
      "I've been weeding this garden for a hundred years. You're a weed.",
      'Shh. Go back. Try again.',
      "Funny. The last guest said the same thing you're thinking.",
      "I know where you're going. I planted it.",
    ],
  },
  harvester: {
    id: 'harvester', name: 'The Harvester', icon: '🎃', title: 'what the Gardener really is',
    lines: ['BACK… TO THE ROOTS.'],
    repeatLine: 'BACK… TO THE ROOTS.',
    defeatLines: [
      "…the fire's warm. I'd forgotten.",
      "A hundred years ago the gardener here wished the garden would never die. Then it wished for a gardener that would never leave.",
      'The other monsters took jobs. I just… took root. Thank you for ringing the bell.',
      'Go on. The gate is open. Mind the roses on your way out.',
    ],
  },
  gus: {
    id: 'gus', name: 'Gus', icon: '🗿', title: "the gargoyle who only moves when you're not looking",
    lines: [
      "Ha! Gotcha. I only move when nobody's looking. It's a whole thing.",
      'I used to be a rain gutter on the roof. Forty years of water coming out of my mouth. This is a promotion.',
      "I'm very shy, honestly. If you'd just kept looking at me I'd have stayed frozen forever. Nobody knows that.",
    ],
    repeatLine: "Oh — you looked away again. Hi. It's Gus.",
  },
}

export const MONSTER_ORDER = ['barry', 'steve', 'drakko', 'wendell', 'gary', 'reginald', 'doris', 'mildred', 'tim', 'frank', 'gus', 'hank', 'bernadette', 'doug', 'puff', 'twirl', 'bumpus', 'nibbles', 'bubbles', 'yolanda', 'shelly', 'coco', 'marvin', 'mabel', 'ollie', 'hoot', 'gardener', 'harvester', 'bea']

// Journal entries: which floor each one haunts and how to get past them.
export const JOURNAL = {
  barry: { floor: 1, tip: 'Lights flicker? Hide in a closet until he runs past.' },
  steve: { floor: 1, tip: 'Hear "psst" in the dark? Turn around and look at him.' },
  drakko: { floor: 1, tip: "Don't look into his eyes. Garlic from the gift shop makes him leave." },
  wendell: { floor: 1, tip: 'In the endless hallway, when told "TURN AROUND", walk the other way.' },
  gary: { floor: 1, tip: 'Just run! He chases you through the hallways (and the mines, on Floor 2).' },
  reginald: { floor: 1, tip: 'He hunts by sound. Hold Shift to sneak, or hide in a closet.' },
  doris: { floor: 1, tip: 'Hide and STAY hidden — she vacuums back and forth several times.' },
  mildred: { floor: 1, tip: 'Rattling in your closet? Step out. Some closets are already hers.' },
  tim: { floor: 1, tip: 'Lives in random drawers. No way to avoid him — just say hi.' },
  frank: { floor: 1, tip: 'Two closed doors? Open the one with the NEXT door number.' },
  gus: { floor: 1, tip: "He only moves when you're not looking. Keep your eyes on him." },
  hank: { floor: 2, tip: "Giggling overhead? Look up and don't walk under him." },
  bernadette: { floor: 2, tip: 'Flapping in the dark? Turn your light OFF (F) until they leave.' },
  doug: { floor: 2, tip: 'Ground rumbling? Step off the dirt mound, quick!' },
  puff: { floor: 2, tip: 'Pipes hissing? Duck (hold Shift) until the steam passes.' },
  twirl: { floor: 2, tip: 'When the music box plays, FREEZE. Looking around is fine.' },
  bumpus: { floor: 2, tip: 'HONK HONK? Get off the rail tracks in the middle of the tunnel.' },
  nibbles: { floor: 1, tip: "He grabs your tips and runs — chase him down before he escapes! (Here, 😵 counts the times YOU caught HIM.)" },
  bubbles: { floor: 1, tip: 'Look at his balloon and click (or press E) to pop it before it goes BANG.' },
  yolanda: { floor: 2, tip: 'Room getting icy? KEEP MOVING. Standing still turns you into a popsicle.' },
  shelly: { floor: 3, tip: "She follows you through the whole attic, slowly but surely. Don't dawdle!" },
  coco: { floor: 3, tip: 'Tick tock? Get into a doorway before the cuckoo clock strikes.' },
  marvin: { floor: 3, tip: 'He copies you. Walk BACKWARDS (S) through his room to confuse him.' },
  gardener: { floor: 4, tip: "He's different every time. Read the warning, then: sneak, don't look, hide, avoid the scarecrow, dodge the mower, don't turn around…" },
  harvester: { floor: 4, tip: 'Light all 4 braziers while dodging the red marks on the ground, then ring the garden bell.' },
  hoot: { floor: 'secret', tip: 'Hidden behind a shelf in the attic gift shop. Very well read.', hint: 'Somewhere on Floor 3… try clicking around the gift shop.' },
  mabel: { floor: 'secret', tip: "Hidden behind a shelf in the Floor 1 gift shop. She's very nice.", hint: 'Somewhere on Floor 1… try clicking around the gift shop.' },
  bea: { floor: 'secret', tip: 'Say BOO to the fireplace in the lobby. She gives you a starting allowance for every run.', hint: 'Somewhere in the lobby… maybe say something to the fireplace?' },
  ollie: { floor: 'secret', tip: 'Hidden behind a shelf in the Floor 2 gift shop. Mind the wet floor.', hint: 'Somewhere on Floor 2… try clicking around the gift shop.' },
}

// Who lives behind each gift shop's secret shelf.
export const SECRET_NPC = { 20: 'mabel', 70: 'ollie', 125: 'hoot' }
