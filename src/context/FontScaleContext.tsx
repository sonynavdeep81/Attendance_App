import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFontScale, setFontScale as persistFontScale } from '../utils/storage';

type FontScaleContextValue = {
  scale: number;
  setScale: (scale: number) => void;
};

const FontScaleContext = createContext<FontScaleContextValue>({
  scale: 1.0,
  setScale: () => {},
});

export const FontScaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [scale, setScaleState] = useState(1.0);

  useEffect(() => {
    getFontScale().then(setScaleState);
  }, []);

  const setScale = (value: number) => {
    setScaleState(value);
    persistFontScale(value);
  };

  return (
    <FontScaleContext.Provider value={{ scale, setScale }}>
      {children}
    </FontScaleContext.Provider>
  );
};

export const useFontScale = () => useContext(FontScaleContext);
