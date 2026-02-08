import { ethers } from "ethers";
import { agentWallet } from "./celo";

// Minimal ABIs for contract interaction
const REGISTRY_ABI = [
  "function registerContribution(address user, bytes32 proofHash, uint256 score) external",
  "function usedProofs(bytes32) view returns (bool)",
];

const SCORE_ABI = [
  "function increase(address user, uint256 amount) external",
  "function getScore(address user) view returns (uint256)",
];

const BADGE_ABI = [
  "function mint(address to, uint256 tokenId, string calldata uri, string calldata tier) external",
  "function tokenURI(uint256 tokenId) view returns (string memory)",
  "function getTier(uint256 tokenId) view returns (string memory)",
];

// Pre-deployed contract addresses
const REGISTRY_ADDRESS = "0xAb823bD98965E1847B4c8fd34f7c6b8ee43A118B";
const SCORE_ADDRESS = "0x167cC445684492aDA56AF57dff39D845B2b44f3D";
const BADGE_ADDRESS = "0x44dF156Fb99CFe8eEF8dA693a4112A50faAe253a";

/// ContributionRegistry contract instance
export const registryContract = new ethers.Contract(
  REGISTRY_ADDRESS,
  REGISTRY_ABI,
  agentWallet
);

/// ReputationScore contract instance
export const scoreContract = new ethers.Contract(
  SCORE_ADDRESS,
  SCORE_ABI,
  agentWallet
);

/// ReputationBadge contract instance
export const badgeContract = new ethers.Contract(
  BADGE_ADDRESS,
  BADGE_ABI,
  agentWallet
);

/// Verify contract addresses are valid
export function validateAddresses(): void {
  const addresses = [REGISTRY_ADDRESS, SCORE_ADDRESS, BADGE_ADDRESS];

  addresses.forEach((addr) => {
    if (!addr || !ethers.isAddress(addr)) {
      throw new Error(`Invalid contract address: ${addr}`);
    }
  });
}
