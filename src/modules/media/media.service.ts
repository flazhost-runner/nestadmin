import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AppError } from '../../errors/AppError';
import { StorageService } from '../../services/storage.service';
import { localStorageDir } from '../../config/storageClient';

/**
 * Key prefix (under STORAGE_BASE_PATH / bucket) for Trumbowyg editor uploads.
 * All storage I/O goes through StorageService, so switching STORAGE_DRIVER
 * between local/oss/s3 is a pure `.env` change — no edits here.
 */
const STORAGE_PREFIX = 'editor';

/** Max upload size: 5 MB. */
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Magic byte signatures for allowed file types.
 * Each entry: [offset, hex_bytes].
 */
const MAGIC: Record<string, Array<[number, string]>> = {
  'image/jpeg': [[0, 'ffd8ff']],
  'image/png': [[0, '89504e47']],
  'image/gif': [[0, '47494638']],
  'image/webp': [
    [0, '52494646'],
    [8, '57454250'],
  ],
  'image/svg+xml': [], // SVG can't be validated via magic byte; see security note
  'application/pdf': [[0, '25504446']],
};

export interface MediaFile {
  name: string;
  url: string;
  size: number;
  mtime: Date;
}

@Injectable()
export class MediaService {
  constructor(private readonly storage: StorageService) {}

  /** Validate magic bytes of a buffer against the claimed mimeType. */
  private validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const checks = MAGIC[mimeType];
    if (!checks) return false;
    if (checks.length === 0) return true;
    return checks.every(([offset, hex]) => {
      const slice = buffer
        .slice(offset, offset + hex.length / 2)
        .toString('hex');
      return slice === hex;
    });
  }

  /**
   * Best-effort local file stats (size/mtime). Returns null for remote drivers
   * or missing files — the object key still resolves via the storage adapter.
   */
  private localStat(key: string): { size: number; mtime: Date } | null {
    try {
      const st = fs.statSync(path.join(localStorageDir(), key));
      return { size: st.size, mtime: st.mtime };
    } catch {
      return null;
    }
  }

  /** List all uploaded editor files (driver-aware URLs). */
  public async list(): Promise<MediaFile[]> {
    const entries = await this.storage.listFiles(STORAGE_PREFIX);
    return entries
      .map((e) => {
        const stat = this.localStat(e.name);
        return {
          name: path.basename(e.name),
          url: e.url,
          size: stat?.size ?? 0,
          mtime: stat?.mtime ?? new Date(0),
        };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  }

  /**
   * Upload a file. Validation:
   * 1. Max size 5 MB
   * 2. MimeType must be an allowed image/PDF
   * 3. Magic bytes must match
   */
  public async upload(
    originalname: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<MediaFile> {
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new AppError(
        `Ukuran file melebihi batas ${MAX_SIZE_BYTES / 1024 / 1024} MB`,
        400,
      );
    }

    const allowedMimes = Object.keys(MAGIC);
    if (!allowedMimes.includes(mimetype)) {
      throw new AppError('Tipe file tidak diizinkan', 400);
    }

    // SVG blocked per security policy (XSS risk)
    if (mimetype === 'image/svg+xml') {
      throw new AppError('SVG tidak diizinkan karena risiko XSS', 400);
    }
    if (!this.validateMagicBytes(buffer, mimetype)) {
      throw new AppError('File tidak sesuai tipe yang diklaim', 400);
    }

    // Safe file name: uuid + extension from mimetype
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    const ext =
      extMap[mimetype] || path.extname(originalname).toLowerCase() || '.bin';
    const safeName = `${crypto.randomUUID()}${ext}`;
    const key = `${STORAGE_PREFIX}/${safeName}`;

    await this.storage.uploadFile(key, buffer);

    const stat = this.localStat(key);
    return {
      name: safeName,
      url: this.storage.getFile(key),
      size: stat?.size ?? buffer.length,
      mtime: stat?.mtime ?? new Date(),
    };
  }

  /**
   * Delete a file by key (basename only — anti path-traversal).
   * `key` may be a bare file name or a full URL `/storage/editor/xxx.jpg`.
   */
  public async delete(key: string): Promise<void> {
    const basename = path.basename(key);

    if (
      !basename ||
      basename === '.' ||
      basename === '..' ||
      basename.includes('/')
    ) {
      throw new AppError('Key file tidak valid', 400);
    }

    await this.storage.deleteFile(`${STORAGE_PREFIX}/${basename}`);
  }
}
