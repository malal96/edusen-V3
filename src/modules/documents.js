import { store, initStore } from '../lib/store.js';
import { escapeHtml, toast, formaterDate } from '../lib/ui.js';

export async function afficherDocuments() {
  await initStore();
  const c = document.getElementById('page-content');

  // Liste unique de toutes les matières de l'école
  const setM = new Set();
  store.classes.forEach(cl => (store.matieres[cl] || []).forEach(m => setM.add(m)));
  const matieresEcole = [...setM].sort();

  c.innerHTML = `
    <div style="display:grid;gap:20px">
      <div class="card">
        <div class="card-title">📋 Liste des élèves par classe</div>
        <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
          <div style="flex:1;min-width:200px"><label style="display:block;font-size:.85rem;color:var(--text-mid);margin-bottom:6px">Classe</label>
            <select id="d-classe" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px">
              ${store.classes.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" id="d-print-list">🖨️ Imprimer la liste</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🎓 Certificat de scolarité</div>
        <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
          <div style="flex:1;min-width:200px"><label style="display:block;font-size:.85rem;color:var(--text-mid);margin-bottom:6px">Élève</label>
            <select id="d-eleve-cert" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px">
              <option value="">— Choisir un élève —</option>
              ${store.eleves.filter(e => e.statut === 'actif').map(e => `<option value="${e.id}">${escapeHtml(e.nom.toUpperCase())} ${escapeHtml(e.prenom)} — ${e.classe}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" id="d-print-cert">🖨️ Imprimer</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📨 Convocations</div>
        <p style="font-size:.85rem;color:var(--text-mid);margin-bottom:14px">Générez une convocation individuelle ou collective (classe entière ou tous les parents).</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div class="form-group"><label>Destinataire</label>
            <select id="conv-dest">
              <option value="tous">Tous les parents (toutes classes)</option>
              ${store.classes.map(c => `<option value="${c}">Classe ${c}</option>`).join('')}
              <optgroup label="Élève individuel">
                ${store.eleves.filter(e => e.statut === 'actif').map(e => `<option value="eleve_${e.id}">${escapeHtml(e.nom.toUpperCase())} ${escapeHtml(e.prenom)} (${e.classe})</option>`).join('')}
              </optgroup>
            </select>
          </div>
          <div class="form-group"><label>Motif / Objet</label>
            <select id="conv-motif-select">
              <option value="">-- Choisir ou saisir --</option>
              <option value="Réunion de parents d'élèves">Réunion de parents d'élèves</option>
              <option value="Entretien concernant le comportement de votre enfant">Comportement de l'élève</option>
              <option value="Entretien concernant les résultats scolaires de votre enfant">Résultats scolaires</option>
              <option value="Régularisation des frais de scolarité">Régularisation des frais</option>
              <option value="Remise des bulletins de notes">Remise des bulletins</option>
              <option value="custom">Autre motif (personnalisé)...</option>
            </select>
          </div>
          <div class="form-group" id="conv-motif-custom-group" style="display:none;grid-column:1/-1">
            <label>Motif personnalisé</label>
            <input type="text" id="conv-motif-custom" placeholder="Saisissez le motif..."/>
          </div>
          <div class="form-group"><label>Date de la convocation</label>
            <input type="text" id="conv-date" placeholder="Ex: lundi 20 janvier 2025"/>
          </div>
          <div class="form-group"><label>Heure</label>
            <input type="text" id="conv-heure" placeholder="Ex: 10h00"/>
          </div>
        </div>
        <button class="btn btn-primary" id="d-print-conv">🖨️ Générer la/les convocation(s)</button>
      </div>

      <div class="card">
        <div class="card-title">🏅 Attestation de stage</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div class="form-group"><label>Nom et Prénom du stagiaire *</label><input id="s-nom" placeholder="Ex: Mariama DIOP"/></div>
          <div class="form-group"><label>Date de début</label><input id="s-debut" placeholder="Ex: 02 janvier 2025"/></div>
          <div class="form-group"><label>Date de fin</label><input id="s-fin" placeholder="Ex: 31 janvier 2025"/></div>
          <div class="form-group"><label>Tuteur de stage</label>
            <select id="s-tuteur" disabled><option>— Cochez d'abord une matière —</option></select>
          </div>
        </div>
        <div class="form-group">
          <label>Domaine du stage * <span style="font-weight:400;color:var(--text-muted);font-size:.78rem">(1 ou 2 matières max)</span></label>
          <div id="s-matieres" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);max-height:200px;overflow-y:auto">
            ${matieresEcole.length === 0 ? '<div style="padding:10px;color:var(--text-muted);font-style:italic">Aucune matière configurée</div>' :
              matieresEcole.map(m => `<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-radius:6px"><input type="checkbox" data-mat="${m}" value="${m}"/> <span>${m}</span></label>`).join('')
            }
          </div>
        </div>
        <button class="btn btn-primary" id="d-print-stage">🖨️ Générer l'attestation</button>
      </div>
    </div>
  `;

  document.getElementById('d-print-list').onclick = () => imprimerListe(document.getElementById('d-classe').value);
  document.getElementById('d-print-cert').onclick = () => {
    const id = document.getElementById('d-eleve-cert').value;
    if (!id) { toast('Veuillez choisir un élève', 'error'); return; }
    imprimerCertificat(id);
  };

  // ===== CONVOCATION =====
  // Affichage / masquage du champ "motif personnalisé"
  document.getElementById('conv-motif-select').onchange = (ev) => {
    const grp = document.getElementById('conv-motif-custom-group');
    grp.style.display = ev.target.value === 'custom' ? 'block' : 'none';
  };

  document.getElementById('d-print-conv').onclick = () => {
    const dest = document.getElementById('conv-dest').value;
    const motifSelect = document.getElementById('conv-motif-select').value;
    const motifCustom = document.getElementById('conv-motif-custom').value.trim();
    const motif = motifSelect === 'custom' ? motifCustom : motifSelect;
    const dateConv = document.getElementById('conv-date').value.trim();
    const heureConv = document.getElementById('conv-heure').value.trim();

    if (!motif) { toast('Veuillez choisir ou saisir un motif', 'error'); return; }

    if (dest.startsWith('eleve_')) {
      // Convocation individuelle
      const eleveId = dest.replace('eleve_', '');
      imprimerConvocationIndividuelle(eleveId, motif, dateConv, heureConv);
    } else {
      // Convocation collective : classe ou tous
      imprimerConvocationsCollectives(dest, motif, dateConv, heureConv);
    }
  };

  // Stage : mise à jour des tuteurs
  document.querySelectorAll('[data-mat]').forEach(cb => {
    cb.onchange = () => {
      const cochees = [...document.querySelectorAll('[data-mat]:checked')];
      if (cochees.length > 2) { cb.checked = false; toast('Maximum 2 matières', 'error'); return; }
      const matieresChoisies = cochees.map(c => c.value);
      const tuteurs = new Set();
      (store.users || []).filter(u => u.role === 'enseignant').forEach(u => {
        (u.assignations || []).forEach(a => { if (matieresChoisies.includes(a.matiere)) tuteurs.add(u.nom); });
      });
      const sel = document.getElementById('s-tuteur');
      if (matieresChoisies.length === 0) { sel.innerHTML = '<option>— Cochez d\'abord une matière —</option>'; sel.disabled = true; return; }
      if (tuteurs.size === 0) { sel.innerHTML = '<option>— Aucun enseignant assigné —</option>'; sel.disabled = true; return; }
      sel.innerHTML = '<option value="">— Choisir un tuteur —</option>' + [...tuteurs].sort().map(t => `<option value="${t}">${t}</option>`).join('');
      sel.disabled = false;
    };
  });

  document.getElementById('d-print-stage').onclick = () => {
    const nom = document.getElementById('s-nom').value.trim();
    if (!nom) { toast('Saisissez le nom du stagiaire', 'error'); return; }
    const cochees = [...document.querySelectorAll('[data-mat]:checked')].map(c => c.value);
    if (cochees.length === 0) { toast('Cochez au moins une matière', 'error'); return; }
    const tuteur = document.getElementById('s-tuteur').value;
    if (!tuteur) { toast('Choisissez un tuteur', 'error'); return; }
    imprimerStage(nom, cochees, document.getElementById('s-debut').value, document.getElementById('s-fin').value, tuteur);
  };
}

function entete(titre) {
  const s = store.school;
  return `
    <div style="text-align:center;margin-bottom:12px;font-size:12px;font-weight:600">RÉPUBLIQUE DU SÉNÉGAL</div>
    <div style="text-align:center;margin-bottom:16px;padding:10px;border:1px solid #dde5d9;border-radius:8px">
      <div style="font-size:15px;font-weight:700;color:#1a4731">${escapeHtml(s.nom)}</div>
      <div style="font-size:11px;color:#666">${escapeHtml(s.ville || '')} · Tél: ${escapeHtml(s.telephone || '')}</div>
      <div style="font-size:11px;color:#666">Année scolaire ${escapeHtml(s.annee || '')}</div>
    </div>
    <h2 style="text-align:center;background:#1a4731;color:#fff;padding:8px;border-radius:4px;margin-bottom:16px;font-size:15px">${titre}</h2>`;
}

function imprimerFenetre(html, titre) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${titre}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:30px;max-width:800px;margin:0 auto}
    @media print{.no-print{display:none}@page{margin:1.5cm}}.no-print{margin-bottom:16px;text-align:center}
    table{width:100%;border-collapse:collapse}th,td{padding:6px 10px;border:1px solid #ddd;font-size:13px}
    th{background:#1a4731;color:#fff}</style></head><body>
    <div class="no-print"><button onclick="window.print()" style="padding:8px 20px;background:#1a4731;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ Imprimer</button></div>
    ${html}</body></html>`);
  win.document.close();
}

function imprimerListe(classe) {
  const eleves = store.eleves.filter(e => e.classe === classe && e.statut === 'actif');
  const html = entete(`LISTE DES ÉLÈVES — ${classe}`) + `
    <table><thead><tr><th>N°</th><th>Nom & Prénom</th><th>Date de naissance</th><th>Tuteur</th><th>Téléphone</th><th>Émargement</th></tr></thead>
    <tbody>${eleves.map((e, i) => `<tr><td style="text-align:center">${i+1}</td><td>${escapeHtml(e.nom.toUpperCase())} ${escapeHtml(e.prenom)}</td><td>${formaterDate(e.dateNaissance)}</td><td>${escapeHtml(e.tuteur || '')}</td><td>${escapeHtml(e.telephone || '')}</td><td></td></tr>`).join('')}</tbody></table>
    <p style="margin-top:20px;font-size:12px">Total : <strong>${eleves.length}</strong> élève(s)</p>`;
  imprimerFenetre(html, `Liste ${classe}`);
}

function imprimerCertificat(id) {
  const e = store.eleves.find(x => x.id === id);
  const s = store.school;
  if (!e) return;
  const html = entete('CERTIFICAT DE SCOLARITÉ') + `
    <p style="text-align:right;font-size:12px;color:#666;margin-bottom:18px">Dakar, le ${new Date().toLocaleDateString('fr-SN', {day:'2-digit',month:'long',year:'numeric'})}</p>
    <p style="font-size:13px;line-height:2;margin-bottom:14px">Je soussigné(e), <strong>${escapeHtml(s.directeur || '')}</strong>, Directeur(trice) de l'établissement <strong>${escapeHtml(s.nom)}</strong>, certifie que :</p>
    <div style="border:1.5px solid #1a4731;border-radius:8px;padding:16px;margin:18px 0;background:#f7fbf8;font-size:13px">
      <div><strong>Nom et Prénom :</strong> ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</div>
      <div><strong>Date de naissance :</strong> ${formaterDate(e.dateNaissance)}</div>
      <div><strong>Classe :</strong> ${escapeHtml(e.classe)}</div>
      <div><strong>Année scolaire :</strong> ${escapeHtml(s.annee || '')}</div>
    </div>
    <p style="font-size:13px;line-height:2">est régulièrement inscrit(e) et assidu(e) dans notre établissement.</p>
    <p style="font-size:13px;line-height:2">Ce certificat lui est délivré pour servir et valoir ce que de droit.</p>
    <div style="margin-top:60px;text-align:right;font-size:12px"><strong>Le Directeur</strong><br><br><br>${escapeHtml(s.directeur || '')}</div>`;
  imprimerFenetre(html, `Certificat ${e.prenom} ${e.nom}`);
}

function imprimerStage(nom, matieres, debut, fin, tuteur) {
  const s = store.school;
  const html = entete('ATTESTATION DE STAGE') + `
    <p style="text-align:right;font-size:12px;color:#666;margin-bottom:18px">Dakar, le ${new Date().toLocaleDateString('fr-SN', {day:'2-digit',month:'long',year:'numeric'})}</p>
    <p style="font-size:13px;line-height:2;margin-bottom:14px">Je soussigné(e), <strong>${escapeHtml(s.directeur || '')}</strong>, Directeur(trice) de l'établissement <strong>${escapeHtml(s.nom)}</strong>, certifie que :</p>
    <div style="border:1.5px solid #1a4731;border-radius:8px;padding:16px;margin:18px 0;background:#f7fbf8;font-size:13px">
      <div><strong>Nom et Prénom :</strong> ${escapeHtml(nom)}</div>
      <div><strong>Année scolaire :</strong> ${escapeHtml(s.annee || '')}</div>
    </div>
    <p style="font-size:13px;line-height:2">a effectué un stage pratique dans notre établissement dans le domaine de <strong>${matieres.map(escapeHtml).join(', ')}</strong>, du <strong>${escapeHtml(debut || '____________________')}</strong> au <strong>${escapeHtml(fin || '____________________')}</strong>, sous la supervision de <strong>${escapeHtml(tuteur)}</strong>.</p>
    <p style="font-size:13px;line-height:2;margin-top:14px">Cette attestation lui est délivrée pour servir et valoir ce que de droit.</p>
    <div style="margin-top:60px;display:flex;justify-content:space-between;font-size:12px">
      <div><strong>Le Directeur</strong><br><br><br>${escapeHtml(s.directeur || '')}</div>
      <div><strong>Le Tuteur</strong><br><br><br>${escapeHtml(tuteur)}</div>
    </div>`;
  imprimerFenetre(html, `Attestation ${nom}`);
}

// ============================
//  CONVOCATIONS
// ============================

function imprimerConvocationIndividuelle(eleveId, motif, dateConvoc, heureConvoc) {
  const s = store.school;
  const e = store.eleves.find(x => x.id === eleveId);
  if (!e) return;
  const dateAuj = new Date().toLocaleDateString('fr-SN', {day:'2-digit',month:'long',year:'numeric'});

  const html = entete('CONVOCATION') + `
    <p style="text-align:right;font-size:12px;color:#666;margin-bottom:18px">${escapeHtml(s.ville || 'Dakar')}, le ${dateAuj}</p>
    <p style="font-size:13px;line-height:1.8;margin-bottom:10px">
      <strong>À l'attention de :</strong> ${escapeHtml(e.tuteur)}<br/>
      <strong>Parent/Tuteur de :</strong> ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)} (${escapeHtml(e.classe)})<br/>
      <strong>Contact :</strong> ${escapeHtml(e.telephone)}
    </p>
    <p style="font-size:13px;line-height:1.8;margin-bottom:16px">Monsieur / Madame,</p>
    <p style="font-size:13px;line-height:2;margin-bottom:16px">
      Nous avons l'honneur de vous convoquer à notre établissement
      <strong>${escapeHtml(s.nom || '')}</strong>, sis à <strong>${escapeHtml(s.ville || '')}</strong>,
      ${dateConvoc ? `le <strong>${escapeHtml(dateConvoc)}</strong>` : 'le <strong>____________________</strong>'}
      ${heureConvoc ? `à <strong>${escapeHtml(heureConvoc)}</strong>` : 'à <strong>______ heures</strong>'},
      pour l'objet suivant :
    </p>
    <div style="border-left:4px solid #1a4731;padding:12px 20px;background:#f7fbf8;margin:18px 0;border-radius:0 8px 8px 0">
      <strong style="font-size:13px">${escapeHtml(motif)}</strong>
    </div>
    <p style="font-size:13px;line-height:2;margin-bottom:14px">
      Votre présence est <strong>obligatoire</strong>. En cas d'impossibilité, nous vous prions de bien vouloir
      nous en informer au préalable afin de convenir d'un autre rendez-vous.
    </p>
    <p style="font-size:13px;line-height:2;margin-bottom:30px">
      Dans l'attente de vous recevoir, veuillez agréer, Monsieur / Madame, l'expression de nos salutations distinguées.
    </p>
    <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:12px">
      <div><strong>Le Directeur</strong><br><br><br>${escapeHtml(s.directeur || '')}</div>
      <div><strong>Signature du Parent</strong><br>(retourner ce coupon)<br><br>____________________</div>
    </div>
    <div style="border:1px dashed #aaa;padding:12px 16px;margin-top:30px;border-radius:6px;font-size:11px;color:#666">
      <strong>Coupon à retourner :</strong> Je soussigné(e) <strong>${escapeHtml(e.tuteur)}</strong>, parent/tuteur de
      <strong>${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</strong>, atteste avoir bien reçu la convocation en date du ${dateAuj}.<br/>
      Signature : _________________________ &nbsp;&nbsp; Date : _________________________
    </div>`;
  imprimerFenetre(html, `Convocation — ${e.prenom} ${e.nom}`);
}

function imprimerConvocationsCollectives(classe, motif, dateConvoc, heureConvoc) {
  const s = store.school;
  // Filtrer les élèves (classe spécifique ou tous)
  const elvs = store.eleves
    .filter(e => (classe === 'tous' || e.classe === classe) && e.statut === 'actif')
    .sort((a, b) => a.nom.localeCompare(b.nom));

  if (elvs.length === 0) {
    toast('Aucun élève actif pour cette sélection', 'error');
    return;
  }

  const dateAuj = new Date().toLocaleDateString('fr-SN', {day:'2-digit',month:'long',year:'numeric'});
  const titre = classe === 'tous' ? 'Convocations (tous les parents)' : `Convocations — Classe ${classe}`;

  // Une page par élève (avec saut de page entre chaque)
  const pagesHtml = elvs.map((e, idx) => `
    <div style="page-break-after:${idx < elvs.length - 1 ? 'always' : 'avoid'};padding:30px;max-width:750px;margin:0 auto;font-size:13px;min-height:950px">
      ${entete('CONVOCATION')}
      <p style="text-align:right;font-size:12px;color:#666;margin-bottom:14px">${escapeHtml(s.ville || 'Dakar')}, le ${dateAuj}</p>
      <p style="font-size:13px;line-height:1.8;margin-bottom:10px">
        <strong>À l'attention de :</strong> ${escapeHtml(e.tuteur)}<br/>
        <strong>Parent/Tuteur de :</strong> ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)} (${escapeHtml(e.classe)})<br/>
        <strong>Contact :</strong> ${escapeHtml(e.telephone)}
      </p>
      <p style="font-size:13px;line-height:1.8;margin-bottom:12px">Monsieur / Madame,</p>
      <p style="font-size:13px;line-height:2;margin-bottom:14px">
        Nous avons l'honneur de vous convoquer à notre établissement <strong>${escapeHtml(s.nom || '')}</strong>,
        ${dateConvoc ? `le <strong>${escapeHtml(dateConvoc)}</strong>` : 'le <strong>____________________</strong>'}
        ${heureConvoc ? `à <strong>${escapeHtml(heureConvoc)}</strong>` : 'à <strong>______ heures</strong>'}, pour :
      </p>
      <div style="border-left:4px solid #1a4731;padding:12px 20px;background:#f7fbf8;margin:14px 0;border-radius:0 8px 8px 0">
        <strong>${escapeHtml(motif)}</strong>
      </div>
      <p style="font-size:13px;line-height:2">Votre présence est <strong>obligatoire</strong>.</p>
      <p style="font-size:13px;line-height:2;margin-top:16px">Veuillez agréer nos salutations distinguées.</p>
      <div style="display:flex;justify-content:space-between;margin-top:30px">
        <div style="text-align:center;flex:1">
          <div style="font-size:11px;color:#555">Le Directeur</div>
          <div style="height:40px;border-bottom:1px solid #aaa;margin:4px 20px"></div>
          <div style="font-size:11px">${escapeHtml(s.directeur || '')}</div>
        </div>
        <div style="text-align:center;flex:1">
          <div style="font-size:11px;color:#555">Signature du Parent</div>
          <div style="height:40px;border-bottom:1px solid #aaa;margin:4px 20px"></div>
        </div>
      </div>
      <div style="border:1px dashed #aaa;padding:10px 14px;margin-top:24px;border-radius:6px;font-size:10px;color:#666">
        <strong>Coupon retour :</strong> Je soussigné(e) <strong>${escapeHtml(e.tuteur)}</strong>,
        parent de <strong>${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}</strong>,
        ai reçu la convocation du ${dateAuj}. &nbsp; Signature : _______________
      </div>
    </div>
  `).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>${titre}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#fff}
    @media print{.no-print{display:none}@page{margin:1cm}}
    .no-print{text-align:center;padding:14px;background:#f5f5f5;position:sticky;top:0;z-index:10}
    .no-print button{padding:8px 20px;background:#1a4731;color:#fff;border:none;border-radius:6px;cursor:pointer;margin:0 4px;font-size:14px}
    table{width:100%;border-collapse:collapse}th,td{padding:6px 10px;border:1px solid #ddd;font-size:13px}
    th{background:#1a4731;color:#fff}
    </style></head><body>
    <div class="no-print">
      <button onclick="window.print()">🖨️ Imprimer ${elvs.length} convocation${elvs.length > 1 ? 's' : ''}</button>
      <button onclick="window.close()" style="background:#888">✕ Fermer</button>
    </div>
    ${pagesHtml}
    </body></html>`);
  win.document.close();
}
