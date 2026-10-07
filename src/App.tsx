import { Suspense, lazy } from 'react'

import { GameScreen } from '@/components/game/GameScreen'

const EffectsLab = lazy(() => import('@/lab/EffectsLab'))

const isLab = new URLSearchParams(window.location.search).has('lab')

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
