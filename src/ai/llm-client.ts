import type { AutomationConfig } from '../types';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResponse {
  content: string;
  usage?: LlmUsage;
}

export interface LlmClient {
  generate(messages: LlmMessage[]): Promise<LlmResponse>;
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function extractContent(payload: { choices?: Array<{ message?: { content?: string } }> }): string {
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI response did not include completion content.');
  }

  return content;
}

export class OpenAiCompatibleClient implements LlmClient {
  constructor(private readonly config: AutomationConfig) {}

  async generate(messages: LlmMessage[]): Promise<LlmResponse> {
    if (!this.config.apiKey) {
      throw new Error('Missing API key for AI generation. Set HEYBUGS_AI_API_KEY or OPENAI_API_KEY in .env.');
    }

    const response = await fetch(`${trimSlash(this.config.apiBaseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed with HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    return {
      content: extractContent(payload),
      usage: payload.usage ? {
        promptTokens: payload.usage.prompt_tokens ?? 0,
        completionTokens: payload.usage.completion_tokens ?? 0,
        totalTokens: payload.usage.total_tokens ?? 0,
      } : undefined,
    };
  }
}

export class OpenRouterClient implements LlmClient {
  constructor(private readonly config: AutomationConfig) {}

  async generate(messages: LlmMessage[]): Promise<LlmResponse> {
    if (!this.config.apiKey) {
      throw new Error('Missing OpenRouter API key. Set HEYBUGS_AI_API_KEY or OPENROUTER_API_KEY in .env.');
    }

    const response = await fetch(`${trimSlash(this.config.apiBaseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.config.appUrl ?? 'https://github.com/heybugs/os-heybugs',
        'X-Title': this.config.appName ?? 'os-heybugs',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed with HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    return {
      content: extractContent(payload),
      usage: payload.usage ? {
        promptTokens: payload.usage.prompt_tokens ?? 0,
        completionTokens: payload.usage.completion_tokens ?? 0,
        totalTokens: payload.usage.total_tokens ?? 0,
      } : undefined,
    };
  }
}

export class GeminiOpenAiClient implements LlmClient {
  constructor(private readonly config: AutomationConfig) {}

  async generate(messages: LlmMessage[]): Promise<LlmResponse> {
    if (!this.config.apiKey) {
      throw new Error('Missing Gemini API key. Set HEYBUGS_AI_API_KEY or GEMINI_API_KEY in .env.');
    }

    const response = await fetch(`${trimSlash(this.config.apiBaseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    return {
      content: extractContent(payload),
      usage: payload.usage ? {
        promptTokens: payload.usage.prompt_tokens ?? 0,
        completionTokens: payload.usage.completion_tokens ?? 0,
        totalTokens: payload.usage.total_tokens ?? 0,
      } : undefined,
    };
  }
}

export class ClaudeClient implements LlmClient {
  constructor(private readonly config: AutomationConfig) {}

  async generate(messages: LlmMessage[]): Promise<LlmResponse> {
    if (!this.config.apiKey) {
      throw new Error('Missing Anthropic API key. Set HEYBUGS_AI_API_KEY or ANTHROPIC_API_KEY in .env.');
    }

    const system = messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n');
    const conversation = messages
      .filter((item) => item.role !== 'system')
      .map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content }));

    const response = await fetch(`${trimSlash(this.config.apiBaseUrl)}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.anthropicVersion ?? '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        system: system || undefined,
        max_tokens: 1200,
        messages: conversation,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude request failed with HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = payload.content?.find((item) => item.type === 'text')?.text;
    if (!text) {
      throw new Error('Claude response did not include text content.');
    }

    return {
      content: text,
      usage: payload.usage ? {
        promptTokens: payload.usage.input_tokens ?? 0,
        completionTokens: payload.usage.output_tokens ?? 0,
        totalTokens: (payload.usage.input_tokens ?? 0) + (payload.usage.output_tokens ?? 0),
      } : undefined,
    };
  }
}

export class OllamaClient implements LlmClient {
  constructor(private readonly config: AutomationConfig) {}

  async generate(messages: LlmMessage[]): Promise<LlmResponse> {
    const response = await fetch(`${trimSlash(this.config.apiBaseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    return {
      content: extractContent(payload),
      usage: payload.usage ? {
        promptTokens: payload.usage.prompt_tokens ?? 0,
        completionTokens: payload.usage.completion_tokens ?? 0,
        totalTokens: payload.usage.total_tokens ?? 0,
      } : undefined,
    };
  }
}

export class SumopodClient implements LlmClient {
  constructor(private readonly config: AutomationConfig) {}

  async generate(messages: LlmMessage[]): Promise<LlmResponse> {
    if (!this.config.apiKey) {
      throw new Error('Missing Sumopod API key. Set HEYBUGS_AI_API_KEY or SUMOPOD_API_KEY in .env.');
    }

    const response = await fetch(`${trimSlash(this.config.apiBaseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sumopod request failed with HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    return {
      content: extractContent(payload),
      usage: payload.usage ? {
        promptTokens: payload.usage.prompt_tokens ?? 0,
        completionTokens: payload.usage.completion_tokens ?? 0,
        totalTokens: payload.usage.total_tokens ?? 0,
      } : undefined,
    };
  }
}

export function createLlmClient(config: AutomationConfig): LlmClient | null {
  if (config.aiProvider === 'mock') {
    return null;
  }

  if (config.aiProvider === 'ollama') {
    return new OllamaClient(config);
  }

  if (config.aiProvider === 'sumopod') {
    return new SumopodClient(config);
  }

  if (!config.apiKey) {
    return null;
  }

  switch (config.aiProvider) {
    case 'openrouter':
      return new OpenRouterClient(config);
    case 'gemini':
      return new GeminiOpenAiClient(config);
    case 'claude':
      return new ClaudeClient(config);
    case 'openai-compatible':
    default:
      return new OpenAiCompatibleClient(config);
  }
}