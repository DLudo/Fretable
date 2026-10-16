import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { usePortraitBlocked } from '@/components/game/orientation'
import { cn } from '@/lib/utils'
import { Panel, PresenceLayer } from './panel'
import { blurThen, ENTER, LEAVE } from './transitions'

export interface PauseOverlayProps {
  /** Partie suspendue : le panneau s'affiche. */
  open: boolean
  /** Reprend la partie là où elle s'était arrêtée. */
  onResume: () => void
  className?: string
}

/**
 * Partie suspendue (écran tourné en portrait, page quittée) : un panneau
 * attend que le joueur la reprenne. Le parent doit être `relative`.
 */
export function PauseOverlay({ open, onResume, className }: PauseOverlayProps): ReactNode {
  const reduceMotion = useReducedMotion()
  // « Reprendre » prend le focus dès que le panneau devient accessible : à son
  // ouverture, ou au retour en paysage (inerte en portrait, il n'a pu le prendre).
  const blocked = usePortraitBlocked()
  const resumeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open || blocked) return
    // Une image plus tard : le contenu, rendu inerte en portrait, doit d'abord
    // redevenir interactif.
    const frame = requestAnimationFrame(() => resumeRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open, blocked])
  return (
    <AnimatePresence>
      {open && (
        <PresenceLayer
          key="pause-overlay"
          data-slot="pause-overlay"
          className={cn(
            'absolute inset-0 z-50 flex overflow-y-auto bg-background/80 p-4 backdrop-blur-sm',
            className,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: ENTER }}
          exit={{ opacity: 0, transition: LEAVE }}
        >
          <PresenceLayer
            className="m-auto w-full max-w-sm"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: ENTER }}
            exit={{ opacity: 0, transition: LEAVE }}
          >
            <Panel
              title="Partie en pause"
              description="Le temps s’est arrêté avec toi : la partie reprend là où tu l’as laissée."
              actions={
                <>
                  <Button ref={resumeRef} size="lg" className="w-full" onClick={blurThen(onResume)}>
                    <Play />
                    Reprendre
                  </Button>
                  <p className="text-xs text-muted-foreground pointer-coarse:hidden short:hidden">
                    ou appuie sur <Kbd>Entrée</Kbd>
                  </p>
                </>
              }
            />
          </PresenceLayer>
        </PresenceLayer>
      )}
    </AnimatePresence>
  )
}
