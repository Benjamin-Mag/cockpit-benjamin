/**
 * Marques, plateformes, formes et accessoires d'appareils auditifs reconnus sur les factures (règles locales, à enrichir).
 * Tous les motifs s'appliquent au texte des lignes d'articles (libellé + ligne au-dessus / au-dessous), jamais aux conditions générales.
 * Ils sont testés sur du texte sans accents (voir sansAccents dans texte.ts).
 */

/**
 * Marques, écrites comme les fabricants du référentiel (referentiel.ts).
 * `motifs` : le nom de la marque (ou de son groupe) tel qu'il est écrit ; `modeles` : des noms de modèles ou de familles qui l'identifient
 * quand la facture n'écrit pas la marque. On cherche d'abord les noms de marque (dans l'ordre de la liste), puis seulement les modèles.
 * L'ordre compte : la marque propre d'audibene (« Horizon », colonne Marque « audibene ») avant Signia qui la fabrique ; Unitron avant
 * Phonak (les deux sont « Sonova ») ; Signia couvre Sivantos et Siemens. Les marques hors référentiel (Beltone, Interton…) sortent telles quelles.
 */
export const MARQUES: { nom: string; motifs: RegExp; modeles?: RegExp }[] = [
  { nom: 'Signia Horizon', motifs: /\bhorizon\b|\baudibene\b/i },
  // Moxi, Insera, Stride n'existent que chez Unitron, même quand la facture écrit « Phonak » ou « Sonova » (le distributeur) à côté.
  { nom: 'Unitron', motifs: /\bunitron\b|\bmoxi\b|\binsera\b|\bstride\b|\bvivante\b|\bativo\b/i },
  // Les gammes de la marque propre d'Acuitis (fabriquées par Widex) : l'adresse du fabricant écrite dessous ne doit pas faire lire « Widex ».
  { nom: 'Acuitis', motifs: /\bphilharmonie\b|\bconcerto\b|\bsymphonie\b|\bacuitis\s+-\s/i },
  // Les appareils de la marque Audio 2000 (Essentiel, Excellence) puis les Rexton, dont les familles ne sont qu'à eux : une ligne
  // « INOX 8C 40 … ans Signia » reste un Rexton même si « Signia » est écrit à côté.
  { nom: 'Audio2000/Rexton', motifs: /\baudio\s?2000\b|\bessentiel\s*\d|\bexcellence\s*\d/i },
  { nom: 'Rexton', motifs: /\brexton\b|\binox\b|\bemerald\b|\bm[- ]?core\b|\bbi[- ]?core\b|\breach\b|\bmosaic\b|\btru[- ]?core\b/i, modeles: /\bbiotone\b/i },
  { nom: 'Signia', motifs: /\bsignia\b|\bsivantos\b|\bsiemens\b|\bws audiology\b/i, modeles: /\bpure\b|\bsilk\b|\bintuis\b|\binsio\b|\bstyletto\b|\bprimax\b|\bmotion\b/i },
  { nom: 'Phonak', motifs: /\bphonak\b/i, modeles: /\bsonova\b|\baudeo\b|\bnaida\b|\bvirto\b|\bbolero\b|\blyric\b|\blumity\b|\bparadise\b|\bmarvel\b|\binfinio\b|\bbelong\b/i },
  { nom: 'Oticon', motifs: /\boticon\b|\bdemant\b/i, modeles: /\bzircon\b|\bruby\b|\bintent\b|\bzeal\b|\bsiya\b|\bopn\b|\bmore\s*\d|\breal\s*\d|\breveal\b/i },
  { nom: 'Widex', motifs: /\bwidex\b/i, modeles: /\bmoment\b|\bmagnify\b|\benjoy\b|\ballure\b|\bevoke\b|\bAA-WID/i },
  { nom: 'Starkey', motifs: /\bstarkey\b|\bstk\b/i, modeles: /\blivio\b|\bevolv\b|\bgenesis\b|\bedge\s*ai\b|\bomega\s*ai\b|\bmuse\b|\bG\s*series\b|\bsignature\s*series\b|\bAA-STA/i },
  { nom: 'Audibel', motifs: /\baudibel\b/i, modeles: /\baris\s*ai\b|\bA\s*series\b|\barc\s*ai\b|\bintrigue\b|\bvitality\b/i },
  { nom: 'ReSound', motifs: /resound|\bgn hearing\b/i, modeles: /\bnexia\b|\bomnia\b|\bvivia\b|\bquattro\b|\bligo\b|\bvibrant\b|\bsavi\b|\bsensia\b|\benzo\b|\bDRWC?\b|\bRIE\b|\bAA-GN/i },
  { nom: 'Bernafon', motifs: /\bbernafon\b/i, modeles: /\balpha\b|\bzerena\b|\bviron\b|\bleox\b|\bencanta\b|\baligo\b/i },
  { nom: 'Hansaton', motifs: /\bhansaton\b/i, modeles: /\baq\s*sound\b|\bhasanton\b|\bsound\s*xc\b/i },
  { nom: 'Philips', motifs: /\bphilips\b/i, modeles: /\bhear\s*link\b/i },
  { nom: 'Audio Service', motifs: /\baudio ?service\b/i, modeles: /\bmood\s*\d/i },
  { nom: 'Beltone', motifs: /\bbeltone\b/i },
  { nom: 'Interton', motifs: /\binterton\b/i },
  { nom: 'Sonic', motifs: /\bsonic\b/i },
];

/**
 * Plateformes (famille / génération), écrites comme dans le référentiel de l'équipe (referentiel.ts, PLATEFORMES) :
 * Phonak par sa lettre (Lumity → « L »), Signia en capitales (« NX », « PX »), Starkey avec « AI », Unitron « Moxi V »…
 * Le moteur relève TOUTES les plateformes qui collent au texte de l'appareil (dans l'ordre de cette liste : les noms composés avant leur
 * racine) puis garde la première qui existe dans la liste du fabricant ; `code` marque les écritures codées (IX, L90…), qui n'ont de sens
 * que pour le fabricant du référentiel et ne sortent jamais comme « famille inconnue ».
 * Une famille lue sur la facture mais absente du référentiel (« G Series », « Verit », « Intuis »…) sort telle quelle : le panneau l'affichera en « Autre ».
 */
export const PLATEFORMES: { nom: string; motifs: RegExp; code?: boolean }[] = [
  // Rexton, Audio 2000 : avant les lettres Signia (« M-CORE IX 40 » est un M-Core, pas un IX)
  { nom: 'Bi-Core', motifs: /\bbi[- ]?core\b/i },
  { nom: 'M-Core', motifs: /\bm[- ]?core\b/i },
  { nom: 'TruCore', motifs: /\btru[- ]?core\b/i },
  { nom: 'Reach', motifs: /\breach\b/i },
  { nom: 'Mosaic', motifs: /\bmosaic\b/i },
  { nom: 'Essentiel', motifs: /\bessentiel\b/i },
  { nom: 'Excellence', motifs: /\bexcellence\b/i },
  { nom: 'Inox', motifs: /\binox\b/i },
  { nom: 'Emerald', motifs: /\bemerald\b/i },
  // Signia / Signia Horizon (MaX avant IX : « Pure Charge&Go MaX » est rangé sous IX dans le catalogue des modèles)
  { nom: 'MaX', motifs: /(?:^|[\s\d\/])max\b/i, code: true },
  { nom: 'IX', motifs: /(?:^|[\s\d\/])IX\b|\bintegrated\s+xperience\b/i, code: true },
  { nom: 'AX', motifs: /(?:^|[\s\d\/])AX\b/i, code: true },
  { nom: 'NX', motifs: /(?:^|[\s\d])Nx\b/i, code: true },
  { nom: 'PX', motifs: /\d\s?px\b|\bprimax\b/i, code: true },
  { nom: 'X', motifs: /\b[1-7]\s?X\b|\bX\s?[1-7]\b/, code: true },
  { nom: 'Intuis', motifs: /\bintuis\b/i },
  // Phonak : la lettre de la génération
  { nom: 'Lyric', motifs: /\blyric\b/i },
  // La lettre, le niveau (« L90-R », « L-90 », « I 70 R ») ou, quand le niveau n'est pas écrit, « AUDEO M-R ».
  { nom: 'I', motifs: /\binfinio\b|\bsphere\b|\bI[-\s]?(?:90|70|50|30)(?!\d)|\baudeo\s*I(?![a-z])/i, code: true },
  { nom: 'L', motifs: /\blumity\b|\bL[-\s]?(?:90|70|50|30)(?!\d)|\baudeo\s*L(?![a-z])/i, code: true },
  { nom: 'P', motifs: /\bparadise\b|\bP[-\s]?(?:90|70|50|30)(?!\d)|\baudeo\s*P(?![a-z])/i, code: true },
  { nom: 'M', motifs: /\bmarvel\b|\bM[-\s]?(?:90|70|50|30)(?!\d)|\baudeo\s*M(?![a-z])/i, code: true },
  { nom: 'E', motifs: /\beon\b|\bE[-\s]?(?:90|70|50|30)(?!\d)|\baudeo\s*E(?![a-z])/i, code: true },
  { nom: 'B', motifs: /\bbelong\b|\bB[-\s]?(?:90|70|50|30)(?!\d)|\baudeo\s*B(?![a-z])/i, code: true },
  // Oticon / Bernafon
  { nom: 'Intent', motifs: /\bintent\b/i },
  { nom: 'Real', motifs: /\breal\s*\d/i },
  { nom: 'More', motifs: /\bmore\s*\d/i },
  { nom: 'Zircon', motifs: /\bzircon\b/i },
  { nom: 'Ruby', motifs: /\bruby\b/i },
  { nom: 'OPN S', motifs: /\bopn\s*s\b/i },
  { nom: 'SIYA', motifs: /\bsiya\b/i },
  { nom: 'Own', motifs: /\boticon\s+own\b|\bown\s*\d/i },
  { nom: 'Reveal', motifs: /\breveal\b/i },
  { nom: 'Zeal', motifs: /\bzeal(?![a-z])/i },
  { nom: 'Xceed SP', motifs: /\bxceed\s*sp\b/i },
  { nom: 'Xceed', motifs: /\bxceed\b/i },
  { nom: 'Aligo XT', motifs: /\baligo\s*xt\b/i },
  { nom: 'Aligo', motifs: /\baligo\b/i },
  { nom: 'Alpha XT', motifs: /\balpha\s*xt\b/i },
  { nom: 'Alpha', motifs: /\balpha\b/i },
  { nom: 'Encanta', motifs: /\bencanta\b/i },
  { nom: 'Zerena', motifs: /\bzerena\b/i },
  { nom: 'Leox', motifs: /\bleox\b/i },
  { nom: 'Viron', motifs: /\bviron\b/i },
  { nom: 'Orus', motifs: /\borus\b/i },
  { nom: 'Verit', motifs: /\bverit\b/i },
  // Starkey / Audibel
  { nom: 'Edge AI', motifs: /\bedge\s*ai\b/i },
  { nom: 'Omega AI+', motifs: /\bomega\s*ai\s*(?:\+|plus\b)/i },
  { nom: 'Omega AI', motifs: /\bomega\s*ai\b/i },
  { nom: 'Genesis AI', motifs: /\bgenesis\b/i },
  { nom: 'Evolv AI', motifs: /\bevolv\s*ai\b/i },
  { nom: 'Evolv', motifs: /\bevolv\b/i },
  { nom: 'Livio AI', motifs: /\blivio\s*ai\b/i },
  { nom: 'Livio', motifs: /\blivio\b/i },
  { nom: 'Arc AI', motifs: /\barc\s*ai\b/i },
  { nom: 'Intrigue AI', motifs: /\bintrigue\s*ai\b/i },
  { nom: 'Vitality AI', motifs: /\bvitality\s*ai\b/i },
  { nom: 'Aris AI', motifs: /\baris\s*ai\b/i },
  { nom: 'Muse IQ', motifs: /\bmuse\s*iq\b/i },
  { nom: 'Muse', motifs: /\bmuse\b/i },
  { nom: 'Signature', motifs: /\bsignature\s*(?:series|\d)/i },
  { nom: 'G Series', motifs: /\bG\s*series\b/i },
  { nom: 'A Series', motifs: /\bA\s*series\b/i },
  // Widex
  { nom: 'Moment S', motifs: /\bmoment\s+S\b/i },
  { nom: 'Moment', motifs: /\bmoment\b|\bAA\s?MOM\b/i },
  { nom: 'Magnify', motifs: /\bmagnify\b|\bMGY\b/i },
  { nom: 'Allure AI', motifs: /\ballure\s*ai\b/i },
  { nom: 'Allure', motifs: /\ballure\b/i },
  { nom: 'Evoke', motifs: /\bevoke\b/i },
  { nom: 'Enjoy', motifs: /\benjoy\b/i },
  // ReSound (nom écrit, ou préfixe du code modèle : VI560 → Vivia, NX960 → Nexia)
  // Le nom peut être collé à la marque (« ReSoundVibrant », « ResoundOMNIA »).
  { nom: 'Vivia', motifs: /(?:\b|resound)vivia\b|\bVI\s?[4-9]60\b/i },
  { nom: 'Nexia', motifs: /(?:\b|resound)nexia\b|\bNX\s?[4-9]\d{2}\b/i },
  { nom: 'Omnia', motifs: /(?:\b|resound)omnia\b|\bRU\s?[4-9]\d{2}\b|\bOM\s?[4-9]60\b/i },
  { nom: 'One', motifs: /\bresound\s+one\b|\bON\s?[4-9]60\b/i },
  { nom: 'Quattro', motifs: /(?:\b|resound)quattro\b/i },
  { nom: 'Ligo', motifs: /(?:\b|resound)ligo\b/i },
  { nom: 'Wing', motifs: /(?:\b|resound)wing\b/i },
  { nom: 'Vibrant', motifs: /(?:\b|resound)vibrant\b|\bVB\s?\d{3}/i },
  { nom: 'Savi', motifs: /(?:\b|resound)savi\b|\bSA\s?\d{2,3}[- ]?DRW/i },
  { nom: 'Sensia', motifs: /(?:\b|resound)sensia\b/i },
  { nom: 'Enzo', motifs: /(?:\b|resound)enzo\b/i },
  // « Key » est aussi un mot anglais : seulement avec la marque ou suivi d'un niveau (« Key 4 », « Key 461 »).
  { nom: 'Key', motifs: /\bresound\s*key\b|(?:\b|resound)key\s*[4-9](?:\d{2})?\b/i },
  { nom: 'Mood', motifs: /\bmood\b/i },
  // Unitron
  { nom: 'Ativo', motifs: /\bativo\b/i },
  { nom: 'Moxi S-RX', motifs: /\bmoxi\s*S\s?\d?\s?-?\s?RX\b/i },
  { nom: 'Moxi S', motifs: /\bmoxi\s*S\s?\d|\bmoxi\s+S\b/i },
  { nom: 'Insera B', motifs: /\binsera\s*B\s?\d|\binsera\s+B\b/i },
  { nom: 'Insera S', motifs: /\binsera\s*S\s?\d|\binsera\s+(?:S|smile)\b/i },
  { nom: 'Moxi V', motifs: /\bmoxi\s*V\s?\d|\bvivante\b/i },
  { nom: 'Moxi B', motifs: /\bmoxi\s*B\s?\d|\bmoxi\s+blu\b/i },
  { nom: 'Stride V', motifs: /\bstride\s*V\s?\d/i },
  { nom: 'Stride B', motifs: /\bstride\s*B\s?\d/i },
  { nom: 'Insera DX', motifs: /\binsera\s+DX\b/i },
  { nom: 'DX', motifs: /(?:^|[\s\d])DX\b/, code: true },
  { nom: 'Moxi', motifs: /\bmoxi\b/i },
  { nom: 'Stride', motifs: /\bstride\b/i },
  { nom: 'Insera', motifs: /\binsera\b/i },
  // Hansaton
  { nom: 'AQ Sound ST', motifs: /\bAQ\s*sound\s*ST\b/i },
  { nom: 'AQ Sound', motifs: /\bAQ\s*sound\b/i },
  { nom: 'Sound E', motifs: /\bsound\s*E(?:\s?\d|\b)/i },
  { nom: 'Sound HD', motifs: /\bsound\s*S?HD\b/i },
  { nom: 'Sound ST', motifs: /\bsound\s*ST\b/i },
  { nom: 'Sound', motifs: /\bsound\s+(?:\d|E\d|FS)/i },
  // Acuitis, Philips
  { nom: 'Concerto', motifs: /\bconcerto\b/i },
  { nom: 'Philharmonie', motifs: /\bphilharmonie\b/i },
  { nom: 'Symphonie', motifs: /\bsymphonie\b/i },
  { nom: 'HearLink', motifs: /\bhear\s*link\b/i },
];

/**
 * Forme de base de l'appareil, lue sur la facture par mots-clés, quand le libellé ne correspond à aucun modèle du catalogue
 * (modeles.ts, voir modeleConnu dans facture.ts). Définitions de l'équipe (onglet Légende du catalogue, octobre 2026) :
 *  - RIC : écouteur déporté ; le style écouteur Signia Active (Active X, Active Pro, Active Mini) est toujours rechargeable (code « RIC-R ») ;
 *  - Slim RIC : design slim type Styletto (Signia Styletto, Phonak Slim, Unitron Moxi V-RS, Hansaton Style RIC ; Rexton « SR », voir SLIM_REXTON) ;
 *  - BTE : contour classique (miniBTE inclus) ;
 *  - ITE : intra SUR MESURE (IIC, CIC, ITC, demi-conque, conque, Insio, Virto, Insera, Own) ; un « intra » sans autre précision y est rangé ;
 *  - IF : « instant fit », intra NON sur mesure (Signia Silk, Rexton inoX, Oticon Zeal ; Rexton « iX », voir IX_INSTANT_FIT).
 * Le moteur en tire la valeur du référentiel (-R si rechargeable) : voir formeReferentiel dans facture.ts.
 * L'ordre compte : Active, Slim RIC, puis l'instant fit (« Silk C&G … CIC » reste IF), puis l'intra sur mesure, puis l'écouteur déporté,
 * puis le contour. `specifique` : un nom de modèle sans ambiguïté, cherché dans tout le texte de l'appareil avant les autres (« Silk 3X » en
 * tête de fiche l'emporte sur « type intra-auriculaire » écrit sur la ligne) ; `faible` : « intra » seul, essayé en dernier.
 */
export const FORMES: { code: string; motifs: RegExp; specifique?: boolean; faible?: boolean }[] = [
  { code: 'RIC-R', motifs: /\bactive\s*(?:pro|mini)\b|\bsignia\s+active\b|\bactive\s+(?:\d\s?)?[AI]?X\b/i, specifique: true },
  { code: 'Slim RIC', motifs: /\bstyletto\b|\bslim[- ]?ric\b|\bslim\b(?!\s*tube)|\bmoxi\s*V\s?\d?\s?-?\s?RS\b|\bstyle\s+ric\b/i, specifique: true },
  { code: 'IF', motifs: /\bsilk\b|\binstant[- ]?fit\b|\bzeal(?![a-z])|\binox\b/i, specifique: true },
  { code: 'ITE', motifs: /\binsio\b|\binsera\b|\bvirto\b|CIC\b|(?:\b|\d)ITCR?\b|\bITE\b|\bIIC\b|\bpicasso\b|\bcustom\b|\boticon\s+own\b|\bown\s*\d|\bsur[- ]mesure\b|\b(?:demi[- ])?conque\b/i },
  { code: 'RIC', motifs: /\bRIC(?=\b|\d|-)|\bRITE\b|\bRIE\b|\bMNR\b|\bDRWC?\b|\bminiRITE\b|\b(?:[ms]|mm)RIC(?:R[DT]?|D)?\b|\bsmartric\b|\b[ée]cout(?:eurs?|\.)\s*d[ée]port[ée]s?\b|\bmicro-?contour\b|\bpure\b|\baud[ée]o\b|\bmoxi\b|\bsheer\b|\bR-?LI\b/i },
  { code: 'BTE', motifs: /\bBTE\b|\bmini\s?BTE\b|(?<!micro[- ])\bcontour\b(?!\s*(?:à|a)\s*[ée]cout)|\bmotion\b|\bna[ïi]da\b|\bbolero\b|\bsky\b|\bxceed\b|\bmaxi\b|\bstride\b|\bleox\b|\bMNB\b|\bB-?LI\b/i },
  { code: 'ITE', motifs: /\bintra(?:-?auriculaire)?\b/i, faible: true },
];

/** Rexton et Audio 2000 : « iX » désigne l'intra instant fit (M-Core iX, Reach iX-CIC) ; chez Signia, IX est une plateforme. */
export const IX_INSTANT_FIT = /\bi[- ]?x\b/i;

/** Rexton : « SR » est le Slim RIC (M-Core SR, BiCore SR). */
export const SLIM_REXTON = /\bSR\b/;

/** Appareil rechargeable : chargeur dans « Autres infos » et RIC → RIC-R. « RIC 312 », « RIC312D » (pile 312) ne le sont pas. */
export const RECHARGEABLE = /rechargeable|charge\s*(?:&|and|et)\s*go|\bC&GO?\b|\b(?:RIC|RITE|miniRITE|[ms]RIC|BTE)\s*-?\s*(?:T\s+)?R[DT]?\b|(?:RIC|CIC)R[DT]?\b|\bDRWC\b|\b[A-Z]{1,2}\d{1,2}-?P?R[TL]?\b|\b[A-Z]\s?(?:30|50|70|90)\s?-?\s?P?R\b|\b[RB][- ]?LI\b|(?:\b|\d)ITCR\b|CIC\s+R\b|\bMNB\s+T?R\b|\bLi-?ion\b/i;

/** Accessoires nommés dans « Autres infos » (cherchés dans les lignes d'articles seulement). */
export const ACCESSOIRES: { nom: string; motifs: RegExp }[] = [
  { nom: 'Charger DC', motifs: /\bdry\s*(?:&|and|et)\s*clean\b/i },
  { nom: 'Charger', motifs: /charg(?:eur|er)s?(?:\s?go)?\b|\bcharging\b|\bstation de charge\b/i },
  // Accessoires Rexton, codés DL / PC / PD dans « Autres infos ».
  { nom: 'DryLux', motifs: /\bdry\s*lux\b/i },
  { nom: 'PerfectClean', motifs: /\bperfect\s*clean\b/i },
  { nom: 'PerfectDome', motifs: /\bperfect\s*dome\b/i },
  // « Serviettes nettoyantes » et l'intitulé de rayon « cleaningDrying » vus sur une facture le 20/10/2026 ; « kit entretien »
  // sans « d' » aussi.
  { nom: 'Hygiene', motifs: /\bhygiene\b|\bkit\s+(?:d'?\s*)?entretien\b|\bproduits?\s+d'?entretien\b|\bspray\s+nettoyant\b|\blingettes?\b|\bpastilles?\s+(?:nettoyantes?|effervescentes?)\b|\bserviettes?\s+nettoyantes?\b|\bcleaning\s*drying\b|\bnettoyantes\b/i },
  { nom: 'CROS', motifs: /\bcros\b/i },
  { nom: 'TV', motifs: /\btv\s*(?:connector|play|adapter|streamer|link|box|decoder|sound|\(\d\))|\bphonak\s+tv\b|\btv-?streamer\b|\bstreamline\s*tv\b/i },
  { nom: 'Remote', motifs: /\bt[ée]l[ée]commande\b|\bremote\b|\bminipocket\b/i },
  { nom: 'Mic', motifs: /\bstreamline mic\b|\bpartnermic\b|\bmicrophone\b|\broger\b|\bconnectclip\b|\bmulti mic\b/i },
];

/** Mots qui indiquent qu'une ligne d'article est un appareil (et non un accessoire, une pile, une prestation). */
export const LIGNE_APPAREIL = /\baides?\s+auditives?\b|\bappareils?\b|\bproth[èe]ses?\b|\bRIC(?=\b|\d|-)|\bBTE\b|\bCIC\b|\bITC\b|\bRITE\b|\bRIE\b|\bminiRITE\b|\b[ms]RIC\b|\bintra\b|\bsilk\b|\bpure\b|\bstyletto\b|\bmotion\b|\binsio\b|\baud[ée]o\b|\bna[ïi]da\b|\bvirto\b|\bbolero\b|\bsky\b|\bmoxi\b|\binsera\b|\bstride\b|\breal\s+\d|\bintent\b|\bmore\s+\d|\bzircon\b|\bruby\b|\bverit\b|\bxceed\b|\bopn\b|\bmoment\b|\bmagnify\b|\ballure\b|\bevoke\b|\bsheer\b|\bsmartric\b|\bgenesis\b|\bevolv\b|\bedge\s*ai\b|\bomega\s*ai\b|\bG\s*series\b|\bsignature\s*series\b|\bnexia\b|\bomnia\b|\bvivia\b|\bm-?core\b|\bbi-?core\b|\breach\b|\balpha\b|\bencanta\b|\baligo\b|\bviron\b|\bleox\b|\blumity\b|\bparadise\b|\bmarvel\b|\binfinio\b|\bsphere\b|\bvivante\b|\bhorizon\b|\bbelong\b|\blyric\b|\bhear\s*link\b|\bconcerto\b|\bphilharmonie\b|\bsymphonie\b|\bquattro\b|\bligo\b|\bzerena\b|\bmosaic\b|\btru-?core\b|\blivio\b|\bmuse\b|\barc\s*ai\b|\bsiya\b|\borus\b|\benjoy\b|\bintrigue\s*ai\b|\bvitality\s*ai\b|\bactive\s*(?:pro|mini)\b|\bcellion\b|\bsensia\b|\benzo\b|\breveal\b|\bativo\b|\bIIC\b|\bMNR\b|\bDRWC?\b|\bzeal\b|\bsavi\b|\bmood\b|\bintuis\b|\binox\b|\bemerald\b|\bessentiel\b|\bexcellence\b|\baris\b|CIC\b/i;

/** Lignes d'articles à ne pas prendre pour un appareil même si une marque y figure (accessoires, consommables, prestations, optique). */
export const LIGNE_PAS_APPAREIL = /\bpiles?\b|\bPIL\b|\bbatteries?\b|\bembouts?\b|\bd[ôo]mes?\b|\b[ée]couteurs?\b|\bminifit\b|\breceivers?\b|charg(?:eur|er)s?(?:\s?go)?\b|\bcharging\b|\bstation de charge\b|\bgarantie\s+(?:suppl\w*|panne|casse|vol|perte|[ée]tendue|prolong\w*)\b|\bassurance\b|\baudioprotect\b|\bprestation\b|\bentretien\b|\bforfait\b|\bt[ée]l[ée]commande\b|\bfiltres?\b|\bnettoy\w*|\bcoques?\b|\bremise\b|\bacompte\b|\bsous[- ]total\b|\btotal\b|\bfrais\b|\bport\b|\bprogramme\b|\bpochette\b|\bserviettes?\b|\blingettes?\b|\bspray\b|\bpastilles?\b|\bs[ée]chage\b|\bdry\s*lux\b|\bperfect\b|\bd[ée]shumidificateur\b|\bc[ée]rumen\b|\badaptateur\b|\bstreamer\b|\btv\s*(?:connector|play|adapter|streamer|link|box|decoder|sound|\(\d\))|\bstreamline\s*tv\b|\bphonak\s+tv\b|\bnon\s+remb|\bcasque\b|\bmicrophone\b|\baccessoires?\b|\bconsommables?\b|\bpack\b|\bpowerpack\b|\bset\b|\bcros\b|\btranquil+it\w*|\bcarte\b|\btips\b|\b[ée]co-?\s?(?:taxe|participation)\b|\bverres?\b|\bmonture\b|\blentilles?\b|\br[ée]paration\b/i;

/** Garantie d'un appareil : 4 ans / 48 mois. Elle suffit à dire qu'une ligne est un appareil quand le modèle est écrit ailleurs (n° de série, couleur). */
export const GARANTIE_APPAREIL = /garantie\s*(?:fabricant\s*)?(?:de\s*)?(?:4\s*(?:ans?|an\(s\))?|48\s*mois)(?![\d])/i;

/** Garantie d'un accessoire ou d'une prestation : 1 ou 2 ans, 12 ou 24 mois. */
export const GARANTIE_ACCESSOIRE = /garantie\s*(?:fabricant\s*)?(?:de\s*)?(?:[12]\s*(?:ans?|an\(s\))?|12\s*mois|24\s*mois|3\s*mois)(?![\d])/i;

/** Sous ce prix TTC (par appareil), une ligne n'est pas une aide auditive : accessoire, prestation, ligne de pied de page. */
export const PRIX_MIN_APPAREIL = 250;

/**
 * Phrases descriptives à effacer avant de juger une ligne : « Garantie 4 ans », « contour à écouteur déporté », « connectivité : télécommande »,
 * « Caractéristiques identiques à la prothèse droite » (qui n'est pas un côté), « Fin de garantie ».
 */
export const PHRASES_NEUTRES = /\b(?:fin\s+de\s+)?garantie\s*:?\s*\d+\s*(?:ans?|mois)?\b|\bgarantie\s+jusqu'au\b|\bgarantie\s+fabricant\b|\b(?:à|a)\s+[ée]couteurs?\s+d[ée]port[ée]s?\b|\bconnectivit[ée]\s*:\s*(?:(?:t[ée]l[ée]commande|bluetooth|aucun|non|oui|en\s+option|\(en\s+option\))[\s,;]*)+|caract[ée]ristiques\s+identiques\s+(?:à|a|au)\s+(?:la\s+proth[èe]se|l'appareil|le\s+verre)\s+(?:droite?|gauche)|\bt[ée]l[ée]commande\s*(?=[;,:]|\(en\s+option\))|\bconnecteur\s*tv\b|\b[ée]couteurs?\s+d[ée]port[ée]s?\b|\bnombre\s+de\s+canaux\s*:\s*\d+/gi;

/** Tailles de piles : jamais un niveau de gamme (« Pure 312 3X » → 3). */
export const TAILLES_PILES = new Set(['312', '13', '10', '675']);

/** Codes LPP génériques des aides auditives adultes : classe 1 (prix plafonné) ou classe 2 (prix libre). */
export const LPP_CLASSE: Record<string, '1' | '2'> = { '2351057': '1', '2365119': '1', '2392530': '2', '2341840': '2' };

/**
 * Codes LPP des aides auditives : chaque code désigne un seul côté (oreille droite ou gauche), quel que soit le fabricant. Relevés sur plusieurs
 * centaines de lignes d'articles où le côté était écrit en toutes lettres : aucun code n'y apparaît des deux côtés.
 * Ils servent à retrouver le côté d'un appareil unique quand la facture ne l'écrit pas (« 7336186 II  SIGNIA  1  1469.19 »).
 */
export const LPP_COTE: Record<string, 'D' | 'G'> = {
  '7316048': 'D', '7316150': 'G', '7316350': 'D', '7316373': 'G',
  '7322675': 'D', '7322600': 'G', '7322936': 'D', '7322907': 'G',
  '7326727': 'D', '7326740': 'G', '7326733': 'D', '7326704': 'G',
  '7330551': 'D', '7330568': 'G', '7330870': 'D', '7330887': 'G',
  '7336200': 'D', '7336230': 'G', '7379971': 'D', '7336186': 'G',
  '7340093': 'D', '7340124': 'G', '7380129': 'D', '7340130': 'G',
  '7343690': 'D', '7343677': 'G', '7343737': 'D', '7343714': 'G',
};

/** Code de regroupement de la LPP : P1D / P1G / P2D / P2G (classe, côté). */
export const CODE_REGROUPEMENT = /\bP([12])([DG])(?![A-Za-z])/g;

/**
 * Enseignes nationales, reconnues pour nommer l'émetteur proprement (dans l'en-tête, l'adresse mail ou le pied de page).
 * « Entendre » est aussi un verbe : seule la forme en capitales, ou dans une adresse mail / un site, compte.
 */
export const ENSEIGNES: { nom: string; motifs: RegExp }[] = [
  { nom: 'Audika', motifs: /\baudika\b/i },
  { nom: 'Amplifon', motifs: /\bamplifon\b/i },
  { nom: 'Audition Conseil', motifs: /\baudition\s*conseil\b/i },
  { nom: 'Krys Audition', motifs: /\bkrys\b/i },
  { nom: 'Entendre', motifs: /\bENTENDRE\b|\bentendre[-.][a-z]|\bEntendre\s+(?:[A-Z]|-)/ },
  { nom: 'VivaSon', motifs: /\bvivason\b/i },
  { nom: 'Audio 2000', motifs: /\baudio\s*2000\b/i },
  { nom: 'Alain Afflelou Acousticien', motifs: /\bafflelou\b/i },
  { nom: 'Optical Center', motifs: /\boptical\s*center\b/i },
  { nom: 'Idéal Audition', motifs: /\bid[ée]al\s*audition\b/i },
  { nom: 'Sonance', motifs: /\bsonance\b/i },
  { nom: 'Solusons', motifs: /\bsolusons\b/i },
  { nom: 'Acuitis', motifs: /\bacuitis\b/i },
  { nom: 'GrandAudition', motifs: /\bgrand\s*audition\b/i },
  { nom: 'Unisson', motifs: /\bunisson\b/i },
  { nom: 'Dyapason', motifs: /\bdyapason\b/i },
  { nom: 'Audilab', motifs: /\baudilab\b/i },
  { nom: 'AudioNova', motifs: /\baudionova\b/i },
  { nom: 'Écouter Voir', motifs: /\b[ée]couter\s*voir\b/i },
  { nom: 'Kesako', motifs: /\bkesako\b/i },
  { nom: 'AB Audition', motifs: /\bab\s+audition\b/i },
  { nom: 'Audiocare', motifs: /\baudiocare\b/i },
  { nom: 'Crystal Audition', motifs: /\bcrystal\s*audition\b/i },
  { nom: 'Audition Mutualiste', motifs: /\baudition\s*mutualiste\b/i },
  { nom: 'Maison de l’Audition', motifs: /\bmaison\s+de\s+l'audition\b/i },
];
