import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn('⚠️ Supabase credentials not configured. Features requiring database will be disabled.');
}

export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
export const isSupabaseConfigured = isConfigured;

export interface StoredContribution {
  id?: string;
  user_address: string;
  contribution_type: string;
  score: number;
  title: string;
  description: string;
  github_link: string;
  github_analysis: Record<string, any>;
  ai_result: Record<string, any>;
  status: 'pending' | 'verified' | 'rejected';
  on_chain_tx?: string;
}

export interface UserTier {
  id?: string;
  user_address: string;
  current_tier: string;
  total_score: number;
  builder_achieved_at?: string;
  contributor_achieved_at?: string;
  leader_achieved_at?: string;
  updated_at?: string;
}

export interface ReputationRecord {
  id?: string;
  user_address: string;
  score_delta: number;
  total_score: number;
  reason: string;
}

// Save contribution to Supabase with validation
export async function saveContribution(
  contribution: StoredContribution
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  // Validate required fields
  if (!contribution.user_address) {
    console.error('❌ Missing user_address');
    return { success: false, error: 'user_address is required' };
  }

  if (!contribution.contribution_type) {
    console.error('❌ Missing contribution_type');
    return { success: false, error: 'contribution_type is required' };
  }

  if (contribution.score === undefined || contribution.score < 0) {
    console.error('❌ Invalid score:', contribution.score);
    return { success: false, error: 'score must be >= 0' };
  }

  if (!contribution.github_link) {
    console.error('❌ Missing github_link');
    return { success: false, error: 'github_link is required' };
  }

  try {
    const normalizedAddress = contribution.user_address.toLowerCase();
    const saveData = {
      ...contribution,
      user_address: normalizedAddress,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('💾 [saveContribution] Saving:', {
      address: normalizedAddress,
      type: contribution.contribution_type,
      score: contribution.score,
      link: contribution.github_link.substring(0, 30) + '...',
    });

    const { data, error } = await supabase
      .from('contributions')
      .insert([saveData])
      .select('id, created_at, status')
      .single();

    if (error) {
      console.error('❌ Error saving contribution:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      console.error('❌ No data returned from insert');
      return { success: false, error: 'No data returned from insert' };
    }

    console.log('✅ Contribution saved successfully:', {
      id: data.id,
      status: data.status,
      created_at: data.created_at,
    });

    return { success: true, id: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Failed to save contribution:', message);
    return { success: false, error: message };
  }
}

// Update contribution with on-chain transaction hash and mark as verified
// Updates the MOST RECENT contribution for this user with the given score
export async function updateContributionWithTx(
  userAddress: string,
  score: number,
  onChainTx: string
): Promise<{ success: boolean; contributionId?: string; error?: string }> {
  if (!supabase) {
    console.error('❌ Supabase not configured');
    return { success: false, error: 'Supabase not configured' };
  }
  
  const normalizedAddress = userAddress.toLowerCase();
  
  try {
    console.log('📝 [updateContributionWithTx] Starting update:', {
      address: normalizedAddress,
      score,
      tx: onChainTx ? onChainTx.substring(0, 10) + '...' : 'null',
      timestamp: new Date().toISOString(),
    });

    // Step 1: Find all pending contributions with matching score
    const { data: pendingContribs, error: fetchError } = await supabase
      .from('contributions')
      .select('id, status, score, created_at, on_chain_tx')
      .eq('user_address', normalizedAddress)
      .eq('score', score)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching pending contributions:', fetchError);
      return { success: false, error: `Fetch failed: ${fetchError.message}` };
    }

    console.log(`📋 Found ${pendingContribs?.length || 0} pending contributions with score ${score}`);

    if (!pendingContribs || pendingContribs.length === 0) {
      console.warn('⚠️ No pending contributions found to update');
      return { success: false, error: 'No pending contributions found' };
    }

    // Get the most recent one
    const contributionToUpdate = pendingContribs[0];
    console.log('🎯 Targeting contribution:', {
      id: contributionToUpdate.id,
      created_at: contributionToUpdate.created_at,
      current_status: contributionToUpdate.status,
    });

    // Step 2: Update the contribution
    const updatePayload = {
      status: 'verified' as const,
      on_chain_tx: onChainTx,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('📤 Update payload:', {
      status: updatePayload.status,
      tx_recorded: !!onChainTx,
      tx_length: onChainTx?.length || 0,
      has_verified_at: !!updatePayload.verified_at,
    });

    const { data: updateData, error: updateError } = await supabase
      .from('contributions')
      .update(updatePayload)
      .eq('id', contributionToUpdate.id)
      .select();

    if (updateError) {
      console.error('❌ Error updating contribution:', updateError);
      return { success: false, error: `Update failed: ${updateError.message}` };
    }

    if (!updateData || updateData.length === 0) {
      console.error('❌ Update returned no data');
      return { success: false, error: 'Update returned no data' };
    }

    const updatedContribution = updateData[0];
    
    // Verify the update was successful
    console.log('✅ Contribution updated successfully');
    console.log('📊 Updated record:', {
      id: updatedContribution.id,
      status: updatedContribution.status,
      on_chain_tx: updatedContribution.on_chain_tx ? 'RECORDED ✓' : 'MISSING ✗',
      tx_value: updatedContribution.on_chain_tx,
      verified_at: updatedContribution.verified_at,
    });

    // Validate the update
    if (updatedContribution.status !== 'verified') {
      console.error('❌ Status not updated to verified!', updatedContribution.status);
      return { success: false, error: 'Status update failed - still ' + updatedContribution.status };
    }

    if (!updatedContribution.on_chain_tx) {
      console.error('❌ on_chain_tx not recorded!', updatedContribution);
      return { success: false, error: 'TX hash not recorded' };
    }

    if (updatedContribution.on_chain_tx !== onChainTx) {
      console.error('❌ TX hash mismatch!', {
        expected: onChainTx,
        actual: updatedContribution.on_chain_tx,
      });
      return { success: false, error: 'TX hash mismatch' };
    }

    console.log('🎉 [updateContributionWithTx] Complete - all validations passed');
    return { success: true, contributionId: updatedContribution.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ [updateContributionWithTx] Exception:', message);
    return { success: false, error: message };
  }
}

// Update user tier and track progression
export async function updateUserTier(
  userAddress: string,
  newScore: number,
  newTier: string
): Promise<{ success: boolean; tier?: UserTier; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const address = userAddress.toLowerCase();
    
    // Get current tier info
    const { data: existing } = await supabase
      .from('user_tiers')
      .select('*')
      .eq('user_address', address)
      .single();

    const now = new Date().toISOString();
    const tierData: UserTier = {
      user_address: address,
      current_tier: newTier,
      total_score: newScore,
      updated_at: now,
    };

    // Set tier achievement timestamps
    if (newTier === 'BUILDER' && (!existing || existing.current_tier === 'UNRANKED')) {
      tierData.builder_achieved_at = now;
    }
    if (newTier === 'CONTRIBUTOR' && (!existing || existing.current_tier !== 'CONTRIBUTOR')) {
      tierData.contributor_achieved_at = now;
      tierData.builder_achieved_at = existing?.builder_achieved_at || now;
    }
    if (newTier === 'LEADER') {
      tierData.leader_achieved_at = now;
      tierData.contributor_achieved_at = existing?.contributor_achieved_at || now;
      tierData.builder_achieved_at = existing?.builder_achieved_at || now;
    }

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from('user_tiers')
        .update(tierData)
        .eq('user_address', address)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabase
        .from('user_tiers')
        .insert([tierData])
        .select()
        .single();
    }

    if (result.error) {
      console.error('❌ Error updating tier:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('✅ User tier updated:', newTier, 'Score:', newScore);
    return { success: true, tier: result.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Failed to update tier:', message);
    return { success: false, error: message };
  }
}

// Add to reputation history
export async function recordReputationHistory(
  userAddress: string,
  scoreDelta: number,
  totalScore: number,
  reason: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('reputation_history')
      .insert([
        {
          user_address: userAddress.toLowerCase(),
          score_delta: scoreDelta,
          total_score: totalScore,
          reason,
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error recording history:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Reputation history recorded');
    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Failed to record history:', message);
    return { success: false, error: message };
  }
}

// Fetch user contributions - Direct from Supabase with validation
export async function getUserContributions(
  userAddress: string
): Promise<{ success: boolean; contributions?: StoredContribution[]; error?: string }> {
  if (!supabase) {
    console.error('❌ Supabase not configured');
    return { success: false, contributions: [], error: 'Supabase not configured' };
  }

  if (!userAddress) {
    console.error('❌ No user address provided');
    return { success: false, contributions: [], error: 'User address required' };
  }

  try {
    const normalizedAddress = userAddress.toLowerCase();
    console.log('🔍 [getUserContributions] Fetching from Supabase for:', normalizedAddress);
    
    // Direct query from contributions table
    const { data, error } = await supabase
      .from('contributions')
      .select('id, user_address, contribution_type, score, title, status, created_at, on_chain_tx, verified_at')
      .eq('user_address', normalizedAddress)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [getUserContributions] Query error:', error);
      return { success: false, contributions: [], error: error.message };
    }

    const count = data?.length || 0;
    console.log(`✅ [getUserContributions] Fetched ${count} contributions from Supabase`);
    
    if (count > 0) {
      // Detailed logging of data
      console.log('📋 [getUserContributions] Contributions data:');
      data.forEach((contrib, idx) => {
        console.log(`  [${idx}] ${contrib.contribution_type} | Score: ${contrib.score} | Status: ${contrib.status} | TX: ${contrib.on_chain_tx ? 'YES' : 'NO'}`);
      });
      
      // Show latest
      console.log('📊 [getUserContributions] Latest:', {
        type: data[0].contribution_type,
        score: data[0].score,
        status: data[0].status,
        tx: data[0].on_chain_tx ? 'recorded' : 'missing',
        verified_at: data[0].verified_at,
      });
    } else {
      console.log('ℹ️ [getUserContributions] No contributions found');
    }

    return { success: true, contributions: data || [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ [getUserContributions] Exception:', message);
    return { success: false, contributions: [], error: message };
  }
}

// Fetch user tier
export async function getUserTier(
  userAddress: string
): Promise<{ success: boolean; tier?: UserTier; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('user_tiers')
      .select('*')
      .eq('user_address', userAddress.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      console.error('❌ Error fetching tier:', error);
      return { success: false, error: error.message };
    }

    return { success: true, tier: data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Failed to fetch tier:', message);
    return { success: false, error: message };
  }
}

// Fetch reputation history
export async function getReputationHistory(
  userAddress: string,
  limit = 50
): Promise<{ success: boolean; history?: ReputationRecord[]; error?: string }> {
  if (!supabase) {
    return { success: false, history: [], error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('reputation_history')
      .select('*')
      .eq('user_address', userAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching history:', error);
      return { success: false, history: [], error: error.message };
    }

    return { success: true, history: data || [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Failed to fetch history:', message);
    return { success: false, history: [], error: message };
  }
}
