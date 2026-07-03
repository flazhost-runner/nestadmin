/** Kontrak UserService (Dependency Inversion + Interface Segregation). */
export interface IUserService {
  index(filter: any): Promise<any>;
  create(): Promise<any>;
  store(request: any, files?: any): Promise<any>;
  edit(id: string): Promise<any>;
  update(id: string, request: any, files?: any): Promise<any>;
  delete(id: string): Promise<any>;
  deleteSelected(ids: string[]): Promise<any>;
}
