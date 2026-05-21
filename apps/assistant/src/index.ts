import { createToolset } from '@sigma/assistant-tools';

export interface Env {
  ANTHROPIC_API_KEY?: string;
}

// Wired with stub data sources for now; the API worker becomes the real backend.
const toolset = createToolset({
  searchTenders: async () => [],
  explainRisk: async () => null,
});

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'sigma-assistant' });
    }

    if (url.pathname === '/assistant/tools') {
      return Response.json({
        tools: Object.values(toolset).map((t) => ({ name: t.name, description: t.description })),
        modelConfigured: Boolean(env.ANTHROPIC_API_KEY),
      });
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
