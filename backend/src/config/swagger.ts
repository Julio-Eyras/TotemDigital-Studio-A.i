// Importar documentação completa
import { swaggerDocumentation } from './swagger-enhanced';
import generatedSpec from './openapi-generated.json';

type PathItem = Record<string, unknown>;
type Paths = Record<string, PathItem>;

function mergePathItems(base: PathItem = {}, overlay: PathItem = {}): PathItem {
  return { ...base, ...overlay };
}

function mergeOpenApiPaths(generated: Paths, enhanced: Paths): Paths {
  const out: Paths = { ...generated };
  for (const [pathKey, item] of Object.entries(enhanced || {})) {
    out[pathKey] = mergePathItems(out[pathKey], item as PathItem);
  }
  return out;
}

const generated = generatedSpec as {
  info?: Record<string, unknown>;
  tags?: Array<{ name: string; description?: string }>;
  paths?: Paths;
  components?: Record<string, unknown>;
};

const enhancedTags = Array.isArray(swaggerDocumentation.tags) ? swaggerDocumentation.tags : [];
const generatedTags = Array.isArray(generated.tags) ? generated.tags : [];
const tagByName = new Map<string, { name: string; description?: string }>();
for (const t of [...generatedTags, ...enhancedTags]) {
  if (t?.name) tagByName.set(t.name, t);
}

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
      'Os paths com schemas detalhados em swagger-enhanced sobrepõem o gerado.',
    ].join('\n'),
  },
  tags: Array.from(tagByName.values()),
  paths: mergeOpenApiPaths(generated.paths || {}, (swaggerDocumentation.paths || {}) as Paths),
  components: {
    ...(generated.components || {}),
    ...(swaggerDocumentation.components || {}),
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      ...((swaggerDocumentation.components as any)?.securitySchemes || {}),
    },
  },
};
