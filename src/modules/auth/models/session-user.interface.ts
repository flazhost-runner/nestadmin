export interface SessionUser {
  id: string;
  code: string;
  name: string;
  email: string;
  status: string;
  picture?: string;
  timezone: string;
  roles: Array<{ id: string; name: string }>;
}
