import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Transition } from 'motion/react'
import { Star } from 'lucide-react'

import type { GameRating } from '@/game/engine/rating'
import { cn } from '@/lib/utils'
import { duration, spring } from '@/theme/motion'

export interface RatingStarsProps {
  rating: Pick<GameRating, 'stars' | 'index'>
  className?: string
}

/** Première étoile une fois le panneau posé, puis les suivantes une à une. */
const FIRST_DELAY = 0.3
const STAGGER = 0.22

function starTransition(i: number, earned: boolean, reduceMotion: boolean): Transition {
  const delay = FIRST_DELAY + i * STAGGER
  if (reduceMotion) return { duration: duration.fast, delay }
  return earned ? { ...spring.pop, delay } : { duration: duration.base, delay }
}

/**
 * Note de fin de niveau : trois étoiles, celle du milieu plus grande et
 * surélevée. Les étoiles gagnées surgissent l'une après l'autre ; les autres
 * restent en creux. `data-rating-index` expose l'indice pour le réglage.
 */
export function RatingStars({ rating, className }: RatingStarsProps): ReactNode {
  const reduceMotion = useReducedMotion() ?? false
  const label = `Note : ${rating.stars} étoile${rating.stars > 1 ? 's' : ''} sur 3`
  return (
    <div
      data-slot="level-rating"
      data-stars={rating.stars}
      data-rating-index={rating.index.toFixed(3)}
      role="img"
      aria-label={label}
      className={cn('flex items-end justify-center gap-2 short:gap-1.5', className)}
    >
      {[0, 1, 2].map((i) => {
        const earned = i < rating.stars
        return (
          <motion.span
            key={i}
            data-slot="level-rating-star"
            data-earned={earned || undefined}
            className={cn('inline-flex', i === 1 && '-translate-y-1.5 short:-translate-y-1')}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : earned
                  ? { opacity: 0, scale: 0.2, rotate: -35 }
                  : { opacity: 0, scale: 0.8 }
            }
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={starTransition(i, earned, reduceMotion)}
          >
            <Star
              aria-hidden
              strokeWidth={1.5}
              className={cn(
                i === 1 ? 'size-11 short:size-8' : 'size-8 short:size-6',
                earned
                  ? 'fill-rating-star text-rating-star drop-shadow-[0_0_10px_var(--rating-star)]'
                  : 'fill-rating-star-empty text-rating-star-empty',
              )}
            />
          </motion.span>
        )
      })}
    </div>
  )
}
