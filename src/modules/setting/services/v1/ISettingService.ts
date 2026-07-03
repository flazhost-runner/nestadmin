export interface ISettingService {
  index(filter?: Record<string, any>): Promise<any>;
  update(request: any, files?: any): Promise<any>;
  fePreview(slug: string): Promise<string>;
}
