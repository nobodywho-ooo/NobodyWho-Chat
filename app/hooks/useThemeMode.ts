import { useColorScheme } from 'react-native';

export const useThemeMode = () => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  return { isDarkMode };
};
