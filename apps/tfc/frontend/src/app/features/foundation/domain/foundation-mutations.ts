import type {
  DomainConfigResponse,
  DomainRole,
  SystemDef,
  WarfareDomainDef,
  BlueCardDef,
} from "../../../core/domain-config-api.service";

// ── Role mutations ──────────────────────────────────────────

export function addRole(
  config: DomainConfigResponse,
  role: DomainRole,
): DomainConfigResponse {
  return { ...config, roles: [...config.roles, role] };
}

export function removeRole(
  config: DomainConfigResponse,
  roleId: string,
): DomainConfigResponse {
  return { ...config, roles: config.roles.filter((r) => r.id !== roleId) };
}

export function updateRole(
  config: DomainConfigResponse,
  roleId: string,
  updates: Partial<DomainRole>,
): DomainConfigResponse {
  return {
    ...config,
    roles: config.roles.map((r) =>
      r.id === roleId ? { ...r, ...updates } : r,
    ),
  };
}

// ── System mutations ────────────────────────────────────────

export function addSystem(
  config: DomainConfigResponse,
  system: SystemDef,
): DomainConfigResponse {
  return { ...config, systems: [...config.systems, system] };
}

export function removeSystem(
  config: DomainConfigResponse,
  systemId: string,
): DomainConfigResponse {
  return {
    ...config,
    systems: config.systems.filter((s) => s.id !== systemId),
  };
}

export function updateSystem(
  config: DomainConfigResponse,
  systemId: string,
  updates: Partial<SystemDef>,
): DomainConfigResponse {
  return {
    ...config,
    systems: config.systems.map((s) =>
      s.id === systemId ? { ...s, ...updates } : s,
    ),
  };
}

// ── Warfare Domain mutations ────────────────────────────────

export function addWarfareDomain(
  config: DomainConfigResponse,
  domain: WarfareDomainDef,
): DomainConfigResponse {
  return { ...config, warfare_domains: [...config.warfare_domains, domain] };
}

export function removeWarfareDomain(
  config: DomainConfigResponse,
  domainId: string,
): DomainConfigResponse {
  return {
    ...config,
    warfare_domains: config.warfare_domains.filter((d) => d.id !== domainId),
  };
}

export function updateWarfareDomain(
  config: DomainConfigResponse,
  domainId: string,
  updates: Partial<WarfareDomainDef>,
): DomainConfigResponse {
  return {
    ...config,
    warfare_domains: config.warfare_domains.map((d) =>
      d.id === domainId ? { ...d, ...updates } : d,
    ),
  };
}

// ── Blue Card mutations ─────────────────────────────────────

export function addBlueCard(
  config: DomainConfigResponse,
  card: BlueCardDef,
): DomainConfigResponse {
  return { ...config, blue_card_catalog: [...config.blue_card_catalog, card] };
}

export function removeBlueCard(
  config: DomainConfigResponse,
  cardId: string,
): DomainConfigResponse {
  return {
    ...config,
    blue_card_catalog: config.blue_card_catalog.filter((c) => c.id !== cardId),
  };
}

export function updateBlueCard(
  config: DomainConfigResponse,
  cardId: string,
  updates: Partial<BlueCardDef>,
): DomainConfigResponse {
  return {
    ...config,
    blue_card_catalog: config.blue_card_catalog.map((c) =>
      c.id === cardId ? { ...c, ...updates } : c,
    ),
  };
}
