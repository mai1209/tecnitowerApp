export function formatDate(value?: string) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("es-AR", {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}
