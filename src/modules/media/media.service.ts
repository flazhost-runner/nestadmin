import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AppError } from '../../errors/AppError';

/** Direktori penyimpanan file yang di-upload via Trumbowyg filemanager. */
const STORAGE_DIR = 'public/storage/editor';

/** URL publik prefix (served via staticAssets). */
const PUBLIC_URL_PREFIX = '/storage/editor';

/** Ukuran maks upload: 5 MB. */
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Magic byte signatures untuk tipe file yang diizinkan.
 * Tiap entry: [offset, hex_bytes].
 */
const MAGIC: Record<string, Array<[number, string]>> = {
  'image/jpeg': [[0, 'ffd8ff']],
  'image/png': [[0, '89504e47']],
  'image/gif': [[0, '47494638']],
  'image/webp': [
    [0, '52494646'],
    [8, '57454250'],
  ],
  'image/svg+xml': [], // SVG tidak bisa divalidasi via magic byte; lihat catatan keamanan
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
  private storageDir(): string {
    return path.resolve(process.cwd(), STORAGE_DIR);
  }

  /** Pastikan direktori storage ada. */
  private ensureDir(): void {
    fs.mkdirSync(this.storageDir(), { recursive: true });
  }

  /** Validasi magic byte buffer terhadap mimeType yang diizinkan. */
  private validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const checks = MAGIC[mimeType];
    if (!checks) return false;
    // SVG: skip magic check, tapi tipe ini diblok di atas level caller bila perlu
    if (checks.length === 0) return true;
    return checks.every(([offset, hex]) => {
      const slice = buffer
        .slice(offset, offset + hex.length / 2)
        .toString('hex');
      return slice === hex;
    });
  }

  /** Daftar semua file yang ada di storage/editor. */
  public list(): MediaFile[] {
    this.ensureDir();
    const dir = this.storageDir();
    try {
      return fs
        .readdirSync(dir)
        .filter((name) => !name.startsWith('.'))
        .map((name) => {
          const fullPath = path.join(dir, name);
          const stat = fs.statSync(fullPath);
          return {
            name,
            url: `${PUBLIC_URL_PREFIX}/${name}`,
            size: stat.size,
            mtime: stat.mtime,
          };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    } catch {
      return [];
    }
  }

  /**
   * Upload file. Validasi:
   * 1. Ukuran maks 5 MB
   * 2. MimeType hanya gambar/PDF
   * 3. Magic byte sesuai
   */
  public upload(
    originalname: string,
    buffer: Buffer,
    mimetype: string,
  ): MediaFile {
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

    // Validasi magic bytes (skip SVG — diblok per policy keamanan)
    if (mimetype === 'image/svg+xml') {
      throw new AppError('SVG tidak diizinkan karena risiko XSS', 400);
    }
    if (!this.validateMagicBytes(buffer, mimetype)) {
      throw new AppError('File tidak sesuai tipe yang diklaim', 400);
    }

    // Buat nama file aman: uuid + ekstensi dari mimetype
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

    this.ensureDir();
    const dest = path.join(this.storageDir(), safeName);
    fs.writeFileSync(dest, buffer);

    const stat = fs.statSync(dest);
    return {
      name: safeName,
      url: `${PUBLIC_URL_PREFIX}/${safeName}`,
      size: stat.size,
      mtime: stat.mtime,
    };
  }

  /**
   * Hapus file berdasarkan key (basename saja — anti path-traversal).
   * key boleh berupa nama file atau URL penuh `/storage/editor/xxx.jpg`.
   */
  public delete(key: string): void {
    // Normalisasi: ambil basename dari URL/path apa pun.
    const basename = path.basename(key);

    // Reject bila basename kosong atau mengandung karakter berbahaya.
    if (
      !basename ||
      basename === '.' ||
      basename === '..' ||
      basename.includes('/')
    ) {
      throw new AppError('Key file tidak valid', 400);
    }

    const target = path.join(this.storageDir(), basename);

    // Pastikan target masih di dalam storageDir (defense-in-depth).
    const resolved = path.resolve(target);
    const storeResolved = path.resolve(this.storageDir());
    if (!resolved.startsWith(storeResolved + path.sep)) {
      throw new AppError('Akses file di luar direktori tidak diizinkan', 400);
    }

    if (!fs.existsSync(target)) {
      throw new AppError('File tidak ditemukan', 404);
    }

    fs.unlinkSync(target);
  }
}
