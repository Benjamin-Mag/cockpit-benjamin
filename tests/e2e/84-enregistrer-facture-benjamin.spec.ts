import { type Panneau, ONGLET, expect, ouvrir, test, toast } from './outils';
import { FACTURE_P2, FACTURE_PRIX_HAUT, enBase64, pdfFictif } from './factures-fictives';

// Cockpit Benjamin (2026-10-26) : « Enregistrer la facture » lit la Facture client de l'Opportunité (données Salesforce,
// faux navigateur), en déduit la catégorie avec pdf.js et les règles de Cockpit Factures, et enregistre la vente.
const moisCourant = () => { const m = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][new Date().getMonth()]; return `${m[0].toUpperCase()}${m.slice(1)} ${new Date().getFullYear()}`; };
const ventes = async (p: Panneau) => ((await p.donnees()).ventes.sales[moisCourant()] ?? []).filter((v: any) => v.name === 'Bernard Test').map((v: any) => [v.cat, v.aVerifier ?? null]);
const bouton = (p: Panneau) => p.page.getByRole('button', { name: 'Enregistrer la facture', exact: true });
const pdf = (lignes: string[]) => ({ extension: 'pdf', base64: enBase64(pdfFictif(lignes)) });
// pdf.js se charge en quelques secondes dans l'aperçu Vite quand toute la batterie tourne : on attend la fin de la lecture.
const finLecture = (p: Panneau) => expect(bouton(p)).toBeEnabled({ timeout: 30_000 });
const lire = async (p: Panneau) => { await bouton(p).click(); await finLecture(p); };
const PRIX_HAUT = 'prix des appareils >\u00a0950\u00a0€';
const appelsSf = async (p: Panneau) => (await p.journal()).filter((j) => j.api === 'salesforce');

test.describe('Enregistrer la facture (Cockpit Benjamin)', () => {
  test('facture trouvée : la catégorie vient de la facture, toast qui dit pourquoi, une seule lecture malgré le double clic', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite, factureClient: pdf(FACTURE_P2) });
    await expect(page.getByText('Bernard Test').first()).toBeVisible();
    await bouton(p).dblclick();
    await expect(page.getByRole('button', { name: 'Lecture de la facture…', exact: true })).toBeDisabled();
    await finLecture(p);
    await toast(page, 'Vente CAT 2 enregistrée (facture : code P2)');
    await expect.poll(() => ventes(p)).toEqual([[2, null]]);
    // Rien que des lectures, rien que vers Salesforce, un seul téléchargement.
    const appels = await appelsSf(p);
    expect(appels.filter((a) => /servlet\.shepherd\/version\/download\//.test(a.detail))).toHaveLength(1);
    expect(appels.every((a) => a.type === 'GET' && a.detail.startsWith('https://audibene.lightning.force.com/'))).toBe(true);
    // Déjà enregistrée : on le dit, sans relire la facture.
    await lire(p);
    await toast(page, 'Bernard Test est déjà dans les ventes');
    expect(await appelsSf(p)).toHaveLength(appels.length);
    expect(await ventes(p)).toEqual([[2, null]]);
    expect(p.erreurs).toEqual([]);
  });

  test('pas de Facture client : message clair et repli CAT 1 / CAT 2, rien d\'enregistré sans choix', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite });
    await lire(p);
    await expect(page.getByText('Pas de Facture client sur cette Opportunité.')).toBeVisible();
    expect(await ventes(p)).toEqual([]);
    await page.getByRole('button', { name: 'Enregistrer en CAT 1', exact: true }).click();
    await toast(page, 'Vente CAT 1 ajoutée : Bernard Test');
    await expect.poll(() => ventes(p)).toEqual([[1, null]]);
    await expect(page.getByText('Pas de Facture client sur cette Opportunité.')).toHaveCount(0);
    expect(p.erreurs).toEqual([]);
  });

  test('fichier qui n\'est pas un PDF, ou PDF illisible : message clair et repli', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite, factureClient: { extension: 'jpg', base64: enBase64(new Uint8Array([0xff, 0xd8, 0xff])) } });
    await lire(p);
    await expect(page.getByText("La Facture client n'est pas un PDF (fichier .jpg).")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer en CAT 2', exact: true })).toBeVisible();
    expect((await appelsSf(p)).filter((a) => /download/.test(a.detail))).toHaveLength(0);

    const q = await ouvrir(await page.context().newPage(), { onglet: ONGLET.opportunite, factureClient: { extension: 'pdf', base64: enBase64(new TextEncoder().encode('%PDF-1.4 pas vraiment un pdf')) } });
    await lire(q);
    await expect(q.page.getByText('La Facture client est illisible', { exact: false })).toBeVisible();
    await expect(q.page.getByRole('button', { name: 'Enregistrer en CAT 1', exact: true })).toBeVisible();
    expect(await ventes(q)).toEqual([]);
    expect(p.erreurs).toEqual([]);
  });

  test('classe non sûre (prix seul) : vente enregistrée « à vérifier », le badge corrige et retire la mention', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite, factureClient: pdf(FACTURE_PRIX_HAUT) });
    await lire(p);
    await toast(page, `Vente CAT 2 enregistrée (${PRIX_HAUT}, à vérifier)`);
    await expect.poll(() => ventes(p)).toEqual([[2, PRIX_HAUT]]);
    await page.getByRole('button', { name: 'Ventes', exact: true }).click();
    const ligne = page.locator('.tpl', { hasText: 'Bernard Test' });
    await expect(ligne.getByRole('button', { name: 'à vérifier' })).toBeVisible();
    await ligne.getByRole('button', { name: 'CAT 2', exact: true }).click();
    await expect.poll(() => ventes(p)).toEqual([[1, null]]);
    await expect(ligne.getByRole('button', { name: 'à vérifier' })).toHaveCount(0);
    expect(p.erreurs).toEqual([]);
  });

  test('classe non sûre jugée juste : un clic sur « à vérifier » la retire sans changer la catégorie', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite, factureClient: pdf(FACTURE_PRIX_HAUT) });
    await lire(p);
    await expect.poll(() => ventes(p)).toEqual([[2, PRIX_HAUT]]);
    await page.getByRole('button', { name: 'Ventes', exact: true }).click();
    await page.locator('.tpl', { hasText: 'Bernard Test' }).getByRole('button', { name: 'à vérifier' }).click();
    await toast(page, 'Bernard Test : CAT 2 vérifiée');
    await expect.poll(() => ventes(p)).toEqual([[2, null]]);
    expect(p.erreurs).toEqual([]);
  });
});
