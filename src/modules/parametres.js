import { store, initStore, sauvegarderEcole, sauvegarderParametres } from '../lib/store.js';
import { trierClassesScolaire, DEFAULT_MATIERES, DEFAULT_COEFFICIENTS } from '../lib/constants.js';
import { getAllUsers, createUser, updateUser, deleteUser } from '../lib/auth.js';
import { escapeHtml, toast, formaterFCFA } from '../lib/ui.js';

let matieresClasseActive = null;  // classe sélectionnée dans la gestion des matières

export async function afficherParametres() {
  await initStore();
  // Charger les utilisateurs
  store.users = await getAllUsers();
  const user = window.EduSen.currentUser;
  const estAdmin = user.role === 'admin';
  const c = document.getElementById('page-content');

  if (!estAdmin) {
    c.innerHTML = `<div class="card"><div class="card-title">Mon compte</div>
      <div style="margin-bottom:12px"><strong>Nom :</strong> ${escapeHtml(user.nom)}</div>
      <div style="margin-bottom:12px"><strong>Identifiant :</strong> ${escapeHtml(user.login)}</div>
      <div style="margin-bottom:12px"><strong>Rôle :</strong> ${escapeHtml(user.role)}</div>
      <p style="font-size:.85rem;color:var(--text-muted);margin-top:16px">Pour changer votre mot de passe, contactez l'administrateur.</p>
    </div>`;
    return;
  }

  c.innerHTML = `
    <div style="display:grid;gap:20px">
      <div class="card">
        <div class="card-title">🏫 Informations de l'école</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Nom de l'école *</label><input id="p-nom" value="${escapeHtml(store.school.nom || '')}"/></div>
          <div class="form-group"><label>Ville</label><input id="p-ville" value="${escapeHtml(store.school.ville || '')}"/></div>
          <div class="form-group"><label>Téléphone</label><input id="p-tel" value="${escapeHtml(store.school.telephone || '')}"/></div>
          <div class="form-group"><label>Directeur / Directrice</label><input id="p-dir" value="${escapeHtml(store.school.directeur || '')}"/></div>
          <div class="form-group"><label>Année scolaire</label><input id="p-annee" value="${escapeHtml(store.school.annee || '')}"/></div>
          <div class="form-group"><label>IEF / IA</label><input id="p-ief" value="${escapeHtml(store.school.ief || '')}" placeholder="Ex: IEF / IA DE DIOURBEL"/></div>
        </div>

        <!-- Upload Logo de l'école -->
        <div style="margin-top:16px;padding:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface2)">
          <div style="font-weight:600;color:var(--green-deep);margin-bottom:6px">🏫 Logo de l'école (apparait sur le bulletin)</div>
          <p style="font-size:.78rem;color:var(--text-muted);margin-bottom:12px">Le logo du Ministère est intégré automatiquement. Ajoutez ici le logo de votre école.<br/>Formats : PNG, JPG, SVG, WebP. Taille max : 500 Ko.</p>
          <div style="display:flex;gap:12px;align-items:center">
            <div id="p-logo2-apercu" style="width:80px;height:80px;border:1px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;background:#fff;flex-shrink:0;overflow:hidden">
              ${store.school.logo2 ? `<img src="${store.school.logo2}" style="max-width:100%;max-height:100%;object-fit:contain"/>` : '<span style="font-size:.75rem;color:var(--text-muted)">Logo 2</span>'}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <button class="btn btn-ghost btn-sm" id="p-logo2-choose" type="button">📁 Choisir une image</button>
              <button class="btn btn-danger btn-sm" id="p-logo2-remove" type="button" style="${store.school.logo2 ? '' : 'display:none'}">🗑️ Supprimer</button>
            </div>
            <input type="file" id="p-logo2-input" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" style="display:none"/>
          </div>
        </div>

        <button class="btn btn-primary" id="p-save-ecole" style="margin-top:16px">💾 Enregistrer</button>
      </div>

      <div class="card">
        <div class="card-title">🎓 Classes</div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input id="p-classe-new" placeholder="Nom de la nouvelle classe (ex: 6ème C)" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px"/>
          <button class="btn btn-primary" id="p-classe-add">+ Ajouter</button>
        </div>
        <div id="p-classes-list"></div>
      </div>

      <div class="card">
        <div class="card-title">📚 Matières par classe</div>
        <p style="font-size:.82rem;color:var(--text-mid);margin-bottom:14px">Sélectionnez une classe, puis ajoutez / modifiez / supprimez les matières et leurs coefficients.</p>
        <div style="display:flex;gap:10px;align-items:end;margin-bottom:14px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px"><label style="display:block;font-size:.85rem;color:var(--text-mid);margin-bottom:6px">Classe</label>
            <select id="p-mat-classe" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px">
              ${store.classes.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-ghost btn-sm" id="p-mat-reset" title="Restaurer les matières par défaut">↻ Réinitialiser</button>
        </div>
        <div id="p-matieres-list"></div>
        <div style="display:flex;gap:8px;margin-top:14px;padding:12px;background:var(--surface2);border-radius:8px;border:1px dashed var(--border);align-items:end;flex-wrap:wrap">
          <div style="flex:1;min-width:160px"><label style="display:block;font-size:.78rem;color:var(--text-muted);margin-bottom:4px">Nom de la matière</label>
            <input id="p-mat-new-nom" placeholder="Ex: Informatique" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:5px"/>
          </div>
          <div><label style="display:block;font-size:.78rem;color:var(--text-muted);margin-bottom:4px">Coef.</label>
            <input type="number" id="p-mat-new-coef" min="1" max="10" step="1" value="2" style="width:70px;padding:7px;border:1px solid var(--border);border-radius:5px;text-align:center"/>
          </div>
          <button class="btn btn-primary btn-sm" id="p-mat-add">+ Ajouter une matière</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🚪 Salles</div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input id="p-salle-new" placeholder="Nom de la nouvelle salle" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px"/>
          <button class="btn btn-primary" id="p-salle-add">+ Ajouter</button>
        </div>
        <div id="p-salles-list"></div>
      </div>

      <div class="card">
        <div class="card-title">👥 Utilisateurs</div>
        <button class="btn btn-primary btn-sm" id="p-user-add" style="margin-bottom:14px">+ Créer un utilisateur</button>
        <div id="p-users-list"></div>
      </div>
    </div>
  `;

  document.getElementById('p-save-ecole').onclick = async () => {
    await sauvegarderEcole({
      nom: document.getElementById('p-nom').value.trim(),
      ville: document.getElementById('p-ville').value.trim(),
      telephone: document.getElementById('p-tel').value.trim(),
      directeur: document.getElementById('p-dir').value.trim(),
      annee: document.getElementById('p-annee').value.trim(),
      ief: document.getElementById('p-ief').value.trim()
    });
    toast('Informations enregistrées', 'success');
  };

  // ===== Gestion du Logo 2 =====
  document.getElementById('p-logo2-choose').onclick = () => document.getElementById('p-logo2-input').click();
  document.getElementById('p-logo2-input').onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast('Image trop volumineuse (max 500 Ko)', 'error');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      toast('Format non supporté (PNG, JPG, SVG, WebP uniquement)', 'error');
      return;
    }
    // Redimensionner l'image à 200x200 max avec un canvas
    const reader = new FileReader();
    reader.onload = async (e) => {
      const src = e.target.result;
      if (file.type === 'image/svg+xml') {
        // SVG : on garde tel quel
        await sauvegarderEcole({ logo2: src });
        toast('Logo enregistré', 'success');
        afficherParametres();
        return;
      }
      // Image bitmap : redimensionner via canvas
      const img = new Image();
      img.onload = async () => {
        const maxSize = 200;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png');
        await sauvegarderEcole({ logo2: dataUrl });
        toast('Logo enregistré', 'success');
        afficherParametres();
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    ev.target.value = '';  // Reset pour permettre re-upload
  };

  document.getElementById('p-logo2-remove').onclick = async () => {
    if (!confirm('Supprimer le logo de l\'école ?')) return;
    await sauvegarderEcole({ logo2: '' });
    toast('Logo supprimé', 'success');
    afficherParametres();
  };

  rendreClasses();
  rendreSalles();
  rendreUsers();

  // Init classe active pour matières
  if (!matieresClasseActive || !store.classes.includes(matieresClasseActive)) {
    matieresClasseActive = store.classes[0] || null;
  }
  if (document.getElementById('p-mat-classe')) {
    document.getElementById('p-mat-classe').value = matieresClasseActive;
  }
  rendreMatieres();

  document.getElementById('p-classe-add').onclick = async () => {
    const nom = document.getElementById('p-classe-new').value.trim();
    if (!nom) return;
    if (store.classes.includes(nom)) { toast('Cette classe existe déjà', 'error'); return; }
    store.classes.push(nom);
    store.classes = trierClassesScolaire(store.classes);
    if (!store.matieres[nom]) store.matieres[nom] = [];
    if (!store.mensualitesClasse[nom]) store.mensualitesClasse[nom] = 20000;
    await sauvegarderParametres();
    document.getElementById('p-classe-new').value = '';
    rendreClasses();
    toast(`Classe "${nom}" ajoutée`, 'success');
  };

  document.getElementById('p-salle-add').onclick = async () => {
    const nom = document.getElementById('p-salle-new').value.trim();
    if (!nom) return;
    if (store.salles.includes(nom)) { toast('Cette salle existe déjà', 'error'); return; }
    store.salles.push(nom);
    await sauvegarderParametres();
    document.getElementById('p-salle-new').value = '';
    rendreSalles();
    toast(`Salle "${nom}" ajoutée`, 'success');
  };

  document.getElementById('p-user-add').onclick = () => ouvrirModalUtilisateur(null);

  // ===== Events matières =====
  document.getElementById('p-mat-classe').onchange = (e) => {
    matieresClasseActive = e.target.value;
    rendreMatieres();
  };

  document.getElementById('p-mat-add').onclick = async () => {
    if (!matieresClasseActive) { toast('Sélectionnez une classe', 'error'); return; }
    const nom = document.getElementById('p-mat-new-nom').value.trim();
    const coef = parseInt(document.getElementById('p-mat-new-coef').value) || 1;
    if (!nom) { toast('Saisissez le nom de la matière', 'error'); return; }
    if (!store.matieres[matieresClasseActive]) store.matieres[matieresClasseActive] = [];
    if (store.matieres[matieresClasseActive].includes(nom)) {
      toast(`La matière "${nom}" existe déjà dans cette classe`, 'error');
      return;
    }
    store.matieres[matieresClasseActive].push(nom);
    store.coefficients[nom] = coef;
    await sauvegarderParametres();
    document.getElementById('p-mat-new-nom').value = '';
    document.getElementById('p-mat-new-coef').value = '2';
    rendreMatieres();
    toast(`Matière "${nom}" ajoutée`, 'success');
  };

  document.getElementById('p-mat-reset').onclick = async () => {
    if (!matieresClasseActive) return;
    if (!confirm(`Restaurer les matières par défaut pour ${matieresClasseActive} ?\n\nLes matières actuelles seront remplacées.`)) return;
    const defaut = DEFAULT_MATIERES[matieresClasseActive];
    if (!defaut) {
      toast(`Aucune valeur par défaut pour ${matieresClasseActive}`, 'error');
      return;
    }
    store.matieres[matieresClasseActive] = [...defaut];
    // Réinjecter les coefficients par défaut pour ces matières
    defaut.forEach(m => {
      if (DEFAULT_COEFFICIENTS[m] !== undefined) store.coefficients[m] = DEFAULT_COEFFICIENTS[m];
    });
    await sauvegarderParametres();
    rendreMatieres();
    toast('Matières réinitialisées', 'success');
  };
}

function rendreClasses() {
  document.getElementById('p-classes-list').innerHTML = store.classes.map(c => {
    const nbE = store.eleves.filter(e => e.classe === c).length;
    const mens = store.mensualitesClasse[c] || 0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border)">
      <div style="flex:1"><strong>${escapeHtml(c)}</strong> <small style="color:var(--text-muted)">— ${nbE} élève${nbE>1?'s':''}</small></div>
      <label style="font-size:.75rem;color:var(--text-muted)">Mensualité :</label>
      <input type="number" min="0" step="500" value="${mens}" data-mens-classe="${c}" style="width:100px;padding:5px;border:1px solid var(--border);border-radius:4px;text-align:right"/>
      <span style="font-size:.75rem;color:var(--text-muted)">FCFA</span>
      <button class="btn btn-ghost btn-sm" data-del-classe="${c}">🗑️</button>
    </div>`;
  }).join('');

  document.querySelectorAll('[data-mens-classe]').forEach(inp => {
    inp.onchange = async () => {
      store.mensualitesClasse[inp.dataset.mensClasse] = parseInt(inp.value) || 0;
      await sauvegarderParametres();
      toast('Mensualité mise à jour', 'success');
    };
  });
  document.querySelectorAll('[data-del-classe]').forEach(b => {
    b.onclick = async () => {
      const c = b.dataset.delClasse;
      const nb = store.eleves.filter(e => e.classe === c).length;
      if (nb > 0) { toast(`Impossible : ${nb} élève(s) dans cette classe`, 'error'); return; }
      if (!confirm(`Supprimer la classe "${c}" ?`)) return;
      store.classes = store.classes.filter(x => x !== c);
      delete store.matieres[c];
      delete store.mensualitesClasse[c];
      await sauvegarderParametres();
      rendreClasses();
      toast('Classe supprimée', 'success');
    };
  });
}

function rendreMatieres() {
  const el = document.getElementById('p-matieres-list');
  if (!el) return;
  if (!matieresClasseActive) {
    el.innerHTML = '<div style="padding:14px;color:var(--text-muted);font-style:italic;text-align:center">Sélectionnez une classe</div>';
    return;
  }
  const matieres = store.matieres[matieresClasseActive] || [];
  // Compter le nombre de notes par matière (pour avertissement à la suppression)
  function compterNotes(matiere) {
    let n = 0;
    Object.keys(store.notes).forEach(k => {
      // k = "eleveId__matiere__trimestre"
      const parts = k.split('__');
      if (parts.length === 3 && parts[1] === matiere) n++;
    });
    return n;
  }

  if (matieres.length === 0) {
    el.innerHTML = '<div style="padding:14px;color:var(--text-muted);font-style:italic;text-align:center;border:1px solid var(--border);border-radius:8px">Aucune matière configurée pour cette classe.<br/>Ajoutez-en une ci-dessous ou utilisez « Réinitialiser » pour restaurer les matières par défaut.</div>';
    return;
  }
  el.innerHTML = `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
    ${matieres.map(m => {
      const coef = store.coefficients[m] || 1;
      const nbNotes = compterNotes(m);
      const safe = m.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);background:#fff">
        <div style="flex:1">
          <div style="font-weight:600">${escapeHtml(m)}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">${nbNotes > 0 ? `${nbNotes} note${nbNotes > 1 ? 's' : ''} enregistrée${nbNotes > 1 ? 's' : ''}` : 'Aucune note'}</div>
        </div>
        <label style="font-size:.72rem;color:var(--text-muted)">Coef. :</label>
        <input type="number" min="1" max="10" step="1" value="${coef}" data-mat-coef="${escapeHtml(m)}" style="width:60px;padding:5px;border:1px solid var(--border);border-radius:4px;text-align:center"/>
        <button class="btn btn-ghost btn-sm" data-mat-edit="${escapeHtml(m)}" title="Renommer">✏️</button>
        <button class="btn btn-ghost btn-sm" data-mat-del="${escapeHtml(m)}" title="Supprimer">🗑️</button>
      </div>
    `;
    }).join('')}
  </div>`;

  // Events sur chaque ligne
  document.querySelectorAll('[data-mat-coef]').forEach(inp => {
    inp.onchange = async () => {
      const m = inp.dataset.matCoef;
      store.coefficients[m] = parseInt(inp.value) || 1;
      await sauvegarderParametres();
      toast(`Coefficient de "${m}" mis à jour`, 'success');
    };
  });

  document.querySelectorAll('[data-mat-edit]').forEach(b => {
    b.onclick = async () => {
      const ancien = b.dataset.matEdit;
      const nouveau = prompt(`Renommer la matière "${ancien}" :`, ancien);
      if (!nouveau || nouveau.trim() === '' || nouveau === ancien) return;
      const nv = nouveau.trim();
      if (store.matieres[matieresClasseActive].includes(nv)) {
        toast(`La matière "${nv}" existe déjà`, 'error');
        return;
      }
      // Remplacer dans la liste de la classe
      const idx = store.matieres[matieresClasseActive].indexOf(ancien);
      if (idx !== -1) store.matieres[matieresClasseActive][idx] = nv;
      // Transférer le coefficient
      if (store.coefficients[ancien] !== undefined) {
        store.coefficients[nv] = store.coefficients[ancien];
        // On ne supprime pas l'ancien coef car il peut être utilisé dans une autre classe
      }
      // Mettre à jour les notes
      const nouvellesNotes = {};
      Object.keys(store.notes).forEach(k => {
        const parts = k.split('__');
        if (parts.length === 3 && parts[1] === ancien) {
          nouvellesNotes[`${parts[0]}__${nv}__${parts[2]}`] = store.notes[k];
        } else {
          nouvellesNotes[k] = store.notes[k];
        }
      });
      store.notes = nouvellesNotes;
      await sauvegarderParametres();
      const { sauvegarderNotes } = await import('../lib/store.js');
      await sauvegarderNotes();
      rendreMatieres();
      toast(`Matière renommée en "${nv}"`, 'success');
    };
  });

  document.querySelectorAll('[data-mat-del]').forEach(b => {
    b.onclick = async () => {
      const m = b.dataset.matDel;
      const nbN = compterNotes(m);
      let msg = `Supprimer la matière "${m}" de la classe ${matieresClasseActive} ?`;
      if (nbN > 0) {
        msg += `\n\n⚠️ Attention : ${nbN} note${nbN > 1 ? 's' : ''} enregistrée${nbN > 1 ? 's' : ''} pour cette matière. Les notes ne seront pas supprimées mais ne s'afficheront plus.`;
      }
      if (!confirm(msg)) return;
      store.matieres[matieresClasseActive] = store.matieres[matieresClasseActive].filter(x => x !== m);
      await sauvegarderParametres();
      rendreMatieres();
      toast(`Matière "${m}" supprimée`, 'success');
    };
  });
}

function rendreSalles() {
  const el = document.getElementById('p-salles-list');
  if (store.salles.length === 0) {
    el.innerHTML = '<div style="padding:14px;color:var(--text-muted);font-style:italic;text-align:center">Aucune salle configurée</div>';
    return;
  }
  el.innerHTML = store.salles.map(s => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border)">
      <div style="flex:1"><strong>${escapeHtml(s)}</strong></div>
      <button class="btn btn-ghost btn-sm" data-del-salle="${s}">🗑️</button>
    </div>
  `).join('');
  document.querySelectorAll('[data-del-salle]').forEach(b => {
    b.onclick = async () => {
      const s = b.dataset.delSalle;
      if (!confirm(`Supprimer la salle "${s}" ?`)) return;
      store.salles = store.salles.filter(x => x !== s);
      await sauvegarderParametres();
      rendreSalles();
      toast('Salle supprimée', 'success');
    };
  });
}

function rendreUsers() {
  const el = document.getElementById('p-users-list');
  el.innerHTML = store.users.map(u => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <strong>${escapeHtml(u.nom)}</strong>
        <span style="font-size:.72rem;background:var(--green-pale);color:var(--green-mid);padding:2px 8px;border-radius:10px;margin-left:8px">${u.role}</span>
        <div style="font-size:.78rem;color:var(--text-muted)">Login: ${escapeHtml(u.login)}</div>
      </div>
      ${u.role !== 'admin' ? `<button class="btn btn-ghost btn-sm" data-del-user="${u.id}">🗑️</button>` : ''}
    </div>
  `).join('');
  document.querySelectorAll('[data-del-user]').forEach(b => {
    b.onclick = async () => {
      const u = store.users.find(x => x.id === b.dataset.delUser);
      if (!confirm(`Supprimer le compte de "${u.nom}" ?`)) return;
      await deleteUser(u.id);
      store.users = await getAllUsers();
      rendreUsers();
      toast('Utilisateur supprimé', 'success');
    };
  });
}

function ouvrirModalUtilisateur(id) {
  const modeEdit = !!id;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="modal-user" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px">
      <div style="background:#fff;border-radius:12px;padding:24px;max-width:500px;width:100%">
        <h2 style="font-family:var(--font-head);color:var(--green-deep);margin-bottom:16px">Nouvel utilisateur</h2>
        <div class="form-group"><label>Nom complet *</label><input id="u-nom"/></div>
        <div class="form-group"><label>Identifiant (login) *</label><input id="u-login"/></div>
        <div class="form-group"><label>Mot de passe *</label><input id="u-pwd" type="password" placeholder="Au moins 6 caractères"/></div>
        <div class="form-group"><label>Rôle *</label>
          <select id="u-role">
            <option value="enseignant">Enseignant</option>
            <option value="gestionnaire">Gestionnaire</option>
          </select>
        </div>
        <div id="u-assignations-container"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-user').remove()">Annuler</button>
          <button class="btn btn-primary" id="u-save">Créer</button>
        </div>
      </div>
    </div>
  `);

  function rendreAssignations() {
    const role = document.getElementById('u-role').value;
    const cont = document.getElementById('u-assignations-container');
    if (role !== 'enseignant') { cont.innerHTML = ''; return; }
    cont.innerHTML = `
      <div class="form-group"><label>Assignations (classe + matière)</label>
        <div style="background:var(--surface2);padding:10px;border-radius:8px;max-height:200px;overflow-y:auto">
          ${store.classes.map(cl => (store.matieres[cl] || []).map(m => `
            <label style="display:flex;align-items:center;gap:6px;padding:4px;font-size:.82rem"><input type="checkbox" data-assign="${cl}|${m}"/> ${cl} — ${m}</label>
          `).join('')).join('')}
        </div>
      </div>
    `;
  }
  document.getElementById('u-role').onchange = rendreAssignations;
  rendreAssignations();

  document.getElementById('u-save').onclick = async () => {
    const nom = document.getElementById('u-nom').value.trim();
    const login = document.getElementById('u-login').value.trim().toLowerCase();
    const pwd = document.getElementById('u-pwd').value;
    const role = document.getElementById('u-role').value;
    if (!nom || !login || pwd.length < 6) { toast('Champs requis : nom, login, mot de passe (≥6 car.)', 'error'); return; }
    const assignations = [...document.querySelectorAll('[data-assign]:checked')].map(cb => {
      const [classe, matiere] = cb.dataset.assign.split('|');
      return { classe, matiere };
    });
    try {
      await createUser({ login, nom, role, motdepasse: pwd, assignations, pageAccueil: role === 'enseignant' ? 'bulletins' : 'dashboard' });
      toast('Utilisateur créé', 'success');
      document.getElementById('modal-user').remove();
      store.users = await getAllUsers();
      rendreUsers();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
}
