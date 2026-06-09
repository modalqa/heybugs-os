import type { Page } from 'playwright';
import type { AutomationConfig } from '../types';
import type { LlmClient } from '../ai/llm-client';

type SelectorKind = 'click' | 'fill' | 'select' | 'text';

export interface HealedLocator {
  description: string;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function buildCandidates(page: Page, kind: SelectorKind, target: string, value?: string) {
  const label = normalize(target);

  if (kind === 'click') {
    return [
      { description: `role=button name=${label}`, perform: () => page.getByRole('button', { name: label }).click() },
      { description: `role=link name=${label}`, perform: () => page.getByRole('link', { name: label }).click() },
      { description: `text=${label}`, perform: () => page.getByText(label, { exact: true }).click() },
      { description: `label=${label}`, perform: () => page.getByLabel(label, { exact: true }).click() },
    ];
  }

  if (kind === 'fill') {
    return [
      { description: `label=${label}`, perform: () => page.getByLabel(label, { exact: true }).fill(value ?? '') },
      { description: `placeholder=${label}`, perform: () => page.getByPlaceholder(label, { exact: true }).fill(value ?? '') },
      { description: `role=textbox name=${label}`, perform: () => page.getByRole('textbox', { name: label }).fill(value ?? '') },
    ];
  }

  if (kind === 'select') {
    return [
      { description: `label=${label}`, perform: () => page.getByLabel(label, { exact: true }).selectOption({ label: value ?? '' }) },
      { description: `role=combobox name=${label}`, perform: () => page.getByRole('combobox', { name: label }).selectOption({ label: value ?? '' }) },
    ];
  }

  return [
    { description: `text=${label}`, perform: () => page.getByText(label, { exact: true }).waitFor({ state: 'visible' }) },
  ];
}

async function collectBodySample(page: Page): Promise<string> {
  try {
    const bodyText = await page.locator('body').innerText();
    return bodyText.slice(0, 1200);
  } catch {
    return '';
  }
}

export async function healSelector(page: Page, kind: SelectorKind, target: string, config?: AutomationConfig, llmClient?: LlmClient | null, value?: string): Promise<HealedLocator> {
  const candidates = buildCandidates(page, kind, target, value);

  for (const candidate of candidates) {
    try {
      await candidate.perform();
      return { description: candidate.description };
    } catch {
      continue;
    }
  }

  if (config?.autoHealSelectors && llmClient) {
    const sample = await collectBodySample(page);
    const prompt = [
      'You are helping recover a broken Playwright selector.',
      `Selector kind: ${kind}`,
      `Target: ${target}`,
      `Visible page sample: ${sample}`,
      'Return one JSON object with keys: strategy and selector.',
      'Valid strategies: getByRole, getByLabel, getByText, getByPlaceholder, css.',
    ].join('\n');

    try {
      const raw = await llmClient.generate([{ role: 'system', content: 'Return only JSON.' }, { role: 'user', content: prompt }]);
      const parsed = JSON.parse(raw) as { strategy?: string; selector?: string; value?: string };

      if (parsed.strategy === 'getByRole' && parsed.selector) {
        const locator = page.getByRole(parsed.selector, { name: parsed.value ?? target });
        const result: HealedLocator = {
          description: `ai:getByRole(${parsed.selector}, ${parsed.value ?? target})`,
        };

        if (kind === 'text') {
          await locator.waitFor({ state: 'visible' });
          return result;
        }

        if (kind === 'fill') {
          await locator.fill(value ?? '');
          return result;
        }

        if (kind === 'select') {
          await locator.selectOption({ label: value ?? target });
          return result;
        }

        await locator.click();
        return result;
      }

      if (parsed.strategy === 'getByLabel' && parsed.selector) {
        const locator = page.getByLabel(parsed.selector, { exact: true });
        const result: HealedLocator = {
          description: `ai:getByLabel(${parsed.selector})`,
        };

        if (kind === 'text') {
          await locator.waitFor({ state: 'visible' });
          return result;
        }

        if (kind === 'fill') {
          await locator.fill(value ?? '');
          return result;
        }

        if (kind === 'select') {
          await locator.selectOption({ label: value ?? target });
          return result;
        }

        await locator.click();
        return result;
      }

      if (parsed.strategy === 'getByText' && parsed.selector) {
        const locator = page.getByText(parsed.selector, { exact: true });
        await locator.waitFor({ state: 'visible' });
        return {
          description: `ai:getByText(${parsed.selector})`,
        };
      }
    } catch {
      // Fall through to the final error.
    }
  }

  throw new Error(`Unable to self-heal selector for ${kind}: ${target}`);
}