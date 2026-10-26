/**
 * Lecture d'une facture d'audioprothésiste à partir de ses lignes de texte : règles locales, aucune IA.
 * Chaque champ trouvé vient avec sa « preuve » (la ligne d'où il sort) ; un champ non trouvé reste vide,
 * jamais inventé. Les règles apprises (Réglages → « C'est le N° de facture ») passent avant les règles générales.
 *
 * Mises en page couvertes (toutes rencontrées sur de vraies factures, décrites ici de façon générique) :
 *  - tableau à colonnes : code, libellé, prix unitaire, quantité, montant, remboursements, un appareil par ligne, côté « - Droit - » sur
 *    la même ligne ou la suivante ;
 *  - libellé du modèle sur une ligne, montants sur la ligne du dessous (« n° de série Garantie 4 ans Marque  1  900,47 … ») ;
 *  - fiche par appareil : « Aide auditive droite », caractéristiques en puces, montants au milieu, code de regroupement P1D/P2G ;
 *  - libellé « Aide auditive GAUCHE  Modèle - MARQUE » puis une ligne de nombres « 950.00 1.00 0.00 950.00 » ;
 *  - tableau « Modèle / N° de série / Qté » dont la ligne de montants ne porte que « Garantie 4 ans  1  900.47 … » (le modèle est au-dessus) ;
 *  - tableau récapitulatif de TVA (« 1800.94  1900.00  5.5 %  99.06 ») quand aucun « Total TTC » n'est écrit.
 *
 * Cockpit Benjamin : copie du moteur de Cockpit Factures 0.7.2 (src/extraction/ et src/shared/referentiel.ts), à recopier tel quel
 * quand il évolue. Seuls changements : chemins d'import et `classeSource`.
 */
import {
  ACCESSOIRES, CODE_REGROUPEMENT, ENSEIGNES, FORMES, GARANTIE_ACCESSOIRE, GARANTIE_APPAREIL, IX_INSTANT_FIT, LIGNE_APPAREIL, LIGNE_PAS_APPAREIL, LPP_CLASSE, LPP_COTE,
  MARQUES, PHRASES_NEUTRES, PLATEFORMES, PRIX_MIN_APPAREIL, RECHARGEABLE, SLIM_REXTON, TAILLES_PILES,
} from './catalogue';
import { MODELES, type ModeleAppareil } from './modeles';
import { apresLibelle, avantPremierMontant, colonnes, dateFr, dates, decoller, formaterMontant, montants, montantsDetail, nirValide, nombre, normaliser, plat, sansAccents } from './texte';
import { FORMES as FORMES_REFERENTIEL, NIVEAUX, PLATEFORMES as PLATEFORMES_REFERENTIEL, fabricantDepuisMarque } from './referentiel';

/** Les motifs se testent sur le texte sans accents (voir sansAccents) ; les valeurs rendues gardent les leurs. */
const A = sansAccents;

export type ChampFacture = 'numeroFacture' | 'dateFacture' | 'emetteur' | 'siret' | 'finess' | 'patient' | 'naissance' | 'nir' | 'totalTtc' | 'partSecu' | 'partCompl';

export const CHAMPS: { id: ChampFacture; label: string }[] = [
  { id: 'numeroFacture', label: 'N° de facture' },
  { id: 'dateFacture', label: 'Date de la facture' },
  { id: 'totalTtc', label: 'Total TTC' },
  { id: 'emetteur', label: 'Émetteur' },
  { id: 'patient', label: 'Patient' },
  { id: 'naissance', label: 'Date de naissance' },
  { id: 'nir', label: 'N° de sécurité sociale' },
  { id: 'partSecu', label: 'Part sécurité sociale' },
  { id: 'partCompl', label: 'Part complémentaire' },
  { id: 'siret', label: 'SIRET' },
  { id: 'finess', label: 'FINESS' },
];

export interface Appareil {
  ligne: string;
  designation: string;
  marque: string;
  forme: string;
  niveau: string;
  plateforme: string;
  quantite: number;
  prixUnitaire: number | null;
  montant: number | null;
  cote: 'D' | 'G' | '';
  rechargeable: boolean;
  /** Modèle du catalogue reconnu dans le libellé (« Signia Silk Charge&Go IX → IF »), preuve de la forme ; absent sinon. */
  modele?: string;
}

export type Appareillage = 'binaural' | 'monaural right' | 'monaural left' | '';
/** Cockpit Benjamin : d'où vient la classe. Seul le prix des appareils laisse une classe « non sûre ». */
export type ClasseSource = 'code' | 'mention' | 'lpp' | 'prix' | '';

export interface Extraction {
  champs: Record<ChampFacture, string>;
  preuves: Partial<Record<ChampFacture, string>>;
  appareils: Appareil[];
  nbAppareils: number;
  marque: string;
  forme: string;
  niveau: string;
  plateforme: string;
  accessoires: string[];
  classe: '1' | '2' | '';
  classeSure: boolean;
  classeSource: ClasseSource;
  appareillage: Appareillage;
  totalAppareils: number | null;
  emetteurCle: string;
  lignes: string[];
  /** Le niveau lu n'est pas dans la liste du référentiel pour ce fabricant : il est gardé, mais le panneau peut le signaler. */
  niveauHorsListe?: boolean;
  /** Une ligne de chargeur figure sur la facture (même offert, à 0 €) ; « Charger » peut aussi venir d'un appareil rechargeable. */
  chargeurSurFacture: boolean;
  /** Au moins un appareil est rechargeable. */
  rechargeable: boolean;
}

/** Règle apprise par l'exemple : « pour cet émetteur, le champ X suit ce libellé » (ou est sur la ligne d'après). */
export interface RegleApprise {
  emetteurCle: string;
  champ: ChampFacture;
  avant: string;
  ligneSuivante: boolean;
  /** Libellé en tête de colonne (ligneSuivante) : colonne de la valeur sur la ligne d'après (0 si absent, anciennes règles). */
  colonne?: number;
}

const vide = (): Record<ChampFacture, string> => ({ numeroFacture: '', dateFacture: '', emetteur: '', siret: '', finess: '', patient: '', naissance: '', nir: '', totalTtc: '', partSecu: '', partCompl: '' });

const ANNEE_MIN = 2015;
const estDate = (s: string) => /^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(s);
const CIVILITE = /^(?:M\.|Mr\.?|Mme\.?|Mlle\.?|Monsieur|Madame|Mademoiselle|MONSIEUR|MADAME)\s+\p{L}/u;

/** Lignes qui portent un montant sans être un article : totaux, taxes, parts, règlements, mentions légales. */
const LIGNE_STOP = /^\s*(?:total|totaux|sous[- ]total|taux|tva|vir|ch|remise|prix\s+comprenant|[ée]co-?\s?taxe|dont\s+[ée]co)\b|\btotal\s+(?:ht|ttc|tva|net|g[ée]n[ée]ral|[ée]quipement)\b|\bmontant\s+(?:ht|ttc|tva|total|du\s+reste|restant|pris)\b|\btva\b|\bpart\b|\btiers[- ]payant\b|\bnet\s+(?:à|a)\s+payer\b|\breste\s+(?:à|a)\s+(?:charge|payer|r[ée]gler)\b|\breste\s+d[ûu]\b|\br[èe]glement\b|\bpaiement\b|\bcarte\s+bancaire\b|\bch[èe]ques?\b|\bvirement\b|\besp[èe]ces\b|\bacompte\b|\bpris\s+en\s+charge\b|\bRO\s*:|\bRC\s*:|\bAMO\b|\bAMC\b|\bau\s+capital\b|\bcapital\s+(?:social|de)\b|\bSIRET\b|\bSIREN\b|\bRCS\b|\bTIPS\s*:|\bpar\s+ch[èe]que\b|\b[ée]ch[ée]ance\b|\bbase\s+(?:ss|s[ée]cu)\b|\bencaissement\b|\bremise\s+accord|\bprix\s+(?:brut\s+)?comprenant\b|^\s*(?:cb|chq)\b|\bcb\s*-|\bprix\s+d'achat\b|\bdate\s+de\s+l'achat\b/i;

/** En-têtes de tableau d'articles : jamais recollés à une ligne d'article. */
const ENTETE_TABLEAU = /\bd[ée]signation\b|\blibell[ée]\b|\bmod[èe]le\b|\bqt[ée]?\b|\bprix\s+unit|\bmontant\b|\brbst\b|\bcompl\.|\bttc\s*\(|\bht\s*\(|\btarif\b|\bp\.?u\.?\b|^\s*prix\b|^\s*ht\b|^\s*unitaire\b|^-{3}/i;

/** Au-delà de ce titre, le même article est répété pour le tiers payant : on ne lit plus d'articles. */
const ZONE_DETAIL = /d[ée]tail\s+du\s+tiers[- ]payant|d[ée]tail\s+des\s+(?:paiements|r[èe]glements|encaissements)/i;

export function extraireFacture(lignesBrutes: string[], regles: RegleApprise[] = []): Extraction {
  const lignes = lignesBrutes.map(normaliser);
  const texteTout = lignes.join('\n');
  const anneeMax = new Date().getFullYear() + 1;
  const champs = vide();
  const preuves: Partial<Record<ChampFacture, string>> = {};
  const pose = (c: ChampFacture, v: string | null | undefined, ligne: string) => {
    if (!v || champs[c]) return;
    champs[c] = v.trim();
    preuves[c] = ligne;
  };

  // ── Numéro de facture ─────────────────────────────────────────────────────
  let ligneNumero = -1;
  const NUMERO = [
    /\bfacture\b[^\d\n]{0,25}?(?:n[°ºo"']\.?|num[ée]ro|#)\s*:?\s*([A-Z]{0,5}[\s-]?\d[\w\/.-]*)/i,
    /\bn[°ºo"']\.?\s*(?:de\s+(?:la\s+)?)?facture\s*:?\s*([A-Z0-9][\w\/.-]{2,})/i,
    /\bFSE\/FSP\s*n[°ºo"']\.?\s*:?\s*([A-Z]{0,5}-?\d[\w\/.-]*)/i,
    /\bfacture\s*(?:n[°ºo"']\.?|:)?\s*([A-Z]{0,5}\d[\w\/.-]{3,})/i,
    /\binvoice\s*(?:n[°ºo"']\.?|number|#|:)?\s*([A-Z]{0,5}\d[\w\/.-]{3,})/i,
  ];
  // Un numéro court (« Facture N° 18 ») n'est accepté qu'après un libellé explicite ; jamais une date ni « 1/1 ».
  const numeroValable = (tok: string, libelleExplicite = false) =>
    /\d/.test(tok) && !estDate(tok) && !/^\d\/\d$/.test(tok) && (tok.length >= 3 || (libelleExplicite && /^\d{1,2}$/.test(tok)));
  for (let i = 0; i < lignes.length && !champs.numeroFacture; i++) {
    for (let k = 0; k < NUMERO.length; k++) {
      const m = NUMERO[k].exec(lignes[i]);
      if (!m) continue;
      const tok = m[1].trim().replace(/[.,;:)]+$/, '');
      if (!numeroValable(tok, k <= 2)) continue;
      // Un numéro court séparé du libellé par un changement de colonne (« FACTURE N°   1 Rue des Lilas ») est le début d'une adresse.
      if (tok.length < 3 && (/\s{3,}$/.test(m[0].slice(0, m[0].length - m[1].length)) || /^\s+(?:rue|avenue|av\.|bd|boulevard|chemin|place|impasse|all[ée]e|route|cours|quai)\b/i.test(lignes[i].slice((m.index ?? 0) + m[0].length)))) continue;
      pose('numeroFacture', tok, lignes[i]);
      ligneNumero = i;
      break;
    }
    if (champs.numeroFacture) break;
    // Libellé seul (« FACTURE N° ») : le numéro est sur la ligne d'après.
    if (/^\s*facture\s*(?:n[°ºo"']\.?|num[ée]ro)?\s*:?\s*$/i.test(lignes[i]) && lignes[i + 1]) {
      const tok = (colonnes(lignes[i + 1])[0] ?? '').split(/\s/)[0].replace(/[.,;:)]+$/, '');
      if (/^[A-Z]{0,6}[\s-]?\d[\w\/.-]*$/i.test(tok) && numeroValable(tok)) { pose('numeroFacture', tok, lignes[i + 1]); ligneNumero = i + 1; }
    }
  }
  if (!champs.numeroFacture) {
    // Tableau « Document | Référence Facture | Date Facture » : la valeur est dans la colonne de même rang sur la ligne d'après.
    for (let i = 0; i + 1 < lignes.length && !champs.numeroFacture; i++) {
      const k = colonnes(lignes[i]).findIndex((c) => /^r[ée]f[ée]rence\s+facture\b/i.test(c));
      if (k < 0) continue;
      const v = (colonnes(lignes[i + 1])[k] ?? '').split(/\s+\/\s+/)[0].trim();
      if (numeroValable(v, true)) { pose('numeroFacture', v, lignes[i + 1]); ligneNumero = i + 1; }
    }
  }
  if (!champs.numeroFacture) {
    // Libellé « FACTURE » (ou « FACTURE N° ») dans une colonne, valeur dans une colonne des 4 lignes suivantes : « FAC-0001234 » ou « N° : 5171 ».
    for (let i = 0; i < lignes.length && !champs.numeroFacture; i++) {
      if (!colonnes(lignes[i]).some((c) => /^facture\s*(?:n[°ºo"']\.?|num[ée]ro)?\s*:?$/i.test(c))) continue;
      for (let j = i + 1; j <= Math.min(i + 4, lignes.length - 1) && !champs.numeroFacture; j++) {
        for (const col of colonnes(lignes[j])) {
          const m = /^(?:n[°ºo"']\.?\s*:?\s*)([A-Z]{0,6}-?\d[\w\/-]*)$/i.exec(col) ?? /^([A-Z]{1,6}-?\d{4,}[\w-]*|\d{6,}[\w-]*)$/.exec(col);
          if (m && numeroValable(m[1], true)) { pose('numeroFacture', m[1], lignes[j]); ligneNumero = j; break; }
        }
      }
    }
  }
  if (!champs.numeroFacture) {
    // « Numéro : 12345 » / « Référence : … » dans les 2 lignes qui suivent un titre « Facture ».
    for (let i = 0; i < lignes.length && !champs.numeroFacture; i++) {
      if (!/\bfacture\b/i.test(lignes[i])) continue;
      for (let j = i; j <= Math.min(i + 2, lignes.length - 1); j++) {
        const v = apresLibelle(lignes[j], /\b(?:num[ée]ro|n[°ºo"']\.?|r[ée]f[ée]rence|r[ée]f\.?)\s*(?:de\s+facture)?/i);
        if (v && numeroValable(v.split(/\s/)[0])) { pose('numeroFacture', v.split(/\s/)[0], lignes[j]); ligneNumero = j; break; }
      }
    }
  }

  // ── Date de facture ───────────────────────────────────────────────────────
  const dateUtile = (l: string) => dates(l).find((d) => { const a = +d.iso.slice(0, 4); return a >= ANNEE_MIN && a <= anneeMax; });
  const PAS_DATE_FACTURE = /naiss|n[ée]\(e\)|n[ée]e?\s+le\b|ordonnance|prescription|achat|livraison|essai|[ée]ch[ée]ance|paiement|r[èe]glement|adaptation|rdv|rendez|garantie|jusqu'au|[ée]dit[ée]|valid|expir|encaiss/i;
  if (ligneNumero >= 0) {
    const d = dateUtile(lignes[ligneNumero]);
    if (d) pose('dateFacture', dateFr(d.iso), lignes[ligneNumero]);
    const suivante = lignes[ligneNumero + 1] ?? '';
    if (!champs.dateFacture && /^\s*(?:du|le|date|en date du|fait le|[ée]mise? le)\b/i.test(suivante)) {
      const d2 = dateUtile(suivante);
      if (d2) pose('dateFacture', dateFr(d2.iso), suivante);
    }
  }
  for (let i = 0; i < lignes.length && !champs.dateFacture; i++) {
    const l = lignes[i];
    if (PAS_DATE_FACTURE.test(A(l)) && !/\bfacture\b/i.test(l)) continue;
    if (/\bdate\b|\bfacture\b|\bfactur[ée]e?\b|\bfait\s+le\b|\b[ée]mis(?:e|sion)?\b|\b[ée]tablie?\s+le\b|\ble\s+(?:\d|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b|^\s*du\s+\d/i.test(l)) {
      const d = dateUtile(l);
      if (d) pose('dateFacture', dateFr(d.iso), l);
    }
  }
  if (!champs.dateFacture) {
    for (const l of lignes.slice(0, 40)) {
      if (PAS_DATE_FACTURE.test(A(l))) continue;
      const d = dateUtile(l);
      if (d) { pose('dateFacture', dateFr(d.iso), l); break; }
    }
  }

  // ── SIRET, FINESS ─────────────────────────────────────────────────────────
  for (const l of lignes) {
    const s = /\bSIRET\b\s*(?:n[°ºo"']\.?)?\s*:?\s*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/i.exec(l);
    if (s) pose('siret', s[1].replace(/\s/g, ''), l);
    const f = /\bFINESS\b\s*(?:n[°ºo"']\.?)?\s*:?\s*(\d{3}\s?\d{3}\s?\d{3})\b/i.exec(l) ?? /\bn[°ºo"']\.?\s*FINESS\s*:?\s*(\d{3}\s?\d{3}\s?\d{3})\b/i.exec(l);
    if (f) pose('finess', f[1].replace(/\s/g, ''), l);
  }

  // ── Émetteur : enseigne connue, sinon en-tête, sinon mention légale du pied de page ──
  const emetteur = trouverEmetteur(lignes);
  if (emetteur) pose('emetteur', emetteur.valeur, emetteur.ligne);

  // ── Patient, naissance, sécurité sociale ──────────────────────────────────
  const LIBELLE_PATIENT = /\b(?:nom\s+de\s+l'assur[ée]e?|nom\s+(?:et\s+pr[ée]nom\s+)?du\s+(?:patient|client|b[ée]n[ée]ficiaire)|patient|b[ée]n[ée]ficiaire|assur[ée]e?|destinataire|(?<!signature\s+du\s+)(?<!naiss\.?\s+)client|nom)\s*(?=[:\-–])/i;
  const valeurPatient = (v: string | null) => !!v && /\p{L}{2,}/u.test(v.replace(/^(?:M\.|Mr\.?|Mme\.?|Mlle\.?|Monsieur|Madame)\s*/i, '')) && !/^(?:n[°º]|num|adresse|null|:)/i.test(v) && !/\bnull\b|\btotal\b|\bttc\b|\bmontant\b|€/i.test(v);
  for (const l of lignes) {
    const v = apresLibelle(l, LIBELLE_PATIENT);
    if (valeurPatient(v)) { pose('patient', v, l); break; }
  }
  if (!champs.patient) {
    // Colonne « Patient » (en-tête seul sur sa ligne) : la valeur est sur la ligne d'après.
    const i = lignes.findIndex((l) => /^patient$/i.test(colonnes(l)[0] ?? ''));
    if (i >= 0 && lignes[i + 1]) {
      const v = colonnes(lignes[i + 1])[0] ?? '';
      if (valeurPatient(v) && !/\d/.test(v)) pose('patient', v, lignes[i + 1]);
    }
  }
  if (!champs.patient) {
    const l = lignes.slice(0, 60).find((x) => colonnes(x).some((c) => CIVILITE.test(c)));
    if (l) {
      const col = colonnes(l).find((c) => CIVILITE.test(c));
      if (col) pose('patient', col, l);
    }
  }
  for (const l of lignes) {
    if (/naiss|n[ée]\(e\)|n[ée]e?\s+le\b/i.test(l)) {
      const d = dates(l).find((x) => +x.iso.slice(0, 4) < new Date().getFullYear() - 5);
      if (d) { pose('naissance', dateFr(d.iso), l); break; }
    }
  }
  for (const l of lignes) {
    for (const m of l.matchAll(/(?<!\d)([12]\s?\d{2}\s?\d{2}\s?(?:\d{2}|2A|2B)\s?\d{3}\s?\d{3}\s?\d{2})(?!\d)/gi)) {
      const brut = m[1].replace(/\s/g, '');
      if (nirValide(brut) || /s[ée]cu|\bSS\b|\bNIR\b|immatriculation|assur[ée]/i.test(l)) { pose('nir', brut.replace(/^(\d)(\d{2})(\d{2})(\w{2})(\d{3})(\d{3})(\d{2})$/, '$1 $2 $3 $4 $5 $6 $7'), l); break; }
    }
    if (champs.nir) break;
  }

  // ── Articles et appareils ─────────────────────────────────────────────────
  const codes = codesRegroupement(lignes);
  const marqueurs = marqueursCote(A(texteTout).replace(PHRASES_NEUTRES, ' '));
  const articles = trouverArticles(lignes, codes.length || marqueurs.length);
  const appareils = articles.filter((a) => a.appareil).map((a) => a.appareil!);
  const nbArticles = appareils.reduce((n, a) => n + a.quantite, 0);
  let nbAppareils = codes.length > 0 ? codes.length : nbArticles > 0 ? nbArticles : marqueurs.length;
  if (nbAppareils === 1 && appareils.some((a) => a.cote === 'D') && appareils.some((a) => a.cote === 'G')) nbAppareils = 2;
  // Deux lignes jumelles (même marque, même prix) sont la paire droite / gauche, même si un seul code de regroupement est écrit.
  if (nbAppareils === 1 && appareils.length === 2 && appareils[0].marque === appareils[1].marque && appareils[0].prixUnitaire === appareils[1].prixUnitaire) nbAppareils = 2;

  const textesAccessoires = articles.filter((a) => !a.appareil).map((a) => a.texte);
  const accessoires: string[] = [];
  // Hygiène et accessoires DryLux / PerfectClean / PerfectDome : comptés seulement s'ils sont payés (estPaye). Sur le corpus,
  // la plupart sont offerts (0 €, remise 100 %) et l'équipe ne les note pas comme achetés.
  const PAYES_SEULEMENT = new Set(['Hygiene', 'DryLux', 'PerfectClean', 'PerfectDome']);
  for (const acc of ACCESSOIRES) {
    if (accessoires.includes(acc.nom)) continue;
    const present = PAYES_SEULEMENT.has(acc.nom)
      ? articles.some((a) => !a.appareil && acc.motifs.test(A(a.ligne)) && estPaye(a.ligne))
      : textesAccessoires.some((t) => acc.motifs.test(A(t)));
    if (present) accessoires.push(acc.nom);
  }
  // Assurance perte / vol / casse : seulement si elle est payée ; une garantie « perte, vol, casse » incluse dans le pack
  // à 0 € n'est pas une assurance achetée.
  const ASSURANCE = /\bassurance\b(?!\s+maladie)|\bprogramme\s+tranquillite\b|\bsi\s+perte\b|\bperte\s*(?:et|ou|\/|,)?\s*vol\b|\bvol\s*(?:et|ou|\/|,)?\s*casse\b/i;
  if (articles.some((a) => !a.appareil && ASSURANCE.test(A(a.ligne)) && estPaye(a.ligne))) accessoires.push('Insurance');
  const chargeurSurFacture = accessoires.includes('Charger') || accessoires.includes('Charger DC');

  // Marque : celle de l'appareil, sinon celle des autres lignes d'articles (chargeur, écouteurs…). « Audio2000/Rexton » du référentiel est
  // réservé aux appareils portant la marque Audio 2000 (« AUDIO 2000 - ESSENTIEL 400 »), pas à un Rexton vendu par un centre Audio 2000.
  const marqueDoc = premierNonVide(appareils.map((a) => a.marque)) || premierNonVide(articles.map((a) => marqueDans(a.texte)));
  // Fiche « Caractéristiques des produits » en bas de page : « Type, nombre de canaux : BTE, 16 ». Quand elle ne donne qu'un seul type, il vaut
  // pour les appareils dont la ligne ne dit pas la forme (ITE, ITC, CIC, IIC : intra sur mesure).
  const typesFiche = new Set<string>();
  for (const m of texteTout.matchAll(/\btype(?:\s+de\s+proth[eè]se)?\s*(?:,\s*nombre\s+de\s+canaux)?\s*:\s*(RIC|RITE|BTE|ITE|ITC|CIC|IIC)\b/gi)) {
    const t = m[1].toUpperCase();
    typesFiche.add(t === 'RITE' ? 'RIC' : t === 'BTE' || t === 'RIC' ? t : 'ITE');
  }
  const formeFiche = typesFiche.size === 1 ? [...typesFiche][0] : '';
  for (const a of appareils) {
    a.marque = a.marque || marqueDoc;
    const fab = fabricantDepuisMarque(a.marque);
    const ctx = a.ctx;
    // Forme, niveau et plateforme : choisis parmi ceux du fabricant du référentiel (voir niveauDans, plateformeDans, formeReferentiel).
    a.plateforme = plateformeDans([ctx.propreNeutre, ctx.autour, ctx.entete], fab);
    a.niveau = niveauDans([ctx.propreNeutre, ctx.autour, ctx.entete].join(' '), fab);
    const motsCles = formeParMotsCles(a.formeBase || formeFiche, fab, a.texteComplet);
    a.formeBase = motsCles;
    // Modèle connu du catalogue : sa catégorie donne la forme, avant les mots-clés (« Intuis 4.2 P » → BTE, « M-Core R312 » décrit plus bas
    // comme « Contour » → RIC). Deux exceptions où la facture garde le dernier mot : une ligne « à confirmer » du catalogue ne contredit
    // aucune forme lue ; une ligne « vérifiée » ne contredit pas une forme écrite dans le libellé même que le nom du modèle n'explique pas
    // (« Audéo Slim L90-R » reste un Slim RIC même si « Audéo L-R » est un RIC-R).
    const trouve = modeleConnu(fab, [ctx.autour, ctx.entete]);
    if (!trouve) continue;
    const m = trouve.modele;
    const base = m.categorie.replace(/-R$/, '');
    if (motsCles && familleForme(motsCles) !== familleForme(base)) {
      if (m.confiance === 'à confirmer') continue;
      const ecrit = formeEcriteDans(ctx.autour, fab);
      const jetonsVariante = jetonsModele(trouve.variante);
      if (ecrit && familleForme(ecrit.forme) !== familleForme(base) && !jetonsModele(ecrit.mot).every((j) => jetonsVariante.includes(j))) continue;
    }
    a.formeBase = base;
    a.modele = `${m.marque} ${trouve.variante} → ${m.categorie}`;
    // Un modèle que le catalogue dit rechargeable l'est, même si la facture ne l'écrit pas (Styletto, HearLink 9050 miniRITE), sauf
    // taille de pile dans le libellé (« 312 »). « Non » ne retire rien : la facture abrège souvent (« MNR T » avec un « Chargeur MNR T R »).
    if (m.rechargeable === true && !PILE_JETONS.test(jetonsModele(ctx.autour).join(' '))) a.rechargeable = true;
  }
  const rechargeable = appareils.some((a) => a.rechargeable);
  if (rechargeable && !accessoires.includes('Charger')) accessoires.unshift('Charger');
  const chargeur = accessoires.includes('Charger');
  // Un chargeur sur la facture rend les appareils rechargeables (RIC → RIC-R).
  for (const a of appareils) a.forme = formeReferentiel(a.formeBase, fabricantDepuisMarque(a.marque), a.rechargeable || chargeur);
  const marque = marqueDoc;
  const forme = premierNonVide(appareils.map((a) => a.forme));
  const niveau = premierNonVide(appareils.map((a) => a.niveau));
  const plateforme = premierNonVide(appareils.map((a) => a.plateforme));
  const fabricantGlobal = fabricantDepuisMarque(appareils.find((a) => a.niveau)?.marque ?? marque);
  const niveauxConnus = (NIVEAUX as Record<string, string[] | undefined>)[fabricantGlobal];
  const niveauHorsListe = !!niveau && !!niveauxConnus && !niveauxConnus.includes(niveau);

  // ── Classe (1 = 100 % santé, prix plafonné à 950 € ; 2 = prix libre) ──────
  let classe: '1' | '2' | '' = '';
  let classeSure = false;
  let classeSource: ClasseSource = '';
  const classesCodes = unanimes(codes.map((c) => c.classe));
  const classesMentions = unanimes(appareils.flatMap((a) => classesDans(a.texteComplet)));
  const classesLpp = unanimes([...texteTout.matchAll(/\b(\d{7})\b/g)].map((m) => LPP_CLASSE[m[1]]).filter((c): c is '1' | '2' => !!c));
  if (classesCodes) { classe = classesCodes; classeSure = true; classeSource = 'code'; }
  else if (classesMentions) { classe = classesMentions; classeSure = true; classeSource = 'mention'; }
  else if (classesLpp) { classe = classesLpp; classeSure = true; classeSource = 'lpp'; }
  else if (appareils.length) {
    const prix = appareils.map((a) => a.prixClasse).filter((p) => p > 0);
    if (prix.length) { classe = Math.max(...prix) <= 950 ? '1' : '2'; classeSource = 'prix'; }
  }

  // ── Appareillage (mono / bi) ──────────────────────────────────────────────
  let appareillage: Appareillage = '';
  if (nbAppareils >= 2) appareillage = 'binaural';
  else if (nbAppareils === 1) {
    const cote = codes[0]?.cote || appareils.find((a) => a.cote)?.cote || (marqueurs.length === 1 ? marqueurs[0] : '') || coteParLpp(texteTout);
    appareillage = cote === 'D' ? 'monaural right' : cote === 'G' ? 'monaural left' : '';
  }

  // ── Total TTC ─────────────────────────────────────────────────────────────
  const total = trouverTotal(lignes, appareils.length ? Math.max(...appareils.map((a) => a.prixClasse)) / 2 : 0);
  if (total) pose('totalTtc', formaterMontant(total.valeur), total.ligne);

  // Contrôle par la facture entière : si les prix catalogue des appareils dépassent le total TTC, c'est qu'une remise a été
  // déduite ; on retient alors le prix payé écrit sur la ligne. Sinon le prix catalogue, même si un montant ressemble à une remise
  // (une colonne de TVA ou de remboursement peut donner la même soustraction).
  const sommeCatalogue = appareils.reduce((n, a) => n + (a.montant ?? 0), 0);
  const remiseProuvee = !!total && sommeCatalogue > total.valeur + 1;
  if (appareils.some((a) => a.prixNet !== null && (a.prixNetSur || remiseProuvee))) {
    for (const a of appareils) {
      if (a.prixNet === null || !(a.prixNetSur || remiseProuvee)) continue;
      a.prixUnitaire = a.prixNet;
      a.montant = Math.round(a.prixNet * a.quantite * 100) / 100;
    }
  }
  const totalAppareils = appareils.length ? appareils.reduce((n, a) => n + (a.montant ?? 0), 0) : null;

  partsRemboursement(lignes, champs, preuves);

  // ── Règles apprises : elles priment ───────────────────────────────────────
  const emetteurCle = cleEmetteur(champs);
  for (const r of regles.filter((x) => x.emetteurCle === emetteurCle)) {
    const trouve = appliquerRegle(lignes, r);
    const valeur = trouve ? valeurDeRegle(r.champ, trouve.valeur) : null;
    if (trouve && valeur) { champs[r.champ] = valeur; preuves[r.champ] = trouve.ligne; }
  }

  return {
    champs, preuves,
    appareils: appareils.map(({ texteComplet: _t, formeBase: _f, ctx: _c, prixClasse: _p, prixNet: _n, prixNetSur: _s, ...a }) => a),
    nbAppareils, marque, forme, niveau, plateforme, accessoires, classe, classeSure, classeSource, appareillage, totalAppareils, emetteurCle, lignes,
    niveauHorsListe, chargeurSurFacture, rechargeable,
  };
}

/**
 * Forme écrite comme dans le référentiel, à partir de la forme de base (catalogue des modèles ou mots-clés), du fabricant et du caractère
 * rechargeable : RIC → RIC-R, BTE → BTE-R, ITE (intra sur mesure) → ITE-R ; « RIC-R » (Signia Active) l'est toujours ; Slim RIC et IF
 * (instant fit) n'ont pas de version « -R » dans le référentiel et restent tels quels, même rechargeables (Silk Charge&Go).
 * Quand le fabricant n'a pas la version « -R » dans sa liste (Oticon, Unitron… n'ont pas « ITE-R »), on garde la forme sans « -R ».
 * Une autre forme absente de la liste du fabricant reste telle quelle : le panneau l'affiche en « Autre… ».
 */
export function formeReferentiel(formeBase: string, fabricant: string, rechargeable: boolean): string {
  const formes = (FORMES_REFERENTIEL as Record<string, string[] | undefined>)[fabricant];
  let res: string;
  switch (formeBase) {
    case 'RIC': case 'BTE': case 'ITE': res = rechargeable ? `${formeBase}-R` : formeBase; break;
    case 'RIC-R': res = 'RIC-R'; break;
    default: return formeBase;
  }
  if (formes?.length && !formes.includes(res) && res.endsWith('-R') && formes.includes(res.slice(0, -2))) return res.slice(0, -2);
  return res;
}

/**
 * Forme de base par mots-clés, précisée par fabricant : chez Rexton et Audio 2000, « iX » est l'intra instant fit (IF) et « SR » le
 * Slim RIC ; chez Signia, IX n'est qu'une plateforme.
 */
function formeParMotsCles(formeLue: string, fabricant: string, texte: string): string {
  const rexton = fabricant === 'Rexton' || fabricant === 'Audio2000/Rexton';
  if (rexton && (formeLue === 'ITE' || formeLue === '') && IX_INSTANT_FIT.test(texte)) return 'IF';
  if (fabricant === 'Rexton' && (formeLue === 'RIC' || formeLue === '') && SLIM_REXTON.test(texte)) return 'Slim RIC';
  return formeLue;
}

/** Famille d'une forme de base, pour comparer le catalogue et les mots-clés : le style écouteur Signia Active est un RIC. */
const familleForme = (f: string) => (f === 'RIC-R' ? 'RIC' : f);

/** Forme écrite dans un texte par mot-clé (catalogue.ts, FORMES), avec le mot qui la donne : « SLIM » → Slim RIC. */
function formeEcriteDans(texte: string, fabricant: string): { forme: string; mot: string } | null {
  for (const f of FORMES) {
    const m = f.motifs.exec(texte);
    if (m) return { forme: formeParMotsCles(f.code, fabricant, texte), mot: m[0] };
  }
  return null;
}

// ── Catalogue des modèles ────────────────────────────────────────────────────

/**
 * Jetons d'un libellé pour la comparaison avec le catalogue des modèles : minuscules, sans accents ni ponctuation (tirets, « & », « + »),
 * lettres et chiffres séparés (« 7IX » → 7 ix, « RIC312D » → ric 312 d), quelques écritures ramenées à une seule (Charge&Go / C&G,
 * Bi-Core / BiCore, M-Core, miniRITE / MNR, miniBTE / MNB, SmartRIC, inoX, HearLink, « RICRD » / « RD » → ric r d).
 */
export function jetonsModele(texte: string): string[] {
  return sansAccents(texte).toLowerCase()
    .replace(/charge\s*(?:&|and|et|n)\s*go\b|\bc\s*&\s*go?\b/g, ' chargego ')
    .replace(/\bbi[\s-]?core\b/g, ' bicore ')
    .replace(/\bm[\s-]?core\b/g, ' mcore ')
    .replace(/\btru[\s-]?core\b/g, ' trucore ')
    .replace(/\bmini[\s-]?rite\b|\bmnr\b/g, ' minirite ')
    .replace(/\bmini[\s-]?bte\b|\bmnb\b/g, ' minibte ')
    .replace(/\bsmart[\s-]?ric\b/g, ' smartric ')
    .replace(/\bino[\s-]?x\b/g, ' inox ')
    .replace(/\bhear[\s-]?link\b/g, ' hearlink ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])(?=\d)/g, '$1 ').replace(/(\d)(?=[a-z])/g, '$1 ')
    .replace(/\b([ms]?ric|rite|rie)r(d|t)?\b/g, '$1 r $2')
    .replace(/\brd\b/g, 'r d')
    .split(' ').filter(Boolean);
}

/**
 * Une taille de pile écrite dans le libellé (312, 675 ; 13 ou 10 derrière un nom, une forme ou un niveau : « Motion 13 », « M30-13T ») :
 * l'appareil n'est pas rechargeable. Aucun niveau du référentiel ne vaut 13 ni 10.
 */
const PILE_JETONS = /\b(?:312|675)\b|\b(?:[a-z]{2,}|\d{2})\s(?:13|10)\b(?!\s(?:canaux|canal|ans?|mois)\b)|\b(?:13|10)\s(?:t|d|nw)\b/;

interface VarianteModele { modele: ModeleAppareil; variante: string; jetons: string[]; poids: number }
const VARIANTES_PAR_MARQUE = new Map<string, VarianteModele[]>();

function variantesDe(fabricant: string): VarianteModele[] {
  let liste = VARIANTES_PAR_MARQUE.get(fabricant);
  if (!liste) {
    liste = MODELES.filter((m) => m.marque === fabricant).flatMap((modele) => modele.variantes.map((variante) => {
      const jetons = jetonsModele(variante);
      return { modele, variante, jetons, poids: jetons.join('').length };
    }));
    VARIANTES_PAR_MARQUE.set(fabricant, liste);
  }
  return liste;
}

/** Tous les jetons de la variante (avec leurs répétitions) dans une même fenêtre du libellé, dans n'importe quel ordre (« 7AX Pure C&G »). */
function contientVariante(texte: string[], variante: string[]): boolean {
  const fenetre = variante.length + 3;
  for (let i = 0; i < texte.length; i++) {
    if (!variante.includes(texte[i])) continue;
    const reste = [...variante];
    for (let k = i; k < Math.min(texte.length, i + fenetre) && reste.length; k++) {
      const j = reste.indexOf(texte[k]);
      if (j >= 0) reste.splice(j, 1);
    }
    if (!reste.length) return true;
  }
  return false;
}

/**
 * Modèle du catalogue (modeles.ts) reconnu dans le texte d'un appareil, pour sa marque : la variante la plus complète
 * (« Pure Charge&Go T IX » plutôt que « Pure Charge&Go IX »). Les textes sont essayés dans l'ordre (libellé, puis en-tête de fiche).
 * Deux variantes aussi complètes mais de catégories différentes : rien (pas de choix au hasard).
 */
export function modeleConnu(fabricant: string, textes: string[]): { modele: ModeleAppareil; variante: string } | null {
  const variantes = variantesDe(fabricant);
  if (!variantes.length) return null;
  for (const t of textes) {
    const jetons = jetonsModele(t);
    if (!jetons.length) continue;
    const ok = variantes.filter((v) => contientVariante(jetons, v.jetons));
    if (!ok.length) continue;
    const poids = Math.max(...ok.map((v) => v.poids));
    const meilleures = ok.filter((v) => v.poids === poids);
    const [premiere] = meilleures;
    if (meilleures.every((v) => v.modele.categorie === premiere.modele.categorie && v.modele.rechargeable === premiere.modele.rechargeable)) return { modele: premiere.modele, variante: premiere.variante };
    return null;
  }
  return null;
}

function premierNonVide(xs: string[]): string {
  return xs.find((x) => !!x) ?? '';
}

/** Une seule valeur distincte dans la liste (ou rien). */
function unanimes<T extends string>(xs: T[]): T | '' {
  const set = new Set(xs.filter(Boolean));
  return set.size === 1 ? [...set][0] : '';
}

/** Marque d'un texte : d'abord les noms de marque, puis seulement les noms de modèles (voir MARQUES). */
function marqueDans(texte: string): string {
  const t = A(texte);
  return MARQUES.find((m) => m.motifs.test(t))?.nom ?? MARQUES.find((m) => m.modeles?.test(t))?.nom ?? '';
}

// ── Émetteur ─────────────────────────────────────────────────────────────────

const MOT_SOCIETE = /\baudi|\bacous|\bsonor|\b[ée]cout|\bentendre\b|\blaboratoire\b|\bcentre\b|\bmaison\b|\boptique\b|\bopticien|\bsurdit|\bsas\b|\bsarl\b|\beurl\b|\bsasu\b|\bselarl\b/i;
const LIGNE_PAS_EMETTEUR = /\btiers[- ]payant\b|\bremboursement\b|\be-?mail\b|\bpr[ée]l[èe]vement\b|\bniv\.|\bprofessionnelle\b|\br[èe]glement\b|\bvir\b|\bch[èe]que\b|\bmontant\b|\btotal\b|\bpdf\b|\bfacture\b|\bdevis\b|\bduplicata\b|\bpage\b|\bdate\b|\bt[ée]l\b|\bt[ée]l[ée]phone\b|\bfax\b|\bmail\b|@|www\.|https?:|\bsiret\b|\bsiren\b|\bfiness\b|\brpps\b|\badeli\b|\btva\b|\bn[°º]|\bcapital\b|\brcs\b|\bape\b|\bnaf\b|\bfse\b|\bquittance\b|\bacquitt|\brue\b|\bavenue\b|\bav\.|\bbd\b|\bboulevard\b|\bplace\b|\bchemin\b|\broute\b|\ball[ée]e\b|\bimpasse\b|\bcedex\b|\bzac?\b|\bc\.c\.|\bcentre\s+commercial\b|\blieu[- ]dit\b|\bb[âa]t(?:iment)?\b|\bnom\b|\bpatient\b|\bassur[ée]|\bnaiss|\bs[ée]cu|\bprescri|\bordonnance|\bcaisse\b|\bcompl[ée]mentaire\b|\bmutuelle\b|\bagr[ée]ment\b|\bcentre\s+partenaire\b|\bintracommunautaire\b|\bidentifiant\b|\bgrande\s+rue\b/i;
const DEBUT_BLOC_PATIENT = /nom\s+de\s+l'assur|\bpatient\b|\bassur[ée]e?\s*:|date\s+naiss|n[ée]\(e\)|n[°º]\s*s[ée]cu|\bNIR\b|\bdestinataire\b/i;
/** « Audioprothésiste », « Audioprothésiste : », « Audioprothésiste D.E. » : un libellé de profession, jamais le nom du centre. */
const LIBELLE_PROFESSION = /^audioproth[ée]siste\b/i;

function trouverEmetteur(lignes: string[]): { valeur: string; ligne: string } | null {
  const tete = lignes.slice(0, 12);
  for (const zone of [tete, lignes]) {
    for (const e of ENSEIGNES) {
      const l = zone.find((x) => e.motifs.test(A(x)));
      if (l) return { valeur: e.nom, ligne: l };
    }
  }
  // Mention explicite : « Facture émise par : SAS EXEMPLE AUDIOLOGIE ».
  for (const l of lignes) {
    const m = /\b(?:factur[ée]e?\s+)?[ée]mise?\s+par\s*:?\s*(.+)$/i.exec(normaliser(l));
    const nom = m ? nomLegal(m[1]) : '';
    if (nom) return { valeur: nom, ligne: l };
  }
  // En-tête : avant le bloc patient, une ligne de nom (pas d'adresse, pas de civilité, pas d'identifiant, pas de libellé de profession).
  const bornes = [lignes.findIndex((l) => DEBUT_BLOC_PATIENT.test(A(l))), lignes.findIndex((l) => ENTETE_TABLEAU.test(A(l)))].filter((n) => n >= 0);
  const zoneTete = lignes.slice(0, Math.min(bornes.length ? Math.min(...bornes) : 10, 10));
  const ignore = new Set<number>();
  zoneTete.forEach((l, i) => {
    const c = colonnes(l)[0] ?? '';
    if (!LIBELLE_PROFESSION.test(A(c))) return;
    ignore.add(i);
    // « Nom Prénom » puis « Audioprothésiste D.E. » : la ligne d'au-dessus est le nom du professionnel, pas celui du centre.
    if (/^audioproth[ée]siste\s*(?:d\.?\s*e\.?)?\s*:?$/i.test(A(c)) && i > 0) ignore.add(i - 1);
  });
  for (let i = 0; i < zoneTete.length; i++) {
    if (ignore.has(i)) continue;
    // Nom collé à l'adresse, sans espace (« EXEMPLE AUDITION Jean DUPONT3 Impasse … ») : la partie avant le chiffre,
    // seulement si elle ressemble à un nom de centre.
    const colle = /^(\p{L}[\p{L}'’ .&-]{4,55}?)\s*\d/u.exec(colonnes(zoneTete[i])[0] ?? '');
    if (colle && MOT_SOCIETE.test(A(colle[1])) && colle[1].trim().split(/\s+/).length >= 2 && !CIVILITE.test(colle[1]) && !LIGNE_PAS_EMETTEUR.test(A(colle[1])) && !LIBELLE_PROFESSION.test(A(colle[1]))) {
      return { valeur: colle[1].trim().replace(/^(?:SASU?|SARL|EURL|SNC|SELARL)\s+/i, ''), ligne: zoneTete[i] };
    }
    const c = colonnes(zoneTete[i])[0] ?? '';
    if (!/\p{L}{3,}/u.test(c) || c.length < 3 || c.length > 60) continue;
    if (/^\d/.test(c) || CIVILITE.test(c) || LIGNE_PAS_EMETTEUR.test(A(c)) || dates(c).length || montants(c).length) continue;
    if (/^[A-Z]{1,6}-?\d{4,}$/.test(c)) continue; // identifiant (« FAC-0001234 »)
    // Un bloc « nom + adresse + ville, le <date> » en tête de page est l'adresse du destinataire (lettre), pas l'émetteur.
    const suite = lignes.slice(i + 1, i + 5);
    const blocDestinataire = suite.some((s) => /^[^\d\n]{2,40},\s*le\s+\d/i.test(s) || DEBUT_BLOC_PATIENT.test(A(s))) && !MOT_SOCIETE.test(A(c));
    if (blocDestinataire) continue;
    return { valeur: c, ligne: zoneTete[i] };
  }
  // Pied de page : la raison sociale précède « au capital », SIRET, SIREN ou RCS.
  const iLegal = lignes.findIndex((l) => /\bau\s+capital\b|\bSIRET\b|\bSIREN\b|\bRCS\b/i.test(l));
  if (iLegal >= 0) {
    for (let j = iLegal; j >= Math.max(0, iLegal - 3); j--) {
      const nom = nomLegal(lignes[j]);
      if (nom) return { valeur: nom, ligne: lignes[j] };
    }
  }
  // Mention de protection des données : « … en vous adressant à NOM DU CENTRE - 83000 VILLE ».
  for (const l of lignes) {
    const m = /vous\s+adressant\s+(?:à|a)\s+(.{3,60}?)\s+-\s+\d{5}\b/i.exec(l);
    if (m && /\p{L}{3,}/u.test(m[1])) return { valeur: m[1].trim(), ligne: l };
  }
  return null;
}

/** « SARL EXEMPLE AUDITION - 1 rue … » / « EXEMPLE AUDITION au capital de … » → « EXEMPLE AUDITION » ; rien si ce n'est pas un nom. */
function nomLegal(ligne: string): string {
  const premier = normaliser(ligne).split(/\s+[-–|]\s+|\s*\|\s*|\s+au\s+capital\b|au\s+capital\b|\bcapital\b|\bsiret\b|\bsiren\b|\brcs\b|\bape\b|\bnaf\b|\bt[ée]l\b|\bmail\b/i)[0] ?? '';
  if (/@|www\.|https?:/i.test(premier)) return '';
  // La forme juridique d'abord, puis l'adresse : coupée à un nombre isolé (« 12 rue »), pas à un chiffre dans le nom (« 3A AUDIO »).
  const sansForme = premier.replace(/^\s*(?:SASU?|SARL|EURL|SA|SNC|SELARL|SCI)\b\.?\s*/i, '');
  if (/^\d+(?:[\s,]|$)/.test(sansForme)) return '';
  // Nombre isolé (« … 12 rue ») ou numéro collé au nom (« …AUDITIVES195 AV … ») ; un chiffre suivi d'une lettre (« 3A ») reste.
  const t = sansForme.replace(/(?:\s+\d+|\d{2,})(?:[\s,].*)?$/, '').replace(/\s+\d{5}\b.*$/, '').replace(/\s+(?:SASU?|SARL|EURL|SA|SNC|SELARL)\s*$/i, '').replace(/[\s,;:.-]+$/, '').trim();
  if (!/\p{L}{3,}/u.test(t) || !/\p{Lu}/u.test(t) || t.length < 3 || t.length > 60) return '';
  if (/\bsi[èe]ge\b|\bsocial\b|\bconditions?\b|\bmaison\)|\badresse\b|\bfabricant\b|\bmonsieur\b|\bmadame\b|\bcapital\b|\bpart\b|\btotal\b|\bnet\b|\breste\b/i.test(A(t)) || CIVILITE.test(t) || LIGNE_PAS_EMETTEUR.test(A(t)) || LIBELLE_PROFESSION.test(A(t))) return '';
  return t;
}

// ── Articles ─────────────────────────────────────────────────────────────────

/** Texte autour d'un appareil, gardé pour choisir marque, forme, niveau et plateforme une fois le fabricant connu. */
interface ContexteAppareil { propreNeutre: string; autour: string; entete: string }

interface AppareilInterne extends Appareil {
  texteComplet: string;
  formeBase: string;
  ctx: ContexteAppareil;
  /** Prix TTC d'un appareil sur sa ligne (le plus grand montant divisé par la quantité) : sert à la classe par le prix. */
  prixClasse: number;
  /** Prix payé, remise déduite, quand la ligne l'écrit (null sinon). */
  prixNet: number | null;
  /** La remise porte le signe € sur la ligne : le prix payé est sûr, retenu sans autre contrôle. */
  prixNetSur: boolean;
}

interface Article {
  /** La ligne qui porte les montants. */
  ligne: string;
  /** Libellé propre à la ligne (avant le premier montant) + ligne du dessus et du dessous quand elles continuent l'article. */
  texte: string;
  appareil: AppareilInterne | null;
  /** Un mot d'accessoire, une garantie courte ou une TVA autre que 5,5 % : jamais promu en appareil. */
  accessoire: boolean;
  prixClasse: number;
  /** Lit la ligne comme un appareil (pour la reprise quand les codes de la facture annoncent plus d'appareils que de lignes reconnues). */
  reprise: () => AppareilInterne;
}

/** Codes qui n'existent que sur une ligne d'aide auditive : code LPP du produit, code LPP générique, code de regroupement (P1D, P2G…). */
const CODE_APPAREIL = /\b(?:73\d{5}|2351057|2365119|2392530|2341840)\b|\bP[12][DG]\b/;

const neutre = (s: string) => A(s).replace(PHRASES_NEUTRES, ' ').replace(/\s+/g, ' ').trim();

/**
 * Prix TTC d'un appareil sur sa ligne. Un montant égal à un autre montant de la ligne plus 5,5 % de TVA est le prix TTC
 * (« Prix HT 2 417,06 · HT après remise 1 800,95 · TTC 1 900,00 » → 1 900,00) : avec une forte remise, le prix HT avant
 * remise peut dépasser le TTC payé, et « le plus grand montant » se tromperait. Sans ce repère, le plus grand montant.
 */
export function prixDeLigne(ms: number[]): number {
  const ttc = ms.filter((t) => ms.some((h) => h !== t && h > 0 && Math.abs(h * 1.055 - t) <= Math.max(0.06, t * 0.0015)));
  return ttc.length ? ttc[ttc.length - 1] : Math.max(...ms);
}

/**
 * Prix payé d'un appareil quand la ligne écrit la remise : le plus grand montant (prix TTC) moins un autre (la remise)
 * donne exactement un troisième (le net) : « 1 750,00   1   450,00 €   1 300,00 » → 1 300,00. Garde-fous : 240 € et 840 €
 * sont les remboursements Sécurité sociale (adulte, moins de 20 ans), jamais une remise — sinon « 950 · 240 · 710 » d'une
 * facture 100 % Santé donnerait 710 ; et le net vaut au moins 40 % du prix. null si la ligne n'écrit pas de remise.
 */
export function prixNetDeLigne(ms: number[]): number | null {
  if (ms.length < 3) return null;
  const x = Math.max(...ms);
  const ix = ms.indexOf(x);
  let net: number | null = null;
  ms.forEach((y, iy) => {
    if (iy === ix || Math.abs(y - 240) < 0.01 || Math.abs(y - 840) < 0.01) return;
    ms.forEach((z, iz) => {
      if (iz === ix || iz === iy) return;
      if (Math.abs(x - y - z) <= 0.05 && z >= 0.4 * x && (net === null || z > net)) net = z;
    });
  });
  return net;
}

/**
 * La remise est-elle écrite comme telle sur la ligne ? Dans les tableaux « prix · qté · remise € · net », seule la remise
 * porte le signe € : « 1 550,00   1   300,00 €   1 250,00 ». C'est la preuve que le net est bien le prix payé.
 */
/**
 * Article payé ? Non s'il est marqué offert (« 100 % », « offert », « gratuit ») ou si une remise écrite en € laisse un net à 0
 * (« 59,00   1   59,00 €   0,00 ») ; sinon oui dès qu'un montant de la ligne n'est pas nul. Le dernier montant ne suffit pas :
 * c'est souvent une colonne de remboursement (« 29,00   1   29,00   0,00   0,00 »).
 */
function estPaye(ligne: string): boolean {
  if (/\b100\s?%|\boffert|\bgratuit/i.test(A(ligne))) return false;
  if (!montants(ligne).some((m) => m > 0.005)) return false;
  const segments = normaliser(ligne).split('€');
  if (segments.length > 1 && montants(segments[0]).length) {
    const net = montants(segments.slice(1).join(' '))[0];
    if (net !== undefined) return net > 0.005;
  }
  return true;
}

function remiseMarquee(l: string, ms: number[], net: number): boolean {
  const x = Math.max(...ms);
  const remise = Math.round((x - net) * 100) / 100;
  const segments = normaliser(l).split('€');
  const avantEuro = segments.slice(0, -1).map((s) => montants(s).at(-1)).filter((v): v is number => v !== undefined);
  return avantEuro.some((v) => Math.abs(v - remise) < 0.01) && !avantEuro.some((v) => Math.abs(v - x) < 0.01);
}

/** Libellé d'une ligne d'article sans ses colonnes de taxe et de quantité (« … Argent   1   5.50% » → « … Argent »). */
function nettoyerPropre(p: string): string {
  return p.replace(/\d+(?:[.,]\d+)?\s?%/g, ' ').replace(/(?:^|\s{2,})\d{1,2}\s*$/, '').replace(/\s{2,}\d{1,2}\s*$/, '').trim();
}

/**
 * Chaque ligne portant un montant (hors totaux, taxes, règlements) est un article. Son libellé peut être sur la ligne elle-même,
 * sur la ligne du dessus (modèle, « Aide auditive droite ») et continuer sur la ligne du dessous (côté, n° de série, classe).
 * Un article est un appareil quand son libellé nomme une marque ou un modèle (ou porte une garantie de 4 ans), qu'aucun mot d'accessoire
 * ou de prestation n'y figure et que son prix dépasse PRIX_MIN_APPAREIL. Le même appareil écrit deux fois (même code LPP) ne compte qu'une fois.
 */
function trouverArticles(lignes: string[], cible: number): Article[] {
  const out: Article[] = [];
  const fin = lignes.findIndex((l) => ZONE_DETAIL.test(A(l)));
  const limite = fin >= 0 ? fin : lignes.length;
  const montantsLignes = lignes.map(montantsArticle);
  const aMontant = montantsLignes.map((m) => m.valeurs.length > 0);
  const continuation = (l: string | undefined, i: number) => !!l && !aMontant[i] && !LIGNE_STOP.test(A(l)) && !ENTETE_TABLEAU.test(A(l)) && !/\bcaract[ée]ristiques\s+essentielles\b|\badresse\s+fab/i.test(A(l));
  const lppVus = new Set<string>();
  let borne = -1; // dernière ligne d'article déjà attribuée (appareil ou accessoire) : l'en-tête d'une fiche ne remonte pas au-delà
  for (let i = 0; i < limite; i++) {
    const l = lignes[i];
    if (!aMontant[i] || LIGNE_STOP.test(A(l))) continue;
    const ms = montantsLignes[i].valeurs;
    const propre = nettoyerPropre(montantsLignes[i].avant);
    const dessus = continuation(lignes[i - 1], i - 1) && !/^-\s/.test(lignes[i - 1]) ? lignes[i - 1] : '';
    // Le dessous : la ligne suivante si elle n'a pas de montant, ou le modèle écrit avant « Tva : 5.50 » dans une ligne de prix hors taxe
    // (« WIDEX MAGNIFY 220 RIC312D   Tva : 5.50   900.47 … »).
    const suivante = lignes[i + 1] ?? '';
    const modeleTva = /^(.{3,80}?)\s+Tva\s*:/i.exec(suivante)?.[1] ?? '';
    const dessous = continuation(lignes[i + 1], i + 1) ? lignes[i + 1] : modeleTva;
    const autour = neutre([dessus, propre, dessous].join(' '));
    const propreNeutre = neutre(propre);
    // Les mots d'accessoire ne se cherchent que dans le texte propre à la ligne quand celui-ci nomme déjà un appareil : la ligne du dessus
    // peut être la fin de l'article précédent (« Embout », « Ecouteur N° de série »). Quand la ligne de montants ne porte qu'une marque, une
    // quantité ou une garantie (« BERNAFON  1  236.97 »), le libellé est au-dessus. Et quand elle ne porte qu'un code LPP (« 7340093 I  1 …»),
    // il peut aussi être au-dessous.
    const fort = LIGNE_APPAREIL.test(propreNeutre) || MARQUES.some((m) => m.modeles?.test(A(propre)));
    let texteLigne = propre;
    if (!fort) texteLigne = [dessus, propre].join(' ');
    if (!/\p{L}{3,}/u.test(neutre(texteLigne)) && /\b73\d{5}\b/.test(l)) texteLigne = [dessus, propre, dessous].join(' ');
    const base = neutre(texteLigne);
    const brutLigne = A(texteLigne);
    // Une aide auditive est à 5,5 % de TVA : une ligne à 20 %, 10 % ou 0 % est une prestation, un consommable ou une assurance.
    const accessoire = LIGNE_PAS_APPAREIL.test(base) || GARANTIE_ACCESSOIRE.test(brutLigne) || /(?:^|\s)(?:0|10|20)(?:[.,]0+)?\s?%/.test(l);
    const quantite = quantiteDans(propre, l, montantsLignes[i].avant, ms);
    const prixLigne = quantite > 1 ? Math.max(...ms) : prixDeLigne(ms);
    const prixClasse = quantite > 1 ? prixLigne / quantite : prixLigne;
    const libelle = neutre(dessus + ' ' + propre);
    const preuve = [libelle, base].some((t) => !!marqueDans(t) || LIGNE_APPAREIL.test(t)) || GARANTIE_APPAREIL.test(A(dessus + ' ' + propre)) || GARANTIE_APPAREIL.test(brutLigne);
    let appareil: AppareilInterne | null = null;
    const borneIci = borne;
    // Prix payé (remise déduite) pour le montant de l’appareil ; la classe garde le prix TTC catalogue (prixClasse).
    const prixPaye = quantite > 1 ? prixClasse : prixNetDeLigne(ms) ?? prixClasse;
    const netSur = prixPaye !== prixClasse && remiseMarquee(l, ms, prixPaye);
    const reprise = () => decrireAppareil(lignes, i, propre, dessus, dessous, autour, borneIci, quantite, prixClasse, ms, aMontant, prixPaye, netSur);
    if (!accessoire && preuve && prixClasse >= PRIX_MIN_APPAREIL) {
      const lpp = /\b73\d{5}\b/.exec(l)?.[0] ?? '';
      if (!lpp || !lppVus.has(lpp)) {
        if (lpp) lppVus.add(lpp);
        appareil = reprise();
      }
      borne = i;
    } else if (accessoire) borne = i;
    out.push({ ligne: l, texte: autour, appareil, accessoire, prixClasse, reprise });
  }
  // Reprise : les codes de la facture (ou les côtés nommés) annoncent plus d'appareils que de lignes reconnues, parce que le libellé du modèle
  // n'est pas sur la ligne de montants (descriptions sur plusieurs lignes, modèle absent). On retient d'abord les lignes qui portent un code
  // d'aide auditive, puis les lignes les plus chères (une aide auditive coûte au moins 500 € TTC), jamais un accessoire reconnu.
  const trouves = () => out.reduce((n, a) => n + (a.appareil?.quantite ?? 0), 0);
  if (cible > trouves()) {
    const libres = out.filter((a) => !a.appareil && !a.accessoire && a.prixClasse >= PRIX_MIN_APPAREIL);
    const parCode = libres.filter((a) => CODE_APPAREIL.test(a.ligne));
    const parPrix = libres.filter((a) => !CODE_APPAREIL.test(a.ligne) && a.prixClasse >= 500).sort((x, y) => y.prixClasse - x.prixClasse);
    for (const a of [...parCode, ...parPrix]) {
      if (trouves() >= cible) break;
      const lpp = /\b73\d{5}\b/.exec(a.ligne)?.[0] ?? '';
      if (lpp && lppVus.has(lpp)) continue;
      if (lpp) lppVus.add(lpp);
      a.appareil = a.reprise();
    }
  }
  return out;
}

/**
 * Montants d'une ligne d'article et le texte qui les précède. Ce sont ceux à deux décimales ; à défaut, deux prix à une décimale
 * (« 7322936   1748.8   1845.0 », certains tableaux suppriment le zéro final).
 */
function montantsArticle(ligne: string): { valeurs: number[]; avant: string } {
  const ms = montantsDetail(ligne);
  if (ms.length) {
    let valeurs = ms.map((m) => m.valeur);
    let avant = avantPremierMontant(ligne);
    // « SIGNIA 1 900.47 5.5 950.00 » : quand la quantité touche le prix, « 1 900.47 » se lit 1900.47. Si le prix TTC qui suit vaut 1,055 fois
    // 900.47 (ou autant) et pas 1,055 fois 1900.47, c'est la quantité 1 suivie du prix 900.47.
    const m0 = /^([12]) (\d{3}[.,]\d{2})$/.exec(ms[0].texte);
    if (m0 && valeurs.length >= 2) {
      const alt = nombre(m0[2]);
      const attendu = (v: number) => valeurs.slice(1).some((x) => x > 0 && Math.abs(x / v - 1.055) < 0.012);
      if (attendu(alt) && !attendu(valeurs[0])) {
        valeurs = [alt, ...valeurs.slice(1)];
        avant = `${avant}   ${m0[1]}`.trim();
      }
    }
    return { valeurs, avant };
  }
  const l = normaliser(ligne);
  const alt = [...l.matchAll(/(?<=^|\s{2,})(\d{3,5}\.\d)(?=\s{2,}|\s*$)/g)];
  if (alt.length >= 2) return { valeurs: alt.map((m) => +m[1]), avant: l.slice(0, alt[0].index).trim() };
  return { valeurs: [], avant: ligne };
}

/**
 * Lignes de tête d'une fiche (marque + modèle, « Fabricant : … ») au-dessus d'une ligne de montants, jusqu'au précédent article attribué
 * ou à un en-tête de tableau. Les lignes de montants non attribuées (« P2D 7379971  1550,00 EUR ») sont lues jusqu'à leur premier montant.
 */
function enTeteFiche(lignes: string[], i: number, borne: number, aMontant: boolean[]): string {
  const trouvees: string[] = [];
  for (let j = i - 1; j > borne && j >= i - 14; j--) {
    const la = A(lignes[j]);
    if (ENTETE_TABLEAU.test(la) || LIGNE_STOP.test(la)) break;
    const texte = aMontant[j] ? A(montantsArticle(lignes[j]).avant) : la;
    if (marqueDans(texte) || LIGNE_APPAREIL.test(texte) || FORMES.some((f) => f.motifs.test(texte)) || /\bfabricant\b/i.test(texte)) trouvees.unshift(texte);
  }
  return neutre(trouvees.join(' '));
}

/** Lignes qui passent sans clore la description d'un appareil : prix comprenant, éco-taxe, codes LPP, garantie, adresse du fabricant. */
const LIGNE_DESCRIPTIVE = /^\s*(?:prix\s+(?:brut\s+)?comprenant|dont\s+[ée]co|tips\s*:|code\s+lpp|cet\s+(?:article|appareil)\s+est\s+garanti|garantie\s+fabricant|adresse\s+fab|caract[ée]ristiques)/i;

/**
 * Les lignes qui suivent un appareil et le décrivent (« Caractéristiques essentielles : - Contour, 20 canaux », « - Intra, 64 canaux »), jusqu'à la
 * prochaine ligne d'article ou de total. Elles ne servent qu'à lire la forme (RIC, contour, intra).
 */
function avalAppareil(lignes: string[], i: number, aMontant: boolean[]): string {
  const lues: string[] = [];
  for (let k = i + 1; k < Math.min(lignes.length, i + 14); k++) {
    const la = A(lignes[k]);
    if (LIGNE_DESCRIPTIVE.test(la)) { lues.push(la); continue; }
    if (aMontant[k] || LIGNE_STOP.test(la) || ENTETE_TABLEAU.test(la)) break;
    lues.push(la);
  }
  return neutre(lues.join(' '));
}

function decrireAppareil(
  lignes: string[], i: number, propre: string, dessus: string, dessous: string, autour: string,
  borne: number, quantite: number, prixClasse: number, ms: number[], aMontant: boolean[], prixPaye: number = prixClasse, netSur = false,
): AppareilInterne {
  const l = lignes[i];
  const entete = enTeteFiche(lignes, i, borne, aMontant);
  const propreNeutre = neutre(propre);
  const choisir = <T>(f: (t: string) => T, vide: T, ...textes: string[]): T => {
    for (const t of textes) { const v = f(t); if (v !== vide && v !== '' && v !== null) return v; }
    return vide;
  };
  const marque = choisir(marqueDans, '', autour, entete);
  const formeBase = formeDesTextes([A(propre), A([dessus, propre, dessous].join(' ')), autour, entete, avalAppareil(lignes, i, aMontant)]);
  const cote = choisir(coteDans, '' as Appareil['cote'], propreNeutre, neutre(dessous), neutre(dessus)) || coteParLpp(l + ' ' + dessus + ' ' + dessous + ' ' + entete);
  // Prix affiché : le plus grand montant de la ligne (prix TTC avant remise), divisé par la quantité. Les autres colonnes — base de
  // remboursement, part de l'assurance maladie, remise, quantité « 1,00 » — sont plus petites.
  const prixUnitaire = ms.length ? prixClasse : null;
  const montant = prixUnitaire === null ? null : Math.round(prixUnitaire * quantite * 100) / 100;
  const designation = (/\p{L}{3,}/u.test(propreNeutre) ? propre : dessus || propre)
    .replace(/^\d{6,}/, '').replace(/^[A-Z]{2,3}-[A-Z]{2,4}\d{2,5}(?=[A-Z])/, '').replace(/\s*-\s*$/, '').replace(/\s+/g, ' ').trim();
  return {
    ligne: l, designation, marque, forme: formeBase, formeBase, niveau: '', plateforme: '', quantite, prixUnitaire, montant, cote,
    rechargeable: RECHARGEABLE.test(autour) || RECHARGEABLE.test(entete),
    texteComplet: [autour, entete].join(' '),
    ctx: { propreNeutre, autour, entete },
    prixClasse,
    prixNet: ms.length && Math.abs(prixPaye - prixClasse) > 0.01 ? prixPaye : null,
    prixNetSur: netSur,
  };
}

/**
 * Forme de base par mots-clés (catalogue.ts, FORMES) dans les textes d'un appareil, du plus proche au plus lointain : un nom de modèle sans
 * ambiguïté (Silk, Styletto, Active) où qu'il soit, sinon la première forme nommée, sinon « intra » seul.
 */
function formeDesTextes(textes: string[]): string {
  for (const f of FORMES) if (f.specifique && textes.some((t) => f.motifs.test(t))) return f.code;
  for (const t of textes) { const f = FORMES.find((x) => !x.specifique && !x.faible && x.motifs.test(t)); if (f) return f.code; }
  for (const t of textes) { const f = FORMES.find((x) => x.faible && x.motifs.test(t)); if (f) return f.code; }
  return '';
}

/** Le côté que désigne le code LPP écrit dans le texte, s'il n'y en a qu'un (ou plusieurs du même côté). */
export function coteParLpp(texte: string): 'D' | 'G' | '' {
  const cotes = new Set([...texte.matchAll(/\b73\d{5}\b/g)].map((m) => LPP_COTE[m[0]]).filter(Boolean));
  return cotes.size === 1 ? [...cotes][0] : '';
}

/** Côté d'un appareil dans un texte débarrassé des phrases neutres (« identiques à la prothèse droite »). */
function coteDans(t: string): Appareil['cote'] {
  const d = /\bdroite?\b|\bOD\b|\bappareil\s+D\b|\bP[12]D\b|\bN°\s*\d{5,}\s?R\b|\(D\)|\bOr\.D\b/i.test(t);
  const g = /\bgauche\b|\bOG\b|\bappareil\s+G\b|\bP[12]G\b|\bN°\s*\d{5,}\s?L\b|\(G\)|\bOr\.G\b/i.test(t);
  return d && !g ? 'D' : g && !d ? 'G' : '';
}

/**
 * Quantité : « x2 » ou « 2 x » écrits en minuscules (« 3X » est une plateforme Signia, pas une quantité), colonne Qté juste avant ou
 * juste après le premier montant ; 1 par défaut. Une quantité de plus de 2 pour une aide auditive n'existe pas : on garde 1.
 */
function quantiteDans(propre: string, ligne: string, avantMontant: string, ms: number[]): number {
  const q = (n: number) => (n >= 1 && n <= 2 ? n : 1);
  const mx = /(?:^|\s)(?:x\s?(\d{1,2})|(\d{1,2})\s?[x×])(?=\s|$)/.exec(propre);
  if (mx) return q(+(mx[1] ?? mx[2]));
  const avant = /\s{2,}(\d)\s*$/.exec(avantMontant) ?? /^(\d)\s*$/.exec(avantMontant);
  if (avant) return q(+avant[1]);
  // Un chiffre isolé entre deux montants consécutifs (« 950,00 1 950,00 »). On compare aux montants déjà lus : dans « 2 132,70 2 250,00 »
  // le « 2 » est un séparateur de milliers, pas une quantité.
  if (ms.length >= 2) {
    const d = decoller(normaliser(ligne));
    const det = montantsDetail(ligne);
    for (let k = 0; k + 1 < det.length; k++) {
      const gap = d.slice(det[k].index + det[k].texte.length, det[k + 1].index);
      const m = /^\s+([12])\s+$/.exec(gap);
      if (m) return +m[1];
    }
  }
  return 1;
}

/** Tous les niveaux connus du référentiel : un nombre isolé n'est candidat que s'il y figure (ou s'il est petit : 1 à 99). */
const NIVEAUX_REFERENTIEL = new Set(Object.values(NIVEAUX).flat().filter(Boolean));

/**
 * Niveaux candidats d'un texte : `surs` viennent d'une écriture qui nomme un niveau (« L90 », « Moxi V3 », « VB561 », « 7IX », « AI 2400 »),
 * `generiques` de simples nombres isolés. Jamais une taille de pile (312, 13, 10, 675), un nombre de canaux, un n° de série, un code LPP.
 */
function niveauxCandidats(texte: string, fabricant: string): { surs: string[]; generiques: string[] } {
  const t = texte.replace(PHRASES_NEUTRES, ' ');
  const surs: string[] = [];
  const generiques: string[] = [];
  const ajoute = (liste: string[], n?: string) => { if (n && !liste.includes(n)) liste.push(n); };
  const de = (...noms: string[]) => fabricant === '' || noms.includes(fabricant);
  // Phonak : lettre de la génération + 30 / 50 / 70 / 90 (L90-R, I 70 R, E 50 R).
  if (de('Phonak')) for (const m of t.matchAll(/\b[LPMIBE][-\s]?(90|70|50|30)(?!\d)/gi)) ajoute(surs, m[1]);
  // Unitron : « Moxi V3-312 », « Moxi S9-R », « Insera B3-10 ».
  if (de('Unitron')) for (const m of t.matchAll(/\b(?:moxi|insera|stride)\s*[A-Z]?\s?([3579])(?!\d)/gi)) ajoute(surs, m[1]);
  // ReSound : deux lettres + niveau + deux chiffres (SA461, VB 561, RU560, NX-760, LI577), ou le nom de la famille + ce nombre (« Savi 461 »).
  if (de('ReSound')) {
    for (const m of t.matchAll(/\b[A-Z]{2}[-\s]?([3-9])\d{2}(?!\d)/g)) ajoute(surs, m[1]);
    for (const m of t.matchAll(/\b(?:savi|nexia|omnia|vivia|vibrant|quattro|ligo)\s*([3-9])\d{2}(?!\d)/gi)) ajoute(surs, m[1]);
  }
  // Widex et Acuitis : 110, 220, 330, 440…
  if (de('Widex', 'Acuitis')) for (const m of t.matchAll(/\b(110|220|330|440|550|660|770)(?!\d)/g)) ajoute(surs, m[1]);
  // Starkey, Audibel, Philips : gammes à quatre chiffres (« AI 2400 », « Livio 1200 », « i1200 », « HearLink 9050 »), forme intercalée comprise (« Omega AI RIC 24 312 »).
  if (de('Starkey', 'Audibel', 'Philips')) {
    for (const m of t.matchAll(/\b(?:AI|edge|omega|genesis|evolv|livio|arc|intrigue|vitality|aris|muse\s*iq)\s*(?:(?:m?RIC|RITE|CIC|ITC|ITE|IIC|BTE)(?:\s*R\b)?\s*)?(\d{2}|\d{4})(?!\d)/gi)) ajoute(surs, m[1]);
    for (const m of t.matchAll(/\bi(\d{4})\b|\b(\d{4})\s*(?:m?RIC|ITC|CIC|BTE|IIC)\b|\bhear\s*link\s*(\d{4})\b/gi)) ajoute(surs, m[1] ?? m[2] ?? m[3]);
  }
  // Hansaton : « Sound E7 R ».
  if (de('Hansaton')) for (const m of t.matchAll(/\b[A-Z]([3579])\b/g)) ajoute(surs, m[1]);
  // Signia et autres : « 7IX », « 3 X », « 5 AX », « 3NX », « 5px », « 7MaX » (mais pas 312 : c'est la pile).
  for (const m of t.matchAll(/(?:^|[\s(])(\d{1,3})T?\s?(?:IX|AX|MaX|X|Nx|px)\b/gi)) if (!TAILLES_PILES.has(m[1])) ajoute(surs, m[1]);
  // Signia Intuis : « Intuis 4.2 P », « INTUIS M 4.2 » → 4.
  for (const m of t.matchAll(/\bintuis\s*(?:[A-Z]\s+)?(\d)(?![\d])/gi)) ajoute(surs, m[1]);
  // Un nombre juste après le nom d'une famille : « Intent 1_MiniRITE », « Zircon 2 », « Alpha 9 », « Reach 80 ».
  for (const m of t.matchAll(/\b(?:intent|real|more|zircon|ruby|own|zeal|alpha|aligo|viron|zerena|leox|encanta|nexia|omnia|vivia|ligo|quattro|vibrant|wing|enjoy|evoke|magnify|allure|moment|mosaic|reach|m[- ]?core|bi[- ]?core|livio|inox|essentiel|excellence)\s*(?:xt|s|ai)?\s*[-_ ]?\s*(\d{1,3})(?!\d)/gi)) {
    if (!TAILLES_PILES.has(m[1]) && +m[1] >= 1) ajoute(surs, m[1]);
  }
  // Nombres isolés, dans l'ordre de lecture, une fois retirés codes et n° de série.
  const nettoye = t.replace(/\b\d{5,}\b/g, ' ').replace(/\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{5,}\b/g, ' ');
  for (const m of nettoye.matchAll(/(?<![\w,.\/])(\d{1,4})(?![\w,.\/])/g)) {
    const n = m[1];
    if (TAILLES_PILES.has(n) || +n < 1) continue;
    if (n.length >= 3 && !NIVEAUX_REFERENTIEL.has(n)) continue;
    const apres = nettoye.slice((m.index ?? 0) + n.length);
    const avant = nettoye.slice(0, m.index ?? 0);
    if (/^\s*(?:canaux|canal|ans?\b|mois|jours?|%|€|euros?|programmes?|heures?|h\b|cm|mm|x\b|er\b|e\b|è)/i.test(apres)) continue;
    if (/(?:\bRIC|\bpiles?|\bLPP|n°|\bx|\btaille|\btype|\bqt[ée]?|\bclasse|\bcanaux\s*:|\bP[12][DG])\s*:?\s*$/i.test(avant)) continue;
    ajoute(generiques, n);
  }
  return { surs, generiques };
}

/**
 * Niveau de gamme : « Silk 7 IX » → 7, « Audeo L90-R » → 90, « Moment 440 » → 440, « Moxi V3-312 » → 3, « Vivia VI560 » → 5,
 * « Edge AI 16 » → 16. Quand le fabricant est connu, on garde le premier candidat qui figure dans sa liste du référentiel ; à défaut,
 * un niveau « sûr » (écriture qui nomme un niveau) même hors liste, et rien plutôt qu'un simple nombre isolé.
 */
export function niveauDans(texte: string, fabricant = ''): string {
  const { surs, generiques } = niveauxCandidats(texte, fabricant);
  const liste = (NIVEAUX as Record<string, string[] | undefined>)[fabricant];
  const tous = [...surs, ...generiques];
  if (liste) return tous.find((n) => liste.includes(n)) ?? surs[0] ?? '';
  return tous[0] ?? '';
}

/**
 * Plateforme d'un appareil : parmi toutes celles qui collent au texte (catalogue), la première qui existe dans la liste du fabricant
 * du référentiel ; sinon la première famille nommée (« G Series », « Verit »…), jamais une écriture codée (IX, L90) d'un autre fabricant.
 */
export function plateformeDans(textes: string[], fabricant: string): string {
  const candidates: { nom: string; code?: boolean }[] = [];
  for (const t of textes) for (const p of PLATEFORMES) if (p.motifs.test(t) && !candidates.some((c) => c.nom === p.nom)) candidates.push(p);
  const liste = (PLATEFORMES_REFERENTIEL as Record<string, string[] | undefined>)[fabricant];
  if (liste) return candidates.find((c) => liste.includes(c.nom))?.nom ?? candidates.find((c) => !c.code)?.nom ?? '';
  return candidates[0]?.nom ?? '';
}

/** Mentions explicites de classe dans le texte d'un appareil : « Classe I », « Classe:II », « 7336200 I », « 100 % santé ». */
function classesDans(texte: string): ('1' | '2')[] {
  const out: ('1' | '2')[] = [];
  for (const m of texte.matchAll(/\bclasse\s*:?\s*(II|I|[12])\b/gi)) out.push(/^(II|2)$/i.test(m[1]) ? '2' : '1');
  for (const m of texte.matchAll(/\b\d{7}\s+(II|I)\b/g)) out.push(m[1] === 'II' ? '2' : '1');
  if (/100\s*%\s*sant[ée]/i.test(texte)) out.push('1');
  return out;
}

/**
 * Codes de regroupement LPP (P1D, P2G…) : un par appareil, avec sa classe et son côté. Un même code écrit plusieurs fois (article, tiers payant,
 * deuxième page) ne compte qu'une fois.
 */
function codesRegroupement(lignes: string[]): { classe: '1' | '2'; cote: 'D' | 'G'; ligne: string }[] {
  const out: { classe: '1' | '2'; cote: 'D' | 'G'; ligne: string }[] = [];
  const vus = new Set<string>();
  for (const l of lignes) {
    for (const m of l.matchAll(CODE_REGROUPEMENT)) {
      const cle = m[1] + m[2];
      if (vus.has(cle)) continue;
      vus.add(cle);
      out.push({ classe: m[1] as '1' | '2', cote: m[2] as 'D' | 'G', ligne: l });
    }
  }
  return out;
}

/** Côtés nommés en clair (« Aide auditive droite », « Appareil G. », « oreille gauche ») : la liste des côtés distincts. */
function marqueursCote(texte: string): ('D' | 'G')[] {
  const out = new Set<'D' | 'G'>();
  for (const m of texte.matchAll(/\b(?:aide\s+auditive|appareil|oreille|proth[èe]se)\s+(droite?|gauche|D\.|G\.)(?![\w'])/gi)) {
    out.add(/^(?:droite?|D\.)$/i.test(m[1]) ? 'D' : 'G');
  }
  return [...out];
}

// ── Total TTC ────────────────────────────────────────────────────────────────

const EXCLU_TOTAL = /sous[- ]total|total\s*ht|\bht\b|\btva\b|avant\s+remise|\bremise\b|acompte|reste\s*(?:à|a)\s*(?:charge|payer|r[ée]gler)|reste\s+d[ûu]|restant|d[ée]j[àa]\s*(?:vers|pay|r[ée]gl)|\bpart\b|rbst|rembours|s[ée]cu|compl[ée]mentaire|mutuelle|\bRO\b|\bRC\b|\bAMO\b|\bAMC\b|tiers[- ]payant|\bcapital\b/i;
const NIVEAUX_TOTAL: RegExp[] = [
  /total\s*(?:ttc|t\.t\.c\.?)|total\s+net\s+ttc/i,
  /montant\s*ttc|total\s*(?:de\s*la\s*)?facture|montant\s*(?:de\s*la\s*)?facture|total\s*g[ée]n[ée]ral|montant\s*total|total\s*net\b|net\s*ttc/i,
  /^\s*(?:total|totaux)\b(?!\s*(?:ht|tva))/i,
  /net\s*(?:à|a)\s*payer|montant\s+(?:à|a)\s+payer/i,
];

/** Un nombre écrit à la française ou à l'anglaise, avec ou sans décimales : « 1900 », « 1 900,00 », « 1,800.95 », « 3554.5 ». */
const NB = String.raw`-?\d+(?:[ .,]\d{3})*(?:[.,]\d+)?`;
/** Ligne de récapitulatif « Total  HT  TTC  -  TVA » (le TTC peut être un entier : « 1900 »). */
const RANGEE_TOTAL = new RegExp(String.raw`\btotal\s{2,}(${NB})\s{2,}(${NB})\s{2,}[-–]\s{2,}(${NB})\s*$`, 'i');
/** Ligne de TVA d'un récapitulatif : « HT  TTC  5.5 %  TVA » (HT + TVA = TTC). */
const RANGEE_TVA = new RegExp(String.raw`(?:^|\s{2,})(${NB})\s{2,}(${NB})\s{2,}(\d{1,2}(?:[.,]\d+)?)\s?%\s{2,}(${NB})\s*$`);

/** Le total TTC d'après les lignes de récapitulatif : une ligne « Total », sinon la somme des lignes de TVA (une par taux). */
function totalParRecapitulatif(lignes: string[], partie: 'total' | 'taux'): { valeur: number; ligne: string } | null {
  const coherent = (ht: number, ttc: number, tva: number) => ttc > 0 && Math.abs(ht + tva - ttc) <= 0.05;
  if (partie === 'total') for (const l of lignes) {
    const m = RANGEE_TOTAL.exec(l);
    if (!m) continue;
    const [ht, ttc, tva] = [nombre(m[1]), nombre(m[2]), nombre(m[3])];
    if (coherent(ht, ttc, tva)) return { valeur: ttc, ligne: l };
  }
  if (partie === 'total') return null;
  const parTaux = new Map<string, { valeur: number; ligne: string }>();
  for (const l of lignes) {
    const m = RANGEE_TVA.exec(l);
    if (!m) continue;
    const [ht, ttc, tva] = [nombre(m[1]), nombre(m[2]), nombre(m[4])];
    const taux = String(+m[3].replace(',', '.'));
    if (!coherent(ht, ttc, tva) || parTaux.has(taux)) continue;
    parTaux.set(taux, { valeur: ttc, ligne: l });
  }
  if (!parTaux.size) return null;
  const somme = [...parTaux.values()].reduce((n, x) => n + x.valeur, 0);
  return { valeur: Math.round(somme * 100) / 100, ligne: [...parTaux.values()].map((x) => x.ligne).join(' | ') };
}

/**
 * Tableau « total brut, remise, total net, TVA, TTC, part assurance maladie, part complémentaire, reste à charge » écrit sur une seule ligne :
 * le total TTC est le montant de la ligne qui est égal à la somme des trois derniers (assurance maladie + complémentaire + reste à charge).
 */
function totalParRepartition(lignes: string[], seuil: number): { valeur: number; ligne: string } | null {
  for (const ligne of lignes) {
    const v = montants(ligne);
    if (v.length < 6) continue;
    const somme = Math.round((v[v.length - 1] + v[v.length - 2] + v[v.length - 3]) * 100) / 100;
    if (somme > 0 && somme >= seuil && v.slice(0, -3).some((x) => Math.abs(x - somme) < 0.02)) return { valeur: somme, ligne };
  }
  return null;
}

/**
 * Le total TTC de la facture : « Total TTC » d'abord, puis « Montant TTC / Total facture », puis une ligne « Total » nue (le plus grand
 * montant de la ligne, les colonnes HT et TVA étant plus petites), puis le récapitulatif de TVA, enfin « Net à payer ».
 * Jamais un sous-total, un HT ou une part.
 */
function trouverTotal(lignes: string[], seuil = 0): { valeur: number; ligne: string } | null {
  for (let n = 0; n < NIVEAUX_TOTAL.length; n++) {
    // Les récapitulatifs passent avant une ligne « Total » nue (dont le TTC entier, « 1900 », échappe à la lecture des montants) et avant « Net à payer ».
    if (n === 2 || n === 3) {
      const recap = totalParRecapitulatif(lignes, n === 2 ? 'total' : 'taux');
      if (recap) return recap;
    }
    if (n === 2) {
      const reparti = totalParRepartition(lignes, seuil);
      if (reparti) return reparti;
    }
    let trouve: { valeur: number; ligne: string } | null = null;
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];
      // « Total (dont Remise 280.00 €)   3 222.74 €   3 400.00 € » : la parenthèse explique le total, elle n'en fait pas une remise.
      const l = A(ligne).replace(/\([^)]*\)/g, ' ');
      const m = NIVEAUX_TOTAL[n].exec(l);
      if (!m) continue;
      if (EXCLU_TOTAL.test(l) && !/total\s*(?:ttc|t\.t\.c)/i.test(l)) continue;
      if (n < 2 && /avant\s+remise/i.test(l)) continue;
      let ms = montantsDetail(l);
      let preuve = ligne;
      if (!ms.length) {
        // Libellé seul (« Total TTC ») : le montant est sur la ligne d'après, s'il y est seul.
        const s = lignes[i + 1] ?? '';
        // … ou à la fin de la ligne « Code 2 : Taux 5,50 %  HT  TVA  TTC » qui suit (le libellé « Total T.T.C » est sur la ligne du dessus).
        if (!/\p{L}{3,}/u.test(s.replace(/€|eur(?:os)?/gi, '')) && montants(s).length === 1) { ms = montantsDetail(s); preuve = `${ligne} ${s}`; }
        else if (/^\s*(?:code\s*\d|taux)\b/i.test(s) && montants(s).length >= 1) { ms = montantsDetail(s); preuve = `${ligne} ${s}`; }
        else continue;
      }
      const apres = ms.filter((x) => x.index >= (m.index ?? 0) + m[0].length);
      // « Total TTC » et « Net à payer » : le premier montant qui suit. « Total général », « Total facture » et la ligne « Total » nue
      // portent souvent HT, TVA et TTC à la suite : le TTC est le plus grand.
      const valeur = n === 1 ? Math.max(...(apres.length ? apres : ms).map((x) => x.valeur))
        : n === 2 ? Math.max(...ms.map((x) => x.valeur))
        : (apres[0] ?? ms[ms.length - 1]).valeur;
      // Un total plus petit que la moitié du plus gros appareil est un sous-total (TVA, part…), pas le total de la facture.
      if (valeur < seuil) continue;
      if (valeur > 0 || trouve === null) trouve = { valeur, ligne: preuve };
    }
    if (trouve && trouve.valeur > 0) return trouve;
  }
  return null;
}

// ── Parts de remboursement ───────────────────────────────────────────────────

const PART_COMBINEE = /ro\s*\+\s*(?:part\s*)?rc|ss\s*\/\s*compl|s[ée]cu\s*\+\s*(?:compl|mut)|rc\s*\+\s*(?:part\s*)?ro/i;
const PART_SECU = /\bpart\b[^:\n]*\b(?:s[ée]cu\w*|ss|ro|amo|r[ée]gime\s+obligatoire|assurance\s+maladie\s+obligatoire)\b|\bpris\s+en\s+charge\s+par\s+l'amo\b|^\s*ro\s*:|\btiers[- ]payant\s+(?:ro|ss)\b/i;
const PART_COMPL = /\bpart\b[^:\n]*\b(?:compl\w*|mutuelle|rc|amc|organisme\s+compl\w*)\b|\bpris\s+en\s+charge\s+par\s+l'amc\b|^\s*rc\s*:|\btiers[- ]payant\s+(?:rc|mut\w*)\b/i;

/** Part sécu / part complémentaire par leurs libellés (« Part RO », « Part Mutuelle », « Pris en charge par l'AMC », « RC : »). */
function partsRemboursement(lignes: string[], champs: Record<ChampFacture, string>, preuves: Partial<Record<ChampFacture, string>>) {
  const valeurSur = (i: number): { v: number; l: string } | null => {
    const ms = montants(lignes[i]);
    if (ms.length) return { v: ms[ms.length - 1], l: lignes[i] };
    // Libellé seul (« Part Sécurité ») : le montant est sur la ligne d'après, s'il est seul.
    const s = lignes[i + 1] ?? '';
    const ms2 = montants(s);
    if (ms2.length === 1 && !/\p{L}{3,}/u.test(s.replace(/€|eur/gi, ''))) return { v: ms2[0], l: `${lignes[i]} ${s}` };
    return null;
  };
  for (let i = 0; i < lignes.length; i++) {
    const l = A(lignes[i]);
    if (PART_COMBINEE.test(l)) continue;
    if (!champs.partSecu && PART_SECU.test(l)) { const r = valeurSur(i); if (r) { champs.partSecu = formaterMontant(r.v); preuves.partSecu = r.l; } }
    if (!champs.partCompl && PART_COMPL.test(l) && !PART_SECU.test(l.replace(PART_COMPL, ''))) { const r = valeurSur(i); if (r) { champs.partCompl = formaterMontant(r.v); preuves.partCompl = r.l; } }
  }
}

// ── Règles apprises ──────────────────────────────────────────────────────────

/** Clé d'émetteur pour les règles apprises : SIRET, sinon FINESS, sinon le nom aplati. */
export function cleEmetteur(champs: Pick<Record<ChampFacture, string>, 'siret' | 'finess' | 'emetteur'>): string {
  if (champs.siret) return 'siret:' + champs.siret;
  if (champs.finess) return 'finess:' + champs.finess;
  return 'nom:' + plat(champs.emetteur).replace(/[^a-z0-9]/g, '');
}

function appliquerRegle(lignes: string[], r: RegleApprise): { valeur: string; ligne: string } | null {
  const avant = plat(r.avant).trim();
  if (!avant) return null;
  for (let i = 0; i < lignes.length; i++) {
    const ligne = normaliser(lignes[i]);
    const idx = plat(ligne).indexOf(avant);
    if (idx < 0) continue;
    if (r.ligneSuivante) {
      // Libellé en tête de colonne : la valeur est sur la ligne d'après, dans la même colonne.
      const suivante = lignes[i + 1];
      if (!suivante) return null;
      const valeur = colonnes(suivante)[r.colonne ?? 0];
      return valeur ? { valeur, ligne: suivante } : null;
    }
    const reste = ligne.slice(idx + avant.length).replace(/^\s*[:.\-–]\s*/, '');
    const valeur = colonnes(reste)[0];
    if (valeur) return { valeur, ligne: lignes[i] };
  }
  return null;
}

/** Une valeur trouvée par une règle apprise, remise au format du champ : un montant pour les montants, une date pour les dates. */
function valeurDeRegle(champ: ChampFacture, valeur: string): string | null {
  if (champ === 'totalTtc' || champ === 'partSecu' || champ === 'partCompl') {
    const ms = montants(valeur);
    return ms.length ? formaterMontant(ms[ms.length - 1]) : null;
  }
  if (champ === 'dateFacture' || champ === 'naissance') return /\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/.exec(valeur)?.[0] ?? null;
  return valeur;
}

/**
 * Un libellé de règle n'est mémorisé (et copié dans le fichier de sauvegarde) que s'il ressemble à un libellé : des lettres,
 * ni date, ni longue suite de chiffres, ni rien de ce qui identifie le patient (nom, date de naissance, NIR lus sur la facture).
 */
export function libelleSur(avant: string, interdits: string[] = []): boolean {
  const t = plat(avant).toLowerCase();
  if (!/[a-z]{2}/.test(t) || t.length > 60) return false;
  if (/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/.test(t) || /\d{5,}/.test(t.replace(/\s/g, ''))) return false;
  return !interdits.some((x) => x && plat(x).toLowerCase().split(/[^a-z0-9]+/).some((mot) => mot.length >= 4 && t.includes(mot)));
}

/**
 * Apprend d'un exemple : la valeur sélectionnée par l'utilisateur dans le texte de la facture.
 * Retourne la règle à mémoriser (libellé qui précède sur la ligne, ou la ligne du dessus), ou null si la sélection n'est pas retrouvée.
 */
export function apprendre(lignes: string[], champ: ChampFacture, selection: string, emetteurCle: string, interdits: string[] = []): RegleApprise | null {
  const sel = normaliser(selection).trim();
  if (!sel || /^nom:$/.test(emetteurCle)) return null;
  const retrouve = (r: RegleApprise) => {
    const v = appliquerRegle(lignes, r)?.valeur;
    return !!v && plat(v).includes(plat(sel));
  };
  for (let i = 0; i < lignes.length; i++) {
    const l = normaliser(lignes[i]);
    const idx = l.indexOf(sel);
    if (idx < 0) continue;
    // Colonnes séparées par trois espaces : le libellé est la cellule juste avant la valeur, sur la même ligne…
    const avantCellules = l.slice(0, idx).trimEnd().split(/ {2,}/).filter(Boolean);
    const avant = (avantCellules.at(-1) ?? '').trim().replace(/[:.\-–]\s*$/, '').trim();
    const surLaLigne: RegleApprise = { emetteurCle, champ, avant: avant.slice(-40), ligneSuivante: false };
    if (avant.length >= 2 && libelleSur(surLaLigne.avant, interdits) && retrouve(surLaLigne)) return surLaLigne;
    // … sinon l'en-tête de la même colonne, sur la ligne du dessus.
    const colonne = avantCellules.length;
    const dessus = colonnes(normaliser(lignes[i - 1] ?? ''));
    const entete = (dessus[colonne] ?? (dessus.length === 1 ? dessus[0] : '')).trim();
    const auDessus: RegleApprise = { emetteurCle, champ, avant: entete.slice(-40), ligneSuivante: true, colonne };
    if (entete.length >= 2 && libelleSur(auDessus.avant, interdits) && retrouve(auDessus)) return auDessus;
    return null;
  }
  return null;
}

export const _debugArticles = trouverArticles;
export const _debugRecap = (l: string[]) => totalParRecapitulatif(l, 'total') ?? totalParRecapitulatif(l, 'taux');
