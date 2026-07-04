/** Kontrak PermissionService (Dependency Inversion + Interface Segregation). */
export interface IPermissionService {
  syncFromRouteRegistry(): Promise<void>;
  index(filter: any): Promise<any>;
  store(request: any): Promise<any>;
  edit(id: string): Promise<any>;
  update(id: string, request: any): Promise<any>;
  delete(id: string): Promise<any>;
  deleteSelected(ids: string[]): Promise<any>;
  syncFromRoutes(): Promise<void>;
}
