import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Star, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ReviewForm } from '@/components/marketplace/ReviewForm';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { useAuthStore } from '@/stores/authStore';
import { formatTC, formatDate, cn } from '@/lib/utils';

export function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    currentService: service,
    currentServiceLoading: loading,
    serviceReviews: reviews,
    reviewsLoading,
    fetchService,
    fetchServiceReviews,
    toggleServiceActive,
  } = useMarketplaceStore();

  useEffect(() => {
    if (id) {
      fetchService(id);
      fetchServiceReviews(id);
    }
  }, [id]);

  if (loading || !service) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOwner = user?.id === service.provider_id;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Marketplace
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{service.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="rounded bg-accent px-2 py-0.5 text-xs">{service.category}</span>
                {service.review_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {service.rating_avg.toFixed(1)} ({service.review_count} reviews)
                  </span>
                )}
                {!service.is_active && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                    Inactive
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="flex items-center gap-1 text-lg font-bold text-primary">
                <Coins className="h-5 w-5" />
                {formatTC(service.price_tc)}
              </span>
              <span className="text-xs text-muted-foreground">
                {service.price_type === 'hourly' ? 'per hour' : 'fixed price'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Description</h3>
            <p className="whitespace-pre-wrap text-sm">{service.description}</p>
          </div>

          <Separator />

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Provider</h4>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={service.provider?.avatar_url ?? undefined} />
                <AvatarFallback>{service.provider?.display_name?.charAt(0)?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
              <div>
                <span className="text-sm font-medium">{service.provider?.display_name ?? 'Unknown'}</span>
                {(service.provider?.reputation_score ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Rep: {service.provider?.reputation_score}
                  </p>
                )}
              </div>
            </div>
          </div>

          {isOwner && (
            <>
              <Separator />
              <Button
                variant={service.is_active ? 'destructive' : 'default'}
                size="sm"
                onClick={() => toggleServiceActive(service.id, !service.is_active)}
              >
                {service.is_active ? 'Deactivate Listing' : 'Reactivate Listing'}
              </Button>
            </>
          )}

          <Separator />

          {/* Reviews */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">
              Reviews ({service.review_count})
            </h3>

            {!isOwner && <ReviewForm serviceId={service.id} />}

            <div className="mt-4 space-y-4">
              {reviewsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={review.reviewer?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {review.reviewer?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {review.reviewer?.display_name ?? 'User'}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={cn(
                              'h-3 w-3',
                              n <= review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm">{review.review_text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
