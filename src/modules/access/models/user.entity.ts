import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinTable,
  ManyToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @Index('users__id')
  id!: string;

  @Column({ length: 20 })
  @Index('users__code', { unique: true })
  code!: string;

  @Column({ length: 50 })
  @Index('users__name')
  name!: string;

  @Column({ length: 15, nullable: true })
  @Index('users__phone')
  phone!: string;

  @Column({ length: 255 })
  @Index('users__email', { unique: true })
  email!: string;

  @Column({ nullable: true })
  email_verified_at!: Date;

  @Column({ length: 255 })
  password!: string;

  @Column({ length: 255, nullable: true })
  password_otp!: string;

  @Column({ type: 'bigint', nullable: true })
  password_otp_expires!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'Active' })
  @Index('users__status')
  status!: string;

  @Column({ length: 255, nullable: true })
  picture!: string;

  @Column({ default: false })
  @Index('users__blocked')
  blocked!: boolean;

  @Column({ length: 255, nullable: true })
  blocked_reason!: string;

  @Column({ length: 255, nullable: true, default: 'UTC' })
  @Index('users__timezone')
  timezone!: string;

  @Column({ length: 36, nullable: true })
  created_by!: string;

  @Column({ length: 36, nullable: true })
  updated_by!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'users_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles!: Role[];
}
