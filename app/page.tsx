'use client';

import { useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { SubmitContribution } from '@/components/submit-contribution';
import { MySubmissions } from '@/components/my-submissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<string[]>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export default function Page() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [score, setScore] = useState('0');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    try {
      setLoading(true);
      if (typeof window === 'undefined' || !window.ethereum) {
        alert('Please open this app in Valora or MiniPay');
        return;
      }

      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      const addr = accounts[0];

      console.log('🔗 [Wallet Connect] Wallet connected:', addr);
      
      // Auto-switch to Celo Mainnet (Chain ID: 42220)
      const CELO_MAINNET_CHAIN_ID = '0xa4ec'; // 42220 in hex
      const TARGET_CHAIN_ID = process.env.NEXT_PUBLIC_CELO_CHAIN_ID;
      
      console.log(`🔄 [Wallet Connect] Attempting to switch to Celo Mainnet (Chain ID: ${TARGET_CHAIN_ID})...`);
      
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CELO_MAINNET_CHAIN_ID }],
        });
        console.log('✅ [Wallet Connect] Successfully switched to Celo Mainnet');
      } catch (switchError: any) {
        // Chain doesn't exist, try to add it
        if (switchError.code === 4902) {
          console.log('📝 [Wallet Connect] Chain not found, adding Celo Mainnet...');
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: CELO_MAINNET_CHAIN_ID,
                  chainName: 'Celo Mainnet',
                  rpcUrls: [process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org'],
                  nativeCurrency: {
                    name: 'CELO',
                    symbol: 'CELO',
                    decimals: 18,
                  },
                  blockExplorerUrls: ['https://celo-mainnet.blockscout.com'],
                },
              ],
            });
            console.log('✅ [Wallet Connect] Celo Mainnet added and switched successfully');
          } catch (addError) {
            console.warn('⚠️ [Wallet Connect] Could not add Celo Mainnet:', addError);
          }
        } else {
          console.warn('⚠️ [Wallet Connect] Could not switch chain:', switchError);
        }
      }
      
      setAddress(addr);
      setProvider(browserProvider);
      setIsConnected(true);
      
      // Save to localStorage
      localStorage.setItem('celocred_address', addr);
      
      console.log('🔄 [Wallet Connect] Fetching score immediately after connect...');
      await fetchScore(addr);
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('celocred_address');
      if (saved) {
        console.log('✅ [Main Page] Loaded saved address:', saved);
        setAddress(saved);
        setIsConnected(true);
        
        // Try to fetch score immediately
        console.log('🔄 [Main Page] Fetching score from saved address...');
        fetchScore(saved);
      }
    }
  }, []);

  // Setup event listener for submission updates (one-time)
  useEffect(() => {
    const handleSubmissionUpdate = (event: Event) => {
      console.log('📢 [Main Page] Submission updated - reloading score...');
      
      if (address) {
        console.log('🔄 [Main Page] Fetching score from Supabase...');
        fetchScore(address);
      }
    };

    window.addEventListener('submission-updated', handleSubmissionUpdate as EventListener);
    console.log('✅ [Main Page] Event listener registered (no polling)');
    
    return () => {
      window.removeEventListener('submission-updated', handleSubmissionUpdate as EventListener);
    };
  }, []);

  // Load score when address changes
  useEffect(() => {
    if (isConnected && address) {
      console.log('🔄 [Main Page] Address loaded, fetching score...');
      fetchScore(address);
    }
  }, [isConnected, address]);

  const fetchScore = async (addr: string) => {
    if (!addr) {
      console.error('❌ [Main Page] fetchScore: No address provided');
      return;
    }

    console.log('🔍 [Main Page] STARTING fetchScore for:', addr);
    
    try {
      console.log('📚 [Main Page] Importing Supabase...');
      const { getUserContributions } = await import('@/lib/supabase');
      console.log('📚 [Main Page] Supabase imported successfully');
      
      console.log('📞 [Main Page] Calling getUserContributions...');
      const contribResult = await getUserContributions(addr);
      console.log('📞 [Main Page] getUserContributions returned:', { success: contribResult.success, count: contribResult.contributions?.length || 0 });
      
      if (contribResult.success && contribResult.contributions && contribResult.contributions.length > 0) {
        // Calculate total score from all verified contributions
        const totalScore = contribResult.contributions.reduce((sum, contrib) => {
          // Only count verified contributions for score
          if (contrib.status === 'verified') {
            return sum + (contrib.score || 0);
          }
          return sum;
        }, 0);
        
        const scoreValue = totalScore.toString();
        console.log('✅ [Main Page] Calculated total score from verified contributions:', scoreValue);
        setScore(scoreValue);
        console.log('✅ [Main Page] Score updated to:', scoreValue);
        return;
      } else {
        console.warn('⚠️ [Main Page] Supabase returned no contributions');
      }
    } catch (err) {
      console.error('❌ [Main Page] Exception:', err instanceof Error ? err.message : String(err));
    }
    
    console.log('⚠️ [Main Page] fetchScore completed but no score set, defaulting to 0');
    setScore('0');
  };

  const getTier = (sc: string): string => {
    const num = Number(sc);
    if (num >= 700) return 'LEADER';
    if (num >= 300) return 'CONTRIBUTOR';
    if (num >= 100) return 'BUILDER';
    return 'UNRANKED';
  };

  return (
    <div className="min-h-screen w-full bg-black p-4 flex items-center border-l-4 border-r-4 border-green-600">
      <div className="max-w-md w-full mx-auto">
        {/* Header */}
        <div className="text-center py-8 mb-8 border-b-2 border-green-700/50 pb-6">
          <h1 className="text-4xl font-bold text-green-400 mb-2 font-mono">$ CeloCred</h1>
          <p className="text-green-600 text-sm font-mono">&gt; Autonomous Reputation on Celo</p>
        </div>

        {!isConnected ? (
          /* Connect Section */
          <div className="bg-gray-900 border-2 border-green-600/50 p-6 space-y-4 font-mono">
            <div className="text-center space-y-3">
              <div className="text-4xl"></div>
              <h2 className="text-xl font-bold text-green-400">Welcome to CeloCred</h2>
              <p className="text-green-600 text-sm">
                &gt; Verify your contributions and earn reputation badges
              </p>
            </div>

            <div className="space-y-2 text-sm text-green-500 bg-black/30 p-3 rounded border border-green-700/30">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Verify real-world contributions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Earn transparent reputation scores</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Mint soulbound achievement badges</span>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-600 disabled:bg-green-800 text-black font-bold py-3 px-4 border-2 border-green-500 transition"
            >
              {loading ? '⏳ Connecting...' : '→ Connect Wallet'}
            </button>

            <p className="text-xs text-green-600 text-center border-t border-green-700/30 pt-3">
              Works with Valora, MiniPay, and Celo-compatible wallets
            </p>
          </div>
        ) : (
          /* Dashboard Section with Tabs */
          <div className="space-y-4 font-mono">
            {/* Address Card */}
            <div className="bg-black border-2 border-green-700/50 p-4">
              <p className="text-green-600 text-xs mb-1">wallet_address ~</p>
              <p className="text-green-400 text-xs break-all">{address}</p>
            </div>

            {/* Score Card */}
            <div className="bg-black border-2 border-green-600 p-6">
              <div className="text-center space-y-3">
                <p className="text-green-600 text-xs">reputation_score.status</p>
                <div className="text-5xl font-bold text-green-400">{score}</div>
                <div className="text-lg font-semibold text-green-500">[{getTier(score)}]</div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-800 h-2 border border-green-700/30">
                    <div
                      className="bg-green-500 h-2 transition-all"
                      style={{
                        width: `${Math.min((Number(score) / 700) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-green-600 mt-2">
                    <span>Builder(100)</span>
                    <span>Contributor(300)</span>
                    <span>Leader(700)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="submit" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-black border-2 border-green-700/50">
                <TabsTrigger value="submit" className="text-xs text-green-600 data-[state=active]:text-green-400 data-[state=active]:bg-green-900/30">submit</TabsTrigger>
                <TabsTrigger value="submissions" className="text-xs text-green-600 data-[state=active]:text-green-400 data-[state=active]:bg-green-900/30">submissions</TabsTrigger>
                <TabsTrigger value="info" className="text-xs text-green-600 data-[state=active]:text-green-400 data-[state=active]:bg-green-900/30">how-it-works</TabsTrigger>
              </TabsList>

              <TabsContent value="submit" className="space-y-4 mt-4">
                <SubmitContribution address={address} />
              </TabsContent>

              <TabsContent value="submissions" className="space-y-4 mt-4">
                <MySubmissions address={address} />
              </TabsContent>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="bg-black border-2 border-green-700/50 p-4 space-y-3">
                  <h3 className="text-green-400 font-bold text-sm">$ how-celocred-works.sh</h3>
                  
                  <div className="space-y-3 text-green-500 text-xs">
                    <div className="border-l-2 border-green-600 pl-3">
                      <p className="text-green-400 font-semibold">1. Submit Contributions</p>
                      <p className="text-green-600 mt-1">
                        &gt; paste your github link + choose contribution type
                      </p>
                    </div>

                    <div className="border-l-2 border-green-600 pl-3">
                      <p className="text-green-400 font-semibold">2. AI Agent Verification</p>
                      <p className="text-green-600 mt-1">
                        &gt; analyzes authenticity, impact, and quality
                      </p>
                    </div>

                    <div className="border-l-2 border-green-600 pl-3">
                      <p className="text-green-400 font-semibold">3. Earn Badges & Score</p>
                      <p className="text-green-600 mt-1">
                        &gt; get soulbound NFT badges at milestones
                      </p>
                    </div>
                  </div>

                  <div className="border-t-2 border-green-700/50 pt-4 mt-4">
                    <h4 className="text-green-400 font-semibold text-sm mb-2">scoring_algorithm.json</h4>
                    <ul className="space-y-1 text-xs text-green-600 bg-black/40 p-2 rounded border border-green-700/30">
                      <li>$ authenticity_score: 0-100</li>
                      <li>$ impact_score: 0-100</li>
                      <li>$ quality_score: 0-100</li>
                      <li>$ final = base × multiplier</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Disconnect Button */}
            <button
              onClick={() => {
                setIsConnected(false);
                setAddress('');
                setProvider(null);
                setScore('0');
                localStorage.removeItem('celocred_address');
              }}
              className="w-full bg-red-900 hover:bg-red-800 text-red-300 font-semibold py-2 px-4 border-2 border-red-700 transition text-sm font-mono"
            >
              ~ disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
