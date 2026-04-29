import { Platform } from 'react-native';
import {
  copyFile,
  copyFileAssets,
  DocumentDirectoryPath,
  exists,
  MainBundlePath,
} from '@dr.pogodin/react-native-fs';

async function getAssetPath(assetName: string): Promise<string> {
  const destPath = `${DocumentDirectoryPath}/${assetName}`;

  if (await exists(destPath)) {
    return destPath;
  }

  if (Platform.OS === 'android') {
    await copyFileAssets(assetName, destPath);
  } else {
    await copyFile(`${MainBundlePath}/${assetName}`, destPath);
  }

  return destPath;
}

export { getAssetPath };
