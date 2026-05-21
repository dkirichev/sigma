import type { RiskResult } from '@sigma/analysis';
import type { SearchTendersQuery, TenderSummary } from '@sigma/api-contract';

export interface AssistantTool<Input, Output> {
  name: string;
  description: string;
  run: (input: Input) => Promise<Output>;
}

export interface AssistantToolset {
  searchTenders: AssistantTool<SearchTendersQuery, TenderSummary[]>;
  explainRisk: AssistantTool<{ tenderId: string }, RiskResult | null>;
}

export interface ToolDeps {
  searchTenders: (query: SearchTendersQuery) => Promise<TenderSummary[]>;
  explainRisk: (tenderId: string) => Promise<RiskResult | null>;
}

export function createToolset(deps: ToolDeps): AssistantToolset {
  return {
    searchTenders: {
      name: 'search_tenders',
      description: 'Търси обществени поръчки по ключова дума, статус или ниво на риск.',
      run: (input) => deps.searchTenders(input),
    },
    explainRisk: {
      name: 'explain_risk',
      description: 'Връща разбивка на рисковия скор за конкретна поръчка.',
      run: (input) => deps.explainRisk(input.tenderId),
    },
  };
}
