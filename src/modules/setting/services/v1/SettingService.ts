import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Setting } from '../../models/setting.entity';
import { ISettingService } from './ISettingService';
import { SettingCacheService } from '../../../../services/setting-cache.service';
import { THEMES } from '../../../../config/themes';
import { AppError } from '../../../../errors/AppError';

const FE_TEMPLATES: any[] = [
  {
    slug: 'agency-consulting-002-creative-agency',
    name: 'Creative Agency',
    category: 'agency',
  },
  { slug: 'saas-005-saas-landing', name: 'SaaS Landing', category: 'saas' },
  {
    slug: 'ecommerce-001-online-shop',
    name: 'Online Shop',
    category: 'ecommerce',
  },
  {
    slug: 'portfolio-001-personal-portfolio',
    name: 'Personal Portfolio',
    category: 'portfolio',
  },
  { slug: 'blog-001-minimal-blog', name: 'Minimal Blog', category: 'blog' },
  {
    slug: 'restaurant-001-food-restaurant',
    name: 'Food Restaurant',
    category: 'restaurant',
  },
  {
    slug: 'startup-001-tech-startup',
    name: 'Tech Startup',
    category: 'startup',
  },
  {
    slug: 'education-001-online-course',
    name: 'Online Course',
    category: 'education',
  },
  {
    slug: 'fitness-001-gym-fitness',
    name: 'Gym & Fitness',
    category: 'fitness',
  },
  {
    slug: 'real-estate-001-property',
    name: 'Property',
    category: 'real-estate',
  },
  { slug: 'medical-001-healthcare', name: 'Healthcare', category: 'medical' },
  { slug: 'finance-001-fintech', name: 'Fintech', category: 'finance' },
  {
    slug: 'travel-001-travel-agency',
    name: 'Travel Agency',
    category: 'travel',
  },
  {
    slug: 'photography-001-photo-studio',
    name: 'Photo Studio',
    category: 'photography',
  },
  { slug: 'music-001-music-band', name: 'Music Band', category: 'music' },
  { slug: 'nonprofit-001-charity', name: 'Charity', category: 'nonprofit' },
  {
    slug: 'architecture-001-design-studio',
    name: 'Design Studio',
    category: 'architecture',
  },
  {
    slug: 'automotive-001-car-dealer',
    name: 'Car Dealer',
    category: 'automotive',
  },
  {
    slug: 'fashion-001-clothing-store',
    name: 'Clothing Store',
    category: 'fashion',
  },
  { slug: 'hotel-001-hospitality', name: 'Hospitality', category: 'hotel' },
];

@Injectable()
export class SettingService implements ISettingService {
  constructor(
    @InjectRepository(Setting) private repo: Repository<Setting>,
    private cache: SettingCacheService,
  ) {}

  async index(filter: Record<string, any> = {}): Promise<any> {
    // Ensure a singleton setting row exists
    let data = await this.repo.findOne({ where: {} });
    if (!data) {
      data = await this.repo.save(
        this.repo.create({ id: uuidv4(), theme: 'Blue', fe_template: '' }),
      );
    }

    // Build themes map for view
    const themes: Record<string, any> = {};
    for (const t of THEMES) {
      themes[t.name] = {
        primary: t.primary,
        secondary: t.secondary,
        light: t.light,
        dark: t.dark,
      };
    }

    // Frontend template catalog — paginated (stub: empty list)
    const qName: string = filter.q_name || '';
    const qCategory: string = filter.q_category || '';
    const qPage: number = parseInt(filter.q_page || '1', 10) || 1;
    const qPageSize: number = parseInt(filter.q_page_size || '8', 10) || 8;

    const allTemplates = FE_TEMPLATES.filter((t) => {
      if (qName && !t.name.toLowerCase().includes(qName.toLowerCase()))
        return false;
      if (qCategory && t.category !== qCategory) return false;
      return true;
    });
    const total = allTemplates.length;
    const start = (qPage - 1) * qPageSize;
    const feTemplates = allTemplates.slice(start, start + qPageSize);
    const feCategories: string[] = [
      ...new Set(FE_TEMPLATES.map((t: any) => t.category)),
    ];

    return {
      data,
      themes,
      feTemplates,
      feCategories,
      feTemplate: data.fe_template,
      paginate_data: {
        total_data: total,
        total_page: Math.ceil(total / qPageSize) || 1,
        current_page: qPage,
        page_size: qPageSize,
      },
      filter: {
        q_name: qName,
        q_category: qCategory,
        q_page: qPage,
        q_page_size: qPageSize,
      },
    };
  }

  async update(request: any, files?: Record<string, any[]>): Promise<Setting> {
    let data = await this.repo.findOne({ where: {} });
    if (!data) {
      data = this.repo.create({ id: uuidv4() });
    }

    // Handle file uploads (multer)
    const fileFields = ['icon', 'logo', 'login_image'];
    for (const field of fileFields) {
      if (files?.[field]?.[0]) {
        request[field] = files[field][0].filename ?? files[field][0].path;
      }
    }

    const allowed = [
      'initial',
      'name',
      'description',
      'icon',
      'logo',
      'login_image',
      'phone',
      'address',
      'email',
      'copyright',
      'theme',
      'fe_template',
    ];
    for (const key of allowed) {
      if (request[key] !== undefined) (data as any)[key] = request[key];
    }

    const result = await this.repo.save(data);
    if (!result) throw new AppError('Update Setting failed', 500);
    this.cache.invalidate();
    return result;
  }

  async fePreview(slug: string): Promise<string> {
    // Stub: real implementation fetches from opentailwind CDN / cache
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;text-align:center">
      <h2>Template: ${slug}</h2>
      <p>Preview not available in stub mode.</p>
    </body></html>`;
  }
}
