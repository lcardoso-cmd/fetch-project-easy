// Histórico de versões da Proposta — persistido em localStorage.
// Cada versão guarda um snapshot completo do formulário + output gerado.

export const VERSIONS_KEY = "jurismind:proposal-versions:v1";
export const MAX_VERSIONS = 30;

export type ProposalVersion<TForm = unknown> = {
  id: string;
  createdAt: number;
  label: string;
  origin: "manual" | "auto-generate" | "auto-restore";
  form: TForm;
  output: string;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadVersions<TForm>(): ProposalVersion<TForm>[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<ProposalVersion<TForm>[]>(window.localStorage.getItem(VERSIONS_KEY));
  if (!Array.isArray(list)) return [];
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function saveVersions<TForm>(list: ProposalVersion<TForm>[]) {
  try {
    const trimmed = list
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_VERSIONS);
    window.localStorage.setItem(VERSIONS_KEY, JSON.stringify(trimmed));
  } catch {
    // storage cheio — ignora
  }
}

export function addVersion<TForm>(
  entry: Omit<ProposalVersion<TForm>, "id" | "createdAt"> & { createdAt?: number },
): ProposalVersion<TForm> {
  const v: ProposalVersion<TForm> = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: entry.createdAt ?? Date.now(),
    label: entry.label,
    origin: entry.origin,
    form: entry.form,
    output: entry.output,
  };
  const list = loadVersions<TForm>();
  list.unshift(v);
  saveVersions(list);
  return v;
}

export function removeVersion(id: string) {
  const list = loadVersions();
  saveVersions(list.filter((v) => v.id !== id));
}

export function clearVersions() {
  try {
    window.localStorage.removeItem(VERSIONS_KEY);
  } catch {
    // ignora
  }
}

export function formatVersionDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
