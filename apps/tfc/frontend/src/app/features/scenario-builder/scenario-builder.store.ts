import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import type {
  ScenarioContent,
  ScenarioEventDef,
  ScenarioIssueDef,
  DecisionTemplateDef,
  RoleDef,
  TurnDefinition,
  TurnInjectDef,
  TurnCardConfig,
  SystemStateDef,
  ScenarioWarfareDomainDef,
} from "../../core/scenario-api.service";
import * as turnMut from "./domain/turn-mutations";

interface ScenarioBuilderState {
  scenarioId: number | null;
  title: string;
  description: string;
  content: ScenarioContent;
  saving: boolean;
  error: string | null;
  loadedSnapshot: string | null;
}

const emptyContent: ScenarioContent = {
  phases: [],
  events: [],
  issues: [],
  decision_templates: [],
  default_time_factor: 1.0,
  briefing: "",
  objectives: [],
  rules: [],
  roles: [],
  game_mode: "classic",
  turns: [],
  initial_system_states: [],
  initial_warfare_domains: [],
};

export const ScenarioBuilderStore = signalStore(
  withState<ScenarioBuilderState>({
    scenarioId: null,
    title: "",
    description: "",
    content: emptyContent,
    saving: false,
    error: null,
    loadedSnapshot: null,
  }),

  withMethods((store) => ({
    loadScenario(
      id: number,
      title: string,
      description: string,
      content: ScenarioContent | null,
    ): void {
      const c = content ?? emptyContent;
      const snapshot = JSON.stringify({ title, description, content: c });
      patchState(store, {
        scenarioId: id,
        title,
        description,
        content: c,
        loadedSnapshot: snapshot,
      });
    },

    loadImport(
      title: string,
      description: string,
      content: ScenarioContent,
    ): void {
      patchState(store, {
        scenarioId: null,
        title,
        description,
        content,
        loadedSnapshot: null,
        error: null,
      });
    },

    revert(): void {
      const snap = store.loadedSnapshot();
      if (!snap) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON boundary
      const { title, description, content } = JSON.parse(snap) as {
        title: string;
        description: string;
        content: ScenarioContent;
      };
      patchState(store, { title, description, content });
    },

    setTitle(title: string): void {
      patchState(store, { title });
    },

    setDescription(description: string): void {
      patchState(store, { description });
    },

    setTimeFactor(factor: number): void {
      patchState(store, {
        content: { ...store.content(), default_time_factor: factor },
      });
    },

    addEvent(event: ScenarioEventDef): void {
      patchState(store, {
        content: {
          ...store.content(),
          events: [...store.content().events, event],
        },
      });
    },

    removeEvent(eventId: string): void {
      patchState(store, {
        content: {
          ...store.content(),
          events: store.content().events.filter((e) => e.id !== eventId),
        },
      });
    },

    updateEvent(eventId: string, updates: Partial<ScenarioEventDef>): void {
      patchState(store, {
        content: {
          ...store.content(),
          events: store
            .content()
            .events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)),
        },
      });
    },

    addIssue(issue: ScenarioIssueDef): void {
      patchState(store, {
        content: {
          ...store.content(),
          issues: [...store.content().issues, issue],
        },
      });
    },

    removeIssue(issueId: string): void {
      patchState(store, {
        content: {
          ...store.content(),
          issues: store.content().issues.filter((i) => i.id !== issueId),
        },
      });
    },

    updateIssue(issueId: string, updates: Partial<ScenarioIssueDef>): void {
      patchState(store, {
        content: {
          ...store.content(),
          issues: store
            .content()
            .issues.map((i) => (i.id === issueId ? { ...i, ...updates } : i)),
        },
      });
    },

    addDecisionTemplate(template: DecisionTemplateDef): void {
      patchState(store, {
        content: {
          ...store.content(),
          decision_templates: [...store.content().decision_templates, template],
        },
      });
    },

    removeDecisionTemplate(templateId: string): void {
      patchState(store, {
        content: {
          ...store.content(),
          decision_templates: store
            .content()
            .decision_templates.filter((d) => d.id !== templateId),
        },
      });
    },

    updateDecisionTemplate(
      templateId: string,
      updates: Partial<DecisionTemplateDef>,
    ): void {
      patchState(store, {
        content: {
          ...store.content(),
          decision_templates: store
            .content()
            .decision_templates.map((d) =>
              d.id === templateId ? { ...d, ...updates } : d,
            ),
        },
      });
    },

    addRole(role: RoleDef): void {
      patchState(store, {
        content: {
          ...store.content(),
          roles: [...(store.content().roles ?? []), role],
        },
      });
    },

    removeRole(roleId: string): void {
      patchState(store, {
        content: {
          ...store.content(),
          roles: (store.content().roles ?? []).filter((r) => r.id !== roleId),
        },
      });
    },

    updateRole(roleId: string, updates: Partial<RoleDef>): void {
      patchState(store, {
        content: {
          ...store.content(),
          roles: (store.content().roles ?? []).map((r) =>
            r.id === roleId ? { ...r, ...updates } : r,
          ),
        },
      });
    },

    addTurn(turn: TurnDefinition): void {
      patchState(store, { content: turnMut.addTurn(store.content(), turn) });
    },

    removeTurn(turnIndex: number): void {
      patchState(store, { content: turnMut.removeTurn(store.content(), turnIndex) });
    },

    updateTurn(turnIndex: number, updates: Partial<TurnDefinition>): void {
      patchState(store, { content: turnMut.updateTurn(store.content(), turnIndex, updates) });
    },

    reorderTurns(fromIndex: number, toIndex: number): void {
      patchState(store, { content: turnMut.reorderTurns(store.content(), fromIndex, toIndex) });
    },

    duplicateTurn(turnIndex: number): void {
      patchState(store, { content: turnMut.duplicateTurn(store.content(), turnIndex) });
    },

    addInjectToTurn(turnIndex: number, inject: TurnInjectDef): void {
      patchState(store, { content: turnMut.addInjectToTurn(store.content(), turnIndex, inject) });
    },

    removeInjectFromTurn(turnIndex: number, injectIndex: number): void {
      patchState(store, { content: turnMut.removeInjectFromTurn(store.content(), turnIndex, injectIndex) });
    },

    updateInjectInTurn(
      turnIndex: number,
      injectIndex: number,
      updates: Partial<TurnInjectDef>,
    ): void {
      patchState(store, { content: turnMut.updateInjectInTurn(store.content(), turnIndex, injectIndex, updates) });
    },

    addCardToTurn(turnIndex: number, cardConfig: TurnCardConfig): void {
      patchState(store, { content: turnMut.addCardToTurn(store.content(), turnIndex, cardConfig) });
    },

    removeCardFromTurn(turnIndex: number, cardId: string): void {
      patchState(store, { content: turnMut.removeCardFromTurn(store.content(), turnIndex, cardId) });
    },

    updateCardInTurn(
      turnIndex: number,
      cardId: string,
      updates: Partial<TurnCardConfig>,
    ): void {
      patchState(store, { content: turnMut.updateCardInTurn(store.content(), turnIndex, cardId, updates) });
    },

    setBriefing(briefing: string): void {
      patchState(store, {
        content: { ...store.content(), briefing },
      });
    },

    setObjectives(objectives: string[]): void {
      patchState(store, {
        content: { ...store.content(), objectives },
      });
    },

    setRules(rules: string[]): void {
      patchState(store, {
        content: { ...store.content(), rules },
      });
    },

    setGameMode(game_mode: string): void {
      patchState(store, {
        content: { ...store.content(), game_mode },
      });
    },

    setStressEffectPreset(stress_effect_preset: 'off' | 'mild' | 'standard' | 'intense'): void {
      patchState(store, {
        content: { ...store.content(), stress_effect_preset },
      });
    },

    setScoreTierThresholds(score_tier_thresholds: Record<string, number>): void {
      patchState(store, {
        content: { ...store.content(), score_tier_thresholds },
      });
    },

    setInitialSystemStates(initial_system_states: SystemStateDef[]): void {
      patchState(store, {
        content: { ...store.content(), initial_system_states },
      });
    },

    setInitialWarfareDomains(initial_warfare_domains: ScenarioWarfareDomainDef[]): void {
      patchState(store, {
        content: { ...store.content(), initial_warfare_domains },
      });
    },

    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },

    setError(error: string): void {
      patchState(store, { error, saving: false });
    },

    clearError(): void {
      patchState(store, { error: null });
    },

    reset(): void {
      patchState(store, {
        scenarioId: null,
        title: "",
        description: "",
        content: emptyContent,
        saving: false,
        error: null,
        loadedSnapshot: null,
      });
    },
  })),
);
