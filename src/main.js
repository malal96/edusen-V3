// Point d'entrée de l'application EduSen v3
// Importe Firebase, gère l'auth et lance l'interface

import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';
import { initialiserAdminParDefaut, getCurrentSession, getCurrentUser, login, logout } from './lib/auth.js';
import { onStatusChange, getCurrentStatus } from './lib/sync.js';
import { afficherEcranLogin } from './modules/login.js';
import { afficherApp } from './modules/shell.js';
import { toast } from './lib/ui.js';

// État global de l'application
window.EduSen = {
  currentUser: null,
  onlineStatus: 'online'
};

// ========================================
//  DÉTECTION DES MISES À JOUR PWA (Option B)
// ========================================
// Quand une nouvelle version de l'app est déployée, on affiche une bannière
// "Nouvelle version disponible" avec un bouton "Mettre à jour"

// Référence vers le registration du Service Worker
let swRegistration = null;

// Écouteur GLOBAL de controllerchange — installé dès le démarrage de l'app
// pour ne JAMAIS rater l'événement (qui peut arriver très vite après skipWaiting).
// Quand l'overlay s'affichera, il consultera juste ces variables.
let controllerChangeRecu = false;
let onControllerChangeOverlay = null;  // callback à appeler quand l'overlay est ouvert

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('✅ [PWA] controllerchange reçu');
    controllerChangeRecu = true;
    // Si l'overlay est ouvert et attend ce signal, on le notifie
    if (typeof onControllerChangeOverlay === 'function') {
      onControllerChangeOverlay();
    }
  });
}

const updateSW = registerSW({
  onNeedRefresh() {
    console.log('🔄 [PWA] Nouvelle version détectée');
    afficherBanniereUpdate();
  },
  onOfflineReady() {
    console.log('✓ Application prête à fonctionner hors ligne');
  },
  onRegisteredSW(swUrl, registration) {
    swRegistration = registration;
    console.log('✓ [PWA] Service Worker enregistré');

    // Suit les transitions d'état du SW en attente (pour les logs et le fallback)
    if (registration) {
      registration.addEventListener('updatefound', () => {
        const newSW = registration.installing;
        console.log('🔄 [PWA] updatefound — nouvelle installation');
        if (newSW) {
          newSW.addEventListener('statechange', () => {
            console.log(`📊 [PWA] État SW : ${newSW.state}`);
          });
        }
      });
    }
  }
});

function afficherBanniereUpdate() {
  // Éviter les doublons
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.innerHTML = `
    <div class="update-banner-content">
      <span style="font-size:1.2rem">🔄</span>
      <span>Une nouvelle version d'EduSen est disponible</span>
      <button id="btn-update-now" class="btn-update-now">Mettre à jour</button>
      <button id="btn-update-later" class="btn-update-later" aria-label="Plus tard">×</button>
    </div>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.classList.add('show'), 100);

  document.getElementById('btn-update-now').onclick = () => {
    console.log('🔄 [PWA] Bouton "Mettre à jour" cliqué');
    afficherOverlayMiseAJour();
  };
  document.getElementById('btn-update-later').onclick = () => {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  };
}

/**
 * Affiche un overlay de progression et orchestre la mise à jour PWA.
 *
 * Stratégie finale :
 *  1. Phase A (0% → 50%) : animation rapide pendant l'envoi de SKIP_WAITING
 *  2. Phase B (50% → 90%) : polling sur registration.active.scriptURL
 *     pour détecter quand le nouveau SW a vraiment pris le contrôle.
 *     On guette aussi controllerchange en parallèle (double sécurité).
 *  3. Phase C (90% → 100%) : reload contrôlé une fois le nouveau SW actif.
 *
 *  CLEFS : on n'écoute PAS controllerchange ici (déjà fait globalement),
 *  on lit juste la variable controllerChangeRecu et on observe activement
 *  l'état de la registration.
 */
function afficherOverlayMiseAJour() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.classList.remove('show');
  if (document.getElementById('update-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'update-overlay';
  overlay.className = 'update-overlay';
  overlay.innerHTML = `
    <div class="update-overlay-card">
      <div class="update-overlay-spinner">
        <div class="update-spinner-circle"></div>
      </div>
      <h2 class="update-overlay-title">Mise à jour en cours</h2>
      <p class="update-overlay-subtitle" id="update-overlay-step">
        Téléchargement de la nouvelle version...
      </p>
      <div class="update-progress-bar">
        <div class="update-progress-fill" id="update-progress-fill"></div>
      </div>
      <div class="update-progress-percent" id="update-progress-percent">0%</div>
      <p class="update-overlay-info">
        ⏳ Veuillez patienter, ne fermez pas l'application
      </p>
    </div>
  `;
  document.body.appendChild(overlay);

  const fill = document.getElementById('update-progress-fill');
  const percent = document.getElementById('update-progress-percent');
  const step = document.getElementById('update-overlay-step');

  let progress = 0;
  let swActive = false;        // Devient true quand le nouveau SW est confirmé actif
  let reloadDeja = false;
  let intervalPhase1 = null;
  let intervalPhase2 = null;

  function setProgress(val, message) {
    progress = val;
    const rounded = Math.round(progress);
    if (fill) fill.style.width = rounded + '%';
    if (percent) percent.textContent = rounded + '%';
    if (message && step) step.textContent = message;
  }

  function effectuerReloadFinal(raison) {
    if (reloadDeja) return;
    reloadDeja = true;
    console.log(`🔄 [PWA] Reload final (${raison})`);
    if (intervalPhase1) clearInterval(intervalPhase1);
    if (intervalPhase2) clearInterval(intervalPhase2);
    setProgress(100, 'Redémarrage de l\'application...');
    setTimeout(() => window.location.reload(), 400);
  }

  // ===== Fonction appelée quand le nouveau SW est CONFIRMÉ actif =====
  function passerEnPhaseFinale(raison) {
    if (swActive || reloadDeja) return;
    swActive = true;
    console.log(`✅ [PWA] SW confirmé actif (${raison})`);

    if (intervalPhase1) clearInterval(intervalPhase1);

    // Animation rapide de la position actuelle vers 95%
    const startProgress = progress;
    const phase2Start = Date.now();
    const phase2Duration = 800;

    intervalPhase2 = setInterval(() => {
      const elapsed = Date.now() - phase2Start;
      if (elapsed >= phase2Duration) {
        clearInterval(intervalPhase2);
        setProgress(95, 'Finalisation...');
        setTimeout(() => effectuerReloadFinal(raison), 300);
      } else {
        const ratio = elapsed / phase2Duration;
        setProgress(startProgress + (95 - startProgress) * ratio, 'Finalisation...');
      }
    }, 30);
  }

  // ===== Branchement sur l'écouteur global controllerchange =====
  // Si l'événement est DÉJÀ arrivé avant l'ouverture de l'overlay → on enchaîne tout de suite
  if (controllerChangeRecu) {
    console.log('ℹ️ [PWA] controllerchange déjà reçu avant l\'overlay');
    setProgress(50, 'Application des modifications...');
    setTimeout(() => passerEnPhaseFinale('controllerchange déjà reçu'), 300);
    return;
  }
  // Sinon, on s'abonne pour être notifié quand il arrivera
  onControllerChangeOverlay = () => passerEnPhaseFinale('controllerchange');

  // ===== PHASE 1 : animation pendant l'activation du SW =====
  // On monte doucement jusqu'à 85% maximum, en attendant un des signaux.
  // Plus généreux que 70% car parfois le SW met du temps mais finit par bien s'activer.
  const phase1Start = Date.now();
  intervalPhase1 = setInterval(() => {
    if (swActive || reloadDeja) return;
    const elapsed = Date.now() - phase1Start;
    if (elapsed < 1500) {
      setProgress((elapsed / 1500) * 40, 'Téléchargement de la nouvelle version...');
    } else if (elapsed < 3500) {
      setProgress(40 + ((elapsed - 1500) / 2000) * 25, 'Installation des nouveaux fichiers...');
    } else if (elapsed < 6000) {
      setProgress(65 + ((elapsed - 3500) / 2500) * 15, 'Application des modifications...');
    } else {
      // Plafond à 85% — on attend le vrai signal
      setProgress(Math.min(85, progress + 0.05), 'Activation de la nouvelle version...');
    }
  }, 80);

  // ===== DÉCLENCHER L'ACTIVATION DU SW EN ATTENTE =====
  // On envoie SKIP_WAITING au SW waiting → il devient actif → controllerchange se déclenche
  setTimeout(async () => {
    try {
      let swEnvoye = false;

      // Tentative 1 : registration mémorisée
      if (swRegistration && swRegistration.waiting) {
        console.log('📤 [PWA] Envoi de SKIP_WAITING au SW en attente');
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        swEnvoye = true;
      }

      // Tentative 2 : récupération fraîche de la registration
      if (!swEnvoye && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) {
          console.log('📤 [PWA] Envoi de SKIP_WAITING (via getRegistration)');
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          swEnvoye = true;
        }
      }

      if (!swEnvoye) {
        console.warn('⚠️ [PWA] Aucun SW en attente trouvé, tentative via updateSW()');
      }

      // Tentative 3 : appeler updateSW de vite-plugin-pwa qui fera son propre skipWaiting
      console.log('📤 [PWA] Appel de updateSW()');
      updateSW(true);
    } catch (err) {
      console.error('❌ [PWA] Erreur lors de la mise à jour :', err);
    }
  }, 200);

  // ===== POLLING DE SÉCURITÉ : surveille l'état réel du SW =====
  // Toutes les 500ms on vérifie si le contrôleur a changé OU si registration.waiting
  // a disparu (= le SW en attente est devenu actif).
  let urlControleurInitial = null;
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    urlControleurInitial = navigator.serviceWorker.controller.scriptURL;
  }

  const pollInterval = setInterval(async () => {
    if (swActive || reloadDeja) {
      clearInterval(pollInterval);
      return;
    }
    try {
      if ('serviceWorker' in navigator) {
        // Vérif 1 : le controller a changé d'URL ?
        const ctrl = navigator.serviceWorker.controller;
        if (ctrl && urlControleurInitial && ctrl.scriptURL !== urlControleurInitial) {
          clearInterval(pollInterval);
          passerEnPhaseFinale('polling: controller URL change');
          return;
        }
        // Vérif 2 : plus de SW en attente (= il est devenu actif)
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && !reg.waiting && reg.active) {
          // S'il y avait un waiting au départ et qu'il n'y en a plus, c'est bon signe
          if (swRegistration && swRegistration.waiting === reg.active) {
            clearInterval(pollInterval);
            passerEnPhaseFinale('polling: waiting devenu active');
            return;
          }
        }
      }
    } catch (err) {
      // Ignore, on continue à poller
    }
  }, 500);

  // ===== SÉCURITÉ FINALE : si rien après 20s, reload forcé =====
  // Réduit de 30s à 20s car le polling devrait détecter rapidement
  setTimeout(() => {
    if (!swActive && !reloadDeja) {
      console.warn('⚠️ [PWA] Timeout 20s — reload forcé');
      clearInterval(pollInterval);
      effectuerReloadFinal('timeout 20s');
    }
  }, 20000);
}

// ========================================
//  POINT D'ENTRÉE
// ========================================

async function init() {
  console.log('🚀 EduSen v3 démarre...');

  try {
    // 1. Créer l'admin par défaut si premier démarrage
    await initialiserAdminParDefaut();

    // 2. Vérifier si une session existe
    const session = getCurrentSession();
    if (session) {
      const user = await getCurrentUser();
      if (user) {
        window.EduSen.currentUser = user;
        afficherApp();
      } else {
        afficherEcranLogin();
      }
    } else {
      afficherEcranLogin();
    }

    // 3. Démarrer la surveillance du statut réseau
    onStatusChange((status) => {
      window.EduSen.onlineStatus = status;
      mettreAJourIndicateurStatut(status);
      if (status === 'online') {
        toast('Connexion rétablie — synchronisation en cours', 'success');
      } else {
        toast('Mode hors ligne — vos modifications seront synchronisées plus tard', 'info');
      }
    });

  } catch (err) {
    console.error('❌ Erreur lors du démarrage :', err);
    document.getElementById('app').innerHTML = `
      <div style="padding:40px;text-align:center;color:#e05252">
        <h2>Erreur de démarrage</h2>
        <p>${err.message}</p>
        <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;background:#1a4731;color:#fff;border:none;border-radius:6px;cursor:pointer">Réessayer</button>
      </div>`;
  } finally {
    // Masquer l'écran de chargement
    const loading = document.getElementById('loading-screen');
    if (loading) loading.style.display = 'none';
  }
}

function mettreAJourIndicateurStatut(status) {
  const el = document.getElementById('status-indicator');
  if (!el) return;
  el.className = `status-indicator ${status}`;
  el.innerHTML = `
    <span class="status-dot ${status === 'online' ? '' : 'pulse'}"></span>
    <span>${status === 'online' ? 'En ligne' : 'Hors ligne'}</span>
  `;
}

// Exposer pour debug
window.EduSenDebug = { init, login, logout, getCurrentUser };

// Démarrer
init();
