import { ONGLET, aller, expect, ouvrir, test, toast } from './outils';

// Cockpit Benjamin en nouveau design (2026-10-20) : les Ventes s'ouvrent par l'icône € à côté de la roue,
// un second clic ramène à l'écran d'avant ; « Enregistrer la facture » sur l'écran Fiche d'une Opportunité
// (2026-10-26, à la place de « Vente CAT 1 / CAT 2 » ; détail dans 84-enregistrer-facture-benjamin.spec.ts).
const moisCourant = () => { const m = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][new Date().getMonth()]; return `${m[0].toUpperCase()}${m.slice(1)} ${new Date().getFullYear()}`; };
const euro = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Ventes', exact: true });

test.describe('Ventes (Cockpit Benjamin, nouveau design)', () => {
  test('€ ouvre les Ventes depuis n\'importe quel écran ; un second clic ramène à l\'écran d\'avant', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await aller(page, 'COSI');
    await euro(page).click();
    await expect(page.getByText('Ajouter une vente')).toBeVisible();
    await expect(euro(page)).toHaveAttribute('aria-pressed', 'true');
    await euro(page).click();
    await expect(page.getByText('Ajouter une vente')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Premier appareillage', exact: true })).toBeVisible();
    expect(p.erreurs).toEqual([]);
  });

  test('Opportunité, écran Fiche : un seul bouton « Enregistrer la facture », la vente va dans le mois courant, une seule fois', async ({ page }) => {
    const p = await ouvrir(page, { onglet: ONGLET.opportunite });
    await expect(page.getByText('Bernard Test').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Vente CAT/ })).toHaveCount(0);
    // Pas de facture attachée : le repli enregistre la catégorie choisie.
    await page.getByRole('button', { name: 'Enregistrer la facture', exact: true }).click();
    await page.getByRole('button', { name: 'Enregistrer en CAT 2', exact: true }).click();
    await toast(page, 'Vente CAT 2 ajoutée : Bernard Test');
    await expect.poll(async () => ((await p.donnees()).ventes.sales[moisCourant()] ?? []).filter((v: any) => v.name === 'Bernard Test').map((v: any) => v.cat)).toEqual([2]);
    await page.getByRole('button', { name: 'Enregistrer la facture', exact: true }).click();
    await toast(page, 'est déjà dans les ventes');
    expect(((await p.donnees()).ventes.sales[moisCourant()] ?? []).filter((v: any) => v.name === 'Bernard Test')).toHaveLength(1);
    // Sur l'écran Ventes, l'Opportunité ouverte est proposée.
    await euro(page).click();
    await expect(page.getByPlaceholder('Client (ex. Marie Dupont)')).toHaveValue('Bernard Test');
    expect(p.erreurs).toEqual([]);
  });

  test('Piste : pas de bouton de vente sur la fiche', async ({ page }) => {
    await ouvrir(page, { onglet: ONGLET.piste });
    await expect(page.getByText('Alice Essai').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Vente CAT|Enregistrer la facture/ })).toHaveCount(0);
  });
});
