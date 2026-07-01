import { Model } from 'types';
import { deleteModelPartFiles } from './modelDownload';
import { log } from './log';

export async function deleteModelFiles(model: Model): Promise<boolean> {
  try {
    deleteModelPartFiles(model.parts.map(part => part.fileName));
    return true;
  } catch (error) {
    log('deleteModelFiles failed', error, { capture: true });
    return false;
  }
}
