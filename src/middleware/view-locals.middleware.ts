import { Injectable, NestMiddleware, Optional, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { routeRegistry } from '../utils/named-routes';
import { SettingCacheService } from '../services/setting-cache.service';
import { StorageService } from '../services/storage.service';
import { getTheme } from '../config/themes';

@Injectable()
export class ViewLocalsMiddleware implements NestMiddleware {
  constructor(
    @Optional()
    @Inject(SettingCacheService)
    private settingCache?: SettingCacheService,
    @Optional()
    @Inject(StorageService)
    private storage?: StorageService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // route(name, params?) → URL string
    res.locals.route = (
      name: string,
      params: Record<string, string | number> = {},
    ) => {
      const entry = routeRegistry.getAll().find((r) => r.name === name);
      if (!entry) return '#';
      let path = entry.path;
      for (const [k, v] of Object.entries(params)) {
        path = path.replace(`:${k}`, encodeURIComponent(String(v)));
      }
      return path;
    };

    // addOrUpdateQueryParam(url, key, value) → updated URL string
    res.locals.addOrUpdateQueryParam = (
      url: string,
      key: string,
      value: any,
    ) => {
      try {
        const base = url.startsWith('http') ? url : 'http://localhost' + url;
        const u = new URL(base);
        u.searchParams.set(key, String(value));
        return u.pathname + (u.search || '');
      } catch {
        return url;
      }
    };

    // getFile(key) → render URL for a stored object key.
    // Driver-aware via StorageService: local → /storage/<key>, oss/s3 → presigned.
    // Empty → default avatar; absolute URL/path → passthrough unchanged.
    res.locals.getFile = (filePath: string) => {
      const key = filePath || 'modules/access/user/user.png';
      if (key.startsWith('http')) return key;
      if (key.startsWith('/')) return key;
      return this.storage ? this.storage.getFile(key) : '/' + key;
    };

    // fullUrl — current full URL including query string
    res.locals.fullUrl =
      req.protocol + '://' + req.get('host') + req.originalUrl;

    // Validation errors from session
    const errors: Record<string, any> = (req.session as any)?.errors || {};
    res.locals.getError = (field: string) => errors[field] || null;

    // Old input from session
    const old: Record<string, any> = (req.session as any)?.old || {};
    res.locals.getOld = (field: string) => {
      const v = old[field];
      return v !== undefined && v !== null ? v : '';
    };

    // Flash messages (connect-flash)
    const flashData: Record<string, string[]> = (req as any).flash?.() || {};
    res.locals.flash = flashData;
    // flashMessage → { key, message } for Toast in main.ejs
    const flashKeys = Object.keys(flashData);
    if (flashKeys.length > 0) {
      const key = flashKeys[0];
      const message = flashData[key]?.[0];
      if (message) res.locals.flashMessage = { key, message };
    }

    // Authenticated user (web session) — exposed as both auth and authUser
    const user = (req.session as any)?.user || null;
    res.locals.auth = user;
    res.locals.authUser = user;

    // hasAccess(routeName, method) → boolean — RBAC check from session permissions
    res.locals.hasAccess = (routeName: string, method: string): boolean => {
      if (!user) return false;
      const roles: Array<{ name: string }> = user.roles || [];
      if (roles.some((r) => r.name === 'Administrator')) return true;
      const perms: Array<{ name: string; method: string }> =
        user.permissions || [];
      return perms.some(
        (p) =>
          p.name === routeName &&
          p.method?.toUpperCase() === method.toUpperCase(),
      );
    };

    // hasRole(roleName) → boolean
    res.locals.hasRole = (roleName: string): boolean => {
      if (!user) return false;
      const roles: Array<{ name: string }> = user.roles || [];
      return roles.some((r) => r.name === roleName);
    };

    // Setting singleton (cached 60 s) + derived theme
    let setting: any = null;
    let themeName = 'Blue';
    if (this.settingCache) {
      try {
        setting = await this.settingCache.get();
        if (setting?.theme) themeName = setting.theme;
      } catch {
        /* DB not ready — use defaults */
      }
    }
    const theme = getTheme(themeName);
    res.locals.setting = setting;
    res.locals.theme = theme;
    res.locals.themeName = themeName;

    // now(format) date helper — used in dashboard view
    res.locals.now = (format: string): string => {
      const d = new Date();
      const pad = (n: number, w = 2) => String(n).padStart(w, '0');
      return format
        .replace('YYYY', String(d.getFullYear()))
        .replace('MM', pad(d.getMonth() + 1))
        .replace('DD', pad(d.getDate()))
        .replace('HH', pad(d.getHours()))
        .replace('mm', pad(d.getMinutes()))
        .replace('ss', pad(d.getSeconds()));
    };

    // csrfToken (if csurf middleware is active)
    try {
      res.locals.csrfToken = (req as any).csrfToken?.();
    } catch {
      /* csurf not active */
    }

    next();
  }
}
