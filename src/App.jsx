import { Routes, Route } from 'react-router-dom'
import { HorrorModeProvider } from './HorrorMode.jsx'
import Home from './pages/Home.jsx'
import UltimateTicTacToe from './games/ultimate-ttt/UltimateTicTacToe.jsx'
import DogManDash from './games/dog-man-dash/DogManDash.jsx'
import PoetryForNeanderthals from './games/poetry-for-neanderthals/PoetryForNeanderthals.jsx'
import DiceRoller from './games/dice-roller/DiceRoller.jsx'
import Hangman from './games/hangman/Hangman.jsx'
import SimpsonsTCG from './games/simpsons-tcg/SimpsonsTCG.jsx'
import TreehouseTCG from './games/treehouse-tcg/TreehouseTCG.jsx'
import FlappyGoose from './games/flappy-goose/FlappyGoose.jsx'
import SnakeClash from './games/snake-clash/SnakeClash.jsx'
import World3D from './games/world3d/World3D.jsx'
import LilMonsterBattles from './games/lil-monster-battles/LilMonsterBattles.jsx'
import KaboomCorral from './games/kaboom-corral/KaboomCorral.jsx'
import ChatLounge from './games/chat-lounge/ChatLounge.jsx'
import ObviousMarioKnockoff from './games/obvious-mario-knockoff/ObviousMarioKnockoff.jsx'

export default function App() {
  return (
    <HorrorModeProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ultimate-ttt" element={<UltimateTicTacToe />} />
        <Route path="/dog-man-dash" element={<DogManDash />} />
        <Route path="/poetry-for-neanderthals" element={<PoetryForNeanderthals />} />
        <Route path="/dice-roller" element={<DiceRoller />} />
        <Route path="/hangman" element={<Hangman />} />
        <Route path="/simpsons-tcg" element={<SimpsonsTCG />} />
        <Route path="/treehouse-tcg" element={<TreehouseTCG />} />
        <Route path="/flappy-goose" element={<FlappyGoose />} />
        <Route path="/snake-clash" element={<SnakeClash />} />
        <Route path="/world3d" element={<World3D />} />
        <Route path="/lil-monster-battles" element={<LilMonsterBattles />} />
        <Route path="/kaboom-corral" element={<KaboomCorral />} />
        <Route path="/chat-lounge" element={<ChatLounge />} />
        <Route path="/obvious-mario-knockoff" element={<ObviousMarioKnockoff />} />
      </Routes>
    </HorrorModeProvider>
  )
}
