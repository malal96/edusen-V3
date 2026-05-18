import { store, initStore, sauvegarderPresences } from '../lib/store.js';
import { escapeHtml, toast, formaterDate } from '../lib/ui.js';

function presKey(date, eleveId) {
  return `${date}__${eleveId}`;
}

export async function afficherPresences() {
  await initStore();
  const c = document.getElementById('page-content');
  const user = window.EduSen.currentUser;
  let classes = [...store.classes];
  if (user.role === 'enseignant') {
    const cl = new Set((user.assignations || []).map(a => a.classe));
    classes = classes.filter(c => cl.has(c));
  }
  if (classes.length === 0) { c.innerHTML = `<div class="card">Aucune classe disponible.</div>`; return; }

  const classeActuelle = document.getElementById('p-classe')?.value || classes[0];
  const dateSel = document.getElementById('p-date')?.value || new Date().toISOString().split('T')[0];

  const eleves = store.eleves.filter(e => e.classe === classeActuelle && e.statut === 'actif');

  c.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <select id="p-classe" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#fff">
        ${classes.map(cl => `<option value="${cl}" ${cl === classeActuelle ? 'selected' : ''}>${cl}</option>`).join('')}
      </select>
      <input type="date" id="p-date" value="${dateSel}" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px"/>
      <button class="btn btn-primary btn-sm" id="p-save">💾 Enregistrer</button>
    </div>
    <div class="card">
      ${eleves.length === 0 ? '<p style="color:var(--text-muted);font-style:italic">Aucun élève actif dans cette classe.</p>' : `
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:2px solid var(--border)"><th style="padding:10px;text-align:left">Élève</th><th style="padding:10px;text-align:center">Présent</th><th style="padding:10px;text-align:center">Absent</th><th style="padding:10px;text-align:center">Retard</th><th style="padding:10px;text-align:left">Justification</th></tr></thead>
          <tbody>
            ${eleves.map(e => {
              const cur = store.presences[presKey(dateSel, e.id)] || { statut: 'present', justif: '' };
              return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px"><strong>${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</strong></td>
                ${['present', 'absent', 'retard'].map(st => `<td style="padding:10px;text-align:center">
                  <input type="radio" name="pr-${e.id}" value="${st}" ${cur.statut === st ? 'checked' : ''} data-eleve="${e.id}" data-champ="statut"/>
                </td>`).join('')}
                <td style="padding:10px"><input type="text" data-eleve="${e.id}" data-champ="justif" value="${escapeHtml(cur.justif || '')}" placeholder="(optionnel)" style="width:100%;padding:5px;border:1px solid var(--border);border-radius:4px;font-size:.8rem"/></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  document.getElementById('p-classe').onchange = afficherPresences;
  document.getElementById('p-date').onchange = afficherPresences;
  document.getElementById('p-save').onclick = async () => {
    eleves.forEach(e => {
      const statut = document.querySelector(`input[name="pr-${e.id}"]:checked`)?.value || 'present';
      const justif = document.querySelector(`input[data-eleve="${e.id}"][data-champ="justif"]`)?.value || '';
      store.presences[presKey(dateSel, e.id)] = { statut, justif };
    });
    await sauvegarderPresences();
    toast('Présences enregistrées', 'success');
  };
}
