import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreatePostForm } from '@/components/feed/CreatePostForm';
import { PostCard } from '@/components/feed/PostCard';
import { useFeedStore } from '@/stores/feedStore';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

export function FeedPage() {
  const { posts, postCount, currentPage, sortMode, loading, fetchPosts } = useFeedStore();
  const totalPages = Math.ceil(postCount / PAGE_SIZE);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Feed</h1>
        <div className="flex gap-1 rounded-md border p-1">
          <button
            className={cn(
              'rounded px-3 py-1 text-sm font-medium transition-colors',
              sortMode === 'recent' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            )}
            onClick={() => fetchPosts(0, 'recent')}
          >
            Recent
          </button>
          <button
            className={cn(
              'rounded px-3 py-1 text-sm font-medium transition-colors',
              sortMode === 'quality' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            )}
            onClick={() => fetchPosts(0, 'quality')}
          >
            Top
          </button>
        </div>
      </div>

      <CreatePostForm />

      {loading && posts.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No posts yet. Be the first to post!
        </p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => fetchPosts(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => fetchPosts(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
