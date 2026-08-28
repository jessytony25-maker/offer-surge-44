import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Estado local de preferências do app (modo demo, densidade).
 * O modo demo vem LIGADO para que a interface nunca apareça vazia, mas todo
 * conteúdo demonstrativo é rotulado com o selo "DEMO".
 */

interface AppState {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
}

const Ctx = createContext<AppState>({ demoMode: true, setDemoMode: () => {} });

const KEY = "oferta-hub:demo-mode";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored !== null) setDemoModeState(stored === "true");
  }, []);

  const value = useMemo<AppState>(
    () => ({
      demoMode,
      setDemoMode: (v: boolean) => {
        setDemoModeState(v);
        window.localStorage.setItem(KEY, String(v));
      },
    }),
    [demoMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAppState = () => useContext(Ctx);
