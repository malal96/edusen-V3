import { store, initStore, sauvegarderPresences } from '../lib/store.js';
import { escapeHtml, toast, formaterDate } from '../lib/ui.js';

function presKey(date, eleveId) {
  return `${date}__${eleveId}`;
}

// Date du jour au format YYYY-MM-DD
function aujourdhui() {
  return new Date().toISOString().split('T')[0];
}

// Récupère la plage horaire déjà enregistrée pour cette classe + date
// (si tous les élèves ont la même plage). Retourne null sinon.
function getPlageEnregistree(classe, date) {
  const elevesClasse = store.eleves.filter(e => e.classe === classe && e.statut === 'actif');
  const plages = new Set();
  let auMoinsUn = false;
  elevesClasse.forEach(e => {
    const entry = store.presences[presKey(date, e.id)];
    if (entry && entry.heureDebut && entry.heureFin) {
      plages.add(`${entry.heureDebut}__${entry.heureFin}`);
      auMoinsUn = true;
    }
  });
  if (!auMoinsUn) return null;
  // Si plusieurs plages différentes (cas exceptionnel), on prend la première
  const premiere = [...plages][0].split('__');
  return { heureDebut: premiere[0], heureFin: premiere[1] };
}

// Vérifie si une classe a déjà été enregistrée aujourd'hui (au moins un élève)
function aDejaEnregistreAujourdhui(classe, date) {
  return getPlageEnregistree(classe, date) !== null;
}

// Validation d'une plage horaire : HH:MM valide, fin > début
function validerPlageHoraire(debut, fin) {
  if (!debut || !fin) return { ok: false, message: 'Veuillez renseigner l\'heure de début et l\'heure de fin.' };
  if (debut >= fin) return { ok: false, message: 'L\'heure de fin doit être après l\'heure de début.' };
  return { ok: true };
}

export async function afficherPresences() {
  await initStore();
  const c = document.getElementById('page-content');
  const user = window.EduSen.currentUser;
  const estAdmin = user.role === 'admin';
  const estEnseignant = user.role === 'enseignant';
  const estGestionnaire = user.role === 'gestionnaire';

  let classes = [...store.classes];
  if (estEnseignant) {
    const cl = new Set((user.assignations || []).map(a => a.classe));
    classes = classes.filter(c => cl.has(c));
  }
  if (classes.length === 0) { c.innerHTML = `<div class="card">Aucune classe disponible.</div>`; return; }

  const classeActuelle = document.getElementById('p-classe')?.value || classes[0];

  // ===== GESTION DE LA DATE =====
  // - Admin : peut choisir n'importe quelle date
  // - Enseignant : forcée à aujourd'hui
  // - Gestionnaire : peut consulter n'importe quelle date (lecture seule)
  let dateSel;
  if (estEnseignant) {
    dateSel = aujourdhui();
  } else {
    dateSel = document.getElementById('p-date')?.value || aujourdhui();
  }

  const eleves = store.eleves.filter(e => e.classe === classeActuelle && e.statut === 'actif');

  // ===== POUR L'ENSEIGNANT : détermination de la plage horaire =====
  // S'il a déjà enregistré aujourd'hui, on impose sa plage existante (modification possible).
  // Sinon, on laisse les champs vides et il devra les remplir avant d'enregistrer.
  const plageEnregistree = (estEnseignant || estGestionnaire || estAdmin)
    ? getPlageEnregistree(classeActuelle, dateSel)
    : null;
  const dejaEnregistre = plageEnregistree !== null;

  // Valeurs initiales des champs horaires (lues depuis le DOM s'il existe déjà, sinon depuis l'enregistrement)
  const heureDebutInit = document.getElementById('p-heure-debut')?.value
    || (plageEnregistree ? plageEnregistree.heureDebut : '');
  const heureFinInit = document.getElementById('p-heure-fin')?.value
    || (plageEnregistree ? plageEnregistree.heureFin : '');

  // ===== CONSTRUCTION DE L'EN-TÊTE (sélecteurs + plage horaire) =====
  let infoBanniere = '';
  if (estEnseignant) {
    if (dejaEnregistre) {
      infoBanniere = `<div style="background:#e8f5ee;border-left:4px solid #2d7a4f;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:.85rem">
        ℹ️ <strong>Présences déjà enregistrées aujourd'hui</strong> pour la plage <strong>${heureDebutInit} - ${heureFinInit}</strong>. Vous pouvez modifier les valeurs mais pas changer la plage horaire.
      </div>`;
    } else {
      infoBanniere = `<div style="background:#fef9c3;border-left:4px solid #c9933a;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:.85rem">
        ⏰ <strong>Définissez la plage horaire</strong> de votre cours avant d'enregistrer les présences. Vous ne pourrez enregistrer qu'<strong>une seule fois par jour</strong> pour cette classe.
      </div>`;
    }
  } else if (estGestionnaire) {
    infoBanniere = `<div style="background:#fef9c3;border-left:4px solid #c9933a;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:.85rem">
      <strong>Mode lecture seule :</strong> vous pouvez consulter les présences mais pas les modifier.
    </div>`;
  }

  // Champ date : verrouillé pour l'enseignant, libre pour admin/gestionnaire
  const dateInputHtml = estEnseignant
    ? `<input type="date" id="p-date" value="${dateSel}" disabled style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#f5f5f5;color:#666" title="Vous ne pouvez enregistrer que les présences du jour"/>`
    : `<input type="date" id="p-date" value="${dateSel}" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px"/>`;

  // Champs plage horaire : visibles uniquement pour l'enseignant
  // Verrouillés si la plage est déjà fixée par un enregistrement existant
  const plageHtml = estEnseignant ? `
    <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:#f9fdf9;border:1px solid var(--border);border-radius:6px">
      <span style="font-size:.85rem;color:var(--text-mid);font-weight:600">🕐 Plage :</span>
      <input type="time" id="p-heure-debut" value="${heureDebutInit}" ${dejaEnregistre ? 'disabled' : ''} style="padding:5px 8px;border:1px solid var(--border);border-radius:4px;${dejaEnregistre ? 'background:#f5f5f5;color:#666' : ''}"/>
      <span style="color:var(--text-mid)">→</span>
      <input type="time" id="p-heure-fin" value="${heureFinInit}" ${dejaEnregistre ? 'disabled' : ''} style="padding:5px 8px;border:1px solid var(--border);border-radius:4px;${dejaEnregistre ? 'background:#f5f5f5;color:#666' : ''}"/>
    </div>
  ` : '';

  // Bouton enregistrer : caché pour le gestionnaire
  const boutonHtml = estGestionnaire
    ? ''
    : `<button class="btn btn-primary btn-sm" id="p-save">💾 Enregistrer</button>`;

  // ===== LECTURE SEULE : pour gestionnaire OU si on veut bloquer l'enseignant =====
  // L'enseignant peut toujours modifier (sur la plage existante), donc lectureSeule = estGestionnaire uniquement
  const lectureSeule = estGestionnaire;

  c.innerHTML = `
    ${infoBanniere}
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <select id="p-classe" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#fff">
        ${classes.map(cl => `<option value="${cl}" ${cl === classeActuelle ? 'selected' : ''}>${cl}</option>`).join('')}
      </select>
      ${dateInputHtml}
      ${plageHtml}
      ${boutonHtml}
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
                  <input type="radio" name="pr-${e.id}" value="${st}" ${cur.statut === st ? 'checked' : ''} ${lectureSeule ? 'disabled' : ''} data-eleve="${e.id}" data-champ="statut"/>
                </td>`).join('')}
                <td style="padding:10px"><input type="text" data-eleve="${e.id}" data-champ="justif" value="${escapeHtml(cur.justif || '')}" placeholder="(optionnel)" ${lectureSeule ? 'readonly' : ''} style="width:100%;padding:5px;border:1px solid var(--border);border-radius:4px;font-size:.8rem${lectureSeule ? ';background:#f9f9f9' : ''}"/></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  // ===== ÉVÉNEMENTS =====
  document.getElementById('p-classe').onchange = afficherPresences;
  const dateInput = document.getElementById('p-date');
  if (dateInput && !estEnseignant) {
    dateInput.onchange = afficherPresences;
  }

  // Bouton Enregistrer
  const btnSave = document.getElementById('p-save');
  if (btnSave) {
    btnSave.onclick = async () => {
      // ===== VALIDATION DE LA PLAGE HORAIRE POUR L'ENSEIGNANT =====
      let heureDebut = '';
      let heureFin = '';
      if (estEnseignant) {
        heureDebut = document.getElementById('p-heure-debut')?.value || '';
        heureFin = document.getElementById('p-heure-fin')?.value || '';
        const validation = validerPlageHoraire(heureDebut, heureFin);
        if (!validation.ok) {
          toast(validation.message, 'error');
          return;
        }
        // Vérification de cohérence : si plage déjà enregistrée, on doit utiliser la même
        if (dejaEnregistre && plageEnregistree) {
          if (heureDebut !== plageEnregistree.heureDebut || heureFin !== plageEnregistree.heureFin) {
            toast('La plage horaire ne peut pas être modifiée pour un enregistrement existant.', 'error');
            return;
          }
        }
      } else if (estAdmin) {
        // L'admin peut renseigner une plage s'il veut (champs absents pour l'instant, mais on récupère au cas où)
        heureDebut = document.getElementById('p-heure-debut')?.value || '';
        heureFin = document.getElementById('p-heure-fin')?.value || '';
      }

      // ===== ENREGISTREMENT DES PRÉSENCES =====
      eleves.forEach(e => {
        const statut = document.querySelector(`input[name="pr-${e.id}"]:checked`)?.value || 'present';
        const justif = document.querySelector(`input[data-eleve="${e.id}"][data-champ="justif"]`)?.value || '';
        const entry = { statut, justif };
        // Ajouter la plage horaire si renseignée
        if (heureDebut && heureFin) {
          entry.heureDebut = heureDebut;
          entry.heureFin = heureFin;
        }
        store.presences[presKey(dateSel, e.id)] = entry;
      });
      await sauvegarderPresences();
      toast('Présences enregistrées', 'success');
      // Rafraîchir l'affichage pour montrer la bannière "déjà enregistré"
      afficherPresences();
    };
  }
}
