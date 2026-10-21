# Jetons du design system pour Figma

`fretable.tokens.json` reprend, au format [W3C Design Tokens](https://www.designtokens.org/) (DTCG), tous les jetons du prototype, dans son thème sombre. Il est généré depuis le code par `npm run tokens` : ne le modifiez pas à la main, relancez la commande après chaque changement de `src/index.css`, `src/theme/tokens.css` ou `src/theme/motion.ts`.

## Contenu

| Groupe                                             | Ce qu'il contient                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color.ui`                                         | couleurs shadcn/ui (fond, texte, cartes, primaire, atténué, bordure, anneau de focus…)                                                                         |
| `color.fretboard`, `marker`, `piano`               | manche, frettes, cordes, repère de note, touches du piano                                                                                                      |
| `color.feedback`, `hud`, `boss`, `reveal`          | bonne et mauvaise réponse, bandeau, barres de vie, éclats des révélations                                                                                      |
| `color.combo`, `assist`, `triad`, `rating`, `coin` | combo (bleu) et combo enflammé (orangé), coup de pouce (ambre), triade (vert acide), étoiles, pièces                                                           |
| `preset.maple`                                     | les couleurs que redéfinit la touche en érable                                                                                                                 |
| `font`, `typography`                               | Geist et Geist Mono, tailles, graisses, et onze styles de texte (titre d'accueil, titre de panneau, score, bandeau, légende, touche clavier, nombre flottant…) |
| `radius`, `spacing`                                | rayons (10 px de base) et pas d'espacement de 4 px                                                                                                             |
| `shadow`                                           | halos du combo, du combo enflammé, de la triade et des lampes en surchauffe                                                                                    |
| `duration`, `easing`                               | durées et courbes d'animation                                                                                                                                  |

Les couleurs OKLCH et les mélanges `color-mix()` du code sont convertis en hexadécimal sRGB, alpha compris (`#fafafa1a`). Un jeton qui renvoie simplement à un autre reste un alias (`{color.ui.foreground}`) : dans Figma, les variables se référencent comme dans le CSS. Quelques teintes très saturées (orangé du combo enflammé) débordent légèrement du sRGB : Figma les affiche telles qu'un écran sRGB les rend, un peu moins vives que sur un écran P3.

## Le plugin Fretable (recommandé)

`figma-plugin/` contient un plugin Figma qui construit tout le design system dans le fichier ouvert, sans autre outil :

- **Variables** : la collection « Fretable · Couleurs », avec un mode **Sombre** et un mode **Érable** (la touche claire), alias compris, et la collection « Fretable · Dimensions » (rayons, espacements) ;
- **Styles** : quatorze styles de texte et quatre halos « Fretable/… », couleurs liées aux variables ;
- **Fondations** : nuancier, typographie, rayons et halos ;
- **Composants** : bouton (primaire, contour, fantôme), pastille (combo, combo enflammé, triade, coup de pouce), panneau, solde de pièces, bandeau (ordinateur et téléphone), manche, repère et piano (ordinateur et téléphone) ;
- **Trame** : accueil et partie sur ordinateur (1280 × 800) et téléphone en paysage (844 × 390), plus l'avant-partie et son panneau « Commencer ». Bandeau, manche et piano y sont posés aux positions mesurées sur le prototype ; le manche reprend sa géométrie exacte (`neck.json`).

Pour l'installer, dans l'**application de bureau** Figma (les plugins en développement n'y tournent que là) : menu **Plugins → Development → Import plugin from manifest…** (libellés de l'interface anglaise), puis choisir `design/figma-plugin/manifest.json`. On le lance ensuite depuis **Plugins → Development → Fretable — design system**.

Chaque exécution met à jour les variables et les styles : relancez-le après `npm run tokens` pour que Figma suive le code. Les trois pages ne sont créées que si aucune n'existe encore ; supprimez-les pour les régénérer, vos autres pages ne sont jamais touchées. Sur le forfait gratuit de Figma, une collection n'a qu'un mode : le mode Érable n'est alors pas créé. Si Geist ou Geist Mono manquent (elles sont normalement disponibles dans Figma), Inter les remplace, et le message de fin le signale.

`code.js` est généré par `npm run tokens` à partir de `plugin.js`, des jetons et de `neck.json` : modifiez `plugin.js`, jamais `code.js`.

## Import avec Tokens Studio

Pour n'importer que les jetons, avec le plugin **Tokens Studio for Figma** :

1. Dans les réglages du plugin, choisir le format de jetons **W3C DTCG**.
2. Charger `fretable.tokens.json` : depuis un fichier, ou mieux, en synchronisant le plugin avec ce dépôt GitHub (chemin `design/fretable.tokens.json`), pour que Figma suive le code.
3. Exporter vers Figma par le menu des styles et variables : les couleurs, rayons et espacements deviennent des **variables**, les styles de texte et les halos des **styles**.

Les durées et les courbes n'ont pas d'équivalent dans les variables Figma : elles servent de référence pour les transitions des prototypes (courbe personnalisée de Smart Animate).

## Cadres de référence

- **Ordinateur** : 1280 × 800.
- **Téléphone en paysage** : 844 × 390. Sous 420 px de haut, le bandeau se compacte sur une seule ligne d'environ 36 px ; sous 500 px, l'écran de victoire range ses étoiles à côté du score.
- **Portrait** : sous 640 px de large, le jeu ne se joue pas et invite à tourner le téléphone.

Pour d'autres écrans (inventaire, fins de partie, boss), un plugin d'import de pages web (html.to.design, par exemple) peut capturer le site déployé en calques modifiables ; il reste ensuite à rattacher leurs couleurs aux variables.
