import { isIOS, isAndroid, getIOSVersion, isIOS26OrLater } from './platform';
import { getAssetPath } from './assets';
import { devLog } from './log';
import { getMarkdownStyle } from './markdown';
import { getDatabase, closeDatabase, initDatabase } from './database';
import { haptics } from './haptics';

export {
  getAssetPath,
  isIOS,
  isAndroid,
  getIOSVersion,
  isIOS26OrLater,
  devLog,
  getMarkdownStyle,
  getDatabase,
  closeDatabase,
  initDatabase,
  haptics,
};
