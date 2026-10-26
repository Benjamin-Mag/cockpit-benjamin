/** Lecture du PDF dans le panneau : pdf.js embarqué (worker local, jamais un CDN), puis règles locales, aucune IA. */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { categorieDeFacture } from '../facture/categorie';
import { extraireFacture } from '../facture/facture';
import { type PdfJsLike, lignesDuPdf } from '../facture/pdf-lignes';
import type { LectureFacture } from './facture-sf';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function categorieDuPdf(octets: Uint8Array): Promise<LectureFacture> {
  let lu: Awaited<ReturnType<typeof lignesDuPdf>>;
  try {
    lu = await lignesDuPdf(pdfjs as unknown as PdfJsLike, octets);
  } catch {
    return { ok: false, msg: 'La Facture client est illisible (PDF abîmé ou autre format).' };
  }
  if (lu.scan) return { ok: false, msg: 'La Facture client est une image scannée : sa catégorie ne se lit pas.' };
  const categorie = categorieDeFacture(extraireFacture(lu.lignes));
  return categorie ? { ok: true, categorie } : { ok: false, msg: 'Catégorie introuvable sur la facture (ni code P1 / P2, ni mention de classe, ni prix d’appareil).' };
}
