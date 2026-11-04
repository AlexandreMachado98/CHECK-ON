// O histórico mostra a pergunta como estava no dia da inspeção (cópia gravada na resposta),
// e não o texto atual do modelo. Respostas antigas, sem cópia, continuam usando o item atual.

interface SnapshotFields {
  itemText?: string | null;
  itemType?: string | null;
  itemIsCritical?: boolean | null;
}

interface ItemLike {
  text: string;
  type: string;
  isCritical: boolean;
}

export function itemAsAnswered<I extends ItemLike>(item: I | null | undefined, answer: SnapshotFields | null | undefined): I | null {
  if (!item) return item ?? null;
  if (!answer) return item;
  return {
    ...item,
    text: answer.itemText ?? item.text,
    type: answer.itemType ?? item.type,
    isCritical: answer.itemIsCritical ?? item.isCritical,
  };
}

export function withAnsweredItem<A extends SnapshotFields & { item?: ItemLike | null }>(answer: A): A {
  return { ...answer, item: itemAsAnswered(answer.item, answer) };
}
