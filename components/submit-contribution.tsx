import React from "react"

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Loader2, History } from 'lucide-react';
import { getUserContributions, getUserTier, getReputationHistory, isSupabaseConfigured, updateContributionWithTx } from '@/lib/supabase';
import { updateOnChainScore, getOnChainScore } from '@/lib/contract-interaction';
import { mintBadge } from '@/lib/badge-minting';

interface SubmitContributionProps {
  address: string;
}

interface StoredContribution {
  id: string;
  score: number;
  title: string;
  contribution_type: string;
  status: string;
  created_at: string;
}

interface UserTierInfo {
  current_tier: string;
  total_score: number;
  builder_achieved_at?: string;
  contributor_achieved_at?: string;
  leader_achieved_at?: string;
}

export function SubmitContribution({ address }: SubmitContributionProps) {
  const [githubLink, setGithubLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [onChainLoading, setOnChainLoading] = useState(false);
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    score?: number;
    newTotalScore?: number;
    newTier?: string;
    message?: string;
    error?: string;
    onChainTxHash?: string;
    onChainError?: string;
    onChainVerifiedScore?: number;
    badgeTxHash?: string;
    badgeError?: string;
    badgeTier?: string;
    aiResult?: any;
    githubAnalysis?: any;
  } | null>(null);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [contributions, setContributions] = useState<StoredContribution[]>([]);
  const [userTier, setUserTier] = useState<UserTierInfo | null>({
    current_tier: 'UNRANKED',
    total_score: 0,
  });
  const [historyLoading, setHistoryLoading] = useState(false);

  // Update local contribution status (before Supabase sync)
  const updateLocalContributionStatus = (score: number, txHash: string) => {
    setContributions(prev => 
      prev.map(contrib =>
        contrib.score === score && contrib.status === 'pending'
          ? {
              ...contrib,
              status: 'verified',
            }
          : contrib
      )
    );
    console.log('✅ Local contribution status updated to verified');
  };

  // Load history when component mounts or address changes
  useEffect(() => {
    if (address && isSupabaseConfigured) {
      loadUserData();
    }
  }, [address]);

  // Calculate tier from score
  const getTierFromScore = (score: number): string => {
    if (score >= 700) return 'LEADER';
    if (score >= 300) return 'CONTRIBUTOR';
    if (score >= 100) return 'BUILDER';
    return 'UNRANKED';
  };

  const loadUserData = async () => {
    if (!isSupabaseConfigured) {
      console.warn('⚠️ Supabase not configured');
      return;
    }

    if (!address) {
      console.warn('⚠️ No address provided');
      return;
    }

    console.log('📥 [loadUserData] Starting load for:', address);
    setHistoryLoading(true);
    try {
      console.log('📚 [loadUserData] Fetching contributions and tier...');
      
      const [contribResult, tierResult] = await Promise.all([
        getUserContributions(address),
        getUserTier(address),
      ]);

      console.log('📦 [loadUserData] Results received:');
      console.log('  - Contributions success:', contribResult.success);
      console.log('  - Tier success:', tierResult.success);

      // Process contributions
      if (contribResult.success && contribResult.contributions) {
        const contributionCount = contribResult.contributions.length;
        console.log('✅ [loadUserData] Setting contributions:', contributionCount, 'items');
        setContributions(contribResult.contributions);
        console.log('📋 [loadUserData] Contribution state updated');
      } else {
        console.warn('⚠️ [loadUserData] Contributions fetch failed or empty:', contribResult.error);
        setContributions([]);
      }
      
      // Process tier
      if (tierResult.success && tierResult.tier) {
        console.log('✅ [loadUserData] Setting tier:', tierResult.tier.current_tier, 'Score:', tierResult.tier.total_score);
        setUserTier(tierResult.tier);
        console.log('📊 [loadUserData] Tier state updated');
      } else {
        console.warn('⚠️ [loadUserData] Tier fetch failed or empty:', tierResult.error);
        setUserTier({
          current_tier: 'UNRANKED',
          total_score: 0,
        });
      }
      
      console.log('🎉 [loadUserData] Complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ [loadUserData] Exception:', message);
      console.error('Full error:', err);
    } finally {
      setHistoryLoading(false);
      console.log('✅ [loadUserData] Loading finished');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    if (!githubLink.trim()) {
      setResult({ success: false, error: 'Please enter a GitHub link' });
      setLoading(false);
      return;
    }

    try {
      console.log('📡 Submitting contribution request...');
      console.log('GitHub Link:', githubLink);
      console.log('User Address:', address);
      
      const response = await fetch('/api/contributions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          type: 'PR_MERGED',
          title: '',
          description: '',
          link: githubLink,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ API Error (Status ' + response.status + '):', data.error);
        setResult({ success: false, error: data.error });
        setLoading(false);
        return;
      }

      // Save to localStorage
      try {
        const storageKey = `submissions_${address}`;
        const existing = localStorage.getItem(storageKey);
        const submissions = existing ? JSON.parse(existing) : [];
        submissions.push(data.contribution);
        localStorage.setItem(storageKey, JSON.stringify(submissions));
      } catch (e) {
        console.log('Error saving to localStorage:', e);
      }

      setResult({
        success: true,
        score: data.score,
        newTotalScore: data.newTotalScore,
        newTier: data.newTier,
        message: data.message,
        aiResult: data.aiResult,
        githubAnalysis: data.githubAnalysis,
      });

      // Reset form
      setGithubLink('');

      // Only submit to blockchain if score is valid (> 0) and not rejected
      if (data.score > 0 && data.aiResult?.recommendation !== 'reject') {
        // Now submit to on-chain smart contract FIRST (before loading history)
        setOnChainLoading(true);
        console.log('📤 Submitting score to blockchain...');
        const onChainResult = await updateOnChainScore(address, data.score);
      
      if (onChainResult.success) {
        console.log('✅ Score submitted to blockchain! TX:', onChainResult.txHash);
        console.log('📊 New on-chain score:', onChainResult.newScore);
        
        // Verify the score by reading it again
        const verifyResult = await getOnChainScore(address);
        if (verifyResult.success) {
          console.log('✅ Score verified on-chain:', verifyResult.score);
          
          // Immediately update UI with verified on-chain score
          const verifiedScore = verifyResult.score;
          const tier = getTierFromScore(verifiedScore);
          
          console.log('🎯 Tier from on-chain score:', tier, 'Score:', verifiedScore);
          
          // Update the user tier display immediately
          setUserTier({
            current_tier: tier,
            total_score: verifiedScore,
            builder_achieved_at: verifiedScore >= 100 ? new Date().toISOString() : undefined,
            contributor_achieved_at: verifiedScore >= 300 ? new Date().toISOString() : undefined,
            leader_achieved_at: verifiedScore >= 700 ? new Date().toISOString() : undefined,
          });
        }
        
        // Update contribution status in Supabase to mark as verified with TX hash
        const updateResult = await updateContributionWithTx(address, data.score, onChainResult.txHash || '');
        if (updateResult.success) {
          console.log('✅ Contribution marked as verified in database');
        } else {
          console.warn('⚠️ Supabase update failed:', updateResult.error);
        }
        
        // Update local state immediately for instant UI feedback
        updateLocalContributionStatus(data.score, onChainResult.txHash || '');
        
        // Wait a moment for Supabase to process, then force fresh reload
        console.log('⏳ Waiting for Supabase to sync...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // AFTER status is updated, reload history with correct data
        console.log('🔄 Loading updated contributions from Supabase...');
        await loadUserData();
        
        // Notify parent to refresh submissions AFTER data is loaded
        window.dispatchEvent(new CustomEvent('submission-updated'));
        
        setResult(prev => prev ? {
          ...prev,
          onChainTxHash: onChainResult.txHash,
          onChainVerifiedScore: verifyResult.success ? verifyResult.score : onChainResult.newScore,
        } : null);

        // Check if user qualifies for a badge and mint it
        if (data.newTotalScore && data.newTotalScore >= 100) {
          setOnChainLoading(false);
          setBadgeLoading(true);
          console.log('🎖️ Attempting to mint badge...');
          
          const badgeResult = await mintBadge(address, data.newTotalScore);
          
          if (badgeResult.success) {
            console.log('✅ Badge minted! Tier:', badgeResult.tier, 'TX:', badgeResult.txHash);
            setResult(prev => prev ? {
              ...prev,
              badgeTxHash: badgeResult.txHash,
              badgeTier: badgeResult.tier,
            } : null);
          } else {
            console.warn('⚠️ Badge minting failed:', badgeResult.error);
            setResult(prev => prev ? {
              ...prev,
              badgeError: badgeResult.error,
            } : null);
          }
          setBadgeLoading(false);
        }
      } else {
        console.error('❌ Failed to submit to blockchain:', onChainResult.error);
        setResult(prev => prev ? {
          ...prev,
          onChainError: onChainResult.error,
        } : null);
      }
      setOnChainLoading(false);
      } else {
        console.log('⏭️ Skipping blockchain submission - score too low or recommendation rejected');
        setOnChainLoading(false);
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-mono">
      {/* ===== WALLET BIO VERIFICATION SECTION ===== */}
      <div className="bg-blue-950 border-2 border-blue-600 p-4 space-y-2">
        <h3 className="text-blue-400 font-bold mb-2 text-sm">🔐 Wallet Ownership Verification</h3>
        <p className="text-blue-300 text-xs leading-relaxed">
          To enable wallet ownership verification and earn a <strong>+15% reputation bonus</strong>, please add your wallet address to your GitHub bio.
        </p>
        
        {/* Instructions */}
        <div className="bg-black/60 border-l-2 border-blue-500 pl-3 py-2 text-xs space-y-1 mt-3">
          <p className="text-blue-400 font-semibold">📋 Steps to Verify:</p>
          <ol className="text-blue-300 space-y-1 ml-3">
            <li>1. Go to <strong>github.com/settings/profile</strong></li>
            <li>2. Add your wallet address to your bio (examples below)</li>
            <li>3. Submit your GitHub profile link below</li>
            <li>4. AI will automatically detect and verify your wallet</li>
          </ol>
        </div>
        
        <p className="text-blue-400 text-xs mt-2 font-semibold">💡 Address Format: Must start with &quot;0x&quot; and be exactly 42 characters (0x + 40 hexadecimal digits)</p>
      </div>

      {/* AI Verification Instructions */}
      <div className="bg-black border-2 border-green-700/50 p-4">
        <h3 className="text-green-400 font-bold mb-2 text-sm">$ verify.sh --ai-powered</h3>
        <p className="text-green-600 text-xs">
          Paste your GitHub profile. AI will analyze repositories, verify authenticity, track Celo ecosystem contributions, and calculate your reputation score.
        </p>
      </div>

      {/* GitHub Link Input */}
      <div>
        <label className="text-green-600 text-xs font-semibold block mb-2">
          github_profile_url ~
        </label>
        <input
          type="url"
          value={githubLink}
          onChange={(e) => setGithubLink(e.target.value)}
          placeholder="https://github.com/username"
          required
          className="w-full bg-black border-2 border-green-700/50 px-3 py-2 text-green-400 placeholder-green-700 text-sm focus:outline-none focus:border-green-500 transition"
        />
        <p className="text-green-700 text-xs mt-1">&gt; AI will extract repos, languages, and contribution history</p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !githubLink}
        className="w-full bg-green-900 hover:bg-green-800 disabled:bg-green-950 text-green-300 disabled:text-green-700 font-bold py-3 px-4 border-2 border-green-600 transition text-sm"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Verifying...
          </>
        ) : (
          '→ Verify with AI'
        )}
      </button>

      {/* Result - Success */}
      {result?.success && (
        <div className="bg-black border-2 border-green-600 p-4 space-y-3">
          <div className="flex gap-2 items-start">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <p className="text-green-400 font-semibold mb-3">{result.message}</p>

              {/* GitHub Analysis */}
              {result.githubAnalysis && (
                <div className="space-y-2 mb-4 bg-black/50 rounded p-3 border-l-2 border-green-600 text-green-500 text-xs">
                  <p>profile: <span className="text-green-400 font-semibold">{result.githubAnalysis.username}</span></p>
                  <p>repos: <span className="text-green-400 font-semibold">{result.githubAnalysis.totalRepos}</span></p>
                  <p>followers: <span className="text-green-400 font-semibold">{result.githubAnalysis.followers}</span></p>
                  <p>languages: <span className="text-green-400 font-semibold">{result.githubAnalysis.languages.join(', ')}</span></p>
                  <p>specialties: <span className="text-green-400 font-semibold">{result.githubAnalysis.specialties.join(', ')}</span></p>
                  {result.githubAnalysis.detectedWallet && (
                    <p className="text-green-300 font-semibold border-t border-green-600/50 pt-2 mt-2">
                      ✅ Wallet Verified: <span className="text-green-400 font-mono">{result.githubAnalysis.detectedWallet}</span>
                      <br />
                      <span className="text-green-500 text-xs">🎁 +15% reputation bonus applied to your score!</span>
                    </p>
                  )}
                  {result.githubAnalysis.bioContainsWallet && !result.githubAnalysis.walletFormatValid && (
                    <p className="text-yellow-300 font-semibold border-t border-yellow-600/50 pt-2 mt-2">
                      ⚠️ Address found in bio but format is invalid. Please use format: 0x + 40 hex characters
                    </p>
                  )}
                </div>
              )}

              {/* AI Verification Results */}
              {result.aiResult && (
                <div className="space-y-2 mb-4 bg-black/50 rounded p-3 border-l-2 border-green-600 text-green-500 text-xs">
                  <p>authenticity: <span className="text-green-400 font-semibold">{result.aiResult.authenticity}%</span></p>
                  <p>impact_score: <span className="text-green-400 font-semibold">{result.aiResult.impactScore}%</span></p>
                  <p>quality_score: <span className="text-green-400 font-semibold">{result.aiResult.qualityScore}%</span></p>
                  <p>recommendation: <span className="text-green-400 font-semibold">{result.aiResult.recommendation.toUpperCase()}</span></p>
                </div>
              )}

              {/* Earn Badges & Score Section */}
              <div className="bg-green-900/20 border-2 border-green-600/50 rounded p-3 mt-4">
                <p className="text-green-400 font-bold text-sm mb-2">Earn Badges & Score</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-green-500">Points Earned</span>
                    <span className="text-green-400 font-bold text-lg">{result.score}</span>
                  </div>
                  <div className="w-full bg-black/50 h-2 border border-green-700/30">
                    <div
                      className="bg-green-500 h-2 transition-all"
                      style={{
                        width: `${Math.min((result.score / 100) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-green-600 pt-2">
                    <p>Tiers: Builder(100) → Contributor(300) → Leader(700)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result - Error */}
      {result?.error && (
        <div className="bg-black border-2 border-red-600 p-4">
          <div className="flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{result.error}</p>
          </div>
        </div>
      )}

      {/* On-Chain Submission Status */}
      {result?.success && (
        <div className="bg-black border-2 border-blue-600 p-4 space-y-2">
          <div className="flex items-center gap-2">
            {onChainLoading ? (
              <>
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-blue-400 font-semibold text-sm">📤 Submitting to blockchain...</span>
              </>
            ) : result.onChainTxHash ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-semibold text-sm">✅ Score recorded on-chain!</span>
              </>
            ) : result.onChainError ? (
              <>
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-semibold text-sm">⚠️ {result.onChainError}</span>
              </>
            ) : null}
          </div>
          {result.onChainTxHash && (
            <div className="space-y-1">
              <p className="text-blue-600 text-xs break-all">
                TX: {result.onChainTxHash}
              </p>
              {result.onChainVerifiedScore !== undefined && (
                <p className="text-blue-400 font-semibold text-xs">
                  ✅ On-Chain Score: {result.onChainVerifiedScore}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Badge Minting Status */}
      {result?.success && (
        <div className="bg-black border-2 border-yellow-600 p-4 space-y-2">
          <div className="flex items-center gap-2">
            {badgeLoading ? (
              <>
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                <span className="text-yellow-400 font-semibold text-sm">🎖️ Minting badge...</span>
              </>
            ) : result.badgeTxHash ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-semibold text-sm">✅ Badge minted: {result.badgeTier}!</span>
              </>
            ) : result.badgeError ? (
              <>
                <AlertCircle className="w-4 h-4 text-orange-400" />
                <span className="text-orange-400 font-semibold text-sm">⚠️ Badge: {result.badgeError}</span>
              </>
            ) : null}
          </div>
          {result.badgeTxHash && (
            <p className="text-yellow-600 text-xs break-all">
              TX: {result.badgeTxHash}
            </p>
          )}
        </div>
      )}

      {/* User Tier & Score Status - Always show */}
      <div className="bg-black border-2 border-green-700/50 p-4 space-y-2">
        <h3 className="text-green-400 font-bold text-sm">📊 Reputation Status</h3>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-green-600 text-xs">Current Tier</p>
            <p className="text-green-400 font-bold">{userTier?.current_tier || 'UNRANKED'}</p>
          </div>
          <div>
            <p className="text-green-600 text-xs">Total Score</p>
            <p className="text-green-400 font-bold">{userTier?.total_score || 0}</p>
          </div>
          <div>
            <p className="text-green-600 text-xs">Contributions</p>
            <p className="text-green-400 font-bold">{contributions.length}</p>
          </div>
        </div>
        {isSupabaseConfigured && historyLoading && (
          <p className="text-green-600 text-xs mt-2">🔄 Syncing from Supabase...</p>
        )}
      </div>

      {/* Contribution History - Only show if Supabase configured */}
      {isSupabaseConfigured && (
        <div className="bg-black border-2 border-green-700/50 p-4">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-green-400 hover:text-green-300 transition"
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="font-bold text-sm">Contribution History ({contributions.length})</span>
            </span>
            <span className="text-xs">{showHistory ? '▼' : '▶'}</span>
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {historyLoading ? (
                <p className="text-green-600 text-xs">Loading...</p>
              ) : contributions.length === 0 ? (
                <p className="text-green-700 text-xs">No contributions yet</p>
              ) : (
                contributions.map((contrib) => (
                  <div key={contrib.id} className="bg-black/50 border-l-2 border-green-600 pl-3 py-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-green-400 font-semibold">{contrib.contribution_type}</p>
                        <p className="text-green-600">{contrib.title}</p>
                        <p className="text-green-700 text-xs mt-1">
                          {new Date(contrib.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-bold">+{contrib.score}</p>
                        <p className={`text-xs ${
                          contrib.status === 'verified' ? 'text-green-500' :
                          contrib.status === 'rejected' ? 'text-red-500' :
                          'text-yellow-600'
                        }`}>
                          {contrib.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
