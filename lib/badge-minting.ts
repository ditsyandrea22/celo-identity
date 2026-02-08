import { ethers } from 'ethers';

const BADGE_ABI = [
  'function mint(address to, uint256 tokenId, string calldata uri) external',
  'function tokenURI(uint256 tokenId) view returns (string memory)',
  'function balanceOf(address owner) view returns (uint256)',
];

const BADGE_ADDRESS = process.env.NEXT_PUBLIC_BADGE_ADDRESS || '';

// Tier thresholds
const TIER_CONFIG = {
  BUILDER: 100,
  CONTRIBUTOR: 300,
  LEADER: 700,
};

// Generate badge SVG
function generateBadgeSVG(tier: string): string {
  const tierStyles: Record<string, { color: string; bgColor: string; description: string }> = {
    BUILDER: {
      color: '#35D07F',
      bgColor: '#0F172A',
      description: 'Early Contributor',
    },
    CONTRIBUTOR: {
      color: '#2DCCFF',
      bgColor: '#0F172A',
      description: 'Active Contributor',
    },
    LEADER: {
      color: '#FFB84D',
      bgColor: '#0F172A',
      description: 'Community Leader',
    },
  };

  const style = tierStyles[tier] || tierStyles.BUILDER;

  return `
<svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="300" height="300" fill="${style.bgColor}"/>
  
  <!-- Border -->
  <rect width="300" height="300" fill="none" stroke="${style.color}" stroke-width="3" rx="20"/>
  
  <!-- Title -->
  <text x="150" y="100" font-size="28" font-weight="bold" fill="${style.color}" 
        text-anchor="middle" font-family="system-ui, sans-serif">
    CELOCRED
  </text>
  
  <!-- Tier Name -->
  <text x="150" y="150" font-size="32" font-weight="bold" fill="${style.color}" 
        text-anchor="middle" font-family="system-ui, sans-serif">
    ${tier}
  </text>
  
  <!-- Description -->
  <text x="150" y="200" font-size="14" fill="${style.color}" 
        text-anchor="middle" font-family="system-ui, sans-serif" opacity="0.8">
    ${style.description}
  </text>
  
  <!-- Celo branding -->
  <circle cx="150" cy="250" r="8" fill="${style.color}"/>
  <text x="150" y="268" font-size="12" fill="${style.color}" 
        text-anchor="middle" font-family="system-ui, sans-serif" opacity="0.6">
    Verified on Celo
  </text>
</svg>
  `.trim();
}

// Encode SVG to data URI
function encodeBadgeSVG(svg: string): string {
  const encoded = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
}

// Generate token ID
function generateBadgeTokenId(userAddress: string, tier: string): bigint {
  const combined = userAddress.toLowerCase() + tier;
  const hash = Buffer.from(combined).toString('hex');
  return BigInt('0x' + hash.slice(0, 62)); // Use 62 chars to ensure valid bigint
}

// Get appropriate tier based on score
function getTierForScore(score: number): string | null {
  if (score >= TIER_CONFIG.LEADER) return 'LEADER';
  if (score >= TIER_CONFIG.CONTRIBUTOR) return 'CONTRIBUTOR';
  if (score >= TIER_CONFIG.BUILDER) return 'BUILDER';
  return null;
}

// Mint badge for user
export async function mintBadge(
  userAddress: string,
  totalScore: number
): Promise<{ success: boolean; tier?: string; txHash?: string; error?: string }> {
  try {
    // Check if window.ethereum exists
    if (!window.ethereum) {
      return { success: false, error: 'No wallet provider detected' };
    }

    // Determine tier
    const tier = getTierForScore(totalScore);
    if (!tier) {
      return { success: false, error: 'Score too low for any badge' };
    }

    // Create provider and signer
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Create contract instance
    const badgeContract = new ethers.Contract(BADGE_ADDRESS, BADGE_ABI, signer);

    console.log('🎖️ Minting badge:', tier);
    console.log('Address:', userAddress);

    // Generate badge
    const svg = generateBadgeSVG(tier);
    const uri = encodeBadgeSVG(svg);
    const tokenId = generateBadgeTokenId(userAddress, tier);

    // Mint badge
    const tx = await badgeContract.mint(userAddress, tokenId, uri);

    console.log('⏳ Waiting for badge mint confirmation...');
    console.log('TX Hash:', tx.hash);

    // Wait for transaction
    const receipt = await tx.wait();

    console.log('✅ Badge minted successfully!');
    console.log('TX Receipt:', receipt?.hash);

    return {
      success: true,
      tier,
      txHash: receipt?.hash || tx.hash,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Failed to mint badge:', message);
    return { success: false, error: message };
  }
}

// Check if user already has badge
export async function checkUserBadge(
  userAddress: string
): Promise<{ success: boolean; hasBadge?: boolean; tier?: string; error?: string }> {
  try {
    if (!window.ethereum) {
      return { success: false, error: 'No wallet provider detected' };
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const badgeContract = new ethers.Contract(BADGE_ADDRESS, BADGE_ABI, provider);

    const balance = await badgeContract.balanceOf(userAddress);

    if (balance > 0n) {
      // User has at least one badge
      // Try to determine tier from balance (would need more logic to check which specific tier)
      return {
        success: true,
        hasBadge: true,
      };
    }

    return {
      success: true,
      hasBadge: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Failed to check badge:', message);
    return { success: false, error: message };
  }
}
