import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Wallet, Transaction, TransactionType } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

const PAGE_SIZE = 20;

interface WalletState {
  wallet: Wallet | null;
  transactions: Transaction[];
  transactionCount: number;
  currentPage: number;
  typeFilter: TransactionType | 'all';
  loading: boolean;
  sendingTransfer: boolean;
  realtimeChannel: RealtimeChannel | null;

  fetchWallet: () => Promise<void>;
  fetchTransactions: (page?: number, type?: TransactionType | 'all') => Promise<void>;
  sendTransfer: (recipientUsername: string, amount: number, description: string) => Promise<void>;
  subscribeRealtime: (userId: string) => void;
  unsubscribeRealtime: () => void;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  transactions: [],
  transactionCount: 0,
  currentPage: 0,
  typeFilter: 'all',
  loading: false,
  sendingTransfer: false,
  realtimeChannel: null,

  fetchWallet: async () => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      set({ wallet: data as Wallet });
    } finally {
      set({ loading: false });
    }
  },

  fetchTransactions: async (page = 0, type = 'all') => {
    set({ loading: true, currentPage: page, typeFilter: type });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First get the user's wallet ID
      const { wallet } = get();
      if (!wallet) return;

      let query = supabase
        .from('transactions')
        .select('*, from_profile:profiles!transactions_from_wallet_id_fkey(display_name), to_profile:profiles!transactions_to_wallet_id_fkey(display_name)', { count: 'exact' })
        .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error, count } = await query;

      if (error) {
        // If the join fails, try without profile joins
        const fallbackQuery = supabase
          .from('transactions')
          .select('*', { count: 'exact' })
          .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`)
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        const fallback = type !== 'all'
          ? await fallbackQuery.eq('type', type)
          : await fallbackQuery;

        if (fallback.error) throw fallback.error;
        set({
          transactions: (fallback.data ?? []) as Transaction[],
          transactionCount: fallback.count ?? 0,
        });
        return;
      }

      set({
        transactions: (data ?? []) as Transaction[],
        transactionCount: count ?? 0,
      });
    } finally {
      set({ loading: false });
    }
  },

  sendTransfer: async (recipientUsername: string, amount: number, description: string) => {
    set({ sendingTransfer: true });
    try {
      const { data, error } = await supabase.rpc('transfer_tc', {
        recipient_username: recipientUsername,
        transfer_amount: amount,
        transfer_description: description,
      });

      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error((data as { error: string }).error);
      }

      // Refresh wallet and transactions
      await get().fetchWallet();
      await get().fetchTransactions(0, get().typeFilter);
    } finally {
      set({ sendingTransfer: false });
    }
  },

  subscribeRealtime: (userId: string) => {
    const channel = supabase
      .channel(`wallet:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            set({ wallet: payload.new as Wallet });
          }
        }
      )
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribeRealtime: () => {
    const { realtimeChannel } = get();
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      set({ realtimeChannel: null });
    }
  },

  reset: () => {
    get().unsubscribeRealtime();
    set({
      wallet: null,
      transactions: [],
      transactionCount: 0,
      currentPage: 0,
      typeFilter: 'all',
      loading: false,
      sendingTransfer: false,
    });
  },
}));
