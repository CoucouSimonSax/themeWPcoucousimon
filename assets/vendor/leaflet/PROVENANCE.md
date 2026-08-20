# Leaflet 1.9.4

Bibliothèque de cartographie, hébergée **dans le thème** et non chargée
depuis un CDN : livrer un fichier depuis un serveur tiers transmet
l'adresse IP de chaque visiteur à ce tiers, sans son accord.

## D'où viennent ces fichiers

```
npm pack leaflet@1.9.4
```

Puis, depuis l'archive obtenue :

| Fichier de l'archive | Destination |
|---|---|
| `dist/leaflet.js` | `leaflet.js` |
| `dist/leaflet.css` | `leaflet.css` |
| `dist/images/*` | `images/` |
| `LICENSE` | `LICENSE.txt` |

Aucun fichier n'a été modifié.

## Licence

BSD 2-Clause — voir `LICENSE.txt`. Elle autorise la redistribution à
condition de conserver l'avis de copyright, ce que fait ce dossier.

## Ce que Leaflet ne règle pas

Héberger la bibliothèque supprime la requête vers le CDN, mais **pas**
celles vers les tuiles d'image de la carte, qui viennent forcément
d'OpenStreetMap. C'est pourquoi la carte ne s'affiche qu'après un clic
explicite du visiteur, prévenu de ce que ce clic déclenche.

## Pour mettre à jour

Refaire `npm pack leaflet@<version>`, recopier les mêmes fichiers, et
vérifier que la carte s'affiche toujours sur la page de devis.
