import { afterEach, describe, expect, it, vi } from 'vitest'

import { isTouchDevice } from '@/lib/touch'

/** Navigateur simulé : pointeur tactile ou non, points de contact, agent utilisateur. */
function browser({
  coarse = false,
  touchPoints = 0,
  userAgent = 'Mozilla/5.0 (X11; Linux x86_64)',
}) {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: coarse }) })
  vi.stubGlobal('navigator', { maxTouchPoints: touchPoints, userAgent })
}

describe('appareil tactile', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ne voit pas d’écran tactile sur un ordinateur à la souris', () => {
    browser({})
    expect(isTouchDevice()).toBe(false)
  })

  it('reconnaît un pointeur tactile, des points de contact ou un navigateur mobile', () => {
    browser({ coarse: true })
    expect(isTouchDevice()).toBe(true)
    browser({ touchPoints: 5 })
    expect(isTouchDevice()).toBe(true)
    // Mode « responsive » d'un navigateur de bureau : l'agent d'un iPhone, sans écran tactile émulé.
    browser({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' })
    expect(isTouchDevice()).toBe(true)
  })
})
