import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskCard } from '@/components/marketplace/TaskCard';
import { ServiceCard } from '@/components/marketplace/ServiceCard';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

const CATEGORIES = ['general', 'design', 'development', 'writing', 'marketing', 'translation', 'other'];

export function MarketplacePage() {
  const navigate = useNavigate();
  const {
    activeTab, setActiveTab,
    taskTab, setTaskTab,
    tasks, taskCount, taskPage, taskLoading,
    services, serviceCount, servicePage, serviceLoading,
    fetchTasks, fetchMyTasks, fetchServices, fetchMyServices,
    categoryFilter,
  } = useMarketplaceStore();

  useEffect(() => {
    if (activeTab === 'tasks') {
      if (taskTab === 'browse') fetchTasks(0);
      else fetchMyTasks(0);
    } else if (activeTab === 'services') {
      fetchServices(0);
    } else if (activeTab === 'my-listings') {
      fetchMyServices(0);
    }
  }, [activeTab, taskTab]);

  const tabs = [
    { key: 'tasks' as const, label: 'Tasks' },
    { key: 'services' as const, label: 'Services' },
    { key: 'my-listings' as const, label: 'My Listings' },
  ];

  const totalTaskPages = Math.ceil(taskCount / PAGE_SIZE);
  const totalServicePages = Math.ceil(serviceCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate('/marketplace/tasks/new')}>
            <Plus className="mr-1 h-4 w-4" /> Post Task
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/marketplace/services/new')}>
            <Plus className="mr-1 h-4 w-4" /> List Service
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-md border p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-md border p-1">
              <button
                className={cn(
                  'rounded px-2 py-1 text-xs font-medium transition-colors',
                  taskTab === 'browse' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
                onClick={() => setTaskTab('browse')}
              >
                Browse
              </button>
              <button
                className={cn(
                  'rounded px-2 py-1 text-xs font-medium transition-colors',
                  taskTab === 'my-tasks' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
                onClick={() => setTaskTab('my-tasks')}
              >
                My Tasks
              </button>
            </div>
            {taskTab === 'browse' && (
              <div className="flex flex-wrap gap-1">
                <button
                  className={cn(
                    'rounded px-2 py-1 text-xs transition-colors',
                    !categoryFilter ? 'bg-accent font-medium' : 'hover:bg-accent'
                  )}
                  onClick={() => fetchTasks(0, '', '')}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={cn(
                      'rounded px-2 py-1 text-xs capitalize transition-colors',
                      categoryFilter === cat ? 'bg-accent font-medium' : 'hover:bg-accent'
                    )}
                    onClick={() => fetchTasks(0, cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {taskLoading && tasks.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No tasks found. Be the first to post one!
            </p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}

          {totalTaskPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={taskPage === 0}
                onClick={() => taskTab === 'browse' ? fetchTasks(taskPage - 1) : fetchMyTasks(taskPage - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {taskPage + 1} of {totalTaskPages}
              </span>
              <Button variant="outline" size="sm" disabled={taskPage >= totalTaskPages - 1}
                onClick={() => taskTab === 'browse' ? fetchTasks(taskPage + 1) : fetchMyTasks(taskPage + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Services Tab */}
      {(activeTab === 'services' || activeTab === 'my-listings') && (
        <div className="space-y-4">
          {serviceLoading && services.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : services.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No services found. List yours to get started!
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}

          {totalServicePages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={servicePage === 0}
                onClick={() => activeTab === 'my-listings' ? fetchMyServices(servicePage - 1) : fetchServices(servicePage - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {servicePage + 1} of {totalServicePages}
              </span>
              <Button variant="outline" size="sm" disabled={servicePage >= totalServicePages - 1}
                onClick={() => activeTab === 'my-listings' ? fetchMyServices(servicePage + 1) : fetchServices(servicePage + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
