/**
 * Factures d'audioprothésiste FICTIVES (centres, numéros, montants inventés ; aucun patient), reprises des tests de
 * Cockpit Factures et réduites à ce qui compte pour la catégorie. `pdfFictif` en fait un vrai PDF texte.
 */

/** Tableau à colonnes, deux appareils droite / gauche, codes de regroupement P2D / P2G. */
export const FACTURE_P2 = [
  'Audition Fictive',
  '12 rue des Exemples',
  '75000 Paris',
  'Facture N°F2026-0042 du 02/10/2026 - FACTURE ACQUITTÉE',
  'Code Produit   Désignation   Qté   Prix Unit. TTC (€)   Montant TTC (€)',
  'AA-SIG0001   SIGNIA - PURE C&G 7 IX Graphite ABC1234 - Droit -   1   1 690,00   1 690,00',
  'Prix comprenant 300,00 € de prestation',
  'CODE LPP GEN : 2392530   CODE RGPT : P2D',
  'AA-SIG0001   SIGNIA - PURE C&G 7 IX Graphite ABC1235 - Gauche -   1   1 690,00   1 690,00',
  'CODE LPP GEN : 2341840   CODE RGPT : P2G',
  'AA-SIG0002   SIGNIA - SET CHARGEUR RIC   1   150,00   150,00',
  'Total HT (€) : 3 345,97',
  'TVA 5.50 : 184,03 €',
  'Total TTC (€) : 3 530,00',
  'Net à payer (€) : 1 850,00',
];

/** La même en classe I : codes P1D / P1G, 950 € par appareil. */
export const FACTURE_P1 = FACTURE_P2.map((l) => l
  .replace('P2D', 'P1D').replace('P2G', 'P1G').replace('2392530', '2351057').replace('2341840', '2365119')
  .replace(/1 690,00/g, '950,00').replace('3 345,97', '1 942,99').replace('184,03', '107,01').replace('3 530,00', '2 050,00'));

/** Facture CSS (fictive) : codes P2D / P2G, mais appareils à 800 € : CAT 1 dans Cockpit Benjamin (règle du 29/10/2026). */
export const FACTURE_CSS_800 = FACTURE_P2.map((l) => l.replace(/1 690,00/g, '800,00').replace('3 345,97', '1 516,59').replace('184,03', '83,41').replace('3 530,00', '1 600,00'));

/** Code P2 et appareils à 900 €, sans rien qui dise CSS : CAT 2 (une CAT 2 qui n'imprime que son prix remisé). */
export const FACTURE_P2_900 = FACTURE_P2.map((l) => l.replace(/1 690,00/g, '900,00'));
/** Code P2, appareils à 950 € pile, sans CSS : prix de classe I, CAT 1. */
export const FACTURE_P2_950 = FACTURE_P2.map((l) => l.replace(/1 690,00/g, '950,00'));
/** Code P2, appareils à 950 €, mention C2S : facture CSS, CAT 1. */
export const FACTURE_C2S_950 = [...FACTURE_P2.map((l) => l.replace(/1 690,00/g, '950,00')), 'Tiers payant C2S'];

/** Codes LPP seuls (pas de code de regroupement) : classe II par le code LPP. */
export const FACTURE_LPP = FACTURE_P2.map((l) => l.replace(/\s+CODE RGPT : P2[DG]/, ''));

/** Libellé « : » sur la même ligne, modèle au-dessus des montants, un appareil gauche. */
const factureB = (modele: string, prixTtc: string, totalHt: string, totalTtc: string) => [
  'Centre Auditif Imaginaire   Facture N° : 2026-0007',
  '4 place du Modèle   Fait le : 2 octobre 2026',
  '99000 Villexemple',
  'Modèle   Qté   Prix unitaire HT (€)   TVA   Montant TTC (€)',
  `${modele}*`,
  `XYZ9876 Garantie 4 ans Phonak   1   ${prixTtc}   5,50 %   ${prixTtc}`,
  'Chargeur Phonak',
  '1   94,79   5,50 %   100,00',
  `Total   ${totalHt}   ${totalTtc}`,
  'Reste à charge   660,00',
  'Caractéristiques des produits',
  'Aide auditive gauche - LPP 0000000 :',
  `Sonova, ${modele}`,
];

/** Mention « Classe I » écrite sur l'appareil. */
export const FACTURE_MENTION = factureB('Audéo L90-R Classe I', '950,00', '995,26', '1 050,00');
/** Ni code ni mention, appareil à 1 500 € : CAT 2 d'après le prix, à vérifier. */
export const FACTURE_PRIX_HAUT = factureB('Audéo L90-R', '1 500,00', '1 516,59', '1 600,00');

/** Ni code ni mention, un intra à 950 € : CAT 1 d'après le prix, à vérifier. */
export const FACTURE_PRIX_BAS = [
  'FACTURE N°',
  'FAC-00000000123',
  "MAISON DE L'EXEMPLE AUDITION",
  '8 avenue Fictive',
  '99100 Bourg-Modèle',
  'Bourg-Modèle le 02/10/2026',
  'Désignation   Qt   Tx TVA   P.U. HT   Total TTC',
  'Sivantos - SILK CHARGE AND GO 7 IX (CIC, 64 canaux), oreille droite   1   5.50%   900,47   950,00',
  "Garantie jusqu'au : 02/10/2030",
  'Totaux :   1   900,47 €   950,00 €',
  'Total TTC',
  '950,00 €',
  'Facture acquittée',
];

/** Une facture sans aucun appareil (prestation seule) : la catégorie ne se déduit pas. */
export const FACTURE_SANS_APPAREIL = [
  'Centre Auditif Imaginaire',
  'Facture N° 2026-0100 du 02/10/2026',
  'Désignation   Qté   Montant TTC (€)',
  'Piles taille 312 (lot de 6)   2   12,00',
  'Total TTC (€) : 24,00',
];

/** Octet WinAnsi d'un caractère (Latin-1, plus €, ’ et …). */
const winAnsi = (c: string): number => {
  const special: Record<string, number> = { '€': 0x80, '’': 0x92, '…': 0x85 };
  const code = special[c] ?? c.charCodeAt(0);
  return code <= 0xff ? code : 0x3f;
};

/** Chaîne PDF littérale, sans aucun octet hors ASCII (échappements octaux). */
const chainePdf = (s: string) => [...s].map((c) => {
  const b = winAnsi(c);
  if (c === '(' || c === ')' || c === '\\') return '\\' + c;
  return b < 0x20 || b > 0x7e ? '\\' + b.toString(8).padStart(3, '0') : String.fromCharCode(b);
}).join('');

/**
 * Un PDF d'une page, une ligne de texte par entrée, colonnes (« trois espaces ») posées à part comme dans une vraie facture.
 * Police standard Helvetica : pdf.js en connaît les largeurs sans fichier de police.
 */
export function pdfFictif(lignes: string[]): Uint8Array {
  const corps = lignes.map((l, i) => {
    let x = 40;
    return l.split(/ {3}/).map((col) => {
      const t = `BT /F1 7 Tf ${x} ${800 - i * 13} Td (${chainePdf(col)}) Tj ET`;
      x += col.length * 5.4 + 14;
      return t;
    }).join('\n');
  }).join('\n');
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${corps.length} >>\nstream\n${corps}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const positions: number[] = [];
  objets.forEach((o, i) => { positions.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
}

export const enBase64 = (octets: Uint8Array) => Buffer.from(octets).toString('base64');
