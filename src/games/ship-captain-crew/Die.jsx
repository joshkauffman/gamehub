import styles from './ShipCaptainCrew.module.css'

// The die body and its pip are both cropped out of the concept art. Values are
// built by relaying that one pip on the grid the painted die already used, so
// every face keeps the original spacing, colour and brush texture.
const PIP_LAYOUT = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}

const ROLE_LABEL = { ship: 'Ship', captain: 'Captain', crew: 'Crew' }

// The outline is stacked drop-shadows on the die image, not a ring around its
// box: the dice are rotated, non-square and alpha-padded, so only the image's
// own silhouette gives an edge that actually fits. Four zero-blur offsets
// accumulate into a solid border; the blurred one behind it adds the lamp.
function halo(colour, glow, px) {
  return `drop-shadow(0 0 6px ${glow})` +
         ` drop-shadow(${px}px 0 0 ${colour}) drop-shadow(-${px}px 0 0 ${colour})` +
         ` drop-shadow(0 ${px}px 0 ${colour}) drop-shadow(0 -${px}px 0 ${colour})`
}

const claimGold = px => halo('#c08d14', 'rgba(214,168,40,0.62)', px)
const holdInk = px => halo('#24507f', 'rgba(40,88,140,0.6)', px * 0.75)

export default function Die({ theme, value, role, held, ghost, rolling, claiming, fxKey,
                             onClick, disabled, x, y, slot }) {
  const d = theme.die
  const face = role && d.roleIcons ? d.roleIcons[role] : null
  const corner = face && d.iconCorner
  const rot = d.rots ? d.rots[slot] : 0
  const cls = [
    styles.die,
    held ? styles.dieHeld : '',
    role ? styles.dieClaimed : '',
    ghost ? styles.dieGhost : '',
    rolling ? styles.dieRolling : '',
    claiming ? styles.dieClaiming : '',
  ].filter(Boolean).join(' ')

  // gold means claimed and nothing else; a die the player is merely keeping
  // gets a cool outline so the two states never read as the same thing
  const px = d.outlinePx || 1.6
  const outline = role ? claimGold(px) : held ? holdInk(px) : ''
  const label = role
    ? `${ROLE_LABEL[role]} — die showing ${value}, locked`
    : value
      ? `Die showing ${value}${held ? ', kept' : ''}`
      : 'Empty die slot'

  return (
    <button
      type="button"
      className={cls}
      style={{ left: x, top: y, width: d.w, height: d.h, transform: `rotate(${rot}deg)` }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={role ? undefined : !!held}
      aria-label={label}
    >
      {/* remounting on a new roll restarts the tumble even when the same die
          is thrown twice running */}
      <span key={rolling || claiming ? fxKey : 'idle'} className={styles.dieInner}>
        <img src={d.body} alt="" className={styles.dieBody} draggable="false"
             style={{ filter: `drop-shadow(${d.shadow}) ${outline}` }} />

        {!ghost && face && !corner && (
          <img src={face} alt="" className={styles.dieRoleIcon}
               style={{ left: d.cx - d.iconSize / 2, top: d.cy - d.iconSize / 2,
                        width: d.iconSize, height: d.iconSize }} draggable="false" />
        )}

        {!ghost && value && d.pip && (
          PIP_LAYOUT[value].map(([ox, oy], i) => (
            <img key={i} src={d.pip} alt="" className={styles.diePip} draggable="false"
                 style={{
                   left: d.cx + ox * d.dx - d.pipSize / 2,
                   top: d.cy + oy * d.dy - d.pipSize / 2,
                   width: d.pipSize, height: d.pipSize,
                 }} />
          ))
        )}

        {/* a claimed die keeps showing its value — the role rides alongside it
            rather than replacing it, so 6/5/4 stays learnable */}
        {!ghost && value && !d.pip && (
          <span className={styles.dieNumeral}
                style={{ color: d.numeralColor, fontSize: d.numeralSize,
                         left: 0, top: d.cy - d.numeralSize * 0.52, width: d.w }}>
            {value}
          </span>
        )}

        {!ghost && face && corner && (
          <img src={face} alt="" className={styles.dieCornerIcon}
               style={{ width: d.iconSize, height: d.iconSize }} draggable="false" />
        )}

        {(role || held) && !ghost && (
          <span className={[styles.diePlate, role ? styles.diePlateRole : styles.diePlateHold]
                  .join(' ')}
                style={{ bottom: d.plateY, height: d.plateH }}>
            {role ? ROLE_LABEL[role] : 'Kept'}
          </span>
        )}
      </span>
    </button>
  )
}
