export type UserRole = 'user' | 'moderator' | 'admin';

export type TransactionType =
  | 'transfer'
  | 'earning'
  | 'tax'
  | 'purchase'
  | 'escrow'
  | 'welcome_bonus';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  reputation_score: number;
  role: UserRole;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  amount: number;
  type: TransactionType;
  description: string | null;
  created_at: string;
  from_profile?: Pick<Profile, 'display_name'> | null;
  to_profile?: Pick<Profile, 'display_name'> | null;
}

export interface CommunityTreasury {
  id: string;
  total_balance: number;
  total_tax_collected: number;
  total_fiat_revenue: number;
}

export interface TransferParams {
  recipient_username: string;
  amount: number;
  description: string;
}
