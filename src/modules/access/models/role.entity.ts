import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  @Index('roles__id')
  id!: string;

  @Column({ length: 255 })
  @Index('roles__name', { unique: true })
  name!: string;

  @Column({ length: 20, default: 'web' })
  guard_name!: string;

  @Column({ type: 'varchar', length: 20, default: 'Active' })
  @Index('roles__status')
  status!: string;

  @Column({ length: 255, nullable: true })
  @Index('roles__desc')
  desc!: string;

  @Column({ length: 36, nullable: true })
  created_by!: string;

  @Column({ length: 36, nullable: true })
  updated_by!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToMany(() => User, (user) => user.roles)
  users!: User[];

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({
    name: 'roles_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions!: Permission[];
}
