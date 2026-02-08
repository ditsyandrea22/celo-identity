import { NextRequest, NextResponse } from 'next/server';
import { Contribution, ContributionType } from '@/lib/types';
import { analyzeGitHubLink } from '@/lib/github';
import { verifyWithAI, calculateFinalScore } from '@/lib/ai-verify';
import { BASE_SCORES } from '@/lib/scores';
import { saveContribution, updateUserTier, recordReputationHistory, getUserTier } from '@/lib/supabase';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, type, title, description, link } = body;

    // GitHub link is now required for accurate verification
    if (!address || !type || !link) {
      return NextResponse.json(
        { error: 'address, type and github link are required for AI verification' },
        { status: 400 }
      );
    }

    if (!Object.keys(BASE_SCORES).includes(type)) {
      return NextResponse.json(
        { error: 'Invalid contribution type' },
        { status: 400 }
      );
    }

    console.log('Processing contribution:', { address, type, link });

    // Analyze GitHub profile
    const githubAnalysis = await analyzeGitHubLink(link);
    if (!githubAnalysis) {
      return NextResponse.json(
        { error: 'Could not analyze GitHub profile. Please ensure the link is valid.' },
        { status: 400 }
      );
    }

    // Require wallet to be present in GitHub bio and match provided address
    const bioWallet = githubAnalysis.detectedWallet || null;
    console.log(`\n🔐 [Wallet Verify] Bio wallet: ${bioWallet ? '✅ FOUND' : '❌ NOT FOUND'}`);
    
    if (!bioWallet) {
      console.log(`🚫 [Wallet Verify] Submission rejected - no wallet in bio`);
      return NextResponse.json(
        { error: 'Please add your wallet address (0x...) to your GitHub bio so we can verify ownership.' },
        { status: 400 }
      );
    }

    // Normalize provided address with strict validation
    let normalizedProvided: string | null = null;
    try {
      normalizedProvided = ethers.getAddress(address);
      console.log(`📝 [Wallet Verify] Provided: ${normalizedProvided}`);
    } catch (e) {
      console.log(`🚫 [Wallet Verify] Invalid address format: ${address}`);
      return NextResponse.json({ error: 'Wallet address format invalid (must be valid Ethereum address)' }, { status: 400 });
    }

    // Strict wallet matching
    const matched = normalizedProvided.toLowerCase() === bioWallet.toLowerCase();
    console.log(`🔗 [Wallet Verify] Bio: ${bioWallet} vs Provided: ${normalizedProvided}`);
    console.log(`✓ [Wallet Verify] Match: ${matched ? '✅ YES' : '❌ NO'}`);
    
    if (!matched) {
      console.log(`🚫 [Wallet Verify] Addresses do not match - rejecting`);
      return NextResponse.json(
        { error: 'Wallet in GitHub bio does not match provided wallet.' },
        { status: 400 }
      );
    }
    
    console.log(`✅ [Wallet Verify] SUCCESS - wallet ownership confirmed`);

    // Get AI verification
    const aiResult = await verifyWithAI(githubAnalysis, type);
    
    // Create contribution object
    const contribution: Contribution = {
      id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userAddress: normalizedProvided.toLowerCase(),
      type: type as ContributionType,
      title: title || githubAnalysis.username,
      description: description || `Verified contributor: ${githubAnalysis.specialties.join(', ')}`,
      link,
      timestamp: Date.now(),
      status: aiResult.authentic ? 'verified' : 'pending',
    };

    const baseScore = BASE_SCORES[type]; // Declare baseScore variable
    const walletIsVerified = normalizedProvided.toLowerCase() === bioWallet.toLowerCase();
    const finalScore = calculateFinalScore(aiResult, baseScore, walletIsVerified);
    contribution.score = finalScore;

    console.log('\n📊 [Submission Summary]');
    console.log(`  - User: ${githubAnalysis.username}`);
    console.log(`  - Wallet: ${normalizedProvided}`);
    console.log(`  - Celo Repos: ${githubAnalysis.celoContributionCount} commits`);
    console.log(`  - AI Impact Score: ${aiResult.impactScore}%`);
    console.log(`  - AI Quality Score: ${aiResult.qualityScore}%`);
    console.log(`  - AI Authenticity: ${aiResult.authenticity}%`);
    console.log(`  - Base Score: ${baseScore}`);
    console.log(`  - Wallet Bonus: ${walletIsVerified ? '✅ +20%' : '❌ None'}`);
    console.log(`  - Final Score: ${finalScore}`);

    // Reject submissions with zero score or reject recommendation
    if (finalScore === 0 || aiResult.recommendation === 'reject') {
      console.log(`🚫 [Submission Rejected] Final score is 0 or recommendation is reject`);
      return NextResponse.json(
        { error: aiResult.reasoning || 'Contribution does not meet verification requirements. Ensure your GitHub profile has contributions to Celo ecosystem projects.' },
        { status: 400 }
      );
    }

    // Update status based on AI verification
    contribution.status = aiResult.recommendation === 'accept' ? 'verified' : 'pending';

    // Check if badge earned at tier thresholds
    if (finalScore >= 15) {
      contribution.badgeEarned = true;
    }

    console.log('Verification complete:', {
      username: githubAnalysis.username,
      finalScore,
      authentic: aiResult.authentic,
      recommendation: aiResult.recommendation,
    });

    // Save to Supabase
    const saveToDB = await saveContribution({
      user_address: normalizedProvided.toLowerCase(),
      contribution_type: type,
      score: finalScore,
      title: contribution.title,
      description: contribution.description,
      github_link: link,
      github_analysis: githubAnalysis,
      ai_result: aiResult,
      status: contribution.status,
    });

    if (!saveToDB.success) {
      console.warn('⚠️ Warning: Failed to save to Supabase:', saveToDB.error);
      // Don't fail the request - still return success but log the warning
    }

    // Update user tier in Supabase
    const userTierResult = await getUserTier(normalizedProvided.toLowerCase());
    let currentTotalScore = userTierResult.tier?.total_score || 0;
    const newTotalScore = currentTotalScore + finalScore;
    
    let newTier = 'UNRANKED';
    if (newTotalScore >= 700) newTier = 'LEADER';
    else if (newTotalScore >= 300) newTier = 'CONTRIBUTOR';
    else if (newTotalScore >= 100) newTier = 'BUILDER';

    const tierResult = await updateUserTier(normalizedProvided.toLowerCase(), newTotalScore, newTier);
    if (tierResult.success) {
      console.log('✅ Tier updated:', newTier, 'Total Score:', newTotalScore);
    }

    // Record in reputation history
    const historyResult = await recordReputationHistory(
      normalizedProvided.toLowerCase(),
      finalScore,
      newTotalScore,
      `${type} contribution: ${githubAnalysis.username}`
    );
    if (historyResult.success) {
      console.log('✅ History recorded');
    }

    return NextResponse.json({
      success: true,
      contribution,
      score: finalScore,
      newTotalScore,
      newTier,
      githubAnalysis,
      aiResult,
      message: `✅ Verified! ${githubAnalysis.username} earned ${finalScore} points (${aiResult.recommendation.toUpperCase()}). Total: ${newTotalScore} points (${newTier}).`,
    });
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { error: 'Failed to process contribution' },
      { status: 500 }
    );
  }
}
