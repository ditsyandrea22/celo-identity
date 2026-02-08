export type ContributionType = 
  | 'PR_MERGED'
  | 'COMMIT'
  | 'BUG_FIX'
  | 'DOCUMENTATION'
  | 'CODE_REVIEW'
  | 'POST_IMPACT'
  | 'OTHER';

export interface Contribution {
  id: string;
  userAddress: string;
  type: ContributionType;
  title: string;
  description: string;
  link: string;
  timestamp: number;
  status: 'pending' | 'verified' | 'rejected';
  score?: number;
  badgeEarned?: boolean;
}

export interface VerificationResult {
  score: number;
  tier: 'BUILDER' | 'CONTRIBUTOR' | 'LEADER' | 'UNRANKED';
  multiplier: number;
  badgeEarned: boolean;
  message: string;
}
