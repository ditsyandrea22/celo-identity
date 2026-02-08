import type { ContributionAnalysis } from './github';

export interface AIVerificationResult {
  authentic: boolean;
  impactScore: number;
  qualityScore: number;
  authenticity: number;
  finalScore: number;
  reasoning: string;
  keyFindings: string[];
  recommendation: string;
  walletVerificationBonus?: number;
}

export async function verifyWithAI(analysis: ContributionAnalysis, contributionType: string): Promise<AIVerificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('Gemini API key not configured');
    return generateDefaultVerification(analysis, contributionType);
  }

  try {
    console.log(`\n🔍 [AI Verify] Starting for user: ${analysis.username}`);
    console.log(`📊 [AI Verify] Celo commits: ${analysis.celoContributionCount}`);
    
    if (!analysis.hasCeloContribution) {
      console.log('⚠️ [AI Verify] No Celo contributions found - rejecting');
      return {
        authentic: true,
        impactScore: 0,
        qualityScore: 0,
        authenticity: 0,
        finalScore: 0,
        reasoning: 'User has no contributions to Celo ecosystem. Celo contribution history is required for reputation scoring.',
        keyFindings: [
          `No Celo-related repositories found in profile`,
          `Required: Contributions to celo-org, celolabs, or Celo-related projects`,
          `Current profile focuses on: ${analysis.specialties.join(', ')}`,
        ],
        recommendation: 'reject',
      };
    }

    const celoReposInfo = analysis.celoContributions
      .map(c => `  * ${c.repoName} (${c.language}) - ${c.contributionCount} commits - ${c.stars} stars - ${c.url}`)
      .join('\n');

    const prompt = `Analyze this GitHub contributor's Celo ecosystem contributions and provide a detailed verification score:

GitHub Profile Analysis:
- Username: ${analysis.username}
- Public Repositories: ${analysis.totalRepos}
- Followers: ${analysis.followers}
- Languages: ${analysis.languages.join(', ')}
- Specialties: ${analysis.specialties.join(', ')}

CELO ECOSYSTEM CONTRIBUTIONS (${analysis.celoContributions.length} repos):
${celoReposInfo}
Total Celo Commits: ${analysis.celoContributionCount}

Contribution Type: ${contributionType}

SCORING CRITERIA for Celo ecosystem:
- Authenticity: Real Celo contributor vs suspicious activity
- Impact: Code quality and relevance to Celo's mission (blockchain, DeFi, mobile money)
- Quality: Commit messages, code review participation, PR quality
- Celo Relevance: How core are these contributions to Celo protocol

Please provide:
1. Authenticity score (0-100): Is this a genuine Celo contributor?
2. Impact score (0-100): How impactful to Celo ecosystem?
3. Quality score (0-100): Code and contribution quality?
4. Final weighted score (0-100): Combined Celo-specific assessment
5. Key findings (3-4 bullet points)
6. Recommendation (accept/review/reject)

Format response as JSON with fields: authentic (boolean), authenticity (0-100), impactScore (0-100), qualityScore (0-100), finalScore (0-100), reasoning (string), keyFindings (array), recommendation (string)`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
        apiKey: apiKey,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      return generateDefaultVerification(analysis, contributionType);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error('No content in Gemini response');
      return generateDefaultVerification(analysis, contributionType);
    }

    console.log('✅ [AI Verify] Gemini responded');

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not parse JSON from Gemini response');
      return generateDefaultVerification(analysis, contributionType);
    }

    const result = JSON.parse(jsonMatch[0]);

    console.log('✅ [AI Verify] Scores parsed:', {
      auth: result.authenticity,
      impact: result.impactScore,
      quality: result.qualityScore,
      rec: result.recommendation,
    });

    return {
      authentic: result.authentic || result.authenticity > 50,
      impactScore: Math.min(100, Math.max(0, result.impactScore || 0)),
      qualityScore: Math.min(100, Math.max(0, result.qualityScore || 0)),
      authenticity: Math.min(100, Math.max(0, result.authenticity || 0)),
      finalScore: Math.min(100, Math.max(0, result.finalScore || 0)),
      reasoning: result.reasoning || 'Analysis completed',
      keyFindings: Array.isArray(result.keyFindings) ? result.keyFindings : [],
      recommendation: result.recommendation || 'review',
    };
  } catch (error) {
    console.error('AI verification error:', error);
    return generateDefaultVerification(analysis, contributionType);
  }
}

function generateDefaultVerification(analysis: ContributionAnalysis, type: string): AIVerificationResult {
  // Check for Celo contributions first - if none, score is 0
  if (!analysis.hasCeloContribution) {
    return {
      authentic: true,
      impactScore: 0,
      qualityScore: 0,
      authenticity: 0,
      finalScore: 0,
      reasoning: 'User has no contributions to Celo ecosystem. Celo contribution history is required.',
      keyFindings: [
        `No Celo-related repositories found`,
        `Requires contributions to celo, celo-org, or Celo-related projects`,
        `Focus areas: ${analysis.specialties.join(', ')}`,
      ],
      recommendation: 'reject',
    };
  }

  // Score based on Celo contributions
  const repoQuality = analysis.celoContributions.reduce((sum, r) => sum + Math.min(r.stars, 100), 0) / analysis.celoContributions.length;
  const commitImpact = Math.min(100, analysis.celoContributionCount * 5); // 1 commit = ~5 points
  const impactScore = Math.min(100, (analysis.followers * 1.5) + (commitImpact * 0.4));
  const qualityScore = Math.min(100, repoQuality + (analysis.languages.length * 8));
  const authenticScore = analysis.celoContributionCount > 0 && analysis.followers >= 0 ? 90 : 75;
  const finalScore = (impactScore * 0.3 + qualityScore * 0.3 + authenticScore * 0.4);

  return {
    authentic: analysis.celoContributionCount > 0,
    impactScore: Math.round(impactScore),
    qualityScore: Math.round(qualityScore),
    authenticity: Math.round(authenticScore),
    finalScore: Math.round(finalScore),
    reasoning: `Celo contributor with ${analysis.celoContributionCount} commits across ${analysis.celoContributions.length} repos. Specializes in ${analysis.specialties.join(', ')}.`,
    keyFindings: [
      `${analysis.celoContributions.length} Celo repositories with active contributions`,
      `${analysis.celoContributionCount} commits to Celo ecosystem`,
      `Proficient in ${analysis.languages.slice(0, 3).join(', ')}`,
      `${analysis.followers} community followers`,
    ],
    recommendation: finalScore > 70 ? 'accept' : finalScore > 50 ? 'review' : 'reject',
  };
}

export function calculateFinalScore(aiResult: AIVerificationResult, baseScore: number, walletVerified: boolean = false): number {
  // Configuration for scoring weights
  const IMPACT_DIV = 150;      // 1.0-1.8x
  const QUALITY_DIV = 160;     // 1.0-1.6x
  const AUTH_DIV = 200;        // 1.0-1.5x
  const WALLET_BONUS = 1.20;   // +20%
  const MAX_CAP = 3.0;         // 3.0x
  const NON_AUTH_PEN = 0.25;   // 25%

  if (aiResult.finalScore === 0 || aiResult.recommendation === 'reject') {
    console.log('📊 [Score] No Celo contributions - score: 0');
    return 0;
  }

  if (!aiResult.authentic) {
    const pen = Math.round(baseScore * NON_AUTH_PEN);
    console.log(`⚠️ [Score] Not authentic - penalty: ${pen}`);
    return pen;
  }

  const impMult = 1.0 + (aiResult.impactScore / IMPACT_DIV);
  const qulMult = 1.0 + (aiResult.qualityScore / QUALITY_DIV);
  const auMult = 1.0 + (aiResult.authenticity / AUTH_DIV);

  console.log('📊 [Score] Multipliers:', {
    impact: impMult.toFixed(2),
    quality: qulMult.toFixed(2),
    auth: auMult.toFixed(2),
  });

  let score = baseScore * impMult * qulMult * auMult;
  console.log(`📈 [Score] Before bonus: ${score.toFixed(2)}`);

  if (walletVerified) {
    score *= WALLET_BONUS;
    console.log(`✅ [Score] Wallet bonus +${(WALLET_BONUS - 1) * 100}% → ${score.toFixed(2)}`);
  }

  const final = Math.round(Math.min(score, baseScore * MAX_CAP));
  console.log(`🎯 [Score] Final: ${final}`);
  return final;
}
