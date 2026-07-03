import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './models/user.entity';
import { Role } from './models/role.entity';
import { Permission } from './models/permission.entity';
import { UserService } from './services/v1/UserService';
import { RoleService } from './services/v1/RoleService';
import { PermissionService } from './services/v1/PermissionService';
import { UserWebController } from './controllers/web/v1/UserWebController';
import { RoleWebController } from './controllers/web/v1/RoleWebController';
import { PermissionWebController } from './controllers/web/v1/PermissionWebController';
import { UserApiController } from './controllers/api/v1/UserApiController';
import { RoleApiController } from './controllers/api/v1/RoleApiController';
import { PermissionApiController } from './controllers/api/v1/PermissionApiController';
import { AuthModule } from '../auth/auth.module';
import { ViewLocalsMiddleware } from '../../middleware/view-locals.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission]), AuthModule],
  controllers: [
    UserWebController,
    RoleWebController,
    PermissionWebController,
    UserApiController,
    RoleApiController,
    PermissionApiController,
  ],
  providers: [
    UserService,
    RoleService,
    PermissionService,
    ViewLocalsMiddleware,
  ],
  exports: [UserService, RoleService, PermissionService],
})
export class AccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ViewLocalsMiddleware)
      .forRoutes({ path: '/admin/v1/access/*', method: RequestMethod.ALL });
  }
}
