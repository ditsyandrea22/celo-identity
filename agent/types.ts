export type ContributionType =
  | "PR_MERGED"
  | "COMMIT"
  | "POST_IMPACT"
  | "CODE_REVIEW"
  | "DOCUMENTATION"
  | "BUG_FIX";

export type ReputationTier = "BUILDER" | "CONTRIBUTOR" | "LEADER";

export interface Contribution {
  user: string;
  type: ContributionType;
  description: string;
  repo?: string;
  pr?: number;
  timestamp: number;
  source: "github" | "farcaster" | "onchain" | "manual";
}

export interface ScoringResult {
  baseScore: number;
  multiplier: number;
  finalScore: number;
  explanation: string;
}

export interface ExecutionResult {
  success: boolean;
  registryTx?: string;
  scoreTx?: string;
  badgeTx?: string;
  error?: string;
}

export interface TierConfig {
  name: ReputationTier;
  minScore: number;
}
