import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import UltimateTicTacToe from './games/ultimate-ttt/UltimateTicTacToe.jsx'
import DogManDash from './games/dog-man-dash/DogManDash.jsx'
import PoetryForNeanderthals from './games/poetry-for-neanderthals/PoetryForNeanderthals.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ultimate-ttt" element={<UltimateTicTacToe />} />
      <Route path="/dog-man-dash" element={<DogManDash />} />
      <Route path="/poetry-for-neanderthals" element={<PoetryForNeanderthals />} />
    </Routes>
  )
}
