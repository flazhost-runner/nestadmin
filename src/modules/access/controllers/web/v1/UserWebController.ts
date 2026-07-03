import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Req,
  Res,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { UserService } from '../../../services/v1/UserService';
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = '/admin/v1/access/users';

@Controller()
@UseGuards(SessionAuthGuard)
export class UserWebController {
  constructor(private userService: UserService) {
    routeRegistry.register('admin.v1.access.user.index', 'GET', BASE);
    routeRegistry.register(
      'admin.v1.access.user.create',
      'GET',
      `${BASE}/create`,
    );
    routeRegistry.register('admin.v1.access.user.store', 'POST', BASE);
    routeRegistry.register(
      'admin.v1.access.user.edit',
      'GET',
      `${BASE}/:id/edit`,
    );
    routeRegistry.register('admin.v1.access.user.update', 'PUT', `${BASE}/:id`);
    routeRegistry.register(
      'admin.v1.access.user.delete',
      'DELETE',
      `${BASE}/:id`,
    );
    routeRegistry.register(
      'admin.v1.access.user.delete_selected',
      'POST',
      `${BASE}/delete_selected`,
    );
  }

  @Get(`${BASE}`)
  async index(@Req() req: Request, @Res() res: Response) {
    const filter = req.query as Record<string, any>;
    const result = await this.userService.index(filter);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('access/views/be/default/users/index', {
      title: 'User Management',
      filter,
      ...result,
    });
  }

  @Get(`${BASE}/create`)
  async create(@Req() req: Request, @Res() res: Response) {
    const { roles, timezones } = await this.userService.create();
    res.render('access/views/be/default/users/create', {
      title: 'Create User',
      roles,
      timezones,
    });
  }

  @Post(`${BASE}`)
  @UseInterceptors(AnyFilesInterceptor())
  async store(
    @Body() body: any,
    @UploadedFiles() _files: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const selected = body['roles[]'] ?? body.roles ?? [];
    await this.userService.store({
      ...body,
      roles: Array.isArray(selected) ? selected : [selected],
    });
    (req as any).flash?.('success', 'Create User Success.');
    res.redirect(BASE);
  }

  @Get(`${BASE}/:id/edit`)
  async edit(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.userService.edit(id);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('access/views/be/default/users/edit', {
      title: 'Edit User',
      ...result,
    });
  }

  @Put(`${BASE}/:id`)
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() _files: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const selected = body['roles[]'] ?? body.roles ?? [];
    await this.userService.update(id, {
      ...body,
      roles: Array.isArray(selected) ? selected : [selected],
    });
    (req as any).flash?.('success', 'Update User Success.');
    res.redirect(BASE);
  }

  @Delete(`${BASE}/:id`)
  async delete(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.userService.delete(id);
    (req as any).flash?.('success', 'Delete User Success.');
    res.redirect(BASE);
  }

  @Post(`${BASE}/delete_selected`)
  async deleteSelected(
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const raw = body['selected[]'] ?? body.selected ?? [];
    const ids: string[] = Array.isArray(raw) ? raw : [raw];
    await this.userService.deleteSelected(ids);
    (req as any).flash?.('success', 'Delete User Success.');
    res.redirect(BASE);
  }
}
