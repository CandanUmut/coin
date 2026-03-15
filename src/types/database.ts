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

// Phase 3: Marketplace types

export type TaskStatus = 'open' | 'claimed' | 'submitted' | 'approved' | 'disputed' | 'cancelled';
export type PriceType = 'fixed' | 'hourly';
export type DisputeStatus = 'open' | 'resolved';
export type DisputeVote = 'approve_worker' | 'return_poster' | 'split';

export interface Task {
  id: string;
  poster_id: string;
  worker_id: string | null;
  title: string;
  description: string;
  bounty_amount: number;
  status: TaskStatus;
  category: string;
  escrow_tx_id: string | null;
  created_at: string;
  updated_at: string;
  poster?: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'reputation_score'>;
  worker?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
}

export interface Service {
  id: string;
  provider_id: string;
  title: string;
  description: string;
  category: string;
  price_tc: number;
  price_type: PriceType;
  rating_avg: number;
  review_count: number;
  is_active: boolean;
  created_at: string;
  provider?: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'reputation_score'>;
}

export interface ServiceReview {
  id: string;
  service_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string;
  created_at: string;
  reviewer?: Pick<Profile, 'display_name' | 'avatar_url'>;
}

export interface Dispute {
  id: string;
  task_id: string;
  initiated_by: string;
  reason: string;
  status: DisputeStatus;
  resolution: string | null;
  jury_members: string[];
  jury_votes: Record<string, DisputeVote>;
  created_at: string;
  task?: Task;
}

export interface SearchResult {
  id: string;
  type: 'post' | 'task' | 'service';
  title: string;
  description?: string;
  created_at: string;
  author_name: string;
  bounty_amount?: number;
  status?: string;
  category?: string;
  rating_avg?: number;
  review_count?: number;
  engagement_count?: number;
  rank?: number;
}
