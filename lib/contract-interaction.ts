import { ethers } from 'ethers';

const SCORE_ABI = [
  'function increase(address user, uint256 amount) external',
  'function getScore(address user) view returns (uint256)',
];

const SCORE_ADDRESS = process.env.NEXT_PUBLIC_SCORE_ADDRESS || '';

export async function updateOnChainScore(
  userAddress: string,
  scoreAmount: number
): Promise<{ success: boolean; txHash?: string; newScore?: number; error?: string }> {
  try {
    // Check if window.ethereum exists (wallet provider)
    if (!window.ethereum) {
      return { success: false, error: 'No wallet provider detected' };
    }

    if (!SCORE_ADDRESS) {
      return { success: false, error: 'ReputationScore contract address not configured' };
    }

    // Create provider and signer
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Create contract instance with signer
    const scoreContract = new ethers.Contract(SCORE_ADDRESS, SCORE_ABI, signer);

    console.log('📝 Submitting score to blockchain...');
    console.log('Contract Address:', SCORE_ADDRESS);
    console.log('User Address:', userAddress);
    console.log('Score Amount:', scoreAmount);

    // Call the increase function
    const tx = await scoreContract.increase(userAddress, scoreAmount);

    console.log('⏳ Waiting for transaction confirmation...');
    console.log('TX Hash:', tx.hash);

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    console.log('✅ Score update transaction mined!');
    console.log('TX Receipt:', receipt?.hash);

    // Verify the score was updated by reading it
    const readContract = new ethers.Contract(SCORE_ADDRESS, SCORE_ABI, provider);
    const newScore = await readContract.getScore(userAddress);
    const newScoreNumber = Number(newScore);

    console.log('📊 New on-chain score:', newScoreNumber);

    return {
      success: true,
      txHash: receipt?.hash || tx.hash,
      newScore: newScoreNumber,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Failed to update score on-chain:', message);
    return { success: false, error: message };
  }
}

export async function getOnChainScore(
  userAddress: string
): Promise<{ success: boolean; score?: number; error?: string }> {
  try {
    if (!window.ethereum) {
      return { success: false, error: 'No wallet provider detected' };
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const scoreContract = new ethers.Contract(SCORE_ADDRESS, SCORE_ABI, provider);

    const score = await scoreContract.getScore(userAddress);

    return {
      success: true,
      score: Number(score),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Failed to fetch on-chain score:', message);
    return { success: false, error: message };
  }
}
