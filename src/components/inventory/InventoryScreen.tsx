import { useEffect, useId, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { CoinBalance } from '@/components/game/coins'
import { Button } from '@/components/ui/button'
import { CONSUMABLES, UPGRADES, type ItemInfo } from '@/game/items'
import { ItemCard } from './ItemCard'

export interface InventoryScreenProps {
  /** Retour à l'accueil (bouton, ou touche Échap). */
  onBack: () => void
}

/**
 * Inventaire du joueur, qui fait aussi boutique : les consommables, à usage
 * unique, et les améliorations permanentes, payés avec les pièces gagnées en
 * jouant. Les objets n'agissent que sur les parties classiques.
 */
export function InventoryScreen({ onBack }: InventoryScreenProps): ReactNode {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div data-slot="inventory-screen" className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b px-2 py-2 sm:px-4">
        <Button variant="ghost" size="sm" onClick={onBack} autoFocus>
          <ArrowLeft aria-hidden />
          Accueil
        </Button>
        <h1 className="text-base font-semibold">Inventaire</h1>
        <CoinBalance className="ml-auto pr-2" />
      </header>
      {/* `relative` : les champs cachés des interrupteurs, positionnés en absolu,
          défilent avec la liste au lieu d'allonger la page. */}
      <main className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 short:py-4">
        {/* Les deux rayons côte à côte dès que la largeur le permet (téléphone à
            l'horizontale compris) : la hauteur, rare, reste aux cartes. */}
        <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-2 md:gap-6">
          <ItemSection
            title="Consommables"
            hint="À usage unique : active-en un avant une partie classique, il sera consommé à son départ."
            items={CONSUMABLES}
          />
          <ItemSection
            title="Améliorations permanentes"
            hint="Achetées une fois, elles agissent sur toutes tes parties classiques."
            items={UPGRADES}
          />
        </div>
      </main>
    </div>
  )
}

function ItemSection({
  title,
  hint,
  items,
}: {
  title: string
  hint: string
  items: readonly ItemInfo[]
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  )
}
