import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, TrendingUp, FileText, Briefcase, Wrench } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchBar } from '@/components/marketplace/SearchBar';
import { useSearchStore } from '@/stores/searchStore';
import { formatTC, formatDate, cn } from '@/lib/utils';

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'task', label: 'Tasks' },
  { key: 'service', label: 'Services' },
  { key: 'post', label: 'Posts' },
] as const;

const typeIcons: Record<string, typeof FileText> = {
  post: FileText,
  task: Briefcase,
  service: Wrench,
};

export function SearchPage() {
  const navigate = useNavigate();
  const {
    results, loading, trending, trendingLoading,
    contentType, setContentType,
    category, setCategory,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    status, setStatus,
    search, fetchTrending,
    query,
  } = useSearchStore();

  useEffect(() => {
    fetchTrending();
  }, []);

  // Re-search when filters change (if there's a query)
  useEffect(() => {
    if (query.trim()) search();
  }, [contentType, category, status]);

  const handleResultClick = (result: typeof results[0]) => {
    if (result.type === 'task') navigate(`/marketplace/tasks/${result.id}`);
    else if (result.type === 'service') navigate(`/marketplace/services/${result.id}`);
    else navigate('/feed');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Search</h1>

      <SearchBar />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border p-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              className={cn(
                'rounded px-2 py-1 text-xs font-medium transition-colors',
                contentType === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
              onClick={() => setContentType(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {(contentType === 'task' || contentType === 'service' || contentType === 'all') && (
          <Input
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 w-28 text-xs"
          />
        )}

        {(contentType === 'task' || contentType === 'service') && (
          <div className="flex items-center gap-1">
            <Input
              placeholder="Min TC"
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-8 w-20 text-xs"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              placeholder="Max TC"
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-8 w-20 text-xs"
            />
          </div>
        )}

        {contentType === 'task' && (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">Any Status</option>
            <option value="open">Open</option>
            <option value="claimed">Claimed</option>
            <option value="submitted">Submitted</option>
          </select>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </h2>
          {results.map((result) => {
            const Icon = typeIcons[result.type] ?? FileText;
            return (
              <Card
                key={`${result.type}-${result.id}`}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleResultClick(result)}
              >
                <CardContent className="flex items-start gap-3 pt-4 pb-4">
                  <div className="mt-0.5 rounded bg-accent p-1.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {result.title?.slice(0, 100)}
                          {(result.title?.length ?? 0) > 100 ? '...' : ''}
                        </p>
                        {result.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {result.description}
                          </p>
                        )}
                      </div>
                      {result.bounty_amount != null && (
                        <span className="ml-2 shrink-0 text-sm font-semibold text-primary">
                          {formatTC(result.bounty_amount)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-accent px-1.5 py-0.5 capitalize">{result.type}</span>
                      {result.category && (
                        <span className="rounded bg-accent px-1.5 py-0.5">{result.category}</span>
                      )}
                      <span>{result.author_name}</span>
                      <span>{formatDate(result.created_at)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : query.trim() ? (
        <p className="py-12 text-center text-muted-foreground">
          No results found for "{query}".
        </p>
      ) : null}

      {/* Trending section (show when no search) */}
      {!query.trim() && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5" />
            Trending (24h)
          </h2>
          {trendingLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : trending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trending content yet.</p>
          ) : (
            <div className="space-y-2">
              {trending.map((item, i) => (
                <Card
                  key={`${item.type}-${item.id}`}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => handleResultClick(item)}
                >
                  <CardContent className="flex items-center gap-3 py-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {item.title?.slice(0, 80)}
                        {(item.title?.length ?? 0) > 80 ? '...' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {item.author_name}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
