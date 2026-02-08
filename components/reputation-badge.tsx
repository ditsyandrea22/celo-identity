'use client';

import { useState, useEffect } from 'react';

interface ReputationBadgeProps {
  uri: string;
}

export function ReputationBadge({ uri }: ReputationBadgeProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      if (uri.startsWith('data:image')) {
        setImageUrl(uri);
      } else if (uri.startsWith('http')) {
        setImageUrl(uri);
      } else if (uri.length > 0) {
        setImageUrl(`data:image/svg+xml;base64,${uri}`);
      }
    } catch {
      setError(true);
    }
  }, [uri]);

  if (error) {
    return (
      <div className="bg-slate-700/50 rounded-lg p-4 text-center text-slate-400 text-sm">
        Badge unavailable
      </div>
    );
  }

  return (
    <div className="bg-slate-700/50 rounded-lg p-4 flex items-center justify-center overflow-hidden">
      {imageUrl && (
        <img
          src={imageUrl || "/placeholder.svg"}
          alt="Badge"
          className="w-full h-auto max-h-48 object-contain"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}
