import { ethers } from 'ethers';

export interface GitHubUserData {
  login: string;
  public_repos: number;
  followers: number;
  bio?: string;
}

export interface RepoContribution {
  name: string;
  language: string;
  stars: number;
  description: string;
  isOwned: boolean;
  url: string;
}

export interface CeloContribution {
  repoName: string;
  url: string;
  isCeloRepo: boolean;
  contributionCount: number;
  isFork: boolean;
  stars: number;
  language: string;
}

export interface ContributionAnalysis {
  username: string;
  totalRepos: number;
  followers: number;
  languages: string[];
  topRepos: RepoContribution[];
  totalCommits: number;
  averageRepoSize: number;
  specialties: string[];
  celoContributions: CeloContribution[];
  hasCeloContribution: boolean;
  celoContributionCount: number;
  detectedWallet?: string | null;
  walletFormatValid?: boolean;
  bioContainsWallet?: boolean;
}

// Extract wallet-like string (0x...40 hex) from arbitrary text
function extractWalletFromText(text?: string): string | null {
  if (!text) return null;
  const re = /0x[a-fA-F0-9]{40}/g;
  const matches = text.match(re);
  if (!matches || matches.length === 0) return null;
  // prefer the first match
  return matches[0];
}

function normalizeAddress(address: string): string | null {
  try {
    return ethers.getAddress(address);
  } catch (e) {
    return null;
  }
}

export async function analyzeGitHubLink(githubUrl: string): Promise<ContributionAnalysis | null> {
  try {
    // Parse GitHub URL to extract username
    const urlPattern = /github\.com\/([a-zA-Z0-9-]+)/;
    const match = githubUrl.match(urlPattern);
    
    if (!match) {
      console.error('Invalid GitHub URL format');
      return null;
    }

    const username = match[1];
    console.log('Analyzing GitHub user:', username);

    // Fetch user data
    const userResponse = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }),
      },
    });

    if (!userResponse.ok) {
      console.error('GitHub user not found:', username);
      return null;
    }

    const userData: GitHubUserData = await userResponse.json();

    // Attempt to extract wallet from bio and validate
    const bioWallet = extractWalletFromText(userData.bio);
    const normalizedBioWallet = bioWallet ? normalizeAddress(bioWallet) : null;

    // Fetch user repositories (up to 100 - should cover most users)
    const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=100&type=all`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }),
      },
    });

    const repos: any[] = await reposResponse.json();

    // Analyze repositories
    const topRepos: RepoContribution[] = repos.slice(0, 5).map(repo => ({
      name: repo.name,
      language: repo.language || 'Unknown',
      stars: repo.stargazers_count || 0,
      description: repo.description || 'No description',
      isOwned: repo.owner.login === username,
      url: repo.html_url,
    }));

    // Extract languages and specialties
    const languages = repos
      .filter(r => r.language)
      .map(r => r.language)
      .filter((lang, idx, arr) => arr.indexOf(lang) === idx)
      .slice(0, 5);

    const totalCommits = repos.reduce((sum, repo) => {
      // Estimate based on stars (proxy metric)
      return sum + (repo.stargazers_count || 0) * 0.5;
    }, 0);

    const averageRepoSize = repos.reduce((sum, repo) => sum + (repo.size || 0), 0) / repos.length || 0;

    // Detect specialties based on repos
    const specialties: string[] = [];
    if (languages.includes('Solidity')) specialties.push('Smart Contracts');
    if (languages.includes('Rust')) specialties.push('Systems Programming');
    if (languages.includes('Python')) specialties.push('Data Science');
    if (languages.includes('Go')) specialties.push('Backend');
    if (languages.includes('TypeScript') || languages.includes('JavaScript')) specialties.push('Web Development');
    if (languages.includes('Kotlin')) specialties.push('Mobile Development');

    // NEW: Check for Celo ecosystem contributions
    const celoContributions = await detectCeloContributions(username, repos);
    const hasCeloContribution = celoContributions.length > 0;
    const celoContributionCount = celoContributions.reduce((sum, c) => sum + c.contributionCount, 0);

    return {
      username,
      totalRepos: userData.public_repos,
      followers: userData.followers,
      languages,
      topRepos,
      totalCommits: Math.round(totalCommits),
      averageRepoSize: Math.round(averageRepoSize),
      specialties: specialties.length > 0 ? specialties : ['General Development'],
      celoContributions,
      hasCeloContribution,
      celoContributionCount,
      detectedWallet: normalizedBioWallet,
      walletFormatValid: normalizedBioWallet !== null,
      bioContainsWallet: !!bioWallet,
    };
  } catch (error) {
    console.error('GitHub analysis error:', error);
    return null;
  }
}

// Detect Celo ecosystem contributions with DEEP content analysis (OPTIMIZED)
async function detectCeloContributions(username: string, repos: any[]): Promise<CeloContribution[]> {
  const celoContributions: CeloContribution[] = [];
  
  // Enhanced Celo ecosystem keywords (expanded detection)
  const CELO_KEYWORDS = [
    'celo', 'celotoolkit', 'celojs', 'celo-sdk', 'celo-protocol', 'contractkit',
    'celo-connect', 'celo-compose', 'celo-name', 'farcaster.celo', '@celo/',
    'celo-cli', 'celocore', 'celo-monorepo', 'celo-wallet', 'celo-dapp',
    'valora', 'minipay', 'mento', 'celo-blockchain', 'celo-governance',
    'celogov', 'celo-reserve', 'celo-cryptography', 'celo-infra',
  ];
  const CELO_ORGS = [
    'celo', 'celo-org', 'celolabs', 'celotools',
    'celo-protocols', 'celo-ecosystem', 'valora-ce',
  ];
  
  for (const repo of repos) {
    const repoName = repo.name.toLowerCase();
    const repoDesc = (repo.description || '').toLowerCase();
    const repoOwner = repo.owner.login.toLowerCase();
    const topics = (repo.topics || []).map((t: string) => t.toLowerCase());
    
    const isCeloOrg = CELO_ORGS.some(org => repoOwner.includes(org));
    const hasCeloKeyword = CELO_KEYWORDS.some(keyword => 
      repoName.includes(keyword.toLowerCase()) || 
      repoDesc.includes(keyword.toLowerCase()) ||
      topics.some(t => t.includes(keyword.toLowerCase()))
    );
    
    // First check: obvious Celo repo (name, desc, or topics) - FAST
    if (isCeloOrg || hasCeloKeyword) {
      try {
        const contributionCount = await getCeloRepoContributionCount(username, repo.owner.login, repo.name);
        celoContributions.push({
          repoName: repo.name,
          url: repo.html_url,
          isCeloRepo: isCeloOrg,
          contributionCount,
          isFork: repo.fork,
          stars: repo.stargazers_count || 0,
          language: repo.language || 'Unknown',
        });
        console.log(`✅ [Celo Detect] Found: ${repo.name} | ${contributionCount} commits | ${repo.stargazers_count} ⭐`);
      } catch (error) {
        console.error(`Error with ${repo.name}:`, error);
      }
    } else {
      // Second check: OPTIMIZED - Only check repos with JS/Rust/Go (likely to use Celo)
      const language = (repo.language || '').toLowerCase();
      const shouldCheckContent = ['typescript', 'javascript', 'rust', 'go', 'solidity', 'python'].some(
        lang => language.includes(lang)
      );
      
      if (shouldCheckContent) {
        try {
          const hasCeloContent = await checkRepoContentForCelo(repo.owner.login, repo.name);
          if (hasCeloContent) {
            const contributionCount = await getCeloRepoContributionCount(username, repo.owner.login, repo.name);
            celoContributions.push({
              repoName: repo.name,
              url: repo.html_url,
              isCeloRepo: false,
              contributionCount,
              isFork: repo.fork,
              stars: repo.stargazers_count || 0,
              language: repo.language || 'Unknown',
            });
            console.log(`✅ [Celo Detect] Found (content): ${repo.name} | ${contributionCount} commits | ${repo.language}`);
          }
        } catch (error) {
          // Silently continue
        }
      }
    }
  }
  
  return celoContributions;
}

// Deep content analysis with TIMEOUT (max 2s per repo)
async function checkRepoContentForCelo(owner: string, repoName: string): Promise<boolean> {
  const timeout = 2000; // 2 second timeout per repo
  const filesToCheck = [
    'package.json',
    'README.md',
  ];

  try {
    // Check in parallel with timeout
    const promises = filesToCheck.map(fileName =>
      Promise.race([
        checkFileContent(owner, repoName, fileName),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeout)
        ),
      ]).catch(() => false)
    );

    const results = await Promise.allSettled(promises);
    return results.some(r => r.status === 'fulfilled' && r.value === true);
  } catch (error) {
    return false;
  }
}

// Check single file content
async function checkFileContent(owner: string, repoName: string, fileName: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${fileName}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3.raw',
          ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }),
        },
      }
    );
    
    if (!response.ok) return false;
    
    const content = await response.text();
    return content.toLowerCase().includes('celo') || 
           content.toLowerCase().includes('@celo/') ||
           content.toLowerCase().includes('contractkit');
  } catch (error) {
    return false;
  }
}

// Get contribution count for specific Celo repo
async function getCeloRepoContributionCount(username: string, owner: string, repoName: string): Promise<number> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/commits?author=${username}&per_page=1`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }),
        },
      }
    );
    
    if (!response.ok) return 0;
    
    // GitHub returns Link header with pagination info
    const linkHeader = response.headers.get('Link') || '';
    const lastPageMatch = linkHeader.match(/page=(\d+)>.*rel="last"/);
    
    if (lastPageMatch) {
      return parseInt(lastPageMatch[1], 10);
    }
    
    return (await response.json()).length > 0 ? 1 : 0;
  } catch (error) {
    console.error('Error getting contribution count:', error);
    return 0;
  }
}
