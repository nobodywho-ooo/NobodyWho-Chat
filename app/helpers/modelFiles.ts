import { Model } from 'types';
import { deleteModelDirectory } from './modelDownload';
import { log } from './log';

export async function deleteModelFiles(model: Model): Promise<boolean> {
  try {
    deleteModelDirectory(model.id);
    return true;
  } catch (error) {
    log('deleteModelFiles failed', error, { capture: true });
    return false;
  }
}
