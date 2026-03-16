export interface TerminologyMap {
  event: string;
  issue: string;
  player: string;
  gameMaster: string;
  exercise: string;
  scenario: string;
  decision: string;
  [key: string]: string;
}

export interface SeverityLevel {
  id: string;
  label: string;
  color: string;
  order: number;
}

export interface DomainRole {
  id: string;
  label: string;
  description: string;
}

export interface ThemeConfig {
  colorPrimary: string;
  colorSecondary: string;
  colorBackground: string;
  colorForeground: string;
  fontFamily: string;
  fontFamilyMono: string;
  density: 'compact' | 'comfortable' | 'spacious';
}

export interface DomainConfig {
  id: string;
  name: string;
  terminology: TerminologyMap;
  theme: ThemeConfig;
  roles: DomainRole[];
  severityLevels: SeverityLevel[];
}
