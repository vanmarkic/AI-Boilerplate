import { Injectable, signal } from '@angular/core';

export interface DomainTerminology {
  event: string;
  issue: string;
  decision: string;
  participant: string;
  gameMaster: string;
  exercise: string;
}

export interface DomainConfig {
  id: string;
  name: string;
  theme: string;
  terminology: DomainTerminology;
}

const DEFAULT_DOMAIN: DomainConfig = {
  id: 'default',
  name: 'Default',
  theme: '',
  terminology: {
    event: 'Event',
    issue: 'Issue',
    decision: 'Decision',
    participant: 'Participant',
    gameMaster: 'Game Master',
    exercise: 'Exercise',
  },
};

const CYBERSECURITY_DOMAIN: DomainConfig = {
  id: 'cybersecurity',
  name: 'Cybersecurity',
  theme: 'tfc-cyber',
  terminology: {
    event: 'Incident',
    issue: 'Threat',
    decision: 'Response Action',
    participant: 'Analyst',
    gameMaster: 'Exercise Director',
    exercise: 'Cyber Exercise',
  },
};

const HEALTHCARE_DOMAIN: DomainConfig = {
  id: 'healthcare',
  name: 'Healthcare',
  theme: 'tfc-health',
  terminology: {
    event: 'Clinical Event',
    issue: 'Patient Concern',
    decision: 'Clinical Decision',
    participant: 'Clinician',
    gameMaster: 'Facilitator',
    exercise: 'Simulation',
  },
};

const MILITARY_DOMAIN: DomainConfig = {
  id: 'military',
  name: 'Military',
  theme: 'tfc-military',
  terminology: {
    event: 'SITREP',
    issue: 'Operational Issue',
    decision: 'Command Decision',
    participant: 'Operator',
    gameMaster: 'Exercise Controller',
    exercise: 'Tactical Exercise',
  },
};

const DOMAINS: Record<string, DomainConfig> = {
  default: DEFAULT_DOMAIN,
  cybersecurity: CYBERSECURITY_DOMAIN,
  healthcare: HEALTHCARE_DOMAIN,
  military: MILITARY_DOMAIN,
};

@Injectable({ providedIn: 'root' })
export class DomainService {
  readonly activeDomain = signal<DomainConfig>(DEFAULT_DOMAIN);
  readonly availableDomains = Object.values(DOMAINS);

  setDomain(domainId: string): void {
    const domain = DOMAINS[domainId] ?? DEFAULT_DOMAIN;
    this.activeDomain.set(domain);
    this.applyTheme(domain.theme);
  }

  term(key: keyof DomainTerminology): string {
    return this.activeDomain().terminology[key];
  }

  private applyTheme(theme: string): void {
    const html = document.documentElement;
    if (theme) {
      html.setAttribute('data-theme', theme);
    } else {
      html.removeAttribute('data-theme');
    }
  }
}
