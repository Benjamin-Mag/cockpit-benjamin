import type { Extraction } from './facture';

/** Catégorie de la vente d'après la facture, avec la raison montrée à Benjamin. `sure: false` = déduite du prix, à vérifier. */
export interface CategorieFacture { cat: 1 | 2; sure: boolean; raison: string }

/** null : la facture ne dit rien de la classe (ni code, ni mention, ni code LPP, ni prix d'appareil). */
export function categorieDeFacture(ex: Pick<Extraction, 'classe' | 'classeSource'>): CategorieFacture | null {
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
