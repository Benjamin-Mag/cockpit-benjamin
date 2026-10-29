import { expect, test } from '@playwright/test';
import { categorieDeFacture, messageVente } from '../../src/facture/categorie';
import { extraireFacture } from '../../src/facture/facture';
import { type PdfJsLike, lignesDuPdf } from '../../src/facture/pdf-lignes';
import { FACTURE_CSS_800, FACTURE_LPP, FACTURE_MENTION, FACTURE_P1, FACTURE_P2, FACTURE_PRIX_BAS, FACTURE_PRIX_HAUT, FACTURE_SANS_APPAREIL, pdfFictif } from './factures-fictives';

// Cockpit Benjamin, « Enregistrer la facture » : la catégorie de la vente lue sur des factures fictives (fonctions pures, sans panneau).
const categorie = (lignes: string[]) => categorieDeFacture(extraireFacture(lignes));

test.describe('Catégorie d\'après la facture (Cockpit Benjamin)', () => {
  test('code de regroupement P1 / P2 : catégorie sûre', () => {
    expect(categorie(FACTURE_P2)).toEqual({ cat: 2, sure: true, raison: 'facture : code P2' });
    expect(categorie(FACTURE_P1)).toEqual({ cat: 1, sure: true, raison: 'facture : code P1' });
    expect(messageVente(categorie(FACTURE_P1)!)).toBe('Vente CAT 1 enregistrée (facture : code P1)');
  });

  test('mention de classe sur l\'appareil, sinon code LPP : catégorie sûre', () => {
    expect(categorie(FACTURE_MENTION)).toEqual({ cat: 1, sure: true, raison: 'facture : mention classe I' });
    expect(categorie(FACTURE_LPP)).toEqual({ cat: 2, sure: true, raison: 'facture : code LPP de classe II' });
  });

  test('ni code ni mention : catégorie d\'après le prix des appareils, à vérifier', () => {
    // Espaces insécables : « 950 € » ne se coupe pas en bout de ligne dans le toast.
    expect(categorie(FACTURE_PRIX_HAUT)).toEqual({ cat: 2, sure: false, raison: 'prix des appareils >\u00a0950\u00a0€' });
    expect(categorie(FACTURE_PRIX_BAS)).toEqual({ cat: 1, sure: false, raison: 'prix des appareils ≤\u00a0950\u00a0€' });
    expect(messageVente(categorie(FACTURE_PRIX_HAUT)!)).toBe('Vente CAT 2 enregistrée (prix des appareils >\u00a0950\u00a0€, à vérifier)');
  });

  test('appareils à 950 € ou moins : CAT 1 même avec un code P2 (factures CSS à 800 €, 29/10/2026)', () => {
    expect(categorie(FACTURE_CSS_800)).toEqual({ cat: 1, sure: true, raison: 'appareils à 800\u00a0€ (≤\u00a0950\u00a0€), code de classe II de la facture ignoré' });
    // Au-dessus de 950 €, le code décide toujours : P2 reste CAT 2, P1 reste CAT 1 même si un chargeur fait monter le prix lu.
    expect(categorie(FACTURE_P2)?.cat).toBe(2);
    expect(categorie(FACTURE_P1.map((l) => l.replace(/950,00/g, '1 050,00')))).toEqual({ cat: 1, sure: true, raison: 'facture : code P1' });
  });

  test('sans appareil ni texte : pas de catégorie, rien d\'inventé', () => {
    expect(categorie(FACTURE_SANS_APPAREIL)).toBeNull();
    expect(categorie([])).toBeNull();
  });

  test('le PDF fictif se relit en lignes qui donnent la même catégorie (pdf.js, comme dans le panneau)', async () => {
    const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsLike;
    for (const [lignes, attendu] of [[FACTURE_P2, 2], [FACTURE_P1, 1], [FACTURE_PRIX_HAUT, 2]] as const) {
      const lu = await lignesDuPdf(pdfjs, pdfFictif([...lignes]));
      expect(lu.scan).toBe(false);
      expect(categorie(lu.lignes)?.cat).toBe(attendu);
    }
  });
});
