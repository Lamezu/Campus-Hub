import { useContext } from 'react';
import { LanguageContext } from '../contexts/LanguageContext';
import es from '../locales/es.json';
import en from '../locales/en.json';

const translations = { es, en };

export const useTranslation = () => {
    const { language, setLanguage, loading } = useContext(LanguageContext);

    const translations_obj: any = { es, en };

    const t = (path: string, options?: any): any => {
        const keys = path.split('.');
        const language_to_use = language || 'es';
        let result: any = translations_obj[language_to_use];

        for (const key of keys) {
            if (result && result[key] !== undefined) {
                result = result[key];
            } else {
                let fallback: any = translations_obj['es'];
                for (const fkey of keys) {
                    if (fallback && fallback[fkey] !== undefined) fallback = fallback[fkey];
                    else return '';
                }
                result = fallback;
                break;
            }
        }

        if (typeof result === 'string' && options) {
            Object.keys(options).forEach(key => {
                const value = options[key];
                result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
            });
        }

        return result;
    };

    return { t, language, setLanguage, loading };
};
