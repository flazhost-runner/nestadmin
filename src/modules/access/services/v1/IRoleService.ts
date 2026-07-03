/** Kontrak RoleService (Dependency Inversion + Interface Segregation). */
export interface IRoleService {
  index(filter: any): Promise<any>;
  store(request: any): Promise<any>;
  edit(id: string): Promise<any>;
  update(id: string, request: any): Promise<any>;
  delete(id: string): Promise<any>;
  deleteSelected(ids: string[]): Promise<any>;
  permission(role_id: string, filter: any): Promise<any>;
  permissionAssign(role_id: string, permission_id: string): Promise<any>;
  permissionAssignSelected(
    role_id: string,
    permissions: string[],
  ): Promise<any>;
  permissionUnassign(role_id: string, permission_id: string): Promise<any>;
  permissionUnassignSelected(
    role_id: string,
    permissions: string[],
  ): Promise<any>;
}
