/** Petits outils de texte partagés par l'extraction (purs : ni DOM, ni navigateur). */

/** Espaces insécables et fines → espace simple ; apostrophes typographiques → droite ; espaces répétés conservés (colonnes). */
export function normaliser(s: string): string {
  return s.normalize('NFC').replace(/[      ]/g, ' ').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\t/g, '   ');
}

/**
 * Sans accents, casse conservée. Les motifs du catalogue se testent sur cette forme : en JavaScript, `\b` ne connaît que l'ASCII,
 * si bien que `\bport\b` collerait à l'intérieur de « déporté » et que `\bà` ne collerait jamais après une espace.
 */
export function sansAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Comparaison sans accents ni casse. */
export function plat(s: string): string {
  return sansAccents(s).toLowerCase();
}

/** Les colonnes d'une ligne : séparées par au moins deux espaces (voir pdf-lignes). */
export function colonnes(ligne: string): string[] {
  return ligne.split(/ {2,}|\s\|\s/).map((c) => c.trim()).filter(Boolean);
}

/**
 * Un montant : « 1 695,00 », « 1.695,00 », « 1,695.00 », « 1 695.00 », « 950,00 », « 99.06 ».
 * Ni les pourcentages (« 5,50 % », « 20% »), ni les dates à points (« 21.05.2026 »), ni les téléphones (« 01.43.44 »).
 */
const MONTANT = /(?<![\d.,])(\d{1,3}(?:[ .]\d{3})+,\d{2}|\d{1,3}(?:[ ,]\d{3})+\.\d{2}|\d+,\d{2}|\d+\.\d{2})(?![\d%]|\s?%|[.,]\d)/g;

/**
 * Deux montants collés par la mise en page (« 950,00240,00 », « 950.001.00 ») : on glisse un espace après chaque décimale de deux
 * chiffres suivie d'un chiffre. Le style de la ligne décide quelle virgule ou quel point est une décimale (« 1,800.95 » ne doit pas être coupé).
 */
export function decoller(ligne: string): string {
  const anglais = /\d,\d{3}\.\d{2}/.test(ligne);
  const pointMilliers = /\d\.\d{3},\d{2}/.test(ligne);
  let s = ligne;
  if (!anglais) s = s.replace(/(,\d{2})(?=\d)/g, '$1 ');
  if (!pointMilliers) s = s.replace(/(\.\d{2})(?=\d)/g, '$1 ');
  return s;
}

export interface MontantTrouve { valeur: number; texte: string; index: number }

/** Les montants d'une ligne avec leur position (dans la ligne « décollée »). */
export function montantsDetail(ligne: string): MontantTrouve[] {
  const out: MontantTrouve[] = [];
  for (const m of decoller(normaliser(ligne)).matchAll(MONTANT)) {
    const n = nombre(m[1]);
    if (Number.isFinite(n)) out.push({ valeur: n, texte: m[1], index: m.index ?? 0 });
  }
  return out;
}

/** Tous les montants d'une ligne, en nombres (1 695,00 → 1695). */
export function montants(ligne: string): number[] {
  return montantsDetail(ligne).map((m) => m.valeur);
}

/** La partie d'une ligne qui précède son premier montant (le libellé d'un article), ou toute la ligne s'il n'y en a pas. */
export function avantPremierMontant(ligne: string): string {
  const l = decoller(normaliser(ligne));
  const m = montantsDetail(l)[0];
  return (m ? l.slice(0, m.index) : l).trim();
}

/** « 1 695,00 » / « 1.695,00 » / « 1,695.00 » / « 1 695.00 » / « 1695.00 » → 1695 ; « 949,2 » → 949,2 (une décimale tapée à la main). */
export function nombre(s: string): number {
  let t = s.replace(/\s/g, '');
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/** 1695 → « 1 695,00 ». */
export function formaterMontant(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '';
  const [ent, dec] = n.toFixed(2).split('.');
  return ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec;
}

const MOIS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
  janv: 1, fevr: 2, avr: 4, juil: 7, sept: 9, oct: 10, nov: 11, dec: 12,
};

export interface DateTrouvee { iso: string; texte: string; index: number }

/** Toutes les dates d'une ligne : 02/10/2026, 2.10.26, 2026-10-02, « 2 octobre 2026 », « vendredi 2 oct. 2026 ». */
export function dates(ligne: string): DateTrouvee[] {
  const out: DateTrouvee[] = [];
  const l = normaliser(ligne);
  for (const m of l.matchAll(/(?<!\d)(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/g)) {
    const j = +m[1], mo = +m[2];
    let a = +m[3];
    if (m[3].length === 2) a += a < 50 ? 2000 : 1900;
    if (j >= 1 && j <= 31 && mo >= 1 && mo <= 12) out.push({ iso: iso(a, mo, j), texte: m[0], index: m.index ?? 0 });
  }
  for (const m of l.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    out.push({ iso: iso(+m[1], +m[2], +m[3]), texte: m[0], index: m.index ?? 0 });
  }
  for (const m of plat(l).matchAll(/(?<!\d)(\d{1,2})(?:er)?\s+([a-z]{3,9})\.?\s+(\d{4})(?!\d)/g)) {
    const mo = MOIS[m[2]];
    if (mo) out.push({ iso: iso(+m[3], mo, +m[1]), texte: l.slice(m.index ?? 0, (m.index ?? 0) + m[0].length), index: m.index ?? 0 });
  }
  return out.sort((x, y) => x.index - y.index);
}

function iso(a: number, m: number, j: number): string {
  return `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

/** 2026-10-02 → 02/10/2026 (format attendu dans les champs Salesforce et les formulaires). */
export function dateFr(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate;
}

/** Numéro de sécurité sociale (15 chiffres, clé vérifiée) ; Corse (2A/2B) acceptée. */
export function nirValide(s: string): boolean {
  const t = s.replace(/\s/g, '').toUpperCase();
  if (!/^[12]\d{2}(0[1-9]|1[0-2]|[2-9]\d)(\d{2}|2A|2B)\d{6}\d{2}$/.test(t)) return false;
  const base = t.slice(0, 13).replace('2A', '19').replace('2B', '18');
  const cle = Number(t.slice(13));
  return 97 - (Number(base) % 97) === cle;
}

/** Texte après un libellé sur la ligne (« Nom de l'assuré : M. DUPONT  » → « M. DUPONT »), jusqu'à la colonne suivante. */
export function apresLibelle(ligne: string, libelle: RegExp): string | null {
  const l = normaliser(ligne);
  const m = libelle.exec(l);
  if (!m) return null;
  const reste = l.slice(m.index + m[0].length).replace(/^\s*[:.\-–]\s*/, '');
  const val = colonnes(reste)[0] ?? '';
  return val.trim() || null;
}
