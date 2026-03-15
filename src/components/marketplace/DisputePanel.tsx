import { useState } from 'react';
import { AlertTriangle, Loader2, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, cn } from '@/lib/utils';
import type { DisputeVote } from '@/types/database';

export function DisputePanel({ taskId }: { taskId: string }) {
  const currentDispute = useMarketplaceStore((s) => s.currentDispute);
  const disputeLoading = useMarketplaceStore((s) => s.disputeLoading);
  const currentTask = useMarketplaceStore((s) => s.currentTask);
  const initiateDispute = useMarketplaceStore((s) => s.initiateDispute);
  const castVote = useMarketplaceStore((s) => s.castVote);
  const user = useAuthStore((s) => s.user);

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState(false);

  const canDispute =
    currentTask?.status === 'submitted' &&
    user &&
    (user.id === currentTask.poster_id || user.id === currentTask.worker_id);

  const isJuror = currentDispute?.jury_members?.includes(user?.id ?? '') ?? false;
  const hasVoted = currentDispute?.jury_votes?.[user?.id ?? ''] != null;
  const voteCount = Object.keys(currentDispute?.jury_votes ?? {}).length;

  const handleInitiate = async () => {
    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters');
      return;
    }
    setSubmitting(true);
    try {
      await initiateDispute(taskId, reason.trim());
      toast.success('Dispute initiated. Jury has been selected.');
      setReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to initiate dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (vote: DisputeVote) => {
    if (!currentDispute) return;
    setVoting(true);
    try {
      await castVote(currentDispute.id, vote);
      toast.success('Vote recorded!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cast vote');
    } finally {
      setVoting(false);
    }
  };

  if (disputeLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show existing dispute
  if (currentDispute) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center gap-2">
            <Scale className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">
              Dispute {currentDispute.status === 'resolved' ? 'Resolved' : 'In Progress'}
            </h3>
          </div>

          <p className="mb-2 text-sm"><strong>Reason:</strong> {currentDispute.reason}</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Filed {formatDate(currentDispute.created_at)}
          </p>

          {currentDispute.resolution && (
            <p className="mb-2 text-sm font-medium">
              Resolution: <span className="capitalize">{currentDispute.resolution.replace('_', ' ')}</span>
            </p>
          )}

          <p className="mb-3 text-xs text-muted-foreground">
            Jury votes: {voteCount}/3
          </p>

          {/* Jury voting interface */}
          {isJuror && !hasVoted && currentDispute.status === 'open' && (
            <div className="space-y-2 rounded-md border bg-white p-3">
              <p className="text-sm font-medium">You are a juror. Cast your vote:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleVote('approve_worker')}
                  disabled={voting}
                >
                  {voting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  Approve Worker
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVote('return_poster')}
                  disabled={voting}
                >
                  Return to Poster
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleVote('split')}
                  disabled={voting}
                >
                  Split 50/50
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You will earn 2 TC for participating as a juror.
              </p>
            </div>
          )}

          {isJuror && hasVoted && (
            <p className="text-sm text-muted-foreground">
              You voted: <span className="font-medium capitalize">
                {currentDispute.jury_votes[user!.id].replace('_', ' ')}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show initiate dispute form
  if (canDispute) {
    return (
      <Card className="border-orange-200">
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold">Open a Dispute</h3>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            If you disagree with the submitted work, you can open a dispute.
            3 community jurors will review and vote on the outcome.
          </p>
          <Textarea
            placeholder="Describe the reason for your dispute (min 10 chars)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mb-2"
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={handleInitiate}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Initiate Dispute
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
