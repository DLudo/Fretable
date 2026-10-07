import { createContext } from 'react'

/**
 * Identifiants des repères de touche recouverts par le point à deviner.
 * Transmis par contexte : quand le point bouge, seul le calque des repères se
 * redessine, pas le manche mémoïsé qui le contient.
 */
export const CoveredInlaysContext = createContext<readonly string[]>([])
