import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

export type Language = 'es' | 'en';

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    loading: boolean;
};

export const LanguageContext = createContext<LanguageContextType>({
    language: 'es',
    setLanguage: async () => { },
    loading: true,
});

const STORAGE_KEY = '@app_language';

import { useCurrentUser } from './UserContext';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>('es');
    const [loading, setLoading] = useState(true);
    const { userData, updateLanguage } = useCurrentUser();

    useEffect(() => {
        const loadStoredLanguage = async () => {
            try {
                // If user has a preference in Firestore, use it
                if (userData?.language && (userData.language === 'es' || userData.language === 'en')) {
                    setLanguageState(userData.language as Language);
                    await AsyncStorage.setItem(STORAGE_KEY, userData.language);
                    setLoading(false);
                    return;
                }

                const storedLang = await AsyncStorage.getItem(STORAGE_KEY);
                if (storedLang) {
                    setLanguageState(storedLang as Language);
                } else {
                    const deviceLang = Localization.getLocales()[0].languageCode;
                    if (deviceLang === 'es' || deviceLang === 'en') {
                        setLanguageState(deviceLang as Language);
                    }
                }
            } catch (error) {
                console.error('Error loading language:', error);
            } finally {
                setLoading(false);
            }
        };

        loadStoredLanguage();
    }, [userData?.language]);

    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, lang);
            if (userData) {
                await updateLanguage(lang);
            }
        } catch (error) {
            console.error('Error saving language:', error);
        }
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, loading }}>
            {children}
        </LanguageContext.Provider>
    );
};
