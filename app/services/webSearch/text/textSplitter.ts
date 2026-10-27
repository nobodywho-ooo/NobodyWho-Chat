// Recursive character splitter, after LangChain's RecursiveCharacterTextSplitter
// (which private-mind took from react-native-rag): split on the coarsest
// separator that still yields pieces under `chunkSize`, recurse into pieces that
// don't fit with the next finer separator, then merge neighbours back up to
// `chunkSize` keeping `chunkOverlap` characters of the previous chunk.

const DEFAULT_SEPARATORS = ['\n\n', '\n', ' ', ''];

interface TextSplitterOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

export class RecursiveCharacterTextSplitter {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly separators: string[];

  constructor({ chunkSize, chunkOverlap, separators }: TextSplitterOptions) {
    if (chunkOverlap >= chunkSize) {
      throw new Error('chunkOverlap must be smaller than chunkSize');
    }
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.separators = separators ?? DEFAULT_SEPARATORS;
  }

  async splitText(text: string): Promise<string[]> {
    return this.split(text, this.separators);
  }

  private split(text: string, separators: string[]): string[] {
    const at = separators.findIndex(
      candidate => candidate === '' || text.includes(candidate),
    );
    const separator = separators[at] ?? '';
    const finer = separators.slice(at + 1);
    const pieces = (separator ? text.split(separator) : [...text]).filter(
      piece => piece !== '',
    );

    const chunks: string[] = [];
    let fitting: string[] = [];

    for (const piece of pieces) {
      if (piece.length < this.chunkSize) {
        fitting.push(piece);
        continue;
      }
      if (fitting.length > 0) {
        chunks.push(...this.merge(fitting, separator));
        fitting = [];
      }
      if (finer.length === 0) {
        chunks.push(piece);
      } else {
        chunks.push(...this.split(piece, finer));
      }
    }

    if (fitting.length > 0) {
      chunks.push(...this.merge(fitting, separator));
    }
    return chunks;
  }

  private merge(pieces: string[], separator: string): string[] {
    const chunks: string[] = [];
    let current: string[] = [];
    let length = 0;

    const joined = () => current.join(separator).trim();

    for (const piece of pieces) {
      const added = piece.length + (current.length > 0 ? separator.length : 0);

      if (length + added > this.chunkSize && current.length > 0) {
        const chunk = joined();
        if (chunk) {
          chunks.push(chunk);
        }
        while (
          current.length > 0 &&
          (length > this.chunkOverlap ||
            (length + added > this.chunkSize && length > 0))
        ) {
          length -=
            current[0]!.length + (current.length > 1 ? separator.length : 0);
          current = current.slice(1);
        }
      }

      current.push(piece);
      length += piece.length + (current.length > 1 ? separator.length : 0);
    }

    const last = joined();
    if (last) {
      chunks.push(last);
    }
    return chunks;
  }
}
