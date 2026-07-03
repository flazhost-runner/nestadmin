import { FeTemplate } from '../../../../config/fe-templates';

export interface PaginateResult<T> {
  datas: T[];
  paginate_data: {
    total_data: number;
    page_size: number;
    current_page: number;
    total_page: number;
  };
}

export interface IFeCatalogService {
  list(): Promise<FeTemplate[]>;
  categories(): Promise<string[]>;
  paginate(
    filter: Record<string, any>,
    pinSlug?: string,
  ): Promise<PaginateResult<FeTemplate>>;
  has(slug: string): Promise<boolean>;
  previewHtml(slug: string): Promise<string>;
}

export const IFeCatalogService = Symbol('IFeCatalogService');
