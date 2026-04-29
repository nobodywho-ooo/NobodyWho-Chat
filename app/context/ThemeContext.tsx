import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { Theme } from 'types';

const defaultTheme: Theme = 'light';

const ThemeContext = createContext<Theme>(defaultTheme);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const systemTheme = Appearance.getColorScheme();

    return systemTheme === 'light' || systemTheme === 'dark'
      ? systemTheme
      : defaultTheme;
  });

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setTheme(
          colorScheme === 'light' || colorScheme === 'dark'
            ? colorScheme
            : defaultTheme,
        );
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const theme = useContext(ThemeContext);
  return theme;
};
