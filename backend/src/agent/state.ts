export interface ProductPayload {
  brand: string;
  name: string;
  features: string[];
  imageUrl: string;
  videoUrl?: string;
}

export interface PollDraft {
  category: string;
  themeTitle: string;
  productA: ProductPayload;
  productB: ProductPayload;
  curatorNote?: string;
}

export interface QueryCandidate {
  category: string;
  themeTitle: string;
  queryA: string;
  queryB: string;
}

export interface AgentState {
  rawTrends: string;
  dynamicQueries: QueryCandidate[];
  finalJson: PollDraft[];
}
