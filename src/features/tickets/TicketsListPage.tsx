import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import styles from './TicketsListPage.module.css';
import { getTickets } from '@/api/fixit.api';
import type { Ticket, TicketStatus } from '@/api/types';
import {
  Button,
  Input,
  TicketCard,
  EmptyState,
  TicketCardSkeleton,
  Pagination,
} from '@/components/ui';
import { PlusIcon, SearchIcon, AlertTriangleIcon } from '@/components/icons';

export const TicketsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeStatus = (searchParams.get('status') as TicketStatus | 'all') || 'all';
  const searchQuery = searchParams.get('search') || '';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
  const [currentCursorIndex, setCurrentCursorIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const fetchTickets = async (cursor: string | null = null, signal?: AbortSignal) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await getTickets(
        {
          status: activeStatus === 'all' ? undefined : activeStatus,
          search: searchQuery || undefined,
          cursor: cursor || undefined,
          limit: 24,
        },
        signal
      );
      setTickets(response.items);
      setTotalCount(response.count);
      setNextCursor(response.next_cursor ?? null);
    } catch (err: any) {
      if (err?.code !== 'ABORTED') {
        setErrorMsg(err?.message || 'Failed to load tickets.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch on filter change
  useEffect(() => {
    const controller = new AbortController();
    setCursorHistory([]);
    setCurrentCursorIndex(0);
    fetchTickets(null, controller.signal);
    return () => controller.abort();
  }, [activeStatus, searchQuery]);

  const handleStatusChange = (status: TicketStatus | 'all') => {
    const params = new URLSearchParams(searchParams);
    if (status === 'all') params.delete('status');
    else params.set('status', status);
    setSearchParams(params);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (localSearch.trim()) params.set('search', localSearch.trim());
    else params.delete('search');
    setSearchParams(params);
  };

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, nextCursor]);
    setCurrentCursorIndex((prev) => prev + 1);
    fetchTickets(nextCursor);
  };

  const handlePrevPage = () => {
    if (currentCursorIndex <= 0) return;
    const newIndex = currentCursorIndex - 1;
    const prevCursor = newIndex === 0 ? null : cursorHistory[newIndex - 1];
    setCurrentCursorIndex(newIndex);
    fetchTickets(prevCursor);
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Maintenance Tickets</h1>
          <p className={styles.subtitle}>
            Browse, search, and monitor all requests reported by your account.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/tickets/new')}
          icon={<PlusIcon size={16} />}
        >
          New Ticket
        </Button>
      </div>

      {/* Overdue alert banner — shown when any active ticket is past its deadline */}
      {tickets.some((t) => t.overdue) && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: '1.5px solid #F59E0B',
            borderRadius: '10px',
            padding: '0.875rem 1.125rem',
            marginBottom: '0.5rem',
            fontSize: '0.9rem',
            color: '#78350F',
            fontWeight: 500,
            animation: 'overdueSlideIn 0.4s ease',
          }}
        >
          <AlertTriangleIcon size={20} style={{ color: '#D97706', flexShrink: 0 }} />
          <span>
            <strong>⚠️ Overdue Alert:</strong>{' '}
            {tickets.filter((t) => t.overdue).length === 1
              ? 'One of your tickets has passed its resolution deadline and remains unresolved.'
              : `${tickets.filter((t) => t.overdue).length} of your tickets have passed their resolution deadlines and remain unresolved.`}
            {' '}Please follow up with the maintenance team.
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
          <Input
            placeholder="Search by title, description or #ID..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            iconLeft={<SearchIcon size={16} />}
          />
        </form>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            className={`${styles.tab} ${activeStatus === 'all' ? styles.tabActive : ''}`}
            onClick={() => handleStatusChange('all')}
          >
            All Tickets
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeStatus === 'open' ? styles.tabActive : ''}`}
            onClick={() => handleStatusChange('open')}
          >
            Open
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeStatus === 'resolved' ? styles.tabActive : ''}`}
            onClick={() => handleStatusChange('resolved')}
          >
            Resolved
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeStatus === 'acknowledged' ? styles.tabActive : ''}`}
            onClick={() => handleStatusChange('acknowledged')}
          >
            Acknowledged
          </button>
        </div>
      </div>

      {/* Tickets Display */}
      {isLoading ? (
        <div className={styles.ticketGrid}>
          <TicketCardSkeleton />
          <TicketCardSkeleton />
          <TicketCardSkeleton />
          <TicketCardSkeleton />
          <TicketCardSkeleton />
          <TicketCardSkeleton />
        </div>
      ) : errorMsg ? (
        <EmptyState
          icon={<AlertTriangleIcon size={28} />}
          title="Could Not Fetch Tickets"
          description={errorMsg}
          action={
            <Button variant="outline" size="sm" onClick={() => fetchTickets()}>
              Retry Request
            </Button>
          }
        />
      ) : tickets.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No Matching Tickets Found' : 'No Tickets Under This Category'}
          description={
            searchQuery
              ? `No tickets matched query "${searchQuery}". Clear search or adjust status filters.`
              : 'There are currently no tickets matching the selected status filter.'
          }
          action={
            searchQuery ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLocalSearch('');
                  handleStatusChange('all');
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/tickets/new')}
                icon={<PlusIcon size={16} />}
              >
                Report a Maintenance Issue
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className={styles.ticketGrid}>
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={(t) => navigate(`/tickets/${t.id}`)}
              />
            ))}
          </div>

          <Pagination
            currentCount={tickets.length}
            totalCount={totalCount}
            hasNextPage={Boolean(nextCursor)}
            hasPrevPage={currentCursorIndex > 0}
            onNext={handleNextPage}
            onPrev={handlePrevPage}
            loading={isLoading}
          />
        </>
      )}
    </div>
  );
};
