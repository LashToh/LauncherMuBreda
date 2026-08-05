export const DEFAULT_CONFIG = {
  apiUrl: 'https://api.mubreda.net',
  websiteUrl: 'https://mubreda.net',
  discordUrl: 'https://discord.gg/SV6yW7XK7',
  instagramUrl: 'https://www.instagram.com/mubredaonline/',
  facebookUrl: 'https://www.facebook.com/mubredaonline/',
  donateUrl: 'https://mubreda.net/donate',
  bootstrapExe: 'StartGame.exe',
  bootstrapFallback: '1 - StartGame.exe',
  language: 'es',
  allowPlayWithoutUpdate: true,
};

/** MuDevs Resolution Changer order (0-based DevModeIndex). */
export const RESOLUTIONS = [
  { index: 0, label: '800×600 (4:3)' },
  { index: 1, label: '832×624 (4:3)' },
  { index: 2, label: '1024×768 (4:3)' },
  { index: 3, label: '1152×864 (4:3)' },
  { index: 4, label: '1280×720 (16:9)' },
  { index: 5, label: '1280×800 (16:10)' },
  { index: 6, label: '1440×900 (16:10)' },
  { index: 7, label: '1600×900 (16:9)' },
  { index: 8, label: '1680×1050 (16:10)' },
  { index: 9, label: '1760×990 (16:9)' },
  { index: 10, label: '1920×1080 (16:9)' },
];

/** Matches MuDevs Resolution Changer combo order. */
export const GAME_LANGUAGES = [
  { id: 0, code: 'en', label: 'English' },
  { id: 1, code: 'es', label: 'Spanish' },
  { id: 2, code: 'pt', label: 'Portuguese' },
];

export const UI_TO_GAME_LANG = { en: 0, es: 1, pt: 2 };
export const GAME_TO_UI_LANG = { 0: 'en', 1: 'es', 2: 'pt' };
