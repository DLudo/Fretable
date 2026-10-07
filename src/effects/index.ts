import { PRESET_EFFECTS } from './presets'
import { registerEffects } from './registry'

registerEffects(PRESET_EFFECTS)

export { RevealLayer } from './RevealLayer'
export * from './registry'
export type * from './types'
