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

export default function Die({ theme, value, role, held, ghost, onClick, disabled, x, y, slot }) {
  const d = theme.die
  const face = role && d.roleIcons ? d.roleIcons[role] : null
  const rot = d.rots ? d.rots[slot] : 0
  const cls = [
    styles.die,
    held ? styles.dieHeld : '',
    role ? styles.dieLocked : '',
    ghost ? styles.dieGhost : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={cls}
      style={{ left: x, top: y, width: d.w, height: d.h, transform: `rotate(${rot}deg)` }}
      onClick={onClick}
      disabled={disabled}
      aria-label={role ? `${role} die, locked` : value ? `Die showing ${value}` : 'Die'}
    >
      <span className={styles.dieInner}>
        <img src={d.body} alt="" className={styles.dieBody} draggable="false"
             style={{ filter: `drop-shadow(${d.shadow})` }} />

        {(held || role) && (
          <span className={[styles.dieRing, role ? styles.dieRingLocked : '']
            .filter(Boolean).join(' ')} />
        )}

        {!ghost && face && (
          <img src={face} alt="" className={styles.dieRoleIcon}
               style={{ left: d.cx - d.iconSize / 2, top: d.cy - d.iconSize / 2,
                        width: d.iconSize, height: d.iconSize }} draggable="false" />
        )}

        {!ghost && !face && value && d.pip && (
          PIP_LAYOUT[value].map(([ox, oy], i) => (
            <img key={i} src={d.pip} alt="" className={styles.diePip} draggable="false"
                 style={{
                   left: d.cx + ox * d.dx - d.pipSize / 2,
                   top: d.cy + oy * d.dy - d.pipSize / 2,
                   width: d.pipSize, height: d.pipSize,
                 }} />
          ))
        )}

        {!ghost && !face && value && !d.pip && (
          <span className={styles.dieNumeral}
                style={{ color: d.numeralColor, fontSize: d.numeralSize,
                         left: 0, top: d.cy - d.numeralSize * 0.52, width: d.w }}>
            {value}
          </span>
        )}
      </span>
    </button>
  )
}
