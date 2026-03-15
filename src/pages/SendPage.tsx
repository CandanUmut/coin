import { useState, type FormEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWalletStore } from '@/stores/walletStore';
import { formatTC } from '@/lib/utils';

export function SendPage() {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const { wallet, sendingTransfer, sendTransfer } = useWalletStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    if (numAmount > (wallet?.balance ?? 0)) {
      toast.error('Insufficient balance');
      return;
    }

    if (!recipient.trim()) {
      toast.error('Please enter a recipient username');
      return;
    }

    try {
      await sendTransfer(recipient.trim(), numAmount, description.trim());
      toast.success(`Sent ${formatTC(numAmount)} to ${recipient}`);
      setRecipient('');
      setAmount('');
      setDescription('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Send TimeCoin</h1>
        <p className="text-muted-foreground">
          Transfer TC to another user. Your balance: {formatTC(wallet?.balance ?? 0)}
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Transfer TC
          </CardTitle>
          <CardDescription>
            Send TimeCoin to another user by their display name
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Username</Label>
              <Input
                id="recipient"
                placeholder="Enter display name"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (TC)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                max={wallet?.balance ?? 0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What's this transfer for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" className="w-full" disabled={sendingTransfer}>
              {sendingTransfer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send TC
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
