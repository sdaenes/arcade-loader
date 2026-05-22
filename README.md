# 🕹 ArcadeLoader — Optimiseur de Transport 3D

Outil web pour optimiser le chargement de bornes d'arcade dans des camions ou containers.

## Fonctionnalités

- **Ajout de bornes** avec dimensions (L×H×P), quantité, couleur, possibilité d'inclinaison
- **Ajout de camions/containers** avec presets (Fourgon 12m³, Camion 20m³, Semi 90m³, Container 20'/40')
- **Algorithme 3D bin-packing** (First Fit Decreasing + Extreme Points)
- **Visualisation 3D interactive** (rotation, zoom) pour chaque camion
- **Marge d'erreur** configurable (0–30%) pour sangles, protections, imprécisions
- **Export CSV et JSON** des plans de chargement
- **Détection des bornes non-placées** avec suggestions

## Déploiement Railway

### 1. Préparer le repo GitHub

```bash
git init
git add .
git commit -m "Initial ArcadeLoader"
gh repo create arcade-loader --public --push --source=.
```

### 2. Déployer sur Railway

1. Aller sur [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub repo**
3. Sélectionner votre repo `arcade-loader`
4. Railway détecte automatiquement le `nixpacks.toml`
5. Le build installe les dépendances et compile le frontend React
6. Le serveur Express sert l'API + le frontend compilé

### Variables d'environnement Railway

| Variable | Valeur | Description |
|----------|--------|-------------|
| `PORT` | (auto) | Railway injecte le port automatiquement |

### 3. Développement local

```bash
# Installer les dépendances
npm run install:all

# Terminal 1 : backend
cd backend && npm run dev

# Terminal 2 : frontend
cd frontend && npm start
```

Le frontend tourne sur `http://localhost:3000` et proxifie `/api/*` vers le backend sur `3001`.

## Architecture

```
arcade-loader/
├── nixpacks.toml          # Config build Railway
├── backend/
│   ├── package.json
│   └── src/
│       ├── index.js       # Express server
│       └── optimizer.js   # Algorithme 3D bin-packing
└── frontend/
    ├── package.json
    └── src/
        ├── App.js
        └── components/
            ├── Header.js
            ├── CabinetPanel.js
            ├── TruckPanel.js
            ├── Viewer3D.js    # Three.js 3D viewer
            └── ResultsView.js
```

## Algorithme

L'optimisation utilise :
1. **First Fit Decreasing** : tri des bornes par volume décroissant
2. **Extreme Points** : points candidats de placement générés aux arêtes des objets placés
3. **Gravity projection** : les bornes tombent vers le bas (simulation de gravité)
4. **Rotation** : chaque borne est testée avec rotation 0° et 90° sur l'axe vertical
5. **Inclinaison** : optionnelle par borne (bornes cocktail, etc.)

## Exemple d'utilisation

**21 bornes réparties dans 3 camions de 20m³ :**
- 10 bornes standard (0.65×1.75×0.75 m)
- 5 bornes cocktail (0.70×0.80×0.70 m)  
- 6 bornes deluxe (0.80×1.85×0.90 m)

→ L'algorithme calcule automatiquement la meilleure distribution.
