import {
  Controller,
  Get,
  Put,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request, Response } from 'express';
import { ProfileService } from '../../../services/v1/ProfileService';
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = '/admin/v1/profile';

@Controller()
@UseGuards(SessionAuthGuard)
export class ProfileWebController {
  constructor(private profileService: ProfileService) {
    routeRegistry.register('admin.v1.profile.index', 'GET', BASE);
    routeRegistry.register('admin.v1.profile.update', 'PUT', BASE);
  }

  @Get(BASE)
  async index(@Req() req: Request, @Res() res: Response) {
    const userId = (req.session as any)?.user?.id;
    const result = await this.profileService.index(userId);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('profile/views/be/default/profile', {
      title: 'Profile',
      ...result,
    });
  }

  // FileFieldsInterceptor WAJIB di sini: tanpa multer, body multipart tidak
  // pernah di-parse — req.files selalu undefined sehingga foto tidak pernah
  // terupload. memoryStorage → buffer diteruskan ke StorageService (bukan
  // tulis-disk langsung) supaya seragam untuk driver local/oss/s3.
  @Put(BASE)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'picture', maxCount: 1 }], {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      // Whitelist mimetype gambar — selaras validator NodeAdmin (jpeg/jpg/
      // png/webp). File di luar whitelist di-skip diam-diam (foto lama tetap).
      fileFilter: (_req, file, cb) => {
        const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        cb(null, ok.includes(file.mimetype));
      },
    }),
  )
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
  ) {
    const userId = (req.session as any)?.user?.id;
    const updated = await this.profileService.update(
      userId,
      req.body,
      files || {},
    );
    // Refresh session user
    (req.session as any).user = {
      ...(req.session as any).user,
      name: updated.name,
      email: updated.email,
      picture: updated.picture,
      timezone: updated.timezone,
    };
    (req as any).flash?.('success', 'Update Profile Success.');
    req.session.save(() => res.redirect(BASE));
  }
}
