import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/config/firebase';

const STORAGE_KEY = 'campushub_saved_accounts';

export interface StoredAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  refreshToken: string;
  _pw?: string; // Base64 encoded password for switching
}

interface AccountsContextType {
  accounts: StoredAccount[];
  activeUid: string | null;
  switching: boolean;
  switchAccount: (account: StoredAccount) => Promise<void>;
  addAccount: (entry: StoredAccount) => void;
  removeAccount: (uid: string) => void;
}

const AccountsContext = createContext<AccountsContextType>({
  accounts: [],
  activeUid: null,
  switching: false,
  switchAccount: async () => { },
  addAccount: () => { },
  removeAccount: () => { },
});

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setActiveUid(user?.uid ?? null);

      const raw = localStorage.getItem(STORAGE_KEY);
      let stored: StoredAccount[] = [];
      if (raw) { try { stored = JSON.parse(raw); } catch { } }

      if (!user) {
        setAccounts(stored);
        return;
      }

      const entry: StoredAccount = {
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? user.email ?? user.uid,
        photoURL: user.photoURL ?? null,
        refreshToken: user.refreshToken,
      };

      const exists = stored.find(a => a.uid === user.uid);

      const needsUpdate = !exists || 
                         exists.photoURL !== entry.photoURL || 
                         exists.displayName !== entry.displayName || 
                         exists.refreshToken !== entry.refreshToken;

      if (!needsUpdate) {
        setAccounts(stored);
        return;
      }

      const updated = exists
        ? stored.map(a => a.uid === user.uid
          ? { ...a, ...entry, _pw: a._pw ?? (entry as any)._pw }
          : a)
        : [...stored, entry];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setAccounts(updated);
    });
    return unsub;
  }, []);

  const addAccount = useCallback((entry: StoredAccount) => {
    setAccounts(prev => {
      const updated = [...prev.filter(a => a.uid !== entry.uid), entry];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeAccount = useCallback((uid: string) => {
    setAccounts(prev => {
      const updated = prev.filter(a => a.uid !== uid);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const switchAccount = useCallback(async (account: StoredAccount) => {
    if (account.uid === activeUid) return;
    if (!account._pw) {
      console.error('[switch] No password found for account:', account.email);
      throw new Error('no_credentials');
    }
    
    setSwitching(true);
    try {
      const password = atob(account._pw);
      await signOut(auth);
      await signInWithEmailAndPassword(auth, account.email, password);
    } catch (err: any) {
      console.error('[switch] Error during sign in:', err);
      if (err.code === 'auth/wrong-password') {
        throw new Error('invalid_credentials');
      }
      throw err;
    } finally {
      setSwitching(false);
    }
  }, [activeUid]);

  return (
    <AccountsContext.Provider value={{ accounts, activeUid, switching, switchAccount, addAccount, removeAccount }}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  return useContext(AccountsContext);
}
