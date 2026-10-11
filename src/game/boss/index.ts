export { createBossChart } from './chart'
export { ghostProgress, lerpPoint } from './lanes'
export { bossReducer, createBossState, gradeHit, nextMissAt, type BossRules } from './reducer'
export type { BossAction, BossHit, BossJudgement, BossNote, BossPhase, BossState } from './types'
export { missCheckDelay, useBossGame, type BossGameOptions } from './useBossGame'
export {
  TARGET_OPACITY_BY_RANK,
  targetOpacity,
  visibleBossNotes,
  type VisibleBossNote,
} from './view'
