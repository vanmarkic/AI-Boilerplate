import { TestBed } from "@angular/core/testing";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import type {
  TurnDefinition,
  TurnInjectDef,
  TurnCardConfig,
} from "../../core/scenario-api.service";

function makeTurn(overrides: Partial<TurnDefinition> = {}): TurnDefinition {
  return {
    turn_index: 0,
    title: "Turn",
    facilitator_prompt: null,
    has_decisions: false,
    duration_ms: null,
    inject_ids: [],
    decision_template_id: null,
    injects: [],
    available_cards: [],
    max_selections: 1,
    base_stress_delta: 0,
    system_effects_on_start: [],
    domain_effects_on_start: [],
    best_path: null,
    acceptable_path: null,
    design_notes: "",
    ...overrides,
  };
}

function makeInject(overrides: Partial<TurnInjectDef> = {}): TurnInjectDef {
  return {
    target_roles: [],
    text: "inject text",
    role_descriptions: {},
    ...overrides,
  };
}

function makeCard(overrides: Partial<TurnCardConfig> = {}): TurnCardConfig {
  return {
    card_id: "card-1",
    score: 10,
    stress_delta: 0,
    system_effects: [],
    domain_effects: [],
    max_plays: 1,
    ...overrides,
  };
}

describe("ScenarioBuilderStore — Turn CRUD", () => {
  let store: InstanceType<typeof ScenarioBuilderStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScenarioBuilderStore],
    });
    store = TestBed.inject(ScenarioBuilderStore);
  });

  describe("addTurn", () => {
    it("should append a turn and auto-set turn_index", () => {
      store.addTurn(makeTurn({ title: "Alpha" }));
      store.addTurn(makeTurn({ title: "Bravo" }));

      const turns = store.content().turns ?? [];
      expect(turns.length).toBe(2);
      expect(turns[0].turn_index).toBe(0);
      expect(turns[0].title).toBe("Alpha");
      expect(turns[1].turn_index).toBe(1);
      expect(turns[1].title).toBe("Bravo");
    });
  });

  describe("removeTurn", () => {
    it("should remove a turn and renumber remaining", () => {
      store.addTurn(makeTurn({ title: "A" }));
      store.addTurn(makeTurn({ title: "B" }));
      store.addTurn(makeTurn({ title: "C" }));

      store.removeTurn(1);

      const turns = store.content().turns ?? [];
      expect(turns.length).toBe(2);
      expect(turns[0].title).toBe("A");
      expect(turns[0].turn_index).toBe(0);
      expect(turns[1].title).toBe("C");
      expect(turns[1].turn_index).toBe(1);
    });
  });

  describe("updateTurn", () => {
    it("should update title and leave other fields unchanged", () => {
      store.addTurn(makeTurn({ title: "Original", design_notes: "keep me" }));

      store.updateTurn(0, { title: "Updated" });

      const turn = (store.content().turns ?? [])[0];
      expect(turn.title).toBe("Updated");
      expect(turn.design_notes).toBe("keep me");
    });
  });

  describe("reorderTurns", () => {
    it("should move a turn and renumber all", () => {
      store.addTurn(makeTurn({ title: "A" }));
      store.addTurn(makeTurn({ title: "B" }));
      store.addTurn(makeTurn({ title: "C" }));

      store.reorderTurns(0, 2);

      const turns = store.content().turns ?? [];
      expect(turns.map((t) => t.title)).toEqual(["B", "C", "A"]);
      expect(turns.map((t) => t.turn_index)).toEqual([0, 1, 2]);
    });
  });

  describe("duplicateTurn", () => {
    it("should clone the turn, insert after original, and renumber", () => {
      store.addTurn(makeTurn({ title: "First" }));
      store.addTurn(makeTurn({ title: "Second" }));

      store.duplicateTurn(0);

      const turns = store.content().turns ?? [];
      expect(turns.length).toBe(3);
      expect(turns[0].title).toBe("First");
      expect(turns[1].title).toBe("First (copy)");
      expect(turns[2].title).toBe("Second");
      expect(turns.map((t) => t.turn_index)).toEqual([0, 1, 2]);
    });
  });

  describe("addInjectToTurn", () => {
    it("should add an inject to the specified turn", () => {
      store.addTurn(makeTurn({ title: "T0" }));
      const inject = makeInject({ text: "new inject" });

      store.addInjectToTurn(0, inject);

      const turn = (store.content().turns ?? [])[0];
      expect(turn.injects.length).toBe(1);
      expect(turn.injects[0].text).toBe("new inject");
    });
  });

  describe("removeInjectFromTurn", () => {
    it("should remove an inject by index", () => {
      const inject1 = makeInject({ text: "first" });
      const inject2 = makeInject({ text: "second" });
      store.addTurn(makeTurn({ injects: [inject1, inject2] }));

      store.removeInjectFromTurn(0, 0);

      const turn = (store.content().turns ?? [])[0];
      expect(turn.injects.length).toBe(1);
      expect(turn.injects[0].text).toBe("second");
    });
  });

  describe("updateInjectInTurn", () => {
    it("should update an inject by index", () => {
      store.addTurn(makeTurn({ injects: [makeInject({ text: "old" })] }));

      store.updateInjectInTurn(0, 0, { text: "new" });

      const turn = (store.content().turns ?? [])[0];
      expect(turn.injects[0].text).toBe("new");
    });
  });

  describe("addCardToTurn", () => {
    it("should add a card config to available_cards", () => {
      store.addTurn(makeTurn());
      const card = makeCard({ card_id: "blue-1", score: 5 });

      store.addCardToTurn(0, card);

      const turn = (store.content().turns ?? [])[0];
      expect(turn.available_cards.length).toBe(1);
      expect(turn.available_cards[0].card_id).toBe("blue-1");
      expect(turn.available_cards[0].score).toBe(5);
    });
  });

  describe("removeCardFromTurn", () => {
    it("should remove a card by card_id", () => {
      const card1 = makeCard({ card_id: "c1" });
      const card2 = makeCard({ card_id: "c2" });
      store.addTurn(makeTurn({ available_cards: [card1, card2] }));

      store.removeCardFromTurn(0, "c1");

      const turn = (store.content().turns ?? [])[0];
      expect(turn.available_cards.length).toBe(1);
      expect(turn.available_cards[0].card_id).toBe("c2");
    });
  });

  describe("updateCardInTurn", () => {
    it("should update a card by card_id", () => {
      store.addTurn(
        makeTurn({ available_cards: [makeCard({ card_id: "c1", score: 10 })] }),
      );

      store.updateCardInTurn(0, "c1", { score: 20 });

      const turn = (store.content().turns ?? [])[0];
      expect(turn.available_cards[0].score).toBe(20);
      expect(turn.available_cards[0].card_id).toBe("c1");
    });
  });
});
