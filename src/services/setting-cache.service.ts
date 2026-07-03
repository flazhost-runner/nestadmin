import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../modules/setting/models/setting.entity';

const CACHE_TTL_MS = 60_000; // 60 seconds

@Injectable()
export class SettingCacheService {
  private cache: Setting | null = null;
  private expiresAt = 0;

  constructor(@InjectRepository(Setting) private repo: Repository<Setting>) {}

  async get(): Promise<Setting | null> {
    if (this.cache && Date.now() < this.expiresAt) return this.cache;
    try {
      this.cache = (await this.repo.findOne({ where: {} })) ?? null;
      this.expiresAt = Date.now() + CACHE_TTL_MS;
    } catch {
      // DB might not be ready yet; return stale cache or null
    }
    return this.cache;
  }

  invalidate(): void {
    this.cache = null;
    this.expiresAt = 0;
  }
}
