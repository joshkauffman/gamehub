// ── Tuning ───────────────────────────────────────────────────────────
// Same kid-safe "game show dungeon" premise as Dungeon Crawler Max, now
// a sequence of floors instead of a ring of house-shaped dungeon
// buildings: each floor is one big, foggy, mostly-empty plane with
// monsters roaming it, a handful of small open-air mini dungeons (a few
// real walls and a doorway, not a maze or a scene swap), and exactly one
// staircase hidden somewhere far from spawn. Finding the staircase and
// stepping onto it descends to a fresh floor. No scene swap between
// "overworld" and "dungeon" anymore — every floor IS the whole world,
// mini dungeons included, while you're on it.

export const WORLD_HALF = 460 // half-extent of the current floor's plane

export const STAIRCASE_MIN_DIST = 150 // stairs are always at least this far from spawn
export const STAIRCASE_TRIGGER_R = 2.4
export const STAIRCASE_DISCOVERY_R = 30 // how close before the guardian boss ambushes you
export const TOTAL_FLOORS = 10 // the final floor's boss guards the way out, not a staircase
export const CLASS_RACE_FLOOR = 3 // reaching this floor unlocks the one-time class/race pick

export const CRAWLER_BASE_COUNT = 2 // rival contestants on floor 1
export const CRAWLER_MAX_COUNT = 5
export const CRAWLER_AGGRO = 18
export const CRAWLER_LEASH = 60 // rivals roam much farther from their spawn than monsters do

// Small open-air ruin structures scattered across each floor — a real
// (if simple) room with walls and a doorway, not the old full maze/house.
export const MINI_DUNGEON_COUNT_BASE = 2
export const MINI_DUNGEON_COUNT_MAX = 5
export const MINI_DUNGEON_SIZE = 15 // outer footprint, one side
export const MINI_DUNGEON_WALL_THICKNESS = 1.1
export const MINI_DUNGEON_WALL_HEIGHT = 3.4
export const MINI_DUNGEON_DOOR_WIDTH = 4.5
export const MINI_DUNGEON_MIN_SEP = 70 // minimum distance between two mini dungeons, and from spawn/the staircase
export const MINI_DUNGEON_DISCOVER_R = 11 // how close to the doorway before it counts as "found"

export const PLAYER_RADIUS = 0.9
export const EYE_HEIGHT = 1.5
export const MOVE_SPEED = 7.5
export const TURN_SPEED = 2.6
export const MOUSE_SENSITIVITY = 0.0022
export const PITCH_LIMIT = 0.9

export const ATTACK_REACH = 2.4
export const ATTACK_ARC_R = 1.8
export const ATTACK_DURATION = 0.18
export const ATTACK_COOLDOWN = 0.42
export const POTION_COOLDOWN = 0.8
export const INVULN_TIME = 1.0
export const KNOCKOUT_INVULN = 1.6

export const FLOOR_MOB_BASE = 46 // monster count on floor 1, grows a little per floor
export const FLOOR_MOB_MAX = 90
export const CAMERA_DIST = 9.5

export const MAX_MANA = 40
export const MANA_REGEN = 5 // per second
// Per-spell cost/cooldown/damage now live in gameEngine.js's SPELLS table
// (alongside WEAPONS/ARMORS/MONSTER_DEFS) — these three stay here because
// they're shared physics/rendering constants for *any* spell's projectile,
// not something that varies spell to spell.
export const SPELL_SPEED = 20
export const SPELL_RADIUS = 0.45
export const SPELL_LIFE = 1.4 // seconds before a bolt fizzles out
export const MAX_SPELL_LEVEL = 20

export const SAFE_ZONE_HOME_RADIUS = 24
export const FLOOR_FLASH_TIME = 0.5 // fade duration for the descend-the-stairs flash

export const AUTOSAVE_INTERVAL = 12 // seconds between periodic autosaves

// ── Pets ─────────────────────────────────────────────────────────────
export const PET_TAME_BASE_COUNT = 2 // untamed wild pets roaming floor 1
export const PET_TAME_MAX_COUNT = 5
export const PET_TAME_RADIUS = 2.6 // walk this close to a wild pet to tame it, no fighting required
export const PET_XP_SHARE = 0.4 // fraction of a monster's xp also given to the owner's active pet
export const PET_FOLLOW_DIST = 1.7
export const PET_ENGAGE_RADIUS = 13 // a fight pet only chases threats within this range of its owner
export const PET_ATTACK_COOLDOWN = 0.7
export const PET_MAX_LEVEL_BONUS_STEPS = 20 // effect/damage scaling caps out around this level

// ── Villages ─────────────────────────────────────────────────────────
export const VILLAGE_START_FLOOR = 5 // every floor from here on has a village
export const VILLAGE_MIN_DIST = 55 // villages are meant to be *found*, just not hidden like the staircase
export const VILLAGE_MAX_DIST = 190
export const VILLAGE_SAFE_RADIUS = 20
export const VILLAGE_MIN_SEP_FROM_OTHER = 60 // from mini dungeons, the staircase, and spawn
