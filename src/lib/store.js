// Store global qui maintient les données de l'app en mémoire
// Charge depuis Firestore au démarrage, écoute les changements

import { getAll, getSingleton, setOne, setSingleton, deleteOne, listenCollection, cacheGet, cacheSet } from './db.js';
import { DEFAULT_SCHOOL, DEFAULT_CLASSES, DEFAULT_MATIERES, DEFAULT_COEFFICIENTS, DEFAULT_MENSUALITES, DEFAULT_CRENEAUX, trierClassesScolaire } from './constants.js';

// État global (chargé au démarrage)
export const store = {
  school: null,
  classes: [],
  matieres: {},
  coefficients: {},
  mensualitesClasse: {},
  salles: [],
  creneaux: [],
  eleves: [],
  notes: {},       // { eleveId_matiere_trimestre: note }
  presences: {},   // { date_eleveId: { statut, justification } }
  edt: {},         // { classe: { 'Jour_creneauId': { matiere, enseignant, salle } } }
  paiementsInscription: [],  // historique
  mensualitesEleve: {},      // { eleveId: { mois: montant } }
  users: []
};

let initialise = false;
let listeners = [];

export function onStoreChange(callback) {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
}

function notifyChange() {
  listeners.forEach(cb => cb(store));
}

/**
 * Charge toutes les données au démarrage
 */
export async function initStore() {
  if (initialise) return store;

  console.log('📦 Chargement du store...');

  // Charger depuis le cache local (rapide)
  store.school = cacheGet('school') || null;
  store.classes = cacheGet('classes') || [];
  store.matieres = cacheGet('matieres') || {};
  store.coefficients = cacheGet('coefficients') || {};
  store.mensualitesClasse = cacheGet('mensualitesClasse') || {};
  store.salles = cacheGet('salles') || [];
  store.creneaux = cacheGet('creneaux') || [];
  store.eleves = cacheGet('eleves') || [];
  store.notes = cacheGet('notes') || {};
  store.presences = cacheGet('presences') || {};
  store.edt = cacheGet('edt') || {};
  store.paiementsInscription = cacheGet('paiementsInscription') || [];
  store.mensualitesEleve = cacheGet('mensualitesEleve') || {};

  // Charger depuis Firestore (frais)
  try {
    const [school, params, eleves] = await Promise.all([
      getSingleton('school'),
      getSingleton('parametres'),
      getAll('eleves')
    ]);

    if (school) {
      store.school = school;
      cacheSet('school', school);
    } else {
      // Premier démarrage : initialiser
      store.school = { ...DEFAULT_SCHOOL };
      await setSingleton('school', store.school);
      cacheSet('school', store.school);
    }

    if (params) {
      store.classes = params.classes || [...DEFAULT_CLASSES];
      store.matieres = params.matieres || { ...DEFAULT_MATIERES };
      store.coefficients = params.coefficients || { ...DEFAULT_COEFFICIENTS };
      store.mensualitesClasse = params.mensualitesClasse || { ...DEFAULT_MENSUALITES };
      store.salles = params.salles || [];
      store.creneaux = params.creneaux || [...DEFAULT_CRENEAUX];
    } else {
      // Premier démarrage
      store.classes = [...DEFAULT_CLASSES];
      store.matieres = { ...DEFAULT_MATIERES };
      store.coefficients = { ...DEFAULT_COEFFICIENTS };
      store.mensualitesClasse = { ...DEFAULT_MENSUALITES };
      store.salles = [];
      store.creneaux = [...DEFAULT_CRENEAUX];
      await sauvegarderParametres();
    }
    store.classes = trierClassesScolaire(store.classes);

    store.eleves = eleves || [];

    // Cacher
    cacheSet('classes', store.classes);
    cacheSet('matieres', store.matieres);
    cacheSet('coefficients', store.coefficients);
    cacheSet('mensualitesClasse', store.mensualitesClasse);
    cacheSet('salles', store.salles);
    cacheSet('creneaux', store.creneaux);
    cacheSet('eleves', store.eleves);

    // Charger les données secondaires
    const [notes, presences, edt, paiInsc, mensEleve] = await Promise.all([
      getSingleton('notes'), getSingleton('presences'), getSingleton('edt'),
      getSingleton('paiementsInscription'), getSingleton('mensualitesEleve')
    ]);
    if (notes) { store.notes = notes.data || {}; cacheSet('notes', store.notes); }
    if (presences) { store.presences = presences.data || {}; cacheSet('presences', store.presences); }
    if (edt) { store.edt = edt.data || {}; cacheSet('edt', store.edt); }
    if (paiInsc) { store.paiementsInscription = paiInsc.data || []; cacheSet('paiementsInscription', store.paiementsInscription); }
    if (mensEleve) { store.mensualitesEleve = mensEleve.data || {}; cacheSet('mensualitesEleve', store.mensualitesEleve); }

    console.log('✓ Store initialisé');
  } catch (err) {
    console.warn('⚠️ Chargement Firestore échoué (mode hors ligne?), utilisation du cache local', err);
  }

  initialise = true;
  notifyChange();
  return store;
}

// ===== ACTIONS =====
// Note: Les opérations Firestore se font en arrière-plan (sans await)
// pour ne pas bloquer l'UI en cas de hors ligne. Firebase met de toute façon
// les écritures en file d'attente automatiquement et les synchronise plus tard.

export async function sauvegarderEcole(updates) {
  store.school = { ...store.school, ...updates };
  cacheSet('school', store.school);
  notifyChange();
  // Écriture Firestore en arrière-plan (ne bloque pas)
  setSingleton('school', store.school).catch(e => console.warn('Sync school échouée:', e.message));
}

export async function sauvegarderParametres() {
  const params = {
    classes: store.classes,
    matieres: store.matieres,
    coefficients: store.coefficients,
    mensualitesClasse: store.mensualitesClasse,
    salles: store.salles,
    creneaux: store.creneaux
  };
  cacheSet('classes', store.classes);
  cacheSet('matieres', store.matieres);
  cacheSet('coefficients', store.coefficients);
  cacheSet('mensualitesClasse', store.mensualitesClasse);
  cacheSet('salles', store.salles);
  cacheSet('creneaux', store.creneaux);
  notifyChange();
  setSingleton('parametres', params).catch(e => console.warn('Sync paramètres échouée:', e.message));
}

export async function sauvegarderEleve(eleve) {
  const idx = store.eleves.findIndex(e => e.id === eleve.id);
  if (idx === -1) store.eleves.unshift(eleve);
  else store.eleves[idx] = eleve;
  cacheSet('eleves', store.eleves);
  notifyChange();
  setOne('eleves', eleve.id, eleve).catch(e => console.warn('Sync élève échouée:', e.message));
}

export async function supprimerEleve(eleveId) {
  store.eleves = store.eleves.filter(e => e.id !== eleveId);
  cacheSet('eleves', store.eleves);
  if (store.mensualitesEleve[eleveId]) {
    delete store.mensualitesEleve[eleveId];
    cacheSet('mensualitesEleve', store.mensualitesEleve);
    setSingleton('mensualitesEleve', { data: store.mensualitesEleve }).catch(e => console.warn('Sync échouée:', e.message));
  }
  notifyChange();
  deleteOne('eleves', eleveId).catch(e => console.warn('Sync suppression échouée:', e.message));
}

// Helpers pour notes, présences, etc.
export async function sauvegarderNotes() {
  cacheSet('notes', store.notes);
  setSingleton('notes', { data: store.notes }).catch(e => console.warn('Sync notes échouée:', e.message));
}
export async function sauvegarderPresences() {
  cacheSet('presences', store.presences);
  setSingleton('presences', { data: store.presences }).catch(e => console.warn('Sync présences échouée:', e.message));
}
export async function sauvegarderEDT() {
  cacheSet('edt', store.edt);
  setSingleton('edt', { data: store.edt }).catch(e => console.warn('Sync EDT échouée:', e.message));
}
export async function sauvegarderPaiementsInscription() {
  cacheSet('paiementsInscription', store.paiementsInscription);
  setSingleton('paiementsInscription', { data: store.paiementsInscription }).catch(e => console.warn('Sync échouée:', e.message));
}
export async function sauvegarderMensualitesEleve() {
  cacheSet('mensualitesEleve', store.mensualitesEleve);
  setSingleton('mensualitesEleve', { data: store.mensualitesEleve }).catch(e => console.warn('Sync échouée:', e.message));
}

// ===== Génération d'ID =====
export function genererID() {
  const max = store.eleves.reduce((m, e) => {
    const n = parseInt((e.id || 'E000').slice(1));
    return n > m ? n : m;
  }, 0);
  return 'E' + String(max + 1).padStart(3, '0');
}
