/** Shared SQL helpers. */
import type { ModelDef, FieldDef } from "./index";

const TYPE_MAP: Record<FieldDef["type"], string> = {
  string: "TEXT",
  text: "TEXT",
  int: "INTEGER",
  float: "DOUBLE PRECISION",
  bool: "BOOLEAN",
  timestamp: "TIMESTAMPTZ",
  uuid: "UUID",
  json: "JSONB",
};

export function tableName(modelName: string): string {
  // "Post" → "posts", "BlogPost" → "blog_posts"
  return modelName
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/s?$/, "s");
}

export function modelToCreateTable(m: ModelDef): string {
  const cols: string[] = [
    `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`,
    `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
    `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  ];
  for (const f of m.fields) {
    let line = `${f.name} ${TYPE_MAP[f.type]}`;
    if (f.required) line += " NOT NULL";
    if (f.unique) line += " UNIQUE";
    if (f.default) line += ` DEFAULT ${f.default}`;
    cols.push(line);
  }
  return `CREATE TABLE IF NOT EXISTS ${tableName(m.name)} (\n  ${cols.join(",\n  ")}\n);`;
}

export function modelToTSType(m: ModelDef): string {
  const TS_MAP: Record<FieldDef["type"], string> = {
    string: "string", text: "string", int: "number", float: "number",
    bool: "boolean", timestamp: "string", uuid: "string", json: "unknown",
  };
  const fields = m.fields
    .map((f) => `  ${f.name}${f.required ? "" : "?"}: ${TS_MAP[f.type]};`)
    .join("\n");
  return `export interface ${m.name} {\n  id: string;\n  created_at: string;\n  updated_at: string;\n${fields}\n}`;
}
