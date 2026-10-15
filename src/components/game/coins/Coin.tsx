import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Pièce du jeu : disque d'or à tranche sombre, frappée d'une croche et d'un
 * reflet. Purement décorative (`aria-hidden`) : le texte voisin dit le compte.
 */
export function Coin({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      data-slot="coin"
      className={cn('size-5 shrink-0', className)}
      {...props}
    >
      <circle cx="12" cy="12" r="11" fill="var(--coin-edge)" />
      <circle cx="12" cy="11.2" r="10" fill="var(--coin)" />
      <circle
        cx="12"
        cy="11.2"
        r="7.4"
        fill="none"
        stroke="var(--coin-edge)"
        strokeWidth="1"
        opacity="0.55"
      />
      {/* Croche frappée au centre. */}
      <path
        d="M13.4 6.6v6.1a2.1 2.1 0 1 1-1.2-1.9V7.4l3.4 1.1v1.4l-2.2-.7Z"
        fill="var(--coin-ink)"
      />
      {/* Reflet. */}
      <path
        d="M5.6 8.4a7.2 7.2 0 0 1 4.6-4.1"
        fill="none"
        stroke="var(--coin-shine)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  )
}
