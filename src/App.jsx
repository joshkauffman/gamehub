import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import UltimateTicTacToe from './games/ultimate-ttt/UltimateTicTacToe.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ultimate-ttt" element={<UltimateTicTacToe />} />
    </Routes>
  )
}
