import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Clock, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { DisputePanel } from '@/components/marketplace/DisputePanel';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { useAuthStore } from '@/stores/authStore';
import { formatTC, formatDate, cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  claimed: 'bg-blue-100 text-blue-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-emerald-100 text-emerald-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    currentTask: task,
    currentTaskLoading: loading,
    fetchTask,
    claimTask,
    submitWork,
    approveTask,
    cancelTask,
    fetchDispute,
  } = useMarketplaceStore();

  useEffect(() => {
    if (id) {
      fetchTask(id);
      fetchDispute(id);
    }
  }, [id]);

  const handleAction = async (
    action: () => Promise<void>,
    successMsg: string
  ) => {
    try {
      await action();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  if (loading || !task) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPoster = user?.id === task.poster_id;
  const isWorker = user?.id === task.worker_id;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Marketplace
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{task.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="rounded bg-accent px-2 py-0.5 text-xs">{task.category}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(task.created_at)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  statusColors[task.status]
                )}
              >
                {task.status}
              </span>
              <span className="flex items-center gap-1 text-lg font-bold text-primary">
                <Coins className="h-5 w-5" />
                {formatTC(task.bounty_amount)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Description</h3>
            <p className="whitespace-pre-wrap text-sm">{task.description}</p>
          </div>

          <Separator />

          {/* People */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Posted by</h4>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={task.poster?.avatar_url ?? undefined} />
                  <AvatarFallback>{task.poster?.display_name?.charAt(0)?.toUpperCase() ?? '?'}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{task.poster?.display_name ?? 'Unknown'}</span>
              </div>
            </div>
            {task.worker && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Claimed by</h4>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={task.worker?.avatar_url ?? undefined} />
                    <AvatarFallback>{task.worker?.display_name?.charAt(0)?.toUpperCase() ?? '?'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{task.worker?.display_name ?? 'Unknown'}</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {/* Anyone can claim an open task (except poster) */}
            {task.status === 'open' && !isPoster && (
              <Button onClick={() => handleAction(() => claimTask(task.id), 'Task claimed!')}>
                Claim This Task
              </Button>
            )}

            {/* Worker can submit */}
            {task.status === 'claimed' && isWorker && (
              <Button onClick={() => handleAction(() => submitWork(task.id), 'Work submitted!')}>
                Submit Work
              </Button>
            )}

            {/* Poster can approve */}
            {task.status === 'submitted' && isPoster && (
              <Button onClick={() => handleAction(() => approveTask(task.id), 'Task approved! Bounty released.')}>
                Approve & Release Bounty
              </Button>
            )}

            {/* Poster can cancel if open or claimed */}
            {(task.status === 'open' || task.status === 'claimed') && isPoster && (
              <Button
                variant="destructive"
                onClick={() => handleAction(() => cancelTask(task.id), 'Task cancelled. Bounty refunded.')}
              >
                Cancel Task
              </Button>
            )}
          </div>

          {/* Dispute panel */}
          {(task.status === 'submitted' || task.status === 'disputed') && (
            <DisputePanel taskId={task.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
