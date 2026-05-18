import { store, initStore, sauvegarderEleve, supprimerEleve, sauvegarderPaiementsInscription, genererID } from '../lib/store.js';
import { formaterDate, escapeHtml, toast } from '../lib/ui.js';

let recherche = '', filtreClasse = '', filtreStatut = '';
let dejaRendu = false;  // savoir si le squelette est déjà rendu

export async function afficherEleves() {
  await initStore();
  dejaRendu = false;  // Toujours re-render le squelette en arrivant sur la page
  rendreSquelette();
}

function rendreSquelette() {
  const c = document.getElementById('page-content');
  const user = window.EduSen.currentUser;
  const peutModifier = user.role === 'admin' || user.role === 'gestionnaire';

  // Classes visibles selon le rôle
  let classesAffichage = [...store.classes];
  if (user.role === 'enseignant') {
    const cl = new Set((user.assignations || []).map(a => a.classe));
    classesAffichage = classesAffichage.filter(c => cl.has(c));
  }

  c.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <input type="text" id="el-search" placeholder="Rechercher un élève, tuteur..." value="${escapeHtml(recherche)}"
          style="flex:1;min-width:200px;padding:8px 12px;border:1px solid var(--border);border-radius:6px"/>
        <select id="el-classe" style="min-width:140px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:#fff">
          <option value="">Toutes les classes</option>
          ${classesAffichage.map(c => `<option value="${c}" ${c === filtreClasse ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <select id="el-statut" style="min-width:140px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:#fff">
          <option value="">Tous les statuts</option>
          <option value="actif" ${filtreStatut === 'actif' ? 'selected' : ''}>Actif</option>
          <option value="inactif" ${filtreStatut === 'inactif' ? 'selected' : ''}>Inactif</option>
          <option value="transfere" ${filtreStatut === 'transfere' ? 'selected' : ''}>Transféré</option>
        </select>
        <span id="el-count" style="font-size:.8rem;color:var(--text-muted)"></span>
        ${peutModifier ? `<button class="btn btn-primary btn-sm" id="btn-ajouter">+ Ajouter</button>` : ''}
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="text-align:left;border-bottom:2px solid var(--border)">
            <th style="padding:10px 8px;font-size:.75rem;color:var(--text-muted);text-transform:uppercase">Élève</th>
            <th style="padding:10px 8px;font-size:.75rem;color:var(--text-muted);text-transform:uppercase">Classe</th>
            <th style="padding:10px 8px;font-size:.75rem;color:var(--text-muted);text-transform:uppercase">Tuteur</th>
            <th style="padding:10px 8px;font-size:.75rem;color:var(--text-muted);text-transform:uppercase">Statut</th>
            ${peutModifier ? `<th style="padding:10px 8px"></th>` : ''}
          </tr></thead>
          <tbody id="el-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  // Events sur les filtres (ne re-render QUE le tbody, pas tout le squelette)
  const searchInput = document.getElementById('el-search');
  searchInput.addEventListener('input', (e) => {
    recherche = e.target.value;
    rendreTbody();
  });
  document.getElementById('el-classe').onchange = (e) => { filtreClasse = e.target.value; rendreTbody(); };
  document.getElementById('el-statut').onchange = (e) => { filtreStatut = e.target.value; rendreTbody(); };

  if (peutModifier) {
    document.getElementById('btn-ajouter').onclick = () => ouvrirModalEleve(null);
  }

  dejaRendu = true;
  rendreTbody();
}

// Re-render UNIQUEMENT le tbody (les filtres restent intacts → pas de perte de focus)
function rendreTbody() {
  const user = window.EduSen.currentUser;
  const peutModifier = user.role === 'admin' || user.role === 'gestionnaire';

  let elevesVisibles = store.eleves;
  if (user.role === 'enseignant') {
    const cl = new Set((user.assignations || []).map(a => a.classe));
    elevesVisibles = elevesVisibles.filter(e => cl.has(e.classe));
  }

  const motsR = recherche.toLowerCase().trim().split(/\s+/).filter(m => m);
  const elvsFiltres = elevesVisibles.filter(e => {
    const blob = `${e.prenom} ${e.nom} ${e.id} ${e.tuteur || ''} ${e.classe}`.toLowerCase();
    const mR = motsR.length === 0 || motsR.every(m => blob.includes(m));
    const mC = !filtreClasse || e.classe === filtreClasse;
    const mS = !filtreStatut || e.statut === filtreStatut;
    return mR && mC && mS;
  });

  const tbody = document.getElementById('el-tbody');
  if (!tbody) return;

  tbody.innerHTML = elvsFiltres.length === 0
    ? `<tr><td colspan="5" style="padding:30px;text-align:center;color:var(--text-muted);font-style:italic">Aucun élève</td></tr>`
    : elvsFiltres.map(e => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 8px">
            <div style="font-weight:600">${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</div>
            <div style="font-size:.72rem;color:var(--text-muted)">${e.id}</div>
          </td>
          <td style="padding:10px 8px">${escapeHtml(e.classe)}</td>
          <td style="padding:10px 8px">${escapeHtml(e.tuteur || '—')}</td>
          <td style="padding:10px 8px">
            <span style="display:inline-block;padding:3px 8px;border-radius:12px;font-size:.72rem;background:${e.statut === 'actif' ? 'var(--green-pale)' : '#fee2e2'};color:${e.statut === 'actif' ? 'var(--green-mid)' : 'var(--red-soft)'}">${e.statut}</span>
          </td>
          ${peutModifier ? `<td style="padding:10px 8px;text-align:right">
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${e.id}">✏️</button>
            <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${e.id}">🗑️</button>
          </td>` : ''}
        </tr>
      `).join('');

  // Mise à jour du compteur
  const cnt = document.getElementById('el-count');
  if (cnt) cnt.textContent = `${elvsFiltres.length} élève${elvsFiltres.length > 1 ? 's' : ''}`;

  // Réattacher les events sur les boutons (tbody recréé)
  if (peutModifier) {
    tbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === 'edit') ouvrirModalEleve(id);
        else if (btn.dataset.action === 'delete') supprimerEleveAction(id);
      };
    });
  }
}

function ouvrirModalEleve(id) {
  const e = id ? store.eleves.find(x => x.id === id) : null;
  const modeEdit = !!e;
  const today = new Date().toISOString().split('T')[0];

  document.body.insertAdjacentHTML('beforeend', `
    <div id="modal-eleve" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px">
      <div style="background:#fff;border-radius:12px;padding:24px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="font-family:var(--font-head);color:var(--green-deep)">${modeEdit ? 'Modifier élève' : 'Nouvel élève'}</h2>
          <button onclick="document.getElementById('modal-eleve').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer">×</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Prénom *</label><input id="m-prenom" value="${e ? escapeHtml(e.prenom) : ''}"/></div>
          <div class="form-group"><label>Nom *</label><input id="m-nom" value="${e ? escapeHtml(e.nom) : ''}"/></div>
          <div class="form-group"><label>Sexe</label><select id="m-sexe"><option value="M" ${e?.sexe === 'M' ? 'selected' : ''}>Garçon</option><option value="F" ${e?.sexe === 'F' ? 'selected' : ''}>Fille</option></select></div>
          <div class="form-group"><label>Date de naissance</label><input type="date" id="m-naissance" value="${e?.dateNaissance || ''}"/></div>
          <div class="form-group"><label>Classe *</label><select id="m-classe">${store.classes.map(c => `<option value="${c}" ${e?.classe === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="form-group"><label>Statut</label><select id="m-statut"><option value="actif" ${e?.statut === 'actif' || !e ? 'selected' : ''}>Actif</option><option value="inactif" ${e?.statut === 'inactif' ? 'selected' : ''}>Inactif</option><option value="transfere" ${e?.statut === 'transfere' ? 'selected' : ''}>Transféré</option></select></div>
          <div class="form-group"><label>Tuteur *</label><input id="m-tuteur" value="${e ? escapeHtml(e.tuteur || '') : ''}"/></div>
          <div class="form-group"><label>Téléphone *</label><input id="m-tel" value="${e ? escapeHtml(e.telephone || '') : ''}"/></div>
          <div class="form-group"><label>Email</label><input type="email" id="m-email" value="${e ? escapeHtml(e.email || '') : ''}"/></div>
          <div class="form-group"><label>Adresse</label><input id="m-adresse" value="${e ? escapeHtml(e.adresse || '') : ''}"/></div>
          <div class="form-group"><label>Date d'inscription</label><input type="date" id="m-dateinsc" value="${e?.dateinscription || today}"/></div>
          <div class="form-group"><label>Frais d'inscription (FCFA)</label><input type="number" id="m-frais" value="${e?.frais || 70000}" min="0" step="500"/></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-eleve').remove()">Annuler</button>
          <button class="btn btn-primary" id="m-save">Enregistrer</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('m-save').onclick = async () => {
    const prenom = document.getElementById('m-prenom').value.trim();
    const nom = document.getElementById('m-nom').value.trim();
    const classe = document.getElementById('m-classe').value;
    const tuteur = document.getElementById('m-tuteur').value.trim();
    const telephone = document.getElementById('m-tel').value.trim();

    if (!prenom || !nom || !classe || !tuteur || !telephone) {
      toast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    const frais = parseInt(document.getElementById('m-frais').value) || 0;
    const eleve = {
      id: modeEdit ? e.id : genererID(),
      prenom, nom, classe, tuteur, telephone,
      sexe: document.getElementById('m-sexe').value,
      dateNaissance: document.getElementById('m-naissance').value,
      email: document.getElementById('m-email').value.trim(),
      adresse: document.getElementById('m-adresse').value.trim(),
      statut: document.getElementById('m-statut').value,
      dateinscription: document.getElementById('m-dateinsc').value,
      frais,
      paye: frais  // Soldé automatiquement
    };

    await sauvegarderEleve(eleve);

    // Créer une entrée dans l'historique des paiements
    if (!modeEdit && frais > 0) {
      store.paiementsInscription.push({
        id: 'P' + Date.now().toString(36).toUpperCase(),
        type: 'inscription',
        eleveId: eleve.id,
        eleveNom: `${prenom} ${nom}`,
        classe,
        montant: frais,
        date: new Date().toISOString().split('T')[0],
        mode: 'Inscription (paiement initial)'
      });
      await sauvegarderPaiementsInscription();
    }

    const enLigne = window.EduSen.onlineStatus === 'online';
    const suff = enLigne ? '' : ' (hors ligne — sera synchronisé)';
    toast(modeEdit ? `Élève modifié${suff}` : `${prenom} ${nom} inscrit(e)${suff}`, 'success');
    document.getElementById('modal-eleve').remove();
    rendreTbody();  // Re-render uniquement le tableau, pas tout
  };
}

async function supprimerEleveAction(id) {
  const e = store.eleves.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`Supprimer définitivement ${e.prenom} ${e.nom} ?\n\nCette action est irréversible.`)) return;
  await supprimerEleve(id);
  toast('Élève supprimé', 'success');
  rendreTbody();  // Re-render uniquement le tableau
}
