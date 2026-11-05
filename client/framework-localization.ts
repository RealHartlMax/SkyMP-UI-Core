// Bundled separately: the strict legacy V1 translation catalog stays unchanged.
import type { Locale } from '../shared/localization';
export const frameworkTranslations = {
  de: { select: 'Auswählen', empty: 'Keine Einträge', invalid: 'Bitte alle erforderlichen Felder und Auswahlen prüfen.', tabs: 'Bereiche' },
  en: { select: 'Select', empty: 'No entries', invalid: 'Please check all required fields and selections.', tabs: 'Sections' },
} satisfies Record<Locale, Record<string, string>>;
export type FrameworkMessages = typeof frameworkTranslations['de'];
