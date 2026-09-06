// ── Tuning ───────────────────────────────────────────────────────────
// Same "kid-safe Dungeon Crawler Carl" premise as Dungeon Crawler Max,
// rebuilt as one continuous 3D open world: five ruin compounds (ex-floor
// themes) are physically built into the terrain and scattered around a
// shared spawn point, with weaker mobs also roaming the open field
// between them. No scene swap on entry — walking through a gap in a
// ruin's walls IS entering the dungeon.

export const WORLD_HALF = 340
export const TILE = 6
export const SITE_COLS = 20
export const SITE_ROWS = 12
export const SITE_RADIUS = 220
export const WALL_HEIGHT = 4.5

export const BUILDING_RADIUS = 9
export const BUILDING_W = 14
export const BUILDING_D = 14
export const BUILDING_H = 8
export const DOOR_TRIGGER_R = 2.6
export const EXIT_TRIGGER_R = 1.8
export const TELEPORT_FLASH_TIME = 0.4

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

export const OVERWORLD_MOB_COUNT = 22
export const CAMERA_DIST = 9.5
