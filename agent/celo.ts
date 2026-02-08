import { ethers } from "ethers";

if (!process.env.CELO_RPC) {
  throw new Error("CELO_RPC environment variable not set");
}

if (!process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY environment variable not set");
}

/// Celo RPC provider
export const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC);

/// Agent wallet (autonomous actor)
export const agentWallet = new ethers.Wallet(
  process.env.PRIVATE_KEY,
  provider
);

/// Get agent address
export function getAgentAddress(): string {
  return agentWallet.address;
}

/// Check gas balance
export async function checkBalance(): Promise<string> {
  const balance = await provider.getBalance(agentWallet.address);
  return ethers.formatEther(balance);
}

/// Get current block
export async function getCurrentBlock(): Promise<number> {
  return await provider.getBlockNumber();
}
