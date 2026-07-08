import {
  Controller,
  Get,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request, Response } from 'express';
import { SettingService } from '../../../services/v1/SettingService';
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard';
import { routeRegistry } from '../../../../../utils/named-routes';

// Whitelist mimetype gambar — selaras validator NodeAdmin (jpeg/jpg/png/webp).
const IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const BASE = '/admin/v1/setting';

@Controller()
@UseGuards(SessionAuthGuard)
export class SettingWebController {
  constructor(private settingService: SettingService) {
    routeRegistry.register('admin.v1.setting.index', 'GET', BASE);
    routeRegistry.register('admin.v1.setting.update', 'PUT', BASE);
    routeRegistry.register(
      'admin.v1.setting.fe_preview',
      'GET',
      `${BASE}/fe-preview`,
    );
  }

  @Get(BASE)
  async index(@Req() req: Request, @Res() res: Response) {
    const filter = req.query as Record<string, any>;
    const result = await this.settingService.index(filter);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('setting/views/be/default/index', {
      title: 'Setting Management',
      ...result,
    });
  }

  // FileFieldsInterceptor WAJIB: tanpa multer, body multipart tak pernah
  // di-parse — req.files selalu kosong sehingga icon/logo/login_image tak
  // pernah terupload. memoryStorage → buffer diteruskan ke StorageService.
  @Put(BASE)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'icon', maxCount: 1 },
        { name: 'logo', maxCount: 1 },
        { name: 'login_image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 2 * 1024 * 1024 },
        fileFilter: (_req, file, cb) =>
          cb(null, IMAGE_MIMES.includes(file.mimetype)),
      },
    ),
  )
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
  ) {
    await this.settingService.update(req.body, files || {});
    (req as any).flash?.('success', 'Save Setting Success.');
    req.session.save(() => res.redirect(BASE));
  }

  @Get(`${BASE}/fe-preview`)
  async fePreview(@Query('slug') slug: string, @Res() res: Response) {
    const html = await this.settingService.fePreview(slug);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
