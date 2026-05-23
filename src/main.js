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

// Référence vers le registration du Service Worker (récupérée à l'enregistrement)
// Permet d'accéder au SW "waiting" pour lui envoyer un message SKIP_WAITING
let swRegistration = null;

const updateSW = registerSW({
  onNeedRefresh() {
    console.log('🔄 [PWA] Nouvelle version détectée');
    afficherBanniereUpdate();
  },
  onOfflineReady() {
    console.log('✓ Application prête à fonctionner hors ligne');
  },
  onRegisteredSW(swUrl, registration) {
    // Sauvegarde la registration pour pouvoir accéder à registration.waiting plus tard
    swRegistration = registration;
    console.log('✓ [PWA] Service Worker enregistré');
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
  // Animation d'entrée
  setTimeout(() => banner.classList.add('show'), 100);

  document.getElementById('btn-update-now').onclick = () => {
    console.log('🔄 [PWA] Bouton "Mettre à jour" cliqué');
    // Affiche l'overlay et déclenche réellement la mise à jour
    afficherOverlayMiseAJour();
  };
  document.getElementById('btn-update-later').onclick = () => {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  };
}

/**
 * Affiche un overlay plein écran avec barre de progression synchronisée
 * avec le VRAI cycle de vie du Service Worker.
 *
 * Stratégie correcte pour registerType: 'prompt' :
 *  1. Quand onNeedRefresh est déclenché, le nouveau SW est déjà installé
 *     et se trouve en état "waiting" (registration.waiting).
 *  2. On bloque le rechargement automatique de vite-plugin-pwa en
 *     interceptant 'controllerchange' AVANT que le SW prenne le contrôle.
 *  3. On envoie un message SKIP_WAITING au SW en attente → il s'active.
 *  4. L'événement 'controllerchange' se déclenche → on finit la barre à 100%
 *     puis on recharge MANUELLEMENT la page.
 *
 *  - Phase 1 (0% → 70%) : pendant l'activation du nouveau SW
 *  - Phase 2 (70% → 95%) : controllerchange reçu = nouveau SW actif ✅
 *  - Phase 3 (95% → 100%) : reload contrôlé
 *  - Sécurité : reload forcé après 30s si rien ne se passe
 */
function afficherOverlayMiseAJour() {
  // Masque la bannière
  const banner = document.getElementById('update-banner');
  if (banner) banner.classList.remove('show');

  // Évite les doublons
  if (document.getElementById('update-overlay')) return;

  // Crée l'overlay
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
  let controllerChanged = false;
  let reloadDeja = false;

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
    setProgress(100, 'Redémarrage de l\'application...');
    setTimeout(() => window.location.reload(), 400);
  }

  // ===== ÉTAPE A : écouter 'controllerchange' AVANT de déclencher la mise à jour =====
  // Cet événement = le nouveau SW vient de prendre le contrôle de la page.
  // C'est LE signal fiable que la mise à jour est réellement appliquée.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (controllerChanged) return;
      controllerChanged = true;
      console.log('✅ [PWA] controllerchange reçu — nouveau SW actif');

      // Phase 2 : animation rapide vers 95%
      clearInterval(interval);
      const startProgress = progress;
      const phase2Start = Date.now();
      const phase2Duration = 800;

      const phase2Interval = setInterval(() => {
        const elapsed = Date.now() - phase2Start;
        if (elapsed >= phase2Duration) {
          clearInterval(phase2Interval);
          setProgress(95, 'Finalisation...');
          setTimeout(() => effectuerReloadFinal('controllerchange'), 300);
        } else {
          const ratio = elapsed / phase2Duration;
          setProgress(startProgress + (95 - startProgress) * ratio, 'Finalisation...');
        }
      }, 30);
    });
  }

  // ===== PHASE 1 : progression simulée pendant l'activation du SW =====
  const phase1Start = Date.now();
  const interval = setInterval(() => {
    if (controllerChanged) return;
    const elapsed = Date.now() - phase1Start;
    if (elapsed < 1500) {
      setProgress((elapsed / 1500) * 40, 'Téléchargement de la nouvelle version...');
    } else if (elapsed < 3500) {
      setProgress(40 + ((elapsed - 1500) / 2000) * 25, 'Installation des nouveaux fichiers...');
    } else {
      setProgress(Math.min(70, progress + 0.1), 'Application des modifications...');
    }
  }, 80);

  // ===== ÉTAPE B : déclencher l'activation du SW en attente =====
  // On envoie un message SKIP_WAITING directement au SW "waiting" si on le trouve.
  // En parallèle, on appelle updateSW() qui fait la même chose côté vite-plugin-pwa.
  setTimeout(async () => {
    try {
      // Tentative 1 : envoyer SKIP_WAITING directement au SW waiting
      if (swRegistration && swRegistration.waiting) {
        console.log('📤 [PWA] Envoi de SKIP_WAITING au SW en attente');
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else if ('serviceWorker' in navigator) {
        // Fallback : récupère la registration actuelle si swRegistration n'est pas dispo
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) {
          console.log('📤 [PWA] Envoi de SKIP_WAITING (via getRegistration)');
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          console.warn('⚠️ [PWA] Aucun SW en attente trouvé');
        }
      }

      // Tentative 2 : utiliser l'API de vite-plugin-pwa (déclenche aussi skipWaiting en interne)
      // On utilise updateSW(true) mais on a déjà notre propre gestionnaire de reload via controllerchange
      console.log('📤 [PWA] Appel de updateSW()');
      updateSW(true);
    } catch (err) {
      console.error('❌ [PWA] Erreur lors de la mise à jour :', err);
    }
  }, 200);

  // ===== SÉCURITÉ : si controllerchange ne se déclenche pas en 30s, reload forcé =====
  setTimeout(() => {
    if (!controllerChanged && !reloadDeja) {
      console.warn('⚠️ [PWA] Timeout 30s — reload forcé');
      clearInterval(interval);
      effectuerReloadFinal('timeout 30s');
    }
  }, 30000);
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
