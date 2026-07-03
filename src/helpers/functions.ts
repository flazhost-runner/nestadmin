import { SelectQueryBuilder } from 'typeorm';

export interface PaginateResult {
  datas: any[];
  paginate_data: {
    total: number;
    current_page: number;
    page_size: number;
    total_page: number;
    has_prev: boolean;
    has_next: boolean;
  };
}

export function paginate<T>(
  query: SelectQueryBuilder<T>,
  filter: Record<string, any>,
): Promise<PaginateResult> {
  const page = parseInt(filter.page || filter.q_page || '1', 10) || 1;
  const page_size =
    parseInt(filter.page_size || filter.q_page_size || '10', 10) || 10;
  const skip = (page - 1) * page_size;

  return query
    .skip(skip)
    .take(page_size)
    .getManyAndCount()
    .then(([datas, total]) => {
      const total_page = Math.ceil(total / page_size);
      return {
        datas,
        paginate_data: {
          total,
          current_page: page,
          page_size,
          total_page,
          has_prev: page > 1,
          has_next: page < total_page,
        },
      };
    });
}

// Case-insensitive LIKE — works across SQLite/MySQL/Postgres
export function ciLike(
  col: string,
  param: string,
  val: string,
): [string, Record<string, string>] {
  return [`LOWER(${col}) LIKE LOWER(:${param})`, { [param]: `%${val}%` }];
}

export function removeEmptyFields<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== '' && v !== null && v !== undefined,
    ),
  ) as T;
}

export function removePrefix(
  obj: Record<string, any>,
  prefix: string,
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [k.slice(prefix.length), v]),
  );
}

export function generateCode(prefix = 'USR'): string {
  return prefix + Date.now().toString().slice(-8);
}
