import { login, resetPasswordWithCode } from '../lib/auth.js';
import { afficherApp } from './shell.js';
import { toast } from '../lib/ui.js';

export function afficherEcranLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-box">
        <div class="auth-logo">🎓</div>
        <h1 class="auth-title">EduSen</h1>
        <p class="auth-subtitle">Gestion scolaire</p>
        <h2 style="font-family:var(--font-head);font-size:1.2rem;color:var(--text);margin:0 0 18px;text-align:center">Connexion</h2>
        <div id="login-erreur" class="auth-erreur"></div>
        <div class="form-group">
          <label>Identifiant</label>
          <input type="text" id="login-id" placeholder="Votre identifiant" autocomplete="username"/>
        </div>
        <div class="form-group">
          <label>Mot de passe</label>
          <input type="password" id="login-pwd" placeholder="Votre mot de passe" autocomplete="current-password"/>
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;padding:11px" id="btn-login">Se connecter</button>
        <a href="#" class="auth-link" id="link-recup">Mot de passe oublié ?</a>
      </div>
    </div>
  `;

  document.getElementById('btn-login').onclick = doLogin;
  document.getElementById('login-pwd').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('link-recup').onclick = (e) => { e.preventDefault(); afficherEcranRecuperation(); };
}

async function doLogin() {
  const loginId = document.getElementById('login-id').value.trim();
  const motdepasse = document.getElementById('login-pwd').value;
  const erreur = document.getElementById('login-erreur');
  erreur.classList.remove('show');

  if (!loginId || !motdepasse) {
    erreur.textContent = 'Veuillez saisir vos identifiants';
    erreur.classList.add('show');
    return;
  }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Connexion...';

  const result = await login(loginId, motdepasse);
  if (result.success) {
    window.EduSen.currentUser = result.user;
    toast(`Bienvenue ${result.user.nom}`, 'success');
    afficherApp();
  } else {
    erreur.textContent = result.error;
    erreur.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  }
}

function afficherEcranRecuperation() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-box">
        <div class="auth-logo">🔑</div>
        <h1 class="auth-title">Récupération</h1>
        <p class="auth-subtitle">Réinitialiser votre mot de passe</p>
        <div id="recup-erreur" class="auth-erreur"></div>
        <div class="form-group">
          <label>Identifiant</label>
          <input type="text" id="recup-id" placeholder="Votre identifiant"/>
        </div>
        <div class="form-group">
          <label>Code de récupération</label>
          <input type="text" id="recup-code" placeholder="XXXX-XXXX-XXXX-XXXX" style="text-transform:uppercase"/>
        </div>
        <div class="form-group">
          <label>Nouveau mot de passe</label>
          <input type="password" id="recup-pwd" placeholder="Au moins 6 caractères"/>
        </div>
        <div class="form-group">
          <label>Confirmer le mot de passe</label>
          <input type="password" id="recup-pwd2" placeholder="Re-saisissez"/>
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;padding:11px" id="btn-recup">Réinitialiser</button>
        <a href="#" class="auth-link" id="link-back-login">← Retour à la connexion</a>
      </div>
    </div>
  `;

  document.getElementById('btn-recup').onclick = doRecup;
  document.getElementById('link-back-login').onclick = (e) => { e.preventDefault(); afficherEcranLogin(); };
}

async function doRecup() {
  const id = document.getElementById('recup-id').value.trim();
  const code = document.getElementById('recup-code').value.trim();
  const pwd = document.getElementById('recup-pwd').value;
  const pwd2 = document.getElementById('recup-pwd2').value;
  const erreur = document.getElementById('recup-erreur');
  erreur.classList.remove('show');

  if (!id || !code || !pwd) {
    erreur.textContent = 'Veuillez remplir tous les champs';
    erreur.classList.add('show');
    return;
  }
  if (pwd.length < 6) {
    erreur.textContent = 'Le mot de passe doit faire au moins 6 caractères';
    erreur.classList.add('show');
    return;
  }
  if (pwd !== pwd2) {
    erreur.textContent = 'Les mots de passe ne correspondent pas';
    erreur.classList.add('show');
    return;
  }

  const result = await resetPasswordWithCode(id, code, pwd);
  if (result.success) {
    alert(`Mot de passe réinitialisé !\n\nVotre nouveau code de récupération est :\n${result.nouveauCode}\n\nNotez-le précieusement.`);
    afficherEcranLogin();
  } else {
    erreur.textContent = result.error;
    erreur.classList.add('show');
  }
}
