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

- **Départ** : chaque partie s'ouvre sur un décompte **3, 2, 1** affiché sur le manche ; la première note apparaît à son terme, et c'est alors seulement que le temps se met à courir. Pendant le décompte, le piano ne répond pas. Rythme et longueur se règlent dans `GAME_FEEL` (`startCountdownFrom`, `startCountdownStepMs`) ; `startCountdownFrom: 0` supprime le décompte.
- **Niveau 1** : trouver **24 notes en 2 minutes**. Chaque bonne réponse remplit la barre d'un cran. Une erreur révèle la bonne note en rouge, puis une nouvelle note apparaît.
- **Temps écoulé** : la note en attente est révélée en rouge (sans compter comme une erreur), puis l'écran de fin la rappelle.
- **Points** : chaque bonne réponse rapporte selon le temps de réaction, mesuré depuis l'apparition du point. 0,5 s ou moins vaut 1 000 points (coup critique), moins de 1 s 600, moins de 2 s 400, moins de 3 s 300, moins de 5 s 200, moins de 10 s 100, au-delà 50.
- **Combo** : trois bonnes réponses d'affilée en moins de 3 s allument le pourtour du manche (halo et particules bleues) et doublent les points des notes suivantes. Une jauge bleue apparaît sous la barre de progression et se vide en 6 s, quelles que soient les réponses. Chaque bonne réponse en moins de 3 s la recharge de 2 s, sans jamais dépasser 6 s. Une fois la jauge vide, il faut à nouveau trois réponses rapides. Une triade ne coupe pas le joueur dans son élan : le combo la traverse, et pendant les pauses (annonce de la triade, parcours de gamme), sa jauge se fige puis repart où elle s'était arrêtée.
- **Coup de pouce** : un joueur à la peine peut recevoir une aide, une seule fois par partie. Dès que son temps de réaction moyen dépasse 5 s (sur deux réponses au moins), chaque réponse a 30 % de chances de la déclencher. L'aide ajoute aussitôt **10 secondes** au temps restant, puis la note qui vient d'être révélée revient jusqu'à être trouvée trois fois, à des positions différentes du manche, cerclée d'ambre. Une erreur ne consomme pas de répétition : la note revient simplement. Ces trois bonnes réponses ne valent ensemble qu'**un cran** de progression : le segment suivant de la barre se divise en trois et se remplit en ambre à chaque réussite, puis devient blanc à la troisième. Une annonce nomme la note et le temps accordé, et une pastille du HUD décompte les réussites. Ces notes rapportent leurs points ordinaires, sans multiplicateur, et ne comptent pas pour le combo, qui s'éteint à l'arrivée de l'aide : combo et coup de pouce ne se cumulent jamais.
- **Triade** : à tout moment de la partie, trois notes forment une triade majeure ou mineure jouable : fondamentale, tierce et quinte sur trois cordes voisines, la main écartée de trois cases au plus. Juste avant, la partie se met en pause le temps d'une annonce brève (1,3 s, non décomptée) : une carte vert acide s'abat sur la scène, « Trouve » en petit et l'accord en gros, en noir (« SOL MAJEUR »), avec éclair, onde de choc et gerbe d'étincelles, puis s'envole à l'apparition de la première note. La note à trouver brille d'un halo vert acide semé d'étincelles ; les suivantes attendent en filigrane, de fins cercles gris évidés. Les trois notes comptent normalement pour la progression. Chacune, trouvée avant la fin de son anneau, vaut double, comme en combo, même quand la triade est déjà perdue : la pastille « ×2 » du score s'allume en vert acide tant que l'anneau tourne, et l'anneau vide passe au gris. Le combo, lui, continue de tourner : ces notes le nourrissent comme les autres (elles peuvent même l'allumer), et sa pastille bleue prend le pas sur la verte. Combo et anneau valent chacun ×2 et ne s'additionnent pas : une note de triade vaut au plus double. Elles ne comptent pas pour le coup de pouce. La triade va toujours au bout ; réussie si ses trois notes sont justes, chacune en moins de 5 s, délai qu'un anneau vert acide égrène autour de chacune de ses notes, à son tour. Une annonce nomme l'accord dans les deux cas et, sur un échec, en donne la raison : une erreur, ou la réponse la plus lente. Chaque nouvelle note a 20 % de chances d'ouvrir une triade, autant de fois que la partie le permet : quatre notes ordinaires au moins séparent deux triades (parcours de gamme non compris), jamais pendant un coup de pouce, et seulement s'il reste au moins quatre notes à trouver.
- **Parcours de gamme** : une triade réussie dessine sur le manche, du grave à l'aigu, la forme pentatonique qui la prolonge (majeure ou mineure, selon l'accord) : une « boîte » de deux notes par corde, choisie pour englober la triade, dont les notes restent mises en valeur. Le joueur la parcourt note après note jusqu'au bout ; la note à jouer brille en vert acide, les suivantes attendent en fins cercles évidés, discrets pour ne pas se confondre avec les repères des cases, et les notes jouées deviennent de petits points de la couleur de leur issue. Aucun tracé ne les relie : la forme se lit corde par corde, comme une boîte. Le temps de la partie est suspendu pendant tout le parcours, qui ne compte pas pour la progression ; chaque note, elle, a son propre délai de 5 s, qu'un anneau vert acide égrène autour d'elle, comme pour les triades. Anneau vide, la note est manquée : la bonne note est révélée, et le parcours passe à la suivante. Les lecteurs d'écran entendent ce délai avec la note (« Note à trouver : corde 5, case 7, en 5 secondes »), comme pour les notes de triade. Chaque note juste rapporte 150 points, et un parcours sans faute 1 000 de plus. Sans le palier 1 (à venir), le bonus s'en tient à la pentatonique.
- **Étoiles** : l'écran de victoire note la partie de une à trois étoiles. Une étoile récompense le niveau réussi ; les deux suivantes dépendent d'un indice qui mêle, à 60 / 40, le score et la part du temps restante. Les trois étoiles correspondent à peu près à une allure de 2 s par note sans erreur, deux étoiles à la zone du combo (moins de 3 s). Le coup de pouce est neutralisé : ses 10 s ne comptent pas, et ses trois réussites ne pèsent qu'une note. Le parcours de gamme aussi : ni ses points, ni sa durée n'entrent dans la notation. Quant aux triades, que le combo traverse et dont les notes jouées à temps valent double, la référence les joue aux mêmes places que le joueur, anneaux battus compris : un bonus tiré au sort ne coûte pas d'étoile.
- **Pièces** : la monnaie du jeu. À la fin de chaque partie, victoire ou défaite, en mode classique comme contre le boss, le score se convertit en pièces : 1 000 points valent 100 pièces (arrondi à la pièce inférieure). Une victoire, en mode classique comme contre le boss, rapporte en plus une prime selon les étoiles : 100 pièces pour une, 300 pour deux, 700 pour trois. L'écran de fin le montre avec entrain : des pièces filent du score vers un compteur doré qui grimpe, la prime s'abat à côté (« +700 » et ses étoiles) puis s'y fond, et le solde du portefeuille suit, de l'ancien au nouveau ; une fois la prime fondue, son détail reste affiché (« dont +700 ★★★ ») ; en mouvement réduit, tout est posé d'emblée. Sur écran bas, le solde se range sur la ligne du compteur. Le portefeuille est crédité dès la fin de la partie, une seule fois (chaque partie est identifiée par l'heure absolue de son départ, et les 20 derniers crédits sont retenus), et conservé dans le navigateur (`localStorage`, relu avant chaque crédit pour ne rien écraser d'un autre onglet) ; l'écran d'accueil en rappelle le solde.
- **Boss final (prototype)** : l'interrupteur « Boss », en haut à gauche, bascule dans un mode façon StepMania (accès direct par `?boss` ou `#boss`). Le piano disparaît : seul le manche reste à l'écran, et l'on joue au clavier (q s d j k l m, Maj pour les dièses). Les notes, tirées au hasard, partent du bas de l'écran toutes les 2 secondes et montent lentement, le long de couloirs verticaux, jusqu'à leur cible (un anneau sur le manche), qu'elles touchent en 6 secondes : plusieurs sont en vol à la fois, la suivante déjà en route avant que la précédente n'arrive. On les joue une à une, dans l'ordre d'arrivée : celle à jouer est au premier plan, les suivantes atténuées, et les anneaux d'arrivée s'estompent selon leur rang dans la file (100 %, 50 %, 25 %), chacun montant d'un cran à chaque jugement. Trop tôt, la frappe ne compte pas (« Trop tôt » s'affiche un instant sur la note) ; trop tard non plus : une frappe avec la touche de la note d'avant, ou avec une autre touche plus près de la fenêtre qui vient de se fermer que de la suivante, visait la note d'avant (la touche de la note à jouer, elle, vise toujours celle-ci), et « Trop tard » s'affiche sur celle-ci si elle a filé (rien, si elle avait été frappée), plutôt qu'un « Trop tôt » sur la suivante ; dans la fenêtre, la précision donne « Parfait », « Super » ou « Bien », avec la même révélation et le même impact du manche qu'en partie classique ; une mauvaise touche est une erreur ; sans frappe, le fantôme dépasse la cible et s'efface : c'est un raté. La barre de progression cède la place à deux barres de vie. Celle du joueur, rouge et marquée d'un cœur, se vide de droite à gauche : un raté coûte cher, une erreur plus encore, chaque réussite en rend un peu. Celle du boss, violette et marquée d'une tête de mort, compte 30 segments et en perd un à chaque réussite : seules les réussites le blessent, et le compteur du bandeau dit combien de coups lui ont été portés. Une erreur ou un raté ne l'entame pas : les notes continuent d'arriver tant qu'il tient debout, si bien que chaque échec allonge le combat, au prix de la vie du joueur. Vider sa barre, c'est vaincre le boss ; à zéro de vie, K.O. Une victoire est notée en étoiles, selon la vie qui reste au joueur quand le boss tombe : plus des deux tiers, trois étoiles ; au moins un tiers, deux ; en deçà, une. La partition compte assez de notes pour que le combat finisse toujours avant elle : 30 réussites, plus tous les échecs que la vie du joueur peut encaisser, recharges comprises (62 notes du boss au plus avec les réglages actuels, notes bonus non comprises). Cinq réussites d'affilée allument le combo, du même bleu qu'en partie classique (aura du manche, pastille « ×2 » à côté du score) et avec le même bonus : les notes suivantes valent double. Dix réussites l'enflamment : l'aura vire à l'orangé vif, ses braises montent comme des flammes, et les notes valent triple. Ici, pas de jauge : le combo tient tant que le joueur ne se trompe pas et ne laisse filer aucune note ; la moindre erreur, le moindre raté l'éteint, et il faut repartir de zéro. Entre deux notes, une note bonus peut s'intercaler (une fois sur trois environ) : jaune comme le coup de pouce, elle part plus tard et monte plus vite (2,5 s de trajet), pour toucher sa cible à mi-chemin des deux autres. Elle tombe toujours sur une case libre : aucune autre note à l'écran pendant son vol, du boss ou bonus, n'occupe sa case, quelle que soit la corde. Son couloir n'appartient donc qu'à elle : elle ne s'empile jamais avec une autre note dans une même colonne du manche, dans un ordre difficile à lire (faute de case libre, elle sauterait son tour). Les notes du boss, elles, restent tirées librement. Elle se joue à son tour, dans l'ordre d'arrivée, avec une fenêtre de jugement plus large que les autres (350 ms d'avance et 600 de retard, contre 180 et 220) : elle arrive une seconde à peine après la note précédente, et il faut encore lire sa position. Frappée, elle rapporte le triple de ses points, avec la même révélation (« ×3 ») ; une première mauvaise touche ne la consomme pas (« Erreur » s'affiche, et l'on peut retenter une fois tant que sa fenêtre est ouverte), la deuxième si, sans rien coûter : seules les deux premières touches comptent, et balayer le clavier ne garantit plus le triple ; manquée, elle s'efface (« Raté ») sans rien coûter. Passé sa cible, son fantôme ralentit à l'allure d'une note ordinaire : il reste près de l'anneau tant qu'elle est jouable. Elle ne blesse pas le boss, ne rend pas de vie et laisse le combo tel quel. L'écran de fin en fait le compte à part. Pas encore de musique : le futur moteur de synchronisation prendra le relais de cette cadence.
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
│  ├─ boss/                 boss final : partition, jugement, barre de vie, couloirs (moteur pur)
│  ├─ coins/                pièces : conversion du score, prime d'étoiles, portefeuille persistant
│  ├─ input/                correspondance clavier et hook de contrôles
│  └─ config.ts             réglages de « game feel », barème des points, combo, coup de pouce, notation
├─ components/
│  ├─ ui/                   primitives shadcn/ui
│  └─ game/                 manche, piano, HUD, overlays, écran de jeu, boss/ (écran du boss final)
├─ effects/                 révélations (contrat, registre, calque, kit, presets) et aura du combo
├─ lab/                     banc d'essai isolé des effets (/?lab)
├─ hooks/                   hooks génériques (taille d'élément, media queries)
├─ lib/                     utilitaires (cn, PRNG déterministe)
└─ theme/                   jetons de design (CSS) et de mouvement (TS)
```

Trois principes guident l'ensemble :

- **Le domaine ignore l'interface.** `gameReducer` est une machine à états pure (`ready → starting → playing → won | lost`) à laquelle le hasard et l'horloge sont injectés. Les tests unitaires sont rangés à côté de chaque module (`__tests__`).
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
- **Lab** : `/?lab` joue chaque effet isolément, à l'échelle du bureau ou du téléphone en paysage. Paramètres d'URL : `effect`, `outcome`, `streak`, `label`, `marker`, `combo=1`, `autoplay=1`, `delay`.
- **Aura du combo** : halo et particules sont dessinés en canvas le long du contour réel du manche, dans les deux orientations. Couleurs, densité, vitesse, respiration et fondu se règlent dans `src/effects/ambient/combo-aura.config.ts`. Pour une texture After Effects, déposez une image (PNG ou WebP transparent) dans `public/fx/combo/` et renseignez `particles.sprite`. `COMBO_FIRE_AURA`, l'aura du combo enflammé du boss, est orangée, plus dense et plus vive : son halo vacille plus vite, ses particules sont plus nombreuses, et une poussée verticale (`particles.lift`) fait monter les braises, avec une marge plus large pour les laisser s'élever ; elle ne reprend de l'aura bleue que le liseré, les fondus et la texture. Passer d'une aura à l'autre, combo allumé, la ravive d'un nouvel éclat. La pastille `RevealCombo` du kit affiche le multiplicateur (« ×2 », ou « ×3 » pendant le combo enflammé du boss) pendant le combo et sur une note de triade jouée à temps ; le Lab le prévisualise avec la case « Combo ».
- **Événements globaux** : `game.events.on('guess' | 'combo' | 'assist' | 'triadIntro' | 'triad' | 'triadResult' | 'scaleRun' | 'scaleResult' | 'phase' | 'challenge', …)` permet de brancher sons, vibrations ou effets d'écran sans toucher au moteur. Pour un même changement d'état, l'ordre est garanti (`guess → combo → assist → triadIntro → triad → triadResult → scaleRun → scaleResult → phase → challenge`), sans doublon. Une partie s'ouvre sur `phase: starting` (le décompte), puis `phase: playing` et la première note. `useBoardImpact`, dans `GameScreen`, en donne un exemple.

## Régler les bonus

Les règles vivent dans `src/game/config.ts`, à côté du barème des points :

- `COMBO_RULES` : nombre de réponses rapides, seuil de rapidité, durée, recharge, plafond et multiplicateur du combo ;
- `COIN_RULES` : points par pièce (10, soit 1 000 points pour 100 pièces) et prime de victoire selon les étoiles ;
- `TRIAD_RULES` : probabilité à chaque note (`chance`), nombre maximal par partie (`maxPerGame`, sans limite par défaut), notes ordinaires entre deux triades (`minNotesBetween`), notes qu'il doit rester à trouver (`minNotesLeft`), seuil de rapidité (`fastReactionMs`), durée de l'annonce (`introMs`, 0 pour s'en passer), écart maximal de la main (`maxFretSpan`) et qualités tirées ;
- `BOSS_RULES` : boss final — vie du boss, en réussites à lui porter (`bossLife`, d'où la longueur de la partition, `bossChartLength`), trajet d'un fantôme du bas de l'écran à sa cible (`travelMs`), écart entre deux notes (`intervalMs`, d'où le nombre de notes en vol), départ de la première note (`startDelayMs`), fenêtres de jugement, barre de vie (départ, plafond, coût d'un raté et d'une erreur, recharge par jugement), points, combo (réussites pour l'allumer et l'enflammer, multiplicateurs), notes bonus (chance par intervalle, trajet, multiplicateur, fenêtre de jugement), étoiles (seuils de vie restante) et fondu d'un fantôme manqué (`fadeMs`) ;
- `SCALE_RULES` : gammes accessibles (`kinds`, la pentatonique tant que le palier 1 n'est pas débloqué), points par note juste (`pointsPerNote`), délai de chaque note (`noteMs`) et supplément d'un parcours sans faute (`perfectBonus`) ;
- `ASSIST_RULES` : seuil de lenteur (`averageAboveMs`), nombre minimal de réponses avant le premier tirage (`minAnswers`), probabilité (`chance`), bonnes réponses attendues pour le cran (`repeats`), temps accordé (`bonusTimeMs`) et, avec `samePosition`, la possibilité de reposer la note au même endroit plutôt que de la promener sur le manche.

L'annonce (`AssistBanner`), la pastille du HUD (`AssistChip`), le cran ambré de la barre (`pending` de `LevelProgress`), le « +10 s » du minuteur (`level-timer-bonus`) et le cercle du point (`variant: 'assist'`) puisent dans les jetons `--assist` et `--assist-foreground` de `src/theme/tokens.css`.

## Régler la notation

`RATING_RULES` (`src/game/config.ts`) fixe le calcul des étoiles :

```
indice = scoreWeight × min(1, score retenu / score de référence)
       + (1 − scoreWeight) × min(1, part de temps restante / referenceTimeShare)
```

- `referenceTimeShare` est une part du temps du niveau, **figée** (63 %) : raccourcir le compte à rebours rend les étoiles plus exigeantes en même temps que le niveau. Étalonnée sur 6 notes en 30 s, elle correspond de nouveau, avec 24 notes en 2 minutes, à une allure d'environ 1,5 s par note : trois étoiles jusque vers 1,9 s par note, deux entre 2 et 3 s, une au-delà ;
- le score de référence est celui d'un joueur simulé à `referencePaceMs` par note, sans erreur (18 000 points au niveau 1) ;
- `twoStarsAt` et `threeStarsAt` placent les seuils, `maxStarsWithAssist` peut plafonner une partie aidée.

Un niveau peut surcharger ces réglages avec son champ `rating`. Sur l'écran de victoire, `data-rating-index` donne l'indice obtenu, et `rateGame` (`src/game/engine/rating.ts`) en détaille les composantes. Les tests de `rating.test.ts` rejouent le tableau de référence : ils signalent tout réglage qui en déplace une ligne.

## Ajouter un niveau

Ajouter une entrée à `LEVELS` dans `src/game/levels/levels.ts` (nombre de notes, durée, cases et cordes jouables). Le bouton « Niveau suivant » apparaît automatiquement.
