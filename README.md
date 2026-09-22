# Cockpit Benjamin

Version **personnelle** de Cockpit Audibene, pour Benjamin Magnier uniquement (dépôt privé).

- Base : Cockpit Audibene v1.0.34 (dépôt `Benjamin-Mag/cockpit-audibene`, version de l'équipe).
- En plus de la version de l'équipe : la page **Ventes** (suivi des ventes et primes) et les essais personnels.
- Les corrections et nouveautés de Cockpit Audibene sont reportées ici (`git fetch upstream && git merge upstream/main`). L'inverse ne se fait jamais.

## Installer
1. Télécharger `cockpit-benjamin.zip` depuis la dernière release de ce dépôt (connecté à GitHub).
2. Décompresser dans un dossier gardé (par ex. `Documents\Cockpit Benjamin`).
3. `edge://extensions` → mode développeur → « Charger l'extension non empaquetée » → ce dossier.
4. Désactiver Cockpit Audibene (une seule des deux extensions active à la fois).
5. Au premier lancement : « Choisir mon dossier » → le même dossier que Cockpit Audibene : `cockpit.json` est repris (modèles, réglages, ventes).

## Développer
```bash
npm install
npm run build        # dist/ = extension non empaquetée
npx tsc --noEmit
```
