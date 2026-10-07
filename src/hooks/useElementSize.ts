import { useLayoutEffect, useRef, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/**
 * Taille de la *border box* d'un élément (padding et bordure compris, comme
 * `getBoundingClientRect`), suivie par ResizeObserver. Aucun rendu si elle ne change pas.
 */
export function useElementSize<T extends Element>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = (width: number, height: number) =>
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    const rect = element.getBoundingClientRect()
    update(rect.width, rect.height)
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        update(
          entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width,
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height,
        )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}
