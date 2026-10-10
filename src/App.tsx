import { Suspense, lazy, useState } from 'react'

import { BossScreen } from '@/components/game/boss'
import { GameScreen } from '@/components/game/GameScreen'
import { ModeSwitch } from '@/components/game/ModeSwitch'

const EffectsLab = lazy(() => import('@/lab/EffectsLab'))

// `?lab` en développement ; `#lab` là où la chaîne de requête n'est pas transmise (page publiée).
const isLab =
  new URLSearchParams(window.location.search).has('lab') || window.location.hash === '#lab'
// `?boss` / `#boss` : ouvre directement le boss final (testeurs).
const startsInBoss =
  new URLSearchParams(window.location.search).has('boss') || window.location.hash === '#boss'

export default function App() {
  const [boss, setBoss] = useState(startsInBoss)
  if (isLab) {
    return (
      <Suspense fallback={null}>
        <EffectsLab />
      </Suspense>
    )
  }
  // Basculer de mode relance l'écran : la partie en cours est abandonnée.
  const modeSwitch = <ModeSwitch checked={boss} onCheckedChange={setBoss} />
  return boss ? <BossScreen modeSwitch={modeSwitch} /> : <GameScreen modeSwitch={modeSwitch} />
}
