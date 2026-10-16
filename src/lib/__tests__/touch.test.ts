import { afterEach, describe, expect, it, vi } from 'vitest'

import { isPhone, isTouchDevice } from '@/lib/touch'

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

describe('téléphone ou tablette', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** Écran simulé (petit et grand côté) et agent utilisateur. */
  function device(agent: string, screen: { width: number; height: number }) {
    vi.stubGlobal('window', { screen })
    vi.stubGlobal('navigator', { userAgent: agent })
  }

  it('reconnaît un téléphone, qu’il suffit de tourner', () => {
    device('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148', {
      width: 390,
      height: 844,
    })
    expect(isPhone()).toBe(true)
    device('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile Safari/537.36', {
      width: 412,
      height: 915,
    })
    expect(isPhone()).toBe(true)
    // Version « ordinateur » du site demandée sur un téléphone : son petit écran le trahit.
    device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', { width: 390, height: 844 })
    expect(isPhone()).toBe(true)
  })

  it('écarte les tablettes, dont une fenêtre étroite le reste dans les deux sens', () => {
    device('Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) Mobile/15E148', {
      width: 810,
      height: 1080,
    })
    expect(isPhone()).toBe(false)
    // iPadOS se présente comme un Mac.
    device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', { width: 820, height: 1180 })
    expect(isPhone()).toBe(false)
    device('Mozilla/5.0 (Linux; Android 14; SM-X710) Chrome/126.0 Safari/537.36', {
      width: 800,
      height: 1280,
    })
    expect(isPhone()).toBe(false)
  })
})
