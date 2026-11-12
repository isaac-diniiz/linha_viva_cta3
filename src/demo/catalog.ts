import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parseActivity, type Theme } from "./activity";
import { isCustomLineId } from "./customLine";

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

/** Ids de todos os arquivos `.json` da pasta, inclusive os rejeitados, para não repetir nomes. */
export function activityFileIds(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -".json".length));
  } catch {
    return [];
  }
}

/**
 * Grava uma atividade criada no painel como `<id>.json`, o mesmo formato das
 * demais. Nunca sobrescreve um arquivo existente; devolve false se não gravou.
 */
export function saveActivity(dir: string, id: string, raw: unknown): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${id}.json`),
      `${JSON.stringify(raw, null, 2)}\n`,
      {
        flag: "wx",
      },
    );
    return true;
  } catch (error) {
    console.warn(
      `Não foi possível salvar a atividade ${id} em ${dir}: ${(error as Error).message}`,
    );
    return false;
  }
}

/**
 * Regrava o arquivo de uma linha criada no painel (edição). Só mexe em
 * `criada-*.json` que já existe; escreve num arquivo temporário e renomeia, para
 * nunca deixar o arquivo pela metade.
 */
export function replaceActivity(
  dir: string,
  id: string,
  raw: unknown,
): boolean {
  if (!isCustomLineId(id)) return false;
  const target = join(dir, `${id}.json`);
  const temporary = join(dir, `.${id}.json.tmp`);
  try {
    if (!existsSync(target)) return false;
    writeFileSync(temporary, `${JSON.stringify(raw, null, 2)}\n`);
    renameSync(temporary, target);
    return true;
  } catch (error) {
    rmSync(temporary, { force: true });
    console.warn(
      `Não foi possível regravar a atividade ${id} em ${dir}: ${(error as Error).message}`,
    );
    return false;
  }
}

/** Apaga o arquivo de uma linha criada no painel. Atividades prontas nunca são apagadas. */
export function deleteActivity(dir: string, id: string): boolean {
  if (!isCustomLineId(id)) return false;
  try {
    unlinkSync(join(dir, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}
