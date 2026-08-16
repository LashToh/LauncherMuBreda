export const DEFAULT_CONFIG = {
  apiUrl: 'https://api.mubreda.net',
  websiteUrl: 'https://mubreda.net',
  discordUrl: 'https://discord.gg/SV6yW7XK7',
  instagramUrl: 'https://www.instagram.com/mubredaonline/',
  facebookUrl: 'https://www.facebook.com/mubredaonline/',
  bootstrapExe: 'main.exe',
  language: 'es',
  allowPlayWithoutUpdate: true,
};

/**
 * Resolutions from client Resolución.zip
 * Registry: HKCU\Software\Webzen\Mu\Config → Resolution (DWORD)
 */
export const RESOLUTIONS = [
  { index: 9, label: '640×480', registry: 9 },
  { index: 1, label: '800×600', registry: 1 },
  { index: 2, label: '1024×768', registry: 2 },
  { index: 3, label: '1280×1024', registry: 3 },
  { index: 4, label: '1366×768', registry: 4 },
  { index: 5, label: '1440×900', registry: 5 },
  { index: 7, label: '1600×1280', registry: 7 },
  { index: 8, label: '1920×1080', registry: 8 },
];

/**
 * LauncherOption.if Language: indexes for this MuDevs S21 client:
 * 0 = English, 1 = Spanish, 2 = Portuguese
 */
export const GAME_LANGUAGES = [
  { id: 0, code: 'en', label: 'English' },
  { id: 1, code: 'es', label: 'Spanish' },
  { id: 2, code: 'pt', label: 'Portuguese' },
];

export const UI_TO_GAME_LANG = { en: 0, es: 1, pt: 2 };
export const GAME_TO_UI_LANG = { 0: 'en', 1: 'es', 2: 'pt' };
