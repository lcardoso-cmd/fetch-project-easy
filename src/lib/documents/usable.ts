/**
 * Documento já consultável pelo JurisMind.
 * Inclui a leitura parcial ("partial: ..."), que também gera trechos indexados.
 */
export function isDocUsable(status: string | null | undefined): boolean {
  return status === "ready" || Boolean(status?.startsWith("partial"));
}
