/**
 * Exporte les jetons du design system au format W3C Design Tokens (DTCG), pour
 * Figma (plugin Tokens Studio, ou tout import DTCG) : `npm run tokens`.
 *
 * Source de vérité : les feuilles du jeu (`src/index.css` en thème sombre, celui
 * du prototype, et `src/theme/tokens.css`) et `src/theme/motion.ts`. Les
 * couleurs OKLCH et les `color-mix()` sont résolus en hexadécimal sRGB (alpha
 * compris) ; un jeton qui pointe simplement vers un autre (`var(--x)`) reste
 * un alias, pour que les variables Figma se référencent comme le CSS.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const OUT = 'design/fretable.tokens.json'

/* — Lecture des feuilles — */

/** Déclarations `--nom: valeur` du bloc ouvert par `selector` (texte exact). */
function declarations(css, selector) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`Bloc introuvable : ${selector}`)
  let depth = 0
  let end = start
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}' && --depth === 0) {
      end = i
      break
    }
  }
  const body = css.slice(css.indexOf('{', start) + 1, end)
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  )
}

const ui = read('src/index.css')
const game = read('src/theme/tokens.css')
const uiTokens = declarations(ui, '.dark')
const gameTokens = declarations(game, ':root')
const aliasTokens = declarations(game, ':root,\n[data-fretboard]')
const maple = declarations(game, "[data-fretboard='maple']")
const radiusRem = parseFloat(declarations(ui, ':root').radius)

/* — Couleurs : OKLCH ⇄ OKLab ⇄ sRGB — */

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const gam = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function rgbToOklab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(lin)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, gam(v))))
}

const percent = (text) => (text.endsWith('%') ? parseFloat(text) / 100 : parseFloat(text))

/** Couleur CSS → `{ lab, alpha }`, en suivant les `var()` dans `scope`. */
function parseColor(value, scope) {
  const v = value.trim()
  if (v === 'transparent') return { lab: [0, 0, 0], alpha: 0 }
  const ref = v.match(/^var\(--([\w-]+)\)$/)
  if (ref) return parseColor(lookup(ref[1], scope), scope)
  const hex = v.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const rgb = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16) / 255)
    return { lab: rgbToOklab(rgb), alpha: 1 }
  }
  const oklch = v.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)$/)
  if (oklch) {
    const [L, C, H] = oklch.slice(1, 4).map(Number)
    const h = (H * Math.PI) / 180
    return { lab: [L, C * Math.cos(h), C * Math.sin(h)], alpha: oklch[4] ? percent(oklch[4]) : 1 }
  }
  const mix = v.match(/^color-mix\(in oklab,\s*(.+?)\s+([\d.]+%),\s*(.+?)(?:\s+([\d.]+%))?\)$/)
  if (mix) {
    const a = parseColor(mix[1], scope)
    const b = parseColor(mix[3], scope)
    const p = percent(mix[2])
    const q = mix[4] ? percent(mix[4]) : 1 - p
    // Interpolation prémultipliée, comme `color-mix()` : le transparent n'éteint que l'alpha.
    const alpha = a.alpha * p + b.alpha * q
    const lab = [0, 1, 2].map((i) =>
      alpha === 0 ? 0 : (a.lab[i] * a.alpha * p + b.lab[i] * b.alpha * q) / alpha,
    )
    return { lab, alpha }
  }
  throw new Error(`Couleur non prise en charge : ${v}`)
}

function toHex({ lab, alpha }) {
  const byte = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  const rgb = oklabToRgb(lab).map(byte).join('')
  return `#${rgb}${alpha < 1 ? byte(alpha) : ''}`
}

/* — Jetons de couleur — */

const scopeOf = (overrides = {}) => ({ ...uiTokens, ...gameTokens, ...aliasTokens, ...overrides })
function lookup(name, scope) {
  if (!(name in scope)) throw new Error(`Variable inconnue : --${name}`)
  return scope[name]
}

/** Manche, piano, retours… : le groupe Figma de chaque jeton du jeu. */
const GROUPS = [
  [/^(fretboard|fret-|nut|inlay|string)/, 'fretboard'],
  [/^marker/, 'marker'],
  [/^(key-|piano)/, 'piano'],
  [/^feedback/, 'feedback'],
  [/^hud/, 'hud'],
  [/^boss/, 'boss'],
  [/^reveal/, 'reveal'],
  [/^combo/, 'combo'],
  [/^assist/, 'assist'],
  [/^triad/, 'triad'],
  [/^rating/, 'rating'],
  [/^coin/, 'coin'],
]
const groupOf = (name) => {
  if (name in uiTokens) return 'ui'
  const match = GROUPS.find(([pattern]) => pattern.test(name))
  if (!match) throw new Error(`Aucun groupe pour --${name}`)
  return match[1]
}

function colorToken(name, value, scope, { alias = true } = {}) {
  const ref = value.match(/^var\(--([\w-]+)\)$/)
  return {
    $type: 'color',
    $value: alias && ref ? `{color.${groupOf(ref[1])}.${ref[1]}}` : toHex(parseColor(value, scope)),
  }
}

const color = {}
const scope = scopeOf()
for (const [name, value] of Object.entries({ ...uiTokens, ...gameTokens, ...aliasTokens })) {
  if (name === 'radius') continue
  ;(color[groupOf(name)] ??= {})[name] = colorToken(name, value, scope)
}

// Préréglage « touche en érable » : les jetons qu'il redéfinit, résolus avec lui.
const mapleScope = scopeOf(maple)
const preset = {
  maple: Object.fromEntries(
    Object.keys(maple).map((name) => [
      name,
      colorToken(name, maple[name], mapleScope, { alias: false }),
    ]),
  ),
}

/* — Typographie, rayons, espacements, ombres, mouvement — */

const px = (value) => ({ $type: 'dimension', $value: `${value}px` })
const rem = 16
const radius = radiusRem * rem

// Tailles réellement employées par les composants (échelle Tailwind).
const SIZES = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  '2xl': [24, 32],
  '3xl': [30, 36],
  '4xl': [36, 40],
}
const WEIGHTS = { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }
const text = (family, size, weight, extra = {}) => ({
  $type: 'typography',
  $value: {
    fontFamily: `{font.family.${family}}`,
    fontSize: `{font.size.${size}}`,
    fontWeight: `{font.weight.${weight}}`,
    lineHeight: `${SIZES[size][1]}px`,
    letterSpacing: '0px',
    ...extra,
  },
})

const glow = (blur, colorRef) => ({
  $type: 'shadow',
  $value: { color: colorRef, offsetX: '0px', offsetY: '0px', blur: `${blur}px`, spread: '0px' },
})

const motion = read('src/theme/motion.ts')
const objectOf = (name) => motion.slice(motion.indexOf(`export const ${name} = {`)).split(/\n\}/)[0]
const ease = Object.fromEntries(
  [...objectOf('ease').matchAll(/(\w+):\s*\[([^\]]+)\]/g)].map((m) => [
    m[1],
    { $type: 'cubicBezier', $value: m[2].split(',').map(Number) },
  ]),
)
const duration = Object.fromEntries(
  [...objectOf('duration').matchAll(/(\w+):\s*([\d.]+),/g)].map((m) => [
    m[1],
    { $type: 'duration', $value: `${Math.round(Number(m[2]) * 1000)}ms` },
  ]),
)

const tokens = {
  $description:
    'Fretable — jetons du prototype (thème sombre). Généré par scripts/export-design-tokens.mjs : ne pas éditer à la main.',
  color,
  preset,
  font: {
    family: {
      // Noms des familles dans Figma (Google Fonts) ; le code y ajoute ses polices de repli.
      sans: { $type: 'fontFamily', $value: 'Geist' },
      mono: { $type: 'fontFamily', $value: 'Geist Mono' },
    },
    size: Object.fromEntries(Object.entries(SIZES).map(([k, [size]]) => [k, px(size)])),
    weight: Object.fromEntries(
      Object.entries(WEIGHTS).map(([k, w]) => [k, { $type: 'fontWeight', $value: w }]),
    ),
  },
  typography: {
    display: text('sans', '4xl', 'semibold', { letterSpacing: '-0.9px' }),
    'panel-title': text('sans', 'xl', 'semibold'),
    score: text('sans', '3xl', 'semibold', { letterSpacing: '-0.75px' }),
    'section-title': text('sans', 'lg', 'semibold'),
    stat: text('sans', 'lg', 'semibold', { lineHeight: '22.5px' }),
    hud: text('sans', 'sm', 'medium'),
    body: text('sans', 'sm', 'normal'),
    label: text('sans', 'sm', 'medium'),
    caption: text('sans', 'xs', 'normal'),
    kbd: text('mono', 'xs', 'medium'),
    'score-pop': text('sans', '2xl', 'black', { lineHeight: '24px', letterSpacing: '-0.6px' }),
  },
  radius: {
    sm: px(radius - 4),
    md: px(radius - 2),
    lg: px(radius),
    xl: px(radius + 4),
    '2xl': px(16),
    full: px(9999),
  },
  spacing: Object.fromEntries(
    [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16].map((step) => [String(step), px(step * 4)]),
  ),
  shadow: {
    'combo-glow': glow(12, '{color.combo.combo-glow}'),
    'combo-fire-glow': glow(14, '{color.combo.combo-fire-glow}'),
    'triad-glow': glow(12, '{color.triad.triad-glow}'),
    'heat-glow': glow(12, '{color.combo.combo-fire-glow}'),
  },
  duration,
  easing: ease,
}

mkdirSync(resolve(root, dirname(OUT)), { recursive: true })
writeFileSync(resolve(root, OUT), `${JSON.stringify(tokens, null, 2)}\n`)
const count = Object.values(color).reduce((n, group) => n + Object.keys(group).length, 0)
console.log(`${OUT} : ${count} couleurs, ${Object.keys(tokens.typography).length} styles de texte.`)
