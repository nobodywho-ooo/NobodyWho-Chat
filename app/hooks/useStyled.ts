import { useTheme } from 'context';
import { getColors } from 'style';

export const useStyled = () => {
  const theme = useTheme();
  const colors = getColors(theme);

  return { colors };
};
