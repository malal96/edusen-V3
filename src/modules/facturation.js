import { store, initStore, sauvegarderMensualitesEleve, sauvegarderPaiementsInscription, sauvegarderEleve } from '../lib/store.js';
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

  // Events sur les filtres (re-render uniquement les tableaux pour ne pas perdre le focus)
  document.getElementById('f-search-i').addEventListener('input', (e) => { qInsc = e.target.value; rafraichir(); });
  document.getElementById('f-classe-i').onchange = (e) => { cInsc = e.target.value; rafraichir(); };
  document.getElementById('f-mois').onchange = (e) => { moisSel = e.target.value; rafraichir(); };
  document.getElementById('f-search-m').addEventListener('input', (e) => { qMens = e.target.value; rafraichir(); });
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

  // ====== STATS GLOBALES ======
  const totalInscPercu = eleves.reduce((s, e) => s + (e.paye || 0), 0);
  const totalInscDu = eleves.reduce((s, e) => s + (e.frais || 0), 0);
  // Mensualités : compter uniquement les mois passés ou en cours (pas les futurs)
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
        <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px">sur ${formaterFCFA(totalMensAttendu)} dus à ce jour</div>
      </div>
      <div class="card" style="border-left:4px solid var(--red-soft);padding:14px">
        <div style="font-size:.78rem;color:var(--text-muted)">Reste à percevoir</div>
        <div style="font-size:1.1rem;font-weight:700;margin-top:4px">${formaterFCFA(restant)}</div>
      </div>
    </div>
  `;

  // ====== TABLEAU INSCRIPTION ======
  const motsI = qInsc.toLowerCase().trim().split(/\s+/).filter(m => m);
  const elvsI = eleves.filter(e => {
    const blob = `${e.prenom} ${e.nom} ${e.id} ${e.classe}`.toLowerCase();
    return (motsI.length === 0 || motsI.every(m => blob.includes(m))) && (!cInsc || e.classe === cInsc);
  });

  document.getElementById('tab-insc').innerHTML = `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid var(--border)">
        <th style="padding:8px;text-align:left">Élève</th>
        <th style="padding:8px;text-align:left">Classe</th>
        <th style="padding:8px;text-align:right">Frais</th>
        <th style="padding:8px;text-align:right">Payé</th>
        <th style="padding:8px;text-align:center">Statut</th>
        <th style="padding:8px"></th>
      </tr></thead>
      <tbody>
        ${elvsI.length === 0 ? '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted);font-style:italic">Aucun élève</td></tr>' :
          elvsI.map(e => {
            const solde = (e.paye || 0) >= (e.frais || 0) && (e.frais || 0) > 0;
            const statut = solde ? 'solde' : (e.paye || 0) > 0 ? 'partiel' : 'impaye';
            const lbl = solde ? 'Soldé' : statut === 'partiel' ? 'Partiel' : 'Impayé';
            const col = solde ? '#16a34a' : statut === 'partiel' ? '#c9933a' : '#e05252';
            const aPaiement = (e.paye || 0) > 0;
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px"><strong>${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</strong><br><small style="color:var(--text-muted)">${e.id}</small></td>
              <td style="padding:8px">${escapeHtml(e.classe)}</td>
              <td style="padding:8px;text-align:right">${formaterFCFA(e.frais)}</td>
              <td style="padding:8px;text-align:right;font-weight:600;color:var(--green-mid)">${formaterFCFA(e.paye)}</td>
              <td style="padding:8px;text-align:center"><span style="padding:3px 8px;border-radius:12px;font-size:.72rem;background:${col}20;color:${col}">${lbl}</span></td>
              <td style="padding:8px;text-align:right;white-space:nowrap">
                ${!solde ? `<button class="btn btn-primary btn-sm" data-pay-i="${e.id}">+ Paiement</button>` : ''}
                ${aPaiement ? `<button class="btn btn-ghost btn-sm" data-recu-i="${e.id}">🧾 Reçu</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
      </tbody>
    </table></div>
  `;

  // ====== TABLEAU MENSUALITÉS ======
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
      <thead><tr style="border-bottom:2px solid var(--border)">
        <th style="padding:8px;text-align:left">Élève</th>
        <th style="padding:8px;text-align:left">Classe</th>
        <th style="padding:8px;text-align:right">Mensualité due</th>
        <th style="padding:8px;text-align:right">Payé pour ${escapeHtml(moisLabel)}</th>
        <th style="padding:8px;text-align:center">Statut</th>
        <th style="padding:8px"></th>
      </tr></thead>
      <tbody>
        ${elvsM.length === 0 ? '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted);font-style:italic">Aucun élève</td></tr>' :
          elvsM.map(e => {
            const mens = store.mensualitesClasse[e.classe] || 0;
            const paye = (store.mensualitesEleve[e.id] || {})[moisSel] || 0;
            const statut = getStatutMens(e.id, moisSel, mens, store.school?.annee);
            const lbl = statut === 'solde' ? 'Soldé' : statut === 'partiel' ? 'Partiel' : statut === 'a_venir' ? 'À venir' : 'Impayé';
            const col = statut === 'solde' ? '#16a34a' : statut === 'partiel' ? '#c9933a' : statut === 'a_venir' ? '#9aa399' : '#e05252';
            const aPaiement = paye > 0;
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px"><strong>${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</strong></td>
              <td style="padding:8px">${escapeHtml(e.classe)}</td>
              <td style="padding:8px;text-align:right">${formaterFCFA(mens)}</td>
              <td style="padding:8px;text-align:right;color:var(--green-mid);font-weight:600">${formaterFCFA(paye)}</td>
              <td style="padding:8px;text-align:center"><span style="padding:3px 8px;border-radius:12px;font-size:.72rem;background:${col}20;color:${col}">${lbl}</span></td>
              <td style="padding:8px;text-align:right;white-space:nowrap">
                ${statut !== 'solde' ? `<button class="btn btn-primary btn-sm" data-pay-m="${e.id}">+ Paiement</button>` : ''}
                ${aPaiement ? `<button class="btn btn-ghost btn-sm" data-recu-m="${e.id}">🧾 Reçu</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
      </tbody>
    </table></div>
  `;

  // Events
  document.querySelectorAll('[data-pay-i]').forEach(b => {
    b.onclick = () => paiementInscription(b.dataset.payI);
  });
  document.querySelectorAll('[data-recu-i]').forEach(b => {
    b.onclick = () => imprimerRecuInscription(b.dataset.recuI);
  });
  document.querySelectorAll('[data-pay-m]').forEach(b => {
    b.onclick = () => paiementMensualite(b.dataset.payM);
  });
  document.querySelectorAll('[data-recu-m]').forEach(b => {
    b.onclick = () => imprimerRecuMensualite(b.dataset.recuM, moisSel);
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
  await sauvegarderEleve(e);

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
  const ajout = nouveauTotal - dejaPaye;
  if (!store.mensualitesEleve[id]) store.mensualitesEleve[id] = {};
  store.mensualitesEleve[id][moisSel] = nouveauTotal;
  await sauvegarderMensualitesEleve();

  // Historique des paiements de mensualité (pour le reçu)
  store.paiementsInscription.push({
    id: 'P' + Date.now().toString(36).toUpperCase(),
    type: 'mensualite', mois: moisSel,
    eleveId: id, eleveNom: `${e.prenom} ${e.nom}`,
    classe: e.classe, montant: ajout,
    date: new Date().toISOString().split('T')[0], mode: 'Espèces'
  });
  await sauvegarderPaiementsInscription();
  toast(`Paiement ${moisLabel} : ${formaterFCFA(ajout)} enregistré`, 'success');
  rafraichir();
}

// ============================
//  REÇUS
// ============================

function imprimerRecuInscription(eleveId) {
  const e = store.eleves.find(x => x.id === eleveId);
  if (!e) return;
  const s = store.school;
  const paiementsEleve = (store.paiementsInscription || []).filter(p => p.eleveId === eleveId && p.type === 'inscription');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Reçu inscription ${e.prenom} ${e.nom}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:30px;max-width:600px;margin:0 auto}
    @media print{.no-print{display:none}@page{margin:1cm}}.no-print{margin-bottom:16px;text-align:center}
    table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;border:1px solid #ddd;font-size:13px}
    th{background:#1a4731;color:#fff;font-weight:600}tr:nth-child(even){background:#f9f9f9}
    </style></head><body>
    <div class="no-print"><button onclick="window.print()" style="padding:8px 20px;background:#1a4731;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ Imprimer</button></div>
    <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1a4731;padding-bottom:12px">
      <h2 style="font-size:18px;color:#1a4731">${escapeHtml(s.nom || '')}</h2>
      <p style="font-size:12px;color:#666">${escapeHtml(s.ville || '')} &middot; ${escapeHtml(s.telephone || '')}</p>
      <h3 style="margin-top:10px;font-size:16px">REÇU DE PAIEMENT — FRAIS D'INSCRIPTION</h3>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;font-size:13px">
      <div><strong>Élève :</strong> ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</div>
      <div><strong>Matricule :</strong> ${escapeHtml(e.id)}</div>
      <div><strong>Classe :</strong> ${escapeHtml(e.classe)}</div>
      <div><strong>Tuteur :</strong> ${escapeHtml(e.tuteur || '')}</div>
      <div><strong>Frais d'inscription :</strong> ${formaterFCFA(e.frais)}</div>
      <div><strong>Total payé :</strong> ${formaterFCFA(e.paye)}</div>
    </div>
    <h4 style="margin-bottom:8px;font-size:13px">Historique des paiements d'inscription</h4>
    <table>
      <thead><tr><th>N° Reçu</th><th>Date</th><th>Montant</th><th>Mode</th></tr></thead>
      <tbody>
        ${paiementsEleve.length > 0 ? paiementsEleve.map(p => `<tr>
          <td>${escapeHtml(p.id)}</td>
          <td>${escapeHtml(p.date)}</td>
          <td style="font-weight:600;color:#1a4731">${formaterFCFA(p.montant)}</td>
          <td>${escapeHtml(p.mode)}</td>
        </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#999">Aucun paiement enregistré</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="background:#e8f5ee;font-weight:700">
          <td colspan="2">TOTAL PAYÉ</td>
          <td style="color:#1a4731">${formaterFCFA(e.paye)}</td>
          <td></td>
        </tr>
        <tr style="background:${(e.paye || 0) < (e.frais || 0) ? '#fee2e2' : '#e8f5ee'};font-weight:700">
          <td colspan="2">RESTE À PAYER</td>
          <td style="color:${(e.paye || 0) < (e.frais || 0) ? '#e05252' : '#1a4731'}">${formaterFCFA((e.frais || 0) - (e.paye || 0))}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px;color:#666">
      <div>Signature du Comptable : _____________</div>
      <div>Date : ${new Date().toLocaleDateString('fr-SN')}</div>
    </div>
    </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

function imprimerRecuMensualite(eleveId, moisId) {
  const e = store.eleves.find(x => x.id === eleveId);
  if (!e) return;
  const s = store.school;
  const moisLabel = MOIS_SCOLAIRES.find(m => m.id === moisId)?.label || moisId;
  const mensDue = store.mensualitesClasse[e.classe] || 0;
  const totalPayeMois = ((store.mensualitesEleve[eleveId] || {})[moisId]) || 0;
  const restantMois = mensDue - totalPayeMois;
  // Historique des paiements de ce mois
  const historiqueMois = (store.paiementsInscription || []).filter(p => p.eleveId === eleveId && p.type === 'mensualite' && p.mois === moisId);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Reçu ${moisLabel} ${e.prenom} ${e.nom}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:30px;max-width:600px;margin:0 auto}
    @media print{.no-print{display:none}@page{margin:1cm}}.no-print{margin-bottom:16px;text-align:center}
    table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;border:1px solid #ddd;font-size:13px}
    th{background:#1a4731;color:#fff;font-weight:600}tr:nth-child(even){background:#f9f9f9}
    </style></head><body>
    <div class="no-print"><button onclick="window.print()" style="padding:8px 20px;background:#1a4731;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ Imprimer</button></div>
    <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1a4731;padding-bottom:12px">
      <h2 style="font-size:18px;color:#1a4731">${escapeHtml(s.nom || '')}</h2>
      <p style="font-size:12px;color:#666">${escapeHtml(s.ville || '')} &middot; ${escapeHtml(s.telephone || '')}</p>
      <h3 style="margin-top:10px;font-size:16px">REÇU DE MENSUALITÉ — ${escapeHtml(moisLabel.toUpperCase())}</h3>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;font-size:13px">
      <div><strong>Élève :</strong> ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</div>
      <div><strong>Matricule :</strong> ${escapeHtml(e.id)}</div>
      <div><strong>Classe :</strong> ${escapeHtml(e.classe)}</div>
      <div><strong>Tuteur :</strong> ${escapeHtml(e.tuteur || '')}</div>
      <div><strong>Mois concerné :</strong> ${escapeHtml(moisLabel)}</div>
      <div><strong>Mensualité due :</strong> ${formaterFCFA(mensDue)}</div>
    </div>
    <h4 style="margin-bottom:8px;font-size:13px">Détail des paiements pour ${escapeHtml(moisLabel)}</h4>
    <table>
      <thead><tr><th>N° Reçu</th><th>Date</th><th>Montant</th><th>Mode</th></tr></thead>
      <tbody>
        ${historiqueMois.length > 0 ? historiqueMois.map(p => `<tr>
          <td>${escapeHtml(p.id)}</td>
          <td>${escapeHtml(p.date)}</td>
          <td style="font-weight:600;color:#1a4731">${formaterFCFA(p.montant)}</td>
          <td>${escapeHtml(p.mode)}</td>
        </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#999">Aucun paiement enregistré pour ce mois</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="background:#e8f5ee;font-weight:700">
          <td colspan="2">TOTAL PAYÉ POUR ${escapeHtml(moisLabel.toUpperCase())}</td>
          <td style="color:#1a4731">${formaterFCFA(totalPayeMois)}</td>
          <td></td>
        </tr>
        <tr style="background:${restantMois > 0 ? '#fee2e2' : '#e8f5ee'};font-weight:700">
          <td colspan="2">RESTE À PAYER POUR CE MOIS</td>
          <td style="color:${restantMois > 0 ? '#e05252' : '#1a4731'}">${formaterFCFA(restantMois)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px;color:#666">
      <div>Signature du Comptable : _____________</div>
      <div>Date : ${new Date().toLocaleDateString('fr-SN')}</div>
    </div>
    </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
