import type { Extraction } from './facture';

/** Catégorie de la vente d'après la facture, avec la raison montrée à Benjamin. `sure: false` = déduite du prix, à vérifier. */
export interface CategorieFacture { cat: 1 | 2; sure: boolean; raison: string }

/**
 * null : la facture ne dit rien de la classe (ni code, ni mention, ni code LPP, ni prix d'appareil).
 * Appareils à 950 € ou moins : toujours CAT 1, même avec un code P2 (29/10/2026, Benjamin : les factures CSS à 800 €
 * portent P2D / P2G et passaient en CAT 2). Au-dessus de 950 €, le code ou la mention décide d'abord : un chargeur
 * compté avec l'appareil ne fait pas passer une facture P1 en CAT 2.
 */
export function categorieDeFacture(ex: Pick<Extraction, 'classe' | 'classeSource' | 'prixAppareil'>): CategorieFacture | null {
  if (ex.prixAppareil > 0 && ex.prixAppareil <= 950 && ex.classe === '2' && ex.classeSource !== 'prix') {
    return { cat: 1, sure: true, raison: `appareils à ${ex.prixAppareil.toLocaleString('fr-FR')}\u00a0€ (≤\u00a0950\u00a0€), code de classe II de la facture ignoré` };
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
