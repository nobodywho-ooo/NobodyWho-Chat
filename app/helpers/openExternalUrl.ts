import { Linking } from 'react-native';
import { log } from './log';

export const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url);

// Links can come from scraped pages or model output, so only plain http(s) is
// handed to the OS — never a custom scheme that could open another app.
export const openExternalUrl = (url: string | undefined): void => {
  if (!url || !isHttpUrl(url)) {
    log('openExternalUrl refused', url);
    return;
  }

  Linking.openURL(url).catch(error =>
    log('openExternalUrl failed', url, error),
  );
};
