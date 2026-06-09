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

async function clickTarget(page: Page, target: string): Promise<void> {
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

async function fillTarget(page: Page, label: string, value: string): Promise<void> {
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
      try {
        await clickTarget(page, plan.target);
      } catch {
        await healSelector(page, 'click', plan.target, automation, llmClient);
      }
      return;
    case 'fill':
      try {
        await fillTarget(page, plan.target, plan.value);
      } catch {
        await healSelector(page, 'fill', plan.target, automation, llmClient, plan.value);
      }
      return;
    case 'select':
      try {
        await selectTarget(page, plan.target, plan.value);
      } catch {
        await healSelector(page, 'select', plan.target, automation, llmClient, plan.value);
      }
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

  const raw = await llmClient.generate([
    { role: 'system', content: 'Return only valid JSON. Do not add markdown.' },
    { role: 'user', content: prompt },
  ]);

  const plan = JSON.parse(raw) as AiStepPlan;
  console.log(`AI fallback: planned action -> ${plan.action}`);
  await runPlannedAction(context.page, plan, automation, llmClient);
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
    const target = matches[1];
    try {
      await clickTarget(page, target);
    } catch {
      await healSelector(page, 'click', target, automation, llmClient);
    }
  });

  registry.register(/^I click the "([^"]+)" button$/, async ({ page }, matches) => {
    const target = matches[1];
    try {
      await clickTarget(page, target);
    } catch {
      await healSelector(page, 'click', target, automation, llmClient);
    }
  });

  registry.register(/^I click the ([^"]+) button$/i, async ({ page }, matches) => {
    const target = matches[1];
    try {
      await clickTarget(page, target);
    } catch {
      await healSelector(page, 'click', target, automation, llmClient);
    }
  });

  registry.register(/^I fill "([^"]+)" with "([^"]+)"$/, async ({ page }, matches) => {
    const target = matches[1];
    const value = matches[2];
    try {
      await fillTarget(page, target, value);
    } catch {
      await healSelector(page, 'fill', target, automation, llmClient, value);
    }
  });

  registry.register(/^I fill in "([^"]+)" with "([^"]+)"$/, async ({ page }, matches) => {
    const target = matches[1];
    const value = matches[2];
    try {
      await fillTarget(page, target, value);
    } catch {
      await healSelector(page, 'fill', target, automation, llmClient, value);
    }
  });

  registry.register(/^I fill in the ([^"]+) field with "([^"]+)"$/i, async ({ page }, matches) => {
    const target = matches[1];
    const value = matches[2];
    try {
      await fillTarget(page, target, value);
    } catch {
      await healSelector(page, 'fill', target, automation, llmClient, value);
    }
  });

  registry.register(/^I select "([^"]+)" from "([^"]+)"$/, async ({ page }, matches) => {
    const value = matches[1];
    const target = matches[2];
    try {
      await selectTarget(page, target, value);
    } catch {
      await healSelector(page, 'select', target, automation, llmClient, value);
    }
  });

  registry.register(/^I press "([^"]+)"$/, async ({ page }, matches) => {
    await page.keyboard.press(matches[1]);
  });

  registry.register(/^I should see "([^"]+)"$/, async ({ page }, matches) => {
    try {
      await expectText(page, matches[1]);
    } catch {
      await healSelector(page, 'text', matches[1], automation, llmClient);
    }
  });

  registry.register(/^I should see (?:a heading with text )?"([^"]+)"$/, async ({ page }, matches) => {
    try {
      await expectText(page, matches[1]);
    } catch {
      await healSelector(page, 'text', matches[1], automation, llmClient);
    }
  });

  registry.register(/^I should see the "([^"]+)" title on the page$/, async ({ page }, matches) => {
    try {
      await expectText(page, matches[1]);
    } catch {
      await healSelector(page, 'text', matches[1], automation, llmClient);
    }
  });

  registry.register(/^I wait for "([^"]+)"$/, async ({ page }, matches) => {
    try {
      await expectText(page, matches[1]);
    } catch {
      await healSelector(page, 'text', matches[1], automation, llmClient);
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
