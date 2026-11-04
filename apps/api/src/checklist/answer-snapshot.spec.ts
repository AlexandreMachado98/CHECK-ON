import { itemAsAnswered, withAnsweredItem } from './answer-snapshot';

const current = { id: 'i1', text: 'Pneus dianteiros e traseiros', type: 'NUMBER', isCritical: false };

describe('answer-snapshot', () => {
  it('mostra a pergunta como estava no dia da resposta', () => {
    const answer = { itemText: 'Pneus', itemType: 'PASS_FAIL', itemIsCritical: true, item: current };
    expect(withAnsweredItem(answer).item).toEqual({ id: 'i1', text: 'Pneus', type: 'PASS_FAIL', isCritical: true });
  });

  it('resposta antiga sem cópia usa o item atual', () => {
    const answer = { itemText: null, itemType: null, itemIsCritical: null, item: current };
    expect(withAnsweredItem(answer).item).toEqual(current);
  });

  it('não quebra sem item ou sem resposta', () => {
    expect(itemAsAnswered(null, { itemText: 'x' })).toBeNull();
    expect(itemAsAnswered(current, null)).toBe(current);
  });
});
