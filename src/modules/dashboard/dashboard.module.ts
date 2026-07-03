import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../access/models/user.entity';
import { Role } from '../access/models/role.entity';
import { Permission } from '../access/models/permission.entity';
import { DashboardService } from './services/DashboardService';
import { DashboardWebController } from './controllers/web/v1/DashboardWebController';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission]), AuthModule],
  controllers: [DashboardWebController],
  providers: [DashboardService],
})
export class DashboardModule {}
