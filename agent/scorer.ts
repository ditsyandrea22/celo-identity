import { Contribution, ContributionType, ScoringResult } from "./types";

/// Base score values for different contribution types
const baseScores: Record<ContributionType, number> = {
  PR_MERGED: 20,
  COMMIT: 3,
  POST_IMPACT: 5,
  CODE_REVIEW: 8,
  DOCUMENTATION: 10,
  BUG_FIX: 15,
};

/// Scoring rules based on contribution context
export function calculateScore(contribution: Contribution): ScoringResult {
  // Get base score
  const baseScore = baseScores[contribution.type] || 0;

  // Apply context-based multiplier
  const multiplier = calculateMultiplier(contribution);

  // Calculate final score
  const finalScore = Math.floor(baseScore * multiplier);

  // Generate explanation
  const explanation = generateExplanation(
    contribution,
    baseScore,
    multiplier,
    finalScore
  );

  return {
    baseScore,
    multiplier,
    finalScore,
    explanation,
  };
}

/// Calculate a multiplier based on contribution context
function calculateMultiplier(contribution: Contribution): number {
  let multiplier = 1.0;

  const desc = contribution.description.toLowerCase();

  // Check for spam indicators
  if (isSpam(contribution)) {
    multiplier *= 0.3; // Heavily penalize spam
  }

  // Check for high-impact indicators
  if (desc.includes("major") || desc.includes("critical")) {
    multiplier *= 1.5;
  }

  if (desc.includes("security") || desc.includes("vulnerability")) {
    multiplier *= 1.8;
  }

  if (desc.includes("refactor") || desc.includes("optimization")) {
    multiplier *= 1.2;
  }

  // Check for consistency bonus
  if (contribution.type === "COMMIT" && desc.length > 50) {
    multiplier *= 1.1; // Bonus for detailed descriptions
  }

  // Ensure multiplier is bounded
  return Math.min(2.0, Math.max(0.5, multiplier));
}

/// Detect spam or duplicate patterns
function isSpam(contribution: Contribution): boolean {
  const desc = contribution.description.toLowerCase();

  // Common spam patterns
  const spamPatterns = [
    "test",
    "temp",
    "wip",
    "draft",
    "placeholder",
    "random",
    "dummy",
  ];

  if (
    spamPatterns.some(
      (pattern) => desc.includes(pattern) && desc.length < 20
    )
  ) {
    return true;
  }

  // Reject contributions with no meaningful description
  if (contribution.description.length < 5) {
    return true;
  }

  return false;
}

/// Generate human-readable explanation
function generateExplanation(
  contribution: Contribution,
  baseScore: number,
  multiplier: number,
  finalScore: number
): string {
  const typeLabel = contribution.type.replace(/_/g, " ");
  const parts: string[] = [];

  parts.push(
    `${typeLabel} contribution scored at ${baseScore} base points`
  );

  if (multiplier > 1.2) {
    parts.push("High-impact contribution - bonus applied");
  } else if (multiplier < 0.8) {
    parts.push("Low-impact or spam signals detected - penalty applied");
  }

  parts.push(`Final score: ${finalScore} points`);

  return parts.join(". ");
}

/// Check if user qualifies for a reputation tier
export function checkTierQualification(totalScore: number): string | null {
  if (totalScore >= 700) return "LEADER";
  if (totalScore >= 300) return "CONTRIBUTOR";
  if (totalScore >= 100) return "BUILDER";
  return null;
}
