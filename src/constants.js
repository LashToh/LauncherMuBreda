export const FALLBACK_CONFIG = {
  apiUrl: 'https://api.mubreda.net',
  websiteUrl: 'https://mubreda.net',
  discordUrl: 'https://discord.gg/SV6yW7XK7',
  instagramUrl: 'https://www.instagram.com/mubredaonline/',
  facebookUrl: 'https://www.facebook.com/mubredaonline/',
};

/** Matches the Resolución.zip registry values (Webzen\\Mu\\Config). */
export const FALLBACK_RESOLUTIONS = [
  { index: 9, label: '640×480', registry: 9 },
  { index: 1, label: '800×600', registry: 1 },
  { index: 2, label: '1024×768', registry: 2 },
  { index: 3, label: '1280×1024', registry: 3 },
  { index: 4, label: '1366×768', registry: 4 },
  { index: 5, label: '1440×900', registry: 5 },
  { index: 7, label: '1600×1280', registry: 7 },
  { index: 8, label: '1920×1080', registry: 8 },
];

export const FALLBACK_SETTINGS = {
  soundOn: true,
  musicOn: true,
  resolutionIndex: 8,
  windowMode: true,
  language: 'es',
};
