import { Directory, File, Paths } from 'expo-file-system';
import { log } from 'helpers';

import { WEB_TRACE_KEEP_FILES } from './constants/web';

// Debug aid, off by default (WEB_TRACE_TO_FILE): one JSON file per search with
// the plan, every candidate and what was extracted, kept under Documents so it
// can be pulled off the device.

export const traceFileName = (question: string): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${stamp}${slug ? `-${slug}` : ''}.json`;
};

const pruneOldTraces = (directory: Directory, keepFiles: number): void => {
  const traces = directory
    .list()
    .filter(
      (entry): entry is File =>
        entry instanceof File && entry.name.endsWith('.json'),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const stale of traces.slice(0, Math.max(0, traces.length - keepFiles))) {
    stale.delete();
  }
};

export const writeTraceFile = async (
  directoryName: string,
  question: string,
  body: string,
  keepFiles: number = WEB_TRACE_KEEP_FILES,
): Promise<void> => {
  try {
    const directory = new Directory(Paths.document, directoryName);
    if (!directory.exists) {
      directory.create({ intermediates: true });
    }
    const file = new File(directory, traceFileName(question));
    file.write(body);
    pruneOldTraces(directory, keepFiles);
    log(`Web search trace ${file.uri}`);
  } catch (error) {
    log('Web search trace failed', error);
  }
};
