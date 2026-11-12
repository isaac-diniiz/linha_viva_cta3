import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { MAX_CARDS, MAX_CARD_LENGTH, MIN_CARDS } from "../demo/activity";
import {
  createCustomActivity,
  lineFormOf,
  type CustomLineForm,
} from "../demo/customLine";

type Props = {
  /**
   * Muda quando o servidor confirma o que foi enviado (linha nova no menu ou
   * edição gravada); nesse momento o formulário se fecha sozinho.
   */
  savedKey: string | number;
  /** Onde a linha fica guardada, para o texto de ajuda dizer a verdade. */
  storage?: "supabase" | "arquivos";
  /** Linha criada antes, a editar; ausente quando se cria uma linha nova. */
  editing?: { id: string; form: CustomLineForm };
  onSubmit: (form: CustomLineForm) => void;
  onClose: () => void;
};

/** O que o professor escreveu, já limpo como o servidor guarda, para comparar. */
function normalized(form: CustomLineForm, id?: string): string | null {
  const result = createCustomActivity(form, [], id);
  return result.ok ? JSON.stringify(lineFormOf(result.theme)) : null;
}

/** Enter num campo nunca envia o formulário: só o botão finaliza a linha. */
const isEnter = (event: KeyboardEvent) =>
  event.key === "Enter" && !event.nativeEvent.isComposing;

/** Formulário em que o professor monta (ou edita) uma linha: tema, pontas e cartões. */
export function LineCreator({
  savedKey,
  storage = "arquivos",
  editing,
  onSubmit,
  onClose,
}: Props) {
  const initial = editing?.form;
  const [title, setTitle] = useState(initial?.titulo ?? "");
  const [start, setStart] = useState(initial?.inicio ?? "");
  const [end, setEnd] = useState(initial?.fim ?? "");
  const [cards, setCards] = useState<string[]>(
    () => initial?.cartoes ?? Array.from({ length: MIN_CARDS }, () => ""),
  );
  const [subject, setSubject] = useState(initial?.disciplina ?? "");
  const [grade, setGrade] = useState(initial?.serie ?? "");
  const [instruction, setInstruction] = useState(initial?.instrucao ?? "");
  const [shuffle, setShuffle] = useState(initial?.embaralhar ?? true);
  const [errors, setErrors] = useState<string[]>([]);
  const pendingFocus = useRef<number | null>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<(HTMLInputElement | null)[]>([]);
  // "Mais opções" já abre quando a linha editada tem algo preenchido ali
  const moreOpen = useRef(
    Boolean(initial?.disciplina || initial?.serie || initial?.instrucao),
  );

  // o servidor confirma ao mudar o que o painel recebe (linha nova ou edição)
  const initialKey = useRef(savedKey);
  useEffect(() => {
    if (savedKey !== initialKey.current) onClose();
  }, [savedKey, onClose]);

  // depois de inserir um cartão, o foco vai para ele
  useEffect(() => {
    if (pendingFocus.current === null) return;
    cardRefs.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  }, [cards]);

  const setCard = (index: number, value: string) =>
    setCards((current) =>
      current.map((card, position) => (position === index ? value : card)),
    );
  const move = (index: number, by: -1 | 1) =>
    setCards((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });

  const addCardAfter = (index: number) => {
    if (cards.length >= MAX_CARDS) return;
    setCards((current) => [
      ...current.slice(0, index + 1),
      "",
      ...current.slice(index + 1),
    ]);
    pendingFocus.current = index + 1;
  };
  const onCardKeyDown = (event: KeyboardEvent, index: number) => {
    if (!isEnter(event)) return;
    event.preventDefault();
    // cartão seguinte ainda vazio: não cria outro, só segue para ele
    if (index + 1 < cards.length && cards[index + 1].trim() === "") {
      cardRefs.current[index + 1]?.focus();
      return;
    }
    addCardAfter(index);
  };
  const focusOnEnter = (event: KeyboardEvent, next: () => void) => {
    if (!isEnter(event)) return;
    event.preventDefault();
    next();
  };
  // nenhum outro campo de texto envia o formulário com o Enter
  const blockEnterSubmit = (event: KeyboardEvent<HTMLFormElement>) => {
    if (isEnter(event) && event.target instanceof HTMLInputElement)
      event.preventDefault();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const form: CustomLineForm = {
      titulo: title,
      inicio: start,
      fim: end,
      cartoes: cards,
      embaralhar: shuffle,
      ...(subject.trim() ? { disciplina: subject } : {}),
      ...(grade.trim() ? { serie: grade } : {}),
      ...(instruction.trim() ? { instrucao: instruction } : {}),
    };
    const result = createCustomActivity(form, [], editing?.id);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    // editar sem mudar nada: não há o que enviar nem o que o servidor confirme
    if (
      editing &&
      normalized(form, editing.id) === normalized(editing.form, editing.id)
    ) {
      onClose();
      return;
    }
    onSubmit(form);
  };

  return (
    <form
      className="line-creator"
      onSubmit={submit}
      onKeyDown={blockEnterSubmit}
      noValidate
    >
      <h2>{editing ? "Editar linha" : "Criar linha"}</h2>
      <div className="line-creator-field">
        <label htmlFor="line-title">Tema da linha</label>
        <input
          id="line-title"
          type="text"
          value={title}
          maxLength={120}
          placeholder="Ex.: Fases da nossa escola"
          onKeyDown={(event) =>
            focusOnEnter(event, () => startRef.current?.focus())
          }
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="line-creator-ends">
        <div className="line-creator-field">
          <label htmlFor="line-start">Ponta da esquerda</label>
          <input
            id="line-start"
            ref={startRef}
            type="text"
            value={start}
            maxLength={40}
            placeholder="Ex.: Mais antigo"
            onKeyDown={(event) =>
              focusOnEnter(event, () => endRef.current?.focus())
            }
            onChange={(event) => setStart(event.target.value)}
          />
        </div>
        <div className="line-creator-field">
          <label htmlFor="line-end">Ponta da direita</label>
          <input
            id="line-end"
            ref={endRef}
            type="text"
            value={end}
            maxLength={40}
            placeholder="Ex.: Mais recente"
            onKeyDown={(event) =>
              focusOnEnter(event, () => cardRefs.current[0]?.focus())
            }
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
      </div>

      <fieldset className="line-creator-cards">
        <legend>Cartões, da esquerda para a direita</legend>
        <p className="small-help">
          Escreva os cartões na ordem correta: o primeiro cartão fica na ponta
          da esquerda e o último, na da direita. Aperte Enter para começar o
          próximo cartão.
        </p>
        <ol>
          {cards.map((card, index) => {
            const number = index + 1;
            return (
              <li key={index}>
                <span className="line-creator-number" aria-hidden="true">
                  {number}
                </span>
                <input
                  type="text"
                  ref={(element) => {
                    cardRefs.current[index] = element;
                  }}
                  aria-label={`Cartão ${number}`}
                  value={card}
                  maxLength={MAX_CARD_LENGTH}
                  onKeyDown={(event) => onCardKeyDown(event, index)}
                  onChange={(event) => setCard(index, event.target.value)}
                />
                <span className="line-creator-row-actions">
                  <button
                    type="button"
                    className="button subtle"
                    aria-label={`Subir cartão ${number}`}
                    title="Subir"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="button subtle"
                    aria-label={`Descer cartão ${number}`}
                    title="Descer"
                    disabled={index === cards.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="button subtle"
                    aria-label={`Remover cartão ${number}`}
                    title="Remover"
                    disabled={cards.length <= MIN_CARDS}
                    onClick={() =>
                      setCards((current) =>
                        current.filter((_, position) => position !== index),
                      )
                    }
                  >
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="line-creator-count">
          <span>{cards.length} cartões</span>
          <button
            type="button"
            className="button secondary"
            disabled={cards.length >= MAX_CARDS}
            onClick={() => setCards((current) => [...current, ""])}
          >
            Adicionar cartão
          </button>
        </div>
      </fieldset>

      <label className="teacher-plays">
        <input
          type="checkbox"
          checked={shuffle}
          onChange={(event) => setShuffle(event.target.checked)}
        />
        Embaralhar os cartões entre os participantes
      </label>
      <p className="small-help">
        Ligado, a ordem de entrada dos alunos não revela a resposta. Com poucos
        participantes, aumente os cartões por participante antes de iniciar.
      </p>

      <details className="line-creator-more" open={moreOpen.current}>
        <summary>Mais opções</summary>
        <div className="line-creator-ends">
          <div className="line-creator-field">
            <label htmlFor="line-subject">Disciplina</label>
            <input
              id="line-subject"
              type="text"
              value={subject}
              maxLength={40}
              placeholder="Minhas linhas"
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="line-creator-field">
            <label htmlFor="line-grade">Série</label>
            <input
              id="line-grade"
              type="text"
              value={grade}
              maxLength={40}
              placeholder="Livre"
              onChange={(event) => setGrade(event.target.value)}
            />
          </div>
        </div>
        <div className="line-creator-field">
          <label htmlFor="line-instruction">
            Instrução para os alunos (opcional)
          </label>
          <textarea
            id="line-instruction"
            rows={3}
            value={instruction}
            maxLength={500}
            placeholder="Se ficar em branco, a instrução cita as duas pontas."
            onChange={(event) => setInstruction(event.target.value)}
          />
        </div>
      </details>

      <p className="small-help">
        {storage === "supabase"
          ? "A linha fica salva no Supabase, continua lá depois que o servidor reinicia e aparece no menu Tema da atividade."
          : "A linha fica salva na pasta atividades do servidor e aparece no menu Tema da atividade. Em hospedagem gratuita, o arquivo pode ser apagado quando o servidor reinicia."}
      </p>
      {errors.length > 0 && (
        <div className="notice error" role="alert">
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="line-creator-actions">
        <button type="submit" className="button primary">
          {editing ? "Salvar alterações" : "Criar e usar esta linha"}
        </button>
        <button type="button" className="button secondary" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
