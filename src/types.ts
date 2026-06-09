import type { Page } from 'playwright';

export type StepKeyword = 'Given' | 'When' | 'Then' | 'And' | 'But';

export interface AutomationConfig {
  aiProvider: 'openai-compatible' | 'openrouter' | 'gemini' | 'claude' | 'ollama' | 'mock';
  apiKey?: string;
  apiBaseUrl: string;
  model: string;
  anthropicVersion?: string;
  appName?: string;
  appUrl?: string;
  autoHealSelectors: boolean;
  promptToAutomation: boolean;
}

export interface Step {
  keyword: StepKeyword;
  text: string;
  dataTable?: string[][];
}

export interface Scenario {
  name: string;
  tags: string[];
  steps: Step[];
}

export interface FeatureDoc {
  name: string;
  description: string[];
  background: Step[];
  scenarios: Scenario[];
  tags: string[];
}

export interface RunnerOptions {
  baseUrl?: string;
  headless?: boolean;
  timeoutMs?: number;
  traceDir?: string;
  automation?: AutomationConfig;
}

export interface StepContext {
  page: Page;
  feature: FeatureDoc;
  scenario: Scenario;
  step: Step;
}

export interface StepHandler {
  pattern: RegExp;
  run: (context: StepContext, matches: RegExpExecArray) => Promise<void> | void;
}

export interface StepExecutionResult {
  step: Step;
  status: 'passed' | 'failed';
  durationMs: number;
  error?: string;
}

export interface ScenarioExecutionResult {
  name: string;
  status: 'passed' | 'failed';
  steps: StepExecutionResult[];
  durationMs: number;
}

export interface FeatureExecutionResult {
  featureName: string;
  status: 'passed' | 'failed';
  scenarios: ScenarioExecutionResult[];
  durationMs: number;
}

export interface PromptToFeatureResult {
  featureText: string;
  source: 'ai' | 'heuristic';
}
