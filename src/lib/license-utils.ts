/**
 * Formata dias restantes em texto amigável.
 */
export function formatDaysLeft(expiresAt: string | null | undefined, customMinutes?: number | null): string {
  if (!expiresAt) {
    if (customMinutes) {
      const days = Math.floor(customMinutes / 1440);
      if (days > 0) return `${days} ${days === 1 ? "dia" : "dias"}`;
      const hours = Math.floor(customMinutes / 60);
      return `${hours}h`;
    }
    return "—";
  }
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirada";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days <= 0) return `${hours}h`;
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const LICENSE_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando ativação",
  active: "Ativa",
  expired: "Expirada",
  suspended: "Suspensa",
  revoked: "Revogada",
};
