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
    //    L'overlay attendra le vrai événement "controllerchange" avant de recharger
    afficherOverlayMiseAJour();
    // 2. Lance la mise à jour réelle en arrière-plan
    //    On passe false pour NE PAS recharger automatiquement —
    //    c'est l'overlay qui gère le reload quand le nouveau SW prend le contrôle
    updateSW(false);
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
 * Stratégie :
 *  - Phase 1 (0% → 70%) : progression simulée tant que le SW n'a pas terminé
 *    son téléchargement/installation. Plafonne à 70% en attendant.
 *  - Phase 2 (70% → 95%) : déclenchée par l'événement 'controllerchange'
 *    (= le nouveau SW vient de prendre le contrôle, donc la mise à jour
 *    est réellement appliquée). Animation rapide vers 95%.
 *  - Phase 3 (95% → 100%) : juste avant le reload, transition propre.
 *  - Sécurité : si rien ne se passe en 30s, on force un reload.
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
  let phase = 1;          // 1 = attente SW, 2 = SW actif, 3 = reload
  let swReady = false;    // Devient true quand le nouveau SW a pris le contrôle

  // Met à jour visuellement la barre
  function setProgress(val, message) {
    progress = val;
    const rounded = Math.round(progress);
    if (fill) fill.style.width = rounded + '%';
    if (percent) percent.textContent = rounded + '%';
    if (message && step) step.textContent = message;
  }

  // ===== PHASE 1 : progression simulée tant que le SW travaille =====
  // On monte doucement jusqu'à 70% maximum, puis on attend.
  const phase1Start = Date.now();
  const interval = setInterval(() => {
    if (swReady) return; // Phase 2 prend le relais
    const elapsed = Date.now() - phase1Start;
    if (elapsed < 1500) {
      setProgress((elapsed / 1500) * 40, 'Téléchargement de la nouvelle version...');
    } else if (elapsed < 3500) {
      setProgress(40 + ((elapsed - 1500) / 2000) * 25, 'Installation des nouveaux fichiers...');
    } else {
      // Plafond à 70% — on attend le vrai signal du SW
      setProgress(Math.min(70, progress + 0.1), 'Application des modifications...');
    }
  }, 80);

  // ===== PHASE 2 : déclenchée quand le nouveau SW prend le contrôle =====
  // Cet événement est LE signal fiable que la mise à jour est réellement active.
  let controllerChanged = false;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (controllerChanged) return; // Évite les doublons
      controllerChanged = true;
      swReady = true;
      phase = 2;

      // Animation rapide de la position actuelle vers 95%
      const startProgress = progress;
      const phase2Start = Date.now();
      const phase2Duration = 1000; // 1 seconde pour aller à 95%

      const phase2Interval = setInterval(() => {
        const elapsed = Date.now() - phase2Start;
        if (elapsed >= phase2Duration) {
          clearInterval(phase2Interval);
          clearInterval(interval);
          setProgress(95, 'Finalisation...');

          // ===== PHASE 3 : 100% puis reload =====
          setTimeout(() => {
            setProgress(100, 'Redémarrage de l\'application...');
            setTimeout(() => {
              window.location.reload();
            }, 400);
          }, 300);
        } else {
          const ratio = elapsed / phase2Duration;
          setProgress(startProgress + (95 - startProgress) * ratio, 'Finalisation...');
        }
      }, 30);
    });
  }

  // ===== SÉCURITÉ : si rien ne se passe en 30s, force le reload =====
  setTimeout(() => {
    if (!controllerChanged) {
      clearInterval(interval);
      setProgress(100, 'Rechargement de l\'application...');
      setTimeout(() => window.location.reload(), 500);
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
