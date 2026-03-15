import { ArrowDownLeft, ArrowUpRight, Landmark, Award, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWalletStore } from '@/stores/walletStore';
import { formatTC, formatDate, cn } from '@/lib/utils';
import type { Transaction, TransactionType } from '@/types/database';

const PAGE_SIZE = 20;

const typeLabels: Record<TransactionType, string> = {
  transfer: 'Transfer',
  earning: 'Earning',
  tax: 'Tax',
  purchase: 'Purchase',
  escrow: 'Escrow',
  welcome_bonus: 'Welcome Bonus',
};

const typeIcons: Record<TransactionType, typeof ArrowUpRight> = {
  transfer: ArrowUpRight,
  earning: Award,
  tax: Landmark,
  purchase: Receipt,
  escrow: Receipt,
  welcome_bonus: Award,
};

function TransactionRow({ tx, walletId }: { tx: Transaction; walletId: string }) {
  const isIncoming = tx.to_wallet_id === walletId;
  const Icon = typeIcons[tx.type] ?? ArrowUpRight;

  return (
    <div className="flex items-center gap-4 rounded-md border p-3">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full',
          isIncoming ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        )}
      >
        {isIncoming ? <ArrowDownLeft className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {typeLabels[tx.type]}
          {tx.description && (
            <span className="ml-1 text-muted-foreground">- {tx.description}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
      </div>
      <div className={cn('text-sm font-semibold', isIncoming ? 'text-green-600' : 'text-red-600')}>
        {isIncoming ? '+' : '-'}{formatTC(tx.amount)}
      </div>
    </div>
  );
}

export function TransactionList() {
  const { transactions, transactionCount, currentPage, typeFilter, wallet, fetchTransactions } =
    useWalletStore();

  const totalPages = Math.ceil(transactionCount / PAGE_SIZE);

  if (!wallet) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select
          value={typeFilter}
          onValueChange={(val) => fetchTransactions(0, val as TransactionType | 'all')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="earning">Earning</SelectItem>
            <SelectItem value="tax">Tax</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
            <SelectItem value="escrow">Escrow</SelectItem>
            <SelectItem value="welcome_bonus">Welcome Bonus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {transactions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} walletId={wallet.id} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => fetchTransactions(currentPage - 1, typeFilter)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => fetchTransactions(currentPage + 1, typeFilter)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
