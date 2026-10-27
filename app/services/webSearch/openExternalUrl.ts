import { Linking } from 'react-native';
import { log } from 'helpers';

import { isHttpUrl } from './security/outboundFetch';

// Source links come from scraped pages, so only plain http(s) is handed to the
// OS — never a custom scheme a page could use to open another app.
export const openExternalUrl = (url: string | undefined): void => {
  if (!url || !isHttpUrl(url)) {
    log('openExternalUrl refused', url);
    return;
  }
  Linking.openURL(url).catch(error =>
    log('openExternalUrl failed', url, error),
  );
};
