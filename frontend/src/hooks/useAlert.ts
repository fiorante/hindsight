import { useState } from 'react';

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export const useAlert = () => {
  const [alert, setAlert] = useState<AlertState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info'
  ) => {
    setAlert({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const hideAlert = () => {
    setAlert(prev => ({ ...prev, isOpen: false }));
  };

  return {
    alert,
    showAlert,
    hideAlert
  };
};