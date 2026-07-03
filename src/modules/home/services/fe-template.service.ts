import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppError } from '../../../errors/AppError';
import { SettingCacheService } from '../../../services/setting-cache.service';
import {
  FE_TEMPLATE_BASE_URL,
  FE_TEMPLATE_DIR,
  FE_TEMPLATE_SLUG_RE,
  DEFAULT_FE_TEMPLATE,
} from '../../../config/fe-templates';
import { IFeTemplateService } from './interfaces/IFeTemplateService';

@Injectable()
export class FeTemplateService implements IFeTemplateService {
  constructor(private settingCache: SettingCacheService) {}

  private dir(): string {
    return path.resolve(process.cwd(), FE_TEMPLATE_DIR);
  }

  private file(slug: string): string {
    return path.join(this.dir(), `${slug}.html`);
  }

  public isCached(slug: string): boolean {
    return fs.existsSync(this.file(slug));
  }

  /**
   * Slug dianggap valid bila cocok pola opentailwind `{kategori}-{NNN}-{nama}`.
   * Mencakup seluruh 640 landing tanpa mengikat ke katalog kurasi statis.
   * (Anti-SSRF: pola membatasi ke charset a-z0-9- + struktur tetap.)
   */
  private isValidSlug(slug: string): boolean {
    return slug === DEFAULT_FE_TEMPLATE || FE_TEMPLATE_SLUG_RE.test(slug);
  }

  /** Slug template aktif dari setting (fallback default). */
  public async getActiveSlug(): Promise<string> {
    const setting = await this.settingCache.get();
    return setting?.fe_template && this.isValidSlug(setting.fe_template)
      ? setting.fe_template
      : DEFAULT_FE_TEMPLATE;
  }

  /**
   * True bila slug = default → dirender via layout EJS (fe/default), bukan raw
   * HTML. Template non-default tetap raw HTML (getActiveHtml).
   */
  public isDefaultEjs(slug: string): boolean {
    return slug === DEFAULT_FE_TEMPLATE;
  }

  /**
   * Pastikan template tersedia lokal. Bila belum → download HTML dari
   * opentailwind (GitHub raw) lalu simpan ke folder cache. Hanya slug yang
   * cocok pola opentailwind yang diizinkan (anti SSRF/arbitrary fetch).
   */
  public async ensure(slug: string): Promise<void> {
    if (!this.isValidSlug(slug)) {
      throw new AppError('Template tidak dikenali', 400);
    }
    if (this.isCached(slug)) return;

    const url = `${FE_TEMPLATE_BASE_URL}/${slug}.html`;
    let html: string;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e: any) {
      throw new AppError(`Gagal mengunduh template: ${e.message}`, 502);
    }
    if (!/<\/html>/i.test(html)) {
      throw new AppError('Template terunduh tidak valid', 502);
    }
    fs.mkdirSync(this.dir(), { recursive: true });
    fs.writeFileSync(this.file(slug), html);
  }

  /**
   * HTML landing aktif. Pakai setting.fe_template; bila file tak ada (mis.
   * baru di-set tapi belum sempat download / dev), fallback ke default bundled.
   */
  public async getActiveHtml(): Promise<string> {
    const setting = await this.settingCache.get();
    const slug =
      setting?.fe_template && this.isValidSlug(setting.fe_template)
        ? setting.fe_template
        : DEFAULT_FE_TEMPLATE;

    const target = this.isCached(slug) ? slug : DEFAULT_FE_TEMPLATE;
    const filePath = this.file(target);
    if (!fs.existsSync(filePath)) {
      return (
        '<!doctype html><meta charset="utf-8"><title>Landing</title>' +
        '<body style="font-family:sans-serif;padding:40px">' +
        '<h1>Template frontend belum tersedia.</h1>' +
        '<p>Atur di Setting &rarr; Frontend Template.</p></body>'
      );
    }
    return fs.readFileSync(filePath, 'utf8');
  }
}
