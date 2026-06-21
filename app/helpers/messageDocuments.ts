import {
  copyFile,
  DocumentDirectoryPath,
  exists,
  mkdir,
  unlink,
} from '@dr.pogodin/react-native-fs';
import { log } from './log';

const MESSAGE_DOCUMENTS_DIR_NAME = 'message-documents';

const messageDocumentsDir = (): string =>
  `${DocumentDirectoryPath}/${MESSAGE_DOCUMENTS_DIR_NAME}`;

const uniqueName = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  const base = dot === -1 ? fileName : fileName.slice(0, dot);
  const ext = dot === -1 ? '' : fileName.slice(dot);
  return `${base}-${Date.now()}-${Math.floor(Math.random() * 1e6)}${ext}`;
};

// Copy a picked file into the app's message-documents directory under a unique
// name, returning the file name of the copy (NOT an absolute path). The picker
// hands back a volatile cache URI; we persist only the file name because the
// iOS sandbox container UUID — and therefore the absolute path — changes on
// every install, including App Store updates. Callers recombine the name with
// the current directory via resolveMessageDocumentPath().
export const copyToMessageDocuments = async (
  sourceUri: string,
  originalName: string,
): Promise<string> => {
  const dir = messageDocumentsDir();
  if (!(await exists(dir))) {
    await mkdir(dir);
  }

  const name = uniqueName(originalName);
  const destPath = `${dir}/${name}`;
  // react-native-fs copyFile expects a filesystem path, not a file:// URI.
  const source = sourceUri.replace(/^file:\/\//, '');
  await copyFile(source, destPath);
  return name;
};

// Recombine a stored attachment reference with the CURRENT message-documents
// dir. Always reduces to the basename first so legacy absolute paths (saved
// before this change, or from a previous install's container UUID) resolve to
// the current sandbox.
export const resolveMessageDocumentPath = (stored: string): string => {
  const name = stored.replace(/^file:\/\//, '').split('/').pop() ?? stored;
  return `${messageDocumentsDir()}/${name}`;
};

export const deleteMessageDocuments = async (
  paths: string[],
): Promise<void> => {
  await Promise.all(
    paths.map(async path => {
      try {
        const resolved = path && resolveMessageDocumentPath(path);
        if (resolved && (await exists(resolved))) {
          await unlink(resolved);
        }
      } catch (error) {
        log('deleteMessageDocuments failed', error, { capture: true });
      }
    }),
  );
};

// Human-readable name for a stored message-document path: the basename with the
// unique "-<timestamp>-<random>" suffix that uniqueName() injects stripped off,
// recovering the original file name and extension.
export const messageDocumentName = (path: string): string => {
  const base = path.split('/').pop() ?? path;
  return base.replace(/-\d{10,}-\d+(\.[^.]+)?$/, '$1');
};

export type MessageDocumentKind = 'image' | 'audio' | 'file';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];
const AUDIO_EXTENSIONS = [
  'mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'caf', 'aiff', 'amr',
];

// Classify a stored document by its file extension so the message bubble can
// pick the right renderer (image thumbnail, audio player, or plain file name).
export const messageDocumentKind = (path: string): MessageDocumentKind => {
  const dot = path.lastIndexOf('.');
  if (dot === -1) {
    return 'file';
  }
  const ext = path.slice(dot + 1).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) {
    return 'image';
  }
  if (AUDIO_EXTENSIONS.includes(ext)) {
    return 'audio';
  }
  return 'file';
};

// Turn a stored attachment reference into a file:// URI that <Image> and
// expo-audio accept. The reference is a file name (or a legacy absolute path);
// resolve it against the current message-documents dir before adding the
// scheme.
export const messageDocumentUri = (path: string): string =>
  `file://${resolveMessageDocumentPath(path)}`;
