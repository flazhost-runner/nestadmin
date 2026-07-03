import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('sessions')
export class AppSession {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'text' })
  data!: string;

  // Tipe tanggal di-infer dari properti Date → portabel lintas DB
  // (sqlite: datetime, mysql: datetime, postgres: timestamp)
  @Column({ name: 'expires_at' })
  expiresAt!: Date;
}
