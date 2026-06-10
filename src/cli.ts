#!/usr/bin/env node
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { createDefaultFeatureRunner } from './engine/runner';
import { loadEnvironment, createAutomationConfig } from './config';
import { promptToFeature } from './ai/prompt-to-feature';
import { saveReport } from './report/report-store';
import { startReportServer } from './report/server';

interface CliArgs {
  command: string;
  featurePath?: string;
  promptText?: string;
  baseUrl?: string;
  headless: boolean;
  timeoutMs?: number;
  traceDir?: string;
  executePrompt: boolean;
  port: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: 'run',
    headless: true,
    executePrompt: false,
    port: 9323,
  };

  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--base-url') {
      args.baseUrl = argv[++index];
      continue;
    }

    if (token.startsWith('--base-url=')) {
      args.baseUrl = token.slice('--base-url='.length);
      continue;
    }

    if (token === '--timeout') {
      args.timeoutMs = Number(argv[++index]);
      continue;
    }

    if (token.startsWith('--timeout=')) {
      args.timeoutMs = Number(token.slice('--timeout='.length));
      continue;
    }

    if (token === '--trace-dir') {
      args.traceDir = argv[++index];
      continue;
    }

    if (token.startsWith('--trace-dir=')) {
      args.traceDir = token.slice('--trace-dir='.length);
      continue;
    }

    if (token === '--headless=false' || token === '--headed') {
      args.headless = false;
      continue;
    }

    if (token === '--headless') {
      args.headless = true;
      continue;
    }

    if (token === '--no-headless') {
      args.headless = false;
      continue;
    }

    if (token === '--execute' || token === '--run-prompt') {
      args.executePrompt = true;
      continue;
    }

    if (token === '--port') {
      args.port = Number(argv[++index]);
      continue;
    }

    if (token.startsWith('--port=')) {
      args.port = Number(token.slice('--port='.length));
      continue;
    }

    positionals.push(token);
  }

  if (positionals.length > 0) {
    args.command = positionals[0];
  }

  if (positionals.length > 1) {
    if (args.command === 'prompt') {
      args.promptText = positionals.slice(1).join(' ');
    } else {
      args.featurePath = positionals[1];
    }
  }

  return args;
}

function printUsage(): void {
  console.log('Usage: os-heybugs run <feature-file-or-dir> [--base-url http://localhost:3000] [--headless]');
  console.log('       os-heybugs prompt <natural-language-request> [--execute]');
  console.log('       os-heybugs report [--port 9323]');
}

/**
 * Resolves the given path to a list of .feature file paths.
 * Supports a single file, a directory (recursively scans for .feature files),
 * or a comma-separated list of paths.
 */
function resolveFeatureFiles(inputPath: string): string[] {
  // Comma-separated list: "a.feature,b.feature"
  if (inputPath.includes(',')) {
    return inputPath.split(',').flatMap((p) => resolveFeatureFiles(p.trim()));
  }

  try {
    const stat = statSync(inputPath);

    if (stat.isDirectory()) {
      const entries = readdirSync(inputPath, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = join(inputPath, entry.name);
        if (entry.isDirectory()) {
          files.push(...resolveFeatureFiles(fullPath));
        } else if (entry.isFile() && extname(entry.name) === '.feature') {
          files.push(fullPath);
        }
      }
      return files;
    }

    if (stat.isFile() && extname(inputPath) === '.feature') {
      return [inputPath];
    }
  } catch {
    // Fall through
  }

  return [inputPath];
}

async function main(): Promise<void> {
  await loadEnvironment();
  const args = parseArgs(process.argv.slice(2));
  const automation = createAutomationConfig();

  // Report command: start the dashboard server
  if (args.command === 'report') {
    await startReportServer(args.port);
    return;
  }

  if (args.command === 'prompt' && args.promptText) {
    const promptResult = await promptToFeature(args.promptText, automation);
    console.log(promptResult.featureText);

    if (!args.executePrompt) {
      return;
    }

    const runner = await createDefaultFeatureRunner();
    const feature = await import('./bdd/parser.js').then((mod) => mod.parseFeature(promptResult.featureText));
    const result = await runner.runFeature(feature, {
      baseUrl: args.baseUrl,
      headless: args.headless,
      timeoutMs: args.timeoutMs,
      traceDir: args.traceDir,
      automation,
    });

    console.log(`Feature: ${result.featureName}`);
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${result.durationMs}ms`);
    if (result.status === 'failed') {
      process.exitCode = 1;
    }
    return;
  }

  if (args.command !== 'run' || !args.featurePath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const featureFiles = resolveFeatureFiles(args.featurePath);

  if (featureFiles.length === 0) {
    console.log(`No .feature files found at: ${args.featurePath}`);
    process.exitCode = 1;
    return;
  }

  if (featureFiles.length > 1) {
    console.log(`Found ${featureFiles.length} feature file(s):`);
    featureFiles.forEach((f) => console.log(`  - ${f}`));
    console.log('');
  }

  const runner = await createDefaultFeatureRunner();
  let overallFailed = false;

  for (const filePath of featureFiles) {
    console.log(`\n▶ Running: ${filePath}`);

    const result = await runner.runFeatureFile(filePath, {
      baseUrl: args.baseUrl,
      headless: args.headless,
      timeoutMs: args.timeoutMs,
      traceDir: args.traceDir,
      automation,
    });

    console.log(`Feature: ${result.featureName}`);
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${result.durationMs}ms`);

    // Save report for dashboard
    saveReport(result, filePath, result.environment);

    for (const scenario of result.scenarios) {
      console.log(`- ${scenario.status.toUpperCase()}: ${scenario.name} (${scenario.durationMs}ms)`);
      for (const step of scenario.steps) {
        const label = `${step.step.keyword} ${step.step.text}`;
        console.log(`  - ${step.status.toUpperCase()}: ${label} (${step.durationMs}ms)`);
        if (step.error) {
          console.log(`    ${step.error}`);
        }
      }
    }

    if (result.status === 'failed') {
      overallFailed = true;
    }
  }

  if (featureFiles.length > 1) {
    console.log(`\n✓ All ${featureFiles.length} feature file(s) executed.`);
  }

  console.log('\n💡 Run `node dist/cli.js report` to view the HTML dashboard.');

  if (overallFailed) {
    process.exitCode = 1;
  }
}

void main();
