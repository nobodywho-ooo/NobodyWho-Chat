import NativeClipboard from '../../specs/NativeRTNClipboard';

export const copyToClipboard = (text: string): void => {
  NativeClipboard.setString(text);
};
