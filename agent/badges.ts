import { ReputationTier } from "./types";

interface TierStyle {
  color: string;
  bgColor: string;
  description: string;
}

const tierStyles: Record<ReputationTier, TierStyle> = {
  BUILDER: {
    color: "#35D07F",
    bgColor: "#0F172A",
    description: "Early Contributor",
  },
  CONTRIBUTOR: {
    color: "#2DCCFF",
    bgColor: "#0F172A",
    description: "Active Contributor",
  },
  LEADER: {
    color: "#FFB84D",
    bgColor: "#0F172A",
    description: "Community Leader",
  },
};

/// Generate SVG badge for a reputation tier
export function generateBadgeSVG(tier: ReputationTier): string {
  const style = tierStyles[tier];

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

/// Encode SVG to data URI
export function encodeBadgeSVG(svg: string): string {
  const encoded = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}

/// Generate token ID for a badge
export function generateBadgeTokenId(
  userAddress: string,
  tier: ReputationTier
): bigint {
  const combined = userAddress.toLowerCase() + tier;
  // Simple hash: just use the string converted to hex
  const hash = Buffer.from(combined).toString("hex");
  return BigInt("0x" + hash.slice(0, 64));
}
