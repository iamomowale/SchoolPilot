export interface ObjectStorageAdapter {
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  createSignedDownloadUrl(key: string, expiresInSeconds: number): string;
  verifySignedDownloadUrl(key: string, expires: string, signature: string): boolean;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
