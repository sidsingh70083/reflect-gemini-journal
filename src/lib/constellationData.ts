export interface ConstellationStar {
  id: string;
  name?: string;
  x: number; // Normalized 0.0 to 1.0
  y: number; // Normalized 0.0 to 1.0
  brightness?: number; // 1 to 3
}

export interface ConstellationPattern {
  id: string;
  name: string;
  commonName: string;
  season: string;
  notableStars: string[];
  stars: ConstellationStar[];
  lines: [string, string][]; // Star ID pairs
  handwrittenDescription: string;
}

export const REAL_CONSTELLATIONS: ConstellationPattern[] = [
  {
    id: 'orion',
    name: 'Orion',
    commonName: 'The Hunter',
    season: 'Prominent across the world from November to March',
    notableStars: ['Betelgeuse', 'Rigel', 'Bellatrix', 'Alnitak', 'Alnilam', 'Mintaka'],
    stars: [
      { id: 'meissa', name: 'Meissa', x: 0.50, y: 0.16, brightness: 2 },
      { id: 'betelgeuse', name: 'Betelgeuse', x: 0.34, y: 0.28, brightness: 3 },
      { id: 'bellatrix', name: 'Bellatrix', x: 0.66, y: 0.29, brightness: 2 },
      { id: 'alnitak', name: 'Alnitak', x: 0.44, y: 0.50, brightness: 2 },
      { id: 'alnilam', name: 'Alnilam', x: 0.50, y: 0.50, brightness: 2 },
      { id: 'mintaka', name: 'Mintaka', x: 0.56, y: 0.49, brightness: 2 },
      { id: 'saiph', name: 'Saiph', x: 0.38, y: 0.77, brightness: 2 },
      { id: 'rigel', name: 'Rigel', x: 0.64, y: 0.75, brightness: 3 },
      { id: 'shield_top', x: 0.76, y: 0.36, brightness: 1 },
      { id: 'shield_mid', x: 0.78, y: 0.47, brightness: 1 },
      { id: 'shield_bot', x: 0.75, y: 0.58, brightness: 1 },
    ],
    lines: [
      ['meissa', 'betelgeuse'],
      ['meissa', 'bellatrix'],
      ['betelgeuse', 'alnitak'],
      ['bellatrix', 'mintaka'],
      ['alnitak', 'alnilam'],
      ['alnilam', 'mintaka'],
      ['alnitak', 'saiph'],
      ['mintaka', 'rigel'],
      ['saiph', 'rigel'],
      ['bellatrix', 'shield_top'],
      ['shield_top', 'shield_mid'],
      ['shield_mid', 'shield_bot'],
    ],
    handwrittenDescription:
      'One of the most recognizable figures across human history. The prominent trio of belt stars has served as a celestial compass for wanderers across the Mediterranean, ancient Egypt (who linked it with Osiris), and Polynesian voyagers navigating vast Pacific waters.',
  },
  {
    id: 'ursa_major',
    name: 'Ursa Major',
    commonName: 'The Great Bear (The Big Dipper)',
    season: 'Circumpolar in the Northern Hemisphere; visible year-round',
    notableStars: ['Dubhe', 'Merak', 'Phecda', 'Megrez', 'Alioth', 'Mizar', 'Alkaid'],
    stars: [
      { id: 'dubhe', name: 'Dubhe', x: 0.68, y: 0.28, brightness: 3 },
      { id: 'merak', name: 'Merak', x: 0.65, y: 0.48, brightness: 2 },
      { id: 'phecda', name: 'Phecda', x: 0.48, y: 0.52, brightness: 2 },
      { id: 'megrez', name: 'Megrez', x: 0.49, y: 0.34, brightness: 2 },
      { id: 'alioth', name: 'Alioth', x: 0.36, y: 0.39, brightness: 2 },
      { id: 'mizar', name: 'Mizar', x: 0.24, y: 0.46, brightness: 2 },
      { id: 'alkaid', name: 'Alkaid', x: 0.14, y: 0.62, brightness: 3 },
    ],
    lines: [
      ['dubhe', 'merak'],
      ['merak', 'phecda'],
      ['phecda', 'megrez'],
      ['megrez', 'dubhe'],
      ['megrez', 'alioth'],
      ['alioth', 'mizar'],
      ['mizar', 'alkaid'],
    ],
    handwrittenDescription:
      'The Big Dipper asterism within Ursa Major has guided nocturnal travelers for thousands of years. The outer bowl stars Merak and Dubhe form the famous "Pointer", leading directly to Polaris, while Ojibwe traditions remember this starry arc as the Fisher protecting the sky.',
  },
  {
    id: 'cassiopeia',
    name: 'Cassiopeia',
    commonName: 'The Queen / The Celestial W',
    season: 'High in the northern autumn and winter skies',
    notableStars: ['Schedar', 'Caph', 'Navi', 'Ruchbah', 'Segin'],
    stars: [
      { id: 'caph', name: 'Caph', x: 0.18, y: 0.45, brightness: 2 },
      { id: 'schedar', name: 'Schedar', x: 0.35, y: 0.60, brightness: 3 },
      { id: 'navi', name: 'Navi (γ Cas)', x: 0.52, y: 0.36, brightness: 3 },
      { id: 'ruchbah', name: 'Ruchbah', x: 0.68, y: 0.58, brightness: 2 },
      { id: 'segin', name: 'Segin', x: 0.84, y: 0.38, brightness: 2 },
    ],
    lines: [
      ['caph', 'schedar'],
      ['schedar', 'navi'],
      ['navi', 'ruchbah'],
      ['ruchbah', 'segin'],
    ],
    handwrittenDescription:
      'Forming an unmistakable "W" or "M" floating opposite the Big Dipper across the North Star, Cassiopeia represents the regal queen in Mediterranean myth. Traditional Arabic astronomers saw these five luminous stars as the henna-tinted hand reaching gently into the Milky Way.',
  },
  {
    id: 'cygnus',
    name: 'Cygnus',
    commonName: 'The Swan / Northern Cross',
    season: 'Dominant overhead in late summer and autumn',
    notableStars: ['Deneb', 'Albireo', 'Sadr', 'Gienah', 'Fawaris'],
    stars: [
      { id: 'deneb', name: 'Deneb', x: 0.50, y: 0.18, brightness: 3 },
      { id: 'sadr', name: 'Sadr', x: 0.50, y: 0.45, brightness: 2 },
      { id: 'albireo', name: 'Albireo', x: 0.50, y: 0.82, brightness: 2 },
      { id: 'gienah', name: 'Gienah', x: 0.22, y: 0.42, brightness: 2 },
      { id: 'fawaris', name: 'Fawaris (δ Cyg)', x: 0.78, y: 0.40, brightness: 2 },
    ],
    lines: [
      ['deneb', 'sadr'],
      ['sadr', 'albireo'],
      ['gienah', 'sadr'],
      ['sadr', 'fawaris'],
    ],
    handwrittenDescription:
      'Gliding gracefully along the starry stream of the Milky Way, Cygnus forms the serene Northern Cross. Its tail star Deneb anchors the Summer Triangle, while in East Asian tradition, its outstretched wings mark the Magpie Bridge where separated lovers reunite across the celestial river.',
  },
  {
    id: 'lyra',
    name: 'Lyra',
    commonName: 'The Lyre',
    season: 'High overhead throughout northern summer evenings',
    notableStars: ['Vega', 'Sheliak', 'Sulafat'],
    stars: [
      { id: 'vega', name: 'Vega', x: 0.50, y: 0.20, brightness: 3 },
      { id: 'zeta_lyr', name: 'Zeta Lyr', x: 0.44, y: 0.38, brightness: 1 },
      { id: 'delta_lyr', name: 'Delta Lyr', x: 0.58, y: 0.37, brightness: 1 },
      { id: 'sheliak', name: 'Sheliak', x: 0.42, y: 0.68, brightness: 2 },
      { id: 'sulafat', name: 'Sulafat', x: 0.58, y: 0.70, brightness: 2 },
    ],
    lines: [
      ['vega', 'zeta_lyr'],
      ['vega', 'delta_lyr'],
      ['zeta_lyr', 'delta_lyr'],
      ['zeta_lyr', 'sheliak'],
      ['delta_lyr', 'sulafat'],
      ['sheliak', 'sulafat'],
    ],
    handwrittenDescription:
      'A compact constellation cradling sapphire-white Vega, the fifth brightest star in our night sky. In Greek mythology, it was the enchanted harp of Orpheus whose quiet chords could soothe wild beasts and still restless rivers.',
  },
  {
    id: 'scorpius',
    name: 'Scorpius',
    commonName: 'The Scorpion',
    season: 'Low on the southern horizon in northern summer; high in the Southern Hemisphere',
    notableStars: ['Antares', 'Shaula', 'Sargas', 'Dschubba', 'Graffias'],
    stars: [
      { id: 'graffias', name: 'Graffias', x: 0.68, y: 0.16, brightness: 2 },
      { id: 'dschubba', name: 'Dschubba', x: 0.62, y: 0.22, brightness: 2 },
      { id: 'pi_sco', x: 0.58, y: 0.28, brightness: 1 },
      { id: 'antares', name: 'Antares', x: 0.54, y: 0.38, brightness: 3 },
      { id: 'wei', name: 'Wei (ε Sco)', x: 0.50, y: 0.52, brightness: 2 },
      { id: 'mu_sco', x: 0.45, y: 0.64, brightness: 1 },
      { id: 'sargas', name: 'Sargas', x: 0.38, y: 0.76, brightness: 2 },
      { id: 'shaula', name: 'Shaula', x: 0.26, y: 0.72, brightness: 3 },
      { id: 'lesath', name: 'Lesath', x: 0.24, y: 0.66, brightness: 2 },
    ],
    lines: [
      ['graffias', 'dschubba'],
      ['dschubba', 'pi_sco'],
      ['dschubba', 'antares'],
      ['antares', 'wei'],
      ['wei', 'mu_sco'],
      ['mu_sco', 'sargas'],
      ['sargas', 'shaula'],
      ['shaula', 'lesath'],
    ],
    handwrittenDescription:
      'With its glowing red heart star Antares and sweeping curved tail, Scorpius is one of humanity’s oldest charted star patterns. To Polynesian navigators, this gentle hook was the magical fishhook of Maui pulling islands from the deep ocean.',
  },
  {
    id: 'leo',
    name: 'Leo',
    commonName: 'The Lion',
    season: 'Best viewed in springtime evenings across both hemispheres',
    notableStars: ['Regulus', 'Denebola', 'Algieba', 'Zosma'],
    stars: [
      { id: 'rasalas', name: 'Rasalas', x: 0.28, y: 0.22, brightness: 1 },
      { id: 'adhafera', name: 'Adhafera', x: 0.38, y: 0.26, brightness: 2 },
      { id: 'algieba', name: 'Algieba', x: 0.42, y: 0.38, brightness: 2 },
      { id: 'regulus', name: 'Regulus', x: 0.38, y: 0.68, brightness: 3 },
      { id: 'eta_leo', x: 0.44, y: 0.56, brightness: 1 },
      { id: 'zosma', name: 'Zosma', x: 0.65, y: 0.34, brightness: 2 },
      { id: 'chertan', name: 'Chertan', x: 0.67, y: 0.52, brightness: 2 },
      { id: 'denebola', name: 'Denebola', x: 0.82, y: 0.46, brightness: 3 },
    ],
    lines: [
      ['rasalas', 'adhafera'],
      ['adhafera', 'algieba'],
      ['algieba', 'eta_leo'],
      ['eta_leo', 'regulus'],
      ['algieba', 'zosma'],
      ['zosma', 'denebola'],
      ['denebola', 'chertan'],
      ['chertan', 'regulus'],
      ['zosma', 'chertan'],
    ],
    handwrittenDescription:
      'A hallmark of the spring sky, recognizable by the backwards question-mark known as the "Sickle" leading down to radiant blue-white Regulus. Ancient Persian astronomers held Regulus as one of the four Royal Guardians watching over the celestial vault.',
  },
  {
    id: 'taurus',
    name: 'Taurus',
    commonName: 'The Bull',
    season: 'Prominent in late autumn and winter skies',
    notableStars: ['Aldebaran', 'Elnath', 'Alcyone (Pleiades)', 'Tianguan'],
    stars: [
      { id: 'aldebaran', name: 'Aldebaran', x: 0.42, y: 0.56, brightness: 3 },
      { id: 'hyades_top', name: 'Ain (ε Tau)', x: 0.45, y: 0.42, brightness: 2 },
      { id: 'hyades_corner', name: 'Gamma Tau', x: 0.34, y: 0.48, brightness: 1 },
      { id: 'elnath', name: 'Elnath', x: 0.68, y: 0.22, brightness: 3 },
      { id: 'tianguan', name: 'Tianguan (ζ Tau)', x: 0.72, y: 0.48, brightness: 2 },
      { id: 'pleiades', name: 'Pleiades Cluster', x: 0.22, y: 0.36, brightness: 3 },
    ],
    lines: [
      ['hyades_corner', 'aldebaran'],
      ['hyades_corner', 'hyades_top'],
      ['hyades_top', 'elnath'],
      ['aldebaran', 'tianguan'],
      ['hyades_top', 'pleiades'],
    ],
    handwrittenDescription:
      'Facing Orion across the starry dome, Taurus features the fiery orange giant Aldebaran and the sparkling Seven Sisters (Pleiades). Depictions of this starry bull reach back over 15,000 years to the ancient cave art of Lascaux.',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    commonName: 'The Twins',
    season: 'High overhead throughout winter and early spring',
    notableStars: ['Castor', 'Pollux', 'Alhena', 'Wasat', 'Mebsuta'],
    stars: [
      { id: 'castor', name: 'Castor', x: 0.44, y: 0.18, brightness: 3 },
      { id: 'pollux', name: 'Pollux', x: 0.58, y: 0.20, brightness: 3 },
      { id: 'wasat', name: 'Wasat', x: 0.56, y: 0.44, brightness: 2 },
      { id: 'mebsuta', name: 'Mebsuta', x: 0.38, y: 0.40, brightness: 2 },
      { id: 'tejat', name: 'Tejat', x: 0.30, y: 0.62, brightness: 2 },
      { id: 'alhena', name: 'Alhena', x: 0.52, y: 0.72, brightness: 3 },
    ],
    lines: [
      ['castor', 'pollux'],
      ['castor', 'mebsuta'],
      ['mebsuta', 'tejat'],
      ['pollux', 'wasat'],
      ['wasat', 'alhena'],
      ['mebsuta', 'wasat'],
    ],
    handwrittenDescription:
      'Marked by golden Pollux and six-star sextuple system Castor, Gemini represents companionship and deep harmony. In Mediterranean navigation lore, the pair was revered by mariners as the peaceful calming presence following storms at sea.',
  },
  {
    id: 'corona_borealis',
    name: 'Corona Borealis',
    commonName: 'The Northern Crown',
    season: 'Gently visible on northern spring and summer nights',
    notableStars: ['Alphecca', 'Nusakan'],
    stars: [
      { id: 'theta_crb', x: 0.20, y: 0.50, brightness: 1 },
      { id: 'beta_crb', name: 'Nusakan', x: 0.32, y: 0.38, brightness: 2 },
      { id: 'alphecca', name: 'Alphecca', x: 0.50, y: 0.32, brightness: 3 },
      { id: 'gamma_crb', x: 0.66, y: 0.36, brightness: 2 },
      { id: 'delta_crb', x: 0.78, y: 0.48, brightness: 1 },
      { id: 'epsilon_crb', x: 0.84, y: 0.64, brightness: 1 },
    ],
    lines: [
      ['theta_crb', 'beta_crb'],
      ['beta_crb', 'alphecca'],
      ['alphecca', 'gamma_crb'],
      ['gamma_crb', 'delta_crb'],
      ['delta_crb', 'epsilon_crb'],
    ],
    handwrittenDescription:
      'A delicate, glittering arc of stars resting between Boötes and Hercules. In Greek legend it is the bridal crown woven for Ariadne; in Celtic traditions it is Caer Arianrhod, the silver castle of the quiet north where souls find renewal.',
  },
  {
    id: 'aquila',
    name: 'Aquila',
    commonName: 'The Eagle',
    season: 'High in late summer and early autumn evenings',
    notableStars: ['Altair', 'Tarazed', 'Alshain'],
    stars: [
      { id: 'tarazed', name: 'Tarazed', x: 0.46, y: 0.32, brightness: 2 },
      { id: 'altair', name: 'Altair', x: 0.50, y: 0.42, brightness: 3 },
      { id: 'alshain', name: 'Alshain', x: 0.54, y: 0.52, brightness: 2 },
      { id: 'okab', name: 'Okab (ζ Aql)', x: 0.30, y: 0.36, brightness: 2 },
      { id: 'tseen_foo', x: 0.68, y: 0.62, brightness: 1 },
      { id: 'lambda_aql', x: 0.36, y: 0.72, brightness: 2 },
    ],
    lines: [
      ['tarazed', 'altair'],
      ['altair', 'alshain'],
      ['altair', 'okab'],
      ['alshain', 'tseen_foo'],
      ['alshain', 'lambda_aql'],
    ],
    handwrittenDescription:
      'Soaring across the glowing Great Rift of the Milky Way, Aquila is anchored by rapid rotator Altair. In the beloved East Asian Tanabata legend, Altair represents Niulang, the devoted cowherd, reunited once each year beneath the quiet stars.',
  },
  {
    id: 'canis_major',
    name: 'Canis Major',
    commonName: 'The Great Dog',
    season: 'Trails Orion throughout the northern winter and southern summer',
    notableStars: ['Sirius', 'Adhara', 'Wezen', 'Mirzam'],
    stars: [
      { id: 'sirius', name: 'Sirius (The Dog Star)', x: 0.38, y: 0.28, brightness: 3 },
      { id: 'mirzam', name: 'Mirzam', x: 0.24, y: 0.36, brightness: 2 },
      { id: 'muliphein', x: 0.44, y: 0.20, brightness: 1 },
      { id: 'wezen', name: 'Wezen', x: 0.54, y: 0.58, brightness: 2 },
      { id: 'adhara', name: 'Adhara', x: 0.46, y: 0.74, brightness: 3 },
      { id: 'aludra', name: 'Aludra', x: 0.68, y: 0.72, brightness: 2 },
    ],
    lines: [
      ['mirzam', 'sirius'],
      ['sirius', 'muliphein'],
      ['sirius', 'wezen'],
      ['wezen', 'adhara'],
      ['wezen', 'aludra'],
    ],
    handwrittenDescription:
      'Home to Sirius, the brightest star in Earth’s night sky. Ancient Egyptian skywatchers marked their agricultural year by the pre-dawn rising of Sirius (Sopdet), heralding the life-giving annual flooding of the Nile.',
  },
  {
    id: 'pegasus',
    name: 'Pegasus',
    commonName: 'The Winged Horse / The Great Square',
    season: 'Prominent in northern autumn and southern spring',
    notableStars: ['Markab', 'Scheat', 'Algenib', 'Alpheratz', 'Enif'],
    stars: [
      { id: 'scheat', name: 'Scheat', x: 0.36, y: 0.30, brightness: 2 },
      { id: 'markab', name: 'Markab', x: 0.34, y: 0.62, brightness: 3 },
      { id: 'alpheratz', name: 'Alpheratz', x: 0.66, y: 0.32, brightness: 3 },
      { id: 'algenib', name: 'Algenib', x: 0.64, y: 0.64, brightness: 2 },
      { id: 'enif', name: 'Enif (The Muzzle)', x: 0.16, y: 0.72, brightness: 2 },
    ],
    lines: [
      ['scheat', 'alpheratz'],
      ['alpheratz', 'algenib'],
      ['algenib', 'markab'],
      ['markab', 'scheat'],
      ['markab', 'enif'],
    ],
    handwrittenDescription:
      'Marked by the grand four-star "Great Square", Pegasus opens a quiet window into deep celestial space. Ancient Arabic astronomers named this square for the leather well-bucket that draws waters of nourishment from the starry dark.',
  },
  {
    id: 'draco',
    name: 'Draco',
    commonName: 'The Dragon',
    season: 'Winds around the north celestial pole year-round',
    notableStars: ['Thuban', 'Eltanin', 'Rastaban'],
    stars: [
      { id: 'eltanin', name: 'Eltanin', x: 0.78, y: 0.22, brightness: 3 },
      { id: 'rastaban', name: 'Rastaban', x: 0.72, y: 0.30, brightness: 2 },
      { id: 'grumium', x: 0.82, y: 0.34, brightness: 1 },
      { id: 'kuma', x: 0.76, y: 0.40, brightness: 1 },
      { id: 'altais', x: 0.60, y: 0.48, brightness: 2 },
      { id: 'thuban', name: 'Thuban (Former Pole Star)', x: 0.42, y: 0.58, brightness: 2 },
      { id: 'edisich', x: 0.26, y: 0.66, brightness: 2 },
      { id: 'gianfar', x: 0.18, y: 0.76, brightness: 1 },
    ],
    lines: [
      ['eltanin', 'rastaban'],
      ['rastaban', 'kuma'],
      ['kuma', 'grumium'],
      ['grumium', 'eltanin'],
      ['kuma', 'altais'],
      ['altais', 'thuban'],
      ['thuban', 'edisich'],
      ['edisich', 'gianfar'],
    ],
    handwrittenDescription:
      'A gentle, serpentine ribbon of stars winding between Ursa Major and Ursa Minor. Around 2800 BCE, when the ancient pyramids of Giza were aligned, Draco’s pale star Thuban was humanity’s true North Star.',
  },
];
