import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { copyToMessageDocuments } from './messageDocuments';

const MAX_IMAGE_DIMENSION = 1024;
const IMAGE_COMPRESS_QUALITY = 0.7;

const fileNameFromUri = (uri: string): string => {
  const segment = uri.split('?')[0].split('/').pop();
  return segment && segment.length > 0 ? segment : 'file';
};

const toJpegName = (name: string): string => {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base.length > 0 ? base : 'image'}.jpg`;
};

const prepareImage = async (
  uri: string,
  width?: number,
  height?: number,
): Promise<string> => {
  let context = ImageManipulator.manipulate(uri);

  const longestEdge = Math.max(width ?? 0, height ?? 0);
  if (longestEdge > MAX_IMAGE_DIMENSION) {
    context =
      (width ?? 0) >= (height ?? 0)
        ? context.resize({ width: MAX_IMAGE_DIMENSION })
        : context.resize({ height: MAX_IMAGE_DIMENSION });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: IMAGE_COMPRESS_QUALITY,
    format: SaveFormat.JPEG,
  });
  return saved.uri;
};

export const pickImageToMessageDocuments = async (): Promise<string | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  const uri = await prepareImage(asset.uri, asset.width, asset.height);
  const name = toJpegName(asset.fileName ?? fileNameFromUri(asset.uri));
  return copyToMessageDocuments(uri, name);
};

export const captureImageToMessageDocuments = async (capture: {
  uri: string;
  width?: number;
  height?: number;
}): Promise<string> => {
  const uri = await prepareImage(capture.uri, capture.width, capture.height);
  const name = toJpegName(fileNameFromUri(capture.uri));
  return copyToMessageDocuments(uri, name);
};

export const pickAudioToMessageDocuments = async (): Promise<string | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/mpeg', 'audio/wav', 'audio/x-wav'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  return copyToMessageDocuments(asset.uri, asset.name);
};
