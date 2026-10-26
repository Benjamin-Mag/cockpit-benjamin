/**
 * Référentiel de l'équipe facturation : les valeurs exactes attendues dans « Autres infos ».
 * Repris de l'outil maison « Facturation audibene France » (page HTML du collègue, version « iban37 » du 15/10/2026 ;
 * Acuitis sans forme définie, Signia Horizon abandonné : listes vides = saisie libre dans le panneau) :
 *   ID (Fabricant,Modèle,Niveau,Plateforme,Accessoire Rexton,Chargeur,CROS,TV Streamer,Hygiene products,Insurance)
 * Le « Modèle » de l'outil est la forme de l'appareil (RIC, RIC-R…). L'ID commence par « F ».
 */

export const FABRICANTS = ['Acuitis', 'Audibel', 'Audio2000/Rexton', 'Bernafon', 'Hansaton', 'Oticon', 'Philips', 'Phonak', 'ReSound', 'Rexton', 'Signia', 'Signia Horizon', 'Starkey', 'Unitron', 'Widex'] as const;
export type Fabricant = (typeof FABRICANTS)[number];

export const NIVEAUX: Record<Fabricant, string[]> = {
  Acuitis: ['', '220', '330', '440'],
  Audibel: ['16', '20', '24', '1200', '1600', '2000', '2400'],
  'Audio2000/Rexton': ['400', '600', '800'],
  Bernafon: ['1', '3', '5', '7', '9', '100', '200', '300', '400'],
  Hansaton: ['3', '5', '7', '9'],
  Oticon: ['1', '2', '3', '4', '5'],
  Philips: ['7040', '9050'],
  Phonak: ['30', '50', '70', '90'],
  ReSound: ['4', '5', '7', '9'],
  Rexton: ['30', '40', '60', '80'],
  Signia: ['2', '3', '5', '7'],
  'Signia Horizon': ['3', '5', '7'],
  Starkey: ['12', '16', '20', '24', '1200', '1600', '2000', '2400'],
  Unitron: ['3', '5', '7', '9'],
  Widex: ['110', '220', '330', '440'],
};

/** « Modèle » dans l'outil du collègue = forme de l'appareil. */
export const FORMES: Record<Fabricant, string[]> = {
  Acuitis: [],
  Audibel: ['RIC', 'RIC-R', 'BTE', 'BTE-R', 'ITE', 'ITE-R'],
  'Audio2000/Rexton': ['RIC', 'RIC-R', 'Slim RIC', 'BTE', 'BTE-R', 'IF', 'ITE', 'ITE-R'],
  Bernafon: ['RIC', 'RIC-R', 'BTE', 'BTE-R', 'ITE'],
  Hansaton: ['RIC', 'RIC-R', 'Slim RIC', 'BTE', 'BTE-R', 'ITE', 'ITE-R'],
  Oticon: ['RIC', 'RIC-R', 'BTE', 'BTE-R', 'ITE', 'IF'],
  Philips: ['RIC', 'RIC-R', 'BTE', 'BTE-R', 'ITE'],
  Phonak: ['RIC', 'RIC-R', 'Slim RIC', 'BTE', 'BTE-R', 'ITE', 'ITE-R'],
  ReSound: ['RIC', 'RIC-R', 'BTE', 'BTE-R', 'ITE', 'ITE-R'],
  Rexton: ['RIC', 'RIC-R', 'Slim RIC', 'BTE', 'BTE-R', 'IF', 'ITE', 'ITE-R'],
  Signia: ['RIC', 'RIC-R', 'Slim RIC', 'BTE', 'BTE-R', 'IF', 'ITE', 'ITE-R'],
  'Signia Horizon': [],
  Starkey: ['RIC', 'RIC-R', 'BTE', 'BTE-R', 'ITE', 'ITE-R'],
  Unitron: ['RIC', 'RIC-R', 'Slim RIC', 'BTE', 'BTE-R', 'ITE'],
  Widex: ['RIC', 'RIC-R', 'BTE', 'BTE-R', 'ITE', 'ITE-R'],
};

export const PLATEFORMES: Record<Fabricant, string[]> = {
  Acuitis: ['Concerto', 'Philharmonie', 'Symphonie'],
  Audibel: ['Arc AI', 'Intrigue AI', 'Vitality AI'],
  'Audio2000/Rexton': ['Bi-Core', 'Essentiel', 'Excellence'],
  Bernafon: ['Aligo', 'Aligo XT', 'Alpha', 'Alpha XT', 'Encanta', 'Leox', 'Viron', 'Zerena'],
  Hansaton: ['AQ Sound', 'AQ Sound ST', 'Sound', 'Sound E', 'Sound HD', 'Sound ST'],
  Oticon: ['Intent', 'More', 'OPN S', 'Orus', 'Own', 'Real', 'Reveal', 'Ruby', 'SIYA', 'Xceed', 'Xceed SP', 'Zeal', 'Zircon'],
  Philips: ['HearLink'],
  Phonak: ['B', 'E', 'I', 'L', 'Lyric', 'M', 'P'],
  ReSound: ['Enzo', 'Key', 'Ligo', 'Nexia', 'Omnia', 'One', 'Quattro', 'Savi', 'Sensia', 'Vibrant', 'Vivia', 'Wing'],
  Rexton: ['Bi-Core', 'M-Core', 'Mosaic', 'Reach', 'TruCore'],
  Signia: ['AX', 'IX', 'MaX', 'NX', 'PX', 'X'],
  'Signia Horizon': ['AX', 'X'],
  Starkey: ['Evolv', 'Edge AI', 'Evolv AI', 'Genesis AI', 'Livio', 'Livio AI', 'Muse', 'Muse IQ', 'Omega AI', 'Omega AI+', 'Signature'],
  Unitron: ['Ativo', 'DX', 'Insera', 'Insera B', 'Insera DX', 'Insera S', 'Moxi', 'Moxi B', 'Moxi V', 'Moxi S', 'Moxi S-RX', 'Stride', 'Stride B', 'Stride V'],
  Widex: ['Allure', 'Allure AI', 'Enjoy', 'Evoke', 'Magnify', 'Moment', 'Moment S'],
};

/** Accessoire Rexton : DryLux → DL, PerfectClean → PC, PerfectDome → PD. */
export const ACCESSOIRES_REXTON: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'DL', label: 'DryLux' },
  { value: 'PC', label: 'PerfectClean' },
  { value: 'PD', label: 'PerfectDome' },
];

export const CHARGEURS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'Charger', label: 'Chargeur' },
  { value: 'Charger DC', label: 'Chargeur Dry&Clean' },
];

/** Les quatre cases à cocher « Accessoires (autre) » et le mot écrit dans la chaîne. */
export const AUTRES_ACCESSOIRES: { cle: 'cros' | 'tv' | 'hygiene' | 'assurance'; valeur: string; label: string }[] = [
  { cle: 'cros', valeur: 'CROS', label: 'CROS' },
  { cle: 'tv', valeur: 'TV Streamer', label: 'Streamer TV' },
  { cle: 'hygiene', valeur: 'Hygiene products', label: "Produits d'hygiène" },
  { cle: 'assurance', valeur: 'Insurance', label: 'Assurance' },
];

/** Taux de rémunération partenaire proposés par l'outil du collègue (en %). */
export const TAUX_REMUNERATION = [25, 26, 28, 30, 31, 32, 33, 34, 35, 40];

/**
 * Marques du groupe WS Audiology (WSA), selon le Partner Management (12/10/2026) : Signia (ex-Sivantos), Widex, Acuitis,
 * Rexton (Biotone, Audio 2000, gamme Mood), Audio Service. Signia Horizon est abandonné mais reste WSA pour les anciens dossiers.
 */
const MARQUES_WSA = /signia|sivantos|widex|acuitis|rexton|biotone|audio\s*2000|\bmood\b|audio\s*service/i;

/** L'appareil est-il d'une marque WSA ? (décide de la remise WSA et du barème des grands comptes). */
export function estWsa(fabricant: string): boolean {
  return MARQUES_WSA.test(fabricant ?? '');
}

/** Fabricant du référentiel correspondant à une marque lue sur la facture (sinon la marque telle quelle). */
export function fabricantDepuisMarque(marque: string, texte = ''): string {
  const m = marque.trim();
  if (!m) return '';
  if (/^signia$/i.test(m) && /\bhorizon\b/i.test(texte)) return 'Signia Horizon';
  if (/^audio ?2000$/i.test(m)) return 'Audio2000/Rexton';
  const exact = FABRICANTS.find((f) => f.toLowerCase() === m.toLowerCase());
  return exact ?? m;
}
