import { useState, useEffect, type FormEvent } from 'react';
import { User, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';

export function ProfilePage() {
  const { profile, updateProfile, loading } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
    }
  }, [profile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      toast.error('Display name must be at least 2 characters');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your TimeCoin profile</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Info Card */}
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col items-center pt-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-lg">
                {profile?.display_name?.charAt(0)?.toUpperCase() ?? <User className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            <h3 className="mt-4 text-lg font-semibold">{profile?.display_name}</h3>
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span className="capitalize">{profile?.role}</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Reputation: {profile?.reputation_score ?? 0}
            </div>
            {profile?.bio && (
              <p className="mt-3 text-center text-sm text-muted-foreground">{profile.bio}</p>
            )}
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your public profile information</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
