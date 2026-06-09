import type { FeatureDoc, Scenario, Step, StepKeyword } from '../types';

interface ScenarioOutlineDraft {
  name: string;
  tags: string[];
  steps: Step[];
  exampleHeaders?: string[];
  exampleRows: string[][];
}

function normalizeStepKeyword(keyword: string, lastKeyword: StepKeyword): StepKeyword {
  if (keyword === 'And' || keyword === 'But') {
    return lastKeyword;
  }

  return keyword as StepKeyword;
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function createStep(keyword: StepKeyword, text: string): Step {
  return { keyword, text };
}

function applyExampleValues(input: string, values: Record<string, string>): string {
  return input.replace(/<([^>]+)>/g, (_match, key: string) => values[key] ?? `<${key}>`);
}

function expandScenarioOutline(feature: FeatureDoc, outline: ScenarioOutlineDraft): void {
  if (!outline.exampleHeaders || outline.exampleRows.length === 0) {
    feature.scenarios.push({
      name: outline.name,
      tags: [...outline.tags],
      steps: outline.steps.map((step) => ({
        keyword: step.keyword,
        text: step.text,
        dataTable: step.dataTable ? step.dataTable.map((row) => [...row]) : undefined,
      })),
    });
    return;
  }

  for (let index = 0; index < outline.exampleRows.length; index += 1) {
    const row = outline.exampleRows[index];
    const values: Record<string, string> = {};
    for (let column = 0; column < outline.exampleHeaders.length; column += 1) {
      values[outline.exampleHeaders[column]] = row[column] ?? '';
    }

    feature.scenarios.push({
      name: `${outline.name} [${index + 1}]`,
      tags: [...outline.tags],
      steps: outline.steps.map((step) => ({
        keyword: step.keyword,
        text: applyExampleValues(step.text, values),
        dataTable: step.dataTable?.map((tableRow) => tableRow.map((cell) => applyExampleValues(cell, values))),
      })),
    });
  }
}

export function parseFeature(source: string): FeatureDoc {
  const feature: FeatureDoc = {
    name: '',
    description: [],
    background: [],
    scenarios: [],
    tags: [],
  };

  let currentScenario: Scenario | null = null;
  let currentStep: Step | null = null;
  let currentOutline: ScenarioOutlineDraft | null = null;
  let inExamplesSection = false;
  let lastKeyword: StepKeyword = 'Given';
  let pendingTags: string[] = [];
  let section: 'description' | 'background' | 'scenario' = 'description';

  const lines = source.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('@')) {
      pendingTags = line.split(/\s+/).filter(Boolean).map((tag) => tag.replace(/^@/, ''));
      continue;
    }

    const flushOutline = (): void => {
      if (currentOutline) {
        expandScenarioOutline(feature, currentOutline);
        currentOutline = null;
      }
      inExamplesSection = false;
    };

    if (/^Feature:/i.test(line)) {
      flushOutline();
      feature.name = line.replace(/^Feature:/i, '').trim();
      if (pendingTags.length > 0) {
        feature.tags.push(...pendingTags);
        pendingTags = [];
      }
      section = 'description';
      continue;
    }

    if (/^Background:/i.test(line)) {
      flushOutline();
      section = 'background';
      currentScenario = null;
      currentStep = null;
      lastKeyword = 'Given';
      continue;
    }

    if (/^Scenario:/i.test(line)) {
      flushOutline();
      currentScenario = {
        name: line.replace(/^Scenario:/i, '').trim(),
        tags: pendingTags,
        steps: [],
      };
      pendingTags = [];
      feature.scenarios.push(currentScenario);
      currentStep = null;
      lastKeyword = 'Given';
      section = 'scenario';
      continue;
    }

    if (/^Scenario Outline:/i.test(line) || /^Scenario Template:/i.test(line)) {
      flushOutline();
      currentScenario = null;
      currentOutline = {
        name: line.replace(/^Scenario (Outline|Template):/i, '').trim(),
        tags: pendingTags,
        steps: [],
        exampleRows: [],
      };
      pendingTags = [];
      currentStep = null;
      lastKeyword = 'Given';
      section = 'scenario';
      continue;
    }

    if (/^Examples:/i.test(line) && currentOutline) {
      inExamplesSection = true;
      currentStep = null;
      continue;
    }

    const stepMatch = line.match(/^(Given|When|Then|And|But|\*)\s+(.*)$/i);
    if (stepMatch) {
      const rawKeyword = stepMatch[1];
      const text = stepMatch[2].trim();
      const keyword = normalizeStepKeyword(rawKeyword === '*' ? lastKeyword : (rawKeyword[0].toUpperCase() + rawKeyword.slice(1).toLowerCase()) as StepKeyword, lastKeyword);
      currentStep = createStep(keyword, text);

      if (section === 'background') {
        feature.background.push(currentStep);
      } else if (currentOutline) {
        currentOutline.steps.push(currentStep);
      } else if (currentScenario) {
        currentScenario.steps.push(currentStep);
      }

      if (keyword !== 'And' && keyword !== 'But') {
        lastKeyword = keyword;
      }

      continue;
    }

    if (line.startsWith('|') && inExamplesSection && currentOutline) {
      const row = parseTableRow(line);
      if (!currentOutline.exampleHeaders) {
        currentOutline.exampleHeaders = row;
      } else {
        currentOutline.exampleRows.push(row);
      }
      continue;
    }

    if (line.startsWith('|') && currentStep) {
      currentStep.dataTable ??= [];
      currentStep.dataTable.push(parseTableRow(line));
      continue;
    }

    if (section === 'description' && !feature.name) {
      feature.description.push(line);
    } else if (section === 'description') {
      feature.description.push(line);
    }
  }

  if (currentOutline) {
    expandScenarioOutline(feature, currentOutline);
  }

  if (!feature.name) {
    throw new Error('Feature file must start with a Feature header.');
  }

  return feature;
}
