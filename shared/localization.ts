import de from '../locales/de.json';
import en from '../locales/en.json';
export type Locale = 'de' | 'en';
export interface UiMessages {
  close: string; display: string; scale: string; visible: string; position: string;
  info: string; success: string; warning: string; error: string; pending: string; language: string;
  'top-left': string; 'top-right': string; 'bottom-left': string; 'bottom-right': string;
}
export type UiTranslations = Record<Locale, UiMessages>;
export const bundledTranslations: UiTranslations = { de, en };
export function translations(input: unknown = {}): UiTranslations {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'de' && key !== 'en')) throw new TypeError('Invalid locale catalog');
  const result = { de: { ...de }, en: { ...en } };
  for (const locale of ['de', 'en'] as const) {
    const custom = (input as any)[locale]; if (custom === undefined) continue;
    if (!custom || typeof custom !== 'object' || Array.isArray(custom)) throw new TypeError('Invalid locale: ' + locale);
    for (const [key, value] of Object.entries(custom)) {
      if (!Object.prototype.hasOwnProperty.call(de, key) || typeof value !== 'string' || !value.trim() || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError('Invalid locale key/text: ' + locale + '.' + key);
      (result[locale] as any)[key] = value;
    }
  }
  return result;
}
