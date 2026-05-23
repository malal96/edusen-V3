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

const updateSW = registerSW({
  onNeedRefresh() {
    afficherBanniereUpdate();
  },
  onOfflineReady() {
    console.log('✓ Application prête à fonctionner hors ligne');
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
    // 1. Affiche l'overlay de chargement avec barre de progression
    afficherOverlayMiseAJour();
    // 2. Lance la mise à jour réelle en arrière-plan
    //    updateSW(true) déclenche le téléchargement + skipWaiting + reload
    //    On n'attend PAS la promesse car le reload interrompt naturellement le flux
    updateSW(true);
  };
  document.getElementById('btn-update-later').onclick = () => {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  };
}

/**
 * Affiche un overlay plein écran avec barre de progression animée
 * pendant la mise à jour de l'application.
 *
 * La progression est simulée car le SW ne fournit pas d'événement
 * de progression réel. L'animation s'adapte :
 *  - 0% → 60% en 2s (téléchargement)
 *  - 60% → 90% en 2s (installation)
 *  - 90% → 95% en 2s (préparation, puis bloque)
 *  - 100% atteint juste avant que la page recharge
 *  - Sécurité : reload forcé après 15s si rien ne se passe
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

  const startTime = Date.now();
  let progress = 0;

  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed < 2000) {
      progress = (elapsed / 2000) * 60;
      step.textContent = 'Téléchargement de la nouvelle version...';
    } else if (elapsed < 4000) {
      progress = 60 + ((elapsed - 2000) / 2000) * 30;
      step.textContent = 'Installation des nouveaux fichiers...';
    } else if (elapsed < 6000) {
      progress = 90 + ((elapsed - 4000) / 2000) * 5;
      step.textContent = 'Préparation du redémarrage...';
    } else {
      progress = 95;
      step.textContent = 'Redémarrage imminent...';
    }
    const rounded = Math.min(Math.round(progress), 95);
    fill.style.width = rounded + '%';
    percent.textContent = rounded + '%';
  }, 50);

  // Sécurité : si le reload tarde trop (>15s), force le reload manuellement
  setTimeout(() => {
    clearInterval(interval);
    if (fill) fill.style.width = '100%';
    if (percent) percent.textContent = '100%';
    if (step) step.textContent = 'Rechargement de l\'application...';
    setTimeout(() => window.location.reload(), 500);
  }, 15000);

  // Transition propre juste avant le reload naturel
  window.addEventListener('beforeunload', () => {
    clearInterval(interval);
    if (fill) fill.style.width = '100%';
    if (percent) percent.textContent = '100%';
    if (step) step.textContent = 'Rechargement...';
  });
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
