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
- **Coup de pouce** : un joueur à la peine peut recevoir une aide, une seule fois par partie. Dès que son temps de réaction moyen dépasse 5 s (sur deux réponses au moins), chaque réponse a 30 % de chances de la déclencher. L'aide ajoute aussitôt **10 secondes** au temps restant, puis la note qui vient d'être révélée revient jusqu'à être trouvée trois fois, à des positions différentes du manche, cerclée d'ambre. Une erreur ne consomme pas de répétition : la note revient simplement. Ces trois bonnes réponses ne valent ensemble qu'**un cran** de progression : le segment suivant de la barre se divise en trois et se remplit en ambre à chaque réussite, puis devient blanc à la troisième. Une annonce nomme la note et le temps accordé, et une pastille du HUD décompte les réussites. Ces notes rapportent leurs points ordinaires, sans multiplicateur, et ne comptent pas pour le combo, qui s'éteint à l'arrivée de l'aide : combos et bonus ne se cumulent jamais.
- **Étoiles** : l'écran de victoire note la partie de une à trois étoiles. Une étoile récompense le niveau réussi ; les deux suivantes dépendent d'un indice qui mêle, à 60 / 40, le score et la part du temps restante. Les trois étoiles correspondent à peu près à une allure de 2 s par note sans erreur, deux étoiles à la zone du combo (moins de 3 s). Le coup de pouce est neutralisé : ses 10 s ne comptent pas, et ses trois réussites ne pèsent qu'une note.
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
│  └─ config.ts             réglages de « game feel », barème des points, combo, coup de pouce, notation
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
5. **Écrans bas** : les variants `short:` (hauteur ≤ 420 px) et `compact:` (hauteur ≤ 500 px) sont définis dans `index.css`.

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
- **Événements globaux** : `game.events.on('guess' | 'combo' | 'assist' | 'phase' | 'challenge', …)` permet de brancher sons, vibrations ou effets d'écran sans toucher au moteur. Pour un même changement d'état, l'ordre est garanti (`guess → combo → assist → phase → challenge`), sans doublon. `useBoardImpact`, dans `GameScreen`, en donne un exemple.

## Régler les bonus

Les règles vivent dans `src/game/config.ts`, à côté du barème des points :

- `COMBO_RULES` : nombre de réponses rapides, seuil de rapidité, durée, recharge, plafond et multiplicateur du combo ;
- `ASSIST_RULES` : seuil de lenteur (`averageAboveMs`), nombre minimal de réponses avant le premier tirage (`minAnswers`), probabilité (`chance`), bonnes réponses attendues pour le cran (`repeats`), temps accordé (`bonusTimeMs`) et, avec `samePosition`, la possibilité de reposer la note au même endroit plutôt que de la promener sur le manche.

L'annonce (`AssistBanner`), la pastille du HUD (`AssistChip`), le cran ambré de la barre (`pending` de `LevelProgress`), le « +10 s » du minuteur (`level-timer-bonus`) et le cercle du point (`variant: 'assist'`) puisent dans les jetons `--assist` et `--assist-foreground` de `src/theme/tokens.css`.

## Régler la notation

`RATING_RULES` (`src/game/config.ts`) fixe le calcul des étoiles :

```
indice = scoreWeight × min(1, score retenu / score de référence)
       + (1 − scoreWeight) × min(1, part de temps restante / referenceTimeShare)
```

- `referenceTimeShare` est une part du temps du niveau, **figée** (63 %) : raccourcir le compte à rebours rend les étoiles plus exigeantes en même temps que le niveau ;
- le score de référence est celui d'un joueur simulé à `referencePaceMs` par note, sans erreur (3 600 points au niveau 1) ;
- `twoStarsAt` et `threeStarsAt` placent les seuils, `maxStarsWithAssist` peut plafonner une partie aidée.

Un niveau peut surcharger ces réglages avec son champ `rating`. Sur l'écran de victoire, `data-rating-index` donne l'indice obtenu, et `rateGame` (`src/game/engine/rating.ts`) en détaille les composantes. Les tests de `rating.test.ts` rejouent le tableau de référence : ils signalent tout réglage qui en déplace une ligne.

## Ajouter un niveau

Ajouter une entrée à `LEVELS` dans `src/game/levels/levels.ts` (nombre de notes, durée, cases et cordes jouables). Le bouton « Niveau suivant » apparaît automatiquement.
