// Module d'authentification EduSen
// Les mots de passe sont hashés avec PBKDF2 via la Web Crypto API du navigateur
// (native dans tous les navigateurs modernes, pas besoin de dépendance externe)

import { getAll, getOne, setOne, deleteOne } from './db.js';

const COLLECTION = 'users';
const SESSION_KEY = 'edusen_session';
const PBKDF2_ITERATIONS = 100000;

// ============================
//  HASH DES MOTS DE PASSE (Web Crypto API)
// ============================

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export async function hashPassword(plaintext) {
  // Génère un sel aléatoire de 16 bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Importer le mot de passe en clé
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(plaintext),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Dériver une clé via PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes
  );

  const hashBytes = new Uint8Array(derivedBits);
  // Format : "salt_hex:hash_hex"
  return bytesToHex(salt) + ':' + bytesToHex(hashBytes);
}

export async function verifyPassword(plaintext, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  try {
    const [saltHex, hashHex] = storedHash.split(':');
    const salt = hexToBytes(saltHex);

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(plaintext),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    const computedHex = bytesToHex(new Uint8Array(derivedBits));
    return computedHex === hashHex;
  } catch (e) {
    console.error('Erreur verifyPassword:', e);
    return false;
  }
}

// ============================
//  GESTION DES UTILISATEURS
// ============================

export async function getAllUsers() {
  return getAll(COLLECTION);
}

export async function getUserById(id) {
  return getOne(COLLECTION, id);
}

export async function getUserByLogin(login) {
  const users = await getAll(COLLECTION);
  return users.find(u => u.login === login) || null;
}

/**
 * Créer un nouvel utilisateur
 * Le mot de passe en clair est hashé automatiquement
 */
export async function createUser({ login, nom, role, motdepasse, assignations = [], pageAccueil }) {
  const existing = await getUserByLogin(login);
  if (existing) throw new Error('Un compte avec cet identifiant existe déjà');

  const codeRecuperation = genererCodeRecup();
  const hashedPwd = await hashPassword(motdepasse);
  const id = 'U' + Date.now().toString(36).toUpperCase();

  const user = {
    id, login, nom, role, assignations,
    motdepasseHash: hashedPwd,
    codeRecuperation,
    pageAccueil,
    dateCreation: new Date().toISOString()
  };

  await setOne(COLLECTION, id, user);
  return user;
}

export async function updateUser(id, updates) {
  if (updates.motdepasse) {
    updates.motdepasseHash = await hashPassword(updates.motdepasse);
    delete updates.motdepasse;
  }
  await setOne(COLLECTION, id, updates);
}

// Régénère et sauvegarde un nouveau code de récupération pour un utilisateur
// Retourne le nouveau code (à afficher à l'admin pour qu'il le note)
export async function regenererCodeRecuperation(id) {
  const nouveauCode = genererCodeRecup();
  await setOne(COLLECTION, id, { codeRecuperation: nouveauCode });
  return nouveauCode;
}

/**
 * Permet à un utilisateur de changer son propre mot de passe
 * Vérifie d'abord l'ancien mot de passe avant le changement
 * Retourne { success, error? }
 */
export async function changerMotDePasse(userId, ancienMdp, nouveauMdp) {
  const user = await getUserById(userId);
  if (!user) return { success: false, error: 'Utilisateur introuvable' };

  // Vérifier l'ancien mot de passe
  const ok = await verifyPassword(ancienMdp, user.motdepasseHash);
  if (!ok) return { success: false, error: 'Mot de passe actuel incorrect' };

  // Vérifier que le nouveau est différent de l'ancien
  const meme = await verifyPassword(nouveauMdp, user.motdepasseHash);
  if (meme) return { success: false, error: 'Le nouveau mot de passe doit être différent de l\'ancien' };

  // Hasher et sauvegarder
  const nouveauHash = await hashPassword(nouveauMdp);
  await setOne(COLLECTION, userId, { motdepasseHash: nouveauHash });
  return { success: true };
}

export async function deleteUser(id) {
  return deleteOne(COLLECTION, id);
}

function genererCodeRecup() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ============================
//  LOGIN / LOGOUT
// ============================

export async function login(loginInput, motdepasse) {
  const user = await getUserByLogin(loginInput.trim().toLowerCase());
  if (!user) return { success: false, error: 'Identifiant ou mot de passe incorrect' };
  const ok = await verifyPassword(motdepasse, user.motdepasseHash);
  if (!ok) return { success: false, error: 'Identifiant ou mot de passe incorrect' };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, login: user.login, role: user.role, nom: user.nom }));
  return { success: true, user };
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getCurrentSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}

export async function getCurrentUser() {
  const sess = getCurrentSession();
  if (!sess) return null;
  return getUserById(sess.id);
}

// ============================
//  RÉCUPÉRATION DE MOT DE PASSE
// ============================

export async function resetPasswordWithCode(login, code, nouveauMotdepasse) {
  const user = await getUserByLogin(login.trim().toLowerCase());
  if (!user) return { success: false, error: 'Aucun compte avec cet identifiant' };
  if (user.codeRecuperation !== code.trim().toUpperCase()) {
    return { success: false, error: 'Code de récupération incorrect' };
  }
  const hashedPwd = await hashPassword(nouveauMotdepasse);
  const newCode = genererCodeRecup();
  await setOne(COLLECTION, user.id, {
    motdepasseHash: hashedPwd,
    codeRecuperation: newCode
  });
  return { success: true, nouveauCode: newCode };
}

// ============================
//  INITIALISATION (premier lancement)
// ============================

export async function initialiserAdminParDefaut() {
  const users = await getAllUsers();
  if (users.length > 0) return null;

  console.log('⚙️ Premier démarrage : création de l\'admin par défaut...');
  const admin = await createUser({
    login: 'admin',
    nom: 'Administrateur',
    role: 'admin',
    motdepasse: 'admin123',
    pageAccueil: 'dashboard'
  });
  console.log('✓ Admin créé. Login: admin / Mot de passe: admin123');
  console.log(`✓ Code de récupération: ${admin.codeRecuperation}`);
  return admin;
}
