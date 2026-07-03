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
import { RoleService } from '../../../services/v1/RoleService';
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = '/admin/v1/access/roles';

@Controller()
@UseGuards(SessionAuthGuard)
export class RoleWebController {
  constructor(private roleService: RoleService) {
    routeRegistry.register('admin.v1.access.role.index', 'GET', BASE);
    routeRegistry.register(
      'admin.v1.access.role.create',
      'GET',
      `${BASE}/create`,
    );
    routeRegistry.register('admin.v1.access.role.store', 'POST', BASE);
    routeRegistry.register(
      'admin.v1.access.role.edit',
      'GET',
      `${BASE}/:id/edit`,
    );
    routeRegistry.register('admin.v1.access.role.update', 'PUT', `${BASE}/:id`);
    routeRegistry.register(
      'admin.v1.access.role.delete',
      'DELETE',
      `${BASE}/:id`,
    );
    routeRegistry.register(
      'admin.v1.access.role.delete_selected',
      'POST',
      `${BASE}/delete_selected`,
    );
    routeRegistry.register(
      'admin.v1.access.role.permission',
      'GET',
      `${BASE}/:id/permission`,
    );
    routeRegistry.register(
      'admin.v1.access.role.permission.assign',
      'GET',
      `${BASE}/:id/permission/:permission_id/assign`,
    );
    routeRegistry.register(
      'admin.v1.access.role.permission.assign_selected',
      'POST',
      `${BASE}/:id/permission/assign_selected`,
    );
    routeRegistry.register(
      'admin.v1.access.role.permission.unassign',
      'GET',
      `${BASE}/:id/permission/:permission_id/unassign`,
    );
    routeRegistry.register(
      'admin.v1.access.role.permission.unassign_selected',
      'POST',
      `${BASE}/:id/permission/unassign_selected`,
    );
  }

  @Get(`${BASE}`)
  async index(@Req() req: Request, @Res() res: Response) {
    const filter = req.query as Record<string, any>;
    const result = await this.roleService.index(filter);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('access/views/be/default/roles/index', {
      title: 'Role Management',
      filter,
      ...result,
    });
  }

  @Get(`${BASE}/create`)
  async create(@Req() req: Request, @Res() res: Response) {
    res.render('access/views/be/default/roles/create', {
      title: 'Create Role',
    });
  }

  @Post(`${BASE}`)
  async store(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    await this.roleService.store(body);
    (req as any).flash?.('success', 'Create Role Success.');
    res.redirect(BASE);
  }

  @Get(`${BASE}/:id/edit`)
  async edit(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.roleService.edit(id);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('access/views/be/default/roles/edit', {
      title: 'Edit Role',
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
    await this.roleService.update(id, body);
    (req as any).flash?.('success', 'Update Role Success.');
    res.redirect(BASE);
  }

  @Delete(`${BASE}/:id`)
  async delete(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.roleService.delete(id);
    (req as any).flash?.('success', 'Delete Role Success.');
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
    await this.roleService.deleteSelected(ids);
    (req as any).flash?.('success', 'Delete Role Success.');
    res.redirect(BASE);
  }

  @Get(`${BASE}/:id/permission`)
  async permission(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const filter = req.query as Record<string, any>;
    const result = await this.roleService.permission(id, filter);
    delete (req.session as any).errors;
    res.render('access/views/be/default/roles/permission', {
      title: 'Role Permissions',
      filter,
      ...result,
    });
  }

  @Get(`${BASE}/:id/permission/:permission_id/assign`)
  async permissionAssign(
    @Param('id') id: string,
    @Param('permission_id') permission_id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.roleService.permissionAssign(id, permission_id);
    (req as any).flash?.('success', 'Assign Permission Success.');
    res.redirect(`${BASE}/${id}/permission`);
  }

  @Post(`${BASE}/:id/permission/assign_selected`)
  async permissionAssignSelected(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const raw = body['selected[]'] ?? body.selected ?? [];
    const ids: string[] = Array.isArray(raw) ? raw : [raw];
    await this.roleService.permissionAssignSelected(id, ids);
    (req as any).flash?.('success', 'Assign Permission Success.');
    res.redirect(`${BASE}/${id}/permission`);
  }

  @Get(`${BASE}/:id/permission/:permission_id/unassign`)
  async permissionUnassign(
    @Param('id') id: string,
    @Param('permission_id') permission_id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.roleService.permissionUnassign(id, permission_id);
    (req as any).flash?.('success', 'Unassign Permission Success.');
    res.redirect(`${BASE}/${id}/permission`);
  }

  @Post(`${BASE}/:id/permission/unassign_selected`)
  async permissionUnassignSelected(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const raw = body['selected[]'] ?? body.selected ?? [];
    const ids: string[] = Array.isArray(raw) ? raw : [raw];
    await this.roleService.permissionUnassignSelected(id, ids);
    (req as any).flash?.('success', 'Unassign Permission Success.');
    res.redirect(`${BASE}/${id}/permission`);
  }
}
