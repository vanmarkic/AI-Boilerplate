import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import type {
  DomainConfigResponse,
  DomainRole,
  SystemDef,
  WarfareDomainDef,
  BlueCardDef,
} from "../../core/domain-config-api.service";
import * as mut from "./domain/foundation-mutations";

interface FoundationState {
  config: DomainConfigResponse | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export const FoundationStore = signalStore(
  withState<FoundationState>({
    config: null,
    loading: false,
    saving: false,
    error: null,
  }),

  withMethods((store) => ({
    setConfig(config: DomainConfigResponse): void {
      patchState(store, { config, loading: false, error: null });
    },

    setLoading(loading: boolean): void {
      patchState(store, { loading });
    },

    setSaving(saving: boolean): void {
      patchState(store, { saving });
    },

    setError(error: string): void {
      patchState(store, { error, saving: false, loading: false });
    },

    clearError(): void {
      patchState(store, { error: null });
    },

    // ── Role CRUD ─────────────────────────────────────────

    addRole(role: DomainRole): void {
      const config = store.config();
      if (!config) return;
      patchState(store, { config: mut.addRole(config, role) });
    },

    removeRole(roleId: string): void {
      const config = store.config();
      if (!config) return;
      patchState(store, { config: mut.removeRole(config, roleId) });
    },

    updateRole(roleId: string, updates: Partial<DomainRole>): void {
      const config = store.config();
      if (!config) return;
      patchState(store, { config: mut.updateRole(config, roleId, updates) });
    },

    // ── System CRUD ───────────────────────────────────────

    addSystem(system: SystemDef): void {
      const config = store.config();
      if (!config) return;
      patchState(store, { config: mut.addSystem(config, system) });
    },

    removeSystem(systemId: string): void {
      const config = store.config();
      if (!config) return;
      patchState(store, { config: mut.removeSystem(config, systemId) });
    },

    updateSystem(systemId: string, updates: Partial<SystemDef>): void {
      const config = store.config();
      if (!config) return;
      patchState(store, {
        config: mut.updateSystem(config, systemId, updates),
      });
    },

    // ── Warfare Domain CRUD ───────────────────────────────

    addWarfareDomain(domain: WarfareDomainDef): void {
      const config = store.config();
      if (!config) return;
      patchState(store, { config: mut.addWarfareDomain(config, domain) });
    },

    removeWarfareDomain(domainId: string): void {
      const config = store.config();
      if (!config) return;
      patchState(store, {
        config: mut.removeWarfareDomain(config, domainId),
      });
    },

    updateWarfareDomain(
      domainId: string,
      updates: Partial<WarfareDomainDef>,
    ): void {
      const config = store.config();
      if (!config) return;
      patchState(store, {
        config: mut.updateWarfareDomain(config, domainId, updates),
      });
    },

    // ── Blue Card CRUD ────────────────────────────────────

    addBlueCard(card: BlueCardDef): void {
      const config = store.config();
      if (!config) return;
      patchState(store, { config: mut.addBlueCard(config, card) });
    },

    removeBlueCard(cardId: string): void {
      const config = store.config();
      if (!config) return;
      patchState(store, { config: mut.removeBlueCard(config, cardId) });
    },

    updateBlueCard(cardId: string, updates: Partial<BlueCardDef>): void {
      const config = store.config();
      if (!config) return;
      patchState(store, {
        config: mut.updateBlueCard(config, cardId, updates),
      });
    },
  })),
);
