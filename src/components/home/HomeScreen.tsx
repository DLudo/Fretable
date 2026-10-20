import type { ReactNode } from 'react'
import { Backpack, Play } from 'lucide-react'

import { CoinBalance } from '@/components/game/coins'
import { ActiveItems } from '@/components/inventory'
import { Button } from '@/components/ui/button'

export interface HomeScreenProps {
  onPlay: () => void
  onInventory: () => void
}

/** Six cordes et une note : le manche du jeu, en motif d'accueil. */
function NeckMotif() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 160 44"
      className="h-11 w-40 text-muted-foreground"
      fill="none"
      stroke="currentColor"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={i}
          x1="0"
          x2="160"
          y1={4 + i * 7.2}
          y2={4 + i * 7.2}
          strokeWidth={0.6 + i * 0.25}
          opacity={0.6}
        />
      ))}
      {[40, 80, 120].map((x) => (
        <line key={x} x1={x} x2={x} y1="1" y2="43" strokeWidth="1.5" opacity={0.35} />
      ))}
      <circle
        cx="100"
        cy={4 + 3 * 7.2}
        r="5"
        fill="var(--marker)"
        stroke="var(--background)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

/**
 * Écran d'accueil : jouer, ou ouvrir l'inventaire pour acheter et activer des
 * objets avec les pièces gagnées. Le solde et les objets actifs y sont rappelés.
 */
export function HomeScreen({ onPlay, onInventory }: HomeScreenProps): ReactNode {
  return (
    <div
      data-slot="home-screen"
      className="flex h-dvh flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-8 text-center short:gap-5 short:py-4"
    >
      <header className="flex flex-col items-center gap-3 short:gap-2">
        <NeckMotif />
        <h1 className="text-4xl font-semibold tracking-tight short:text-3xl">Fretable</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Retrouve chaque note du manche, du sillet à la douzième case.
        </p>
      </header>
      <nav
        aria-label="Menu principal"
        className="flex w-full max-w-xs flex-col gap-3 short:max-w-md short:flex-row"
      >
        <Button size="lg" className="flex-1" autoFocus onClick={onPlay}>
          <Play aria-hidden />
          Jouer
        </Button>
        <Button size="lg" variant="outline" className="flex-1" onClick={onInventory}>
          <Backpack aria-hidden />
          Inventaire
        </Button>
      </nav>
      <div className="flex flex-col items-center gap-2">
        <CoinBalance />
        <ActiveItems className="justify-center" />
      </div>
    </div>
  )
}
