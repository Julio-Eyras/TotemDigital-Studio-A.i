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

  async updateTemplate(
    templateId: number,
    patch: Partial<{
      title: string;
      description: string;
      headline: string;
      featured: boolean;
      featuredSort: number;
      recommendedDurationMs: number;
      accentColor: string;
      backgroundCss: string;
      preferredOrientation: string;
      iconKey: string;
      isActive: boolean;
    }>
  ): Promise<PublishTemplateRow | null> {
    const existing = await this.db.findFirst(`
      SELECT template_id FROM publish_templates WHERE template_id = $1
    `, [templateId]);
    if (!existing) return null;

    const result = await this.db.executeRaw(`
      UPDATE publish_templates SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        headline = COALESCE($4, headline),
        featured = COALESCE($5, featured),
        featured_sort = COALESCE($6, featured_sort),
        recommended_duration_ms = COALESCE($7, recommended_duration_ms),
        accent_color = COALESCE($8, accent_color),
        background_css = COALESCE($9, background_css),
        preferred_orientation = COALESCE($10, preferred_orientation),
        icon_key = COALESCE($11, icon_key),
        is_active = COALESCE($12, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE template_id = $1
      RETURNING *
    `, [
      templateId,
      patch.title ?? null,
      patch.description ?? null,
      patch.headline ?? null,
      patch.featured ?? null,
      patch.featuredSort ?? null,
      patch.recommendedDurationMs ?? null,
      patch.accentColor ?? null,
      patch.backgroundCss ?? null,
      patch.preferredOrientation ?? null,
      patch.iconKey ?? null,
      patch.isActive ?? null,
    ]);
    return this.mapRow(result.rows[0]);
  }

  async getById(templateId: number): Promise<PublishTemplateRow | null> {
    const row = await this.db.findFirst(`
      SELECT * FROM publish_templates WHERE template_id = $1
    `, [templateId]);
    return row ? this.mapRow(row) : null;
  }

  async createTemplate(input: {
    preset: string;
    segment?: string | null;
    title: string;
    description?: string | null;
    headline?: string | null;
    featured?: boolean;
    featuredSort?: number;
    recommendedDurationMs?: number;
    accentColor?: string | null;
    backgroundCss?: string | null;
    preferredOrientation?: string;
    iconKey?: string;
  }): Promise<PublishTemplateRow> {
    const result = await this.db.executeRaw(`
      INSERT INTO publish_templates (
        preset, segment, title, description, headline, featured, featured_sort,
        recommended_duration_ms, accent_color, background_css, preferred_orientation, icon_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      input.preset,
      input.segment ?? null,
      input.title,
      input.description ?? null,
      input.headline ?? null,
      input.featured ?? false,
      input.featuredSort ?? 100,
      input.recommendedDurationMs ?? 10000,
      input.accentColor ?? null,
      input.backgroundCss ?? null,
      input.preferredOrientation ?? 'landscape',
      input.iconKey ?? 'campaign',
    ]);
    return this.mapRow(result.rows[0]);
  }

  async duplicateTemplate(templateId: number): Promise<PublishTemplateRow | null> {
    const source = await this.getById(templateId);
    if (!source) return null;
    return this.createTemplate({
      preset: source.preset,
      segment: source.segment,
      title: `${source.title} (cópia)`,
      description: source.description,
      headline: source.headline,
      featured: false,
      featuredSort: (source.featuredSort ?? 100) + 1,
      recommendedDurationMs: source.recommendedDurationMs,
      accentColor: source.accentColor,
      backgroundCss: source.backgroundCss,
      preferredOrientation: source.preferredOrientation,
      iconKey: source.iconKey,
    });
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
