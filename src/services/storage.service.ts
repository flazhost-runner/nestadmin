import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  getStorageClient,
  buildSignedUrl,
  storageConfig,
  LOCAL_URL_PREFIX,
} from '../config/storageClient';

/** Bentuk minimal file multer (memoryStorage) yang dibutuhkan saveUpload. */
export interface UploadedFileLike {
  originalname?: string;
  buffer?: Buffer;
}

/**
 * StorageService — single injectable facade over the storage adapter.
 *
 * The DB stores object **keys** (e.g. `editor/uuid.png`); the render URL is
 * built here at request time so switching STORAGE_DRIVER between `local`,
 * `oss`, and `s3` is a pure `.env` change:
 *  - local   → `/storage/<key>` (served by the static mount in main.ts)
 *  - oss/s3  → absolute presigned URL (TTL)
 */
@Injectable()
export class StorageService {
  /** Default TTL for presigned URLs (6 hours). */
  private static readonly DEFAULT_TTL = 3600 * 6;

  /**
   * Avatar placeholder — a static public asset, independent of the storage
   * driver. Views pass this key when a user has no picture; routing it through
   * the driver would 404 on both local and oss. Mirrors NodeAdmin.
   */
  private static readonly DEFAULT_AVATAR_KEY = 'modules/access/user/user.png';
  private static readonly DEFAULT_AVATAR_URL =
    '/be/default/vendor/fontawesome-free/svgs/solid/user.svg';

  private isRemoteUnconfigured(): boolean {
    return (
      storageConfig.driver !== 'local' &&
      (!storageConfig.accessKeyId || !storageConfig.secretAccessKey)
    );
  }

  /** Persist a buffer under `key`. Returns the key (stored in the DB). */
  async uploadFile(key: string, buffer: Buffer): Promise<string> {
    await getStorageClient().put(key, buffer);
    return key;
  }

  /**
   * Simpan satu file upload multer (memoryStorage) ke storage, kembalikan
   * object key untuk disimpan di DB — atau null kalau tidak ada file.
   *
   * Key: `<keyPrefix>/<uuid><ext>` (ekstensi dari originalname, default .png).
   * Jalan di semua STORAGE_DRIVER karena delegasi ke uploadFile → adapter.
   * Titik upload tunggal untuk profile/user/setting supaya konsisten.
   */
  async saveUpload(
    file: UploadedFileLike | undefined,
    keyPrefix: string,
  ): Promise<string | null> {
    if (!file?.buffer) return null;
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const key = `${keyPrefix.replace(/\/+$/, '')}/${crypto.randomUUID()}${ext}`;
    await this.uploadFile(key, file.buffer);
    return key;
  }

  /**
   * Build the render URL for a stored key.
   *  - empty            → '' (caller supplies its own default/placeholder)
   *  - absolute URL     → returned unchanged (http/https)
   *  - already a path   → returned unchanged (leading `/`, e.g. static asset)
   *  - local driver     → `/storage/<key>`
   *  - oss/s3 driver    → presigned URL (or bare `/key` if unconfigured)
   */
  getFile(key: string, isPublic = false): string {
    if (!key) return '';
    if (key === StorageService.DEFAULT_AVATAR_KEY) {
      return StorageService.DEFAULT_AVATAR_URL;
    }
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    if (key.startsWith('/')) return key;
    if (this.isRemoteUnconfigured()) return `/${key}`;
    if (isPublic) return this.publicUrl(key);
    return buildSignedUrl(key, StorageService.DEFAULT_TTL);
  }

  /** Presigned URL with a custom TTL. */
  getSignedUrl(key: string, ttlSeconds = 600): string {
    if (this.isRemoteUnconfigured()) {
      return key.startsWith('/') ? key : `/${key}`;
    }
    return buildSignedUrl(key, ttlSeconds);
  }

  /** List objects under `prefix` with their render URLs. */
  async listFiles(
    prefix: string,
    urlFor?: (key: string) => string,
  ): Promise<Array<{ name: string; url: string }>> {
    if (this.isRemoteUnconfigured()) return [];
    const objects = await getStorageClient().list(prefix, 100);
    return objects.map((o) => ({
      name: o.name,
      url: urlFor ? urlFor(o.name) : this.getFile(o.name),
    }));
  }

  /** Delete an object by key. */
  async deleteFile(key: string): Promise<void> {
    await getStorageClient().delete(key);
  }

  /** Driver-aware public (non-signed) URL. */
  private publicUrl(key: string): string {
    const { driver, bucket, endpoint, region, ssl } = storageConfig;
    const protocol = ssl ? 'https' : 'http';
    if (driver === 'local') {
      return `${LOCAL_URL_PREFIX}/${key}`.replace(/\/+/g, '/');
    }
    if (driver === 's3') {
      if (endpoint) {
        const host = endpoint.replace(/^https?:\/\//, '');
        return `${protocol}://${host}/${bucket}/${key}`;
      }
      return `${protocol}://${bucket}.s3.${region || 'us-east-1'}.amazonaws.com/${key}`;
    }
    // OSS virtual-hosted: bucket.endpoint/key
    return `${protocol}://${bucket}.${endpoint}/${key}`;
  }
}
