import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  @Index('permissions__id')
  id!: string;

  @Column({ length: 255 })
  @Index('permissions__name')
  name!: string;

  @Column({ type: 'varchar', length: 20, default: 'web' })
  @Index('permissions__guard')
  guard_name!: string;

  @Column({ length: 255, nullable: true })
  @Index('permissions__method')
  method!: string;

  @Column({ type: 'varchar', length: 20, default: 'Active' })
  @Index('permissions__status')
  status!: string;

  @Column({ length: 255, nullable: true })
  @Index('permissions__desc')
  desc!: string;

  @Column({ length: 36, nullable: true })
  created_by!: string;

  @Column({ length: 36, nullable: true })
  updated_by!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles!: Role[];
}
