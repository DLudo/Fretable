import { useId, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react'
import { motion, useIsPresent } from 'motion/react'
import { ArrowBigUp } from 'lucide-react'

import { formatScore } from '@/components/game/hud'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Kbd } from '@/components/ui/kbd'
import { NOTATION } from '@/game/config'
import { keyHint } from '@/game/input/keymap'
import { NATURAL_PCS, noteName } from '@/game/music/notes'
import { cn } from '@/lib/utils'

/*
 * Briques communes aux écrans d'avant et d'après partie (niveau, boss).
 */

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

/**
 * Correspondance clavier → notes (q s d j k l m → Do … Si) et rappel de la
 * touche Maj pour les dièses. Masquée sur écran tactile, sauf `onTouch` : là
 * où le clavier est la seule façon de jouer (boss final), une tablette munie
 * d'un clavier physique doit la voir.
 */
export function KeyboardMap({ onTouch = false }: { onTouch?: boolean }) {
  const hideOnTouch = onTouch ? undefined : 'pointer-coarse:hidden'
  return (
    <>
      <dl data-slot="level-overlay-keymap" className={cn('grid grid-cols-7 gap-1', hideOnTouch)}>
        {NATURAL_PCS.map((pc) => (
          <div key={pc} className="flex flex-col items-center gap-1.5">
            <dt>
              <Kbd className="h-6 min-w-6 font-mono text-foreground">{keyHint(pc)}</Kbd>
            </dt>
            <dd className="text-xs">{noteName(pc, NOTATION)}</dd>
          </div>
        ))}
      </dl>
      <p className={hideOnTouch}>
        Maintiens{' '}
        <Kbd>
          <ArrowBigUp aria-hidden className="size-3.5" strokeWidth={2.25} />
          Maj
        </Kbd>{' '}
        pour jouer le dièse.
      </p>
    </>
  )
}
