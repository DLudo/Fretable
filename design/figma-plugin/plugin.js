/**
 * Fretable — plugin Figma du design system (source de `code.js`).
 *
 * Crée, ou met à jour, dans le fichier ouvert :
 * - les variables « Fretable · Couleurs » (modes Sombre et Érable, alias
 *   compris) et « Fretable · Dimensions » (rayons, espacements) ;
 * - les styles de texte et d'effet « Fretable/… » ;
 * - trois pages : Fondations (nuancier, typographie, rayons, halos),
 *   Composants (bouton, pastille, panneau, solde, bandeau, manche, repère,
 *   piano) et Trame (accueil, partie et avant-partie, sur ordinateur et
 *   téléphone en paysage), aux mesures du prototype.
 *
 * Variables et styles sont mis à jour à chaque exécution ; les pages ne sont
 * créées que si aucune n'existe encore : rien n'écrase vos maquettes.
 * `TOKENS` et `NECK` sont injectés au-dessus par `npm run tokens`.
 */

const PAGES = {
  foundations: 'Fretable · Fondations',
  components: 'Fretable · Composants',
  frames: 'Fretable · Trame',
}
const WEIGHT_STYLES = {
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
}
const CORNERS = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']

/** Remarques affichées à la fin (polices de repli, mode Érable indisponible…). */
const notes = new Set()

/* — Jetons — */

const refOf = (value) =>
  typeof value === 'string' && value.startsWith('{') ? value.slice(1, -1) : null
const tokenAt = (path) => path.split('.').reduce((node, key) => node[key], TOKENS)
const resolve = (value) => {
  const ref = refOf(value)
  return ref ? resolve(tokenAt(ref).$value) : value
}
const px = (value) => parseFloat(resolve(value))

function rgba(hex) {
  const h = hex.slice(1)
  const channel = (i) => parseInt(h.slice(i, i + 2), 16) / 255
  return { r: channel(0), g: channel(2), b: channel(4), a: h.length === 8 ? channel(6) : 1 }
}

/* — Variables — */

/** `ui/background` → variable de couleur ; `radius/lg` → variable de dimension. */
const colorVars = new Map()
const dimensionVars = new Map()

async function collection(name) {
  const all = await figma.variables.getLocalVariableCollectionsAsync()
  return all.find((c) => c.name === name) ?? figma.variables.createVariableCollection(name)
}

async function buildVariables() {
  const existing = await figma.variables.getLocalVariablesAsync()
  const variable = (owner, name, type) =>
    existing.find((v) => v.variableCollectionId === owner.id && v.name === name) ??
    figma.variables.createVariable(name, owner, type)

  const colors = await collection('Fretable · Couleurs')
  const dark = colors.modes[0].modeId
  colors.renameMode(dark, 'Sombre')
  let maple = colors.modes.find((mode) => mode.name === 'Érable')?.modeId ?? null
  if (!maple) {
    try {
      maple = colors.addMode('Érable')
    } catch {
      notes.add('mode Érable non créé (un seul mode par collection sur ce forfait)')
    }
  }

  const pathOf = new Map() // nom CSS → chemin du jeton, pour le préréglage érable
  for (const [group, tokens] of Object.entries(TOKENS.color)) {
    for (const name of Object.keys(tokens)) {
      colorVars.set(`${group}/${name}`, variable(colors, `${group}/${name}`, 'COLOR'))
      pathOf.set(name, `${group}/${name}`)
    }
  }
  const valueOf = (value) => {
    const ref = refOf(value)
    return ref ? figma.variables.createVariableAlias(colorVars.get(keyOf(ref))) : rgba(value)
  }
  const maplePreset = new Map(
    Object.entries(TOKENS.preset.maple).map(([name, token]) => [pathOf.get(name), token.$value]),
  )
  for (const [group, tokens] of Object.entries(TOKENS.color)) {
    for (const [name, token] of Object.entries(tokens)) {
      const key = `${group}/${name}`
      const v = colorVars.get(key)
      v.setValueForMode(dark, valueOf(token.$value))
      // Un alias se résout dans le mode qui le lit : en érable, il suit les couleurs érable.
      if (maple) {
        v.setValueForMode(
          maple,
          maplePreset.has(key) ? rgba(maplePreset.get(key)) : valueOf(token.$value),
        )
      }
    }
  }

  const dimensions = await collection('Fretable · Dimensions')
  const mode = dimensions.modes[0].modeId
  dimensions.renameMode(mode, 'Valeur')
  for (const [group, scopes] of [
    ['radius', ['CORNER_RADIUS']],
    ['spacing', ['GAP', 'WIDTH_HEIGHT']],
  ]) {
    for (const [name, token] of Object.entries(TOKENS[group])) {
      const v = variable(dimensions, `${group}/${name}`, 'FLOAT')
      v.setValueForMode(mode, px(token.$value))
      v.scopes = scopes
      dimensionVars.set(`${group}/${name}`, v)
    }
  }
}

/** `color.combo.combo-glow` → `combo/combo-glow`. */
const keyOf = (path) => path.replace(/^color\./, '').replace('.', '/')

/* — Styles — */

const textStyles = {}
const effectStyles = {}

async function loadFont(family, weight) {
  const style = WEIGHT_STYLES[weight] ?? 'Regular'
  const candidates = [
    { family, style },
    // Repli : Inter, livrée avec Figma, écrit « Semi Bold » en deux mots.
    { family: 'Inter', style: style.replace(/^(Semi|Extra)Bold$/, '$1 Bold') },
    { family: 'Inter', style: 'Regular' },
  ]
  for (const font of candidates) {
    try {
      await figma.loadFontAsync(font)
      if (font.family !== family) notes.add(`${family} absente : remplacée par Inter`)
      return font
    } catch {
      // Police suivante.
    }
  }
  throw new Error('aucune police disponible')
}

async function buildStyles() {
  const texts = await figma.getLocalTextStylesAsync()
  for (const [name, token] of Object.entries(TOKENS.typography)) {
    const t = token.$value
    const styleName = `Fretable/${name}`
    const style = texts.find((s) => s.name === styleName) ?? figma.createTextStyle()
    style.name = styleName
    style.fontName = await loadFont(resolve(t.fontFamily), resolve(t.fontWeight))
    style.fontSize = px(t.fontSize)
    style.lineHeight = { value: px(t.lineHeight), unit: 'PIXELS' }
    style.letterSpacing = { value: px(t.letterSpacing), unit: 'PIXELS' }
    textStyles[name] = style
  }

  const effects = await figma.getLocalEffectStylesAsync()
  for (const [name, token] of Object.entries(TOKENS.shadow)) {
    const s = token.$value
    const styleName = `Fretable/${name}`
    const style = effects.find((e) => e.name === styleName) ?? figma.createEffectStyle()
    style.name = styleName
    const shadow = {
      type: 'DROP_SHADOW',
      color: rgba(resolve(s.color)),
      offset: { x: px(s.offsetX), y: px(s.offsetY) },
      radius: px(s.blur),
      spread: px(s.spread),
      visible: true,
      blendMode: 'NORMAL',
      showShadowBehindNode: false,
    }
    const ref = refOf(s.color)
    const variable = ref && colorVars.get(keyOf(ref))
    style.effects = [
      variable ? figma.variables.setBoundVariableForEffect(shadow, 'color', variable) : shadow,
    ]
    effectStyles[name] = style
  }
}

/* — Briques de dessin, couleurs liées aux variables — */

function fill(key, opacity = 1) {
  const variable = colorVars.get(key)
  if (!variable) throw new Error(`couleur inconnue : ${key}`)
  const [group, name] = key.split('/')
  const { r, g, b } = rgba(resolve(TOKENS.color[group][name].$value))
  return figma.variables.setBoundVariableForPaint(
    { type: 'SOLID', color: { r, g, b }, opacity },
    'color',
    variable,
  )
}

function bindRadius(node, name) {
  node.cornerRadius = px(TOKENS.radius[name].$value)
  const variable = dimensionVars.get(`radius/${name}`)
  if (variable) for (const corner of CORNERS) node.setBoundVariable(corner, variable)
}

function rect(name, [x, y, w, h], color, { radius = 0, opacity = 1 } = {}) {
  const node = figma.createRectangle()
  node.name = name
  node.resize(Math.max(w, 0.01), Math.max(h, 0.01))
  node.x = x
  node.y = y
  node.fills = color ? [fill(color, opacity)] : []
  if (radius) node.cornerRadius = radius
  return node
}

async function label(content, style, color, { x = 0, y = 0, width, align, opacity = 1 } = {}) {
  const node = figma.createText()
  node.fontName = textStyles[style].fontName
  node.characters = content
  await node.setTextStyleIdAsync(textStyles[style].id)
  node.fills = [fill(color, opacity)]
  if (width) {
    node.resize(width, node.height)
    node.textAutoResize = 'HEIGHT'
  }
  if (align) node.textAlignHorizontal = align
  node.x = x
  node.y = y
  return node
}

/** Cadre en auto-layout, dimensionné par son contenu. */
function stack(name, direction, { gap = 0, padding = [0, 0], align = 'CENTER', color } = {}) {
  const node = figma.createFrame()
  node.name = name
  node.layoutMode = direction
  node.primaryAxisSizingMode = 'AUTO'
  node.counterAxisSizingMode = 'AUTO'
  node.itemSpacing = gap
  node.paddingTop = node.paddingBottom = padding[0]
  node.paddingLeft = node.paddingRight = padding[1]
  node.counterAxisAlignItems = align
  node.fills = color ? [fill(color)] : []
  node.clipsContent = false
  return node
}

function screen(name, [w, h]) {
  const node = figma.createFrame()
  node.name = name
  node.resize(w, h)
  node.fills = [fill('ui/background')]
  return node
}

const textIn = (node) => node.findOne((n) => n.type === 'TEXT')

/* — Composants — */

async function buttonComponent(variant) {
  const looks = {
    Primaire: { color: 'ui/primary', ink: 'ui/primary-foreground' },
    // Contour sombre de shadcn : fond `input` à 30 %, bordure `input`.
    Contour: { color: 'ui/input', opacity: 0.3, ink: 'ui/foreground', stroke: 'ui/input' },
    Fantôme: { ink: 'ui/foreground' },
  }
  const look = looks[variant]
  const node = figma.createComponent()
  node.name = `Variante=${variant}`
  node.layoutMode = 'HORIZONTAL'
  node.primaryAxisSizingMode = 'FIXED'
  node.counterAxisSizingMode = 'FIXED'
  node.primaryAxisAlignItems = 'CENTER'
  node.counterAxisAlignItems = 'CENTER'
  node.resize(240, 40)
  node.paddingLeft = node.paddingRight = 24
  node.fills = look.color ? [fill(look.color, look.opacity)] : []
  if (look.stroke) {
    node.strokes = [fill(look.stroke)]
    node.strokeWeight = 1
  }
  bindRadius(node, 'md')
  node.appendChild(await label('Bouton', 'label', look.ink))
  return node
}

async function chipComponent(variant, color, ink, glow) {
  const node = figma.createComponent()
  node.name = `Variante=${variant}`
  node.layoutMode = 'HORIZONTAL'
  node.primaryAxisSizingMode = 'AUTO'
  node.counterAxisSizingMode = 'AUTO'
  node.paddingTop = node.paddingBottom = 2
  node.paddingLeft = node.paddingRight = 6
  node.fills = [fill(color)]
  bindRadius(node, 'full')
  node.appendChild(await label('×2', 'chip', ink))
  if (glow) await node.setEffectStyleIdAsync(effectStyles[glow].id)
  return node
}

async function coinComponent() {
  const node = figma.createComponent()
  node.name = 'Solde de pièces'
  node.layoutMode = 'HORIZONTAL'
  node.primaryAxisSizingMode = 'AUTO'
  node.counterAxisSizingMode = 'AUTO'
  node.counterAxisAlignItems = 'CENTER'
  node.itemSpacing = 6
  node.fills = []
  const coin = figma.createEllipse()
  coin.name = 'Pièce'
  coin.resize(16, 16)
  coin.fills = [fill('coin/coin')]
  coin.strokes = [fill('coin/coin-edge')]
  coin.strokeWeight = 1.5
  coin.strokeAlign = 'INSIDE'
  node.appendChild(coin)
  node.appendChild(await label('Tes pièces :', 'body', 'ui/muted-foreground'))
  node.appendChild(await label('100 000', 'label', 'ui/foreground'))
  return node
}

async function panelComponent(primary) {
  const node = figma.createComponent()
  node.name = 'Panneau'
  node.layoutMode = 'VERTICAL'
  node.primaryAxisSizingMode = 'AUTO'
  node.counterAxisSizingMode = 'FIXED'
  node.resize(384, 200)
  node.itemSpacing = 16
  node.paddingTop = node.paddingBottom = node.paddingLeft = node.paddingRight = 24
  node.fills = [fill('ui/card')]
  node.strokes = [fill('ui/border')]
  node.strokeWeight = 1
  bindRadius(node, 'xl')
  node.appendChild(await label('Niveau 1', 'panel-title', 'ui/card-foreground', { width: 336 }))
  node.appendChild(
    await label('Trouve 24 notes en 2 minutes.', 'body', 'ui/muted-foreground', { width: 336 }),
  )
  const action = primary.createInstance()
  action.resize(336, 40)
  textIn(action).characters = 'Commencer'
  node.appendChild(action)
  return node
}

/** Bandeau du haut, aux positions mesurées sur le prototype (ordinateur, téléphone). */
const HUD = {
  Ordinateur: {
    size: [1280, 70],
    home: [24, 10],
    mode: [64, 15],
    title: [158, 17],
    score: [224, 16],
    count: [1097, 16],
    sep: [1183, 17],
    timer: [1196, 14],
    progress: [24, 46, 1232, 8],
  },
  Téléphone: {
    size: [844, 36],
    home: [24, 4],
    mode: [64, 9],
    title: [158, 11],
    score: [224, 10],
    count: [661, 10],
    sep: [747, 11],
    timer: [760, 8],
    progress: [268, 14, 380, 8],
  },
}

async function hudComponent(format) {
  const m = HUD[format]
  const node = figma.createComponent()
  node.name = `Format=${format}`
  node.resize(...m.size)
  node.fills = [fill('ui/background')]
  node.appendChild(rect('Bordure', [0, m.size[1] - 1, m.size[0], 1], 'ui/border'))

  const home = figma.createVector()
  home.name = 'Accueil'
  home.vectorPaths = [{ windingRule: 'NONE', data: 'M 8 13 L 14 8 L 20 13 L 20 20 L 8 20 Z' }]
  home.strokes = [fill('ui/muted-foreground')]
  home.strokeWeight = 1.5
  home.fills = []
  home.x = m.home[0]
  home.y = m.home[1]
  node.appendChild(home)

  node.appendChild(rect('Interrupteur', [m.mode[0], m.mode[1], 32, 18], 'ui/input', { radius: 9 }))
  const knob = figma.createEllipse()
  knob.name = 'Curseur'
  knob.resize(14, 14)
  knob.x = m.mode[0] + 2
  knob.y = m.mode[1] + 2
  knob.fills = [fill('ui/foreground')]
  node.appendChild(knob)
  node.appendChild(
    await label('Boss', 'caption', 'ui/muted-foreground', { x: m.mode[0] + 52, y: m.mode[1] + 1 }),
  )

  node.appendChild(
    await label('Niveau 1', 'hud', 'ui/foreground', { x: m.title[0], y: m.title[1] - 3 }),
  )
  node.appendChild(await label('0', 'hud', 'ui/foreground', { x: m.score[0], y: m.score[1] - 2 }))
  node.appendChild(
    await label('pts', 'caption', 'ui/muted-foreground', { x: m.score[0] + 12, y: m.score[1] }),
  )
  node.appendChild(
    await label('0 / 24 notes', 'hud', 'ui/muted-foreground', {
      x: m.count[0],
      y: m.count[1] - 2,
      width: 74,
      align: 'RIGHT',
    }),
  )
  node.appendChild(rect('Séparateur', [m.sep[0], m.sep[1], 1, 14], 'ui/border'))
  node.appendChild(
    await label('2:00', 'hud', 'ui/foreground', { x: m.timer[0] + 24, y: m.timer[1] }),
  )

  // Progression : un cran par note à trouver.
  const [px0, py0, pw, ph] = m.progress
  const steps = 24
  const gap = 2
  const step = (pw - gap * (steps - 1)) / steps
  for (let i = 0; i < steps; i++) {
    node.appendChild(
      rect(`Cran ${i + 1}`, [px0 + i * (step + gap), py0, step, ph], 'hud/hud-track', {
        radius: ph / 2,
      }),
    )
  }
  return node
}

/** Manche : géométrie du prototype (millimètres d'une Stratocaster), mise à l'échelle. */
async function neckComponent(width) {
  const [vx, vy, vw, vh] = NECK.viewBox
  const k = width / vw
  const X = (x) => (x - vx) * k
  const Y = (y) => (y - vy) * k
  const node = figma.createComponent()
  node.name = 'Manche'
  node.resize(width, vh * k)
  node.fills = []
  node.clipsContent = false

  const wood = figma.createVector()
  wood.name = 'Touche'
  wood.vectorPaths = [
    {
      windingRule: 'NONZERO',
      data: `M ${NECK.wood.map(([x, y]) => `${X(x)} ${Y(y)}`).join(' L ')} Z`,
    },
  ]
  wood.fills = [fill('fretboard/fretboard')]
  node.appendChild(wood)

  for (const [cx, cy, r] of NECK.inlays) {
    const dot = figma.createEllipse()
    dot.name = 'Repère de case'
    dot.resize(2 * r * k, 2 * r * k)
    dot.x = X(cx - r)
    dot.y = Y(cy - r)
    dot.fills = [fill('fretboard/inlay')]
    dot.strokes = [fill('fretboard/fretboard-edge')]
    dot.strokeWeight = 0.3 * k
    node.appendChild(dot)
  }

  NECK.frets.forEach(([x, y, w, h, rx], i) => {
    node.appendChild(
      rect(`Frette ${i + 1}`, [X(x), Y(y), w * k, h * k], 'fretboard/fret-wire', {
        radius: rx * k,
      }),
    )
    node.appendChild(
      rect(
        `Reflet ${i + 1}`,
        [X(x + 0.72), Y(y + 0.7), 0.48 * k, (h - 1.4) * k],
        'fretboard/fret-wire-highlight',
        { radius: 0.24 * k, opacity: 0.7 },
      ),
    )
  })
  const [nx, ny, nw, nh, nr] = NECK.nut
  node.appendChild(
    rect('Sillet', [X(nx), Y(ny), nw * k, nh * k], 'fretboard/nut', { radius: nr * k }),
  )

  NECK.strings.forEach(({ line: [x1, y1, x2, y2], width: w, wound }, i) => {
    const string = figma.createVector()
    string.name = `Corde ${6 - i}`
    string.vectorPaths = [{ windingRule: 'NONE', data: `M ${X(x1)} ${Y(y1)} L ${X(x2)} ${Y(y2)}` }]
    string.strokes = [fill(wound ? 'fretboard/string-wound' : 'fretboard/string')]
    string.strokeWeight = Math.max(1, w * k)
    string.fills = []
    node.appendChild(string)
  })

  for (const { x, y, text, marked } of NECK.numbers) {
    const number = await label(text, 'caption', 'fretboard/fret-number', {
      width: 24,
      align: 'CENTER',
      opacity: marked ? 1 : 0.75,
    })
    number.x = X(x) - 12
    number.y = Y(y) - number.height / 2
    node.appendChild(number)
  }
  return node
}

/** Position (px du manche) d'une case sur une corde : milieu de la case. */
function notePoint(width, stringIndex, fret) {
  const [vx, vy, vw] = NECK.viewBox
  const k = width / vw
  const x = NECK.numbers[fret - 1].x
  const [x1, y1, x2, y2] = NECK.strings[stringIndex].line
  const y = y1 + ((x - x1) / (x2 - x1)) * (y2 - y1)
  return [(x - vx) * k, (y - vy) * k]
}

function markerComponent() {
  const node = figma.createComponent()
  node.name = 'Repère'
  node.resize(30, 30)
  node.fills = []
  const halo = figma.createEllipse()
  halo.name = 'Halo'
  halo.resize(30, 30)
  halo.fills = [fill('marker/marker-ring')]
  const dot = figma.createEllipse()
  dot.name = 'Point'
  dot.resize(20, 20)
  dot.x = dot.y = 5
  dot.fills = [fill('marker/marker')]
  dot.strokes = [fill('marker/marker-outline')]
  dot.strokeWeight = 1
  node.appendChild(halo)
  node.appendChild(dot)
  return node
}

/** Piano : boîtier, lit de touches, sept blanches et cinq noires, aux mesures du prototype. */
const PIANO = {
  Ordinateur: { size: [496, 192], white: 171, black: 106, radius: 8 },
  Téléphone: { size: [496, 136], white: 114, black: 71, radius: 6 },
}
const WHITE_KEYS = [
  ['Do', 'Q'],
  ['Ré', 'S'],
  ['Mi', 'D'],
  ['Fa', 'J'],
  ['Sol', 'K'],
  ['La', 'L'],
  ['Si', 'M'],
]
const BLACK_KEYS = [
  ['Do♯', '⇧Q', 48],
  ['Ré♯', '⇧S', 131],
  ['Fa♯', '⇧J', 253],
  ['Sol♯', '⇧K', 332],
  ['La♯', '⇧L', 411],
]

async function keyHint(content, [x, y, w, h], color, ink, inkOpacity) {
  const chip = rect('Raccourci', [x, y, w, h], color[0], { opacity: color[1] })
  bindRadius(chip, 'sm')
  const text = await label(content, 'kbd', ink, { width: w, align: 'CENTER', opacity: inkOpacity })
  text.x = x
  text.y = y + (h - text.height) / 2
  return [chip, text]
}

async function pianoComponent(format) {
  const m = PIANO[format]
  const [w, h] = m.size
  const node = figma.createComponent()
  node.name = `Format=${format}`
  node.resize(w, h)
  node.fills = [fill('piano/piano-case')]
  node.cornerRadius = 12
  node.appendChild(
    rect('Lit des touches', [6, 13, w - 12, h - 19], 'piano/piano-keybed', { radius: m.radius }),
  )

  for (const [i, [name, key]] of WHITE_KEYS.entries()) {
    const x = 6 + i * 69
    const bottom = 16 + m.white
    const surface = rect(`Touche ${name}`, [x + 1, 16, 67, m.white], 'piano/key-white')
    surface.bottomLeftRadius = surface.bottomRightRadius = m.radius
    node.appendChild(surface)
    const hint = format === 'Ordinateur' ? 21 : 18
    const nameNode = await label(name, 'key-name', 'piano/key-white-foreground', {
      width: 67,
      align: 'CENTER',
    })
    nameNode.x = x + 1
    nameNode.y = bottom - (format === 'Ordinateur' ? 60 : 50)
    node.appendChild(nameNode)
    for (const part of await keyHint(
      key,
      [x + 1 + (67 - hint) / 2, bottom - (format === 'Ordinateur' ? 38 : 30), hint, hint],
      ['piano/key-white-foreground', 0.08],
      'piano/key-white-foreground',
      0.65,
    )) {
      node.appendChild(part)
    }
  }

  for (const [name, key, x] of BLACK_KEYS) {
    const bottom = 16 + m.black
    const surface = rect(`Touche ${name}`, [x, 16, 40, m.black], 'piano/key-black')
    surface.bottomLeftRadius = surface.bottomRightRadius = 5
    node.appendChild(surface)
    const nameNode = await label(name, 'key-name-sharp', 'piano/key-black-foreground', {
      width: 40,
      align: 'CENTER',
    })
    nameNode.x = x
    nameNode.y = bottom - (format === 'Ordinateur' ? 44 : 34)
    node.appendChild(nameNode)
    for (const part of await keyHint(
      key,
      [x + 6, bottom - (format === 'Ordinateur' ? 26 : 20), 28, 16],
      ['piano/key-black-foreground', 0.12],
      'piano/key-black-foreground',
      0.75,
    )) {
      node.appendChild(part)
    }
  }
  return node
}

/** Range des composants en jeu de variantes, au point donné. */
function variants(name, nodes, [x, y], gap = 24) {
  let offset = 0
  for (const node of nodes) {
    node.x = offset
    node.y = 0
    offset += node.width + gap
  }
  const set = figma.combineAsVariants(nodes, figma.currentPage)
  set.name = name
  set.x = x
  set.y = y
  return set
}

async function buildComponents() {
  const buttons = {}
  for (const variant of ['Primaire', 'Contour', 'Fantôme']) {
    buttons[variant] = await buttonComponent(variant)
  }
  const buttonSet = variants('Bouton', Object.values(buttons), [0, 80])

  const chips = [
    await chipComponent('Combo', 'combo/combo', 'combo/combo-foreground', 'combo-glow'),
    await chipComponent(
      'Combo enflammé',
      'combo/combo-fire',
      'combo/combo-fire-foreground',
      'combo-fire-glow',
    ),
    await chipComponent('Triade', 'triad/triad', 'triad/triad-foreground', 'triad-glow'),
    await chipComponent('Coup de pouce', 'assist/assist', 'assist/assist-foreground'),
  ]
  variants('Pastille', chips, [0, buttonSet.y + buttonSet.height + 48])

  const coin = await coinComponent()
  coin.x = 0
  coin.y = 260
  const panel = await panelComponent(buttons.Primaire)
  panel.x = 320
  panel.y = 260

  const huds = {}
  for (const format of Object.keys(HUD)) huds[format] = await hudComponent(format)
  const hudSet = variants('Bandeau', Object.values(huds), [0, 560], 48)

  const neck = await neckComponent(1152)
  neck.x = 0
  neck.y = hudSet.y + hudSet.height + 64
  const marker = markerComponent()
  marker.x = 1200
  marker.y = neck.y

  const pianos = {}
  for (const format of Object.keys(PIANO)) pianos[format] = await pianoComponent(format)
  variants('Piano', Object.values(pianos), [0, neck.y + neck.height + 64], 48)

  return { buttons, coin, panel, huds, neck, marker, pianos }
}

/* — Pages — */

async function page(name) {
  const node = figma.createPage()
  node.name = name
  await figma.setCurrentPageAsync(node)
  return node
}

async function buildFoundations() {
  const root = stack('Fondations', 'VERTICAL', {
    gap: 40,
    padding: [48, 48],
    align: 'MIN',
    color: 'ui/background',
  })
  root.appendChild(await label('Fretable — fondations', 'display', 'ui/foreground'))

  for (const [group, tokens] of Object.entries(TOKENS.color)) {
    const section = stack(`Couleurs · ${group}`, 'VERTICAL', { gap: 12, align: 'MIN' })
    section.appendChild(await label(group, 'section-title', 'ui/foreground'))
    const row = stack('Nuancier', 'HORIZONTAL', { gap: 16, align: 'MIN' })
    row.layoutWrap = 'WRAP'
    row.counterAxisSpacing = 16
    row.primaryAxisSizingMode = 'FIXED'
    row.resize(1200, 100)
    for (const [name, token] of Object.entries(tokens)) {
      const swatch = stack(name, 'VERTICAL', { gap: 6, align: 'MIN' })
      const chip = rect('Couleur', [0, 0, 136, 56], `${group}/${name}`)
      bindRadius(chip, 'md')
      chip.strokes = [fill('ui/border')]
      chip.strokeWeight = 1
      swatch.appendChild(chip)
      swatch.appendChild(await label(name, 'caption', 'ui/foreground', { width: 136 }))
      swatch.appendChild(
        await label(token.$value, 'caption', 'ui/muted-foreground', { width: 136 }),
      )
      row.appendChild(swatch)
    }
    section.appendChild(row)
    root.appendChild(section)
  }

  const type = stack('Typographie', 'VERTICAL', { gap: 16, align: 'MIN' })
  type.appendChild(await label('Typographie', 'section-title', 'ui/foreground'))
  for (const [name, style] of Object.entries(textStyles)) {
    const line = stack(name, 'HORIZONTAL', { gap: 24, align: 'CENTER' })
    line.appendChild(await label(name, 'caption', 'ui/muted-foreground', { width: 140 }))
    line.appendChild(
      await label(`Fretable ${style.fontName.family} ${style.fontSize}`, name, 'ui/foreground'),
    )
    type.appendChild(line)
  }
  root.appendChild(type)

  const shapes = stack('Rayons et halos', 'HORIZONTAL', { gap: 24, align: 'MIN' })
  for (const name of Object.keys(TOKENS.radius)) {
    const sample = stack(`Rayon ${name}`, 'VERTICAL', { gap: 8, align: 'CENTER' })
    const square = rect('Forme', [0, 0, 64, 64], 'ui/card')
    bindRadius(square, name)
    square.strokes = [fill('ui/border')]
    square.strokeWeight = 1
    sample.appendChild(square)
    sample.appendChild(await label(`radius/${name}`, 'caption', 'ui/muted-foreground'))
    shapes.appendChild(sample)
  }
  for (const [name, style] of Object.entries(effectStyles)) {
    const sample = stack(name, 'VERTICAL', { gap: 8, align: 'CENTER' })
    const dot = rect('Halo', [0, 0, 64, 64], 'ui/card')
    bindRadius(dot, 'full')
    await dot.setEffectStyleIdAsync(style.id)
    sample.appendChild(dot)
    sample.appendChild(await label(name, 'caption', 'ui/muted-foreground'))
    shapes.appendChild(sample)
  }
  root.appendChild(shapes)
}

async function homeScreen(parts, format) {
  const phone = format === 'Téléphone'
  const node = screen(`Accueil · ${format}`, phone ? [844, 390] : [1280, 800])
  node.layoutMode = 'VERTICAL'
  node.primaryAxisSizingMode = 'FIXED'
  node.counterAxisSizingMode = 'FIXED'
  node.primaryAxisAlignItems = 'CENTER'
  node.counterAxisAlignItems = 'CENTER'
  node.itemSpacing = phone ? 20 : 32

  const heading = stack('Titre', 'VERTICAL', { gap: 8 })
  heading.appendChild(await label('Fretable', 'display', 'ui/foreground'))
  heading.appendChild(
    await label(
      'Retrouve chaque note du manche, du sillet à la douzième case.',
      'body',
      'ui/muted-foreground',
      { width: 320, align: 'CENTER' },
    ),
  )
  node.appendChild(heading)

  const actions = stack('Actions', phone ? 'HORIZONTAL' : 'VERTICAL', { gap: 12 })
  for (const [variant, text] of [
    ['Primaire', 'Jouer'],
    ['Contour', 'Inventaire'],
  ]) {
    const button = parts.buttons[variant].createInstance()
    textIn(button).characters = text
    actions.appendChild(button)
  }
  node.appendChild(actions)
  node.appendChild(parts.coin.createInstance())
  return node
}

function gameScreen(parts, format) {
  const phone = format === 'Téléphone'
  const node = screen(
    `Partie · ${phone ? 'Téléphone paysage' : format}`,
    phone ? [844, 390] : [1280, 800],
  )
  // Une instance naît à la position de son composant : on la recale en haut du cadre.
  const hud = parts.huds[format].createInstance()
  hud.x = 0
  hud.y = 0
  node.appendChild(hud)

  // Manche, piano et repère aux positions mesurées sur le prototype.
  const [bx, by, bw] = phone ? [16, 56, 812] : [64, 200, 1152]
  const neck = parts.neck.createInstance()
  neck.rescale(bw / 1152)
  neck.x = bx
  neck.y = by
  node.appendChild(neck)

  const [mx, my] = notePoint(bw, 2, 5)
  const marker = parts.marker.createInstance()
  if (phone) marker.rescale(0.8)
  marker.x = bx + mx - marker.width / 2
  marker.y = by + my - marker.height / 2
  node.appendChild(marker)

  const piano = parts.pianos[format].createInstance()
  piano.x = phone ? 174 : 392
  piano.y = phone ? 230 : 462
  node.appendChild(piano)
  return node
}

async function buildFrames(parts) {
  const frames = [
    await homeScreen(parts, 'Ordinateur'),
    await homeScreen(parts, 'Téléphone'),
    gameScreen(parts, 'Ordinateur'),
    gameScreen(parts, 'Téléphone'),
  ]

  // Avant-partie : la partie voilée, et le panneau « Commencer » au centre.
  const ready = gameScreen(parts, 'Ordinateur')
  ready.name = 'Avant-partie · Ordinateur'
  const veil = rect('Voile', [0, 0, 1280, 800], 'ui/background', { opacity: 0.7 })
  veil.effects = [{ type: 'BACKGROUND_BLUR', radius: 8, visible: true }]
  ready.appendChild(veil)
  const panel = parts.panel.createInstance()
  panel.x = (1280 - panel.width) / 2
  panel.y = (800 - panel.height) / 2
  ready.appendChild(panel)
  frames.push(ready)

  let x = 0
  for (const frame of frames) {
    frame.x = x
    frame.y = 0
    x += frame.width + 160
  }
}

/* — Exécution — */

async function main() {
  await buildVariables()
  await buildStyles()

  const existing = figma.root.children.map((p) => p.name)
  if (Object.values(PAGES).some((name) => existing.includes(name))) {
    notes.add('pages déjà présentes, laissées telles quelles : supprimez-les pour les régénérer')
  } else {
    await page(PAGES.foundations)
    await buildFoundations()
    await page(PAGES.components)
    const parts = await buildComponents()
    const frames = await page(PAGES.frames)
    await buildFrames(parts)
    figma.viewport.scrollAndZoomIntoView(frames.children)
  }

  const summary = `Fretable : ${colorVars.size} couleurs, ${dimensionVars.size} dimensions, ${
    Object.keys(textStyles).length
  } styles de texte, ${Object.keys(effectStyles).length} halos.`
  figma.closePlugin([summary, ...notes].join(' · '))
}

main().catch((error) => figma.closePlugin(`Fretable : échec — ${error.message}`))
