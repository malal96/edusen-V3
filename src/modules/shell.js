// Layout principal de l'application
import { logout, getCurrentUser } from '../lib/auth.js';
import { getCurrentStatus } from '../lib/sync.js';
import { afficherEcranLogin } from './login.js';
import { afficherDashboard } from './dashboard.js';
import { afficherEleves } from './eleves.js';
import { afficherBulletins } from './bulletins.js';
import { afficherEDT } from './emploidutemps.js';
import { afficherPresences } from './presences.js';
import { afficherFacturation } from './facturation.js';
import { afficherDocuments } from './documents.js';
import { afficherParametres } from './parametres.js';
import { toast } from '../lib/ui.js';

const ONGLETS = {
  dashboard:     { label: 'Tableau de bord', icon: '📊', render: afficherDashboard, roles: ['admin','gestionnaire'] },
  eleves:        { label: 'Élèves',          icon: '👨‍🎓', render: afficherEleves,    roles: ['admin','gestionnaire','enseignant'] },
  bulletins:     { label: 'Bulletins',       icon: '📝', render: afficherBulletins, roles: ['admin','gestionnaire','enseignant'] },
  emploidutemps: { label: 'Emploi du temps', icon: '📅', render: afficherEDT,       roles: ['admin','gestionnaire','enseignant'] },
  presences:     { label: 'Présences',       icon: '✅', render: afficherPresences, roles: ['admin','enseignant'] },
  facturation:   { label: 'Facturation',     icon: '💰', render: afficherFacturation, roles: ['admin','gestionnaire'] },
  documents:     { label: 'Documents',       icon: '📄', render: afficherDocuments,  roles: ['admin','gestionnaire'] },
  parametres:    { label: 'Paramètres',      icon: '⚙️', render: afficherParametres, roles: ['admin','gestionnaire','enseignant'] }
};

let ongletActif = null;

export function afficherApp() {
  const user = window.EduSen.currentUser;
  if (!user) { afficherEcranLogin(); return; }

  // Onglets visibles selon le rôle
  const ongletsVisibles = Object.entries(ONGLETS).filter(([id, o]) => o.roles.includes(user.role));
  const pageAccueil = user.pageAccueil || 'dashboard';
  if (!ongletsVisibles.find(([id]) => id === pageAccueil)) {
    ongletActif = ongletsVisibles[0]?.[0] || 'parametres';
  } else {
    ongletActif = pageAccueil;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-shell">
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">🎓 EduSen</div>
        <nav class="sidebar-nav">
          ${ongletsVisibles.map(([id, o]) => `
            <button data-onglet="${id}" class="${id === ongletActif ? 'active' : ''}">
              <span>${o.icon}</span> <span>${o.label}</span>
            </button>
          `).join('')}
        </nav>
        <div style="margin-top:auto;padding-top:24px;border-top:1px solid rgba(255,255,255,0.1);margin-top:32px">
          <div style="font-size:.8rem;color:rgba(255,255,255,0.7);margin-bottom:4px">${user.nom}</div>
          <div style="font-size:.7rem;color:rgba(255,255,255,0.5);text-transform:capitalize;margin-bottom:12px">${user.role}</div>
          <button id="btn-logout" style="background:rgba(255,255,255,0.1);color:#fff;border:none;padding:8px 12px;border-radius:6px;font-size:.8rem;width:100%;cursor:pointer">🚪 Déconnexion</button>
        </div>
      </aside>
      <main class="main-content">
        <div class="topbar">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">
            <button id="btn-burger" class="btn-burger" aria-label="Menu">☰</button>
            <h1 class="topbar-title" id="page-title" style="margin:0">Chargement...</h1>
          </div>
          <div class="topbar-meta">
            <span id="status-indicator" class="status-indicator ${getCurrentStatus()}">
              <span class="status-dot ${getCurrentStatus() === 'online' ? '' : 'pulse'}"></span>
              <span>${getCurrentStatus() === 'online' ? 'En ligne' : 'Hors ligne'}</span>
            </span>
          </div>
        </div>
        <div id="page-content"></div>
      </main>
    </div>
  `;

  // Events
  document.querySelectorAll('[data-onglet]').forEach(btn => {
    btn.onclick = () => {
      naviguer(btn.dataset.onglet);
      // Fermer la sidebar sur mobile après navigation
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('open');
    };
  });
  document.getElementById('btn-logout').onclick = () => {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      logout();
      window.EduSen.currentUser = null;
      afficherEcranLogin();
    }
  };
  // Bouton hamburger : ouvrir/fermer la sidebar sur mobile
  document.getElementById('btn-burger').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
  };
  // Cliquer sur l'overlay : fermer la sidebar
  document.getElementById('sidebar-overlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  };

  naviguer(ongletActif);
}

export function naviguer(ongletId) {
  const o = ONGLETS[ongletId];
  if (!o) return;
  ongletActif = ongletId;

  document.querySelectorAll('[data-onglet]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.onglet === ongletId);
  });
  document.getElementById('page-title').textContent = o.label;
  document.getElementById('page-content').innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)">Chargement...</div>`;

  try {
    o.render();
  } catch (e) {
    console.error('Erreur rendu module:', e);
    document.getElementById('page-content').innerHTML = `
      <div style="padding:24px;background:#fee2e2;border-radius:8px;color:#e05252">
        <strong>Erreur :</strong> ${e.message}
      </div>`;
  }
}
