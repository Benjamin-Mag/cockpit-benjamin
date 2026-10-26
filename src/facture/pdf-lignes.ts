/**
 * PDF → lignes de texte, dans l'ordre de lecture, les colonnes séparées par trois espaces.
 * pdf.js rend chaque fragment avec sa position ; on regroupe par hauteur (une ligne), on trie
 * de gauche à droite, et un grand écart horizontal marque un changement de colonne.
 * Fonctionne dans le panneau (pdfjs-dist) comme dans Node (pdfjs-dist/legacy) : le module est passé en paramètre.
 */
import { normaliser } from './texte';

export interface ItemTexte { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean }
interface PageLike { getTextContent(): Promise<{ items: unknown[] }> }
interface DocLike { numPages: number; getPage(n: number): Promise<PageLike>; getMetadata?: () => Promise<{ info?: unknown }>; destroy?: () => Promise<void> | void }
export interface PdfJsLike { getDocument(src: { data: Uint8Array; [k: string]: unknown }): { promise: Promise<DocLike> } }

/** Ce que le fichier dit de lui-même : logiciel qui l'a produit, dates de création et de dernière modification (« D:20261014160643+02'00' »). */
export interface MetaPdf { producteur: string; createur: string; cree: string; modifie: string }

export interface TextePdf {
  lignes: string[];
  pages: number;
  /** Peu ou pas de texte : probablement un scan (image) → saisie à la main. */
  scan: boolean;
  meta: MetaPdf;
  /** Montants écrits l'un sur l'autre (« 1 900,00 / 1 600,00 ») : la trace d'un montant recouvert puis réécrit. */
  superpositions: string[];
}

const texteDe = (v: unknown) => (typeof v === 'string' ? v : '');

export async function lignesDuPdf(pdfjs: PdfJsLike, data: Uint8Array, maxPages = 6): Promise<TextePdf> {
  // verbosity 0 : seulement les erreurs (sinon pdf.js signale chaque fonction de police inconnue sur la console).
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
  const lignes: string[] = [];
  const superpositions: string[] = [];
  const meta: MetaPdf = { producteur: '', createur: '', cree: '', modifie: '' };
  const n = Math.min(doc.numPages, maxPages);
  try {
    try {
      const info = ((await doc.getMetadata?.())?.info ?? {}) as Record<string, unknown>;
      Object.assign(meta, { producteur: texteDe(info.Producer), createur: texteDe(info.Creator), cree: texteDe(info.CreationDate), modifie: texteDe(info.ModDate) });
    } catch { /* fichier sans informations : rien à en dire */ }
    for (let p = 1; p <= n; p++) {
      const page = await doc.getPage(p);
      const contenu = await page.getTextContent();
      const items = (contenu.items as ItemTexte[]).filter((it) => typeof it.str === 'string' && Array.isArray(it.transform));
      for (const l of lignesDePage(items)) lignes.push(l);
      for (const s of superpositionsDePage(items)) if (!superpositions.includes(s)) superpositions.push(s);
      if (p < n) lignes.push('');
    }
  } finally {
    try { await doc.destroy?.(); } catch { /* déjà fermé */ }
  }
  const lettres = lignes.join('').replace(/[^\p{L}\p{N}]/gu, '').length;
  return { lignes, pages: doc.numPages, scan: lettres < 40, meta, superpositions };
}

/**
 * Deux montants différents posés au même endroit (même ligne, emprises qui se recouvrent à plus de moitié) : un montant
 * masqué par un cache blanc puis réécrit reste dans le texte du PDF. Un texte doublé à l'identique (effet gras) ne compte pas.
 * Exporté pour les tests.
 */
export function superpositionsDePage(items: ItemTexte[]): string[] {
  const montant = /^-?[\d][\d\s.,]*\d(?:\s?€)?$/;
  const frags = items
    .map((it) => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, s: normaliser(it.str).trim() }))
    .filter((f) => f.w > 0 && f.s.length >= 3 && montant.test(f.s));
  // Valeur d'un montant écrit « 1 800,94 » ou « 1800.94 », pour écarter deux arrondis voisins (145,97 / 145,98).
  const valeur = (s: string) => { const t = s.replace(/[\s€]/g, ''); return Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')); };
  const out: string[] = [];
  for (let i = 0; i < frags.length; i++) {
    for (let j = i + 1; j < frags.length; j++) {
      const a = frags[i], b = frags[j];
      if (Math.abs(a.y - b.y) > 1.5 || a.s === b.s) continue;
      // Un montant réécrit part du même bord (aligné à gauche ou à droite) et couvre presque tout l'autre ; deux colonnes
      // serrées qui se chevauchent un peu (HT et TVA côte à côte) ne comptent pas.
      const memeBord = Math.abs(a.x - b.x) <= 2 || Math.abs(a.x + a.w - (b.x + b.w)) <= 2;
      const commun = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (memeBord && commun > 0.8 * Math.min(a.w, b.w) && Math.abs(valeur(a.s) - valeur(b.s)) >= 1) out.push(`${a.s} / ${b.s}`);
    }
  }
  return out;
}

/**
 * Regroupe les fragments d'une page en lignes. Exporté pour les tests.
 * Les fragments faits uniquement d'espaces sont ignorés : c'est l'écart réel entre deux fragments de texte qui décide
 * de l'espace (petit écart) ou du changement de colonne (grand écart). Les compter ferait coller « 950,00 » et « 240,00 ».
 */
export function lignesDePage(items: ItemTexte[]): string[] {
  const frags = items
    .map((it) => ({ x: it.transform[4], y: it.transform[5], h: Math.abs(it.transform[3]) || it.height || 8, w: it.width || 0, s: normaliser(it.str) }))
    .filter((f) => f.s.trim().length > 0);
  // De haut en bas (y décroissant en coordonnées PDF), puis de gauche à droite.
  frags.sort((a, b) => b.y - a.y || a.x - b.x);
  const groupes: (typeof frags)[] = [];
  for (const f of frags) {
    const g = groupes[groupes.length - 1];
    if (g && Math.abs(g[0].y - f.y) <= Math.max(2.5, g[0].h * 0.45)) g.push(f);
    else groupes.push([f]);
  }
  const out: string[] = [];
  for (const g of groupes) {
    g.sort((a, b) => a.x - b.x);
    let ligne = '';
    let finX = -Infinity;
    for (const f of g) {
      const texte = f.s;
      const largeurChar = f.w > 0 ? f.w / texte.length : f.h * 0.5;
      const ecart = f.x - finX;
      if (ligne) {
        if (ecart > Math.max(10, largeurChar * 2.5)) ligne += '   ';
        else if (ecart > largeurChar * 0.2 && !ligne.endsWith(' ') && !texte.startsWith(' ')) ligne += ' ';
      }
      ligne += texte;
      finX = f.x + f.w;
    }
    const nette = ligne.replace(/ {4,}/g, '   ').trim();
    if (nette) out.push(nette);
  }
  return out;
}
