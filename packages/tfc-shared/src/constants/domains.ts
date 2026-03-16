import type { DomainConfig } from '../types/domain';

export const DEFAULT_DOMAIN: DomainConfig = {
  id: 'default',
  name: 'Generic Training',
  terminology: {
    event: 'Event',
    issue: 'Issue',
    player: 'Player',
    gameMaster: 'Game Master',
    exercise: 'Exercise',
    scenario: 'Scenario',
    decision: 'Decision',
  },
  theme: {
    colorPrimary: '#3b82f6',
    colorSecondary: '#6366f1',
    colorBackground: '#ffffff',
    colorForeground: '#1e293b',
    fontFamily: 'system-ui, sans-serif',
    fontFamilyMono: 'ui-monospace, monospace',
    density: 'comfortable',
  },
  roles: [
    { id: 'player', label: 'Player', description: 'Standard participant' },
    { id: 'observer', label: 'Observer', description: 'Read-only observer' },
  ],
  severityLevels: [
    { id: 'low', label: 'Low', color: '#22c55e', order: 1 },
    { id: 'medium', label: 'Medium', color: '#f59e0b', order: 2 },
    { id: 'high', label: 'High', color: '#ef4444', order: 3 },
    { id: 'critical', label: 'Critical', color: '#dc2626', order: 4 },
  ],
};

export const CYBERSECURITY_DOMAIN: DomainConfig = {
  id: 'cybersecurity',
  name: 'Cybersecurity',
  terminology: {
    event: 'Incident',
    issue: 'Vulnerability',
    player: 'SOC Analyst',
    gameMaster: 'Exercise Director',
    exercise: 'Cyber Exercise',
    scenario: 'Attack Scenario',
    decision: 'Response Action',
  },
  theme: {
    colorPrimary: '#06b6d4',
    colorSecondary: '#8b5cf6',
    colorBackground: '#0f172a',
    colorForeground: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    fontFamilyMono: 'ui-monospace, monospace',
    density: 'compact',
  },
  roles: [
    { id: 'soc-analyst', label: 'SOC Analyst', description: 'Security operations center analyst' },
    { id: 'incident-commander', label: 'Incident Commander', description: 'Leads incident response' },
    { id: 'forensic-analyst', label: 'Forensic Analyst', description: 'Digital forensics specialist' },
    { id: 'observer', label: 'Observer', description: 'Read-only observer' },
  ],
  severityLevels: [
    { id: 'info', label: 'Informational', color: '#3b82f6', order: 1 },
    { id: 'low', label: 'Low', color: '#22c55e', order: 2 },
    { id: 'medium', label: 'Medium', color: '#f59e0b', order: 3 },
    { id: 'high', label: 'High', color: '#ef4444', order: 4 },
    { id: 'critical', label: 'Critical', color: '#dc2626', order: 5 },
  ],
};

export const HEALTHCARE_DOMAIN: DomainConfig = {
  id: 'healthcare',
  name: 'Healthcare',
  terminology: {
    event: 'Case',
    issue: 'Complication',
    player: 'Clinician',
    gameMaster: 'Simulation Lead',
    exercise: 'Simulation',
    scenario: 'Clinical Scenario',
    decision: 'Clinical Decision',
  },
  theme: {
    colorPrimary: '#059669',
    colorSecondary: '#0891b2',
    colorBackground: '#ffffff',
    colorForeground: '#1e293b',
    fontFamily: 'system-ui, sans-serif',
    fontFamilyMono: 'ui-monospace, monospace',
    density: 'comfortable',
  },
  roles: [
    { id: 'clinician', label: 'Clinician', description: 'Medical practitioner' },
    { id: 'nurse', label: 'Nurse', description: 'Nursing staff' },
    { id: 'specialist', label: 'Specialist', description: 'Medical specialist consultant' },
    { id: 'observer', label: 'Observer', description: 'Read-only observer' },
  ],
  severityLevels: [
    { id: 'routine', label: 'Routine', color: '#22c55e', order: 1 },
    { id: 'urgent', label: 'Urgent', color: '#f59e0b', order: 2 },
    { id: 'emergent', label: 'Emergent', color: '#ef4444', order: 3 },
    { id: 'critical', label: 'Critical', color: '#dc2626', order: 4 },
  ],
};
