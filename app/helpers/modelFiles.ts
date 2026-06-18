import { exists, unlink } from '@dr.pogodin/react-native-fs';
import { Model } from 'types';
import { log } from './log';

export async function deleteModelFiles(model: Model): Promise<boolean> {
  try {
    await Promise.all(
      model.parts.map(async ({ path }) => {
        if (path && (await exists(path))) {
          await unlink(path);
        }
      }),
    );
    return true;
  } catch (error) {
    log('deleteModelFiles failed', error, { capture: true });
    return false;
  }
}
