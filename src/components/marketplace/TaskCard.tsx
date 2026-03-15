import { useNavigate } from 'react-router-dom';
import { Coins, Clock, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatTC, formatDate, cn } from '@/lib/utils';
import type { Task } from '@/types/database';

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  claimed: 'bg-blue-100 text-blue-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-emerald-100 text-emerald-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export function TaskCard({ task }: { task: Task }) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/marketplace/tasks/${task.id}`)}
    >
      <CardContent className="pt-6">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-base font-semibold leading-tight">{task.title}</h3>
          <span
            className={cn(
              'ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
              statusColors[task.status] ?? 'bg-gray-100 text-gray-800'
            )}
          >
            {task.status}
          </span>
        </div>
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold text-primary">
            <Coins className="h-3.5 w-3.5" />
            {formatTC(task.bounty_amount)}
          </span>
          <span className="rounded bg-accent px-1.5 py-0.5">{task.category}</span>
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {task.poster?.display_name ?? 'Unknown'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(task.created_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
