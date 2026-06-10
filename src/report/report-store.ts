import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type {
  AiStepRecord,
  FeatureExecutionResult,
  ReportRun,
  ReportSummary,
  RunArtifacts,
  RunEnvironment,
} from '../types';

const REPORTS_DIR = join(process.cwd(), '.heybugs', 'reports');
const ARTIFACTS_DIR = join(process.cwd(), '.heybugs', 'artifacts');

function ensureReportsDir(): void {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function generateId(): string {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${now}-${rand}`;
}

function generateRunLabel(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `#${y}${mo}${d}-${h}${mi}`;
}

function collectScreenshots(result: FeatureExecutionResult): string[] {
  const paths: string[] = [];
  for (const scenario of result.scenarios) {
    for (const step of scenario.steps) {
      if (step.screenshotPath) {
        paths.push(step.screenshotPath);
      }
    }
  }
  return paths;
}

function countSteps(result: FeatureExecutionResult): { total: number; passed: number; failed: number; skipped: number } {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const scenario of result.scenarios) {
    for (const step of scenario.steps) {
      total++;
      if (step.status === 'passed') passed++;
      else if (step.status === 'failed') failed++;
      else if (step.status === 'skipped') skipped++;
    }
  }
  return { total, passed, failed, skipped };
}

export function saveReport(
  result: FeatureExecutionResult,
  filePath?: string,
  environment?: RunEnvironment,
): ReportRun {
  ensureReportsDir();

  const stepCounts = countSteps(result);
  const screenshots = collectScreenshots(result);
  const aiSteps = result.aiSteps ?? [];
  const aiSuccess = aiSteps.filter((s) => s.success).length;
  const aiFailed = aiSteps.filter((s) => !s.success).length;

  const artifacts: RunArtifacts | undefined = screenshots.length > 0
    ? { screenshots }
    : undefined;

  const report: ReportRun = {
    id: generateId(),
    runLabel: generateRunLabel(),
    timestamp: new Date().toISOString(),
    featureName: result.featureName,
    status: result.status,
    durationMs: result.durationMs,
    scenarios: result.scenarios,
    filePath,
    environment,
    aiInvocations: aiSteps.length,
    aiSuccess,
    aiFailed,
    aiSteps,
    artifacts,
    stepCount: stepCounts.total,
    passedStepCount: stepCounts.passed,
    failedStepCount: stepCounts.failed,
    skippedStepCount: stepCounts.skipped,
    tokens: result.tokens,
    totalCost: result.totalCost,
  };

  const fileName = `${report.id}.json`;
  writeFileSync(join(REPORTS_DIR, fileName), JSON.stringify(report, null, 2), 'utf8');

  return report;
}

export function loadAllReports(): ReportRun[] {
  ensureReportsDir();

  const files = readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.json'));
  const reports: ReportRun[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(REPORTS_DIR, file), 'utf8');
      reports.push(JSON.parse(content) as ReportRun);
    } catch {
      // Skip corrupt files
    }
  }

  // Sort by timestamp descending (newest first)
  return reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function loadReportSummaries(): ReportSummary[] {
  return loadAllReports().map((run) => ({
    id: run.id,
    runLabel: run.runLabel ?? run.id,
    timestamp: run.timestamp,
    featureName: run.featureName,
    status: run.status,
    durationMs: run.durationMs,
    scenarioCount: run.scenarios.length,
    passedCount: run.scenarios.filter((s) => s.status === 'passed').length,
    failedCount: run.scenarios.filter((s) => s.status === 'failed').length,
    stepCount: run.stepCount ?? 0,
    passedStepCount: run.passedStepCount ?? 0,
    failedStepCount: run.failedStepCount ?? 0,
    skippedStepCount: run.skippedStepCount ?? 0,
    filePath: run.filePath,
    environment: run.environment,
    aiInvocations: run.aiInvocations ?? 0,
    aiSuccess: run.aiSuccess ?? 0,
    aiFailed: run.aiFailed ?? 0,
    tokens: run.tokens,
    totalCost: run.totalCost,
  }));
}

export function loadReportById(id: string): ReportRun | null {
  ensureReportsDir();

  const fileName = `${id}.json`;
  const filePath = join(REPORTS_DIR, fileName);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content) as ReportRun;
  } catch {
    return null;
  }
}

export function getArtifactPath(runId: string, filename: string): string | null {
  const filePath = join(ARTIFACTS_DIR, runId, filename);
  return existsSync(filePath) ? filePath : null;
}

export function getArtifactDir(runId: string): string {
  return join(ARTIFACTS_DIR, runId);
}
