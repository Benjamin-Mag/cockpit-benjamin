/**
 * « Enregistrer la facture » : la Facture client de l'Opportunité est trouvée et téléchargée par les données Salesforce,
 * avec la session de Benjamin (appels du panneau, cookies portés grâce aux host_permissions *.force.com), puis lue ici.
 * Lecture seule : rien n'est écrit dans Salesforce. Repris de Cockpit Factures (src/panel/sf-api.ts), vérifié sur l'org
 * le 15/10/2026 : liste liée Needed_Document_Relations_Opportunity__r, fichier par l'API UI, octets par
 * /sfc/servlet.shepherd/version/download/068… (redirection vers *.file.force.com suivie).
 */
import type { CategorieFacture } from '../facture/categorie';

export type LectureFacture = { ok: true; categorie: CategorieFacture } | { ok: false; msg: string };

interface UiChamp { value: unknown; displayValue: string | null }
interface UiRecord { id?: string; fields: Record<string, UiChamp | undefined> }
export interface FichierSf { id: string; versionId: string; titre: string; extension: string; taille: number }

const API = '/services/data/v62.0/ui-api/';
/** Identifiant Salesforce : jamais de « / » ni de « .. » dans une adresse d'appel. */
const ID_SF = /^[A-Za-z0-9]{15,18}$/;
const TAILLE_MAX = 25 * 1024 * 1024;
/** HTTPS, Lightning ou « Mon domaine » : un site qui finit simplement par « force.com » n'en fait pas partie. */
const HOTE_SALESFORCE = /^(?:[a-z0-9-]+\.)+(?:lightning\.force\.com|my\.salesforce\.com)$/i;

export function origineSalesforce(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && HOTE_SALESFORCE.test(u.hostname) ? u.origin : null;
  } catch {
    return null;
  }
}

const SESSION = "Session Salesforce expirée : recharge l'onglet Salesforce, puis réessaie.";

async function lireJson<T>(origin: string, chemin: string, id: string): Promise<T> {
  if (!ID_SF.test(id)) throw new Error('Identifiant Salesforce inattendu : lecture refusée.');
  let r: Response;
  try {
    r = await fetch(origin + API + chemin, { credentials: 'include', cache: 'no-store' });
  } catch {
    throw new Error('Salesforce injoignable : vérifie la connexion, puis réessaie.');
  }
  if (r.status === 401 || r.status === 403) throw new Error(SESSION);
  if (!r.ok) throw new Error(`Salesforce refuse la lecture des documents (erreur ${r.status}).`);
  if (!/json/i.test(r.headers.get('content-type') ?? '')) throw new Error(SESSION);
  return r.json() as Promise<T>;
}

const texte = (rec: UiRecord, api: string): string => {
  const v = rec.fields[api]?.value;
  return v == null ? '' : String(v);
};

/** Le dernier fichier attaché au document attendu « Facture client », ou null s'il n'y en a pas. */
export async function factureClientDe(origin: string, oppId: string): Promise<FichierSf | null> {
  const champs = ['Needed_Document_Name__c', 'Last_Attachment_Id__c'].map((c) => 'Needed_Information_Relation__c.' + c).join(',');
  const liste = await lireJson<{ records?: UiRecord[] }>(origin, `related-list-records/${oppId}/Needed_Document_Relations_Opportunity__r?fields=${champs}&pageSize=50`, oppId);
  const ligne = (liste.records ?? []).find((r) => /facture\s+client/i.test(texte(r, 'Needed_Document_Name__c')));
  const doc = ligne ? texte(ligne, 'Last_Attachment_Id__c') : '';
  if (!doc) return null;
  const rec = await lireJson<UiRecord>(origin, `records/${doc}?fields=ContentDocument.Title,ContentDocument.FileExtension,ContentDocument.LatestPublishedVersionId,ContentDocument.ContentSize`, doc);
  const versionId = texte(rec, 'LatestPublishedVersionId');
  if (!versionId) throw new Error("La Facture client n'a pas de version lisible dans Salesforce.");
  return { id: rec.id ?? doc, versionId, titre: texte(rec, 'Title'), extension: texte(rec, 'FileExtension').toLowerCase(), taille: Number(rec.fields.ContentSize?.value ?? 0) || 0 };
}

/** Octets du fichier. Une page HTML à la place (session expirée, accès refusé) est refusée. */
export async function telechargerFichier(origin: string, versionId: string): Promise<Uint8Array> {
  if (!ID_SF.test(versionId)) throw new Error('Identifiant de fichier inattendu : téléchargement refusé.');
  let r: Response;
  try {
    r = await fetch(`${origin}/sfc/servlet.shepherd/version/download/${versionId}`, { credentials: 'include', redirect: 'follow', cache: 'no-store' });
  } catch {
    throw new Error('Téléchargement de la facture impossible depuis Salesforce.');
  }
  if (r.status === 401 || r.status === 403) throw new Error(SESSION);
  if (!r.ok) throw new Error(`Salesforce refuse le téléchargement de la facture (erreur ${r.status}).`);
  const tropGros = 'Fichier trop gros pour une facture (plus de 25 Mo) : lecture refusée.';
  if (Number(r.headers.get('content-length') ?? 0) > TAILLE_MAX) throw new Error(tropGros);
  const octets = new Uint8Array(await r.arrayBuffer());
  if (octets.length > TAILLE_MAX) throw new Error(tropGros);
  const debut = String.fromCharCode(...octets.slice(0, 16)).trimStart();
  if ((r.headers.get('content-type') ?? '').includes('text/html') || debut.startsWith('<')) throw new Error(SESSION);
  if (!octets.length) throw new Error('Le fichier de la facture est vide.');
  return octets;
}

/** Facture client de l'Opportunité → catégorie de la vente. Ne lève jamais : un échec revient avec son message. */
export async function lireCategorieFacture(urlOnglet: string, oppId: string): Promise<LectureFacture> {
  const origin = origineSalesforce(urlOnglet);
  if (!origin) return { ok: false, msg: "Cet onglet n'est pas une page Salesforce : facture non lue." };
  try {
    const fichier = await factureClientDe(origin, oppId);
    if (!fichier) return { ok: false, msg: 'Pas de Facture client sur cette Opportunité.' };
    if (fichier.extension && fichier.extension !== 'pdf') return { ok: false, msg: `La Facture client n'est pas un PDF (fichier .${fichier.extension}).` };
    const octets = await telechargerFichier(origin, fichier.versionId);
    // pdf.js n'est chargé qu'ici : le panneau, rechargé à chaque changement d'onglet, reste léger.
    const { categorieDuPdf } = await import('./facture-pdf');
    return await categorieDuPdf(octets);
  } catch (e) {
    return { ok: false, msg: (e as Error)?.message || 'Lecture de la facture impossible.' };
  }
}
