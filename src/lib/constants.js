// Constantes globales EduSen

export const DEFAULT_CLASSES = [
  '6ème A', '6ème B',
  '5ème A', '5ème B',
  '4ème A', '4ème B',
  '3ème A', '3ème B',
  '2nde L', '2nde S',
  '1ère L', '1ère S',
  'Terminale L', 'Terminale S'
];

export const DEFAULT_MATIERES = {
  '6ème A': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Anglais', 'EPS', 'Arts Plastiques', 'Musique'],
  '6ème B': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Anglais', 'EPS', 'Arts Plastiques', 'Musique'],
  '5ème A': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Anglais', 'Espagnol', 'EPS', 'Arts Plastiques'],
  '5ème B': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Anglais', 'Espagnol', 'EPS', 'Arts Plastiques'],
  '4ème A': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Physique-Chimie', 'Anglais', 'Espagnol', 'EPS'],
  '4ème B': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Physique-Chimie', 'Anglais', 'Espagnol', 'EPS'],
  '3ème A': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Physique-Chimie', 'Anglais', 'Espagnol', 'EPS'],
  '3ème B': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Physique-Chimie', 'Anglais', 'Espagnol', 'EPS'],
  '2nde L': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Anglais', 'Espagnol', 'Litterature', 'EPS'],
  '2nde S': ['Francais', 'Mathematiques', 'Histoire-Geo', 'SVT', 'Physique-Chimie', 'Anglais', 'Espagnol', 'EPS'],
  '1ère L': ['Francais', 'Mathematiques', 'Histoire-Geo', 'Anglais', 'Espagnol', 'Litterature', 'Philosophie', 'EPS'],
  '1ère S': ['Mathematiques', 'Physique-Chimie', 'SVT', 'Histoire-Geo', 'Anglais', 'Espagnol', 'Francais', 'EPS'],
  'Terminale L': ['Philosophie', 'Histoire-Geo', 'Litterature', 'Anglais', 'Espagnol', 'Mathematiques', 'EPS'],
  'Terminale S': ['Mathematiques', 'Physique-Chimie', 'SVT', 'Philosophie', 'Histoire-Geo', 'Anglais', 'EPS']
};

export const DEFAULT_COEFFICIENTS = {
  'Francais': 4, 'Mathematiques': 4, 'Physique-Chimie': 3, 'SVT': 3,
  'Histoire-Geo': 2, 'Anglais': 2, 'Espagnol': 2, 'Litterature': 3,
  'Philosophie': 3, 'EPS': 1, 'Arts Plastiques': 1, 'Musique': 1
};

export const DEFAULT_MENSUALITES = {
  '6ème A': 20000, '6ème B': 20000,
  '5ème A': 22000, '5ème B': 22000,
  '4ème A': 25000, '4ème B': 25000,
  '3ème A': 28000, '3ème B': 28000,
  '2nde L': 30000, '2nde S': 32000,
  '1ère L': 32000, '1ère S': 35000,
  'Terminale L': 35000, 'Terminale S': 38000
};

export const MOIS_SCOLAIRES = [
  { id: 'octobre',  label: 'Octobre' },
  { id: 'novembre', label: 'Novembre' },
  { id: 'decembre', label: 'Décembre' },
  { id: 'janvier',  label: 'Janvier' },
  { id: 'fevrier',  label: 'Février' },
  { id: 'mars',     label: 'Mars' },
  { id: 'avril',    label: 'Avril' },
  { id: 'mai',      label: 'Mai' },
  { id: 'juin',     label: 'Juin' },
  { id: 'juillet',  label: 'Juillet' }
];

export const DEFAULT_SCHOOL = {
  nom: 'École Privée Al-Farouk',
  ville: 'Dakar',
  telephone: '+221 33 821 00 00',
  directeur: 'M. Mamadou Diallo',
  annee: '2024–2025',
  ief: '',
  logo2: ''
};

export const DEFAULT_CRENEAUX = [
  { id: 'c1', debut: '07:30', fin: '08:30', type: 'cours' },
  { id: 'c2', debut: '08:30', fin: '09:30', type: 'cours' },
  { id: 'c3', debut: '09:30', fin: '10:00', type: 'pause' },
  { id: 'c4', debut: '10:00', fin: '11:00', type: 'cours' },
  { id: 'c5', debut: '11:00', fin: '12:00', type: 'cours' },
  { id: 'c6', debut: '12:00', fin: '14:00', type: 'repas' },
  { id: 'c7', debut: '14:00', fin: '15:00', type: 'cours' },
  { id: 'c8', debut: '15:00', fin: '16:00', type: 'cours' }
];

// Tri scolaire 6ème → Terminale
export function trierClassesScolaire(classes) {
  function getScore(c) {
    const l = c.toLowerCase();
    if (c.startsWith('6')) return 1;
    if (c.startsWith('5')) return 2;
    if (c.startsWith('4')) return 3;
    if (c.startsWith('3')) return 4;
    if (l.startsWith('2nde') || l.startsWith('seconde')) return 5;
    if (l.startsWith('1ère') || l.startsWith('1ere') || l.startsWith('première')) return 6;
    if (l.startsWith('terminale') || l.startsWith('tle')) return 7;
    return 999;
  }
  return [...classes].sort((a, b) => {
    const sa = getScore(a), sb = getScore(b);
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b, 'fr', { sensitivity: 'base' });
  });
}

// Détermine le statut temporel d'un mois ('passe', 'en_cours', 'futur')
export function getMoisStatutTemporel(moisId, anneeSc) {
  const moisIndex = { octobre: 9, novembre: 10, decembre: 11, janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6 };
  const m = moisIndex[moisId];
  if (m === undefined) return 'futur';
  const match = (anneeSc || '').match(/(\d{4}).*?(\d{4})/);
  if (!match) return 'futur';
  const anneeDeb = parseInt(match[1]);
  const anneeFin = parseInt(match[2]);
  const anneeMois = (m >= 9) ? anneeDeb : anneeFin;
  const debutMois = new Date(anneeMois, m, 1);
  const debutMoisSuivant = new Date(anneeMois, m + 1, 1);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (now >= debutMoisSuivant) return 'passe';
  if (now >= debutMois) return 'en_cours';
  return 'futur';
}
