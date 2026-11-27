import { Linking, Platform } from 'react-native';
import { log } from './log';

export const FEEDBACK_EMAIL = 'pierre@nobodywho.ai';

const platformName = Platform.OS === 'ios' ? 'iOS' : 'Android';

export const feedbackMailtoUrl = () =>
  `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    `${platformName} app feedback`,
  )}`;

export const openFeedbackEmail = (): Promise<boolean> =>
  Linking.openURL(feedbackMailtoUrl()).then(
    () => true,
    error => {
      log('openFeedbackEmail failed', error);
      return false;
    },
  );
