import type {
  ScenarioContent,
  TurnDefinition,
  TurnInjectDef,
  TurnCardConfig,
} from "../../../core/scenario-api.service";

/** Return a new content with the turn appended and its turn_index auto-set. */
export function addTurn(
  content: ScenarioContent,
  turn: TurnDefinition,
): ScenarioContent {
  const turns = content.turns ?? [];
  return { ...content, turns: [...turns, { ...turn, turn_index: turns.length }] };
}

/** Remove a turn by turn_index and renumber the remaining turns. */
export function removeTurn(
  content: ScenarioContent,
  turnIndex: number,
): ScenarioContent {
  const turns = (content.turns ?? [])
    .filter((t) => t.turn_index !== turnIndex)
    .map((t, i) => ({ ...t, turn_index: i }));
  return { ...content, turns };
}

/** Spread partial updates over the turn found by turn_index. */
export function updateTurn(
  content: ScenarioContent,
  turnIndex: number,
  updates: Partial<TurnDefinition>,
): ScenarioContent {
  const turns = (content.turns ?? []).map((t) =>
    t.turn_index === turnIndex ? { ...t, ...updates } : t,
  );
  return { ...content, turns };
}

/** Move a turn from one array position to another and renumber all. */
export function reorderTurns(
  content: ScenarioContent,
  fromIndex: number,
  toIndex: number,
): ScenarioContent {
  const turns = [...(content.turns ?? [])];
  const [moved] = turns.splice(fromIndex, 1);
  turns.splice(toIndex, 0, moved);
  const renumbered = turns.map((t, i) => ({ ...t, turn_index: i }));
  return { ...content, turns: renumbered };
}

/** Clone the turn, insert after original, and renumber all subsequent. */
export function duplicateTurn(
  content: ScenarioContent,
  turnIndex: number,
): ScenarioContent {
  const turns = [...(content.turns ?? [])];
  const source = turns.find((t) => t.turn_index === turnIndex);
  if (!source) return content;
  const clone = { ...source, title: `${source.title} (copy)` };
  turns.splice(turnIndex + 1, 0, clone);
  const renumbered = turns.map((t, i) => ({ ...t, turn_index: i }));
  return { ...content, turns: renumbered };
}

/** Append an inject to the specified turn's injects array. */
export function addInjectToTurn(
  content: ScenarioContent,
  turnIndex: number,
  inject: TurnInjectDef,
): ScenarioContent {
  const turns = (content.turns ?? []).map((t) =>
    t.turn_index === turnIndex
      ? { ...t, injects: [...t.injects, inject] }
      : t,
  );
  return { ...content, turns };
}

/** Remove an inject by its position within the turn's injects array. */
export function removeInjectFromTurn(
  content: ScenarioContent,
  turnIndex: number,
  injectIndex: number,
): ScenarioContent {
  const turns = (content.turns ?? []).map((t) =>
    t.turn_index === turnIndex
      ? { ...t, injects: t.injects.filter((_, i) => i !== injectIndex) }
      : t,
  );
  return { ...content, turns };
}

/** Update an inject by its position within the turn's injects array. */
export function updateInjectInTurn(
  content: ScenarioContent,
  turnIndex: number,
  injectIndex: number,
  updates: Partial<TurnInjectDef>,
): ScenarioContent {
  const turns = (content.turns ?? []).map((t) =>
    t.turn_index === turnIndex
      ? {
          ...t,
          injects: t.injects.map((inj, i) =>
            i === injectIndex ? { ...inj, ...updates } : inj,
          ),
        }
      : t,
  );
  return { ...content, turns };
}

/** Append a card config to the specified turn's available_cards. */
export function addCardToTurn(
  content: ScenarioContent,
  turnIndex: number,
  cardConfig: TurnCardConfig,
): ScenarioContent {
  const turns = (content.turns ?? []).map((t) =>
    t.turn_index === turnIndex
      ? { ...t, available_cards: [...t.available_cards, cardConfig] }
      : t,
  );
  return { ...content, turns };
}

/** Remove a card from the turn's available_cards by card_id. */
export function removeCardFromTurn(
  content: ScenarioContent,
  turnIndex: number,
  cardId: string,
): ScenarioContent {
  const turns = (content.turns ?? []).map((t) =>
    t.turn_index === turnIndex
      ? {
          ...t,
          available_cards: t.available_cards.filter(
            (c) => c.card_id !== cardId,
          ),
        }
      : t,
  );
  return { ...content, turns };
}

/** Update a card in the turn's available_cards by card_id. */
export function updateCardInTurn(
  content: ScenarioContent,
  turnIndex: number,
  cardId: string,
  updates: Partial<TurnCardConfig>,
): ScenarioContent {
  const turns = (content.turns ?? []).map((t) =>
    t.turn_index === turnIndex
      ? {
          ...t,
          available_cards: t.available_cards.map((c) =>
            c.card_id === cardId ? { ...c, ...updates } : c,
          ),
        }
      : t,
  );
  return { ...content, turns };
}
