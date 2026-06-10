import { isIOS, isAndroid, getIOSVersion, isIOS26OrLater } from './platform';
import { getAssetPath } from './assets';
import { devLog } from './log';
import { safeJsonParse } from './json';
import { getMarkdownStyle } from './markdown';
import { formatThinkingBlocks, stripThinkingBlocks } from './thinking';
import { haptics } from './haptics';

export {
  getAssetPath,
  isIOS,
  isAndroid,
  getIOSVersion,
  isIOS26OrLater,
  devLog,
  safeJsonParse,
  getMarkdownStyle,
  formatThinkingBlocks,
  stripThinkingBlocks,
  haptics,
};
