import { describe, expect, it } from 'vitest'

import { keyHint } from '@/game/input/keymap'
import type { PitchClass } from '@/game/music/notes'
import {
  ariaShortcut,
  BLACK_KEY_MAX_WIDTH,
  BLACK_KEY_TARGET_PX,
  BLACK_KEY_WIDTH,
  BLACK_KEY_WIDTH_CSS,
  BLACK_KEYS,
  blackKeyBox,
  PIANO_KEYS,
  spokenNoteName,
  splitHint,
  WHITE_KEY_COUNT,
} from '../layout'

describe('piano : géométrie', () => {
  it('pose 7 touches blanches et 5 noires dans l’ordre chromatique', () => {
    expect(PIANO_KEYS.map((key) => key.pc)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(PIANO_KEYS.filter((key) => key.color === 'white')).toHaveLength(WHITE_KEY_COUNT)
    expect(PIANO_KEYS.filter((key) => key.color === 'black').map((key) => key.pc)).toEqual([
      1, 3, 6, 8, 10,
    ])
  })

  it('borne la largeur des noires entre la proportion réaliste et la largeur maximale', () => {
    expect(BLACK_KEY_WIDTH_CSS).toBe(
      `var(--black-key-width, clamp(8.2857%, ${BLACK_KEY_TARGET_PX}px, 9.4286%))`,
    )
    expect(blackKeyBox(1)).toEqual({
      left: `calc(14.2857% - ${BLACK_KEY_WIDTH_CSS} / 2)`,
      width: BLACK_KEY_WIDTH_CSS,
      height: '62%',
    })
  })

  it('garde les noires dans le lit et séparées, même à leur largeur maximale', () => {
    expect(BLACK_KEY_MAX_WIDTH).toBeGreaterThan(BLACK_KEY_WIDTH)
    const half = BLACK_KEY_MAX_WIDTH / 2
    for (const { center } of BLACK_KEYS) {
      expect(center - half).toBeGreaterThan(0)
      expect(center + half).toBeLessThan(WHITE_KEY_COUNT)
    }
    for (let i = 1; i < BLACK_KEYS.length; i++) {
      // Au moins un tiers de touche blanche entre deux noires voisines.
      expect(BLACK_KEYS[i].center - BLACK_KEYS[i - 1].center - BLACK_KEY_MAX_WIDTH).toBeGreaterThan(
        1 / 3,
      )
    }
  })
})

describe('piano : libellés', () => {
  it('décompose les raccourcis de dièse', () => {
    expect(splitHint('⇧Q')).toEqual({ shift: true, key: 'Q' })
    expect(splitHint('M')).toEqual({ shift: false, key: 'M' })
  })

  it('traduit les raccourcis pour aria-keyshortcuts', () => {
    expect(ariaShortcut('⇧L')).toBe('Shift+L')
    expect(ariaShortcut('S')).toBe('S')
    expect(ariaShortcut(null)).toBeUndefined()
  })

  it('associe chaque touche noire à Maj + la lettre de sa voisine de gauche', () => {
    for (const { pc } of BLACK_KEYS) {
      const hint = keyHint(pc)
      expect(hint).not.toBeNull()
      expect(splitHint(hint ?? '')).toEqual({ shift: true, key: keyHint((pc - 1) as PitchClass) })
    }
  })

  it('énonce les dièses en toutes lettres', () => {
    expect(spokenNoteName(1, 'solfege')).toBe('Do dièse')
    expect(spokenNoteName(2, 'solfege')).toBe('Ré')
  })
})
