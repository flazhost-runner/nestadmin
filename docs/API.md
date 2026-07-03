# REST API — NestAdmin

Base URL: `http://localhost:3000`
Semua endpoint REST di bawah `/api/v1/*`. Autentikasi memakai **JWT Bearer**.

## Format Response

Sukses:
```json
{ "status": true, "message": "Success", "data": { } }
```
Error:
```json
{ "status": false, "message": "Pesan error", "data": null }
```
Validation error (422):
```json
{ "status": false, "message": "Validation Error", "errors": [ { "path": "email", "msg": "..." } ] }
```

Kode status: `200` OK · `201` Created · `401` belum auth / token invalid · `403` tak punya akses (RBAC) · `404` tak ditemukan · `409` konflik (duplikat) · `422` validasi · `429` rate limit · `500` error server.

---

## Autentikasi

### POST `/api/v1/auth/login`
```json
{ "email": "admin@admin.com", "password": "12345678" }
```
Response:
```json
{
  "status": true,
  "message": "Ok",
  "data": {
    "access_token": "<jwt>",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```
Gunakan token di header berikutnya:
```
Authorization: Bearer <access_token>
```
Rate-limited (login berlebihan → `429`).

### POST `/api/v1/auth/register`
Registrasi publik (role default "User"; field `roles` dari klien diabaikan).
```json
{ "name": "Budi", "email": "budi@example.com", "password": "password123" }
```

### POST `/api/v1/auth/logout`
Header `Authorization: Bearer <token>`. Token di-blacklist (berlaku sampai expiry).
POST karena logout adalah mutasi (GET tak boleh punya efek samping).

### POST `/api/v1/auth/reset/request`
```json
{ "email": "user@example.com" }
```
Mengirim OTP ke email (hashed + expiry 10 menit). Rate-limited.

### POST `/api/v1/auth/reset/process`
```json
{ "email": "user@example.com", "otp": "123456", "password": "passwordBaru" }
```

---

## User — `/api/v1/access/user`

Memerlukan auth (JWT) + permission RBAC.

| Method | Path | Aksi |
|--------|------|------|
| GET | `/api/v1/access/user` | List (query: `q_code`, `q_name`, `q_email`, `q_status`, `q_role`, `q_page`, `q_page_size`) |
| POST | `/api/v1/access/user` | Buat user |
| GET | `/api/v1/access/user/:id/edit` | Detail untuk edit |
| PUT | `/api/v1/access/user/:id` | Update |
| DELETE | `/api/v1/access/user/:id` | Hapus |
| POST | `/api/v1/access/user/delete_selected` | Hapus banyak (`{ selected: [id,...] }`) |

Contoh body store:
```json
{
  "name": "Budi",
  "email": "budi@example.com",
  "phone": "08123456789",
  "password": "password123",
  "status": "Active",
  "roles": ["<role-uuid>"]
}
```

Response list:
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "datas": [ { "id": "...", "name": "...", "email": "...", "roles": [...] } ],
    "paginate_data": {
      "total": 5, "page": 1, "page_size": 10,
      "total_pages": 1, "has_prev": false, "has_next": false
    }
  }
}
```

---

## Role — `/api/v1/access/role`

| Method | Path | Aksi |
|--------|------|------|
| GET | `/api/v1/access/role` | List |
| POST | `/api/v1/access/role` | Buat (`{ name, status, description }`) |
| GET | `/api/v1/access/role/:id/edit` | Detail |
| PUT | `/api/v1/access/role/:id` | Update |
| DELETE | `/api/v1/access/role/:id` | Hapus |
| GET | `/api/v1/access/role/:id/permission` | Daftar permission untuk role |
| POST | `/api/v1/access/role/:id/permission/assign` | Assign permission (`{ permission_id }`) |
| POST | `/api/v1/access/role/:id/permission/unassign` | Unassign permission (`{ permission_id }`) |
| POST | `/api/v1/access/role/:id/permission/assign_selected` | Assign banyak (`{ selected: [permId,...] }`) |
| POST | `/api/v1/access/role/:id/permission/unassign_selected` | Unassign banyak |

---

## Permission — `/api/v1/access/permission`

| Method | Path | Aksi |
|--------|------|------|
| GET | `/api/v1/access/permission` | List |
| POST | `/api/v1/access/permission` | Buat (`{ name, method, guard_name, status }`) |
| GET | `/api/v1/access/permission/:id/edit` | Detail |
| PUT | `/api/v1/access/permission/:id` | Update |
| DELETE | `/api/v1/access/permission/:id` | Hapus |
| POST | `/api/v1/access/permission/delete_selected` | Hapus banyak |
| POST | `/api/v1/access/permission/sync` | Sync dari route registry (auto-create missing permissions) |

---

## Dashboard — `/api/v1/dashboard`

| Method | Path | Aksi |
|--------|------|------|
| GET | `/api/v1/dashboard` | Statistik ringkas |

Contoh response:
```json
{
  "status": true,
  "message": "Success",
  "data": { "users": 2, "roles": 2, "permissions": 24 }
}
```

---

## Setting — `/api/v1/setting`

| Method | Path | Aksi |
|--------|------|------|
| GET | `/api/v1/setting` | Ambil data setting (termasuk `theme`, `name`, dll) |
| PUT | `/api/v1/setting` | Update setting |

---

## Profile — `/api/v1/profile`

| Method | Path | Aksi |
|--------|------|------|
| GET | `/api/v1/profile` | Profil user sendiri (dari JWT) |
| PUT | `/api/v1/profile` | Update profil sendiri (tak bisa ubah role) |

---

## Catatan

- Semua endpoint non-auth memerlukan header `Authorization: Bearer <token>` **dan** permission yang sesuai (RBAC). Administrator role melewati cek permission.
- Method `PUT`/`DELETE` untuk web form HTML memakai `?_method=PUT/DELETE` (method-override); untuk REST API gunakan HTTP method asli.
- Endpoint web (non-`/api/`) memakai sesi + CSRF, bukan JWT.
- Query filter menggunakan prefix `q_` untuk menghindari konflik dengan field lain.

## Menambah Endpoint Baru

Setiap kali menambah API controller baru, tambahkan entri di file ini:

```markdown
## Product — `/api/v1/product`

| Method | Path | Aksi |
|--------|------|------|
| GET | `/api/v1/product` | List (query: `q_name`, `q_status`, `q_page`) |
| POST | `/api/v1/product` | Buat product |
| GET | `/api/v1/product/:id` | Detail |
| PUT | `/api/v1/product/:id` | Update |
| DELETE | `/api/v1/product/:id` | Hapus |
```

> Catatan: spesifikasi OpenAPI/Swagger formal dapat ditambahkan via `@nestjs/swagger` sebagai langkah lanjutan. Dokumen ini adalah referensi manual endpoint.
