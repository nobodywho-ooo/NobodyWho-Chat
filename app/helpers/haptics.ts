import { trigger } from 'react-native-haptic-feedback';

export const haptics = {
  soft: () => trigger('soft'),
  light: () => trigger('impactLight'),
  medium: () => trigger('impactMedium'),
  heavy: () => trigger('impactHeavy'),
  selection: () => trigger('selection'),
};
