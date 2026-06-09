#!/usr/bin/env node
import { createDefaultFeatureRunner } from './engine/runner';
import { loadEnvironment, createAutomationConfig } from './config';
import { promptToFeature } from './ai/prompt-to-feature';

interface CliArgs {
  command: string;
  featurePath?: string;
  promptText?: string;
  baseUrl?: string;
  headless: boolean;
  timeoutMs?: number;
  traceDir?: string;
  executePrompt: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: 'run',
    headless: true,
    executePrompt: false,
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
  console.log('Usage: os-heybugs run <feature-file> [--base-url http://localhost:3000] [--headless]');
  console.log('       os-heybugs prompt <natural-language-request> [--execute]');
}

async function main(): Promise<void> {
  await loadEnvironment();
  const args = parseArgs(process.argv.slice(2));
  const automation = createAutomationConfig();

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

  const runner = await createDefaultFeatureRunner();
  const result = await runner.runFeatureFile(args.featurePath, {
    baseUrl: args.baseUrl,
    headless: args.headless,
    timeoutMs: args.timeoutMs,
    traceDir: args.traceDir,
    automation,
  });

  console.log(`Feature: ${result.featureName}`);
  console.log(`Status: ${result.status}`);
  console.log(`Duration: ${result.durationMs}ms`);

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
    process.exitCode = 1;
  }
}

void main();
