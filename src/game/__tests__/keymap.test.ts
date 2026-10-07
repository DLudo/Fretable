import { describe, expect, it } from 'vitest'

import { keyHint, resolveKey } from '@/game/input/keymap'

describe('clavier', () => {
  it('associe q s d j k l m à Do Ré Mi Fa Sol La Si', () => {
    expect(['q', 's', 'd', 'j', 'k', 'l', 'm'].map((k) => resolveKey(k, false))).toEqual(
      [0, 2, 4, 5, 7, 9, 11].map((pc) => ({ kind: 'note', pc, natural: pc, sharp: false })),
    )
  })

  it('active le dièse avec Maj', () => {
    expect(resolveKey('Q', true)).toEqual({ kind: 'note', pc: 1, natural: 0, sharp: true })
    expect(resolveKey('J', true)).toEqual({ kind: 'note', pc: 6, natural: 5, sharp: true })
    expect(resolveKey('L', true)).toEqual({ kind: 'note', pc: 10, natural: 9, sharp: true })
  })

  it('refuse Mi♯ et Si♯', () => {
    expect(resolveKey('D', true)).toEqual({ kind: 'no-sharp', natural: 4 })
    expect(resolveKey('M', true)).toEqual({ kind: 'no-sharp', natural: 11 })
  })

  it('ignore les autres touches et le verrouillage majuscule', () => {
    expect(resolveKey('a', false)).toBeNull()
    expect(resolveKey('f', true)).toBeNull()
    expect(resolveKey('Q', false)).toEqual({ kind: 'note', pc: 0, natural: 0, sharp: false })
  })

  it('fournit les raccourcis à afficher', () => {
    expect(keyHint(0)).toBe('Q')
    expect(keyHint(1)).toBe('⇧Q')
    expect(keyHint(11)).toBe('M')
    expect(keyHint(10)).toBe('⇧L')
  })
})
