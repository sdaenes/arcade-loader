# Design — Gestionnaire de Sessions

**Date :** 2026-06-29
**Statut :** Approuvé

## Objectif

Permettre à l'utilisateur de sauvegarder l'état complet de l'application (bornes, camions, marge, placements manuels) sous un nom libre, de rappeler une session sauvegardée, et d'exporter/importer des sessions en JSON.

## Structure des données

Chaque session est un objet stocké dans `localStorage` sous la clé `al_sessions` (tableau) :

```json
{
  "id": "<timestamp-ms>",
  "name": "Transport Lyon juin",
  "savedAt": "2026-06-29T14:32:00.000Z",
  "data": {
    "cabinets": [...],
    "trucks": [...],
    "errorMargin": 5,
    "manualPlacements": {}
  }
}
```

L'`id` est le timestamp en millisecondes au moment de la sauvegarde — suffisant pour l'unicité, sans dépendance externe.

L'auto-sauvegarde avant chargement utilise le même format, avec le nom `"Auto — DD/MM HH:MM"`.

## UI

Zone "Sessions" ajoutée en bas de l'onglet Setup, avec 4 boutons sur une ligne :

```
[ 💾 Sauvegarder ]  [ 📂 Charger ]  [ ⬆ Exporter JSON ]  [ ⬇ Importer JSON ]
```

### Modal Sauvegarde

- Champ texte pré-rempli avec la date courante (ex: `"29/06/2026 14:32"`)
- Bouton "Valider" et bouton "Annuler"
- Pas de `window.prompt` — modal inline dans le composant

### Modal Chargement

- Liste des sessions sauvegardées (nom + date formatée)
- Bouton "Charger" et icône poubelle pour supprimer par session
- Message si aucune session sauvegardée
- Avant de charger : auto-sauvegarde silencieuse de l'état courant

### Export JSON

- Télécharge `arcade-loader-sessions.json` contenant le tableau `al_sessions`
- Déclenché directement au clic, sans modal

### Import JSON

- Ouvre un sélecteur de fichier (`<input type="file" accept=".json">`)
- Fusionne les sessions importées avec celles existantes
- Déduplication par `id` — les sessions avec un `id` déjà présent sont ignorées

## Architecture

### Nouveau fichier : `frontend/src/components/SessionManager.js`

Encapsule toute la logique sessions :
- Lecture/écriture `localStorage` (`al_sessions`)
- Rendu des 4 boutons
- Rendu des modals (sauvegarde et liste)
- Logique export/import JSON

**Props :**
- `cabinets`, `trucks`, `errorMargin`, `manualPlacements` — état courant à sauvegarder
- `onLoad(data)` — callback appelé avec `{ cabinets, trucks, errorMargin, manualPlacements }` lors du chargement d'une session

### Modifications dans `App.js`

- Ajout de `handleLoadSession(data)` : auto-sauvegarde l'état courant, puis applique `setCabinets`, `setTrucks`, `setErrorMargin`, `setManualPlacements`
- Intégration de `<SessionManager>` dans le rendu de l'onglet Setup, sous la configuration existante

### Fichier CSS : `frontend/src/components/SessionManager.module.css`

Styles dédiés pour les boutons, modals et liste de sessions — cohérent avec le CSS module existant du projet.

## Flux de chargement (détail)

1. Utilisateur clique "Charger"
2. Modal liste s'ouvre avec toutes les sessions
3. Utilisateur clique "Charger" sur une session
4. `SessionManager` appelle `onLoad(session.data)`
5. Dans `App.js`, `handleLoadSession` :
   a. Génère une auto-sauvegarde de l'état courant (`"Auto — DD/MM HH:MM"`)
   b. Appelle `setCabinets`, `setTrucks`, `setErrorMargin`, `setManualPlacements` avec les données de la session
6. Modal se ferme

## Ce qui n'est pas inclus

- Pas de sync serveur ni de partage entre utilisateurs
- Pas de renommage de session après création (peut être ajouté plus tard)
- Les résultats d'optimisation (`results`) ne sont pas sauvegardés — ils se recalculent à la demande
