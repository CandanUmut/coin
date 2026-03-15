import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { SearchResult } from '@/types/database';

type ContentType = 'all' | 'post' | 'task' | 'service';

interface SearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  contentType: ContentType;
  category: string;
  minPrice: string;
  maxPrice: string;
  status: string;
  trending: SearchResult[];
  trendingLoading: boolean;

  setQuery: (query: string) => void;
  setContentType: (type: ContentType) => void;
  setCategory: (category: string) => void;
  setMinPrice: (price: string) => void;
  setMaxPrice: (price: string) => void;
  setStatus: (status: string) => void;
  search: () => Promise<void>;
  fetchTrending: () => Promise<void>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  loading: false,
  contentType: 'all',
  category: '',
  minPrice: '',
  maxPrice: '',
  status: '',
  trending: [],
  trendingLoading: false,

  setQuery: (query) => set({ query }),
  setContentType: (contentType) => set({ contentType }),
  setCategory: (category) => set({ category }),
  setMinPrice: (minPrice) => set({ minPrice }),
  setMaxPrice: (maxPrice) => set({ maxPrice }),
  setStatus: (status) => set({ status }),

  search: async () => {
    const { query, contentType, category, minPrice, maxPrice, status } = get();
    if (!query.trim()) {
      set({ results: [] });
      return;
    }

    set({ loading: true });
    try {
      const { data, error } = await supabase.rpc('search_content', {
        p_query: query.trim(),
        p_type: contentType,
        p_category: category || null,
        p_min_price: minPrice ? parseFloat(minPrice) : null,
        p_max_price: maxPrice ? parseFloat(maxPrice) : null,
        p_status: status || null,
      });

      if (error) throw error;
      set({ results: (data ?? []) as SearchResult[] });
    } finally {
      set({ loading: false });
    }
  },

  fetchTrending: async () => {
    set({ trendingLoading: true });
    try {
      const { data, error } = await supabase.rpc('get_trending_content', {
        p_limit: 10,
      });

      if (error) throw error;
      set({ trending: (data ?? []) as SearchResult[] });
    } finally {
      set({ trendingLoading: false });
    }
  },
}));
