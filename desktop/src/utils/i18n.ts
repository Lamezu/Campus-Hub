import es from '../locales/es.json';
import en from '../locales/en.json';

const translations: any = { es, en };
let currentLanguage = localStorage.getItem('app_language') || 'es';

export const t = (path: string, options?: any): string => {
    const keys = path.split('.');
    let result: any = translations[currentLanguage];

    if (options && typeof options.count === 'number') {
        const count = options.count;
        const pluralSuffix = count === 1 ? '_one' : '_other';
        const lastKey = keys[keys.length - 1];
        
        let pluralResult = result;
        for (let i = 0; i < keys.length - 1; i++) {
            pluralResult = pluralResult?.[keys[i]];
        }
        if (pluralResult && pluralResult[lastKey + pluralSuffix] !== undefined) {
            result = pluralResult[lastKey + pluralSuffix];
        } else {
            for (const key of keys) {
                if (result && result[key] !== undefined) {
                    result = result[key];
                } else {
                    result = undefined;
                    break;
                }
            }
        }
    } else {
        for (const key of keys) {
            if (result && result[key] !== undefined) {
                result = result[key];
            } else {
                result = undefined;
                break;
            }
        }
    }


    if (result === undefined) {
        if (options?.defaultValue !== undefined) {
            return options.defaultValue;
        }

        let fallback: any = translations['es'];
        for (const fkey of keys) {
            if (fallback && fallback[fkey] !== undefined) {
                fallback = fallback[fkey];
            } else {
                fallback = undefined;
                break;
            }
        }
        
        if (fallback !== undefined) {
            result = fallback;
        } else {
            return options?.fallback || path;
        }
    }

    if (typeof result === 'string' && options) {
        Object.keys(options).forEach(key => {
            const value = options[key];
            result = (result as string).replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        });
    }

    if (result !== undefined) return result;
    return options?.defaultValue || path;
};

export const getLanguage = (): string => {
    return currentLanguage;
};

export const setLanguage = (lang: 'es' | 'en') => {
    currentLanguage = lang;
    localStorage.setItem('app_language', lang);
};
