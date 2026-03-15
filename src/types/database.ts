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

// Phase 2: Social Platform types

export type PostType = 'text' | 'image' | 'video';
export type InteractionType = 'like' | 'comment' | 'tip' | 'flag';
export type NotificationType =
  | 'post_liked'
  | 'post_commented'
  | 'post_tipped'
  | 'post_earned'
  | 'tax_deducted'
  | 'transfer_received'
  | 'welcome_bonus'
  | 'post_flagged'
  | 'post_hidden';

export interface Post {
  id: string;
  author_id: string;
  content_text: string;
  media_urls: string[];
  post_type: PostType;
  quality_score: number;
  engagement_count: number;
  earning_eligible: boolean;
  is_hidden: boolean;
  created_at: string;
  author?: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'reputation_score'>;
  like_count?: number;
  comment_count?: number;
  user_has_liked?: boolean;
}

export interface PostInteraction {
  id: string;
  post_id: string;
  user_id: string;
  type: InteractionType;
  comment_text: string | null;
  tip_amount: number | null;
  created_at: string;
  user?: Pick<Profile, 'display_name' | 'avatar_url'>;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}
