import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Post, PostInteraction, PostType } from '@/types/database';

const PAGE_SIZE = 20;

type SortMode = 'recent' | 'quality';

interface FeedState {
  posts: Post[];
  postCount: number;
  currentPage: number;
  sortMode: SortMode;
  loading: boolean;
  creating: boolean;
  comments: Record<string, PostInteraction[]>;
  loadingComments: Record<string, boolean>;

  fetchPosts: (page?: number, sort?: SortMode) => Promise<void>;
  createPost: (contentText: string, mediaUrls?: string[], postType?: PostType) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  tipPost: (postId: string, amount: number) => Promise<void>;
  flagPost: (postId: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<void>;
  moderatePost: (postId: string, action: 'hide' | 'unhide') => Promise<void>;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  postCount: 0,
  currentPage: 0,
  sortMode: 'recent',
  loading: false,
  creating: false,
  comments: {},
  loadingComments: {},

  fetchPosts: async (page = 0, sort?: SortMode) => {
    const sortMode = sort ?? get().sortMode;
    set({ loading: true, currentPage: page, sortMode });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const orderCol = sortMode === 'quality' ? 'quality_score' : 'created_at';

      const { data: posts, error, count } = await supabase
        .from('posts')
        .select('*, author:profiles!posts_author_id_fkey(id, display_name, avatar_url, reputation_score)', { count: 'exact' })
        .eq('is_hidden', false)
        .order(orderCol, { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      // Fetch like/comment counts and user's like status for each post
      const postIds = (posts ?? []).map((p) => p.id);
      if (postIds.length === 0) {
        set({ posts: [], postCount: 0 });
        return;
      }

      const [likeCounts, commentCounts, userLikes] = await Promise.all([
        supabase
          .from('post_interactions')
          .select('post_id', { count: 'exact', head: false })
          .in('post_id', postIds)
          .eq('type', 'like'),
        supabase
          .from('post_interactions')
          .select('post_id', { count: 'exact', head: false })
          .in('post_id', postIds)
          .eq('type', 'comment'),
        user
          ? supabase
              .from('post_interactions')
              .select('post_id')
              .in('post_id', postIds)
              .eq('user_id', user.id)
              .eq('type', 'like')
          : Promise.resolve({ data: [] }),
      ]);

      // Build counts maps
      const likeMap: Record<string, number> = {};
      const commentMap: Record<string, number> = {};
      const userLikeSet = new Set<string>();

      (likeCounts.data ?? []).forEach((r) => {
        const pid = (r as { post_id: string }).post_id;
        likeMap[pid] = (likeMap[pid] ?? 0) + 1;
      });
      (commentCounts.data ?? []).forEach((r) => {
        const pid = (r as { post_id: string }).post_id;
        commentMap[pid] = (commentMap[pid] ?? 0) + 1;
      });
      ((userLikes as { data: { post_id: string }[] | null }).data ?? []).forEach((r) => {
        userLikeSet.add(r.post_id);
      });

      const enrichedPosts: Post[] = (posts ?? []).map((p) => ({
        ...p,
        author: Array.isArray(p.author) ? p.author[0] : p.author,
        like_count: likeMap[p.id] ?? 0,
        comment_count: commentMap[p.id] ?? 0,
        user_has_liked: userLikeSet.has(p.id),
      }));

      set({ posts: enrichedPosts, postCount: count ?? 0 });
    } finally {
      set({ loading: false });
    }
  },

  createPost: async (contentText, mediaUrls = [], postType = 'text') => {
    set({ creating: true });
    try {
      const { data, error } = await supabase.rpc('create_post', {
        p_content_text: contentText,
        p_media_urls: mediaUrls,
        p_post_type: postType,
      });

      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error((data as { error: string }).error);
      }

      await get().fetchPosts(0, get().sortMode);
    } finally {
      set({ creating: false });
    }
  },

  toggleLike: async (postId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const post = get().posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.user_has_liked) {
      // Remove like
      await supabase
        .from('post_interactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('type', 'like');

      set({
        posts: get().posts.map((p) =>
          p.id === postId
            ? { ...p, user_has_liked: false, like_count: (p.like_count ?? 1) - 1 }
            : p
        ),
      });
    } else {
      // Add like
      await supabase
        .from('post_interactions')
        .insert({ post_id: postId, user_id: user.id, type: 'like' });

      set({
        posts: get().posts.map((p) =>
          p.id === postId
            ? { ...p, user_has_liked: true, like_count: (p.like_count ?? 0) + 1 }
            : p
        ),
      });
    }
  },

  tipPost: async (postId, amount) => {
    const { data, error } = await supabase.rpc('tip_post_author', {
      p_post_id: postId,
      p_amount: amount,
    });

    if (error) throw error;
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error((data as { error: string }).error);
    }
  },

  flagPost: async (postId) => {
    const { data, error } = await supabase.rpc('flag_post', {
      p_post_id: postId,
    });

    if (error) throw error;
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error((data as { error: string }).error);
    }

    // Refresh to see if post was hidden
    await get().fetchPosts(get().currentPage, get().sortMode);
  },

  fetchComments: async (postId) => {
    set({ loadingComments: { ...get().loadingComments, [postId]: true } });
    try {
      const { data, error } = await supabase
        .from('post_interactions')
        .select('*, user:profiles!post_interactions_user_id_fkey(display_name, avatar_url)')
        .eq('post_id', postId)
        .eq('type', 'comment')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const comments = (data ?? []).map((c) => ({
        ...c,
        user: Array.isArray(c.user) ? c.user[0] : c.user,
      }));

      set({ comments: { ...get().comments, [postId]: comments as PostInteraction[] } });
    } finally {
      set({ loadingComments: { ...get().loadingComments, [postId]: false } });
    }
  },

  addComment: async (postId, text) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('post_interactions')
      .insert({ post_id: postId, user_id: user.id, type: 'comment', comment_text: text });

    if (error) throw error;

    // Update comment count optimistically
    set({
      posts: get().posts.map((p) =>
        p.id === postId ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p
      ),
    });

    // Refresh comments
    await get().fetchComments(postId);
  },

  moderatePost: async (postId, action) => {
    const { data, error } = await supabase.rpc('moderate_post', {
      p_post_id: postId,
      p_action: action,
    });

    if (error) throw error;
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error((data as { error: string }).error);
    }

    await get().fetchPosts(get().currentPage, get().sortMode);
  },
}));
