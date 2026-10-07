# Fretable

Un *guesser* pour apprendre le manche de la guitare : un point apparaît sur le manche, il faut retrouver la note sur le petit piano placé dessous, avant la fin du temps imparti.

## Démarrer

```bash
npm install
npm run dev        # jeu : http://localhost:5173
                   # lab d'effets : http://localhost:5173/?lab
```

| Script | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` | vérification des types puis build de production |
| `npm test` | tests unitaires (Vitest) |
| `npm run lint` | lint (oxlint) |
| `npm run typecheck` | vérification des types seule |
| `npm run format` | formatage (Prettier) |

## Règles et contrôles

- **Niveau 1** : trouver **6 notes en 30 secondes**. Chaque bonne réponse remplit la barre d'un sixième ; une erreur révèle la bonne note en rouge, puis une nouvelle note apparaît.
- **Souris / tactile** : cliquer la touche du piano.
- **Clavier** : `Q` `S` `D` `J` `K` `L` `M` → Do Ré Mi Fa Sol La Si. Maintenir `Maj` (⇧) joue le dièse (`⇧Q` = Do♯). Mi et Si n'ont pas de dièse : `⇧D` et `⇧M` sont refusés.
- `Entrée` ou `Espace` : commencer, rejouer, niveau suivant.

## Architecture

```
src/
├─ game/                    Domaine pur, sans React (sauf les hooks use*)
│  ├─ music/                notes, solfège, accordage
│  ├─ fretboard/            géométrie réaliste du manche (mm) + projection mm → px
│  ├─ levels/               level design (données)
│  ├─ engine/               machine à états, tirage, minuteur, bus d'événements
│  ├─ input/                correspondance clavier et hook de contrôles
│  └─ config.ts             réglages de « game feel »
├─ components/
│  ├─ ui/                   primitives shadcn/ui
│  └─ game/                 manche, piano, HUD, overlays, écran de jeu
├─ effects/                 effets de révélation (contrat, registre, kit partagé, presets)
├─ lab/                     banc d'essai isolé des effets (/?lab)
└─ theme/                   jetons de design (CSS) et de mouvement (TS)
```

Principes :

- **Le domaine ignore l'interface.** `gameReducer` est une machine à états pure (`ready → playing → won | lost`) ; le hasard et l'horloge lui sont injectés. Tout est testé dans `src/game/__tests__`.
- **Le manche est modélisé en millimètres** d'après une Stratocaster (diapason 648 mm, 42,8 mm au sillet, 52,1 mm à la 12ᵉ frette, frettes placées par la règle des douze demi-tons égaux). Le SVG utilise directement ces unités : les proportions restent justes à toutes les tailles.
- **L'interface est structurante, pas définitive** : composants sans couleur en dur, `data-slot` sur chaque partie, `className` toujours accepté.

## Brancher votre design system

1. **Couleurs et rayons shadcn** : variables de `src/index.css` (`:root` / `.dark`).
2. **Jetons du jeu** : `src/theme/tokens.css` — manche, cordes, frettes, piano, feedback, HUD. Ils sont exposés à Tailwind (`fill-fretboard`, `bg-key-white`, `text-feedback-success`…). Un préréglage « touche en érable » est fourni : ajoutez `data-fretboard="maple"` sur un ancêtre.
3. **Mouvement** : `src/theme/motion.ts` centralise courbes, durées et ressorts.
4. **Ciblage fin** : chaque élément porte un `data-slot` (`fretboard-string`, `piano-key`, `level-progress`…) et des `data-state` utilisables en CSS.

## Brancher vos animations

Une révélation est un composant React qui respecte le contrat `RevealEffectProps` (`src/effects/types.ts`) : il reçoit la position du point en pixels, la note à révéler, l'issue (juste / faux), la couleur, l'intensité (qui croît avec la série) et une graine aléatoire, puis appelle `onComplete` une fois terminé.

```tsx
// src/effects/presets/mon-effet.tsx — déposer le fichier suffit à l'enregistrer
export const monEffet: RevealEffect = {
  id: 'mon-effet',
  name: 'Mon effet',
  outcomes: ['correct'],
  Component: MonEffet,
}
```

- **Kit partagé** : `src/effects/kit.ts` définit l'étiquette de note, la pastille de combo et leur taille ; le restyler modifie tous les effets d'un coup.
- **Auto-découverte** : tout `RevealEffect` exporté depuis `src/effects/presets/` entre dans le tirage ; deux révélations consécutives n'utilisent jamais le même effet.
- **Lab** : `/?lab` joue chaque effet isolément, avec réglage de la série et de la note. Paramètres d'URL pour l'automatisation : `effect`, `outcome`, `streak`, `label`, `autoplay=1`, `delay`.
- **Indépendant de la technique** : Motion, CSS, canvas, Rive ou Lottie conviennent, tant que le composant appelle `onComplete`.
- **Événements globaux** : `game.events.on('guess' | 'challenge' | 'phase', …)` permet de brancher sons, vibrations ou effets d'écran sans toucher au moteur (voir `useBoardImpact` dans `GameScreen`).

## Ajouter un niveau

Ajouter une entrée à `LEVELS` dans `src/game/levels/levels.ts` (nombre de notes, durée, cases et cordes jouables). Le bouton « Niveau suivant » apparaît automatiquement.
