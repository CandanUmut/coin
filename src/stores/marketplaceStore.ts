import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Task, Service, ServiceReview, Dispute, DisputeVote } from '@/types/database';

const PAGE_SIZE = 20;

type TaskTab = 'browse' | 'my-tasks';
type MarketplaceTab = 'tasks' | 'services' | 'my-listings';

interface MarketplaceState {
  // Tasks
  tasks: Task[];
  taskCount: number;
  taskPage: number;
  taskLoading: boolean;
  currentTask: Task | null;
  currentTaskLoading: boolean;

  // Services
  services: Service[];
  serviceCount: number;
  servicePage: number;
  serviceLoading: boolean;
  currentService: Service | null;
  currentServiceLoading: boolean;
  serviceReviews: ServiceReview[];
  reviewsLoading: boolean;

  // Disputes
  currentDispute: Dispute | null;
  disputeLoading: boolean;

  // UI state
  activeTab: MarketplaceTab;
  taskTab: TaskTab;
  categoryFilter: string;
  statusFilter: string;

  // Task actions
  fetchTasks: (page?: number, category?: string, status?: string) => Promise<void>;
  fetchMyTasks: (page?: number) => Promise<void>;
  fetchTask: (id: string) => Promise<void>;
  createTask: (title: string, description: string, bounty: number, category: string) => Promise<string>;
  claimTask: (taskId: string) => Promise<void>;
  submitWork: (taskId: string) => Promise<void>;
  approveTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;

  // Service actions
  fetchServices: (page?: number, category?: string) => Promise<void>;
  fetchMyServices: (page?: number) => Promise<void>;
  fetchService: (id: string) => Promise<void>;
  createService: (title: string, description: string, category: string, price: number, priceType: 'fixed' | 'hourly') => Promise<string>;
  toggleServiceActive: (id: string, active: boolean) => Promise<void>;
  fetchServiceReviews: (serviceId: string) => Promise<void>;
  addReview: (serviceId: string, rating: number, text: string) => Promise<void>;

  // Dispute actions
  fetchDispute: (taskId: string) => Promise<void>;
  initiateDispute: (taskId: string, reason: string) => Promise<void>;
  castVote: (disputeId: string, vote: DisputeVote) => Promise<void>;

  // UI
  setActiveTab: (tab: MarketplaceTab) => void;
  setTaskTab: (tab: TaskTab) => void;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  tasks: [],
  taskCount: 0,
  taskPage: 0,
  taskLoading: false,
  currentTask: null,
  currentTaskLoading: false,

  services: [],
  serviceCount: 0,
  servicePage: 0,
  serviceLoading: false,
  currentService: null,
  currentServiceLoading: false,
  serviceReviews: [],
  reviewsLoading: false,

  currentDispute: null,
  disputeLoading: false,

  activeTab: 'tasks',
  taskTab: 'browse',
  categoryFilter: '',
  statusFilter: '',

  // ── Tasks ──────────────────────────────────────────────────────────

  fetchTasks: async (page = 0, category?: string, status?: string) => {
    set({ taskLoading: true, taskPage: page });
    try {
      let query = supabase
        .from('tasks')
        .select('*, poster:profiles!tasks_poster_id_fkey(id, display_name, avatar_url, reputation_score)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (category) query = query.eq('category', category);
      if (status) query = query.eq('status', status);

      const { data, error, count } = await query;
      if (error) throw error;

      const tasks = (data ?? []).map((t) => ({
        ...t,
        poster: Array.isArray(t.poster) ? t.poster[0] : t.poster,
      })) as Task[];

      set({ tasks, taskCount: count ?? 0 });
    } finally {
      set({ taskLoading: false });
    }
  },

  fetchMyTasks: async (page = 0) => {
    set({ taskLoading: true, taskPage: page });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error, count } = await supabase
        .from('tasks')
        .select('*, poster:profiles!tasks_poster_id_fkey(id, display_name, avatar_url, reputation_score)', { count: 'exact' })
        .or(`poster_id.eq.${user.id},worker_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      const tasks = (data ?? []).map((t) => ({
        ...t,
        poster: Array.isArray(t.poster) ? t.poster[0] : t.poster,
      })) as Task[];

      set({ tasks, taskCount: count ?? 0 });
    } finally {
      set({ taskLoading: false });
    }
  },

  fetchTask: async (id) => {
    set({ currentTaskLoading: true, currentTask: null });
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          poster:profiles!tasks_poster_id_fkey(id, display_name, avatar_url, reputation_score),
          worker:profiles!tasks_worker_id_fkey(id, display_name, avatar_url)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const task = {
        ...data,
        poster: Array.isArray(data.poster) ? data.poster[0] : data.poster,
        worker: Array.isArray(data.worker) ? data.worker[0] : data.worker,
      } as Task;

      set({ currentTask: task });
    } finally {
      set({ currentTaskLoading: false });
    }
  },

  createTask: async (title, description, bounty, category) => {
    const { data, error } = await supabase.rpc('create_task_with_escrow', {
      p_title: title,
      p_description: description,
      p_bounty_amount: bounty,
      p_category: category,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.task_id;
  },

  claimTask: async (taskId) => {
    const { data, error } = await supabase.rpc('claim_task', { p_task_id: taskId });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await get().fetchTask(taskId);
  },

  submitWork: async (taskId) => {
    const { data, error } = await supabase.rpc('submit_task_work', { p_task_id: taskId });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await get().fetchTask(taskId);
  },

  approveTask: async (taskId) => {
    const { data, error } = await supabase.rpc('approve_task', { p_task_id: taskId });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await get().fetchTask(taskId);
  },

  cancelTask: async (taskId) => {
    const { data, error } = await supabase.rpc('cancel_task_escrow', { p_task_id: taskId });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await get().fetchTask(taskId);
  },

  // ── Services ───────────────────────────────────────────────────────

  fetchServices: async (page = 0, category?: string) => {
    set({ serviceLoading: true, servicePage: page });
    try {
      let query = supabase
        .from('services')
        .select('*, provider:profiles!services_provider_id_fkey(id, display_name, avatar_url, reputation_score)', { count: 'exact' })
        .eq('is_active', true)
        .order('rating_avg', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (category) query = query.eq('category', category);

      const { data, error, count } = await query;
      if (error) throw error;

      const services = (data ?? []).map((s) => ({
        ...s,
        provider: Array.isArray(s.provider) ? s.provider[0] : s.provider,
      })) as Service[];

      set({ services, serviceCount: count ?? 0 });
    } finally {
      set({ serviceLoading: false });
    }
  },

  fetchMyServices: async (page = 0) => {
    set({ serviceLoading: true, servicePage: page });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error, count } = await supabase
        .from('services')
        .select('*, provider:profiles!services_provider_id_fkey(id, display_name, avatar_url, reputation_score)', { count: 'exact' })
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      const services = (data ?? []).map((s) => ({
        ...s,
        provider: Array.isArray(s.provider) ? s.provider[0] : s.provider,
      })) as Service[];

      set({ services, serviceCount: count ?? 0 });
    } finally {
      set({ serviceLoading: false });
    }
  },

  fetchService: async (id) => {
    set({ currentServiceLoading: true, currentService: null });
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*, provider:profiles!services_provider_id_fkey(id, display_name, avatar_url, reputation_score)')
        .eq('id', id)
        .single();

      if (error) throw error;

      const service = {
        ...data,
        provider: Array.isArray(data.provider) ? data.provider[0] : data.provider,
      } as Service;

      set({ currentService: service });
    } finally {
      set({ currentServiceLoading: false });
    }
  },

  createService: async (title, description, category, price, priceType) => {
    const { data, error } = await supabase.rpc('create_service', {
      p_title: title,
      p_description: description,
      p_category: category,
      p_price_tc: price,
      p_price_type: priceType,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.service_id;
  },

  toggleServiceActive: async (id, active) => {
    const { error } = await supabase
      .from('services')
      .update({ is_active: active })
      .eq('id', id);

    if (error) throw error;

    set({
      services: get().services.map((s) =>
        s.id === id ? { ...s, is_active: active } : s
      ),
    });
  },

  fetchServiceReviews: async (serviceId) => {
    set({ reviewsLoading: true });
    try {
      const { data, error } = await supabase
        .from('service_reviews')
        .select('*, reviewer:profiles!service_reviews_reviewer_id_fkey(display_name, avatar_url)')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reviews = (data ?? []).map((r) => ({
        ...r,
        reviewer: Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
      })) as ServiceReview[];

      set({ serviceReviews: reviews });
    } finally {
      set({ reviewsLoading: false });
    }
  },

  addReview: async (serviceId, rating, text) => {
    const { data, error } = await supabase.rpc('add_service_review', {
      p_service_id: serviceId,
      p_rating: rating,
      p_review_text: text,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    await Promise.all([
      get().fetchServiceReviews(serviceId),
      get().fetchService(serviceId),
    ]);
  },

  // ── Disputes ───────────────────────────────────────────────────────

  fetchDispute: async (taskId) => {
    set({ disputeLoading: true, currentDispute: null });
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .eq('task_id', taskId)
        .eq('status', 'open')
        .maybeSingle();

      if (error) throw error;
      set({ currentDispute: data as Dispute | null });
    } finally {
      set({ disputeLoading: false });
    }
  },

  initiateDispute: async (taskId, reason) => {
    const { data, error } = await supabase.rpc('initiate_dispute', {
      p_task_id: taskId,
      p_reason: reason,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    await Promise.all([
      get().fetchTask(taskId),
      get().fetchDispute(taskId),
    ]);
  },

  castVote: async (disputeId, vote) => {
    const { data, error } = await supabase.rpc('cast_jury_vote', {
      p_dispute_id: disputeId,
      p_vote: vote,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    // Refresh dispute
    const dispute = get().currentDispute;
    if (dispute) {
      await get().fetchDispute(dispute.task_id);
      await get().fetchTask(dispute.task_id);
    }
  },

  // ── UI ─────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),
  setTaskTab: (tab) => set({ taskTab: tab }),
}));
