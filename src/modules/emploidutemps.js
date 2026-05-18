import { store, initStore, sauvegarderEDT, sauvegarderParametres } from '../lib/store.js';
import { escapeHtml, toast } from '../lib/ui.js';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

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

  c.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <select id="edt-classe" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#fff">
        ${classes.map(cl => `<option value="${cl}" ${cl === classeActuelle ? 'selected' : ''}>${cl}</option>`).join('')}
      </select>
      ${!lectureSeule ? `<button class="btn btn-danger btn-sm" id="edt-reinit">Réinitialiser</button>` : ''}
    </div>
    ${!lectureSeule ? `<div style="background:#e0f2fe;border-left:4px solid #2563eb;padding:10px;border-radius:6px;margin-bottom:14px;font-size:.8rem"><strong>💡 Astuce :</strong> Les horaires sont communs à toutes les classes. Sélectionnez matière, enseignant et salle dans chaque case.</div>` : ''}
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
              if (lectureSeule) {
                return `<td style="padding:6px;border:1px solid var(--border);background:${cell.matiere ? '#dbeafe' : '#fff'};font-size:.78rem">
                  ${cell.matiere ? `<div style="font-weight:600">${escapeHtml(cell.matiere)}</div>` : ''}
                  ${cell.enseignant ? `<div style="font-size:.7rem;color:var(--text-muted)">${escapeHtml(cell.enseignant)}</div>` : ''}
                  ${cell.salle ? `<div style="font-size:.68rem;color:var(--text-muted)">${escapeHtml(cell.salle)}</div>` : ''}
                </td>`;
              }
              return `<td style="padding:4px;border:1px solid var(--border);background:${cell.matiere ? '#dbeafe' : '#fff'};vertical-align:top">
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
  if (!lectureSeule) {
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

function getEnseignantsAssignes(classe, matiere) {
  if (!matiere) return [];
  return (store.users || []).filter(u =>
    u.role === 'enseignant' &&
    (u.assignations || []).some(a => a.classe === classe && a.matiere === matiere)
  ).map(u => u.nom);
}
