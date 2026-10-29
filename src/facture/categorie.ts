import type { Extraction } from './facture';

/** Catégorie de la vente d'après la facture, avec la raison montrée à Benjamin. `sure: false` = déduite du prix, à vérifier. */
export interface CategorieFacture { cat: 1 | 2; sure: boolean; raison: string }

/**
 * null : la facture ne dit rien de la classe (ni code, ni mention, ni code LPP, ni prix d'appareil).
 * Code P2 mais facture CSS (mention CSS / C2S, ou appareils payés 800 €) aux appareils à 950 € ou moins, ou appareils
 * à 950 € pile (prix d'une classe I) : CAT 1 (29/10/2026, Benjamin : elles portaient P2D / P2G et passaient en CAT 2 ;
 * vu sur 1 226 factures : 40 cas, tous CSS). Toujours le prix catalogue : une CAT 2 remisée (1 390 € payés 950 €) garde
 * son prix au-dessus de 950 € et reste CAT 2 ; une CAT 2 qui n'imprimerait que son prix remisé ne passe pas non plus,
 * sauf à 950 € pile. Au-dessus de 950 €, le code ou la mention décide d'abord : un chargeur compté avec l'appareil ne
 * fait pas passer une facture P1 en CAT 2.
 */
export function categorieDeFacture(ex: Pick<Extraction, 'classe' | 'classeSource' | 'prixAppareil' | 'mentionCss' | 'appareils'>): CategorieFacture | null {
  const payes = ex.appareils.map((a) => a.prixUnitaire ?? 0).filter((p) => p > 0);
  const css = ex.mentionCss || payes.some((p) => Math.round(p) === 800);
  const prixClasseI = Math.round(ex.prixAppareil) === 950;
  if ((css || prixClasseI) && ex.prixAppareil > 0 && ex.prixAppareil <= 950 && ex.classe === '2' && ex.classeSource !== 'prix') {
    const prix = payes.length ? Math.max(...payes) : ex.prixAppareil;
    const raison = css ? `facture CSS, appareils à ${prix.toLocaleString('fr-FR')}\u00a0€` : 'appareils à 950\u00a0€ (prix de classe I)';
    return { cat: 1, sure: true, raison: `${raison} : code de classe II ignoré` };
  }
  if (ex.classe !== '1' && ex.classe !== '2') return null;
  const cat = ex.classe === '1' ? 1 : 2;
  const romain = cat === 1 ? 'I' : 'II';
  switch (ex.classeSource) {
    case 'code': return { cat, sure: true, raison: `facture : code P${cat}` };
    case 'mention': return { cat, sure: true, raison: `facture : mention classe ${romain}` };
    case 'lpp': return { cat, sure: true, raison: `facture : code LPP de classe ${romain}` };
    default: return { cat, sure: false, raison: `prix des appareils ${cat === 1 ? '≤' : '>'}\u00a0950\u00a0€` };
  }
}

/** Texte du toast après l'enregistrement. */
export function messageVente(c: CategorieFacture): string {
  return `Vente CAT ${c.cat} enregistrée (${c.raison}${c.sure ? '' : ', à vérifier'})`;
}
