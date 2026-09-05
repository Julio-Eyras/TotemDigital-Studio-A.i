// Importar documentação completa
import { swaggerDocumentation } from './swagger-enhanced';
import generatedSpec from './openapi-generated.json';
import p0Spec from './openapi-p0.json';
import { canonicalSchemas } from './openapi-schemas';

type PathItem = Record<string, unknown>;
type Paths = Record<string, PathItem>;
type Tag = { name: string; description?: string };
type Components = {
  schemas?: Record<string, unknown>;
  securitySchemes?: Record<string, unknown>;
  [key: string]: unknown;
};

function mergePathItems(base: PathItem = {}, overlay: PathItem = {}): PathItem {
  return { ...base, ...overlay };
}

function mergeOpenApiPaths(base: Paths, overlay: Paths): Paths {
  const out: Paths = { ...base };
  for (const [pathKey, item] of Object.entries(overlay || {})) {
    out[pathKey] = mergePathItems(out[pathKey], item as PathItem);
  }
  return out;
}

const generated = generatedSpec as {
  info?: Record<string, unknown>;
  tags?: Tag[];
  paths?: Paths;
  components?: Components;
};

const p0 = p0Spec as {
  tags?: Tag[];
  paths?: Paths;
  components?: Components;
};

const enhancedTags = Array.isArray(swaggerDocumentation.tags) ? swaggerDocumentation.tags : [];
const generatedTags = Array.isArray(generated.tags) ? generated.tags : [];
const p0Tags = Array.isArray(p0.tags) ? p0.tags : [];
const tagByName = new Map<string, Tag>();
for (const t of [...generatedTags, ...enhancedTags, ...p0Tags]) {
  if (t?.name) tagByName.set(t.name, t);
}

const enhancedComponents = (swaggerDocumentation.components || {}) as Components;
const generatedComponents = generated.components || {};
const p0Components = p0.components || {};

export const openApiSpec = {
  ...swaggerDocumentation,
  openapi: '3.0.3',
  info: {
    ...swaggerDocumentation.info,
    title: 'TotemDigital Studio API',
    version: '2.1.15',
    description: [
      swaggerDocumentation.info?.description || '',
      '',
      'Catálogo completo gerado a partir dos routers (`openapi-generated.json`).',
      'swagger-enhanced sobrepõe PlaylistMix/publishers; `openapi-p0.json` fecha schemas de integração (login, player, installation, quick-publish/SPA, dispatcher).',
      '`openapi-schemas.ts` injeta biblioteca canônica de 120+ schemas (Requests/Responses/Entities/Billing/FX/ACE/Dispatcher).'
    ].join('\n'),
  },
  tags: Array.from(tagByName.values()),
  paths: mergeOpenApiPaths(
    mergeOpenApiPaths(generated.paths || {}, (swaggerDocumentation.paths || {}) as Paths),
    p0.paths || {}
  ),
  components: {
    ...generatedComponents,
    ...enhancedComponents,
    ...p0Components,
    schemas: {
      ...canonicalSchemas,
      ...(generatedComponents.schemas || {}),
      ...(enhancedComponents.schemas || {}),
      ...(p0Components.schemas || {}),
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      ...(enhancedComponents.securitySchemes || {}),
      ...(p0Components.securitySchemes || {}),
    },
  },
};
