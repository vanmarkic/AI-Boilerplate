import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import type {
  ScenarioContent,
  ScenarioEventDef,
  ScenarioIssueDef,
  DecisionTemplateDef,
} from "../../core/scenario-api.service";

interface ScenarioBuilderState {
  scenarioId: number | null;
  title: string;
  description: string;
  content: ScenarioContent;
  saving: boolean;
  error: string | null;
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
};

export const ScenarioBuilderStore = signalStore(
  withState<ScenarioBuilderState>({
    scenarioId: null,
    title: "",
    description: "",
    content: emptyContent,
    saving: false,
    error: null,
  }),

  withMethods((store) => ({
    loadScenario(
      id: number,
      title: string,
      description: string,
      content: ScenarioContent | null,
    ): void {
      patchState(store, {
        scenarioId: id,
        title,
        description,
        content: content ?? emptyContent,
      });
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

    setBriefing(briefing: string): void {
      patchState(store, {
        content: { ...store.content(), briefing },
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
      });
    },
  })),
);
