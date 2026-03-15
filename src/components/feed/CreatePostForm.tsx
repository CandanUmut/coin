import { useState, type FormEvent } from 'react';
import { ImagePlus, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useFeedStore } from '@/stores/feedStore';

export function CreatePostForm() {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const { creating, createPost } = useFeedStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Post content cannot be empty');
      return;
    }

    try {
      const mediaUrls = imageUrl.trim() ? [imageUrl.trim()] : [];
      const postType = mediaUrls.length > 0 ? 'image' as const : 'text' as const;
      await createPost(content.trim(), mediaUrls, postType);
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      toast.success('Post created!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create post');
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3 pt-6">
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="resize-none"
          />
          {showImageInput && (
            <Input
              type="url"
              placeholder="Image URL (https://...)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          )}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowImageInput(!showImageInput)}
            >
              <ImagePlus className="mr-1 h-4 w-4" />
              Image
            </Button>
            <Button type="submit" size="sm" disabled={creating || !content.trim()}>
              {creating ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Post
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
