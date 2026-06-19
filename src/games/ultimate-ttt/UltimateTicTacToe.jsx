import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { createInitialState, applyMove, getValidBoards, getAIMove } from './gameLogic.js'
import SmallBoard from './SmallBoard.jsx'
import styles from './UltimateTicTacToe.module.css'

const MODES = [
  { id: '2p', label: '2 Players' },
  { id: 'ai-easy', label: 'vs AI (Easy)' },
  { id: 'ai-medium', label: 'vs AI (Medium)' },
  { id: 'ai-hard', label: 'vs AI (Hard)' },
]

export default function UltimateTicTacToe() {
  const [mode, setMode] = useState(null)
  const [state, setState] = useState(createInitialState())
  const [thinking, setThinking] = useState(false)

  const isAI = mode && mode.startsWith('ai')
  const aiDifficulty = isAI ? mode.replace('ai-', '') : null
  const aiPlayer = 'O'

  const handleMove = useCallback((boardIdx, cellIdx) => {
    if (thinking) return
    if (isAI && state.currentPlayer === aiPlayer) return
    setState(prev => applyMove(prev, boardIdx, cellIdx))
  }, [state, thinking, isAI, aiPlayer])

  // AI move
  useEffect(() => {
    if (!isAI || state.currentPlayer !== aiPlayer || state.gameWinner) return
    setThinking(true)
    const timer = setTimeout(() => {
      const move = getAIMove(state, aiDifficulty)
      if (move) setState(prev => applyMove(prev, move[0], move[1]))
      setThinking(false)
    }, 350)
    return () => clearTimeout(timer)
  }, [state.currentPlayer, state.gameWinner, isAI, aiDifficulty])

  const reset = () => setState(createInitialState())

  const validBoards = state.gameWinner ? [] : getValidBoards(state)

  if (!mode) {
    return (
      <div className={styles.page}>
        <Link to="/" className={styles.backLink}>← GameHub</Link>
        <div className={styles.modeScreen}>
          <h1 className={styles.title}>Ultimate<br />Tic Tac Toe</h1>
          <p className={styles.modeHint}>Choose game mode</p>
          <div className={styles.modeButtons}>
            {MODES.map(m => (
              <button key={m.id} className={styles.modeBtn} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className={styles.rulesBox}>
            <h3>How to play</h3>
            <ul>
              <li>Win 3 small boards in a row to win the game.</li>
              <li>Where you play inside a small board sends your opponent to that board next.</li>
              <li>If that board is done, opponent can play anywhere.</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => setMode(null)}>← Menu</button>
        <h1 className={styles.titleSmall}>Ultimate TTT</h1>
        <button className={styles.resetBtn} onClick={reset}>New Game</button>
      </div>

      <div className={styles.status}>
        {state.gameWinner ? (
          state.gameWinner === 'draw'
            ? <span className={styles.drawText}>It's a draw!</span>
            : <span className={`${styles.winText} ${styles[state.gameWinner]}`}>
                {isAI && state.gameWinner === aiPlayer ? 'AI wins!' : `Player ${state.gameWinner} wins!`}
              </span>
        ) : (
          <span className={`${styles.turnText} ${styles[state.currentPlayer]}`}>
            {thinking ? 'AI thinking…' : (
              isAI && state.currentPlayer === aiPlayer
                ? 'AI thinking…'
                : `Player ${state.currentPlayer}'s turn`
            )}
          </span>
        )}
      </div>

      <div className={styles.macroBoard}>
        {state.boards.map((cells, bIdx) => (
          <SmallBoard
            key={bIdx}
            cells={cells}
            boardIdx={bIdx}
            winner={state.boardWinners[bIdx]}
            isActive={validBoards.includes(bIdx)}
            isWinBoard={state.winLine?.includes(bIdx)}
            onMove={handleMove}
            currentPlayer={state.currentPlayer}
            gameOver={!!state.gameWinner}
          />
        ))}
      </div>

      {state.gameWinner && (
        <button className={styles.playAgainBtn} onClick={reset}>Play Again</button>
      )}
    </div>
  )
}
