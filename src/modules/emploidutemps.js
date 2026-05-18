import { store, initStore, sauvegarderEDT, sauvegarderParametres } from '../lib/store.js';
import { escapeHtml, toast } from '../lib/ui.js';

const JOURS_TOUS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Couleurs douces par matière (pour différencier visuellement)
const COULEURS_MATIERES = {
  'Francais': '#dbeafe', 'Mathematiques': '#fce7f3', 'Calcul': '#fce7f3',
  'Sciences': '#dcfce7', 'SVT': '#dcfce7', 'Physique-Chimie': '#fce7f3',
  'Histoire-Geo': '#fef9c3', 'EPS': '#ffedd5', 'Anglais': '#ede9fe',
  'Espagnol': '#fce7f3', 'Dessin': '#fae8ff', 'Lecture': '#dbeafe',
  'Ecriture': '#e0f2fe', 'Eveil': '#dcfce7', 'Instruction Civique': '#fef3c7',
  'Philosophie': '#fce7f3', 'Litterature': '#dbeafe',
  'Arts Plastiques': '#fae8ff', 'Musique': '#ede9fe'
};

function couleurMatiere(m) {
  if (!m) return '#fff';
  return COULEURS_MATIERES[m] || '#f0fdf4';
}

// Détecter si la classe a samedi activé
function classeASamedi(classe) {
  const edtCl = store.edt[classe] || {};
  return Object.keys(edtCl).some(k => k.startsWith('Samedi'));
}

export async function afficherEDT() {
  await initStore();
  const c = document.getElementById('page-content');
  const user = window.EduSen.currentUser;
  const lectureSeule = user.role === 'enseignant';

  let classes = [...store.classes];
  if (lectureSeule) {
    const cl = new Set((user.assignations || []).map(a => a.classe));
    classes = classes.filter(c => cl.has(c));
  }
  if (classes.length === 0) { c.innerHTML = `<div class="card">Aucune classe disponible.</div>`; return; }

  const classeActuelle = document.getElementById('edt-classe')?.value || classes[0];
  const matieresClasse = store.matieres[classeActuelle] || [];
  const edtClasse = store.edt[classeActuelle] || {};
  const creneaux = store.creneaux || [];
  const hasSamedi = classeASamedi(classeActuelle);
  const JOURS = hasSamedi ? JOURS_TOUS : JOURS_TOUS.slice(0, 5);  // 5 ou 6 jours

  c.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <select id="edt-classe" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#fff">
        ${classes.map(cl => `<option value="${cl}" ${cl === classeActuelle ? 'selected' : ''}>${cl}</option>`).join('')}
      </select>
      ${!lectureSeule ? `<button class="btn btn-ghost btn-sm" id="edt-samedi">${hasSamedi ? '➖ Masquer Samedi' : '➕ Ajouter Samedi'}</button>` : ''}
      <button class="btn btn-ghost btn-sm" id="edt-imprimer">🖨️ Imprimer</button>
      ${!lectureSeule ? `<button class="btn btn-danger btn-sm" id="edt-reinit">Réinitialiser</button>` : ''}
    </div>
    ${lectureSeule
      ? `<div style="background:#fef9c3;border-left:4px solid #c9933a;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:.85rem"><strong>Mode lecture seule :</strong> vous pouvez consulter et imprimer l'emploi du temps, mais pas le modifier.</div>`
      : `<div style="background:#e0f2fe;border-left:4px solid #2563eb;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:.8rem"><strong>💡 Astuce :</strong> Les horaires (1ère colonne) sont communs à toutes les classes. Sélectionnez matière, enseignant et salle dans chaque case.</div>`}
    <div class="card" style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:700px">
        <thead><tr>
          <th style="width:130px;padding:8px;background:var(--surface2);border:1px solid var(--border);font-size:.75rem">Horaire</th>
          ${JOURS.map(j => `<th style="padding:8px;background:var(--green-deep);color:#fff;border:1px solid var(--border);font-size:.82rem">${j}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${creneaux.map(cren => {
            const isPause = cren.type === 'pause' || cren.type === 'repas';
            const cellHoraire = lectureSeule
              ? `<td style="padding:6px;border:1px solid var(--border);background:var(--surface2);font-size:.75rem">${cren.debut}-${cren.fin}</td>`
              : `<td style="padding:4px;border:1px solid var(--border);background:var(--surface2)">
                  <div style="display:flex;gap:3px;align-items:center;font-size:.7rem">
                    <input type="time" value="${cren.debut}" data-cren="${cren.id}" data-champ="debut" style="width:62px;padding:2px 3px;border:1px solid var(--border);border-radius:3px;font-size:.7rem"/>
                    <span>-</span>
                    <input type="time" value="${cren.fin}" data-cren="${cren.id}" data-champ="fin" style="width:62px;padding:2px 3px;border:1px solid var(--border);border-radius:3px;font-size:.7rem"/>
                  </div>
                </td>`;
            if (isPause) {
              const label = cren.type === 'repas' ? 'Pause déjeuner' : 'Récréation';
              return `<tr>${cellHoraire}${JOURS.map(() => `<td style="padding:6px;border:1px solid var(--border);background:#f9fafb;text-align:center;font-size:.78rem;color:var(--text-muted);font-style:italic">${label}</td>`).join('')}</tr>`;
            }
            return `<tr>${cellHoraire}${JOURS.map(jour => {
              const key = `${jour}_${cren.id}`;
              const cell = edtClasse[key] || {};
              const bg = couleurMatiere(cell.matiere);
              if (lectureSeule) {
                return `<td style="padding:6px;border:1px solid var(--border);background:${bg};font-size:.78rem">
                  ${cell.matiere ? `<div style="font-weight:600">${escapeHtml(cell.matiere)}</div>` : ''}
                  ${cell.enseignant ? `<div style="font-size:.7rem;color:var(--text-muted)">${escapeHtml(cell.enseignant)}</div>` : ''}
                  ${cell.salle ? `<div style="font-size:.68rem;color:var(--text-muted)">${escapeHtml(cell.salle)}</div>` : ''}
                </td>`;
              }
              return `<td style="padding:4px;border:1px solid var(--border);background:${bg};vertical-align:top">
                <select data-classe="${classeActuelle}" data-key="${key}" data-champ="matiere" style="width:100%;border:none;background:transparent;font-size:.75rem;font-weight:600;padding:2px;cursor:pointer">
                  <option value="">— Matière —</option>
                  ${matieresClasse.map(m => `<option value="${m}" ${cell.matiere === m ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
                <select data-classe="${classeActuelle}" data-key="${key}" data-champ="enseignant" style="width:100%;border:none;background:transparent;font-size:.7rem;padding:2px;cursor:pointer" ${!cell.matiere ? 'disabled' : ''}>
                  <option value="">— Enseignant —</option>
                  ${getEnseignantsAssignes(classeActuelle, cell.matiere).map(e => `<option value="${e}" ${cell.enseignant === e ? 'selected' : ''}>${e}</option>`).join('')}
                </select>
                <select data-classe="${classeActuelle}" data-key="${key}" data-champ="salle" style="width:100%;border:none;background:transparent;font-size:.7rem;padding:2px;cursor:pointer">
                  <option value="">— Salle —</option>
                  ${store.salles.map(s => `<option value="${s}" ${cell.salle === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </td>`;
            }).join('')}</tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('edt-classe').onchange = afficherEDT;
  document.getElementById('edt-imprimer').onclick = () => imprimerEDT(classeActuelle);
  if (!lectureSeule) {
    document.getElementById('edt-samedi').onclick = () => toggleSamedi(classeActuelle);
    document.querySelectorAll('input[type="time"][data-cren]').forEach(inp => {
      inp.onchange = async () => {
        const cren = store.creneaux.find(c => c.id === inp.dataset.cren);
        if (cren) {
          cren[inp.dataset.champ] = inp.value;
          await sauvegarderParametres();
        }
      };
    });
    document.querySelectorAll('select[data-classe]').forEach(sel => {
      sel.onchange = async () => {
        const cl = sel.dataset.classe, k = sel.dataset.key, champ = sel.dataset.champ;
        if (!store.edt[cl]) store.edt[cl] = {};
        if (!store.edt[cl][k]) store.edt[cl][k] = {};
        store.edt[cl][k][champ] = sel.value;
        if (champ === 'matiere') store.edt[cl][k].enseignant = '';  // reset enseignant
        await sauvegarderEDT();
        afficherEDT();  // re-render
      };
    });
    document.getElementById('edt-reinit').onclick = async () => {
      if (!confirm('Réinitialiser l\'emploi du temps de cette classe ?')) return;
      store.edt[classeActuelle] = {};
      await sauvegarderEDT();
      toast('Emploi du temps réinitialisé', 'success');
      afficherEDT();
    };
  }
}

// ===== TOGGLE SAMEDI =====
async function toggleSamedi(classe) {
  if (!store.edt[classe]) store.edt[classe] = {};
  const hasSam = Object.keys(store.edt[classe]).some(k => k.startsWith('Samedi'));
  if (hasSam) {
    // Retirer toutes les cellules Samedi
    Object.keys(store.edt[classe])
      .filter(k => k.startsWith('Samedi'))
      .forEach(k => delete store.edt[classe][k]);
    toast('Samedi masqué', 'success');
  } else {
    // Activer Samedi (placeholder vide pour qu'on détecte sa présence)
    store.edt[classe]['Samedi_placeholder'] = {};
    toast('Samedi ajouté', 'success');
  }
  await sauvegarderEDT();
  afficherEDT();
}

// ===== IMPRIMER EDT =====
function imprimerEDT(classe) {
  const edtClasse = store.edt[classe] || {};
  const school = store.school;
  const creneaux = store.creneaux || [];
  const hasSamedi = classeASamedi(classe);
  const JOURS = hasSamedi ? JOURS_TOUS : JOURS_TOUS.slice(0, 5);

  // Filtrage enseignant : ne montrer que ses propres matières
  const user = window.EduSen.currentUser;
  const filtrer = user && user.role === 'enseignant';
  const matieresEns = filtrer
    ? new Set((user.assignations || []).filter(a => a.classe === classe).map(a => a.matiere))
    : null;

  const rows = creneaux.map(cren => {
    const horaire = `${cren.debut}-${cren.fin}`;
    if (cren.type === 'pause' || cren.type === 'repas') {
      const label = cren.type === 'repas' ? 'Pause déjeuner' : 'Récréation';
      return `<tr>
        <td style="padding:6px 10px;font-size:11px;color:#888;border:1px solid #ddd;background:#f9f9f9">${horaire}</td>
        ${JOURS.map(() => `<td style="border:1px solid #ddd;background:#f9f9f9;text-align:center;font-size:11px;color:#999;font-style:italic">${label}</td>`).join('')}
      </tr>`;
    }
    return `<tr>
      <td style="padding:6px 10px;font-size:11px;color:#888;border:1px solid #ddd;background:#f9f9f9;white-space:nowrap">${horaire}</td>
      ${JOURS.map(jour => {
        const key = `${jour}_${cren.id}`;
        let cell = edtClasse[key] || {};
        if (filtrer && matieresEns) {
          if (!cell.matiere || !matieresEns.has(cell.matiere)) cell = {};
        }
        const bg = couleurMatiere(cell.matiere);
        return `<td style="padding:5px 8px;border:1px solid #ddd;background:${bg};vertical-align:top">
          ${cell.matiere ? `<div style="font-weight:600;font-size:11px">${escapeHtml(cell.matiere)}</div>` : ''}
          ${cell.enseignant ? `<div style="font-size:10px;color:#666">${escapeHtml(cell.enseignant)}</div>` : ''}
          ${cell.salle ? `<div style="font-size:10px;color:#999">${escapeHtml(cell.salle)}</div>` : ''}
        </td>`;
      }).join('')}
    </tr>`;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Emploi du temps ${classe}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:20px}
    @media print{.no-print{display:none}@page{margin:1cm;size:A4 landscape}}.no-print{margin-bottom:16px;text-align:center}
    </style></head><body>
    <div class="no-print"><button onclick="window.print()" style="padding:8px 20px;background:#1a4731;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ Imprimer</button></div>
    <div style="text-align:center;margin-bottom:16px">
      <h2 style="font-size:16px;color:#1a4731">${escapeHtml(school.nom || 'École')}</h2>
      <p style="font-size:12px;color:#666">Emploi du temps — Classe de ${escapeHtml(classe)} — ${escapeHtml(school.annee || '')}</p>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="padding:8px;background:#1a4731;color:#fff;border:1px solid #0d3522;font-size:11px;width:90px">Horaire</th>
        ${JOURS.map(j => `<th style="padding:8px;background:#1a4731;color:#fff;border:1px solid #0d3522;font-size:12px">${j}</th>`).join('')}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:30px;display:flex;justify-content:space-around;font-size:11px;color:#666">
      <div>Signature du Directeur : _________________</div>
      <div>Date : ${new Date().toLocaleDateString('fr-SN')}</div>
    </div>
    </body></html>`);
  win.document.close();
}

function getEnseignantsAssignes(classe, matiere) {
  if (!matiere) return [];
  return (store.users || []).filter(u =>
    u.role === 'enseignant' &&
    (u.assignations || []).some(a => a.classe === classe && a.matiere === matiere)
  ).map(u => u.nom);
}
