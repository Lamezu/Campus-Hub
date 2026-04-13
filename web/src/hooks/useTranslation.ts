import { useLanguage } from '../contexts/LanguageContext';
import es from '../locales/es.json';
import en from '../locales/en.json';

const translations: Record<string, any> = { es, en };

export function useTranslation() {
  const { language, setLanguage, loading } = useLanguage();

  const t = (path: string, options?: Record<string, string | number>): string => {
    const lang = language || 'es';

    const getValue = (l: string, p: string, opts?: any): any => {
      let keys = p.split('.');
      if (opts && typeof opts.count === 'number') {
        keys[keys.length - 1] += opts.count === 1 ? '_one' : '_other';
      }

      let res = translations[l];
      for (const k of keys) {
        if (res && res[k] !== undefined) {
          res = res[k];
        } else {
          return undefined;
        }
      }
      return res;
    };

    let result = getValue(lang, path, options);

    if (result === undefined && lang !== 'es') {
      result = getValue('es', path, options);
    }

    if (result === undefined && options && typeof options.count === 'number') {
      result = getValue(lang, path);
      if (result === undefined && lang !== 'es') {
        result = getValue('es', path);
      }
    }

    if (typeof result !== 'string') return path;

    if (options) {
      Object.keys(options).forEach(key => {
        const value = options[key];
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      });
    }

    return result;
  };

  return { t, language, setLanguage, loading };
}
