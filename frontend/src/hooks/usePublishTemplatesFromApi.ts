import { useEffect, useMemo, useState } from 'react';
import { publishTemplatesApi, PublishTemplateDto } from '../services/api';
import type { QuickPublishPreset } from '../services/api';
import {
  FEATURED_TEMPLATES,
  FeaturedTemplateConfig,
  PUBLISH_PRESETS,
  PublishPresetConfig,
  findPublishPreset,
} from '../config/publishTemplates';

const ICON_KEYS = ['storefront', 'campaign', 'tv', 'auto_awesome', 'business'] as const;

function mapFeaturedFromApi(rows: PublishTemplateDto[]): FeaturedTemplateConfig[] {
  return rows.map((row) => ({
    value: row.preset,
    segment: row.segment || 'retail',
    title: row.title,
    description: row.description || '',
    iconKey:
      (ICON_KEYS.includes(row.iconKey as (typeof ICON_KEYS)[number])
        ? row.iconKey
        : 'campaign') as FeaturedTemplateConfig['iconKey'],
  }));
}

function mergePresetWithApi(
  preset: PublishPresetConfig,
  apiRow?: PublishTemplateDto
): PublishPresetConfig {
  if (!apiRow) return preset;
  return {
    ...preset,
    headline: apiRow.headline || preset.headline,
    recommendedDurationMs: apiRow.recommendedDurationMs ?? preset.recommendedDurationMs,
    accentColor: apiRow.accentColor || preset.accentColor,
    background: apiRow.backgroundCss || preset.background,
    preferredOrientation: apiRow.preferredOrientation ?? preset.preferredOrientation,
    descriptionTemplate: apiRow.description || preset.descriptionTemplate,
  };
}

export function usePublishTemplatesFromApi() {
  const [apiTemplates, setApiTemplates] = useState<PublishTemplateDto[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    publishTemplatesApi
      .getFeatured()
      .then((res) => {
        if (cancelled) return;
        const rows = res.data || [];
        setApiTemplates(rows.length > 0 ? rows : null);
      })
      .catch(() => {
        if (!cancelled) setApiTemplates(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredTemplates = useMemo(
    () => (apiTemplates ? mapFeaturedFromApi(apiTemplates) : FEATURED_TEMPLATES),
    [apiTemplates]
  );

  const presets = useMemo(() => {
    if (!apiTemplates) return PUBLISH_PRESETS;
    return PUBLISH_PRESETS.map((preset) => {
      const apiRow = apiTemplates.find((row) => row.preset === preset.value);
      return mergePresetWithApi(preset, apiRow);
    });
  }, [apiTemplates]);

  const getPreset = (value: QuickPublishPreset): PublishPresetConfig => {
    const merged = presets.find((p) => p.value === value);
    return merged ?? findPublishPreset(value);
  };

  return {
    presets,
    featuredTemplates,
    getPreset,
    loading,
    fromApi: Boolean(apiTemplates?.length),
  };
}
