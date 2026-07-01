// Native model/media loaders (nobodywho → llama.cpp, and some others) want a
// plain `/var/…` filesystem path, while expo-file-system speaks `file://` URIs.
// These two helpers convert between the conventions at the boundary.

export const toFileUri = (path: string): string =>
  path.startsWith('file://') ? path : `file://${path}`;

export const toPlainPath = (uri: string): string => uri.replace(/^file:\/\//, '');
