import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppError } from '../../../errors/AppError';
import {
  FE_TEMPLATE_BASE_URL,
  FE_TEMPLATE_TREE_URL,
  FE_TEMPLATE_CATALOG_FILE,
  FE_TEMPLATE_DIR,
  FE_TEMPLATES,
  deriveFeTemplate,
  FeTemplate,
} from '../../../config/fe-templates';
import {
  IFeCatalogService,
  PaginateResult,
} from './interfaces/IFeCatalogService';

/** TTL cache memori katalog (ms). Disk dipakai sebagai persist lintas-restart. */
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000; // 6 jam

/** Timeout fetch preview 1 file HTML (ms) — cukup ketat, file tunggal & ringan. */
const FETCH_TIMEOUT_MS = 8000;

/**
 * Timeout fetch tree katalog (ms) — lebih longgar dari preview: respons tree
 * recursive mencakup 640 entry (lebih besar) & hanya dijalankan SEKALI lalu
 * di-cache (memori+disk). Longgar agar blip jaringan tak men-degrade ke fallback
 * kurasi (15 item) yang membuat katalog tampak nyaris kosong.
 */
const TREE_FETCH_TIMEOUT_MS = 20000;

/**
 * Katalog template frontend (640 landing opentailwind). Sumber kebenaran =
 * GitHub tree API, di-fetch SEKALI lalu di-cache (memori + file disk) agar tak
 * membebani server/GitHub. Pencarian & paginasi diproses server-side di sini.
 */
@Injectable()
export class FeCatalogService implements IFeCatalogService {
  private memo: { at: number; data: FeTemplate[] } | null = null;

  private cacheFile(): string {
    return path.resolve(process.cwd(), FE_TEMPLATE_CATALOG_FILE);
  }

  /** Path HTML template yang sudah ter-download lokal (dipakai sbg fallback preview). */
  private localHtmlFile(slug: string): string {
    return path.resolve(process.cwd(), FE_TEMPLATE_DIR, `${slug}.html`);
  }

  /** fetch dgn timeout (AbortSignal) agar tak menggantung saat upstream lambat. */
  private async fetchWithTimeout(
    url: string,
    init?: RequestInit,
    timeoutMs: number = FETCH_TIMEOUT_MS,
  ): Promise<globalThis.Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }

  /** Parse path tree → slug landing (buang prefix `landings/` & `.html`). */
  private parseTree(tree: any[]): FeTemplate[] {
    const items = tree
      .filter(
        (n) =>
          n?.type === 'blob' &&
          typeof n.path === 'string' &&
          n.path.startsWith('landings/') &&
          n.path.endsWith('.html'),
      )
      .map((n) =>
        deriveFeTemplate(n.path.slice('landings/'.length, -'.html'.length)),
      );
    items.sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
    return items;
  }

  private readDiskCache(): FeTemplate[] | null {
    try {
      const raw = fs.readFileSync(this.cacheFile(), 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) && data.length > 0 ? data : null;
    } catch {
      return null;
    }
  }

  private writeDiskCache(data: FeTemplate[]): void {
    try {
      fs.mkdirSync(path.dirname(this.cacheFile()), { recursive: true });
      fs.writeFileSync(this.cacheFile(), JSON.stringify(data));
    } catch {
      // Cache disk best-effort — kegagalan tulis tak menggagalkan list().
    }
  }

  public async list(): Promise<FeTemplate[]> {
    if (this.memo && Date.now() - this.memo.at < CATALOG_TTL_MS) {
      return this.memo.data;
    }
    const disk = this.readDiskCache();
    if (disk) {
      this.memo = { at: Date.now(), data: disk };
      return disk;
    }
    // Belum ada cache → fetch GitHub tree sekali.
    try {
      const res = await this.fetchWithTimeout(
        FE_TEMPLATE_TREE_URL,
        { headers: { Accept: 'application/vnd.github+json' } },
        TREE_FETCH_TIMEOUT_MS,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: any = await res.json();
      const data = this.parseTree(body?.tree ?? []);
      if (data.length === 0) throw new Error('katalog kosong');
      this.memo = { at: Date.now(), data };
      this.writeDiskCache(data);
      return data;
    } catch (e) {
      // Fallback ke katalog kurasi agar UI tetap berfungsi offline.
      console.error(
        'Fetch katalog opentailwind gagal, pakai fallback kurasi:',
        e,
      );
      const fallback = [...FE_TEMPLATES];
      this.memo = { at: Date.now(), data: fallback };
      return fallback;
    }
  }

  public async categories(): Promise<string[]> {
    const all = await this.list();
    return [...new Set(all.map((t) => t.category))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  public async paginate(
    filter: Record<string, any>,
    pinSlug?: string,
  ): Promise<PaginateResult<FeTemplate>> {
    const all = await this.list();
    const qName = String(filter?.q_name ?? '')
      .trim()
      .toLowerCase();
    const qCategory = String(filter?.q_category ?? '').trim();

    const filtered = all.filter((t) => {
      const okName =
        !qName ||
        t.name.toLowerCase().includes(qName) ||
        t.slug.toLowerCase().includes(qName);
      const okCat = !qCategory || t.category === qCategory;
      return okName && okCat;
    });

    // Sematkan template aktif ke paling depan (bila lolos filter).
    if (pinSlug) {
      const i = filtered.findIndex((t) => t.slug === pinSlug);
      if (i > 0) filtered.unshift(filtered.splice(i, 1)[0]);
    }

    const pageSize = parseInt(filter?.q_page_size ?? 12) || 12;
    const page = parseInt(filter?.q_page ?? 1) || 1;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const datas = filtered.slice(start, start + pageSize);

    return {
      datas,
      paginate_data: {
        total_data: total,
        page_size: pageSize,
        current_page: page,
        total_page: Math.ceil(total / pageSize),
      },
    };
  }

  public async has(slug: string): Promise<boolean> {
    const all = await this.list();
    return all.some((t) => t.slug === slug);
  }

  /** Baca HTML template dari cache lokal bila ada & valid (fallback offline). */
  private readLocalHtml(slug: string): string | null {
    try {
      const html = fs.readFileSync(this.localHtmlFile(slug), 'utf8');
      return /<\/html>/i.test(html) ? html : null;
    } catch {
      return null;
    }
  }

  public async previewHtml(slug: string): Promise<string> {
    if (!(await this.has(slug))) {
      throw new AppError('Template tidak dikenali', 400);
    }

    // 1) Cache lokal lebih dulu — instan & tak bergantung jaringan/rate-limit.
    const local = this.readLocalHtml(slug);
    if (local) return local;

    // 2) Fetch upstream dengan timeout agar tak menggantung saat GitHub lambat.
    const url = `${FE_TEMPLATE_BASE_URL}/${slug}.html`;
    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (!/<\/html>/i.test(html)) throw new Error('HTML tidak valid');
      return html;
    } catch (e: any) {
      // 3) Fallback terakhir: cache lokal (jika sempat ter-download sebagian).
      const fallback = this.readLocalHtml(slug);
      if (fallback) return fallback;
      const reason = e?.name === 'TimeoutError' ? 'timeout' : e?.message;
      throw new AppError(`Gagal mengambil preview: ${reason}`, 502);
    }
  }
}
