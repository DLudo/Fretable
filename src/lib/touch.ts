import { useSyncExternalStore } from 'react'

/** Au moins un pointeur tactile : écran d'un téléphone, d'une tablette, d'un portable tactile. */
const ANY_COARSE_QUERY = '(any-pointer: coarse)'
/** Agent utilisateur d'un navigateur mobile. */
const MOBILE_AGENT = /Android|iPhone|iPad|iPod|Mobile/i

/** Un toucher a déjà été observé : l'appareil se joue au doigt, quoi qu'il annonce. */
let touched = false
const listeners = new Set<() => void>()

function onPointerDown(event: PointerEvent) {
  if (event.pointerType !== 'touch' || touched) return
  touched = true
  listeners.forEach((listener) => listener())
}

/**
 * L'appareil se joue-t-il au doigt ? Aucun indice ne suffit seul, d'où leur
 * réunion : un pointeur tactile (`any-pointer: coarse`), des points de contact
 * (`maxTouchPoints`), un navigateur mobile (son agent utilisateur : les modes
 * « responsive » des outils de développement imitent celui d'un téléphone sans
 * toujours émuler son écran tactile), ou un toucher déjà observé.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (touched) return true
  if (window.matchMedia?.(ANY_COARSE_QUERY).matches) return true
  if ((navigator.maxTouchPoints ?? 0) > 0) return true
  const hints = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  return hints?.mobile === true || MOBILE_AGENT.test(navigator.userAgent ?? '')
}

function subscribe(onChange: () => void) {
  if (listeners.size === 0) {
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
  }
  listeners.add(onChange)
  const list = window.matchMedia?.(ANY_COARSE_QUERY)
  list?.addEventListener('change', onChange)
  return () => {
    listeners.delete(onChange)
    list?.removeEventListener('change', onChange)
    if (listeners.size === 0) {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  }
}

/**
 * Un téléphone, et non une tablette ou un ordinateur : le seul appareil qu'il
 * suffit de tourner pour passer d'une fenêtre étroite à une fenêtre large. Une
 * fenêtre étroite d'iPad (Slide Over, écran partagé) le reste dans les deux sens.
 * Indices : l'agent d'un téléphone (iPhone, Android « Mobile » ; un iPad
 * l'emprunte parfois, il est écarté), sinon un écran dont le petit côté
 * mesure moins de 600 px.
 */
export function isPhone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const agent = navigator.userAgent ?? ''
  if (/iPad/i.test(agent)) return false
  if (/iPhone|iPod/i.test(agent) || (/Android/i.test(agent) && /Mobile/i.test(agent))) return true
  const hints = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (hints?.mobile === true) return true
  const { width = 0, height = 0 } = window.screen ?? {}
  return width > 0 && height > 0 && Math.min(width, height) < 600
}

/** `isTouchDevice`, suivi : passe à vrai au premier toucher, ou quand un écran tactile se branche. */
export function useTouchDevice(): boolean {
  return useSyncExternalStore(subscribe, isTouchDevice, () => false)
}
