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
//  DÉTECTION DES MISES À JOUR PWA
// ========================================
// Stratégie simplifiée :
//  - vite-plugin-pwa est configuré avec workbox.skipWaiting=true et clientsClaim=true
//    → le nouveau SW prend le contrôle IMMÉDIATEMENT dès qu'on l'active
//  - On affiche l'overlay → on appelle updateSW(true) → controllerchange se déclenche
//    presque instantanément → on attend ~3s pour donner un feedback visuel → on recharge

// Référence vers la registration (pour fallback uniquement)
let swRegistration = null;

// Écouteur GLOBAL de controllerchange installé dès le démarrage
let controllerChangeRecu = false;
let onControllerChangeCallback = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('✅ [PWA] controllerchange reçu');
    controllerChangeRecu = true;
    if (typeof onControllerChangeCallback === 'function') {
      onControllerChangeCallback();
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
  }
});

function afficherBanniereUpdate() {
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
 * Affiche un overlay de progression et déclenche la mise à jour.
 *
 * Comme workbox est en skipWaiting:true + clientsClaim:true, l'activation
 * est quasi-immédiate. On a donc une logique simple :
 *  - 0% → 90% en ~2.5s pendant que controllerchange arrive
 *  - 90% → 100% une fois confirmé actif
 *  - reload
 *
 * Sécurité : reload forcé après 10s (au lieu de 30s avant)
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
  let swActive = false;
  let reloadDeja = false;
  let interval = null;

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
    if (interval) clearInterval(interval);

    // Animation finale rapide vers 100%
    const startProgress = progress;
    const finalStart = Date.now();
    const finalDuration = 500;
    const finalInterval = setInterval(() => {
      const elapsed = Date.now() - finalStart;
      if (elapsed >= finalDuration) {
        clearInterval(finalInterval);
        setProgress(100, 'Redémarrage de l\'application...');
        setTimeout(() => window.location.reload(), 300);
      } else {
        const ratio = elapsed / finalDuration;
        setProgress(startProgress + (100 - startProgress) * ratio, 'Redémarrage de l\'application...');
      }
    }, 30);
  }

  // ===== Callback déclenché quand le SW devient actif =====
  function onSWActif(raison) {
    if (swActive || reloadDeja) return;
    swActive = true;
    console.log(`✅ [PWA] SW actif détecté (${raison})`);
    // Petit délai pour que l'utilisateur voie l'animation atteindre 100%
    setTimeout(() => effectuerReloadFinal(raison), 200);
  }

  // ===== Si controllerchange est DÉJÀ arrivé avant l'overlay =====
  if (controllerChangeRecu) {
    console.log('ℹ️ [PWA] controllerchange déjà reçu avant l\'overlay');
    setProgress(50, 'Application des modifications...');
    setTimeout(() => onSWActif('déjà reçu'), 300);
    return;
  }
  // S'abonner pour le futur
  onControllerChangeCallback = () => onSWActif('controllerchange');

  // ===== ANIMATION DE PROGRESSION =====
  // Avec skipWaiting actif, le SW devrait être actif en < 2s
  // On anime jusqu'à 90% en 2.5s, puis on attend le signal pour finir
  const startTime = Date.now();
  interval = setInterval(() => {
    if (swActive || reloadDeja) return;
    const elapsed = Date.now() - startTime;
    if (elapsed < 1000) {
      setProgress((elapsed / 1000) * 50, 'Téléchargement de la nouvelle version...');
    } else if (elapsed < 2000) {
      setProgress(50 + ((elapsed - 1000) / 1000) * 30, 'Installation des nouveaux fichiers...');
    } else if (elapsed < 3000) {
      setProgress(80 + ((elapsed - 2000) / 1000) * 10, 'Activation de la nouvelle version...');
    } else {
      // Plafond à 90%, en attendant le signal
      setProgress(Math.min(90, progress + 0.05), 'Activation de la nouvelle version...');
    }
  }, 50);

  // ===== DÉCLENCHER LA MISE À JOUR =====
  // updateSW(true) avec skipWaiting actif → activation immédiate
  setTimeout(async () => {
    try {
      // Tentative 1 : envoyer SKIP_WAITING directement (au cas où)
      if (swRegistration && swRegistration.waiting) {
        console.log('📤 [PWA] Envoi de SKIP_WAITING au SW en attente');
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      // Tentative 2 : updateSW gère tout (skipWaiting + reload via vite-plugin-pwa)
      console.log('📤 [PWA] Appel de updateSW(true)');
      updateSW(true);
    } catch (err) {
      console.error('❌ [PWA] Erreur :', err);
    }
  }, 150);

  // ===== POLLING DE SÉCURITÉ : vérifie si le controller a déjà changé =====
  // Avec clientsClaim, le SW prend le contrôle dès activation → on le détecte rapidement
  let urlInitiale = null;
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    urlInitiale = navigator.serviceWorker.controller.scriptURL;
  }
  const pollInterval = setInterval(() => {
    if (swActive || reloadDeja) { clearInterval(pollInterval); return; }
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const urlActuelle = navigator.serviceWorker.controller.scriptURL;
      // Si l'URL du controller a changé OU si on n'avait pas de controller au début
      if ((urlInitiale && urlActuelle !== urlInitiale) || !urlInitiale) {
        clearInterval(pollInterval);
        onSWActif('polling: controller URL changée');
      }
    }
  }, 300);

  // ===== SÉCURITÉ : reload forcé après 10s (au lieu de 30s) =====
  // Avec skipWaiting actif, ça devrait être beaucoup plus rapide
  setTimeout(() => {
    if (!swActive && !reloadDeja) {
      console.warn('⚠️ [PWA] Timeout 10s — reload forcé');
      clearInterval(pollInterval);
      effectuerReloadFinal('timeout 10s');
    }
  }, 10000);
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
