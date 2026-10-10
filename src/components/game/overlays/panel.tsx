import {
  useId,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { motion, useIsPresent, type Transition } from 'motion/react'

import { formatScore } from '@/components/game/hud'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'

/*
 * Briques communes aux écrans d'avant et d'après partie (niveau, boss).
 */

export const ENTER: Transition = { duration: 0.25, ease: ease.outExpo }
export const LEAVE: Transition = { duration: duration.fast, ease: ease.inQuad }

/**
 * Calque animé rendu inerte dès sa sortie : plus aucun clic sur ce qui s'efface.
 * `inert` ne suffit pas au clavier : le navigateur laisse le focus au bouton
 * quelques dizaines de ms, et un second Entrée ou Espace l'activerait encore
 * (double départ). Le focus est donc retiré dès que la sortie commence.
 */
export function PresenceLayer(props: Omit<ComponentProps<typeof motion.div>, 'ref'>) {
  const isPresent = useIsPresent()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const focused = document.activeElement
    if (!isPresent && focused instanceof HTMLElement && ref.current?.contains(focused)) {
      focused.blur()
    }
  }, [isPresent])
  return <motion.div ref={ref} inert={!isPresent} {...props} />
}

/**
 * Action de bouton qui rend d'abord le focus : la touche suivante revient aux
 * contrôles clavier du jeu au lieu de réactiver ce bouton (voir `PresenceLayer`).
 */
export function blurThen(action: () => void) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur()
    action()
  }
}

/** Carte de dialogue commune : titre, description, contenu et actions. */
export function Panel({
  title,
  description,
  children,
  actions,
  describeContent = false,
}: {
  title: ReactNode
  description: ReactNode
  children?: ReactNode
  actions: ReactNode
  /** Le contenu complète la description lue à l'ouverture (texte court uniquement). */
  describeContent?: boolean
}) {
  const id = useId()
  const describedBy = `${id}-description` + (describeContent && children ? ` ${id}-content` : '')
  return (
    <Card
      role="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={describedBy}
      className="shadow-lg short:gap-4 short:py-4"
    >
      <CardHeader>
        <CardTitle id={`${id}-title`} className="text-xl">
          {title}
        </CardTitle>
        <CardDescription id={`${id}-description`}>{description}</CardDescription>
      </CardHeader>
      {children && <CardContent id={`${id}-content`}>{children}</CardContent>}
      <CardFooter data-slot="level-overlay-actions" className="flex-col gap-2">
        {actions}
      </CardFooter>
    </Card>
  )
}

/** Score de la partie, mis en avant dans les écrans de fin. */
export function ScoreLine({ score, className }: { score: number; className?: string }) {
  return (
    <p
      data-slot="level-overlay-score"
      className={cn('flex items-baseline gap-1.5 tabular-nums', className)}
    >
      <span className="text-3xl font-semibold tracking-tight">{formatScore(score)}</span>
      <span className="text-sm text-muted-foreground">points</span>
    </p>
  )
}

/** Statistique d'une grille de fin de partie (`<dl>`). */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div data-slot="level-overlay-stat" className="flex flex-col justify-between gap-1 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg leading-tight font-semibold whitespace-nowrap tabular-nums">
        {value}
      </dd>
    </div>
  )
}
