import { BOSS_RULES } from '@/game/config'

/** Palier du combo du boss : bleu (`combo`, comme le combo classique), puis enflammé (`fire`). */
export type BossComboTier = 'combo' | 'fire'

/**
 * Palier atteint après `streak` réussites d'affilée, `null` avant le premier.
 * Il vaut pour les notes suivantes : celle qui l'atteint n'en profite pas
 * encore, comme la réponse qui déclenche le combo classique.
 */
export function bossComboTier(
  streak: number,
  rules: Pick<typeof BOSS_RULES, 'combo'> = BOSS_RULES,
): BossComboTier | null {
  if (streak >= rules.combo.fireCount) return 'fire'
  if (streak >= rules.combo.triggerCount) return 'combo'
  return null
}

/** Multiplicateur des points de la prochaine réussite, après `streak` réussites d'affilée. */
export function bossMultiplier(
  streak: number,
  rules: Pick<typeof BOSS_RULES, 'combo'> = BOSS_RULES,
): number {
  const tier = bossComboTier(streak, rules)
  if (tier === 'fire') return rules.combo.fireMultiplier
  if (tier === 'combo') return rules.combo.multiplier
  return 1
}
