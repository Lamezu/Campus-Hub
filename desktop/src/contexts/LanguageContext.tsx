import React, { createContext, useState, useEffect, useContext } from 'react';
import { t as translate, setLanguage as setLang, getLanguage as getLang } from '../utils/i18n';
import { useUser } from './UserContext';
import { useTheme } from './ThemeContext';

type Language = 'es' | 'en';

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (path: string, options?: any) => string;
    loading: boolean;
};

const LanguageContext = createContext<LanguageContextType>({
    language: 'es',
    setLanguage: async () => { },
    t: (path: string) => path,
    loading: true,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>((localStorage.getItem('app_language') as Language) || 'es');
    const [loading, setLoading] = useState(true);
    const [loadingLanguage, setLoadingLanguage] = useState(false);
    const { userData, updateUserData } = useUser();
    const { colors } = useTheme();

    useEffect(() => {
        const loadLanguage = async () => {
            try {
                // Priority 1: User data from Firebase
                if (userData?.language && (userData.language === 'es' || userData.language === 'en')) {
                    const lang = userData.language as Language;
                    setLanguageState(lang);
                    setLang(lang);
                    localStorage.setItem('app_language', lang);
                } else {
                    // Priority 2: Local storage
                    const storedLang = getLang() as Language;
                    if (storedLang) {
                        setLanguageState(storedLang);
                        setLang(storedLang);
                    }
                }
            } catch (error) {
                console.error('Error loading language:', error);
            } finally {
                setLoading(false);
            }
        };

        loadLanguage();
    }, [userData?.language]);

    const setLanguage = async (lang: Language) => {
        setLoadingLanguage(true);
        // Flashing effect to hide "processing"
        await new Promise(r => setTimeout(r, 400));
        
        setLanguageState(lang);
        setLang(lang); // Updates our util state
        try {
            if (userData) {
                await updateUserData({ language: lang });
            }
        } catch (error) {
            console.error('Error saving language preference:', error);
        } finally {
            setTimeout(() => setLoadingLanguage(false), 200);
        }
    };

    const t = (path: string, options?: any) => translate(path, options);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, loading }}>
            {children}
            {loadingLanguage && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    backgroundColor: colors.background + 'CC',
                    backdropFilter: 'blur(20px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 20,
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        width: 50, height: 50, borderRadius: '50%',
                        border: `3px solid ${colors.primary}22`,
                        borderTop: `3px solid ${colors.primary}`,
                        animation: 'spin 1s linear infinite'
                    }} />
                    <span style={{ 
                        color: colors.text, fontSize: 16, fontWeight: '700',
                        fontFamily: 'Inter, sans-serif'
                    }}>
                        {language === 'es' ? 'Cambiando idioma...' : 'Changing language...'}
                    </span>
                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    `}</style>
                </div>
            )}
        </LanguageContext.Provider>
    );
};

export const useTranslation = () => {
    return useContext(LanguageContext);
};
