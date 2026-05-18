# 🎓 EduSen v3 — Application de gestion scolaire

PWA installable (PC + Mobile) avec synchronisation Firebase et mode hors ligne.

---

## 📋 Prérequis

- **Node.js** ≥ 18 ([télécharger](https://nodejs.org))
- Un **projet Firebase** avec Firestore activé
- Un compte **Netlify** (pour le déploiement)

---

## 🚀 Installation locale

### 1. Installer les dépendances

Ouvre un terminal dans le dossier du projet et tape :

```bash
npm install
```

Cela télécharge toutes les dépendances (Firebase, Vite, Tailwind, etc.). Compte 1-2 minutes.

### 2. Configurer Firebase

Crée un fichier `.env` à la racine du projet (en copiant `.env.example`) :

```bash
cp .env.example .env
```

Puis ouvre `.env` et remplace les valeurs par celles de **TON projet Firebase**.

Pour récupérer ces valeurs :
1. Va sur https://console.firebase.google.com
2. Choisis ton projet
3. Clique sur l'icône ⚙️ → "Paramètres du projet"
4. Sous "Vos applications", cherche l'app web (l'icône `</>`)
5. Copie les valeurs de `firebaseConfig`

Ton fichier `.env` doit ressembler à :

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=edusen-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=edusen-prod
VITE_FIREBASE_STORAGE_BUCKET=edusen-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc...
```

⚠️ **Important** : ne commit JAMAIS le fichier `.env` sur Git (il est déjà dans `.gitignore`).

### 3. Lancer l'application en local

```bash
npm run dev
```

L'application s'ouvre automatiquement sur **http://localhost:5173**.

**Connexion par défaut :**
- Identifiant : `admin`
- Mot de passe : `admin123`

⚠️ **Change ce mot de passe** dès la première connexion via Paramètres → Utilisateurs.

---

## 🌐 Déploiement sur Netlify

### Option A — Via interface Web (recommandé pour débutants)

1. **Pousse le code sur GitHub** :

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TON-PSEUDO/edusen.git
git branch -M main
git push -u origin main
```

2. Va sur https://app.netlify.com → **"Add new site"** → **"Import from Git"**

3. Choisis **GitHub** et autorise Netlify à accéder à tes dépôts.

4. Sélectionne le dépôt **edusen**.

5. Netlify détecte automatiquement Vite. Vérifie les paramètres :
   - **Build command** : `npm run build`
   - **Publish directory** : `dist`
   - **Node version** : 20 (auto via `netlify.toml`)

6. ⭐ **AVANT de déployer**, ajoute les **variables d'environnement Firebase** :
   - Va dans **Site configuration** → **Environment variables**
   - Ajoute chaque variable du `.env` (sans le préfixe `VITE_` qui est ajouté automatiquement) :
     - `VITE_FIREBASE_API_KEY` = ta clé
     - `VITE_FIREBASE_AUTH_DOMAIN` = ton domaine
     - `VITE_FIREBASE_PROJECT_ID` = ton ID projet
     - `VITE_FIREBASE_STORAGE_BUCKET` = ton bucket
     - `VITE_FIREBASE_MESSAGING_SENDER_ID` = ton sender ID
     - `VITE_FIREBASE_APP_ID` = ton app ID

7. Clique sur **"Deploy site"**.

8. Au bout de 2-3 minutes, ton site est en ligne ! Netlify te donne une URL du type `https://random-name-12345.netlify.app`.

9. Tu peux **renommer le site** dans Site settings → Change site name (ex: `edusen-monecole`).

### Option B — Via CLI Netlify

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

---

## 📱 Installer l'app sur mobile (comme une APK)

### Sur Android (Chrome)
1. Ouvre l'URL de ton site dans Chrome
2. Touche le menu (3 points en haut à droite)
3. Sélectionne **"Ajouter à l'écran d'accueil"** ou **"Installer l'application"**
4. L'app apparaît comme une vraie APK avec son icône !

### Sur iPhone / iPad (Safari)
1. Ouvre l'URL dans Safari
2. Touche le bouton **Partager** (icône carré + flèche)
3. Choisis **"Sur l'écran d'accueil"**
4. L'app est installée !

### Sur PC (Chrome / Edge)
1. Va sur l'URL du site
2. Dans la barre d'adresse, clique sur l'icône **"Installer"** (à droite de l'URL)
3. L'app s'ouvre dans une fenêtre dédiée

---

## 🔄 Mode hors ligne et synchronisation

L'app fonctionne **entièrement hors ligne** :

- **Hors ligne** : tu peux saisir des notes, des présences, créer des élèves... Tout est stocké localement (IndexedDB + cache).
- **Retour en ligne** : Firebase synchronise automatiquement les changements vers le cloud. Aucune action requise.
- **Indicateur en haut à droite** : montre l'état actuel (En ligne / Hors ligne).

---

## 🔒 Sécurité Firestore

**⚠️ IMPORTANT** : pendant le développement, les règles Firestore sont ouvertes. Avant un usage en production avec plusieurs utilisateurs, sécurise-les.

Va dans Firebase Console → Firestore → Règles, et remplace par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tout le monde peut lire/écrire les données de l'école
    // Les utilisateurs s'authentifient via le module auth de l'app
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Pour un mode plus sécurisé avec Firebase Authentication, on pourra mettre à jour les règles dans une prochaine version.

---

## 📂 Structure du projet

```
edusen-v3/
├── public/                  # Assets statiques (icônes PWA)
│   ├── icon-192.png
│   ├── icon-512.png
│   └── favicon.svg
├── src/
│   ├── lib/                 # Modules transverses
│   │   ├── firebase.js      # Config Firebase
│   │   ├── db.js            # Couche d'accès données
│   │   ├── store.js         # Store global (cache)
│   │   ├── sync.js          # Détection en ligne/hors ligne
│   │   ├── auth.js          # Authentification + bcrypt
│   │   ├── constants.js     # Constantes (classes, matières, mois)
│   │   └── ui.js            # Utilitaires UI (toast, format)
│   ├── modules/             # Modules métier
│   │   ├── login.js         # Écran de connexion
│   │   ├── shell.js         # Layout principal
│   │   ├── dashboard.js     # Tableau de bord
│   │   ├── eleves.js        # Gestion des élèves
│   │   ├── bulletins.js     # Bulletins et notes
│   │   ├── emploidutemps.js # Emploi du temps
│   │   ├── presences.js     # Présences/absences
│   │   ├── facturation.js   # Facturation + mensualités
│   │   ├── documents.js     # Documents administratifs
│   │   └── parametres.js    # Paramètres
│   ├── styles/
│   │   └── main.css         # Tailwind + styles personnalisés
│   └── main.js              # Point d'entrée
├── index.html
├── package.json
├── vite.config.js           # Config Vite + PWA
├── tailwind.config.js
├── postcss.config.js
├── netlify.toml             # Config Netlify
├── .env.example
├── .gitignore
└── README.md
```

---

## 🛠️ Commandes utiles

```bash
npm run dev      # Lancer en développement (live reload)
npm run build    # Compiler pour la production
npm run preview  # Tester le build de production
```

---

## ❓ Dépannage

### "Module not found" au démarrage
→ Lance `npm install` à nouveau.

### Page blanche après `npm run dev`
→ Vérifie que ton fichier `.env` est bien rempli (toutes les 6 variables Firebase).

### Erreur Firebase au lancement
→ Va sur la console Firebase et vérifie que **Firestore Database** est activé en mode production.

### Erreur de permission sur Firestore
→ Vérifie que les règles Firestore autorisent la lecture/écriture (voir section Sécurité).

### Le service worker n'est pas actif en dev
→ C'est normal, il ne s'active qu'en mode `build`. Pour tester : `npm run build && npm run preview`.

---

## 📝 Licence

Application interne, libre d'utilisation pour ton école.

---

**Bon démarrage avec EduSen ! 🎓🇸🇳**
