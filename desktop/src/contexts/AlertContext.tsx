import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertModal } from '@/components/AlertModal';

type AlertType = 'info' | 'success' | 'error' | 'confirm';

interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  showCancelButton?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AlertOptions>({ title: '', message: '' });

  const showAlert = useCallback((newOptions: AlertOptions) => {
    setOptions(newOptions);
    setIsOpen(true);
  }, []);

  const hideAlert = useCallback(() => {
    setIsOpen(false);
    if (options.onCancel) options.onCancel();
  }, [options]);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (options.onConfirm) options.onConfirm();
  }, [options]);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <AlertModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        type={options.type || 'info'}
        confirmText={options.confirmText}
        showCancelButton={options.showCancelButton}
        onClose={hideAlert}
        onConfirm={handleConfirm}
      />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
