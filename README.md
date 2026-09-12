# Weather App

Ce projet est une application de permettant de visualiser la météo en courbes.

---

## Configuration

Créez un fichier `.env.local` à la racine contenant les variables d'environnement nécessaires (MongoDB Atlas, session, etc.) :

```env
# MongoDB Atlas
MONGODB_ATLAS_USERNAME=...
MONGODB_ATLAS_PASSWORD=...
MONGODB_ATLAS_CLUSTER_URL=...
MONGODB_ATLAS_DB_NAME=...
MONGODB_ATLAS_APP_NAME=...

# Session Cookie Secret
SESSION_COOKIE_KEY=...

# Optionnel : identifiant pour MET Norway (respect des conditions d'utilisation)
MET_NO_USER_AGENT=SunOverTheCloud/1.0 contact@yourdomain.com
```

## Installation

```bash
npm install
```

## Lancement en développement

```bash
npm run dev
```

### Before pushing, confirm no problem with compilation

```bash
npm run build
# then
npx tsc --noEmit
# or
node --no-warnings node_modules/.bin/tsc --noEmit
# or 
npx --no-warnings tsc --noEmit

```
