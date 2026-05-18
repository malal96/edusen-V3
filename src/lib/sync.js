// Module de synchronisation et détection de l'état réseau
// Firebase gère automatiquement la synchronisation hors ligne via sa persistance IndexedDB,
// donc on a juste besoin de gérer l'indicateur visuel et les notifications

import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from './firebase.js';

let listeners = [];
let currentStatus = navigator.onLine ? 'online' : 'offline';

/**
 * S'abonner aux changements de statut réseau
 */
export function onStatusChange(callback) {
  listeners.push(callback);
  // Appeler immédiatement avec le statut courant
  callback(currentStatus);
  // Retourner une fonction pour se désabonner
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

function notify(status) {
  currentStatus = status;
  listeners.forEach(cb => cb(status));
}

/**
 * Vérification précise de la connectivité (pas juste navigator.onLine)
 * On essaye de joindre un endpoint léger pour confirmer
 */
async function checkRealConnection() {
  try {
    // Test rapide vers une ressource Google (utilisée par Firebase de toute façon)
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    await fetch('https://www.gstatic.com/generate_204', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

// Écoute des événements natifs du navigateur
window.addEventListener('online', async () => {
  console.log('🌐 Navigateur signale : EN LIGNE');
  // Vérifier qu'on est vraiment connecté
  const isReallyOnline = await checkRealConnection();
  if (isReallyOnline) {
    try {
      await enableNetwork(db);
      console.log('✓ Firebase reconnecté');
    } catch (e) { console.warn('Erreur enableNetwork:', e); }
    notify('online');
  }
});

window.addEventListener('offline', async () => {
  console.log('📵 Navigateur signale : HORS LIGNE');
  notify('offline');
});

// Vérification périodique (toutes les 30 secondes)
// pour détecter les "fausses connexions" (wifi connecté mais sans internet)
setInterval(async () => {
  const isReallyOnline = await checkRealConnection();
  const detected = isReallyOnline ? 'online' : 'offline';
  if (detected !== currentStatus) {
    console.log(`🔄 Statut changé : ${currentStatus} → ${detected}`);
    notify(detected);
  }
}, 30000);

export function getCurrentStatus() {
  return currentStatus;
}
