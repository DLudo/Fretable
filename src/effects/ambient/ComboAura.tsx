import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'

import type { NeckLayout, Point } from '@/game/fretboard/geometry'
import type { BoardProjection } from '@/game/fretboard/projection'
import { resolveCssColor } from '../kit'
import { COMBO_AURA, type ComboAuraConfig } from './combo-aura.config'

export interface ComboAuraProps {
  /** Combo en cours : l'aura s'allume, puis s'éteint en fondu quand il retombe. */
  active: boolean
  layout: NeckLayout
  projection: BoardProjection
  /** Réglages (par défaut `COMBO_AURA`). */
  config?: ComboAuraConfig
}

interface Segment {
  /** Extrémités en px dans le canvas (marge comprise) et en mm sur le manche. */
  a: Point
  b: Point
  aMm: Point
  bMm: Point
  length: number
  /** Normale sortante et tangente unitaires (px). */
  nx: number
  ny: number
  tx: number
  ty: number
}

interface AuraGeometry {
  width: number
  height: number
  /** Bord du manche : bout coupé, haut, sillet, bas, bout coupé. */
  path: Point[]
  /** Intérieur du manche (sillet compris), effacé du halo pour garder les cordes lisibles. */
  inside: Point[]
  segments: Segment[]
  totalLength: number
  endX: number
  fadeFrom: Point
  fadeTo: Point
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  radius: number
  spark: boolean
}

/** Contour du manche projeté à l'écran, avec normales sortantes et fondu de l'extrémité. */
function auraGeometry(
  layout: NeckLayout,
  projection: BoardProjection,
  config: ComboAuraConfig,
): AuraGeometry {
  const bleed = config.bleedPx
  const px = (p: Point): Point => {
    const q = projection.toPx(p)
    return { x: q.x + bleed, y: q.y + bleed }
  }
  const [topNut, topEnd, bottomEnd, bottomNut] = layout.outline
  const nutTop = { x: layout.nut.x0, y: -layout.nut.halfWidth }
  const nutBottom = { x: layout.nut.x0, y: layout.nut.halfWidth }
  const pathMm = [topEnd, topNut, nutTop, nutBottom, bottomNut, bottomEnd]
  const center = px({ x: layout.endX / 2, y: 0 })

  const segments: Segment[] = []
  for (let i = 0; i < pathMm.length - 1; i++) {
    const aMm = pathMm[i]
    const bMm = pathMm[i + 1]
    const a = px(aMm)
    const b = px(bMm)
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length < 0.5) continue
    const tx = (b.x - a.x) / length
    const ty = (b.y - a.y) / length
    // Normale orientée vers l'extérieur du manche.
    const mid = { x: (a.x + b.x) / 2 - center.x, y: (a.y + b.y) / 2 - center.y }
    const outward = -ty * mid.x + tx * mid.y >= 0 ? 1 : -1
    segments.push({ a, b, aMm, bMm, length, nx: -ty * outward, ny: tx * outward, tx, ty })
  }

  return {
    width: projection.width + bleed * 2,
    height: projection.height + bleed * 2,
    path: pathMm.map(px),
    inside: [nutTop, topEnd, bottomEnd, nutBottom].map(px),
    segments,
    totalLength: segments.reduce((sum, s) => sum + s.length, 0),
    endX: layout.endX,
    fadeFrom: px({ x: layout.endX - config.glow.endFadeMm, y: 0 }),
    fadeTo: px({ x: layout.endX, y: 0 }),
  }
}

const rgba = ([r, g, b, a]: [number, number, number, number], alpha = 1) =>
  `rgba(${r}, ${g}, ${b}, ${a * alpha})`

const between = (random: () => number, [min, max]: [number, number]) => min + (max - min) * random()

function polygon(ctx: CanvasRenderingContext2D, points: Point[], close: boolean) {
  ctx.beginPath()
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  if (close) ctx.closePath()
}

/** Halo pré-rendu une fois par taille : chaque frame ne fait que le recopier. */
function renderGlow(
  geometry: AuraGeometry,
  colors: { glow: string; rim: string },
  config: ComboAuraConfig,
  dpr: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(geometry.width * dpr)
  canvas.height = Math.ceil(geometry.height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(dpr, dpr)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Halo : couches floues superposées (le flou d'ombre ignore l'échelle, d'où le facteur dpr).
  ctx.strokeStyle = colors.glow
  ctx.shadowColor = colors.glow
  ctx.lineWidth = config.glow.rimWidthPx * 2
  for (let i = 0; i < config.glow.passes; i++) {
    ctx.shadowBlur = config.glow.blurPx * dpr * (0.6 + (0.8 * i) / Math.max(1, config.glow.passes))
    polygon(ctx, geometry.path, false)
    ctx.stroke()
  }

  // Le halo reste à l'extérieur : l'intérieur est effacé, les cordes restent nettes.
  ctx.shadowBlur = 0
  ctx.globalCompositeOperation = 'destination-out'
  polygon(ctx, geometry.inside, true)
  ctx.fill()

  // Liseré net sur le bord.
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = colors.rim
  ctx.shadowColor = colors.glow
  ctx.shadowBlur = config.glow.blurPx * 0.4 * dpr
  ctx.lineWidth = config.glow.rimWidthPx
  polygon(ctx, geometry.path, false)
  ctx.stroke()

  // Fondu vers le bout coupé du manche, comme la touche elle-même.
  ctx.shadowBlur = 0
  ctx.globalCompositeOperation = 'destination-out'
  const fade = ctx.createLinearGradient(
    geometry.fadeFrom.x,
    geometry.fadeFrom.y,
    geometry.fadeTo.x,
    geometry.fadeTo.y,
  )
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)')
  fade.addColorStop(1, 'rgba(0, 0, 0, 1)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, geometry.width, geometry.height)
  return canvas
}

/** Point lumineux généré (cœur plein, bord évanescent), quand aucune texture n'est fournie. */
function renderDot(color: [number, number, number, number]): HTMLCanvasElement {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, rgba(color))
  gradient.addColorStop(0.3, rgba(color, 0.85))
  gradient.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return canvas
}

/**
 * Aura de combo : halo bleu et particules qui s'échappent du pourtour du manche.
 *
 * Rendu procédural sur un canvas posé sur le calque du manche, débordant de
 * `bleedPx`. Le halo est pré-rendu à chaque changement de taille ; seules les
 * particules sont recalculées à chaque frame, et la boucle s'arrête dès que
 * l'aura est éteinte. En mouvement réduit : halo fixe, sans particules.
 */
export function ComboAura({
  active,
  layout,
  projection,
  config = COMBO_AURA,
}: ComboAuraProps): ReactNode {
  const reduceMotion = useReducedMotion() ?? false
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Reste monté le temps du fondu de sortie et des dernières particules.
  const [visible, setVisible] = useState(active)
  if (active && !visible) setVisible(true)

  const geometry = useMemo(
    () => auraGeometry(layout, projection, config),
    [layout, projection, config],
  )

  // État de l'animation, conservé d'une frame et d'un redimensionnement à l'autre.
  const engine = useRef({
    level: 0,
    introAt: Number.NEGATIVE_INFINITY,
    pendingBurst: 0,
    emitDebt: 0,
    particles: [] as Particle[],
  })
  const activeRef = useRef(false)
  useEffect(() => {
    if (active && !activeRef.current) {
      engine.current.introAt = performance.now()
      engine.current.pendingBurst = config.particles.burst
    }
    activeRef.current = active
  }, [active, config])

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !host || !ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.ceil(geometry.width * dpr)
    canvas.height = Math.ceil(geometry.height * dpr)
    const color = (css: string) => resolveCssColor(host, css).rgba
    const glow = renderGlow(
      geometry,
      { glow: rgba(color(config.colors.glow)), rim: rgba(color(config.colors.rim)) },
      config,
      dpr,
    )
    const dots = {
      particle: renderDot(color(config.colors.particle)),
      spark: renderDot(color(config.colors.spark)),
    }
    let texture: HTMLImageElement | null = null
    if (config.particles.sprite) {
      const image = new Image()
      image.onload = () => (texture = image)
      image.src = config.particles.sprite
    }

    const random = Math.random
    const state = engine.current
    const { particles } = state

    const spawn = () => {
      let along = random() * geometry.totalLength
      const segment =
        geometry.segments.find((s) => (along -= s.length) <= 0) ??
        geometry.segments[geometry.segments.length - 1]
      if (!segment) return
      const u = random()
      // Moins de particules vers le bout coupé du manche.
      const xMm = segment.aMm.x + (segment.bMm.x - segment.aMm.x) * u
      if (random() > Math.min(1, (geometry.endX - xMm) / config.glow.endFadeMm)) return
      const speed = between(random, config.particles.speedPxPerSecond)
      const slide = (random() * 2 - 1) * config.particles.drift
      particles.push({
        x: segment.a.x + (segment.b.x - segment.a.x) * u + segment.nx * random() * 2,
        y: segment.a.y + (segment.b.y - segment.a.y) * u + segment.ny * random() * 2,
        vx: (segment.nx + segment.tx * slide) * speed,
        vy: (segment.ny + segment.ty * slide) * speed,
        age: 0,
        life: between(random, config.particles.lifeMs) / 1000,
        radius: between(random, config.particles.radiusPx),
        spark: random() < config.particles.sparkRatio,
      })
    }

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const on = activeRef.current

      // Apparition et extinction.
      const step = (dt * 1000) / (on ? config.glow.fadeInMs : config.glow.fadeOutMs)
      state.level = on ? Math.min(1, state.level + step) : Math.max(0, state.level - step)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Halo : respiration et éclat de déclenchement.
      const breath = reduceMotion
        ? 1
        : 1 -
          config.glow.pulseDepth *
            (0.5 - 0.5 * Math.cos((now / 1000) * Math.PI * 2 * config.glow.pulseHz))
      const boost = reduceMotion
        ? 0
        : config.glow.introBoost * Math.exp(-(now - state.introAt) / config.glow.introDecayMs)
      ctx.globalAlpha = state.level * breath
      ctx.drawImage(glow, 0, 0)
      if (boost > 0.01) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = Math.min(1, state.level * boost)
        ctx.drawImage(glow, 0, 0)
      }

      // Particules.
      if (!reduceMotion) {
        if (on) {
          state.emitDebt += config.particles.ratePerSecond * dt * state.level
          let count = Math.floor(state.emitDebt) + state.pendingBurst
          state.emitDebt -= Math.floor(state.emitDebt)
          state.pendingBurst = 0
          while (count-- > 0 && particles.length < config.particles.max) spawn()
        }
        const drag = Math.max(0, 1 - config.particles.drag * dt)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.globalCompositeOperation = 'lighter'
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]
          p.age += dt
          if (p.age >= p.life) {
            particles.splice(i, 1)
            continue
          }
          p.vx *= drag
          p.vy *= drag
          p.x += p.vx * dt
          p.y += p.vy * dt
          const t = p.age / p.life
          ctx.globalAlpha = Math.pow(1 - t, 1.4) * Math.max(0.35, state.level)
          const size = p.radius * (1 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 2))) * 2.4
          const image = texture ?? (p.spark ? dots.spark : dots.particle)
          ctx.drawImage(image, p.x - size / 2, p.y - size / 2, size, size)
        }
      } else {
        particles.length = 0
      }

      if (!on && state.level <= 0 && particles.length === 0) {
        setVisible(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [visible, geometry, reduceMotion, config])

  if (!visible) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-slot="combo-aura"
      className="pointer-events-none absolute"
      style={{
        left: -config.bleedPx,
        top: -config.bleedPx,
        width: geometry.width,
        height: geometry.height,
      }}
    />
  )
}
