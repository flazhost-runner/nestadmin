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
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PermissionService } from '../../../services/v1/PermissionService';
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = '/admin/v1/access/permissions';

@Controller()
@UseGuards(SessionAuthGuard)
export class PermissionWebController {
  constructor(private permissionService: PermissionService) {
    routeRegistry.register('admin.v1.access.permission.index', 'GET', BASE);
    routeRegistry.register(
      'admin.v1.access.permission.create',
      'GET',
      `${BASE}/create`,
    );
    routeRegistry.register('admin.v1.access.permission.store', 'POST', BASE);
    routeRegistry.register(
      'admin.v1.access.permission.edit',
      'GET',
      `${BASE}/:id/edit`,
    );
    routeRegistry.register(
      'admin.v1.access.permission.update',
      'PUT',
      `${BASE}/:id`,
    );
    routeRegistry.register(
      'admin.v1.access.permission.delete',
      'DELETE',
      `${BASE}/:id`,
    );
    routeRegistry.register(
      'admin.v1.access.permission.delete_selected',
      'POST',
      `${BASE}/delete_selected`,
    );
    routeRegistry.register(
      'admin.v1.access.permission.sync',
      'POST',
      `${BASE}/sync`,
    );
  }

  @Get(`${BASE}`)
  async index(@Req() req: Request, @Res() res: Response) {
    const filter = req.query as Record<string, any>;
    const result = await this.permissionService.index(filter);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('access/views/be/default/permissions/index', {
      title: 'Permission Management',
      filter,
      ...result,
    });
  }

  @Get(`${BASE}/create`)
  async create(@Req() req: Request, @Res() res: Response) {
    res.render('access/views/be/default/permissions/create', {
      title: 'Create Permission',
    });
  }

  @Post(`${BASE}`)
  async store(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    await this.permissionService.store(body);
    (req as any).flash?.('success', 'Create Permission Success.');
    res.redirect(BASE);
  }

  @Get(`${BASE}/:id/edit`)
  async edit(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.permissionService.edit(id);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('access/views/be/default/permissions/edit', {
      title: 'Edit Permission',
      data,
    });
  }

  @Put(`${BASE}/:id`)
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.permissionService.update(id, body);
    (req as any).flash?.('success', 'Update Permission Success.');
    res.redirect(BASE);
  }

  @Delete(`${BASE}/:id`)
  async delete(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.permissionService.delete(id);
    (req as any).flash?.('success', 'Delete Permission Success.');
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
    await this.permissionService.deleteSelected(ids);
    (req as any).flash?.('success', 'Delete Permission Success.');
    res.redirect(BASE);
  }

  @Post(`${BASE}/sync`)
  async sync(@Req() req: Request, @Res() res: Response) {
    await this.permissionService.syncFromRoutes();
    (req as any).flash?.('success', 'Sync Permission Success.');
    res.redirect(BASE);
  }
}
