export interface IFeTemplateService {
  isCached(slug: string): boolean;
  getActiveSlug(): Promise<string>;
  isDefaultEjs(slug: string): boolean;
  ensure(slug: string): Promise<void>;
  getActiveHtml(): Promise<string>;
}

export const IFeTemplateService = Symbol('IFeTemplateService');
