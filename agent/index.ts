import { Contribution, ExecutionResult } from "./types";
import { calculateScore, checkTierQualification } from "./scorer";
import { executeOnchain } from "./executor";
import { scoreContract } from "./contracts";

/// Main agent runner
export async function runAgent(
  contribution: Contribution
): Promise<ExecutionResult> {
  console.log("\n=== CeloCred Agent Starting ===");
  console.log(`Contribution: ${contribution.type} from ${contribution.user}`);
  console.log(`Description: ${contribution.description}\n`);

  try {
    // 1. Calculate score
    console.log("[Agent] Calculating score...");
    const scoringResult = calculateScore(contribution);

    console.log(`Base score: ${scoringResult.baseScore}`);
    console.log(`Multiplier: ${scoringResult.multiplier.toFixed(2)}x`);
    console.log(`Final delta: ${scoringResult.finalScore}`);
    console.log(`Explanation: ${scoringResult.explanation}\n`);

    // 2. Get current score
    console.log("[Agent] Reading current reputation score from blockchain...");
    const currentScore = await scoreContract.getScore(contribution.user);
    const currentTotal = Number(currentScore);
    const newTotal = currentTotal + scoringResult.finalScore;

    console.log(`Current score: ${currentTotal}`);
    console.log(`New score: ${newTotal}\n`);

    // 3. Execute onchain actions
    console.log("[Agent] Executing onchain actions...");
    const execResult = await executeOnchain(
      contribution,
      scoringResult.finalScore,
      currentTotal,
      newTotal
    );

    if (execResult.success) {
      console.log("\n✅ CeloCred Agent: Execution Complete");
      console.log(`Registry TX: ${execResult.registryTx}`);
      console.log(`Score TX: ${execResult.scoreTx}`);
      if (execResult.badgeTx) {
        console.log(`Badge TX: ${execResult.badgeTx}`);
      }

      // Check final tier
      const finalTier = checkTierQualification(newTotal);
      if (finalTier) {
        console.log(`\nUser tier: ${finalTier}`);
      }
    } else {
      console.log(`\n❌ CeloCred Agent: Execution Failed`);
      console.log(`Error: ${execResult.error}`);
    }

    return execResult;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Agent Error: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export default runAgent;
