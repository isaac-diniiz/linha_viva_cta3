export type ThemeOption = { id: string; title: string; cardCount: number };

type Props = {
  themes: ThemeOption[];
  selectedId: string;
  disabled: boolean;
  onChoose: (themeId: string) => void;
};

export function ThemePicker({ themes, selectedId, disabled, onChoose }: Props) {
  return (
    <fieldset className="theme-picker">
      <legend>Tema da atividade</legend>
      <div className="theme-options">
        {themes.map((theme) => (
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
            <span className="theme-count">{theme.cardCount} cartões</span>
          </label>
        ))}
      </div>
      {disabled && (
        <p className="small-help">
          O tema fica travado depois de iniciar. Use Reiniciar demonstração para
          escolher outro.
        </p>
      )}
    </fieldset>
  );
}
