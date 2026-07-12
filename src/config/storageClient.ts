import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generic storage adapter — mirrors NodeAdmin's design so that switching
 * STORAGE_DRIVER between `local`, `oss`, and `s3` is a pure `.env` change with
 * no code/view edits. The DB stores the object **key**; the render URL is built
 * at request time (see StorageService).
 *
 * Config-level file (like ormconfig.ts) — reading process.env here is allowed;
 * the `modules/` layer never touches process.env.
 */

export interface StorageClient {
  put(key: string, buffer: Buffer): Promise<void>;
  signatureUrl(key: string, ttlSeconds: number): string;
  list(prefix: string, maxKeys: number): Promise<Array<{ name: string }>>;
  delete(key: string): Promise<void>;
}

export interface StorageConfig {
  driver: 'local' | 'oss' | 's3';
  basePath: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
  region: string;
  ssl: boolean;
}

function envBool(v: string | undefined, def: boolean): boolean {
  if (v === undefined || v === '') return def;
  return v === 'true' || v === '1';
}

/** Snapshot of STORAGE_* env — read lazily on first access. */
export const storageConfig: StorageConfig = {
  driver: (process.env.STORAGE_DRIVER as StorageConfig['driver']) || 'local',
  basePath: process.env.STORAGE_BASE_PATH || 'public/storage',
  accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
  endpoint: process.env.STORAGE_ENDPOINT || '',
  bucket: process.env.STORAGE_BUCKET || '',
  region: process.env.STORAGE_REGION || '',
  ssl: envBool(process.env.STORAGE_SSL, true),
};

// ---------------------------------------------------------------------------
// AWS Signature V4 presigned URL — synchronous, no extra deps.
// Keeps the StorageClient interface sync (compatible with EJS render).
// ---------------------------------------------------------------------------
function s3PresignedUrl(opts: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint: string | undefined;
  ssl: boolean;
  key: string;
  ttlSeconds: number;
}): string {
  const {
    accessKeyId,
    secretAccessKey,
    region,
    bucket,
    endpoint,
    ssl,
    key,
    ttlSeconds,
  } = opts;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate(),
  )}`;
  const datetimeStr = `${dateStr}T${pad(now.getUTCHours())}${pad(
    now.getUTCMinutes(),
  )}${pad(now.getUTCSeconds())}Z`;

  // path-style when endpoint is set (MinIO, R2, OSS-S3-compat, etc.)
  const pathStyle = !!endpoint;
  const host = pathStyle
    ? endpoint.replace(/^https?:\/\//, '')
    : `${bucket}.s3.${region}.amazonaws.com`;
  const canonicalUri = pathStyle ? `/${bucket}/${key}` : `/${key}`;

  const credScope = `${dateStr}/${region}/s3/aws4_request`;
  const qp: [string, string][] = (
    [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${accessKeyId}/${credScope}`],
      ['X-Amz-Date', datetimeStr],
      ['X-Amz-Expires', String(ttlSeconds)],
      ['X-Amz-SignedHeaders', 'host'],
    ] as [string, string][]
  ).sort(([a], [b]) => a.localeCompare(b));

  const canonicalQS = qp
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Encode each path segment, keep '/' as separator
  const encodedUri = canonicalUri.split('/').map(encodeURIComponent).join('/');

  const canonicalRequest = [
    'GET',
    encodedUri,
    canonicalQS,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const reqHash = crypto
    .createHash('sha256')
    .update(canonicalRequest)
    .digest('hex');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetimeStr,
    credScope,
    reqHash,
  ].join('\n');

  const hmac = (k: Buffer | string, d: string) =>
    crypto.createHmac('sha256', k).update(d).digest();
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStr), region), 's3'),
    'aws4_request',
  );
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  const protocol = ssl ? 'https' : 'http';
  return `${protocol}://${host}${canonicalUri}?${canonicalQS}&X-Amz-Signature=${signature}`;
}

// ---------------------------------------------------------------------------
// Local filesystem storage: URL prefix is stable and decoupled from the fs
// path. main.ts mounts localStorageDir() at this prefix so files render.
// ---------------------------------------------------------------------------
export const LOCAL_URL_PREFIX = '/storage';

/** Absolute directory of local storage (resolves STORAGE_BASE_PATH). */
export function localStorageDir(): string {
  const bp = storageConfig.basePath;
  return path.isAbsolute(bp) ? bp : path.join(process.cwd(), bp);
}

function buildLocalClient(basePath: string): StorageClient {
  const absBase = path.isAbsolute(basePath)
    ? basePath
    : path.join(process.cwd(), basePath);

  return {
    async put(key, buffer) {
      const dest = path.join(absBase, key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buffer);
    },
    signatureUrl(key) {
      // Web URL under the static prefix mounted in main.ts (LOCAL_URL_PREFIX)
      return `${LOCAL_URL_PREFIX}/${key}`.replace(/\/+/g, '/');
    },
    async list(prefix) {
      const dir = path.join(absBase, prefix);
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => !fs.statSync(path.join(dir, f)).isDirectory())
        .map((f) => ({ name: `${prefix}/${f}`.replace(/\/+/g, '/') }));
    },
    async delete(key) {
      const dest = path.join(absBase, key);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    },
  };
}

// ---------------------------------------------------------------------------
// Alibaba Cloud OSS (via ali-oss SDK — optional peer dep, loaded lazily)
// ---------------------------------------------------------------------------
function buildOssClient(): StorageClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OSS = require('ali-oss');
  const { accessKeyId, secretAccessKey, endpoint, bucket, ssl } = storageConfig;
  const client = new OSS({
    accessKeyId,
    accessKeySecret: secretAccessKey,
    endpoint,
    bucket,
    secure: ssl,
  });

  return {
    async put(key, buffer) {
      await client.put(key, buffer);
    },
    signatureUrl(key, ttlSeconds) {
      return client.signatureUrl(key, { expires: ttlSeconds });
    },
    async list(prefix, maxKeys) {
      const res = await client.list({ prefix, 'max-keys': maxKeys }, {});
      return (res?.objects || [])
        .filter(
          (o: any) => o.name && o.name !== prefix && !o.name.endsWith('/'),
        )
        .map((o: any) => ({ name: o.name }));
    },
    async delete(key) {
      await client.delete(key);
    },
  };
}

// ---------------------------------------------------------------------------
// AWS S3 / S3-compatible (MinIO, Cloudflare R2, Backblaze B2, …)
// ---------------------------------------------------------------------------
function buildS3Client(): StorageClient {
  const {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    DeleteObjectCommand,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require('@aws-sdk/client-s3');
  const { accessKeyId, secretAccessKey, endpoint, bucket, region, ssl } =
    storageConfig;

  const clientCfg: any = {
    region: region || 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
  };
  if (endpoint) {
    const proto = ssl ? 'https' : 'http';
    clientCfg.endpoint = endpoint.startsWith('http')
      ? endpoint
      : `${proto}://${endpoint}`;
    clientCfg.forcePathStyle = true;
  }
  const s3 = new S3Client(clientCfg);

  return {
    async put(key, buffer) {
      await s3.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer }),
      );
    },
    signatureUrl(key, ttlSeconds) {
      return s3PresignedUrl({
        accessKeyId,
        secretAccessKey,
        region: region || 'us-east-1',
        bucket,
        endpoint,
        ssl,
        key,
        ttlSeconds,
      });
    },
    async list(prefix, maxKeys) {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: maxKeys,
        }),
      );
      return (res?.Contents || [])
        .filter((o: any) => o.Key && o.Key !== prefix && !o.Key.endsWith('/'))
        .map((o: any) => ({ name: o.Key }));
    },
    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

// ---------------------------------------------------------------------------
// Signed/render URL — sync, and SDK-free for `local` and `s3`. Only `oss`
// render needs the ali-oss SDK (its signing is bespoke). Keeping S3 signing
// SDK-free means the render path works with just a `.env` switch; the S3/OSS
// SDKs are only required for the write path (put/list/delete).
// ---------------------------------------------------------------------------
export function buildSignedUrl(key: string, ttlSeconds: number): string {
  const {
    driver,
    accessKeyId,
    secretAccessKey,
    region,
    bucket,
    endpoint,
    ssl,
  } = storageConfig;
  if (driver === 'local') {
    return `${LOCAL_URL_PREFIX}/${key}`.replace(/\/+/g, '/');
  }
  if (driver === 's3') {
    return s3PresignedUrl({
      accessKeyId,
      secretAccessKey,
      region: region || 'us-east-1',
      bucket,
      endpoint,
      ssl,
      key,
      ttlSeconds,
    });
  }
  // oss → delegate to the SDK-backed client
  return getStorageClient().signatureUrl(key, ttlSeconds);
}

// ---------------------------------------------------------------------------
// Lazy singleton — client built on first use, not at import time.
// ---------------------------------------------------------------------------
let _client: StorageClient | null = null;

export function getStorageClient(): StorageClient {
  if (!_client) {
    const { driver, basePath, accessKeyId, secretAccessKey } = storageConfig;
    if (driver === 'local') {
      _client = buildLocalClient(basePath);
    } else {
      if (!accessKeyId || !secretAccessKey) {
        throw new Error(
          'Storage not configured (STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY empty)',
        );
      }
      _client = driver === 's3' ? buildS3Client() : buildOssClient();
    }
  }
  return _client;
}

/** Reset the cached client (tests only). */
export function resetStorageClient(): void {
  _client = null;
}
