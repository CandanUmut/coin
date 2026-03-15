import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMarketplaceStore } from '@/stores/marketplaceStore';

const CATEGORIES = ['general', 'design', 'development', 'writing', 'marketing', 'translation', 'other'];

export function CreateTaskPage() {
  const navigate = useNavigate();
  const createTask = useMarketplaceStore((s) => s.createTask);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bounty, setBounty] = useState('');
  const [category, setCategory] = useState('general');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bountyNum = parseFloat(bounty);
    if (isNaN(bountyNum) || bountyNum <= 0) {
      toast.error('Enter a valid bounty amount');
      return;
    }

    setSubmitting(true);
    try {
      const taskId = await createTask(title, description, bountyNum, category);
      toast.success('Task created! Bounty held in escrow.');
      navigate(`/marketplace/tasks/${taskId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Marketplace
      </Button>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Post a New Task</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="What do you need done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the task in detail (requirements, deliverables, timeline)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                rows={5}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bounty">Bounty (TC)</Label>
                <Input
                  id="bounty"
                  type="number"
                  placeholder="e.g. 25"
                  min="0.01"
                  step="0.01"
                  value={bounty}
                  onChange={(e) => setBounty(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This amount will be held in escrow until the task is completed.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Post Task & Lock Bounty
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
