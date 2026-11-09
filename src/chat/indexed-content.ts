export type IndexedContent = {
  sourceHash: string;
  fileHash?: string;
  type?: 'pdf' | 'xlsx' | 'image';
  pages: string[];
  methods?: string[];
  confidence?: number[];
  labels?: string[];
  aliases?: string[];
  names?: string[];
  reviewedFields?: string[];
};
