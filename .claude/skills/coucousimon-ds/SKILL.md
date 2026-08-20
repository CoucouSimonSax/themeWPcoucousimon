---
name: coucousimon-ds
description: Règles du thème bloc Coucou Simon (design system, déploiement o2switch, page de devis). À charger avant toute intervention sur theme.json, templates/, parts/, patterns/, style.css ou la page de devis.
---

# Thème Coucou Simon

Thème bloc WordPress sur mesure, `theme.json` version 3.
Site : `https://www.coucousimon.tritons.eu` — installation WordPress **distincte**
de celle des Tritons, sur son propre sous-domaine.
Dépôt : `https://github.com/CoucouSimonSax/themeWPcoucousimon` (public).
Dossier local : `C:\Users\simon\Admin\tritons\web\coucousimon`.

Le design system vit dans Claude Design, projet **« Coucou Simon Design
System »** (`019df453-7e5e-7d42-8c60-2969f606eac7`), lisible via l'outil
DesignSync. Ne jamais recopier ses valeurs ici : les lire à la source.

## L'interlocuteur

Simon. **Pas développeur.** Français, tutoiement.

- **Réponses courtes.** Il ne veut pas le détail technique d'une correction ;
  s'il en a besoin, il demande. Garder les explications pour ce qui change une
  décision de sa part : un arbitrage, un risque, une manipulation à faire.
- **Les manipulations se décrivent en clics, jamais en jargon.** Pas « mets le
  dossier en 755 » mais « Gestionnaire de fichiers → clic droit sur le dossier
  → Modifier les permissions → coche Lecture et Exécuter dans les colonnes
  Groupe et Tout le monde ». Il ne retiendra pas les codes d'une fois sur
  l'autre, et une consigne imprécise lui fait cliquer au mauvais endroit.
- Une étape à la fois, avec une vérification à chaque fois. Ne pas produire dix
  fichiers d'un coup.

## Les règles du thème

1. **Toute valeur visuelle vient de `theme.json`.** Si une valeur se répète
   dans plusieurs blocs, c'est qu'elle manque dans `theme.json` — l'y ajouter
   plutôt que la recopier.
2. **Markup de blocs Gutenberg uniquement.** Pas de bloc « HTML personnalisé »
   (`wp:html`) : il rend la zone opaque dans l'éditeur. Pour un élément
   décoratif, un bloc groupe portant une classe, dessiné en CSS.
   *Exception assumée : la page de devis, qui est une application et non une
   mise en page (voir plus bas).*
3. **Un pattern par section réutilisable**, dans `/patterns/`, préfixé
   `coucousimon/`.
4. **Textes d'interface en français.**
5. **Aucune requête vers un serveur tiers.** Space Mono est hébergée dans le
   thème, pas chargée depuis Google Fonts : livrer une police depuis un CDN
   transmet l'adresse IP des visiteurs, ce qui a déjà valu des condamnations
   en Europe. Même vigilance pour toute bibliothèque ajoutée.
6. **Incrémenter `Version:` dans `style.css` à chaque modification du CSS.**
   C'est la clé de cache de la feuille de style. Sans incrément, le navigateur
   resert l'ancienne version sous la même adresse — et toute mesure faite
   ensuite porte sur un fichier périmé, ce qui envoie chercher des causes
   imaginaires.
7. **`WP_DEBUG` à `true` en développement.** Avec Playground :
   `--define-bool WP_DEBUG true`.

## Principes de design, hérités du DS

Les **valeurs** vivent dans `theme.json` — ne jamais les recopier ici.

- **Deux voix typographiques, jamais une troisième.** Gobold en display
  (titres, capitales, interlettrage ouvert), Space Mono pour absolument tout
  le reste : corps, interface, libellés, données.
- **Une seule couleur de marque**, le bleu coucou, entourée de ses quatre
  déclinaisons. Le reste est neutre : un blanc, un gris, un noir.
- Le noir se lit mieux que le blanc **sur** le bleu coucou : ne pas inverser.
- Les accents dorés et cerise sont réservés aux illustrations, jamais à
  l'interface.
- La palette par défaut de WordPress est désactivée : n'ajouter aucune couleur
  hors palette.

## La page de devis

C'est la raison d'être du site. Elle existe déjà, mais **au mauvais endroit** :
dans le contenu d'une page des Tritons (`tritons.eu/devis-coucou-simon/`),
stockée en base de données, donc ni versionnée ni modifiable depuis le dépôt.

Une capture de l'existant est conservée dans `reference/devis-existant.html` —
markup, styles et script. C'est une **référence, pas un fichier à charger**.

Architecture à conserver :

1. Choix d'une formule — aujourd'hui un menu déroulant, **à remplacer par des
   miniatures cliquables** ; chaque formule affiche son tarif de base et sa
   description.
2. Choix du lieu, avec une carte OpenStreetMap (Leaflet) qui trace le trajet
   depuis La Ciotat et calcule des frais de déplacement.
3. Une estimation cumulée, puis un bouton menant à un second écran :
   récapitulatif et coordonnées (nom, e-mail, message libre).

Points ouverts : le choix de l'extension de formulaire, et la reprise en main
de Leaflet — aujourd'hui chargé depuis un CDN, à héberger comme les polices
(voir règle 5).

Quand la page sera reconstruite dans le thème, l'ancienne page des Tritons
devra être supprimée et une redirection posée.

## Déployer

Le dépôt est cloné sur le serveur via cPanel → Git™ Version Control. Une mise
à jour = un clic sur **Update from Remote**. Ce qui compte :

- **Après tout clone, vérifier les permissions du dossier créé.** cPanel crée
  les dossiers fermés : le thème apparaît dans l'admin mais aucun style ni
  aucune police n'est servi, sans le moindre message d'erreur.
- **La médiathèque ne voyage pas avec Git.** Tout média (logo, illustrations)
  se téléverse à la main.
- **Modifier un gabarit ou une partie de modèle dans l'éditeur WordPress
  l'enregistre en base**, et cette copie prend le pas sur le fichier du thème.
  Le contenu appartient à Simon, la forme aux fichiers. En cas de doute, le
  bouton *Réinitialiser* de la partie de modèle rend la main au thème.

## Vérifier avant de dire que c'est fait

Ne jamais conclure sur la seule lecture des fichiers.

1. `grep -rn "wp:html" parts/ templates/ patterns/` — doit ne rien retourner
   hors page de devis.
2. Vérifier que chaque slug de couleur, taille ou espacement utilisé existe
   dans `theme.json`. Un preset absent ne produit aucune erreur : il produit
   silencieusement zéro.
3. Recharger la page et lire les valeurs **calculées** par le navigateur.
4. En testant le site en ligne, se méfier des mesures faites en https quand un
   certificat manque : les requêtes atterrissent alors sur le site par défaut
   du serveur, et l'on mesure autre chose que le site voulu.

## L'état réel de theme.json, à l'instant

Injecté à chaque chargement de la skill : c'est la source de vérité.

!`cat theme.json`

**Si le bloc ci-dessus est vide ou affiche la commande sans l'exécuter**, lire
`theme.json` directement avant toute modification.
