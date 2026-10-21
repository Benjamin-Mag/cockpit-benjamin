import { expect, test } from '@playwright/test';
import { defaultData } from '../../src/panel/model';
import { PLEIN_ECRAN_ID, donneesPourPleinEcran } from '../../src/shared/plein-ecran';

// Cockpit Benjamin (2026-10-21) : Cockpit Plein Écran lit modèles, phrases et réglages — jamais les Ventes.
test.describe('Données lues par Cockpit Plein Écran (Cockpit Benjamin)', () => {
  test('la part partagée : réglages, COSI, anamnèse, modèles, catégories ; pas les ventes', () => {
    const d = defaultData();
    d.updatedAt = 1700000000000;
    d.reglages.nom = 'Conseiller Essai';
    d.anamnese.phrases = { Musique: ['résonne'] };
    d.ventes.sales = { '2026-10': [{ name: 'Alice Essai', cat: 1 }] };
    const part = donneesPourPleinEcran(JSON.stringify(d));
    expect(part).toMatchObject({ reglages: { nom: 'Conseiller Essai', mvComment: 'MV' }, anamnese: { phrases: { Musique: ['résonne'] } }, updatedAt: 1700000000000 });
    expect(Object.keys(part!).sort()).toEqual(['anamnese', 'categories', 'chatPartenaire', 'reglages', 'templates', 'updatedAt']);
    expect(JSON.stringify(part)).not.toContain('Alice Essai');
  });

  test('copie absente ou illisible : rien', () => {
    expect(donneesPourPleinEcran(undefined)).toBeNull();
    expect(donneesPourPleinEcran('{pas du json')).toBeNull();
    expect(donneesPourPleinEcran(JSON.stringify({ version: 2 }))).toBeNull();
  });

  test('réservé à Cockpit Plein Écran', async () => {
    const manifeste = JSON.parse(await (await import('node:fs/promises')).readFile('public/manifest.json', 'utf8')) as { externally_connectable?: { ids?: string[] } };
    expect(manifeste.externally_connectable?.ids).toEqual([PLEIN_ECRAN_ID]);
  });
});
