import { isIOS, isAndroid, getIOSVersion, isIOS26OrLater } from './platform';
import { getAssetPath } from './assets';
import { devLog } from './log';
import { getMarkdownStyle, formatThinkingBlocks } from './markdown';
import { getDatabase, closeDatabase, initDatabase } from './database';
import { getStorage, getModelIdInUse, setModelIdInUse } from './storage';
import { haptics } from './haptics';

export {
  getAssetPath,
  isIOS,
  isAndroid,
  getIOSVersion,
  isIOS26OrLater,
  devLog,
  getMarkdownStyle,
  formatThinkingBlocks,
  getDatabase,
  closeDatabase,
  initDatabase,
  getStorage,
  getModelIdInUse,
  setModelIdInUse,
  haptics,
};
