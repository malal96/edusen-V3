import { store, initStore } from '../lib/store.js';
import { MOIS_SCOLAIRES, getMoisStatutTemporel } from '../lib/constants.js';
import { formaterFCFA } from '../lib/ui.js';

export async function afficherDashboard() {
  await initStore();
  const c = document.getElementById('page-content');

  const eleves = store.eleves;
  const total = eleves.length;
  const actifs = eleves.filter(e => e.statut === 'actif').length;
  const totalFraisInsc = eleves.reduce((s, e) => s + (e.frais || 0), 0);
  const totalInscPercu = eleves.reduce((s, e) => s + (e.paye || 0), 0);

  const moisConcernes = MOIS_SCOLAIRES.filter(m => getMoisStatutTemporel(m.id, store.school?.annee) !== 'futur');
  let totalMensAttendu = 0, totalMensPercu = 0;
  eleves.forEach(e => {
    if (e.statut !== 'actif') return;
    const mens = store.mensualitesClasse[e.classe] || 0;
    totalMensAttendu += mens * moisConcernes.length;
    const paiements = store.mensualitesEleve[e.id] || {};
    Object.values(paiements).forEach(m => { totalMensPercu += parseInt(m) || 0; });
  });

  const restant = (totalFraisInsc - totalInscPercu) + (totalMensAttendu - totalMensPercu);

  // Stats par classe
  const parClasse = {};
  store.classes.forEach(cl => {
    parClasse[cl] = eleves.filter(e => e.classe === cl && e.statut === 'actif').length;
  });

  c.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
      <div class="card" style="border-left:4px solid var(--green-mid)">
        <div style="font-size:.78rem;color:var(--text-muted)">Total élèves</div>
        <div style="font-size:1.8rem;font-weight:700;color:var(--green-deep);margin:6px 0">${total}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">inscrits cette année</div>
      </div>
      <div class="card" style="border-left:4px solid #c9933a">
        <div style="font-size:.78rem;color:var(--text-muted)">Élèves actifs</div>
        <div style="font-size:1.8rem;font-weight:700;color:#c9933a;margin:6px 0">${actifs}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">présents en classe</div>
      </div>
      <div class="card" style="border-left:4px solid #2563eb">
        <div style="font-size:.78rem;color:var(--text-muted)">Frais d'inscription</div>
        <div style="font-size:1.1rem;font-weight:700;color:#2563eb;margin:6px 0">${formaterFCFA(totalInscPercu)}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">encaissés</div>
      </div>
      <div class="card" style="border-left:4px solid #0d9488">
        <div style="font-size:.78rem;color:var(--text-muted)">Mensualités perçues</div>
        <div style="font-size:1.1rem;font-weight:700;color:#0d9488;margin:6px 0">${formaterFCFA(totalMensPercu)}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">tous mois confondus</div>
      </div>
      <div class="card" style="border-left:4px solid var(--red-soft)">
        <div style="font-size:.78rem;color:var(--text-muted)">Reste à percevoir</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--red-soft);margin:6px 0">${formaterFCFA(restant)}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">inscriptions + mensualités</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Répartition par classe</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
        ${store.classes.map(cl => `
          <div style="padding:12px;background:var(--surface2);border-radius:8px;text-align:center">
            <div style="font-weight:700;color:var(--green-deep)">${cl}</div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${parClasse[cl] || 0} élève${(parClasse[cl] || 0) > 1 ? 's' : ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
