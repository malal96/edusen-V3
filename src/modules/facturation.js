import { store, initStore, sauvegarderMensualitesEleve, sauvegarderPaiementsInscription } from '../lib/store.js';
import { MOIS_SCOLAIRES, getMoisStatutTemporel } from '../lib/constants.js';
import { formaterFCFA, escapeHtml, toast } from '../lib/ui.js';

let qInsc = '', cInsc = '';
let qMens = '', cMens = '', sMens = '', moisSel = '';

export async function afficherFacturation() {
  await initStore();
  const c = document.getElementById('page-content');

  // Init mois par défaut = mois en cours
  if (!moisSel) {
    const enCours = MOIS_SCOLAIRES.find(m => getMoisStatutTemporel(m.id, store.school?.annee) === 'en_cours');
    moisSel = enCours ? enCours.id : MOIS_SCOLAIRES[0].id;
  }

  c.innerHTML = `
    <div id="stats-fact" style="margin-bottom:20px"></div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-title">📝 Frais d'inscription</div>
      <p style="font-size:.82rem;color:var(--text-mid);margin-bottom:14px">Paiement unique enregistré automatiquement à la création de l'élève.</p>
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <input type="text" id="f-search-i" value="${escapeHtml(qInsc)}" placeholder="Rechercher..." style="flex:1;min-width:180px;padding:8px 12px;border:1px solid var(--border);border-radius:6px"/>
        <select id="f-classe-i" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:#fff">
          <option value="">Toutes les classes</option>
          ${store.classes.map(c => `<option value="${c}" ${c === cInsc ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div id="tab-insc"></div>
    </div>
    <div class="card">
      <div class="card-title">💰 Mensualités</div>
      <p style="font-size:.82rem;color:var(--text-mid);margin-bottom:14px">Choisissez un mois et cliquez sur la case d'un élève pour enregistrer son paiement.</p>
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
        <label style="font-weight:600;font-size:.85rem">Mois :</label>
        <select id="f-mois" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:#fff;min-width:160px">
          ${MOIS_SCOLAIRES.map(m => {
            const st = getMoisStatutTemporel(m.id, store.school?.annee);
            const suff = st === 'futur' ? ' (à venir)' : st === 'en_cours' ? ' (en cours)' : '';
            return `<option value="${m.id}" ${m.id === moisSel ? 'selected' : ''}>${m.label}${suff}</option>`;
          }).join('')}
        </select>
        <input type="text" id="f-search-m" value="${escapeHtml(qMens)}" placeholder="Rechercher..." style="flex:1;min-width:180px;padding:8px 12px;border:1px solid var(--border);border-radius:6px"/>
        <select id="f-classe-m" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:#fff">
          <option value="">Toutes les classes</option>
          ${store.classes.map(c => `<option value="${c}" ${c === cMens ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <select id="f-statut-m" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:#fff">
          <option value="">Tous statuts</option>
          <option value="solde" ${sMens === 'solde' ? 'selected' : ''}>Soldé</option>
          <option value="partiel" ${sMens === 'partiel' ? 'selected' : ''}>Partiel</option>
          <option value="impaye" ${sMens === 'impaye' ? 'selected' : ''}>Impayé</option>
          <option value="a_venir" ${sMens === 'a_venir' ? 'selected' : ''}>À venir</option>
        </select>
      </div>
      <div id="tab-mens"></div>
    </div>
  `;

  document.getElementById('f-search-i').oninput = (e) => { qInsc = e.target.value; rafraichir(); };
  document.getElementById('f-classe-i').onchange = (e) => { cInsc = e.target.value; rafraichir(); };
  document.getElementById('f-mois').onchange = (e) => { moisSel = e.target.value; rafraichir(); };
  document.getElementById('f-search-m').oninput = (e) => { qMens = e.target.value; rafraichir(); };
  document.getElementById('f-classe-m').onchange = (e) => { cMens = e.target.value; rafraichir(); };
  document.getElementById('f-statut-m').onchange = (e) => { sMens = e.target.value; rafraichir(); };
  rafraichir();
}

function getStatutMens(eleveId, mois, mensDue, anneeSc) {
  const paye = (store.mensualitesEleve[eleveId] || {})[mois] || 0;
  if (paye >= mensDue && mensDue > 0) return 'solde';
  if (paye > 0) return 'partiel';
  if (getMoisStatutTemporel(mois, anneeSc) === 'futur') return 'a_venir';
  return 'impaye';
}

function rafraichir() {
  const eleves = store.eleves;

  // Stats globales
  const totalInscPercu = eleves.reduce((s, e) => s + (e.paye || 0), 0);
  const totalInscDu = eleves.reduce((s, e) => s + (e.frais || 0), 0);
  const moisConcernes = MOIS_SCOLAIRES.filter(m => getMoisStatutTemporel(m.id, store.school?.annee) !== 'futur');
  let totalMensAttendu = 0, totalMensPercu = 0;
  eleves.forEach(e => {
    if (e.statut !== 'actif') return;
    const mens = store.mensualitesClasse[e.classe] || 0;
    totalMensAttendu += mens * moisConcernes.length;
    Object.values(store.mensualitesEleve[e.id] || {}).forEach(m => { totalMensPercu += parseInt(m) || 0; });
  });
  const restant = (totalInscDu - totalInscPercu) + (totalMensAttendu - totalMensPercu);

  document.getElementById('stats-fact').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <div class="card" style="border-left:4px solid #2563eb;padding:14px">
        <div style="font-size:.78rem;color:var(--text-muted)">Frais d'inscription perçus</div>
        <div style="font-size:1.1rem;font-weight:700;margin-top:4px">${formaterFCFA(totalInscPercu)}</div>
      </div>
      <div class="card" style="border-left:4px solid #0d9488;padding:14px">
        <div style="font-size:.78rem;color:var(--text-muted)">Mensualités perçues</div>
        <div style="font-size:1.1rem;font-weight:700;margin-top:4px">${formaterFCFA(totalMensPercu)}</div>
      </div>
      <div class="card" style="border-left:4px solid var(--red-soft);padding:14px">
        <div style="font-size:.78rem;color:var(--text-muted)">Reste à percevoir</div>
        <div style="font-size:1.1rem;font-weight:700;margin-top:4px">${formaterFCFA(restant)}</div>
      </div>
    </div>
  `;

  // TABLEAU INSCRIPTION
  const motsI = qInsc.toLowerCase().trim().split(/\s+/).filter(m => m);
  const elvsI = eleves.filter(e => {
    const blob = `${e.prenom} ${e.nom} ${e.id} ${e.classe}`.toLowerCase();
    return (motsI.length === 0 || motsI.every(m => blob.includes(m))) && (!cInsc || e.classe === cInsc);
  });

  document.getElementById('tab-insc').innerHTML = `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid var(--border)"><th style="padding:8px;text-align:left">Élève</th><th style="padding:8px;text-align:left">Classe</th><th style="padding:8px;text-align:right">Frais</th><th style="padding:8px;text-align:right">Payé</th><th style="padding:8px;text-align:center">Statut</th><th style="padding:8px"></th></tr></thead>
      <tbody>
        ${elvsI.length === 0 ? '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted);font-style:italic">Aucun élève</td></tr>' :
          elvsI.map(e => {
            const solde = (e.paye || 0) >= (e.frais || 0) && (e.frais || 0) > 0;
            const statut = solde ? 'solde' : (e.paye || 0) > 0 ? 'partiel' : 'impaye';
            const lbl = solde ? 'Soldé' : statut === 'partiel' ? 'Partiel' : 'Impayé';
            const col = solde ? '#16a34a' : statut === 'partiel' ? '#c9933a' : '#e05252';
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px"><strong>${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</strong><br><small style="color:var(--text-muted)">${e.id}</small></td>
              <td style="padding:8px">${escapeHtml(e.classe)}</td>
              <td style="padding:8px;text-align:right">${formaterFCFA(e.frais)}</td>
              <td style="padding:8px;text-align:right;font-weight:600;color:var(--green-mid)">${formaterFCFA(e.paye)}</td>
              <td style="padding:8px;text-align:center"><span style="padding:3px 8px;border-radius:12px;font-size:.72rem;background:${col}20;color:${col}">${lbl}</span></td>
              <td style="padding:8px;text-align:right">${!solde ? `<button class="btn btn-primary btn-sm" data-pay-i="${e.id}">+ Paiement</button>` : ''}</td>
            </tr>`;
          }).join('')}
      </tbody>
    </table></div>
  `;

  // TABLEAU MENSUALITÉS
  const motsM = qMens.toLowerCase().trim().split(/\s+/).filter(m => m);
  const elvsM = eleves.filter(e => {
    if (e.statut !== 'actif') return false;
    const blob = `${e.prenom} ${e.nom} ${e.id} ${e.classe}`.toLowerCase();
    const mR = motsM.length === 0 || motsM.every(m => blob.includes(m));
    const mC = !cMens || e.classe === cMens;
    if (!mR || !mC) return false;
    if (sMens) {
      const mens = store.mensualitesClasse[e.classe] || 0;
      if (getStatutMens(e.id, moisSel, mens, store.school?.annee) !== sMens) return false;
    }
    return true;
  });

  const moisLabel = MOIS_SCOLAIRES.find(m => m.id === moisSel)?.label || '';
  document.getElementById('tab-mens').innerHTML = `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid var(--border)"><th style="padding:8px;text-align:left">Élève</th><th style="padding:8px;text-align:left">Classe</th><th style="padding:8px;text-align:right">Mensualité due</th><th style="padding:8px;text-align:right">Payé pour ${moisLabel}</th><th style="padding:8px;text-align:center">Statut</th><th style="padding:8px"></th></tr></thead>
      <tbody>
        ${elvsM.length === 0 ? '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted);font-style:italic">Aucun élève</td></tr>' :
          elvsM.map(e => {
            const mens = store.mensualitesClasse[e.classe] || 0;
            const paye = (store.mensualitesEleve[e.id] || {})[moisSel] || 0;
            const statut = getStatutMens(e.id, moisSel, mens, store.school?.annee);
            const lbl = statut === 'solde' ? 'Soldé' : statut === 'partiel' ? 'Partiel' : statut === 'a_venir' ? 'À venir' : 'Impayé';
            const col = statut === 'solde' ? '#16a34a' : statut === 'partiel' ? '#c9933a' : statut === 'a_venir' ? '#9aa399' : '#e05252';
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px"><strong>${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</strong></td>
              <td style="padding:8px">${escapeHtml(e.classe)}</td>
              <td style="padding:8px;text-align:right">${formaterFCFA(mens)}</td>
              <td style="padding:8px;text-align:right;cursor:pointer;color:var(--green-mid);font-weight:600" data-pay-m="${e.id}">${formaterFCFA(paye)}</td>
              <td style="padding:8px;text-align:center"><span style="padding:3px 8px;border-radius:12px;font-size:.72rem;background:${col}20;color:${col}">${lbl}</span></td>
              <td style="padding:8px;text-align:right"><button class="btn btn-primary btn-sm" data-pay-m="${e.id}">+ Paiement</button></td>
            </tr>`;
          }).join('')}
      </tbody>
    </table></div>
  `;

  // Events
  document.querySelectorAll('[data-pay-i]').forEach(b => {
    b.onclick = async () => paiementInscription(b.dataset.payI);
  });
  document.querySelectorAll('[data-pay-m]').forEach(b => {
    b.onclick = async () => paiementMensualite(b.dataset.payM);
  });
}

async function paiementInscription(id) {
  const e = store.eleves.find(x => x.id === id);
  if (!e) return;
  const reste = (e.frais || 0) - (e.paye || 0);
  const montant = prompt(`Paiement d'inscription pour ${e.prenom} ${e.nom}\nReste: ${formaterFCFA(reste)}\n\nMontant du paiement (FCFA):`);
  if (!montant || isNaN(parseInt(montant))) return;
  const m = Math.min(parseInt(montant), reste);
  if (m <= 0) { toast('Montant invalide', 'error'); return; }

  e.paye = (e.paye || 0) + m;
  await (await import('../lib/store.js')).sauvegarderEleve(e);

  store.paiementsInscription.push({
    id: 'P' + Date.now().toString(36).toUpperCase(),
    type: 'inscription', eleveId: id, eleveNom: `${e.prenom} ${e.nom}`,
    classe: e.classe, montant: m, date: new Date().toISOString().split('T')[0], mode: 'Espèces'
  });
  await sauvegarderPaiementsInscription();
  toast(`Paiement de ${formaterFCFA(m)} enregistré`, 'success');
  rafraichir();
}

async function paiementMensualite(id) {
  const e = store.eleves.find(x => x.id === id);
  if (!e) return;
  const mensDue = store.mensualitesClasse[e.classe] || 0;
  const dejaPaye = (store.mensualitesEleve[id] || {})[moisSel] || 0;
  const reste = mensDue - dejaPaye;
  const moisLabel = MOIS_SCOLAIRES.find(m => m.id === moisSel)?.label;
  const montant = prompt(`Paiement de ${moisLabel} pour ${e.prenom} ${e.nom}\nMensualité due: ${formaterFCFA(mensDue)}\nDéjà payé: ${formaterFCFA(dejaPaye)}\nReste: ${formaterFCFA(reste)}\n\nMontant du paiement (FCFA):`);
  if (!montant || isNaN(parseInt(montant))) return;
  const m = parseInt(montant);
  if (m <= 0) { toast('Montant invalide', 'error'); return; }

  const nouveauTotal = Math.min(dejaPaye + m, mensDue);
  if (!store.mensualitesEleve[id]) store.mensualitesEleve[id] = {};
  store.mensualitesEleve[id][moisSel] = nouveauTotal;
  await sauvegarderMensualitesEleve();
  toast(`Paiement ${moisLabel} : ${formaterFCFA(nouveauTotal - dejaPaye)} enregistré`, 'success');
  rafraichir();
}
