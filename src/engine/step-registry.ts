import type { Page } from 'playwright';
import { createLlmClient } from '../ai/llm-client';
import type { AutomationConfig } from '../types';
import { healSelector } from './selector-healer';
import type { StepContext, StepHandler } from '../types';

type AiStepPlan =
  | { action: 'goto'; url: string }
  | { action: 'click'; target: string }
  | { action: 'fill'; target: string; value: string }
  | { action: 'select'; target: string; value: string }
  | { action: 'press'; key: string }
  | { action: 'see'; text: string }
  | { action: 'url-includes'; value: string }
  | { action: 'url-is'; value: string };

async function firstVisible(locators: Array<ReturnType<Page['locator']>>): Promise<ReturnType<Page['locator']> | null> {
  for (const locator of locators) {
    if (await locator.count()) {
      return locator.first();
    }
  }

  return null;
}

/**
 * Resolves a locator when the target uses an explicit ID or data-testid prefix:
 *  - "#someId"    → page.locator('#someId')
 *  - "@testId"    → page.locator('[data-testid="testId"]')
 * Returns null when the target does not match either convention.
 */
function resolveExplicitLocator(page: Page, target: string): ReturnType<Page['locator']> | null {
  const trimmed = target.trim();
  if (trimmed.startsWith('#') && trimmed.length > 1) {
    return page.locator(trimmed);
  }
  if (trimmed.startsWith('@') && trimmed.length > 1) {
    return page.locator(`[data-testid="${trimmed.slice(1)}"]`);
  }
  return null;
}

async function clickTarget(page: Page, target: string): Promise<void> {
  const explicit = resolveExplicitLocator(page, target);
  if (explicit) {
    const locator = await firstVisible([explicit]);
    if (locator) {
      await locator.click();
      return;
    }
    throw new Error(`Unable to find clickable target: ${target}`);
  }

  const locator = await firstVisible([
    page.getByRole('button', { name: target }),
    page.getByRole('link', { name: target }),
    page.getByText(target, { exact: true }),
    page.getByLabel(target, { exact: true }),
  ]);

  if (!locator) {
    throw new Error(`Unable to find clickable target: ${target}`);
  }

  await locator.click();
}

function buildTargetVariants(target: string): string[] {
  const variants = new Set<string>([target.trim()]);

  const stripped = target
    .replace(/\s+in the sidebar$/i, '')
    .replace(/\s+in the menu$/i, '')
    .replace(/\s+button$/i, '')
    .replace(/^the\s+/i, '')
    .trim();

  if (stripped) {
    variants.add(stripped);
  }

  return [...variants];
}

async function fillTarget(page: Page, label: string, value: string): Promise<void> {
  const explicit = resolveExplicitLocator(page, label);
  if (explicit) {
    const locator = await firstVisible([explicit]);
    if (locator) {
      await locator.fill(value);
      return;
    }
    throw new Error(`Unable to find input target: ${label}`);
  }

  const locator = await firstVisible([
    page.getByLabel(label, { exact: true }),
    page.getByPlaceholder(label, { exact: true }),
    page.getByRole('textbox', { name: label }),
  ]);

  if (!locator) {
    throw new Error(`Unable to find input target: ${label}`);
  }

  await locator.fill(value);
}

async function selectTarget(page: Page, label: string, value: string): Promise<void> {
  const explicit = resolveExplicitLocator(page, label);
  if (explicit) {
    const locator = await firstVisible([explicit]);
    if (locator) {
      await locator.selectOption({ label: value });
      return;
    }
    throw new Error(`Unable to find select target: ${label}`);
  }

  const locator = await firstVisible([
    page.getByLabel(label, { exact: true }),
    page.getByRole('combobox', { name: label }),
  ]);

  if (!locator) {
    throw new Error(`Unable to find select target: ${label}`);
  }

  await locator.selectOption({ label: value });
}

async function expectText(page: Page, text: string): Promise<void> {
  const exact = page.getByText(text, { exact: true });
  if (await exact.first().count()) {
    await exact.first().waitFor({ state: 'visible' });
    return;
  }

  const partial = page.getByText(text);
  await partial.first().waitFor({ state: 'visible' });
}

async function expectUrl(page: Page, pathOrUrl: string, baseUrl?: string): Promise<void> {
  const expected = /^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('file:')
    ? pathOrUrl
    : baseUrl
      ? new URL(pathOrUrl, baseUrl).toString()
      : pathOrUrl;

  await page.waitForURL((url) => url.toString() === expected || url.toString().includes(pathOrUrl));
}

async function collectPageSample(page: Page): Promise<string> {
  try {
    const title = await page.title();
    const text = await page.locator('body').innerText();
    return [`Title: ${title}`, `Body: ${text.slice(0, 1500)}`].join('\n');
  } catch {
    return '';
  }
}

async function runPlannedAction(
  page: Page,
  plan: AiStepPlan,
  automation?: AutomationConfig,
  llmClient?: ReturnType<typeof createLlmClient>,
): Promise<void> {
  switch (plan.action) {
    case 'goto':
      await page.goto(plan.url);
      return;
    case 'click':
      for (const candidate of buildTargetVariants(plan.target)) {
        try {
          await clickTarget(page, candidate);
          return;
        } catch {
          continue;
        }
      }
      try {
        await healSelector(page, 'click', plan.target, automation, llmClient);
      } catch {
        throw new Error(`Unable to click target after AI fallback: ${plan.target}`);
      }
      return;
    case 'fill':
      for (const candidate of buildTargetVariants(plan.target)) {
        try {
          await fillTarget(page, candidate, plan.value);
          return;
        } catch {
          continue;
        }
      }
      await healSelector(page, 'fill', plan.target, automation, llmClient, plan.value);
      return;
    case 'select':
      for (const candidate of buildTargetVariants(plan.target)) {
        try {
          await selectTarget(page, candidate, plan.value);
          return;
        } catch {
          continue;
        }
      }
      await healSelector(page, 'select', plan.target, automation, llmClient, plan.value);
      return;
    case 'press':
      await page.keyboard.press(plan.key);
      return;
    case 'see':
      try {
        await expectText(page, plan.text);
      } catch {
        await healSelector(page, 'text', plan.text, automation, llmClient);
      }
      return;
    case 'url-includes':
      await page.waitForURL((url) => url.toString().includes(plan.value));
      return;
    case 'url-is':
      await expectUrl(page, plan.value);
      return;
  }
}

async function runStepWithAiFallback(
  context: StepContext,
  automation?: AutomationConfig,
  llmClient?: ReturnType<typeof createLlmClient>,
): Promise<void> {
  if (!automation || !llmClient) {
    throw new Error(`No step handler matched: ${context.step.keyword} ${context.step.text}`);
  }

  console.log(`AI fallback: interpreting step -> ${context.step.keyword} ${context.step.text}`);

  const sample = await collectPageSample(context.page);
  const prompt = [
    'Interpret one UI automation step and convert it to one JSON action.',
    'Return only JSON with one of these shapes:',
    '{"action":"goto","url":"https://..."}',
    '{"action":"click","target":"Login"}',
    '{"action":"fill","target":"Username","value":"standard_user"}',
    '{"action":"select","target":"Country","value":"Indonesia"}',
    '{"action":"press","key":"Enter"}',
    '{"action":"see","text":"Products"}',
    '{"action":"url-includes","value":"/inventory"}',
    '{"action":"url-is","value":"https://example.com/page"}',
    `Current URL: ${context.page.url()}`,
    `Feature: ${context.feature.name}`,
    `Scenario: ${context.scenario.name}`,
    `Step keyword: ${context.step.keyword}`,
    `Step text: ${context.step.text}`,
    `Visible page sample:\n${sample}`,
  ].join('\n');

  try {
    const raw = await llmClient.generate([
      { role: 'system', content: 'Return only valid JSON. Do not add markdown.' },
      { role: 'user', content: prompt },
    ]);

    const plan = JSON.parse(raw) as AiStepPlan;
    console.log(`AI fallback: planned action -> ${plan.action}`);
    await runPlannedAction(context.page, plan, automation, llmClient);
    context.onAiUsed?.({ action: plan.action, success: true });
  } catch (err) {
    context.onAiUsed?.({ action: 'interpret', success: false, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export class StepRegistry {
  private readonly handlers: StepHandler[] = [];
  private readonly automation?: AutomationConfig;
  private readonly fallback?: (context: StepContext) => Promise<void>;

  constructor(automation?: AutomationConfig, fallback?: (context: StepContext) => Promise<void>) {
    this.automation = automation;
    this.fallback = fallback;
  }

  register(pattern: RegExp, run: StepHandler['run']): void {
    this.handlers.push({ pattern, run });
  }

  getHandlers(): StepHandler[] {
    return [...this.handlers];
  }

  async execute(context: StepContext): Promise<void> {
    for (const handler of this.handlers) {
      const matches = handler.pattern.exec(context.step.text);
      if (!matches) {
        continue;
      }

      await handler.run(context, matches);
      return;
    }

    if (this.fallback) {
      await this.fallback(context);
      return;
    }

    throw new Error(`No step handler matched: ${context.step.keyword} ${context.step.text}`);
  }
}

export function createDefaultRegistry(): StepRegistry {
  const registry = new StepRegistry();

  registry.register(/^I go to "([^"]+)"$/, async ({ page }, matches) => {
    const target = matches[1];
    const url = /^https?:\/\//i.test(target) || target.startsWith('file:')
      ? target
      : target.startsWith('/')
        ? target
        : `/${target}`;

    await page.goto(url);
  });

  registry.register(/^I navigate to "([^"]+)"$/, async ({ page }, matches) => {
    const target = matches[1];
    const url = /^https?:\/\//i.test(target) || target.startsWith('file:')
      ? target
      : target.startsWith('/')
        ? target
        : `/${target}`;

    await page.goto(url);
  });

  registry.register(/^I click "([^"]+)"$/, async ({ page }, matches) => {
    await clickTarget(page, matches[1]);
  });

  registry.register(/^I click the "([^"]+)" button$/, async ({ page }, matches) => {
    await clickTarget(page, matches[1]);
  });

  registry.register(/^I click the ([^"]+) button$/i, async ({ page }, matches) => {
    await clickTarget(page, matches[1]);
  });

  registry.register(/^I fill "([^"]+)" with "([^"]+)"$/, async ({ page }, matches) => {
    await fillTarget(page, matches[1], matches[2]);
  });

  registry.register(/^I fill in "([^"]+)" with "([^"]+)"$/, async ({ page }, matches) => {
    await fillTarget(page, matches[1], matches[2]);
  });

  registry.register(/^I fill in the ([^"]+) field with "([^"]+)"$/i, async ({ page }, matches) => {
    await fillTarget(page, matches[1], matches[2]);
  });

  registry.register(/^I select "([^"]+)" from "([^"]+)"$/, async ({ page }, matches) => {
    await selectTarget(page, matches[2], matches[1]);
  });

  registry.register(/^I press "([^"]+)"$/, async ({ page }, matches) => {
    await page.keyboard.press(matches[1]);
  });

  registry.register(/^I should see "([^"]+)"$/, async ({ page }, matches) => {
    await expectText(page, matches[1]);
  });

  registry.register(/^I should see (?:a heading with text )?"([^"]+)"$/, async ({ page }, matches) => {
    await expectText(page, matches[1]);
  });

  registry.register(/^I should see the "([^"]+)" title on the page$/, async ({ page }, matches) => {
    await expectText(page, matches[1]);
  });

  registry.register(/^I wait for "([^"]+)"$/, async ({ page }, matches) => {
    await expectText(page, matches[1]);
  });

  registry.register(/^the URL should be "([^"]+)"$/, async ({ page }, matches) => {
    await expectUrl(page, matches[1]);
  });

  registry.register(/^the URL should include "([^"]+)"$/, async ({ page }, matches) => {
    await page.waitForURL((url) => url.toString().includes(matches[1]));
  });

  registry.register(/^the URL should contain "([^"]+)"$/, async ({ page }, matches) => {
    await page.waitForURL((url) => url.toString().includes(matches[1]));
  });

  return registry;
}

export function createAutomationAwareRegistry(automation?: AutomationConfig): StepRegistry {
  const llmClient = automation ? createLlmClient(automation) : null;
  const registry = new StepRegistry(automation, (context) => runStepWithAiFallback(context, automation, llmClient));

  // Helper: try healSelector and track AI usage
  async function healAndTrack(
    context: StepContext,
    kind: 'click' | 'fill' | 'select' | 'text',
    target: string,
    value?: string,
  ): Promise<void> {
    try {
      const result = await healSelector(context.page, kind, target, automation, llmClient, value);
      if (result.description.startsWith('ai:')) {
        context.onAiUsed?.({ action: kind, success: true });
      }
    } catch (err) {
      context.onAiUsed?.({ action: `heal:${kind}`, success: false, error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  registry.register(/^I go to "([^"]+)"$/, async ({ page }, matches) => {
    const target = matches[1];
    const url = /^https?:\/\//i.test(target) || target.startsWith('file:')
      ? target
      : target.startsWith('/')
        ? target
        : `/${target}`;

    await page.goto(url);
  });

  registry.register(/^I navigate to "([^"]+)"$/, async ({ page }, matches) => {
    const target = matches[1];
    const url = /^https?:\/\//i.test(target) || target.startsWith('file:')
      ? target
      : target.startsWith('/')
        ? target
        : `/${target}`;

    await page.goto(url);
  });

  registry.register(/^I click "([^"]+)"$/, async (context, matches) => {
    const target = matches[1];
    try {
      await clickTarget(context.page, target);
    } catch {
      await healAndTrack(context, 'click', target);
    }
  });

  registry.register(/^I click the "([^"]+)" button$/, async (context, matches) => {
    const target = matches[1];
    try {
      await clickTarget(context.page, target);
    } catch {
      await healAndTrack(context, 'click', target);
    }
  });

  registry.register(/^I click the ([^"]+) button$/i, async (context, matches) => {
    const target = matches[1];
    try {
      await clickTarget(context.page, target);
    } catch {
      await healAndTrack(context, 'click', target);
    }
  });

  registry.register(/^I fill "([^"]+)" with "([^"]+)"$/, async (context, matches) => {
    const target = matches[1];
    const value = matches[2];
    try {
      await fillTarget(context.page, target, value);
    } catch {
      await healAndTrack(context, 'fill', target, value);
    }
  });

  registry.register(/^I fill in "([^"]+)" with "([^"]+)"$/, async (context, matches) => {
    const target = matches[1];
    const value = matches[2];
    try {
      await fillTarget(context.page, target, value);
    } catch {
      await healAndTrack(context, 'fill', target, value);
    }
  });

  registry.register(/^I fill in the ([^"]+) field with "([^"]+)"$/i, async (context, matches) => {
    const target = matches[1];
    const value = matches[2];
    try {
      await fillTarget(context.page, target, value);
    } catch {
      await healAndTrack(context, 'fill', target, value);
    }
  });

  registry.register(/^I select "([^"]+)" from "([^"]+)"$/, async (context, matches) => {
    const value = matches[1];
    const target = matches[2];
    try {
      await selectTarget(context.page, target, value);
    } catch {
      await healAndTrack(context, 'select', target, value);
    }
  });

  registry.register(/^I press "([^"]+)"$/, async ({ page }, matches) => {
    await page.keyboard.press(matches[1]);
  });

  registry.register(/^I should see "([^"]+)"$/, async (context, matches) => {
    try {
      await expectText(context.page, matches[1]);
    } catch {
      await healAndTrack(context, 'text', matches[1]);
    }
  });

  registry.register(/^I should see (?:a heading with text )?"([^"]+)"$/, async (context, matches) => {
    try {
      await expectText(context.page, matches[1]);
    } catch {
      await healAndTrack(context, 'text', matches[1]);
    }
  });

  registry.register(/^I should see the "([^"]+)" title on the page$/, async (context, matches) => {
    try {
      await expectText(context.page, matches[1]);
    } catch {
      await healAndTrack(context, 'text', matches[1]);
    }
  });

  registry.register(/^I wait for "([^"]+)"$/, async (context, matches) => {
    try {
      await expectText(context.page, matches[1]);
    } catch {
      await healAndTrack(context, 'text', matches[1]);
    }
  });

  registry.register(/^the URL should be "([^"]+)"$/, async ({ page }, matches) => {
    await expectUrl(page, matches[1]);
  });

  registry.register(/^the URL should include "([^"]+)"$/, async ({ page }, matches) => {
    await page.waitForURL((url) => url.toString().includes(matches[1]));
  });

  registry.register(/^the URL should contain "([^"]+)"$/, async ({ page }, matches) => {
    await page.waitForURL((url) => url.toString().includes(matches[1]));
  });

  return registry;
}
