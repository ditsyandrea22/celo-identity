'use client';

import { Card } from '@/components/ui/card';

interface ScoreBreakdownProps {
  score: number;
  tier: string;
}

export function ScoreBreakdown({ score, tier }: ScoreBreakdownProps) {
  const tierDescriptions: Record<string, string> = {
    LEADER: 'Elite contributor with major ecosystem impact',
    CONTRIBUTOR: 'Active contributor with consistent impact',
    BUILDER: 'Early contributor building the ecosystem',
    UNRANKED: 'Start contributing to earn reputation',
  };

  const nextMilestone = score < 100 ? 100 : score < 300 ? 300 : score < 700 ? 700 : null;
  const pointsNeeded = nextMilestone ? nextMilestone - score : 0;

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <h3 className="text-white font-bold mb-4">About Your Reputation</h3>

      <div className="space-y-4">
        <div>
          <p className="text-slate-400 text-sm mb-1">Current Tier</p>
          <p className="text-white font-semibold">{tier}</p>
          <p className="text-slate-500 text-sm mt-1">{tierDescriptions[tier]}</p>
        </div>

        {nextMilestone && (
          <div>
            <p className="text-slate-400 text-sm mb-1">Next Milestone</p>
            <p className="text-emerald-400 font-semibold">
              {pointsNeeded} points to {nextMilestone} (next tier)
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-700">
          <p className="text-slate-400 text-xs">
            Your reputation score is verified on-chain and represents your verified contributions
            to the ecosystem.
          </p>
        </div>
      </div>
    </Card>
  );
}
