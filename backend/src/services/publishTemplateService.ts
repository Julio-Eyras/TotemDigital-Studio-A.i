import { getDatabase } from '../config/database';

export interface PublishTemplateRow {
  templateId: number;
  preset: string;
  segment: string | null;
  title: string;
  description: string | null;
  headline: string | null;
  featured: boolean;
  featuredSort: number;
  recommendedDurationMs: number;
  accentColor: string | null;
  backgroundCss: string | null;
  preferredOrientation: string;
  iconKey: string;
}

export class PublishTemplateService {
  private get db() {
    return getDatabase();
  }

  async listFeatured(): Promise<PublishTemplateRow[]> {
    const rows = await this.db.findMany(`
      SELECT
        template_id,
        preset,
        segment,
        title,
        description,
        headline,
        featured,
        featured_sort,
        recommended_duration_ms,
        accent_color,
        background_css,
        preferred_orientation,
        icon_key
      FROM publish_templates
      WHERE is_active = true AND featured = true
      ORDER BY featured_sort ASC, template_id ASC
    `);
    return rows.map(this.mapRow);
  }

  async listAll(): Promise<PublishTemplateRow[]> {
    const rows = await this.db.findMany(`
      SELECT *
      FROM publish_templates
      WHERE is_active = true
      ORDER BY featured DESC, featured_sort ASC, template_id ASC
    `);
    return rows.map(this.mapRow);
  }

  private mapRow(row: any): PublishTemplateRow {
    return {
      templateId: row.template_id,
      preset: row.preset,
      segment: row.segment,
      title: row.title,
      description: row.description,
      headline: row.headline,
      featured: Boolean(row.featured),
      featuredSort: row.featured_sort ?? 0,
      recommendedDurationMs: row.recommended_duration_ms ?? 10000,
      accentColor: row.accent_color,
      backgroundCss: row.background_css,
      preferredOrientation: row.preferred_orientation || 'landscape',
      iconKey: row.icon_key || 'campaign',
    };
  }
}

let instance: PublishTemplateService | null = null;

export function getPublishTemplateService(): PublishTemplateService {
  if (!instance) instance = new PublishTemplateService();
  return instance;
}
