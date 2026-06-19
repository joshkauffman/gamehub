import styles from './SmallBoard.module.css'

export default function SmallBoard({ cells, boardIdx, winner, isActive, isWinBoard, onMove, currentPlayer, gameOver }) {
  if (winner) {
    return (
      <div className={`${styles.board} ${styles.won} ${isWinBoard ? styles.winBoard : ''} ${styles[winner]}`}>
        <span className={styles.winSymbol}>{winner === 'draw' ? '—' : winner}</span>
      </div>
    )
  }

  return (
    <div className={`${styles.board} ${isActive ? styles.active : styles.inactive}`}>
      {cells.map((cell, cIdx) => (
        <button
          key={cIdx}
          className={`${styles.cell} ${cell ? styles[cell] : ''} ${!cell && isActive && !gameOver ? styles.playable : ''}`}
          onClick={() => isActive && !gameOver && !cell && onMove(boardIdx, cIdx)}
          disabled={!!cell || !isActive || gameOver}
          aria-label={cell ? `${cell}` : `Board ${boardIdx + 1}, cell ${cIdx + 1}`}
        >
          {cell && <span className={styles.mark}>{cell}</span>}
        </button>
      ))}
    </div>
  )
}
