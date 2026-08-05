import en from './en.js';
import es from './es.js';
import pt from './pt.js';

const dictionaries = { en, es, pt };

export function getDictionary(code = 'es') {
  return dictionaries[code] || dictionaries.es;
}

export const LANG_OPTIONS = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
];
