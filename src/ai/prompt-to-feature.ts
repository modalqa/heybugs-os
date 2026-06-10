import type { AutomationConfig, PromptToFeatureResult } from '../types';
import { createLlmClient, type LlmMessage } from './llm-client';
import { getGlobalTokenTracker } from './token-tracker';

function fallbackFeatureFromPrompt(prompt: string): PromptToFeatureResult {
  const lower = prompt.toLowerCase();
  const featureName = prompt.trim().replace(/[.?!]+$/, '') || 'Generated automation flow';
  const isLoginFlow = /login|sign in|signin|sign-in/.test(lower);
  const isSearchFlow = /search/.test(lower);

  if (isLoginFlow) {
    return {
      source: 'heuristic',
      featureText: `Feature: ${featureName}

  Scenario: User signs in
    Given I go to "/login"
    When I fill "Email" with "demo@example.com"
    And I fill "Password" with "secret"
    And I click "Sign in"
    Then I should see "Dashboard"`,
    };
  }

  if (isSearchFlow) {
    return {
      source: 'heuristic',
      featureText: `Feature: ${featureName}

  Scenario: User searches for content
    Given I go to "/"
    When I fill "Search" with "${prompt.trim().slice(0, 24) || 'query'}"
    And I press "Enter"
    Then I should see "Search results"`,
    };
  }

  return {
    source: 'heuristic',
    featureText: `Feature: ${featureName}

  Scenario: User completes the requested flow
    Given I go to "/"
    When I perform the requested steps
    Then I should see the expected outcome`,
  };
}

export async function promptToFeature(prompt: string, config: AutomationConfig): Promise<PromptToFeatureResult> {
  if (!config.promptToAutomation) {
    return fallbackFeatureFromPrompt(prompt);
  }

  const client = createLlmClient(config);
  if (!client) {
    return fallbackFeatureFromPrompt(prompt);
  }

  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: [
        'You convert natural language QA requests into valid Gherkin feature files.',
        'Output only raw Gherkin text. Do not wrap output in markdown code fences.',
        'Prefer these step shapes when possible:',
        'Given I go to "<url-or-path>"',
        'When I fill "<label>" with "<value>"',
        'When I click "<target>"',
        'Then I should see "<text>"',
        'Then the URL should include "<text>"',
        'Use And only as continuation of the same actions above.',
        'Natural phrasing is acceptable when it stays clear and user-facing.',
        'Prefer concrete public URLs when the prompt mentions a known site.',
      ].join(' '),
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  const response = await client.generate(messages);
  if (response.usage) {
    getGlobalTokenTracker().addUsage(response.usage, config.model);
  }
  return {
    source: 'ai',
    featureText: response.content,
  };
}