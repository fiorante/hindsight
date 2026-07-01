import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  type?: 'default' | 'success' | 'error' | 'info';
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (text: string, type?: ToastMessage['type'], durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'default', durationMs: number = 1500) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, text, type, durationMs }]);
  }, []);

  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => {
      setToasts((prev) => prev.filter((p) => p.id !== t.id));
    }, t.durationMs ?? 1500));
    return () => { timers.forEach(clearTimeout); };
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container - bottom center, pill style, gray background */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[100000] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto px-4 py-2 rounded-full shadow-md text-sm text-gray-800"
            style={{ backgroundColor: 'rgb(243 244 246)' }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};


