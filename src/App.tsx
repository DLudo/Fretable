import { Suspense, lazy } from 'react'

import { GameScreen } from '@/components/game/GameScreen'

const EffectsLab = lazy(() => import('@/lab/EffectsLab'))

// `?lab` en développement ; `#lab` là où la chaîne de requête n'est pas transmise (page publiée).
const isLab =
  new URLSearchParams(window.location.search).has('lab') || window.location.hash === '#lab'

export default function App() {
  if (isLab) {
    return (
      <Suspense fallback={null}>
        <EffectsLab />
      </Suspense>
    )
  }
  return <GameScreen />
}
