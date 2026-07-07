import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request, Response } from 'express';
import { MediaService } from './media.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { routeRegistry } from '../../utils/named-routes';

const BASE = '/admin/v1/media';

/**
 * MediaController — file manager untuk Trumbowyg.
 *
 * Trumbowyg filemanager plugin:
 *  - Baca CSRF token dari <meta name="csrf-token" content="...">
 *  - Kirim header x-csrf-token pada setiap AJAX request
 *  - Upload: POST multipart/form-data, field "file"
 *  - Delete: POST application/x-www-form-urlencoded, body { key }
 *  - List:   GET → JSON array of { name, url, size, mtime }
 */
@Controller()
@UseGuards(SessionAuthGuard)
export class MediaController {
  constructor(private mediaService: MediaService) {
    routeRegistry.register('admin.v1.media.list', 'GET', `${BASE}/list`);
    routeRegistry.register('admin.v1.media.upload', 'POST', `${BASE}/upload`);
    routeRegistry.register('admin.v1.media.delete', 'POST', `${BASE}/delete`);
  }

  /** GET /admin/v1/media/list → JSON array of uploaded files */
  @Get(`${BASE}/list`)
  async list(@Res() res: Response) {
    const files = await this.mediaService.list();
    return res.json({ status: true, message: 'OK', data: files });
  }

  /**
   * POST /admin/v1/media/upload
   * multipart/form-data, field "file". Max 2MB, MIME image/*.
   * CSRF via header x-csrf-token.
   */
  @Post(`${BASE}/upload`)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File, @Res() res: Response) {
    if (!file) {
      return res
        .status(400)
        .json({ status: false, message: 'File not found', data: null });
    }
    try {
      const saved = await this.mediaService.upload(
        file.originalname,
        file.buffer,
        file.mimetype,
      );
      return res.json({
        status: true,
        message: 'Upload Success.',
        data: saved,
      });
    } catch (e: any) {
      return res
        .status(e.getStatus?.() ?? 400)
        .json({ status: false, message: e.message, data: null });
    }
  }

  /**
   * POST /admin/v1/media/delete
   * Body: { key: "filename.ext" }
   */
  @Post(`${BASE}/delete`)
  async deleteFile(@Req() req: Request, @Res() res: Response) {
    const key: string = req.body?.key || '';
    if (!key) {
      return res
        .status(400)
        .json({ status: false, message: 'Key is required', data: null });
    }
    try {
      await this.mediaService.delete(key);
      return res.json({ status: true, message: 'Delete Success.', data: null });
    } catch (e: any) {
      return res
        .status(e.getStatus?.() ?? 400)
        .json({ status: false, message: e.message, data: null });
    }
  }
}
