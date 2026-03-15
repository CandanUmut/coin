import { useNavigate } from 'react-router-dom';
import { Coins, Star, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatTC, cn } from '@/lib/utils';
import type { Service } from '@/types/database';

export function ServiceCard({ service }: { service: Service }) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/marketplace/services/${service.id}`)}
    >
      <CardContent className="pt-6">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-base font-semibold leading-tight">{service.title}</h3>
          <span className="ml-2 shrink-0 text-sm font-semibold text-primary">
            {formatTC(service.price_tc)}
            <span className="text-xs font-normal text-muted-foreground">
              {service.price_type === 'hourly' ? '/hr' : ''}
            </span>
          </span>
        </div>
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded bg-accent px-1.5 py-0.5">{service.category}</span>
          {service.review_count > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {service.rating_avg.toFixed(1)} ({service.review_count})
            </span>
          )}
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {service.provider?.display_name ?? 'Unknown'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
