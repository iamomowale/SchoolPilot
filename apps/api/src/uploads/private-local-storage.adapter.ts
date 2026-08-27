import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ObjectStorageAdapter } from './object-storage.types';

@Injectable()
export class PrivateLocalStorageAdapter implements ObjectStorageAdapter {
  async put(key: string, content: Buffer) {
    const path = this.pathFor(key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, content, { mode: 0o600 });
  }

  get(key: string) { return readFile(this.pathFor(key)); }

  async delete(key: string) {
    try { await unlink(this.pathFor(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }

  createSignedDownloadUrl(key: string, expiresInSeconds: number) {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const id = key.split('/').at(-1)?.replace(/\.[a-z0-9]+$/i, '');
    if (!id) throw new ForbiddenException('Invalid storage key');
    const signature = this.signature(key, String(expires));
    return `${process.env.UPLOAD_SIGNED_URL_BASE || `http://localhost:${process.env.API_PORT || '4000'}/uploads/signed`}/${encodeURIComponent(id)}?expires=${expires}&signature=${signature}`;
  }

  verifySignedDownloadUrl(key: string, expires: string, signature: string) {
    const expiry = Number(expires);
    if (!Number.isInteger(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
    const expected = this.signature(key, expires);
    const provided = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
  }

  private storageRoot() { return resolve(process.env.UPLOAD_STORAGE_DIR || join(process.cwd(), 'storage', 'uploads')); }
  private pathFor(key: string) { const root = this.storageRoot(); const path = resolve(root, key); if (!path.startsWith(`${root}/`)) throw new ForbiddenException('Invalid storage key'); return path; }
  private signature(key: string, expires: string) { const secret = process.env.UPLOAD_SIGNING_SECRET; if (!secret) throw new Error('UPLOAD_SIGNING_SECRET must be configured'); return createHmac('sha256', secret).update(`${key}:${expires}`).digest('hex'); }
}
