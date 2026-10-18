import styles from './Guugle.module.css'

// ── Shared chrome around every doodle minigame ─────────────────────────
// Title, hint, the canvas slot itself, the game-over overlay, and the
// Exit / "play another doodle" row — identical across all four game
// types (catch/whack/runner/timing), each of which just owns its own
// engine + canvas rendering and renders this around it.

export default function DoodleGameFrame({ title, hint, canvas, canvasW, canvasH, done, finalScore, onPlayAgain, onExit, onMore }) {
  return (
    <div className={styles.doodleGameWrap}>
      <h1 className={styles.doodleGameTitle}>{title}</h1>
      <p className={styles.doodleGameHint}>{hint}</p>
      <div
        className={styles.doodleCanvasWrap}
        style={{ aspectRatio: `${canvasW} / ${canvasH}`, maxWidth: Math.min(canvasW, 480) }}
      >
        {canvas}
        {done && (
          <div className={styles.doodleOverlay}>
            <div className={styles.doodleOverlayScore}>Final Score: {finalScore}</div>
            <div className={styles.doodleOverlayRow}>
              <button className={styles.btn} onClick={onPlayAgain}>Play Again</button>
              <button className={styles.btn} onClick={() => onExit(finalScore)}>Back to Guugle</button>
            </div>
            {onMore && (
              <button className={styles.smallExitBtn} onClick={onMore}>🎮 Play another doodle</button>
            )}
          </div>
        )}
      </div>
      {!done && (
        <div className={styles.doodleExitRow}>
          <button className={styles.smallExitBtn} onClick={() => onExit(null)}>Exit</button>
          {onMore && <button className={styles.smallExitBtn} onClick={onMore}>🎮 Play another doodle</button>}
        </div>
      )}
    </div>
  )
}
