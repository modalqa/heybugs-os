import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AutomationConfig } from './types';

type Provider = AutomationConfig['aiProvider'];

function envValue(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value === undefined) {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseEnvFile(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export async function loadEnvironment(rootDir: string = process.cwd()): Promise<void> {
  const envFiles = [join(rootDir, '.env.local'), join(rootDir, '.env')];

  for (const envFile of envFiles) {
    try {
      const content = await readFile(envFile, 'utf8');
      const parsed = parseEnvFile(content);
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch {
      continue;
    }
  }
}

export function createAutomationConfig(): AutomationConfig {
  const providerRaw = (process.env.HEYBUGS_AI_PROVIDER ?? 'openai-compatible').trim().toLowerCase();

  const provider: Provider = (
    providerRaw === 'openrouter' ||
    providerRaw === 'gemini' ||
    providerRaw === 'claude' ||
    providerRaw === 'ollama' ||
    providerRaw === 'mock'
  )
    ? providerRaw
    : 'openai-compatible';

  const defaultBaseByProvider: Record<Exclude<Provider, 'mock'>, string> = {
    'openai-compatible': 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
    claude: 'https://api.anthropic.com/v1',
    ollama: 'http://localhost:11434/v1',
  };

  const defaultModelByProvider: Record<Exclude<Provider, 'mock'>, string> = {
    'openai-compatible': 'gpt-4o-mini',
    openrouter: 'openai/gpt-4o-mini',
    gemini: 'gemini-1.5-flash',
    claude: 'claude-3-5-sonnet-latest',
    ollama: 'llama3.1:8b',
  };

  const apiKey = envValue(
    process.env.HEYBUGS_AI_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
  );

  const apiBaseUrl = envValue(process.env.HEYBUGS_AI_API_BASE_URL)
    ?? (provider === 'mock' ? 'http://localhost/mock' : defaultBaseByProvider[provider]);

  const model = envValue(process.env.HEYBUGS_AI_MODEL)
    ?? (provider === 'mock' ? 'mock-model' : defaultModelByProvider[provider]);

  return {
    aiProvider: provider,
    apiKey,
    apiBaseUrl,
    model,
    anthropicVersion: process.env.HEYBUGS_ANTHROPIC_VERSION ?? '2023-06-01',
    appName: process.env.HEYBUGS_APP_NAME ?? 'os-heybugs',
    appUrl: process.env.HEYBUGS_APP_URL ?? 'https://github.com/heybugs/os-heybugs',
    autoHealSelectors: parseBoolean(process.env.HEYBUGS_AUTO_HEAL_SELECTORS, true),
    promptToAutomation: parseBoolean(process.env.HEYBUGS_PROMPT_TO_AUTOMATION, true),
  };
}