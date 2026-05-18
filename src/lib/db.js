// Couche d'accès données EduSen
// Cette couche unifie Firestore (cloud) avec un cache local automatique
// Firebase gère lui-même la persistance hors ligne via IndexedDB

import { db } from './firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';

// ============================
//  CRUD GÉNÉRIQUE
// ============================

/**
 * Lire toute une collection
 * @param {string} collectionName - Ex: 'eleves', 'classes', 'school'
 * @returns {Promise<Array>} - Liste des documents
 */
export async function getAll(collectionName) {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(`Erreur getAll(${collectionName}):`, err);
    return [];
  }
}

/**
 * Lire un document
 * @param {string} collectionName
 * @param {string} docId
 * @returns {Promise<Object|null>}
 */
export async function getOne(collectionName, docId) {
  try {
    const snap = await getDoc(doc(db, collectionName, docId));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
  } catch (err) {
    console.error(`Erreur getOne(${collectionName}/${docId}):`, err);
    return null;
  }
}

/**
 * Créer ou mettre à jour un document (upsert)
 * Si docId n'est pas fourni, Firestore génère un ID
 */
export async function setOne(collectionName, docId, data) {
  try {
    const cleanData = { ...data };
    delete cleanData.id; // Ne pas stocker l'ID dans le document lui-même
    await setDoc(doc(db, collectionName, docId), cleanData, { merge: true });
    return { id: docId, ...cleanData };
  } catch (err) {
    console.error(`Erreur setOne(${collectionName}/${docId}):`, err);
    throw err;
  }
}

/**
 * Supprimer un document
 */
export async function deleteOne(collectionName, docId) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
    return true;
  } catch (err) {
    console.error(`Erreur deleteOne(${collectionName}/${docId}):`, err);
    return false;
  }
}

/**
 * Écouter en temps réel une collection (changements live)
 * @param {string} collectionName
 * @param {Function} callback - Reçoit la liste mise à jour
 * @returns {Function} - Fonction pour arrêter l'écoute
 */
export function listenCollection(collectionName, callback) {
  return onSnapshot(
    collection(db, collectionName),
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (err) => console.error(`Erreur listen(${collectionName}):`, err)
  );
}

/**
 * Requête filtrée (ex: élèves d'une classe)
 */
export async function getWhere(collectionName, field, op, value) {
  try {
    const q = query(collection(db, collectionName), where(field, op, value));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(`Erreur getWhere(${collectionName}):`, err);
    return [];
  }
}

// ============================
//  DOCUMENT SINGLETON
// ============================
// Pour les données uniques comme "school" (info de l'école), on utilise toujours l'ID "main"

/**
 * Lire le document singleton (école, paramètres)
 */
export async function getSingleton(collectionName) {
  return getOne(collectionName, 'main');
}

/**
 * Sauvegarder le document singleton
 */
export async function setSingleton(collectionName, data) {
  return setOne(collectionName, 'main', data);
}

// ============================
//  CACHE LOCAL (pour démarrage rapide)
// ============================
// On garde aussi une copie dans localStorage pour le démarrage instantané

const CACHE_PREFIX = 'edusen_cache_';

export function cacheGet(key) {
  try {
    const v = localStorage.getItem(CACHE_PREFIX + key);
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}

export function cacheSet(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch (e) { /* QuotaExceeded */ }
}

export function cacheClear(key) {
  try {
    if (key) localStorage.removeItem(CACHE_PREFIX + key);
    else {
      Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    }
  } catch (e) {}
}
