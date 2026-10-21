import type { AppData } from '../panel/model';

/**
 * Cockpit Benjamin (2026-10-21) : l'extension privée « Cockpit Plein Écran », installée dans le même navigateur, lit les
 * modèles, phrases et réglages de Cockpit pour son COSI, son MV et son commentaire. Lecture seule, réservée à elle
 * (identifiant de l'extension non empaquetée, dérivé de son dossier dans « Extensions installees ») ; jamais les Ventes.
 */
export const PLEIN_ECRAN_ID = 'hponniohbjppfjebgbcjkpdfcfjbfboc';

export type DonneesPleinEcran = Pick<AppData, 'reglages' | 'anamnese' | 'chatPartenaire' | 'templates' | 'categories'> & { updatedAt: number | null };

/** Copie de travail de Cockpit (texte JSON de chrome.storage.local) → la part que le plein écran peut lire. */
export function donneesPourPleinEcran(contenu: unknown): DonneesPleinEcran | null {
  if (typeof contenu !== 'string') return null;
  let d: Partial<AppData>;
  try { d = JSON.parse(contenu) as Partial<AppData>; } catch { return null; }
  if (!d || typeof d !== 'object' || !d.reglages || !d.anamnese) return null;
  return {
    reglages: d.reglages,
    anamnese: d.anamnese,
    chatPartenaire: d.chatPartenaire ?? [],
    templates: d.templates ?? [],
    categories: d.categories ?? { patient: [], partenaire: [] },
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : null,
  };
}
