import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { cn } from '@/lib/utils';

export function ReviewForm({ serviceId }: { serviceId: string }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const addReview = useMarketplaceStore((s) => s.addReview);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    if (!text.trim()) {
      toast.error('Please write a review');
      return;
    }

    setSubmitting(true);
    try {
      await addReview(serviceId, rating, text.trim());
      toast.success('Review submitted!');
      setRating(0);
      setText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h4 className="text-sm font-semibold">Write a Review</h4>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(n)}
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                (hoverRating || rating) >= n
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              )}
            />
          </button>
        ))}
      </div>
      <Textarea
        placeholder="Share your experience..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <Button size="sm" onClick={handleSubmit} disabled={submitting}>
        {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
        Submit Review
      </Button>
    </div>
  );
}
