export type ThemeOption = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  cardCount: number;
};

type Props = {
  themes: ThemeOption[];
  selectedId: string;
  disabled: boolean;
  onChoose: (themeId: string) => void;
};

/** Número inicial da série ("3º ano" → 3), para ordenar 3º antes de 10º. */
function gradeNumber(grade: string): number {
  const match = /\d+/.exec(grade);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function bySubject(themes: ThemeOption[]): [string, ThemeOption[]][] {
  const groups = new Map<string, ThemeOption[]>();
  for (const theme of themes)
    groups.set(theme.subject, [...(groups.get(theme.subject) ?? []), theme]);
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([subject, list]) => [
      subject,
      [...list].sort(
        (a, b) =>
          gradeNumber(a.grade) - gradeNumber(b.grade) ||
          a.title.localeCompare(b.title, "pt-BR"),
      ),
    ]);
}

export function ThemePicker({ themes, selectedId, disabled, onChoose }: Props) {
  return (
    <fieldset className="theme-picker">
      <legend>Tema da atividade</legend>
      {bySubject(themes).map(([subject, list]) => (
        <div
          key={subject}
          className="theme-subject"
          role="group"
          aria-label={subject}
        >
          <div className="theme-subject-name" aria-hidden="true">
            {subject}
          </div>
          <div className="theme-options">
            {list.map((theme) => (
              <label
                key={theme.id}
                className={`theme-option${theme.id === selectedId ? " selected" : ""}`}
              >
                <input
                  type="radio"
                  name="tema-da-atividade"
                  value={theme.id}
                  checked={theme.id === selectedId}
                  disabled={disabled}
                  onChange={() => onChoose(theme.id)}
                />
                <span className="theme-title">{theme.title}</span>
                <span className="theme-count">
                  {theme.grade} · {theme.cardCount} cartões
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {disabled && (
        <p className="small-help">
          O tema fica travado depois de iniciar. Use Reiniciar demonstração para
          escolher outro.
        </p>
      )}
    </fieldset>
  );
}
