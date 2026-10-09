import { PRESET_EFFECTS } from './presets'
import { replaceEffects } from './registry'

// Réévalué par le HMR quand un preset change : `replaceEffects` purge les effets renommés ou supprimés.
replaceEffects(PRESET_EFFECTS)

export { RevealEffectHost, RevealLayer } from './RevealLayer'
export * from './registry'
export * from './reveal-props'
export type * from './types'
