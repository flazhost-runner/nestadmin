export interface IProfileService {
  index(userId: string): Promise<any>;
  update(userId: string, request: any, files?: any): Promise<any>;
}
