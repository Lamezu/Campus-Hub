import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

const STORAGE_KEY = 'campushub_saved_accounts';

export interface StoredAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  _pw?: string;
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
  switchAccount: async () => {},
  addAccount: () => {},
  removeAccount: () => {},
});

function loadStored(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStored(accounts: StoredAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<StoredAccount[]>(loadStored);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setActiveUid(user?.uid ?? null);
      if (!user) return;

      const stored = loadStored();
      const existing = stored.find(a => a.uid === user.uid);
      const entry: StoredAccount = {
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? user.email ?? user.uid,
        photoURL: user.photoURL ?? null,
        _pw: existing?._pw,
      };

      const updated = existing
        ? stored.map(a => a.uid === user.uid ? { ...a, ...entry, _pw: a._pw } : a)
        : [...stored, entry];

      saveStored(updated);
      setAccounts(updated);
    });
    return unsub;
  }, []);

  const addAccount = useCallback((entry: StoredAccount) => {
    setAccounts(prev => {
      const updated = [...prev.filter(a => a.uid !== entry.uid), entry];
      saveStored(updated);
      return updated;
    });
  }, []);

  const removeAccount = useCallback((uid: string) => {
    setAccounts(prev => {
      const updated = prev.filter(a => a.uid !== uid);
      saveStored(updated);
      return updated;
    });
  }, []);

  const switchAccount = useCallback(async (account: StoredAccount) => {
    if (account.uid === auth.currentUser?.uid) return;
    if (!account._pw) throw new Error('no_credentials');
    setSwitching(true);
    try {
      await signOut(auth);
      await signInWithEmailAndPassword(auth, account.email, atob(account._pw));
    } finally {
      setSwitching(false);
    }
  }, []);

  return (
    <AccountsContext.Provider value={{ accounts, activeUid, switching, switchAccount, addAccount, removeAccount }}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  return useContext(AccountsContext);
}
