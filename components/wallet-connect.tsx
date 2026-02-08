'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface WalletConnectProps {
  onConnect: () => void;
}

export function WalletConnect({ onConnect }: WalletConnectProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <div className="text-4xl">🟢</div>
            <h2 className="text-xl font-bold text-white">Welcome to CeloCred</h2>
            <p className="text-slate-400 text-sm">
              Verify your contributions and earn reputation badges on Celo
            </p>
          </div>

          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Verify real-world contributions</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Earn transparent reputation scores</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Mint soulbound achievement badges</span>
            </div>
          </div>
        </div>
      </Card>

      <Button
        onClick={onConnect}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-6"
        size="lg"
      >
        Connect Wallet
      </Button>

      <p className="text-xs text-slate-500 text-center">
        Works with Valora, MiniPay, and Celo-compatible wallets
      </p>
    </div>
  );
}
