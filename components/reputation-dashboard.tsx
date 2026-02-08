'use client';

import { useState, useEffect } from 'react';
import { Contract, BrowserProvider } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReputationBadge } from './reputation-badge';
import { ScoreBreakdown } from './score-breakdown';

const SCORE_ABI = [
  'function getScore(address user) view returns (uint256)',
  'function score(address user) view returns (uint256)',
];

const BADGE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string memory)',
];

interface ReputationDashboardProps {
  address: string;
  provider: BrowserProvider;
}

export function ReputationDashboard({
  address,
  provider,
}: ReputationDashboardProps) {
  const [reputation, setReputation] = useState<string>('0');
  const [badges, setBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [address, provider]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      // Get reputation score
      const scoreAddress = process.env.NEXT_PUBLIC_SCORE_ADDRESS;
      const badgeAddress = process.env.NEXT_PUBLIC_BADGE_ADDRESS;

      console.log('Loading data with addresses:', { scoreAddress, badgeAddress });

      // If no contract addresses, just show 0 score - don't error
      if (!scoreAddress || !badgeAddress) {
        console.log('Contract addresses not configured, showing default UI');
        setReputation('0');
        setBadges([]);
        setLoading(false);
        return;
      }

      const scoreContract = new Contract(scoreAddress, SCORE_ABI, provider);
      const badgeContract = new Contract(badgeAddress, BADGE_ABI, provider);

      // Fetch reputation score
      let score = 0n;
      try {
        const result = await scoreContract.score(address);
        score = result;
        setReputation(result.toString());
        console.log('Score fetched:', result.toString());
      } catch (err) {
        console.log('score() method failed, trying getScore():', err);
        try {
          const result = await scoreContract.getScore(address);
          score = result;
          setReputation(result.toString());
          console.log('getScore() succeeded:', result.toString());
        } catch (err2) {
          console.log('Both score methods failed:', err2);
          setReputation('0');
        }
      }

      // Fetch badges
      try {
        const balance = await badgeContract.balanceOf(address);
        const badgeUris: string[] = [];
        console.log('Badge balance:', balance.toString());

        for (let i = 0; i < Number(balance); i++) {
          try {
            const tokenId = await badgeContract.tokenOfOwnerByIndex(address, i);
            const uri = await badgeContract.tokenURI(tokenId);
            badgeUris.push(uri);
          } catch {
            // Skip if token not found
            console.log('Skipped badge at index', i);
          }
        }

        setBadges(badgeUris);
        console.log('Loaded badges:', badgeUris.length);
      } catch (err) {
        console.log('Badge loading failed:', err);
        setBadges([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      console.error('Error loading data:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const getTier = (score: number): string => {
    if (score >= 700) return 'LEADER';
    if (score >= 300) return 'CONTRIBUTOR';
    if (score >= 100) return 'BUILDER';
    return 'UNRANKED';
  };

  const score = Number(reputation);
  const tier = getTier(score);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="space-y-2">
          <p className="text-slate-400 text-sm">Wallet Address</p>
          <p className="text-white font-mono text-sm break-all">{address}</p>
        </div>
      </Card>

      {/* Main Score Card */}
      <Card className="bg-gradient-to-br from-emerald-900/30 to-slate-900/30 border-emerald-500/30 p-8">
        <div className="text-center space-y-4">
          <p className="text-slate-400 text-sm">Reputation Score</p>
          <div className="text-6xl font-bold text-emerald-400">{score}</div>
          <div className="text-lg font-semibold text-emerald-300">{tier}</div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min((score / 700) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Builder (100)</span>
              <span>Contributor (300)</span>
              <span>Leader (700)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Badges Section */}
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <h3 className="text-white font-bold mb-4">Reputation Badges</h3>
        {badges.length > 0 ? (
          <div className="space-y-3">
            {badges.map((uri, idx) => (
              <ReputationBadge key={idx} uri={uri} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No badges earned yet</p>
            <p className="text-xs mt-2">Keep contributing to unlock badges!</p>
          </div>
        )}
      </Card>

      {/* Score Breakdown */}
      <ScoreBreakdown score={score} tier={tier} />

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={loadData}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {error && <div className="text-red-400 text-sm p-3 rounded bg-red-900/20">{error}</div>}
    </div>
  );
}
