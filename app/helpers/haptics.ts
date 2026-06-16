import { trigger } from 'react-native-haptic-feedback';
import { log } from './log';

export const haptics = {
  soft: () => {
    try {
      trigger('soft')      
    } catch (error) {
      log("haptics soft", error);
    }
  },
  light: () => {
    try {
      trigger('impactLight')      
    } catch (error) {
      log("haptics impactLight", error);
    }
  },
  medium: () => {
    try {
      trigger('impactMedium')      
    } catch (error) {
      log("haptics impactMedium", error);
    }
  },
  heavy: () => {
    try {
      trigger('impactHeavy')      
    } catch (error) {
      log("haptics impactHeavy", error);
    }
  },
  selection: () => {
    try {
      trigger('selection')      
    } catch (error) {
      log("haptics selection", error);
    }
  },
};
