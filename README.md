# Weather App

Ce projet est une application de permettant de visualiser la météo en courbes.

---

## Configuration

### Backend

Dans le dossier `/backend`, vous pouvez configurer les variables d'environnement optionnelles dans `.env` :

```
# Optionnel : identifiant pour MET Norway (respect des conditions d'utilisation)
MET_NO_USER_AGENT=SunOverTheCloud/1.0 contact@yourdomain.com
```

## Installation
Pour installer les dépendances du projet, exécutez les commandes suivantes :


### Backend
```
cd backend
npm install
```

### Frontend
```
cd ../frontend
npm install
```

## Lancement

### Backend
Pour lancer le backend, exécutez :

```
cd backend
npm start
```

### Frontend
Pour lancer le frontend, exécutez :

```
cd frontend
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
