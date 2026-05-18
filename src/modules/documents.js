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
