# Fretable

Un *guesser* pour apprendre le manche de la guitare : un point apparaît sur le manche, il faut retrouver la note sur le petit piano placé dessous avant la fin du temps imparti.

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
| `npm run format` / `format:check` | formatage (Prettier) |
| `npm run check` | lint, types, tests et formatage d'une traite |

## Règles et contrôles

- **Niveau 1** : trouver **6 notes en 30 secondes**. Chaque bonne réponse remplit la barre d'un sixième. Une erreur révèle la bonne note en rouge, puis une nouvelle note apparaît.
- **Temps écoulé** : la note en attente est révélée en rouge (sans compter comme une erreur), puis l'écran de fin la rappelle.
- **Points** : chaque bonne réponse rapporte selon le temps de réaction, mesuré depuis l'apparition du point. 0,5 s ou moins vaut 1 000 points (coup critique), moins de 1 s 600, moins de 2 s 400, moins de 3 s 300, moins de 5 s 200, moins de 10 s 100, au-delà 50.
- **Combo** : trois bonnes réponses d'affilée en moins de 3 s allument le pourtour du manche (halo et particules bleues) et doublent les points des notes suivantes. Une jauge bleue apparaît sous la barre de progression et se vide en 6 s, quelles que soient les réponses. Chaque bonne réponse en moins de 3 s la recharge de 2 s, sans jamais dépasser 6 s. Une fois la jauge vide, il faut à nouveau trois réponses rapides.
- **Souris / tactile** : toucher la touche du piano.
- **Clavier** : `Q` `S` `D` `J` `K` `L` `M` → Do Ré Mi Fa Sol La Si. Maintenir `Maj` (⇧) joue le dièse (`⇧Q` = Do♯). Mi et Si n'ayant pas de dièse, `⇧D` et `⇧M` sont refusés d'un léger tremblement.
- `Entrée` ou `Espace` : commencer, rejouer, niveau suivant.
- **Téléphone** : en portrait, le manche s'affiche verticalement (sillet en haut), comme un diagramme d'accords ; en paysage, le HUD se compacte.

## Architecture

```
src/
├─ game/                    Domaine pur, sans React (sauf les hooks use*)
│  ├─ music/                notes, solfège, accordage
│  ├─ fretboard/            géométrie réaliste du manche (mm) + projection orientable mm → px
│  ├─ levels/               level design (données)
│  ├─ engine/               machine à états, tirage, minuteur, sélecteurs, bus d'événements
│  ├─ input/                correspondance clavier et hook de contrôles
│  └─ config.ts             réglages de « game feel », barème des points, règles du combo
├─ components/
│  ├─ ui/                   primitives shadcn/ui
│  └─ game/                 manche, piano, HUD, overlays, écran de jeu
├─ effects/                 révélations (contrat, registre, calque, kit, presets) et aura du combo
├─ lab/                     banc d'essai isolé des effets (/?lab)
├─ hooks/                   hooks génériques (taille d'élément, media queries)
├─ lib/                     utilitaires (cn, PRNG déterministe)
└─ theme/                   jetons de design (CSS) et de mouvement (TS)
```

Trois principes guident l'ensemble :

- **Le domaine ignore l'interface.** `gameReducer` est une machine à états pure (`ready → playing → won | lost`) à laquelle le hasard et l'horloge sont injectés. Les tests unitaires sont rangés à côté de chaque module (`__tests__`).
- **Le manche est modélisé en millimètres** d'après une Stratocaster : diapason de 648 mm, 42,8 mm au sillet, 52,1 mm à la 12ᵉ frette, frettes placées selon la règle des douze demi-tons égaux. Le SVG travaille directement dans ces unités, si bien que les proportions restent justes à toutes les tailles et dans les deux orientations.
- **L'interface est structurante, non définitive.** Aucune couleur n'est codée en dur, chaque partie significative porte un `data-slot` et les composants acceptent un `className`.

## Brancher votre design system

1. **Couleurs et rayons shadcn** : variables de `src/index.css` (`:root` / `.dark`).
2. **Jetons du jeu** : `src/theme/tokens.css` couvre le manche, les cordes, les frettes, le piano, le feedback, le HUD et les révélations. Ils sont exposés à Tailwind (`fill-fretboard`, `bg-key-white`, `text-feedback-success`…). Des alias sémantiques (`--fretboard-shadow`, `--key-black-sharp`, `--reveal-highlight`…) se redéfinissent un à un. Le HUD dérive de `--foreground` et suit donc un thème clair. Pour une touche en érable, posez `data-fretboard="maple"` sur un ancêtre.
3. **Mouvement** : `src/theme/motion.ts` centralise courbes, durées et ressorts ; les transitions propres à un composant sont des constantes nommées en tête de fichier.
4. **Ciblage fin** : les `data-slot` (`fretboard-string`, `piano-key`, `level-progress`…) et les attributs d'état (`data-state`, `data-color`, `data-orientation`, `data-sharp-mode`) se ciblent en CSS. Comme Tailwind range ses utilitaires dans `@layer utilities`, une feuille non « layerisée » l'emporte sans surenchère de spécificité. Le piano expose aussi `--keybed-h` et `--black-key-width`.
5. **Écrans bas** : le variant `short:` (hauteur ≤ 420 px) est défini dans `index.css`.

## Brancher vos animations

Une révélation est un composant React qui respecte `RevealEffectProps` (`src/effects/types.ts`). Il reçoit notamment :
- la position du point en pixels, la note à révéler, la note jouée (`null` si le temps s'est écoulé), la corde et la case ;
- le délai avant la note suivante (`budgetMs`), l'intensité, qui croît avec la série, et une graine aléatoire ;
- les couleurs et la géométrie le long de la corde (`stringAngle`, `fretOffsets`).

Il appelle ensuite `onComplete` une fois terminé.

```tsx
// src/effects/presets/mon-effet.tsx — déposer le fichier suffit à l'enregistrer
export const monEffet: RevealEffect = {
  id: 'mon-effet',
  name: 'Mon effet',
  outcomes: ['correct'],
  Component: MonEffet,
}
```

- **Kit** : `src/effects/kit.tsx` fournit la racine (`RevealRoot`), l'étiquette (`REVEAL_PILL`, `revealPillStyle`, `labelFontSize`), la pastille de combo (`RevealCombo`), le calendrier de sortie (`revealExit`) et la conversion des couleurs pour canvas, Rive ou Lottie (`resolveCssColor`). Le restyler restyle tous les effets ; son en-tête détaille la marche à suivre.
- **Auto-découverte** : tout `RevealEffect` exporté depuis `src/effects/presets/*.tsx` ou `src/effects/presets/<dossier>/index.tsx` entre dans le tirage. Deux révélations consécutives n'utilisent jamais le même effet, et l'ordre change à chaque session.
- **Robustesse** : un effet qui plante est remplacé par une étiquette statique, puis écarté pour la session. Une durée de vie maximale (`maxDurationMs`, 3 s par défaut) démonte un effet qui oublierait `onComplete`. Quand l'utilisateur préfère réduire les animations, une révélation sobre remplace l'effet, sauf s'il déclare `handlesReducedMotion`.
- **Lab** : `/?lab` joue chaque effet isolément, à l'échelle du bureau, du paysage ou du portrait. Paramètres d'URL : `effect`, `outcome`, `streak`, `label`, `marker`, `combo=1`, `autoplay=1`, `delay`.
- **Aura du combo** : halo et particules sont dessinés en canvas le long du contour réel du manche, dans les deux orientations. Couleurs, densité, vitesse, respiration et fondu se règlent dans `src/effects/ambient/combo-aura.config.ts`. Pour une texture After Effects, déposez une image (PNG ou WebP transparent) dans `public/fx/combo/` et renseignez `particles.sprite`. La pastille `RevealCombo` du kit affiche le multiplicateur (« ×2 ») pendant le combo ; le Lab le prévisualise avec la case « Combo ».
- **Événements globaux** : `game.events.on('guess' | 'combo' | 'phase' | 'challenge', …)` permet de brancher sons, vibrations ou effets d'écran sans toucher au moteur. Pour un même changement d'état, l'ordre est garanti (`guess → combo → phase → challenge`), sans doublon. `useBoardImpact`, dans `GameScreen`, en donne un exemple.

## Ajouter un niveau

Ajouter une entrée à `LEVELS` dans `src/game/levels/levels.ts` (nombre de notes, durée, cases et cordes jouables). Le bouton « Niveau suivant » apparaît automatiquement.
