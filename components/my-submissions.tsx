'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, XCircle, Award, Loader2 } from 'lucide-react';
import { getUserContributions, getUserTier, isSupabaseConfigured } from '@/lib/supabase';

interface MySubmissionsProps {
  address: string;
}

interface Contribution {
  id: string;
  contribution_type: string;
  score: number;
  title: string;
  status: string;
  created_at: string;
  on_chain_tx?: string;
}

const CONTRIBUTION_ICONS: Record<string, string> = {
  PR_MERGED: '[',
  COMMIT: 'P',
  BUG_FIX: 'X',
  DOCUMENTATION: 'D',
  CODE_REVIEW: 'O',
  POST_IMPACT: 'C',
  OTHER: '*',
};

export function MySubmissions({ address }: MySubmissionsProps) {
  const [submissions, setSubmissions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalScore, setTotalScore] = useState(0);
  const [currentTier, setCurrentTier] = useState('UNRANKED');
  const [verifiedCount, setVerifiedCount] = useState(0);

  const loadSubmissionsFromSupabase = async () => {
    console.log('📥 [MySubmissions] Loading from Supabase for:', address);
    setLoading(true);
    
    try {
      // Load contributions directly from Supabase
      const contribResult = await getUserContributions(address);
      
      if (contribResult.success && contribResult.contributions) {
        console.log('✅ [MySubmissions] Loaded contributions from Supabase:', contribResult.contributions.length);
        setSubmissions(contribResult.contributions);
        
        // Calculate total score
        const total = contribResult.contributions.reduce(
          (sum: number, c: Contribution) => sum + (c.score || 0),
          0
        );
        console.log('📊 [MySubmissions] Total score calculated:', total);
        setTotalScore(total);
        
        // Count verified
        const verified = contribResult.contributions.filter(c => c.status === 'verified').length;
        console.log('✅ [MySubmissions] Verified count:', verified);
        setVerifiedCount(verified);
        
        // Load tier to get current tier
        const tierResult = await getUserTier(address);
        if (tierResult.success && tierResult.tier) {
          console.log('🎖️ [MySubmissions] Current tier:', tierResult.tier.current_tier);
          setCurrentTier(tierResult.tier.current_tier);
        }
      } else {
        console.warn('⚠️ [MySubmissions] Failed to load contributions:', contribResult.error);
        setSubmissions([]);
        setTotalScore(0);
        setVerifiedCount(0);
      }
    } catch (error) {
      console.error('❌ [MySubmissions] Error loading:', error);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!address) {
      console.warn('⚠️ [MySubmissions] No address provided');
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      console.warn('⚠️ [MySubmissions] Supabase not configured');
      setLoading(false);
      return;
    }

    // Load on mount
    loadSubmissionsFromSupabase();

    // Listen for updates and reload (NO POLLING!)
    const handleUpdate = () => {
      console.log('📢 [MySubmissions] Submission updated - reloading...');
      loadSubmissionsFromSupabase();
    };

    window.addEventListener('submission-updated', handleUpdate);
    console.log('✅ [MySubmissions] Event listener registered (no polling)');

    return () => {
      window.removeEventListener('submission-updated', handleUpdate);
    };
  }, [address]);

  const getTierLabel = (score: number) => {
    if (score >= 700) return 'LEADER';
    if (score >= 300) return 'CONTRIBUTOR';
    if (score >= 100) return 'BUILDER';
    return 'UNRANKED';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'verified':
        return '✅ [VERIFIED]';
      case 'pending':
        return '⏳ [PENDING]';
      case 'rejected':
        return '❌ [REJECTED]';
      default:
        return '❓ [UNKNOWN]';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 font-mono">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-green-400" />
          <p className="text-green-600">$ loading submissions from supabase...</p>
        </div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-black border-2 border-green-700/50 p-8 text-center space-y-3 font-mono">
        <div className="text-3xl"></div>
        <p className="text-green-400 font-semibold">no_submissions_yet</p>
        <p className="text-green-600 text-sm">
          &gt; submit contributions using the form above
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono">
      {/* Summary Card - Read from Supabase */}
      <div className="bg-black border-2 border-green-600 p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-green-600 text-xs mb-1">total_points</p>
            <p className="text-2xl font-bold text-green-400">{totalScore}</p>
            <p className="text-xs text-green-700">(from supabase)</p>
          </div>
          <div>
            <p className="text-green-600 text-xs mb-1">submissions</p>
            <p className="text-2xl font-bold text-green-400">{submissions.length}</p>
            <p className="text-xs text-green-700">(total)</p>
          </div>
          <div>
            <p className="text-green-600 text-xs mb-1">verified</p>
            <p className="text-2xl font-bold text-green-400">
              {verifiedCount}
            </p>
            <p className="text-xs text-green-700">(confirmed)</p>
          </div>
        </div>
        <div className="text-xs text-green-600 mt-3 border-t border-green-700/50 pt-2 flex justify-between">
          <span>tier: <span className="text-green-400 font-bold">{currentTier}</span></span>
          <span>🔄 synced from supabase</span>
        </div>
      </div>

      {/* Submissions List - From Supabase */}
      <div className="space-y-3">
        {submissions.map((submission, idx) => (
          <div
            key={submission.id}
            className="bg-black border-2 border-green-700/50 p-3 space-y-2 hover:border-green-600 transition"
          >
            {/* Header with index */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-xs">[{idx + 1}]</span>
                  <h4 className="text-green-400 font-semibold text-sm break-words">
                    {submission.contribution_type}
                  </h4>
                </div>
                <p className="text-green-600 text-xs mt-1">
                  by: {submission.title}
                </p>
              </div>
              <div className="text-green-500 text-xs flex-shrink-0 text-right">
                {getStatusLabel(submission.status)}
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center justify-between pt-2 border-t border-green-700/30">
              <div className="text-xs text-green-600">
                score_earned
              </div>
              <div className="text-lg font-bold text-green-400 flex-shrink-0">
                +{submission.score}
              </div>
            </div>

            {/* TX Info */}
            {submission.on_chain_tx && (
              <div className="text-xs text-green-700 break-all">
                TX: {submission.on_chain_tx.substring(0, 20)}...{submission.on_chain_tx.substring(submission.on_chain_tx.length - 10)}
              </div>
            )}

            {/* Date */}
            <p className="text-green-700 text-xs">
              {new Date(submission.created_at).toLocaleDateString()} {new Date(submission.created_at).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>

      {/* Footer - Data Source Info */}
      <div className="bg-black border-2 border-green-700/30 p-3 text-center">
        <p className="text-green-700 text-xs">
          📊 All data synced directly from Supabase database in real-time
        </p>
      </div>
    </div>
  );
}
