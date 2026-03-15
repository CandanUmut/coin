import { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Coins,
  Flag,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Shield,
  Loader2,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useFeedStore } from '@/stores/feedStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, cn } from '@/lib/utils';
import type { Post } from '@/types/database';

function TipDialog({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const tipPost = useFeedStore((s) => s.tipPost);

  const handleTip = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSending(true);
    try {
      await tipPost(postId, num);
      toast.success(`Tipped ${num} TC!`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tip failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-2 pt-2">
      <Input
        type="number"
        placeholder="Amount"
        min="0.01"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="h-8 w-24"
      />
      <Button size="sm" variant="default" onClick={handleTip} disabled={sending} className="h-8">
        {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Send'}
      </Button>
      <Button size="sm" variant="ghost" onClick={onClose} className="h-8">
        Cancel
      </Button>
    </div>
  );
}

function CommentSection({ postId }: { postId: string }) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const comments = useFeedStore((s) => s.comments[postId] ?? []);
  const loadingComments = useFeedStore((s) => s.loadingComments[postId] ?? false);
  const { addComment } = useFeedStore();

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await addComment(postId, newComment.trim());
      setNewComment('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingComments) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t pt-3">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={c.user?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">
              {c.user?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-xs font-medium">{c.user?.display_name ?? 'User'}</p>
            <p className="text-sm text-muted-foreground">{c.comment_text}</p>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
          className="h-8"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Post'}
        </Button>
      </div>
    </div>
  );
}

export function PostCard({ post }: { post: Post }) {
  const [showComments, setShowComments] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { toggleLike, flagPost, fetchComments, moderatePost } = useFeedStore();
  const currentUser = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isModerator = profile?.role === 'moderator' || profile?.role === 'admin';

  const handleToggleComments = () => {
    if (!showComments) {
      fetchComments(post.id);
    }
    setShowComments(!showComments);
  };

  const handleFlag = async () => {
    try {
      await flagPost(post.id);
      toast.success('Post flagged for review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to flag post');
    }
    setShowMenu(false);
  };

  const handleModerate = async (action: 'hide' | 'unhide') => {
    try {
      await moderatePost(post.id, action);
      toast.success(`Post ${action === 'hide' ? 'hidden' : 'restored'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to moderate');
    }
    setShowMenu(false);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Author header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author?.avatar_url ?? undefined} />
              <AvatarFallback>
                {post.author?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold">{post.author?.display_name ?? 'User'}</p>
                {(post.author?.reputation_score ?? 0) >= 10 && (
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(post.created_at)}</p>
            </div>
          </div>
          {/* Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {showMenu && (
              <div className="absolute right-0 top-8 z-10 w-40 rounded-md border bg-popover p-1 shadow-md">
                {currentUser?.id !== post.author_id && (
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={handleFlag}
                  >
                    <Flag className="h-3 w-3" /> Report
                  </button>
                )}
                {isModerator && (
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => handleModerate(post.is_hidden ? 'unhide' : 'hide')}
                  >
                    <Shield className="h-3 w-3" /> {post.is_hidden ? 'Unhide' : 'Hide'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <p className="mb-3 whitespace-pre-wrap text-sm">{post.content_text}</p>

        {/* Media */}
        {post.media_urls?.length > 0 && (
          <div className="mb-3">
            {post.media_urls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="Post media"
                className="max-h-96 w-full rounded-md object-cover"
                loading="lazy"
              />
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-1 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-1.5', post.user_has_liked && 'text-red-500')}
            onClick={() => toggleLike(post.id)}
          >
            <Heart className={cn('h-4 w-4', post.user_has_liked && 'fill-current')} />
            {post.like_count ?? 0}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleToggleComments}>
            <MessageCircle className="h-4 w-4" />
            {post.comment_count ?? 0}
            {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          {currentUser?.id !== post.author_id && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowTip(!showTip)}
            >
              <Coins className="h-4 w-4" />
              Tip
            </Button>
          )}
        </div>

        {/* Tip dialog */}
        {showTip && <TipDialog postId={post.id} onClose={() => setShowTip(false)} />}

        {/* Comments */}
        {showComments && <CommentSection postId={post.id} />}
      </CardContent>
    </Card>
  );
}
