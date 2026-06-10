import type { Page } from 'playwright';

export type StepKeyword = 'Given' | 'When' | 'Then' | 'And' | 'But';

export interface AutomationConfig {
  aiProvider: 'openai-compatible' | 'openrouter' | 'gemini' | 'claude' | 'ollama' | 'sumopod' | 'mock';
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

export type StepStatus = 'passed' | 'failed' | 'skipped';

export interface StepContext {
  page: Page;
  feature: FeatureDoc;
  scenario: Scenario;
  step: Step;
  onAiUsed?: (result: AiUsedResult) => void;
}

export interface AiUsedResult {
  action: string;
  success: boolean;
  error?: string;
  tokens?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

export interface StepHandler {
  pattern: RegExp;
  run: (context: StepContext, matches: RegExpExecArray) => Promise<void> | void;
}

export interface StepExecutionResult {
  step: Step;
  status: StepStatus;
  durationMs: number;
  error?: string;
  aiUsed?: boolean;
  aiSuccess?: boolean;
  screenshotPath?: string;
}

export interface ScenarioExecutionResult {
  name: string;
  status: 'passed' | 'failed';
  steps: StepExecutionResult[];
  durationMs: number;
}

export interface RunEnvironment {
  browser: string;
  os: string;
  nodeVersion: string;
  envName?: string;
  baseUrl?: string;
  headless?: boolean;
  timeoutMs?: number;
}

export interface FeatureExecutionResult {
  featureName: string;
  status: 'passed' | 'failed';
  scenarios: ScenarioExecutionResult[];
  durationMs: number;
  skippedSteps?: number;
  environment?: RunEnvironment;
  aiSteps: AiStepRecord[];
  tokens?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  totalCost?: number;
}

export interface PromptToFeatureResult {
  featureText: string;
  source: 'ai' | 'heuristic';
}

export interface AiStepRecord {
  stepText: string;
  action: string;
  success: boolean;
  error?: string;
  tokens?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

export interface RunArtifacts {
  screenshots: string[];
  videoPath?: string;
  tracePath?: string;
  consoleLog?: string;
}

export interface ReportRun {
  id: string;
  runLabel: string;
  timestamp: string;
  featureName: string;
  status: 'passed' | 'failed';
  durationMs: number;
  scenarios: ScenarioExecutionResult[];
  filePath?: string;
  environment?: RunEnvironment;
  aiInvocations: number;
  aiSuccess: number;
  aiFailed: number;
  aiSteps: AiStepRecord[];
  artifacts?: RunArtifacts;
  stepCount: number;
  passedStepCount: number;
  failedStepCount: number;
  skippedStepCount: number;
  tokens?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  totalCost?: number;
}

export interface ReportSummary {
  id: string;
  runLabel: string;
  timestamp: string;
  featureName: string;
  status: 'passed' | 'failed';
  durationMs: number;
  scenarioCount: number;
  passedCount: number;
  failedCount: number;
  stepCount: number;
  passedStepCount: number;
  failedStepCount: number;
  skippedStepCount: number;
  filePath?: string;
  environment?: RunEnvironment;
  aiInvocations: number;
  aiSuccess: number;
  aiFailed: number;
  tokens?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  totalCost?: number;
}
