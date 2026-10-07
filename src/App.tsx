import { Suspense, lazy } from 'react'

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
  return null
}
