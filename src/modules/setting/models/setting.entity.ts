import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255, nullable: true })
  initial!: string;

  @Column({ length: 255, nullable: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ length: 255, nullable: true })
  icon!: string;

  @Column({ length: 255, nullable: true })
  logo!: string;

  @Column({ length: 255, nullable: true })
  favicon!: string;

  @Column({ length: 255, nullable: true })
  login_image!: string;

  @Column({ length: 255, nullable: true })
  phone!: string;

  @Column({ length: 255, nullable: true })
  address!: string;

  @Column({ length: 255, nullable: true })
  email!: string;

  @Column({ length: 255, nullable: true })
  copyright!: string;

  @Column({ length: 20, default: 'Blue' })
  theme!: string;

  @Column({ length: 80, default: 'agency-consulting-002-creative-agency' })
  fe_template!: string;

  @Column({ length: 36, nullable: true })
  created_by!: string;

  @Column({ length: 36, nullable: true })
  updated_by!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
