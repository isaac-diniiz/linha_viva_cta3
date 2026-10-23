import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseActivity, type Theme } from "./activity";

export type Catalog = {
  themes: Theme[];
  rejected: { file: string; errors: string[] }[];
};

/**
 * Lê cada `<id>.json` da pasta de atividades. Arquivos inválidos ficam fora do
 * catálogo, com os motivos, e os válidos continuam disponíveis ao professor.
 */
export function loadActivities(dir: string): Catalog {
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .sort();
  } catch {
    return {
      themes: [],
      rejected: [
        { file: dir, errors: ["Pasta de atividades não encontrada."] },
      ],
    };
  }
  const catalog: Catalog = { themes: [], rejected: [] };
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (error) {
      catalog.rejected.push({
        file,
        errors: [`JSON inválido: ${(error as Error).message}`],
      });
      continue;
    }
    const result = parseActivity(raw);
    if (!result.ok) catalog.rejected.push({ file, errors: result.errors });
    else if (`${result.theme.id}.json` !== file)
      catalog.rejected.push({
        file,
        errors: [
          `id: "${result.theme.id}" não combina com o arquivo ${file}; renomeie o arquivo para ${result.theme.id}.json ou ajuste o id.`,
        ],
      });
    else catalog.themes.push(result.theme);
  }
  return catalog;
}

export function findTheme(themes: Theme[], id: string): Theme {
  const theme = themes.find((candidate) => candidate.id === id);
  if (!theme) throw new Error(`Tema desconhecido: ${id}.`);
  return theme;
}
