import { ethers } from "ethers";
import { registryContract, scoreContract, badgeContract } from "./contracts";
import { Contribution, ExecutionResult, ReputationTier } from "./types";
import { generateBadgeSVG, encodeBadgeSVG, generateBadgeTokenId } from "./badges";
import { checkTierQualification } from "./scorer";

const TIER_THRESHOLDS: Record<ReputationTier, number> = {
  BUILDER: 100,
  CONTRIBUTOR: 300,
  LEADER: 700,
};

/// Execute all onchain actions for a verified contribution
export async function executeOnchain(
  contribution: Contribution,
  scoreDelta: number,
  currentTotalScore: number,
  newTotalScore: number
): Promise<ExecutionResult> {
  const result: ExecutionResult = { success: false };

  try {
    // 1. Create proof hash
    const proofHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(contribution))
    );

    console.log(`[Agent] Proof hash: ${proofHash}`);

    // 2. Register contribution
    console.log("[Agent] Registering contribution...");
    const registryTx = await registryContract.registerContribution(
      contribution.user,
      proofHash,
      scoreDelta
    );
    const registryReceipt = await registryTx.wait();
    result.registryTx = registryReceipt?.hash || registryReceipt?.transactionHash;
    console.log(`[Agent] Contribution registered: ${result.registryTx}`);

    // 3. Update reputation score
    console.log("[Agent] Updating reputation score...");
    const scoreTx = await scoreContract.increase(contribution.user, scoreDelta);
    const scoreReceipt = await scoreTx.wait();
    result.scoreTx = scoreReceipt?.hash || scoreReceipt?.transactionHash;
    console.log(
      `[Agent] Score updated: ${contribution.user} -> ${newTotalScore}`
    );

    // 4. Check for badge qualification and mint if eligible
    const qualifyingTier = checkTierQualification(newTotalScore);
    if (qualifyingTier) {
      console.log(
        `[Agent] User qualifies for ${qualifyingTier} badge, minting...`
      );

      const svg = generateBadgeSVG(qualifyingTier as ReputationTier);
      const uri = encodeBadgeSVG(svg);
      const tokenId = generateBadgeTokenId(contribution.user, qualifyingTier as ReputationTier);

      const badgeTx = await badgeContract.mint(
        contribution.user,
        tokenId,
        uri,
        qualifyingTier
      );
      const badgeReceipt = await badgeTx.wait();
      result.badgeTx = badgeReceipt?.hash || badgeReceipt?.transactionHash;
      console.log(
        `[Agent] Badge minted: ${qualifyingTier} (${result.badgeTx})`
      );
    }

    result.success = true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    result.error = errorMessage;
    console.error(`[Agent] Execution error: ${errorMessage}`);
  }

  return result;
}

/// Verify contract is properly set up
export async function verifySetup(): Promise<boolean> {
  try {
    // Try to read from each contract
    const code = await scoreContract.getScore("0x" + "0".repeat(40));
    console.log("[Agent] Contract verification successful");
    return true;
  } catch (error) {
    console.error("[Agent] Contract verification failed:", error);
    return false;
  }
}
