# Componentes Reutilizáveis - SmartSignage Pro v2.1

Este diretório contém componentes reutilizáveis criados como parte do Design System.

## Estrutura

```
components/
├── DataDisplay/
│   ├── PageHeader/      # Header padronizado com breadcrumbs
│   └── DataTable/       # Tabela avançada com ordenação e filtros
├── Forms/
│   └── FormDialog/      # Dialog de formulário com tabs
└── ...
```

## Componentes

### PageHeader

Header padronizado para páginas com breadcrumbs e ações.

```tsx
import { PageHeader } from '@/components/DataDisplay';

<PageHeader
  title="Subscribers"
  subtitle="Gerencie seus assinantes"
  breadcrumbs={[
    { label: 'Home', path: '/dashboard' },
    { label: 'Subscribers' },
  ]}
  actions={[
    {
      label: 'Novo',
      icon: <Add />,
      onClick: () => handleNew(),
    },
  ]}
  onRefresh={() => handleRefresh()}
/>
```

### DataTable

Tabela avançada com ordenação, filtros, seleção múltipla e exportação.

```tsx
import { DataTable } from '@/components/DataDisplay';

<DataTable
  data={subscribers}
  columns={[
    { id: 'name', label: 'Nome', sortable: true },
    { id: 'email', label: 'Email', sortable: true },
    { id: 'status', label: 'Status', render: (value) => <Chip label={value} /> },
  ]}
  actions={[
    {
      label: 'Editar',
      icon: <Edit />,
      onClick: (row) => handleEdit(row),
    },
    {
      label: 'Deletar',
      icon: <Delete />,
      onClick: (row) => handleDelete(row),
      color: 'error',
    },
  ]}
  selectable
  onSelectionChange={(selected) => console.log(selected)}
  pagination={{
    page: 1,
    limit: 10,
    total: 100,
    onPageChange: (page) => setPage(page),
    onLimitChange: (limit) => setLimit(limit),
  }}
/>
```

### FormDialog

Dialog de formulário com suporte a tabs, validação e auto-save.

```tsx
import { FormDialog } from '@/components/Forms';

<FormDialog
  open={open}
  mode="edit"
  title="Editar Subscriber"
  item={selectedItem}
  onClose={() => setOpen(false)}
  onSubmit={async (data) => {
    await updateSubscriber(data);
  }}
  tabs={[
    {
      label: 'Básico',
      component: BasicFormTab,
    },
    {
      label: 'Avançado',
      component: AdvancedFormTab,
    },
  ]}
  autoSave
  confirmClose
/>
```

## Hooks

### usePaginatedData

Hook para gerenciar dados paginados.

```tsx
import { usePaginatedData } from '@/hooks/usePaginatedData';

const {
  page,
  limit,
  paginatedData,
  setPage,
  setLimit,
  goToNextPage,
  hasNextPage,
} = usePaginatedData({
  data: allSubscribers,
  initialPage: 1,
  initialLimit: 10,
});
```

### useDialog

Hook para gerenciar estado de dialogs.

```tsx
import { useDialog } from '@/hooks/useDialog';

const { open, openDialog, closeDialog } = useDialog();
```

### useForm

Hook para gerenciar formulários com validação.

```tsx
import { useForm } from '@/hooks/useForm';

const {
  values,
  errors,
  setValue,
  validate,
  handleSubmit,
  getFieldProps,
} = useForm({
  initialValues: { name: '', email: '' },
  fields: [
    {
      name: 'name',
      required: true,
      rules: [
        {
          validator: (value) => value.length >= 3,
          message: 'Nome deve ter pelo menos 3 caracteres',
        },
      ],
    },
    {
      name: 'email',
      required: true,
      rules: [
        {
          validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
          message: 'Email inválido',
        },
      ],
    },
  ],
  onSubmit: async (data) => {
    await createSubscriber(data);
  },
});
```

## Design Tokens

Os tokens de design estão disponíveis em `@/theme/designTokens`:

```tsx
import { designTokens } from '@/theme';

// Cores
designTokens.status.success; // '#4caf50'
designTokens.primary.main;   // '#1976d2'

// Espaçamento
designTokens.spacing.md;     // 16

// Tipografia
designTokens.typography.h1;  // { fontSize: '32px', fontWeight: 700 }
```
