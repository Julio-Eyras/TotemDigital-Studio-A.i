export interface IssueInvoicesResultLike {
  created: number;
  skipped: number;
  errors: Array<{ contractId: number; message: string }>;
}

export function formatIssueInvoicesMessage(result: IssueInvoicesResultLike): string {
  const parts = [
    `${result.created} criada(s)`,
    `${result.skipped} já existente(s)`,
  ];
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} erro(s)`);
  }
  return `Emissão concluída: ${parts.join(', ')}.`;
}

export function formatRevenueSharePayoutMessage(
  repasse: IssueInvoicesResultLike | undefined
): string | null {
  if (!repasse) return null;
  if (repasse.created === 0 && repasse.errors.length === 0) return null;
  return `Repasse organização: ${repasse.created} criado(s), ${repasse.skipped} ignorado(s)${
    repasse.errors.length ? `, ${repasse.errors.length} erro(s)` : ''
  }.`;
}
