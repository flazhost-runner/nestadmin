import session from 'express-session';
import { DataSource } from 'typeorm';
import { AppSession } from '../modules/auth/models/session.entity';

class TypeOrmSessionStore extends session.Store {
  constructor(
    private ds: DataSource,
    private ttlMs: number,
  ) {
    super();
  }

  get(
    sid: string,
    callback: (err: any, session?: session.SessionData | null) => void,
  ): void {
    this.ds
      .getRepository(AppSession)
      .findOne({ where: { id: sid } })
      .then((row) => {
        if (!row || row.expiresAt < new Date()) return callback(null, null);
        callback(null, JSON.parse(row.data));
      })
      .catch(callback);
  }

  set(
    sid: string,
    sessionData: session.SessionData,
    callback?: (err?: any) => void,
  ): void {
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const repo = this.ds.getRepository(AppSession);
    repo
      .findOne({ where: { id: sid } })
      .then((existing) => {
        const row = existing ?? repo.create({ id: sid });
        row.data = JSON.stringify(sessionData);
        row.expiresAt = expiresAt;
        return repo.save(row);
      })
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    this.ds
      .getRepository(AppSession)
      .delete({ id: sid })
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  touch(
    sid: string,
    _sessionData: session.SessionData,
    callback?: () => void,
  ): void {
    const expiresAt = new Date(Date.now() + this.ttlMs);
    this.ds
      .getRepository(AppSession)
      .update({ id: sid }, { expiresAt })
      .then(() => callback?.())
      .catch(() => callback?.());
  }
}

export function buildSessionStore(opts: {
  driver: string;
  redisUrl: string;
  dataSource: DataSource;
  ttlMs: number;
  isTest: boolean;
}): session.Store | undefined {
  if (opts.isTest) return undefined;

  if (opts.driver === 'database') {
    return new TypeOrmSessionStore(opts.dataSource, opts.ttlMs);
  }

  // driver 'redis' (opsional) — lazy require agar dependency redis tidak wajib saat driver database
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { createClient } = require('redis');
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { RedisStore } = require('connect-redis');
    // TLS (rediss://) di belakang HAProxy butuh SNI servername = hostname URL,
    // kalau tidak koneksi ditutup (SocketClosedUnexpectedly). Plain redis:// tak terpengaruh.
    const isTls = opts.redisUrl.startsWith('rediss://');
    const socket = isTls
      ? { tls: true, servername: new URL(opts.redisUrl).hostname }
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const redisClient = createClient({ url: opts.redisUrl, socket });
    // Handler error wajib: error socket tanpa listener akan meng-crash proses.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    redisClient.on('error', () => {});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    redisClient.connect().catch(() => {});
    return new RedisStore({ client: redisClient });
  } catch {
    return undefined;
  }
}
