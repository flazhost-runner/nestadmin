export interface RouteEntry {
  name: string;
  method: string;
  path: string;
  guardName: string;
}

class RouteRegistry {
  private routes: RouteEntry[] = [];

  register(name: string, method: string, path: string) {
    const guardName = name.startsWith('api.') ? 'api' : 'web';
    const existing = this.routes.find(
      (r) => r.name === name && r.method === method,
    );
    if (!existing) {
      this.routes.push({ name, method: method.toUpperCase(), path, guardName });
    }
  }

  getAll(): RouteEntry[] {
    return this.routes;
  }

  getByNameAndMethod(name: string, method: string): RouteEntry | undefined {
    return this.routes.find(
      (r) => r.name === name && r.method === method.toUpperCase(),
    );
  }

  // Reverse lookup: (method, path pattern) → route name
  getNameByPathAndMethod(path: string, method: string): string | undefined {
    // Normalize NestJS path params :param to Express-style :param
    const entry = this.routes.find((r) => {
      const rMethod = r.method.toUpperCase();
      if (rMethod !== method.toUpperCase()) return false;
      // Convert :param patterns for comparison
      const pattern = r.path.replace(/:([^/]+)/g, '[^/]+');
      const regex = new RegExp('^' + pattern + '$');
      return regex.test(path);
    });
    return entry?.name;
  }
}

export const routeRegistry = new RouteRegistry();
