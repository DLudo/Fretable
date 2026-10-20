import type { ReactNode } from 'react'
import { House } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Retour à l'accueil, en tête du HUD : la partie en cours est abandonnée. */
export function HomeButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <Button
      variant="ghost"
      size="icon"
      data-slot="home-button"
      aria-label="Accueil"
      title="Accueil"
      className="size-7 shrink-0 text-muted-foreground"
      onClick={onClick}
    >
      <House aria-hidden />
    </Button>
  )
}
