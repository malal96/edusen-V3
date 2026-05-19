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

  document.getElementById('btn-update-now').onclick = async () => {
    document.getElementById('btn-update-now').textContent = '⏳ Mise à jour...';
    document.getElementById('btn-update-now').disabled = true;
    await updateSW(true);  // true = force reload
  };
  document.getElementById('btn-update-later').onclick = () => {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  };
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
