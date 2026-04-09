import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type {
  ScenarioContent,
  ScenarioInjectDef,
  ScenarioDefectDef,
  DecisionTemplateDef,
} from '../../core/scenario-api.service';

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
  injects: [],
  defects: [],
  decision_templates: [],
  default_time_factor: 1.0,
  briefing: '',
  objectives: [],
  rules: [],
};

export const ScenarioBuilderStore = signalStore(
  withState<ScenarioBuilderState>({
    scenarioId: null,
    title: '',
    description: '',
    content: emptyContent,
    saving: false,
    error: null,
  }),

  withMethods((store) => ({
    loadScenario(id: number, title: string, description: string, content: ScenarioContent | null): void {
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

    addInject(injectDef: ScenarioInjectDef): void {
      patchState(store, {
        content: { ...store.content(), injects: [...store.content().injects, injectDef] },
      });
    },

    removeInject(injectId: string): void {
      patchState(store, {
        content: {
          ...store.content(),
          injects: store.content().injects.filter((e: ScenarioInjectDef) => e.id !== injectId),
        },
      });
    },

    updateInject(injectId: string, updates: Partial<ScenarioInjectDef>): void {
      patchState(store, {
        content: {
          ...store.content(),
          injects: store.content().injects.map((e: ScenarioInjectDef) =>
            e.id === injectId ? { ...e, ...updates } : e,
          ),
        },
      });
    },

    addDefect(defect: ScenarioDefectDef): void {
      patchState(store, {
        content: { ...store.content(), defects: [...store.content().defects, defect] },
      });
    },

    removeDefect(defectId: string): void {
      patchState(store, {
        content: {
          ...store.content(),
          defects: store.content().defects.filter((i: ScenarioDefectDef) => i.id !== defectId),
        },
      });
    },

    updateDefect(defectId: string, updates: Partial<ScenarioDefectDef>): void {
      patchState(store, {
        content: {
          ...store.content(),
          defects: store.content().defects.map((i: ScenarioDefectDef) =>
            i.id === defectId ? { ...i, ...updates } : i,
          ),
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
          decision_templates: store.content().decision_templates.filter((d: DecisionTemplateDef) => d.id !== templateId),
        },
      });
    },

    updateDecisionTemplate(templateId: string, updates: Partial<DecisionTemplateDef>): void {
      patchState(store, {
        content: {
          ...store.content(),
          decision_templates: store.content().decision_templates.map((d: DecisionTemplateDef) =>
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

    reset(): void {
      patchState(store, {
        scenarioId: null,
        title: '',
        description: '',
        content: emptyContent,
        saving: false,
        error: null,
      });
    },
  })),
);
