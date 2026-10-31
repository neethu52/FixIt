import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import styles from './MaintenanceWorkbenchPage.module.css';
import { getTickets } from '@/api/fixit.api';
import type { Ticket, TicketStatus } from '@/api/types';
import {
  Button,
  Input,
  Badge,
  EmptyState,
  Skeleton,
  Pagination,
} from '@/components/ui';
import {
  SearchIcon,
  AlertTriangleIcon,
  ImageIcon,
  EyeIcon,
  XIcon,
  DownloadIcon,
} from '@/components/icons';
import { formatDateToIST, formatDateOnlyIST } from '@/utils/date';
import { downloadIssueMedia } from '@/utils/download';
import { UpdateStatusModal } from './UpdateStatusModal';
import { UpdateTATModal } from './UpdateTATModal';

export const MaintenanceWorkbenchPage: React.FC = () => {
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

  // Quick Action Modals
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<'open' | 'resolved'>('resolved');
  const [isTATModalOpen, setIsTATModalOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const fetchTickets = async (cursor: string | null = null, signal?: AbortSignal) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await getTickets(
        {
          status: activeStatus === 'all' ? undefined : activeStatus,
          search: searchQuery || undefined,
          cursor: cursor || undefined,
          limit: 25,
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

  const handleTicketUpdated = (updated: Ticket) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Ticket Operations Workbench</h1>
          <p className={styles.subtitle}>
            Execute rapid status transitions, dispatch progress updates, and enforce SLA turnarounds.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
          <Input
            placeholder="Search by ticket ID, title, or reporter..."
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
            All Logs
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeStatus === 'open' ? styles.tabActive : ''}`}
            onClick={() => handleStatusChange('open')}
          >
            Open Queue
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

      {/* Table Area */}
      {isLoading ? (
        <div className={styles.tableCard} style={{ padding: '2rem' }}>
          <Skeleton width="100%" height={40} borderRadius={8} />
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Skeleton width="100%" height={48} borderRadius={6} />
            <Skeleton width="100%" height={48} borderRadius={6} />
            <Skeleton width="100%" height={48} borderRadius={6} />
            <Skeleton width="100%" height={48} borderRadius={6} />
          </div>
        </div>
      ) : errorMsg ? (
        <EmptyState
          icon={<AlertTriangleIcon size={28} />}
          title="Could Not Fetch Workbench Records"
          description={errorMsg}
          action={
            <Button variant="outline" size="sm" onClick={() => fetchTickets()}>
              Retry
            </Button>
          }
        />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No Tickets Found"
          description="There are currently no maintenance tickets matching your active filters."
          action={
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('all')}>
              Show All Tickets
            </Button>
          }
        />
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Ticket ID</th>
                <th className={styles.th}>Defect Photo</th>
                <th className={styles.th}>Issue Title</th>
                <th className={styles.th}>Category</th>
                <th className={styles.th}>Reporter</th>
                <th className={styles.th}>Submitted</th>
                <th className={styles.th}>Target SLA</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const categoryName = typeof ticket.issue_type === 'object' && ticket.issue_type !== null
                  ? ticket.issue_type.name
                  : ticket.issue_type || 'General Maintenance';

                const isOpen = ticket.status === 'open';

                return (
                  <tr key={ticket.id} className={styles.tr}>
                    <td className={`${styles.td} ${styles.idCol}`}>
                      #{ticket.id.slice(-6).toUpperCase()}
                    </td>
                    <td className={styles.td}>
                      {ticket.photo_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div
                            className={styles.photoThumbContainer}
                            onClick={() => setLightboxPhoto(ticket.photo_url || null)}
                            title="Click to view defect photo in lightbox"
                          >
                            <img
                              src={ticket.photo_url}
                              alt={ticket.title}
                              className={styles.photoThumb}
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className={styles.thumbHoverBadge}>
                              <EyeIcon size={14} />
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.miniDownloadBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadIssueMedia(ticket.photo_url!, `defect-ticket-${ticket.id}`);
                            }}
                            title="Download issue photo"
                            aria-label="Download issue photo"
                          >
                            <DownloadIcon size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className={styles.noPhotoTag}>
                          <ImageIcon size={13} /> None
                        </span>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.titleCol}`}>{ticket.title}</td>
                    <td className={styles.td}>
                      <Badge variant="category" showDot={false}>
                        {categoryName}
                      </Badge>
                    </td>
                    <td className={styles.td}>
                      {ticket.reporter_name || ticket.reporter_email || 'Reporter'}
                    </td>
                    <td className={styles.td}>{formatDateToIST(ticket.created_at)}</td>
                    <td className={styles.td}>
                      {ticket.expected_by ? (
                        <span style={{ color: ticket.overdue ? 'var(--status-overdue-text)' : 'inherit', fontWeight: ticket.overdue ? 700 : 500 }}>
                          {formatDateOnlyIST(ticket.expected_by)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>Not set</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        {ticket.overdue && <Badge variant="overdue">Overdue</Badge>}
                        <Badge status={ticket.status}>{ticket.status}</Badge>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actionsCol}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          title="Open Ticket Details"
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setIsTATModalOpen(true);
                          }}
                          title="Set Turnaround SLA Target"
                        >
                          TAT
                        </Button>
                        {isOpen ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setStatusTarget('resolved');
                              setIsStatusModalOpen(true);
                            }}
                          >
                            Resolve
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setStatusTarget('open');
                              setIsStatusModalOpen(true);
                            }}
                          >
                            Reopen
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ padding: '0 1.25rem 0.5rem' }}>
            <Pagination
              currentCount={tickets.length}
              totalCount={totalCount}
              hasNextPage={Boolean(nextCursor)}
              hasPrevPage={currentCursorIndex > 0}
              onNext={() => {
                if (!nextCursor) return;
                setCursorHistory((prev) => [...prev, nextCursor]);
                setCurrentCursorIndex((prev) => prev + 1);
                fetchTickets(nextCursor);
              }}
              onPrev={() => {
                if (currentCursorIndex <= 0) return;
                const newIndex = currentCursorIndex - 1;
                const prev = newIndex === 0 ? null : cursorHistory[newIndex - 1];
                setCurrentCursorIndex(newIndex);
                fetchTickets(prev);
              }}
              loading={isLoading}
            />
          </div>
        </div>
      )}

      {/* Action Modals */}
      {selectedTicket && (
        <>
          <UpdateStatusModal
            isOpen={isStatusModalOpen}
            onClose={() => {
              setIsStatusModalOpen(false);
              setSelectedTicket(null);
            }}
            ticket={selectedTicket}
            targetStatus={statusTarget}
            onSuccess={handleTicketUpdated}
          />
          <UpdateTATModal
            isOpen={isTATModalOpen}
            onClose={() => {
              setIsTATModalOpen(false);
              setSelectedTicket(null);
            }}
            ticket={selectedTicket}
            onSuccess={handleTicketUpdated}
          />
        </>
      )}

      {/* Fullscreen Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className={styles.lightboxBackdrop}
          onClick={() => setLightboxPhoto(null)}
          role="dialog"
          aria-label="Enlarged defect photo preview"
        >
          <div className={styles.lightboxTopBar} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadIssueMedia(lightboxPhoto, 'fixit-defect-photo')}
              icon={<DownloadIcon size={15} />}
              style={{
                backgroundColor: 'rgba(25, 22, 30, 0.75)',
                borderColor: 'rgba(255, 255, 255, 0.25)',
                color: '#FFFFFF',
                backdropFilter: 'blur(12px)',
              }}
            >
              Download Defect Photo
            </Button>
            <button
              type="button"
              className={styles.lightboxCloseBtn}
              onClick={() => setLightboxPhoto(null)}
              aria-label="Close photo preview"
            >
              <XIcon size={22} />
            </button>
          </div>
          <img
            src={lightboxPhoto}
            alt="Enlarged issue defect preview"
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
