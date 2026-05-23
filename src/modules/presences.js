import { store, initStore, sauvegarderPresences } from '../lib/store.js';
import { escapeHtml, toast, formaterDate } from '../lib/ui.js';

// ============================================================
//  HELPERS COMMUNS
// ============================================================

function presKey(date, eleveId) {
  return `${date}__${eleveId}`;
}

function aujourdhui() {
  return new Date().toISOString().split('T')[0];
}

// Ajoute n jours à une date YYYY-MM-DD et retourne la nouvelle au même format
function decalerDate(dateStr, jours) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + jours);
  return d.toISOString().split('T')[0];
}

// Liste des dates entre deux bornes incluses
function listerDates(debut, fin) {
  const dates = [];
  let cur = debut;
  while (cur <= fin) {
    dates.push(cur);
    cur = decalerDate(cur, 1);
  }
  return dates;
}

// Récupère la plage horaire déjà enregistrée pour cette classe + date
// Retourne { heureDebut, heureFin } ou null
function getPlageEnregistree(classe, date) {
  const elevesClasse = store.eleves.filter(e => e.classe === classe && e.statut === 'actif');
  for (const e of elevesClasse) {
    const entry = store.presences[presKey(date, e.id)];
    if (entry && entry.heureDebut && entry.heureFin) {
      return { heureDebut: entry.heureDebut, heureFin: entry.heureFin };
    }
  }
  return null;
}

// Récupère TOUTES les plages distinctes enregistrées pour une classe et une date
// Retourne un tableau trié par heure de début : [{ heureDebut, heureFin }, ...]
function getToutesPlages(classe, date) {
  const elevesClasse = store.eleves.filter(e => e.classe === classe && e.statut === 'actif');
  const plagesMap = new Map();
  elevesClasse.forEach(e => {
    const entry = store.presences[presKey(date, e.id)];
    if (entry && entry.heureDebut && entry.heureFin) {
      const cle = `${entry.heureDebut}__${entry.heureFin}`;
      plagesMap.set(cle, { heureDebut: entry.heureDebut, heureFin: entry.heureFin });
    }
  });
  return [...plagesMap.values()].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
}

function validerPlageHoraire(debut, fin) {
  if (!debut || !fin) return { ok: false, message: 'Veuillez renseigner l\'heure de début et l\'heure de fin.' };
  if (debut >= fin) return { ok: false, message: 'L\'heure de fin doit être après l\'heure de début.' };
  return { ok: true };
}

// Couleur + libellé pour un statut
function getStatutInfo(statut) {
  switch (statut) {
    case 'present': return { libelle: 'Présent', icone: '✓', couleur: '#2d7a4f', fond: '#e8f5ee' };
    case 'absent': return { libelle: 'Absent', icone: '✗', couleur: '#e05252', fond: '#fee2e2' };
    case 'retard': return { libelle: 'Retard', icone: '⏰', couleur: '#c9933a', fond: '#fef3c7' };
    default: return { libelle: '—', icone: '', couleur: '#9aa399', fond: '#f3f4f6' };
  }
}

// ============================================================
//  POINT D'ENTRÉE — route vers la vue enseignant ou consultation
// ============================================================

export async function afficherPresences() {
  await initStore();
  const user = window.EduSen.currentUser;
  if (user.role === 'enseignant') {
    afficherVueEnseignant();
  } else {
    // Admin et gestionnaire : vue consultation
    afficherVueConsultation();
  }
}

// ============================================================
//  VUE ENSEIGNANT — saisie sur aujourd'hui avec plage horaire
// ============================================================

function afficherVueEnseignant() {
  const c = document.getElementById('page-content');
  const user = window.EduSen.currentUser;

  // Classes assignées à l'enseignant
  let classes = [...store.classes];
  const cl = new Set((user.assignations || []).map(a => a.classe));
  classes = classes.filter(c => cl.has(c));
  if (classes.length === 0) { c.innerHTML = `<div class="card">Aucune classe disponible.</div>`; return; }

  const classeActuelle = document.getElementById('p-classe')?.value || classes[0];
  const dateSel = aujourdhui();
  const eleves = store.eleves.filter(e => e.classe === classeActuelle && e.statut === 'actif');

  const plageEnregistree = getPlageEnregistree(classeActuelle, dateSel);
  const dejaEnregistre = plageEnregistree !== null;

  const heureDebutInit = document.getElementById('p-heure-debut')?.value
    || (plageEnregistree ? plageEnregistree.heureDebut : '');
  const heureFinInit = document.getElementById('p-heure-fin')?.value
    || (plageEnregistree ? plageEnregistree.heureFin : '');

  const infoBanniere = dejaEnregistre
    ? `<div style="background:#e8f5ee;border-left:4px solid #2d7a4f;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:.85rem">
        ℹ️ <strong>Présences déjà enregistrées aujourd'hui</strong> pour la plage <strong>${heureDebutInit} - ${heureFinInit}</strong>. Vous pouvez modifier les valeurs mais pas changer la plage horaire.
      </div>`
    : `<div style="background:#fef9c3;border-left:4px solid #c9933a;padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:.85rem">
        ⏰ <strong>Définissez la plage horaire</strong> de votre cours avant d'enregistrer les présences. Vous ne pourrez enregistrer qu'<strong>une seule fois par jour</strong> pour cette classe.
      </div>`;

  c.innerHTML = `
    ${infoBanniere}
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <select id="p-classe" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#fff">
        ${classes.map(cl => `<option value="${cl}" ${cl === classeActuelle ? 'selected' : ''}>${cl}</option>`).join('')}
      </select>
      <input type="date" id="p-date" value="${dateSel}" disabled style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#f5f5f5;color:#666" title="Vous ne pouvez enregistrer que les présences du jour"/>
      <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:#f9fdf9;border:1px solid var(--border);border-radius:6px">
        <span style="font-size:.85rem;color:var(--text-mid);font-weight:600">🕐 Plage :</span>
        <input type="time" id="p-heure-debut" value="${heureDebutInit}" ${dejaEnregistre ? 'disabled' : ''} style="padding:5px 8px;border:1px solid var(--border);border-radius:4px;${dejaEnregistre ? 'background:#f5f5f5;color:#666' : ''}"/>
        <span style="color:var(--text-mid)">→</span>
        <input type="time" id="p-heure-fin" value="${heureFinInit}" ${dejaEnregistre ? 'disabled' : ''} style="padding:5px 8px;border:1px solid var(--border);border-radius:4px;${dejaEnregistre ? 'background:#f5f5f5;color:#666' : ''}"/>
      </div>
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

  document.getElementById('p-classe').onchange = afficherVueEnseignant;

  document.getElementById('p-save').onclick = async () => {
    const heureDebut = document.getElementById('p-heure-debut')?.value || '';
    const heureFin = document.getElementById('p-heure-fin')?.value || '';
    const validation = validerPlageHoraire(heureDebut, heureFin);
    if (!validation.ok) { toast(validation.message, 'error'); return; }

    if (dejaEnregistre && plageEnregistree) {
      if (heureDebut !== plageEnregistree.heureDebut || heureFin !== plageEnregistree.heureFin) {
        toast('La plage horaire ne peut pas être modifiée pour un enregistrement existant.', 'error');
        return;
      }
    }

    eleves.forEach(e => {
      const statut = document.querySelector(`input[name="pr-${e.id}"]:checked`)?.value || 'present';
      const justif = document.querySelector(`input[data-eleve="${e.id}"][data-champ="justif"]`)?.value || '';
      store.presences[presKey(dateSel, e.id)] = { statut, justif, heureDebut, heureFin };
    });
    await sauvegarderPresences();
    toast('Présences enregistrées', 'success');
    afficherVueEnseignant();
  };
}

// ============================================================
//  VUE CONSULTATION — admin & gestionnaire (lecture seule)
// ============================================================
// État local de la vue (préservé entre les rafraîchissements)
const consultState = {
  classe: null,
  dateDebut: null,
  dateFin: null,
  vue: 'tableau'  // 'tableau' ou 'chronologique'
};

function afficherVueConsultation() {
  const c = document.getElementById('page-content');
  const classes = [...store.classes];
  if (classes.length === 0) { c.innerHTML = `<div class="card">Aucune classe disponible.</div>`; return; }

  // Initialisation de l'état au premier affichage
  if (!consultState.classe) consultState.classe = classes[0];
  if (!consultState.dateDebut) consultState.dateDebut = aujourdhui();
  if (!consultState.dateFin) consultState.dateFin = aujourdhui();

  // Mise à jour depuis les contrôles s'ils existent
  consultState.classe = document.getElementById('p-classe')?.value || consultState.classe;
  consultState.dateDebut = document.getElementById('p-date-debut')?.value || consultState.dateDebut;
  consultState.dateFin = document.getElementById('p-date-fin')?.value || consultState.dateFin;

  // Validation : date de fin >= date de début
  if (consultState.dateFin < consultState.dateDebut) {
    consultState.dateFin = consultState.dateDebut;
  }

  c.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <select id="p-classe" style="padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:#fff">
        ${classes.map(cl => `<option value="${cl}" ${cl === consultState.classe ? 'selected' : ''}>${cl}</option>`).join('')}
      </select>

      <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:#f9fdf9;border:1px solid var(--border);border-radius:6px">
        <span style="font-size:.85rem;color:var(--text-mid);font-weight:600">📅 Du :</span>
        <input type="date" id="p-date-debut" value="${consultState.dateDebut}" max="${aujourdhui()}" style="padding:5px 8px;border:1px solid var(--border);border-radius:4px"/>
        <span style="color:var(--text-mid)">→</span>
        <input type="date" id="p-date-fin" value="${consultState.dateFin}" max="${aujourdhui()}" style="padding:5px 8px;border:1px solid var(--border);border-radius:4px"/>
      </div>

      <div style="display:flex;background:#f1f5f9;border-radius:6px;padding:3px;gap:2px">
        <button class="btn-vue ${consultState.vue === 'tableau' ? 'actif' : ''}" data-vue="tableau" style="padding:5px 12px;border:none;border-radius:4px;font-size:.85rem;cursor:pointer;${consultState.vue === 'tableau' ? 'background:#fff;color:var(--green-deep);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.08)' : 'background:transparent;color:var(--text-mid)'}">📊 Tableau</button>
        <button class="btn-vue ${consultState.vue === 'chronologique' ? 'actif' : ''}" data-vue="chronologique" style="padding:5px 12px;border:none;border-radius:4px;font-size:.85rem;cursor:pointer;${consultState.vue === 'chronologique' ? 'background:#fff;color:var(--green-deep);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.08)' : 'background:transparent;color:var(--text-mid)'}">📋 Chronologique</button>
      </div>

      <button class="btn btn-sm" id="p-print" style="background:#c9933a;color:#fff">🖨️ Imprimer</button>
    </div>

    <div id="p-vue-content"></div>
  `;

  // Rendu de la vue choisie
  rendreContenuConsultation();

  // ===== ÉVÉNEMENTS =====
  document.getElementById('p-classe').onchange = afficherVueConsultation;
  document.getElementById('p-date-debut').onchange = afficherVueConsultation;
  document.getElementById('p-date-fin').onchange = afficherVueConsultation;

  document.querySelectorAll('.btn-vue').forEach(btn => {
    btn.onclick = () => {
      consultState.vue = btn.dataset.vue;
      afficherVueConsultation();
    };
  });

  document.getElementById('p-print').onclick = () => {
    imprimerPresences(consultState.classe, consultState.dateDebut, consultState.dateFin);
  };
}

function rendreContenuConsultation() {
  const container = document.getElementById('p-vue-content');
  if (!container) return;

  if (consultState.vue === 'tableau') {
    container.innerHTML = rendreVueTableau(consultState.classe, consultState.dateDebut, consultState.dateFin);
  } else {
    container.innerHTML = rendreVueChronologique(consultState.classe, consultState.dateDebut, consultState.dateFin);
  }
}

// ----- VUE TABLEAU : 1 ligne par élève, colonnes = (jour, plage) -----
function rendreVueTableau(classe, dateDebut, dateFin) {
  const eleves = store.eleves.filter(e => e.classe === classe && e.statut === 'actif')
    .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr') || (a.prenom || '').localeCompare(b.prenom || '', 'fr'));

  if (eleves.length === 0) {
    return `<div class="card"><p style="color:var(--text-muted);font-style:italic">Aucun élève actif dans cette classe.</p></div>`;
  }

  const dates = listerDates(dateDebut, dateFin);

  // Construit les colonnes : pour chaque jour, lister les plages distinctes enregistrées
  // Si aucune plage enregistrée, on garde la colonne du jour avec un "—"
  const colonnes = [];  // [{ date, heureDebut, heureFin }] OU [{ date, vide:true }]
  dates.forEach(date => {
    const plages = getToutesPlages(classe, date);
    if (plages.length === 0) {
      colonnes.push({ date, vide: true });
    } else {
      plages.forEach(p => colonnes.push({ date, heureDebut: p.heureDebut, heureFin: p.heureFin }));
    }
  });

  if (colonnes.length === 0) {
    return `<div class="card"><p style="color:var(--text-muted);font-style:italic">Aucune donnée pour cette période.</p></div>`;
  }

  // Compteurs par élève
  const stats = {};
  eleves.forEach(e => { stats[e.id] = { present: 0, absent: 0, retard: 0 }; });

  // En-tête : 2 niveaux (jour + plage)
  const headerJours = [];
  let lastDate = null;
  let groupCount = 0;
  colonnes.forEach((col, idx) => {
    if (col.date !== lastDate) {
      if (lastDate !== null) {
        headerJours.push({ date: lastDate, count: groupCount });
      }
      lastDate = col.date;
      groupCount = 1;
    } else {
      groupCount++;
    }
    if (idx === colonnes.length - 1) {
      headerJours.push({ date: lastDate, count: groupCount });
    }
  });

  return `
    <div class="card" style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:600px;font-size:.85rem">
        <thead>
          <tr style="background:var(--green-deep);color:#fff">
            <th rowspan="2" style="padding:8px;text-align:left;position:sticky;left:0;background:var(--green-deep);min-width:160px;border:1px solid #2d5a3f">Élève</th>
            ${headerJours.map(g => `<th colspan="${g.count}" style="padding:8px;text-align:center;border:1px solid #2d5a3f">${formaterDate(g.date)}</th>`).join('')}
            <th rowspan="2" style="padding:8px;text-align:center;border:1px solid #2d5a3f;min-width:140px;background:#16344a">Récapitulatif</th>
          </tr>
          <tr style="background:#2d5a3f;color:#fff;font-size:.78rem">
            ${colonnes.map(col => col.vide
              ? `<th style="padding:5px 6px;text-align:center;border:1px solid #2d5a3f;font-weight:400;font-style:italic;opacity:.6">—</th>`
              : `<th style="padding:5px 6px;text-align:center;border:1px solid #2d5a3f;font-weight:600">${col.heureDebut}<br/>${col.heureFin}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
          ${eleves.map((e, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
              <td style="padding:8px;font-weight:600;position:sticky;left:0;background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border:1px solid var(--border)">
                ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}
              </td>
              ${colonnes.map(col => {
                if (col.vide) {
                  return `<td style="padding:5px;text-align:center;border:1px solid var(--border);color:#ccc">—</td>`;
                }
                const entry = store.presences[presKey(col.date, e.id)];
                if (!entry || !entry.heureDebut || entry.heureDebut !== col.heureDebut || entry.heureFin !== col.heureFin) {
                  return `<td style="padding:5px;text-align:center;border:1px solid var(--border);color:#ccc">—</td>`;
                }
                const info = getStatutInfo(entry.statut);
                if (stats[e.id]) stats[e.id][entry.statut] = (stats[e.id][entry.statut] || 0) + 1;
                return `<td style="padding:5px;text-align:center;border:1px solid var(--border);background:${info.fond};color:${info.couleur};font-weight:700" title="${info.libelle}${entry.justif ? ' — ' + escapeHtml(entry.justif) : ''}">${info.icone}</td>`;
              }).join('')}
              <td style="padding:5px 8px;text-align:center;border:1px solid var(--border);background:#f9fafb;font-size:.78rem">
                <span style="color:#2d7a4f">✓${stats[e.id].present}</span>
                &nbsp;<span style="color:#e05252">✗${stats[e.id].absent}</span>
                &nbsp;<span style="color:#c9933a">⏰${stats[e.id].retard}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top:14px;padding:10px;background:#f9fafb;border-radius:6px;font-size:.78rem;display:flex;gap:18px;flex-wrap:wrap">
        <span><span style="display:inline-block;width:16px;height:16px;background:#e8f5ee;color:#2d7a4f;font-weight:700;text-align:center;border-radius:3px;line-height:16px">✓</span> Présent</span>
        <span><span style="display:inline-block;width:16px;height:16px;background:#fee2e2;color:#e05252;font-weight:700;text-align:center;border-radius:3px;line-height:16px">✗</span> Absent</span>
        <span><span style="display:inline-block;width:16px;height:16px;background:#fef3c7;color:#c9933a;font-weight:700;text-align:center;border-radius:3px;line-height:16px">⏰</span> Retard</span>
        <span style="color:var(--text-muted)">— : pas de cours / pas de saisie</span>
      </div>
    </div>
  `;
}

// ----- VUE CHRONOLOGIQUE : groupée par jour, puis par plage horaire -----
function rendreVueChronologique(classe, dateDebut, dateFin) {
  const eleves = store.eleves.filter(e => e.classe === classe && e.statut === 'actif')
    .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr') || (a.prenom || '').localeCompare(b.prenom || '', 'fr'));

  if (eleves.length === 0) {
    return `<div class="card"><p style="color:var(--text-muted);font-style:italic">Aucun élève actif dans cette classe.</p></div>`;
  }

  const dates = listerDates(dateDebut, dateFin);
  const blocsJour = [];

  dates.forEach(date => {
    const plages = getToutesPlages(classe, date);
    if (plages.length === 0) return; // On saute les jours sans aucune saisie

    const blocsPlages = plages.map(plage => {
      // Collecte les présences pour cette plage
      const lignes = eleves.map(e => {
        const entry = store.presences[presKey(date, e.id)];
        if (!entry || entry.heureDebut !== plage.heureDebut || entry.heureFin !== plage.heureFin) {
          return null;
        }
        return { eleve: e, entry };
      }).filter(Boolean);

      const compt = { present: 0, absent: 0, retard: 0 };
      lignes.forEach(l => { compt[l.entry.statut] = (compt[l.entry.statut] || 0) + 1; });

      if (lignes.length === 0) return '';

      return `
        <div style="margin-bottom:14px;border:1px solid var(--border);border-radius:6px;overflow:hidden">
          <div style="background:#f9fdf9;padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center">
            <div style="font-weight:600;color:var(--green-deep)">🕐 ${plage.heureDebut} - ${plage.heureFin}</div>
            <div style="display:flex;gap:14px;font-size:.82rem">
              <span style="color:#2d7a4f">✓ ${compt.present} présent${compt.present > 1 ? 's' : ''}</span>
              <span style="color:#e05252">✗ ${compt.absent} absent${compt.absent > 1 ? 's' : ''}</span>
              <span style="color:#c9933a">⏰ ${compt.retard} retard${compt.retard > 1 ? 's' : ''}</span>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            <thead>
              <tr style="background:#f1f5f9">
                <th style="padding:8px;text-align:left;border-bottom:1px solid var(--border)">Élève</th>
                <th style="padding:8px;text-align:center;border-bottom:1px solid var(--border);width:100px">Statut</th>
                <th style="padding:8px;text-align:left;border-bottom:1px solid var(--border)">Justification</th>
              </tr>
            </thead>
            <tbody>
              ${lignes.map(l => {
                const info = getStatutInfo(l.entry.statut);
                return `<tr style="border-bottom:1px solid #f1f5f9">
                  <td style="padding:8px"><strong>${escapeHtml(l.eleve.prenom)} ${escapeHtml(l.eleve.nom)}</strong></td>
                  <td style="padding:8px;text-align:center">
                    <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${info.fond};color:${info.couleur}">${info.icone} ${info.libelle}</span>
                  </td>
                  <td style="padding:8px;color:var(--text-mid);font-size:.82rem">${l.entry.justif ? escapeHtml(l.entry.justif) : '<span style="color:#ccc">—</span>'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    blocsJour.push(`
      <div class="card" style="margin-bottom:18px">
        <div style="font-family:var(--font-head);font-size:1.1rem;color:var(--green-deep);font-weight:700;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid var(--green-pale)">
          📅 ${formaterDate(date)}
        </div>
        ${blocsPlages}
      </div>
    `);
  });

  if (blocsJour.length === 0) {
    return `<div class="card"><p style="color:var(--text-muted);font-style:italic">Aucune présence enregistrée pour cette période.</p></div>`;
  }

  return blocsJour.join('');
}

// ============================================================
//  IMPRESSION
// ============================================================
function imprimerPresences(classe, dateDebut, dateFin) {
  const eleves = store.eleves.filter(e => e.classe === classe && e.statut === 'actif')
    .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr') || (a.prenom || '').localeCompare(b.prenom || '', 'fr'));

  if (eleves.length === 0) {
    toast('Aucun élève dans cette classe', 'error');
    return;
  }

  const dates = listerDates(dateDebut, dateFin);
  const s = store.school || {};

  // Drapeau Sénégal
  const drapeau = `<svg width="36" height="24" viewBox="0 0 900 600" style="display:inline-block;vertical-align:middle;margin-right:8px"><rect width="300" height="600" x="0" fill="#00853f"/><rect width="300" height="600" x="300" fill="#fdef42"/><rect width="300" height="600" x="600" fill="#e31b23"/><polygon fill="#00853f" points="450,225 467.6,279.2 524.6,279.2 478.5,312.7 496.1,366.9 450,333.4 403.9,366.9 421.5,312.7 375.4,279.2 432.4,279.2"/></svg>`;

  // Construction des blocs par jour
  const blocsJour = dates.map(date => {
    const plages = getToutesPlages(classe, date);
    if (plages.length === 0) return '';

    // Compteurs totaux du jour
    const totalJour = { present: 0, absent: 0, retard: 0 };

    const blocsPlages = plages.map(plage => {
      const lignes = eleves.map(e => {
        const entry = store.presences[presKey(date, e.id)];
        if (!entry || entry.heureDebut !== plage.heureDebut || entry.heureFin !== plage.heureFin) return null;
        return { eleve: e, entry };
      }).filter(Boolean);

      if (lignes.length === 0) return '';

      const compt = { present: 0, absent: 0, retard: 0 };
      lignes.forEach(l => { compt[l.entry.statut] = (compt[l.entry.statut] || 0) + 1; });
      totalJour.present += compt.present;
      totalJour.absent += compt.absent;
      totalJour.retard += compt.retard;

      return `
        <div style="margin-bottom:14px">
          <div style="background:#f9fdf9;padding:8px 12px;border:1px solid #dde5d9;border-bottom:none;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;font-size:12px">
            <strong>🕐 ${plage.heureDebut} - ${plage.heureFin}</strong>
            <span>Présents: ${compt.present} · Absents: ${compt.absent} · Retards: ${compt.retard}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="background:#1a4731;color:#fff">
                <th style="padding:5px 8px;text-align:left;border:1px solid #1a4731">Élève</th>
                <th style="padding:5px 8px;text-align:center;border:1px solid #1a4731;width:80px">Statut</th>
                <th style="padding:5px 8px;text-align:left;border:1px solid #1a4731">Justification</th>
              </tr>
            </thead>
            <tbody>
              ${lignes.map(l => {
                const info = getStatutInfo(l.entry.statut);
                return `<tr>
                  <td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(l.eleve.prenom)} ${escapeHtml(l.eleve.nom)}</td>
                  <td style="padding:4px 8px;text-align:center;border:1px solid #ddd;color:${info.couleur};font-weight:700">${info.libelle}</td>
                  <td style="padding:4px 8px;border:1px solid #ddd">${l.entry.justif ? escapeHtml(l.entry.justif) : ''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    return `
      <div style="margin-bottom:24px;page-break-inside:avoid">
        <div style="background:#1a4731;color:#fff;padding:8px 14px;border-radius:4px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;font-size:13px">
          <strong>📅 ${formaterDate(date)}</strong>
          <span style="font-size:11px">Total : ✓ ${totalJour.present} présents &nbsp;·&nbsp; ✗ ${totalJour.absent} absents &nbsp;·&nbsp; ⏰ ${totalJour.retard} retards</span>
        </div>
        ${blocsPlages}
      </div>
    `;
  }).filter(Boolean).join('');

  const contenuHtml = blocsJour || '<p style="text-align:center;color:#999;font-style:italic;padding:40px">Aucune présence enregistrée pour cette période.</p>';

  // Total général sur la période
  let totalGeneral = { present: 0, absent: 0, retard: 0 };
  dates.forEach(date => {
    eleves.forEach(e => {
      const entry = store.presences[presKey(date, e.id)];
      if (entry && entry.statut) totalGeneral[entry.statut] = (totalGeneral[entry.statut] || 0) + 1;
    });
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Présences ${classe} - ${dateDebut} au ${dateFin}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:sans-serif;padding:20px;color:#333}
      @media print{.no-print{display:none}@page{margin:1cm;size:landscape}}
      table{width:100%;border-collapse:collapse}
    </style></head><body>

    <div class="no-print" style="text-align:center;margin-bottom:20px">
      <button onclick="window.print()" style="padding:10px 24px;background:#1a4731;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:14px">🖨️ Imprimer</button>
    </div>

    <!-- Bandeau République du Sénégal -->
    <div style="text-align:center;margin-bottom:12px">
      ${drapeau}
      <span style="font-size:12px;font-weight:600;letter-spacing:.05em;vertical-align:middle">REPUBLIQUE DU SENEGAL</span>
    </div>

    <!-- En-tête école -->
    <div style="text-align:center;margin-bottom:16px;padding:12px;border:1px solid #dde5d9;border-radius:8px;background:#f9fdf9">
      <div style="font-size:16px;font-weight:700;color:#1a4731">${escapeHtml(s.nom || '')}</div>
      <div style="font-size:11px;color:#666;margin-top:2px">${escapeHtml(s.ville || '')}${s.telephone ? ' · Tel: ' + escapeHtml(s.telephone) : ''} · Année scolaire ${escapeHtml(s.annee || '')}</div>
    </div>

    <!-- Titre du rapport -->
    <div style="background:#1a4731;color:#fff;padding:10px;text-align:center;border-radius:4px;margin-bottom:14px">
      <strong>RAPPORT DE PRÉSENCES</strong><br>
      <span style="font-size:13px">Classe : ${escapeHtml(classe)} &nbsp;·&nbsp; Du ${formaterDate(dateDebut)} au ${formaterDate(dateFin)}</span>
    </div>

    <!-- Récapitulatif global -->
    <div style="margin-bottom:18px;padding:10px 14px;border:1px solid #dde5d9;border-radius:6px;background:#f9fdf9;display:flex;gap:24px;justify-content:center;flex-wrap:wrap;font-size:13px">
      <div><strong>📊 Total sur la période :</strong></div>
      <div style="color:#2d7a4f"><strong>Présents :</strong> ${totalGeneral.present}</div>
      <div style="color:#e05252"><strong>Absents :</strong> ${totalGeneral.absent}</div>
      <div style="color:#c9933a"><strong>Retards :</strong> ${totalGeneral.retard}</div>
    </div>

    ${contenuHtml}

    <div style="margin-top:30px;padding-top:14px;border-top:1px solid #ddd;font-size:11px;color:#666;display:flex;justify-content:space-between">
      <span>Document généré le ${formaterDate(aujourdhui())}</span>
      <span>${escapeHtml(s.nom || '')}</span>
    </div>

    </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { toast('Veuillez autoriser les pop-ups pour imprimer', 'error'); return; }
  win.document.write(html);
  win.document.close();
}
