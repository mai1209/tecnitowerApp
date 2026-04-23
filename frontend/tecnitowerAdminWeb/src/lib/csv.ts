import type { RegisterDefinition } from "../types";

export function serializeRegisterDefinitionsCsv(definitions: RegisterDefinition[]) {
  const headers = [
    "key",
    "label",
    "register",
    "verifyRegister",
    "scale",
    "step",
    "min",
    "max",
    "accessLevel",
    "functionCode",
    "writable",
    "visible",
    "description",
  ];

  const rows = [headers, ...definitions.map((item) => [
    item.key ?? "",
    item.label ?? "",
    item.register ?? "",
    item.verifyRegister ?? "",
    item.scale ?? "",
    item.step ?? "",
    item.min ?? "",
    item.max ?? "",
    item.accessLevel ?? "user",
    item.functionCode ?? "auto",
    item.writable !== false ? "true" : "false",
    item.visible !== false ? "true" : "false",
    item.description ?? "",
  ])];

  return rows
    .map((row) =>
      row
        .map((value) => {
          const normalized = String(value ?? "");
          if (/[,"\n]/.test(normalized)) {
            return `"${normalized.replaceAll('"', '""')}"`;
          }
          return normalized;
        })
        .join(",")
    )
    .join("\n");
}

export function parseRegisterDefinitionsCsv(text: string): RegisterDefinition[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value !== "" || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }

  if (rows.length < 2) {
    throw new Error("El CSV no tiene filas de datos");
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const indexOf = (name: string) => header.indexOf(name);
  const required = ["key", "label", "register"];
  for (const key of required) {
    if (indexOf(key) === -1) throw new Error(`Falta columna ${key}`);
  }

  const toOptionalNumber = (value: string) => {
    if (!value?.trim()) return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  };

  return rows.slice(1).map((cells) => {
    const get = (name: string) => {
      const index = indexOf(name);
      return index === -1 ? "" : String(cells[index] ?? "").trim();
    };

    return {
      key: get("key").toUpperCase(),
      label: get("label"),
      register: Number(get("register")),
      verifyRegister: toOptionalNumber(get("verifyRegister")),
      scale: toOptionalNumber(get("scale")) ?? 10,
      step: toOptionalNumber(get("step")) ?? 0.1,
      min: toOptionalNumber(get("min")),
      max: toOptionalNumber(get("max")),
      accessLevel: get("accessLevel") === "technician" ? "technician" : "user",
      functionCode: get("functionCode") === "0x06" || get("functionCode") === "0x10" ? (get("functionCode") as "0x06" | "0x10") : "auto",
      writable: get("writable").toLowerCase() !== "false",
      visible: get("visible").toLowerCase() !== "false",
      description: get("description") || undefined,
    } satisfies RegisterDefinition;
  });
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
