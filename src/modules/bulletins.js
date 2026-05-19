import { store, initStore, sauvegarderNotes } from '../lib/store.js';
import { escapeHtml, toast, formaterDate } from '../lib/ui.js';
import { LOGO_MEN_BASE64 } from '../lib/logos.js';

// Système BISEMESTRIEL (2 semestres)
// 1er semestre : octobre → 15 février (jour 1 à 46 dans l'année scolaire)
// 2ème semestre : 16 février → juillet
const SEMESTRES = ['1er Semestre', '2ème Semestre'];

function noteKey(eleveId, matiere, semestre) {
  return `${eleveId}__${matiere}__${semestre}`;
}
function getNote(eleveId, matiere, semestre) {
  return store.notes[noteKey(eleveId, matiere, semestre)] ?? '';
}
function setNote(eleveId, matiere, semestre, val) {
  const k = noteKey(eleveId, matiere, semestre);
  if (val === '' || val === null) delete store.notes[k];
  else store.notes[k] = parseFloat(val);
}

function calculerMoyenne(eleveId, classe, semestre) {
  const matieres = store.matieres[classe] || [];
  let totalPoints = 0, totalCoef = 0;
  matieres.forEach(m => {
    const note = getNote(eleveId, m, semestre);
    const coef = store.coefficients[m] || 1;
    if (note !== '' && !isNaN(note)) {
      totalPoints += note * coef;
      totalCoef += coef;
    }
  });
  if (totalCoef === 0) return null;
  return totalPoints / totalCoef;
}

function getMention(moy) {
  if (moy === null) return null;
  if (moy >= 16) return { label: 'Très Bien', color: '#16a34a' };
  if (moy >= 14) return { label: 'Bien', color: '#2563eb' };
  if (moy >= 12) return { label: 'Assez Bien', color: '#c9933a' };
  if (moy >= 10) return { label: 'Passable', color: '#9aa399' };
  return { label: 'Insuffisant', color: '#e05252' };
}

// ============================
//  ABSENCES / RETARDS PAR SEMESTRE
// ============================
// Détermine les dates de début et fin d'un semestre en fonction de l'année scolaire
// 1er semestre : 1er octobre (année N) → 15 février (année N+1) inclus
// 2ème semestre : 16 février (année N+1) → 31 juillet (année N+1)
function getBornesSemestre(semestre) {
  const annee = store.school?.annee || '';
  const match = annee.match(/(\d{4}).*?(\d{4})/);
  if (!match) return null;
  const anneeDeb = parseInt(match[1]);  // ex: 2024
  const anneeFin = parseInt(match[2]);  // ex: 2025
  if (semestre === '1') {
    // 1er octobre N → 15 février N+1
    return {
      debut: new Date(anneeDeb, 9, 1),       // 1er octobre
      fin: new Date(anneeFin, 1, 15, 23, 59, 59)  // 15 février
    };
  }
  // 2ème semestre : 16 février N+1 → 31 juillet N+1
  return {
    debut: new Date(anneeFin, 1, 16),         // 16 février
    fin: new Date(anneeFin, 6, 31, 23, 59, 59) // 31 juillet
  };
}

// Compte les absences et retards d'un élève sur un semestre
function compterAssiduite(eleveId, semestre) {
  const bornes = getBornesSemestre(semestre);
  if (!bornes) return { absences: 0, retards: 0 };

  let absences = 0, retards = 0;
  Object.keys(store.presences || {}).forEach(k => {
    // k = "YYYY-MM-DD__eleveId"
    const parts = k.split('__');
    if (parts.length !== 2 || parts[1] !== eleveId) return;
    const date = new Date(parts[0] + 'T00:00:00');
    if (date < bornes.debut || date > bornes.fin) return;
    const entry = store.presences[k];
    if (!entry || !entry.statut) return;
    if (entry.statut === 'absent') absences++;
    else if (entry.statut === 'retard') retards++;
  });
  return { absences, retards };
}

// ============================
//  AFFICHAGE PAGE BULLETINS
// ============================

export async function afficherBulletins() {
  await initStore();
  const c = document.getElementById('page-content');
  const user = window.EduSen.currentUser;
  const estEnseignant = user.role === 'enseignant';
  const estGestionnaire = user.role === 'gestionnaire';
  const peutSaisir = user.role === 'admin' || user.role === 'enseignant';

  // Classes visibles
  let classes = [...store.classes];
  if (estEnseignant) {
    const cl = new Set((user.assignations || []).map(a => a.classe));
    classes = classes.filter(c => cl.has(c));
  }
  if (classes.length === 0) { c.innerHTML = `<div class="card">Aucune classe assignée.</div>`; return; }

  const classeActuelle = document.getElementById('b-classe')?.value || classes[0];
  const semestre = document.getElementById('b-sem')?.value || '1';

  // Matières visibles (pour l'enseignant : seulement les siennes)
  let matieres = store.matieres[classeActuelle] || [];
  if (estEnseignant) {
    const ma = new Set((user.assignations || []).filter(a => a.classe === classeActuelle).map(a => a.matiere));
    matieres = matieres.filter(m => ma.has(m));
  }

  const eleves = store.eleves.filter(e => e.classe === classeActuelle && e.statut === 'actif');

  c.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
      <select id="b-classe" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#fff">
        ${classes.map(cl => `<option value="${cl}" ${cl === classeActuelle ? 'selected' : ''}>${cl}</option>`).join('')}
      </select>
      <select id="b-sem" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#fff">
        ${SEMESTRES.map((t, i) => `<option value="${i+1}" ${(i+1) == semestre ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      ${peutSaisir ? `<button class="btn btn-primary btn-sm" id="b-save">💾 Enregistrer les notes</button>` : ''}
    </div>
    ${estGestionnaire ? `<div style="background:#fef9c3;border-left:4px solid #c9933a;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:.85rem"><strong>Mode lecture seule :</strong> vous pouvez consulter les notes et imprimer les bulletins, mais pas modifier les notes.</div>` : ''}
    <div class="card" style="overflow-x:auto">
      ${matieres.length === 0 ? '<p style="color:var(--text-muted);font-style:italic">Aucune matière assignée pour cette classe.</p>' :
      eleves.length === 0 ? '<p style="color:var(--text-muted);font-style:italic">Aucun élève dans cette classe.</p>' :
      `<table style="width:100%;border-collapse:collapse;min-width:700px">
        <thead><tr style="border-bottom:2px solid var(--border)">
          <th style="padding:10px;text-align:left">Élève</th>
          ${matieres.map(m => `<th style="padding:10px;text-align:center;min-width:80px">${m}<br><small style="font-weight:400;opacity:.6">Coef.${store.coefficients[m] || 1}</small></th>`).join('')}
          ${!estEnseignant ? `<th style="padding:10px;text-align:center">Moyenne</th><th style="padding:10px;text-align:center">Mention</th><th style="padding:10px;text-align:center">Bulletin</th>` : ''}
        </tr></thead>
        <tbody>
          ${eleves.map(e => {
            const moy = !estEnseignant ? calculerMoyenne(e.id, classeActuelle, semestre) : null;
            const m = moy !== null ? getMention(moy) : null;
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px"><strong>${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</strong><br><small style="color:var(--text-muted)">${e.id}</small></td>
              ${matieres.map(mat => `<td style="padding:5px;text-align:center">
                ${peutSaisir
                  ? `<input type="number" min="0" max="20" step="0.25" data-eleve="${e.id}" data-mat="${mat}" value="${getNote(e.id, mat, semestre)}" style="width:60px;padding:5px;text-align:center;border:1px solid var(--border);border-radius:4px"/>`
                  : `<span style="display:inline-block;min-width:40px;padding:4px 8px;background:var(--surface2);border-radius:4px;font-weight:600;color:${getNote(e.id, mat, semestre) !== '' ? 'var(--text)' : 'var(--text-muted)'}">${getNote(e.id, mat, semestre) !== '' ? getNote(e.id, mat, semestre) : '—'}</span>`
                }
              </td>`).join('')}
              ${!estEnseignant ? `<td style="padding:8px;text-align:center;font-weight:700">${moy !== null ? moy.toFixed(2) : '—'}</td>
              <td style="padding:8px;text-align:center">${m ? `<span style="padding:3px 8px;border-radius:12px;font-size:.72rem;background:${m.color}20;color:${m.color}">${m.label}</span>` : '—'}</td>
              <td style="padding:8px;text-align:center"><button class="btn btn-ghost btn-sm" data-print="${e.id}">🖨️</button></td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>`}
    </div>
  `;

  document.getElementById('b-classe').onchange = afficherBulletins;
  document.getElementById('b-sem').onchange = afficherBulletins;
  if (peutSaisir) {
    document.getElementById('b-save').onclick = async () => {
      document.querySelectorAll('input[data-eleve]').forEach(inp => {
        setNote(inp.dataset.eleve, inp.dataset.mat, semestre, inp.value);
      });
      await sauvegarderNotes();
      toast('Notes enregistrées', 'success');
      afficherBulletins();
    };
  }
  if (!estEnseignant) {
    document.querySelectorAll('[data-print]').forEach(b => {
      b.onclick = () => imprimerBulletin(b.dataset.print, semestre);
    });
  }
}

// ============================
//  IMPRESSION D'UN BULLETIN
// ============================

function imprimerBulletin(eleveId, semestre) {
  const e = store.eleves.find(x => x.id === eleveId);
  if (!e) return;
  const matieres = store.matieres[e.classe] || [];
  const moy = calculerMoyenne(eleveId, e.classe, semestre);
  const mention = moy !== null ? getMention(moy) : null;
  const s = store.school;
  const iefAffiche = (s.ief || '').trim() || 'IEF / IA : —';
  const logo2 = s.logo2 || '';
  const { absences, retards } = compterAssiduite(eleveId, semestre);

  const logo2Html = logo2
    ? `<img src="${logo2}" alt="Logo école" style="max-width:65px;max-height:55px;object-fit:contain"/>`
    : `<div style="width:60px;height:55px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:9px;color:#aaa;text-align:center">Logo</div>`;

  // Drapeau Sénégal SVG
  const drapeau = `<svg width="36" height="24" viewBox="0 0 900 600" style="display:inline-block;vertical-align:middle;margin-right:8px"><rect width="300" height="600" x="0" fill="#00853f"/><rect width="300" height="600" x="300" fill="#fdef42"/><rect width="300" height="600" x="600" fill="#e31b23"/><polygon fill="#00853f" points="450,225 467.6,279.2 524.6,279.2 478.5,312.7 496.1,366.9 450,333.4 403.9,366.9 421.5,312.7 375.4,279.2 432.4,279.2"/></svg>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Bulletin ${e.prenom} ${e.nom}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:20px}
    @media print{.no-print{display:none}@page{margin:1cm}}.no-print{margin-bottom:16px;text-align:center}
    table{width:100%;border-collapse:collapse}th,td{padding:6px 10px;border:1px solid #ddd;font-size:13px}
    th{background:#1a4731;color:#fff}</style></head><body>
    <div class="no-print"><button onclick="window.print()" style="padding:8px 20px;background:#1a4731;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ Imprimer</button></div>

    <!-- Bandeau République du Sénégal -->
    <div style="text-align:center;margin-bottom:12px">
      ${drapeau}
      <span style="font-size:12px;font-weight:600;letter-spacing:.05em;vertical-align:middle">REPUBLIQUE DU SENEGAL</span>
    </div>

    <!-- En-tête : logo MEN | infos école | logo école -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 14px;border:1px solid #dde5d9;border-radius:8px;background:#f9fdf9">
      <div style="display:flex;align-items:center;gap:6px;width:180px;flex-shrink:0">
        <img src="${LOGO_MEN_BASE64}" alt="MEN" style="width:55px;height:auto;object-fit:contain;flex-shrink:0"/>
        <div style="font-size:7px;font-weight:700;line-height:1.4;color:#000;text-transform:uppercase">
          <div>MINISTERE DE L'EDUCATION<br/>NATIONALE</div>
          <div style="margin-top:3px">${escapeHtml(iefAffiche)}</div>
        </div>
      </div>
      <div style="flex:1;text-align:center;min-width:0">
        <div style="font-size:15px;font-weight:700;color:#1a4731;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(s.nom)}</div>
        <div style="font-size:11px;color:#666;margin-top:2px">${escapeHtml(s.ville || '')}${s.telephone ? ' &middot; Tel: ' + escapeHtml(s.telephone) : ''}</div>
        <div style="font-size:11px;color:#666;margin-top:2px">Annee scolaire ${escapeHtml(s.annee || '')}</div>
      </div>
      <div style="width:180px;flex-shrink:0;display:flex;justify-content:flex-end">${logo2Html}</div>
    </div>

    <!-- Titre du bulletin -->
    <div style="background:#1a4731;color:#fff;padding:8px;text-align:center;border-radius:4px;margin-bottom:12px">
      <strong>BULLETIN DE NOTES</strong><br><small>${SEMESTRES[semestre-1]}</small>
    </div>

    <!-- Infos élève -->
    <div style="padding:10px;border:1px solid #dde5d9;border-radius:6px;margin-bottom:12px;display:flex;gap:20px;flex-wrap:wrap">
      <div><strong>Nom :</strong> ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</div>
      <div><strong>Classe :</strong> ${escapeHtml(e.classe)}</div>
      <div><strong>Matricule :</strong> ${e.id}</div>
      <div><strong>Tuteur :</strong> ${escapeHtml(e.tuteur || '')}</div>
    </div>

    <table>
      <thead><tr><th>Matière</th><th>Coef.</th><th>Note /20</th><th>Points</th></tr></thead>
      <tbody>
        ${matieres.map(m => {
          const note = getNote(eleveId, m, semestre);
          const coef = store.coefficients[m] || 1;
          const points = note !== '' ? note * coef : '';
          return `<tr><td>${m}</td><td style="text-align:center">${coef}</td><td style="text-align:center">${note !== '' ? note : '—'}</td><td style="text-align:center">${points !== '' ? points.toFixed(2) : '—'}</td></tr>`;
        }).join('')}
        <tr style="font-weight:700;background:#e8f5ee"><td colspan="2">MOYENNE GÉNÉRALE</td><td style="text-align:center">${moy !== null ? moy.toFixed(2) + '/20' : '—'}</td><td style="text-align:center">${mention ? mention.label : '—'}</td></tr>
      </tbody>
    </table>

    <!-- Encart Assiduité (entre tableau et signatures) -->
    <div style="margin-top:14px;padding:10px 14px;border:1px solid #dde5d9;border-radius:6px;background:#f9fdf9;display:flex;gap:24px;justify-content:center;flex-wrap:wrap">
      <div style="font-size:13px"><strong>📋 Assiduité :</strong></div>
      <div style="font-size:13px;color:${absences > 0 ? '#e05252' : '#666'}"><strong>Absences :</strong> ${absences} ${absences > 1 ? 'jours' : 'jour'}</div>
      <div style="font-size:13px;color:${retards > 0 ? '#c9933a' : '#666'}"><strong>Retards :</strong> ${retards} ${retards > 1 ? 'fois' : 'fois'}</div>
    </div>

    <div style="margin-top:30px;display:flex;justify-content:space-around;font-size:11px;color:#666">
      <div>Signature Directeur : _______________<br><br>${escapeHtml(s.directeur || '')}</div>
      <div>Signature Tuteur : _______________</div>
      <div>Date : ${formaterDate(new Date().toISOString().split('T')[0])}</div>
    </div>
    </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
