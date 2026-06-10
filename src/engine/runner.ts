import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseFeature } from '../bdd/parser';
import type { AutomationConfig, PromptToFeatureResult } from '../types';
import { promptToFeature } from '../ai/prompt-to-feature';
import type {
  AiStepRecord,
  AiUsedResult,
  FeatureDoc,
  FeatureExecutionResult,
  RunEnvironment,
  RunnerOptions,
  Scenario,
  ScenarioExecutionResult,
  Step,
  StepExecutionResult,
} from '../types';
import { createAutomationAwareRegistry, createDefaultRegistry, StepRegistry } from './step-registry';
import { loadEnvironment, createAutomationConfig } from '../config';

function resolveUrl(baseUrl: string | undefined, target: string): string {
  if (/^https?:\/\//i.test(target) || target.startsWith('file:') || target.startsWith('data:')) {
    return target;
  }

  if (baseUrl) {
    return new URL(target, baseUrl).toString();
  }

  return target;
}

function cloneStep(step: Step): Step {
  return {
    keyword: step.keyword,
    text: step.text,
    dataTable: step.dataTable ? step.dataTable.map((row) => [...row]) : undefined,
  };
}

function expandFeature(feature: FeatureDoc): FeatureDoc {
  return {
    ...feature,
    background: feature.background.map(cloneStep),
    scenarios: feature.scenarios.map((scenario) => ({
      ...scenario,
      steps: scenario.steps.map(cloneStep),
      tags: [...scenario.tags],
    })),
    tags: [...feature.tags],
    description: [...feature.description],
  };
}

async function runStep(
  registry: StepRegistry,
  page: Page,
  feature: FeatureDoc,
  scenario: Scenario,
  step: Step,
  timeoutMs: number,
  artifactDir: string,
  aiSteps: AiStepRecord[],
): Promise<StepExecutionResult> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stepAiUsed = false;
  let stepAiSuccess = false;

  const onAiUsed = (result: AiUsedResult): void => {
    stepAiUsed = true;
    stepAiSuccess = result.success;
    aiSteps.push({
      stepText: `${step.keyword} ${step.text}`,
      action: result.action,
      success: result.success,
      error: result.error,
    });
  };

  try {
    await Promise.race([
      registry.execute({ page, feature, scenario, step, onAiUsed }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Step timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);

    return {
      step,
      status: 'passed',
      durationMs: Date.now() - start,
      aiUsed: stepAiUsed || undefined,
      aiSuccess: stepAiUsed ? stepAiSuccess : undefined,
    };
  } catch (error) {
    // Capture screenshot on failure
    let screenshotPath: string | undefined;
    try {
      if (!existsSync(artifactDir)) {
        mkdirSync(artifactDir, { recursive: true });
      }
      const ssName = `failure-${Date.now()}.png`;
      screenshotPath = join(artifactDir, ssName);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {
      screenshotPath = undefined;
    }

    return {
      step,
      status: 'failed',
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
      aiUsed: stepAiUsed || undefined,
      aiSuccess: stepAiUsed ? stepAiSuccess : undefined,
      screenshotPath,
    };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function openBrowser(options: RunnerOptions): Promise<{ browser: Browser; context: BrowserContext; page: Page; environment: RunEnvironment }> {
  const browser = await chromium.launch({ headless: options.headless ?? true });
  const context = await browser.newContext();
  if (options.traceDir) {
    await context.tracing.start({ screenshots: true, snapshots: true });
  }

  const page = await context.newPage();

  const environment: RunEnvironment = {
    browser: `Chromium ${browser.version()}`,
    os: process.platform,
    nodeVersion: process.version,
    baseUrl: options.baseUrl,
    headless: options.headless ?? true,
    timeoutMs: options.timeoutMs,
  };

  return { browser, context, page, environment };
}

export class FeatureRunner {
  constructor(private readonly registry: StepRegistry = createDefaultRegistry()) {}

  async runFeature(feature: FeatureDoc, options: RunnerOptions = {}): Promise<FeatureExecutionResult> {
    const normalized = expandFeature(feature);
    const timeoutMs = options.timeoutMs ?? 30_000;
    const startedAt = Date.now();
    const runId = `run-${Date.now()}`;
    const artifactDir = join(process.cwd(), '.heybugs', 'artifacts', runId);
    const { browser, context, page, environment } = await openBrowser(options);
    const scenarioResults: ScenarioExecutionResult[] = [];
    const aiSteps: AiStepRecord[] = [];
    let status: FeatureExecutionResult['status'] = 'passed';
    let totalSkipped = 0;

    try {
      for (const scenario of normalized.scenarios) {
        const scenarioStart = Date.now();
        const steps: StepExecutionResult[] = [];
        let scenarioStatus: ScenarioExecutionResult['status'] = 'passed';
        let scenarioFailed = false;

        for (const step of [...normalized.background, ...scenario.steps]) {
          const stepToRun = {
            ...step,
            text: step.text,
          };

          if (stepToRun.keyword === 'Given' && /^I go to "/.test(stepToRun.text) && options.baseUrl) {
            stepToRun.text = stepToRun.text.replace(/^I go to "([^"]+)"$/, (_match, target: string) => `I go to "${resolveUrl(options.baseUrl, target)}"`);
          }

          if (scenarioFailed) {
            // Mark remaining steps as skipped
            steps.push({
              step: stepToRun,
              status: 'skipped',
              durationMs: 0,
            });
            totalSkipped++;
            continue;
          }

          const result = await runStep(this.registry, page, normalized, scenario, stepToRun, timeoutMs, artifactDir, aiSteps);
          steps.push(result);
          if (result.status === 'failed') {
            scenarioFailed = true;
            scenarioStatus = 'failed';
            status = 'failed';
          }
        }

        scenarioResults.push({
          name: scenario.name,
          status: scenarioStatus,
          steps,
          durationMs: Date.now() - scenarioStart,
        });
      }
    } finally {
      if (options.traceDir) {
        await context.tracing.stop({ path: `${options.traceDir}/trace.zip` });
      }
      await context.close();
      await browser.close();
    }

    return {
      featureName: normalized.name,
      status,
      scenarios: scenarioResults,
      durationMs: Date.now() - startedAt,
      skippedSteps: totalSkipped,
      environment,
      aiSteps,
    };
  }

  async runFeatureFile(filePath: string, options: RunnerOptions = {}): Promise<FeatureExecutionResult> {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(filePath, 'utf8');
    const feature = parseFeature(source);
    return this.runFeature(feature, options);
  }

  async runPrompt(prompt: string, options: RunnerOptions = {}): Promise<{ prompt: string; feature: FeatureExecutionResult; promptResult: PromptToFeatureResult }> {
    const automation = options.automation ?? createAutomationConfig();
    const promptResult = await promptToFeature(prompt, automation);
    const feature = parseFeature(promptResult.featureText);
    const registry = createAutomationAwareRegistry(automation);
    const runner = new FeatureRunner(registry);
    const featureResult = await runner.runFeature(feature, options);

    return {
      prompt,
      feature: featureResult,
      promptResult,
    };
  }
}

export async function createDefaultFeatureRunner(): Promise<FeatureRunner> {
  await loadEnvironment();
  return new FeatureRunner(createAutomationAwareRegistry(createAutomationConfig()));
}
