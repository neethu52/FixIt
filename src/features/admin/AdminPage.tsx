// AdminPage.tsx – Revised implementation with Accept, Replace Photo, Solve, Raise Ticket, and Set Deadline actions
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import styles from './AdminPage.module.css';
import {
  getTickets,
  deleteTicket,
  updateTicket,
  updateTicketStatus,
  addTimelineEvent,
  createTicket,
  updateTicketTAT,
} from '@/api/fixit.api';
import type { Ticket } from '@/api/types';
import {
  Button,
  Badge,
  Modal,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  Pagination,
  useToast,
} from '@/components/ui';
import { ShieldIcon, TrashIcon, AlertTriangleIcon, ImageIcon, EyeIcon, XIcon, CalendarIcon } from '@/components/icons';
import { formatDateToIST, formatDateOnlyIST, getTodayDateString } from '@/utils/date';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // Core data
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal / UI state
  const [inspectingTicket, setInspectingTicket] = useState<Ticket | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [deletingTicket, setDeletingTicket] = useState<Ticket | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin action loading flags
  const [isAccepting, setIsAccepting] = useState(false);
  const [isReplacingPhoto, setIsReplacingPhoto] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [isRaisingTicket, setIsRaisingTicket] = useState(false);
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);

  // Deadline setter state
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineNote, setDeadlineNote] = useState('');
  const [isSettingDeadline, setIsSettingDeadline] = useState(false);

  // Track which ticket IDs we've already notified about re-opens
  const notifiedReopenIds = useRef<Set<string>>(new Set());

  // -------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------
  const fetchTickets = async (cursor: string | null = null, signal?: AbortSignal) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await getTickets({ limit: 50, cursor: cursor ?? undefined }, signal);
      setTickets(response.items);
      setTotalCount(response.count);
      setNextCursor(response.next_cursor ?? null);
    } catch (err: any) {
      if (err?.code !== 'ABORTED') {
        setErrorMsg(err?.message || 'Failed to fetch tickets in admin view.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchTickets(null, controller.signal);
    return () => controller.abort();
  }, []);

  // -------------------------------------------------------------------
  // Poll for reopened tickets — show admin toast popup every 20 seconds
  // -------------------------------------------------------------------
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const checkForReopens = async () => {
      try {
        // Fetch open tickets and look for ones with reopened_at set
        const response = await getTickets({ status: 'open', limit: 50 });
        const reopened = response.items.filter((t: any) => t.reopened_at);
        for (const ticket of reopened) {
          if (!notifiedReopenIds.current.has(ticket.id)) {
            notifiedReopenIds.current.add(ticket.id);
            toast.error(
              '⚠️ Unresolved Issue Raised Again',
              `Ticket #${ticket.id.slice(-6).toUpperCase()} — "${ticket.title}" has been raised again by the student.`
            );
            // Refresh the admin list so the ticket appears updated
            setTickets((prev) =>
              prev.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t))
            );
          }
        }
      } catch {
        // Silent fail for background poll
      }
    };

    // Run immediately and then every 20 seconds
    checkForReopens();
    intervalId = setInterval(checkForReopens, 20000);

    return () => clearInterval(intervalId);
  }, []);

  // -------------------------------------------------------------------
  // Action Handlers
  // -------------------------------------------------------------------
  const handleAccept = async () => {
    if (!inspectingTicket) return;
    setIsAccepting(true);
    try {
      await addTimelineEvent(inspectingTicket.id, {
        status: 'under_review',
        comment: 'Ticket accepted by administrator.',
      });
      // Refresh list and modal data
      fetchTickets(nextCursor);
      toast.success('Ticket Accepted', 'Moved to Under Review.');
    } catch (err: any) {
      toast.error('Accept Failed', err?.message || 'Could not accept ticket.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReplacePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!inspectingTicket) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReplacingPhoto(true);
    try {
      const updated = await updateTicket(inspectingTicket.id, { photo: file });
      setInspectingTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success('Photo Replaced', 'Ticket photograph updated.');
    } catch (err: any) {
      toast.error('Replace Failed', err?.message || 'Could not replace photo.');
    } finally {
      setIsReplacingPhoto(false);
      if (replacePhotoInputRef.current) replacePhotoInputRef.current.value = '';
    }
  };

  const handleSolve = async () => {
    if (!inspectingTicket) return;
    setIsSolving(true);
    try {
      await updateTicketStatus(inspectingTicket.id, {
        status: 'resolved',
        note: 'Issue resolved by admin.',
      });
      fetchTickets(nextCursor);
      toast.success('Ticket Resolved', 'Status set to Resolved.');
    } catch (err: any) {
      toast.error('Resolve Failed', err?.message || 'Could not resolve ticket.');
    } finally {
      setIsSolving(false);
    }
  };

  const handleRaiseTicket = async () => {
    if (!inspectingTicket) return;
    setIsRaisingTicket(true);
    try {
      const newTicket = await createTicket({
        title: `Re‑opened: ${inspectingTicket.title}`,
        description: inspectingTicket.description,
        issue_type_id: inspectingTicket.issue_type_id,
        // No photo attached initially
      });
      setTickets((prev) => [newTicket, ...prev]);
      toast.success('New Ticket Raised', 'Follow‑up ticket created.');
    } catch (err: any) {
      toast.error('Raise Ticket Failed', err?.message || 'Could not raise ticket.');
    } finally {
      setIsRaisingTicket(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTicket) return;
    setIsDeleting(true);
    try {
      await deleteTicket(deletingTicket.id);
      setTickets((prev) => prev.filter((t) => t.id !== deletingTicket.id));
      if (inspectingTicket?.id === deletingTicket.id) setInspectingTicket(null);
      setDeletingTicket(null);
      toast.success('Ticket Deleted', 'Admin removed the ticket.');
    } catch (err: any) {
      toast.error('Delete Failed', err?.message || 'Could not delete ticket.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDeadline = async () => {
    if (!inspectingTicket || !deadlineDate) return;
    setIsSettingDeadline(true);
    try {
      const updated = await updateTicketTAT(inspectingTicket.id, {
        expected_by: deadlineDate,
        note: deadlineNote.trim() || undefined,
      });
      // Update both the modal ticket and the list
      setInspectingTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setShowDeadlineModal(false);
      setDeadlineDate('');
      setDeadlineNote('');
      toast.success(
        '⏰ Deadline Set',
        `Ticket #${updated.id.slice(-6).toUpperCase()} must be resolved by ${deadlineDate}. Student will see an overdue alert if it's missed.`
      );
    } catch (err: any) {
      toast.error('Deadline Failed', err?.message || 'Could not set deadline.');
    } finally {
      setIsSettingDeadline(false);
    }
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6D28D9', marginBottom: '0.25rem' }}>
            <ShieldIcon size={20} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              System Administrator Mode
            </span>
          </div>
          <h1 className={styles.title}>FixIt Ticket Administration</h1>
          <p className={styles.subtitle}>Read‑only platform inspection, photo auditing, and emergency ticket deletion.</p>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.tableCard} style={{ padding: '2rem' }}>
          <Skeleton width="100%" height={48} borderRadius={8} />
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Skeleton width="100%" height={40} borderRadius={6} />
            <Skeleton width="100%" height={40} borderRadius={6} />
            <Skeleton width="100%" height={40} borderRadius={6} />
          </div>
        </div>
      ) : errorMsg ? (
        <EmptyState
          icon={<AlertTriangleIcon size={28} />}
          title="Could Not Load Admin View"
          description={errorMsg}
          action={<Button variant="outline" size="sm" onClick={() => fetchTickets()}>Retry</Button>}
        />
      ) : tickets.length === 0 ? (
        <EmptyState title="No Tickets Found" description="There are currently no maintenance tickets logged in the system." />
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Ticket ID</th>
                <th className={styles.th}>Photograph</th>
                <th className={styles.th}>Issue Title</th>
                <th className={styles.th}>Reporter</th>
                <th className={styles.th}>Reported At</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const categoryName = typeof ticket.issue_type === 'object' && ticket.issue_type !== null
                  ? ticket.issue_type.name
                  : ticket.issue_type || 'General Maintenance';
                return (
                  <tr key={ticket.id} className={styles.tr}>
                    <td className={`${styles.td} ${styles.idCol}`}>#{ticket.id.slice(-6).toUpperCase()}</td>
                    <td className={styles.td}>
                      {ticket.photo_url ? (
                        <div className={styles.photoThumbContainer} onClick={() => setLightboxPhoto(ticket.photo_url || null)} title="Click to view full photo in lightbox">
                          <img src={ticket.photo_url} alt={ticket.title} className={styles.photoThumb} loading="lazy" onError={(e) => {(e.currentTarget as HTMLElement).style.display = 'none';}} />
                          <div className={styles.thumbHoverBadge}><EyeIcon size={14} /></div>
                        </div>
                      ) : (
                        <span className={styles.noPhotoTag}><ImageIcon size={13} /> None</span>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.titleCol}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span>{ticket.title}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{categoryName}</span>
                      </div>
                    </td>
                    <td className={styles.td}>{ticket.reporter_name || ticket.reporter_email || 'Reporter'}</td>
                    <td className={styles.td}>{formatDateToIST(ticket.created_at)}</td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        {(ticket as any).reopened_at && <Badge variant="overdue">Re-Opened</Badge>}
                        {ticket.overdue && <Badge variant="overdue">Overdue</Badge>}
                        <Badge status={ticket.status}>{ticket.status}</Badge>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <Button variant="ghost" size="sm" onClick={() => setInspectingTicket(ticket)} icon={<EyeIcon size={14} />}>Inspect</Button>
                        <Button variant="danger" size="sm" onClick={() => setDeletingTicket(ticket)} icon={<TrashIcon size={14} />}>Delete</Button>
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
              onNext={() => { if (nextCursor) fetchTickets(nextCursor); }}
              loading={isLoading}
            />
          </div>
        </div>
      )}

      {/* Admin Ticket Inspection Modal */}
      {inspectingTicket && (
        <Modal
          isOpen={Boolean(inspectingTicket)}
          onClose={() => setInspectingTicket(null)}
          title={`Audit Inspection — Ticket #${inspectingTicket.id.slice(-6).toUpperCase()}`}
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              {/* Left side action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="primary" size="sm" onClick={handleAccept} loading={isAccepting}>Accept</Button>
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} ref={replacePhotoInputRef} onChange={handleReplacePhoto} />
                <Button variant="outline" size="sm" onClick={() => replacePhotoInputRef.current?.click()} loading={isReplacingPhoto}>Replace Photo</Button>
                <Button variant="primary" size="sm" onClick={handleSolve} loading={isSolving}>Solved</Button>
                <Button variant="secondary" size="sm" onClick={handleRaiseTicket} loading={isRaisingTicket}>Raise Ticket</Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<CalendarIcon size={14} />}
                  onClick={() => {
                    setDeadlineDate(inspectingTicket.expected_by || getTodayDateString());
                    setDeadlineNote('');
                    setShowDeadlineModal(true);
                  }}
                >
                  Set Deadline
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeletingTicket(inspectingTicket)} loading={isDeleting}>Delete Ticket</Button>
              </div>
              {/* Right side navigation */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="outline" size="sm" onClick={() => navigate(`/tickets/${inspectingTicket.id}`)}>Full Page View</Button>
                <Button variant="primary" size="sm" onClick={() => setInspectingTicket(null)}>Close</Button>
              </div>
            </div>
          }
        >
          <div className={styles.modalBody}>
            {/* Photo */}
            {inspectingTicket.photo_url ? (
              <div className={styles.modalPhotoFrame}>
                <img src={inspectingTicket.photo_url} alt={inspectingTicket.title} className={styles.modalPhotoImg} onClick={() => setLightboxPhoto(inspectingTicket.photo_url || null)} title="Click to zoom in lightbox" />
                <div className={styles.modalPhotoBar}>
                  <span>Click image to open high‑resolution lightbox</span>
                  <Button variant="ghost" size="sm" style={{ color: '#FFFFFF', padding: '0.2rem 0.5rem', height: 'auto' }} onClick={() => setLightboxPhoto(inspectingTicket.photo_url || null)} icon={<EyeIcon size={12} />}>Zoom Lightbox</Button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '1.75rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border-subtle)' }}>
                <ImageIcon size={22} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>No photograph attached to this maintenance ticket</span>
              </div>
            )}

            {/* Details Grid */}
            <div className={styles.modalDetailGrid}>
              <div className={styles.modalDetailItem}>
                <span className={styles.modalDetailLabel}>Status &amp; Priority</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                  <Badge status={inspectingTicket.status}>{inspectingTicket.status}</Badge>
                  {inspectingTicket.overdue && <Badge variant="overdue">Overdue</Badge>}
                </div>
              </div>
              <div className={styles.modalDetailItem}>
                <span className={styles.modalDetailLabel}>Category</span>
                <span className={styles.modalDetailVal}>{
                  typeof inspectingTicket.issue_type === 'object' && inspectingTicket.issue_type !== null
                    ? inspectingTicket.issue_type.name
                    : inspectingTicket.issue_type || 'General Maintenance'
                }</span>
              </div>
              <div className={styles.modalDetailItem}>
                <span className={styles.modalDetailLabel}>Reported By</span>
                <span className={styles.modalDetailVal}>{inspectingTicket.reporter_name || 'Campus Member'} ({inspectingTicket.reporter_email || 'student@campus.edu'})</span>
              </div>
              <div className={styles.modalDetailItem}>
                <span className={styles.modalDetailLabel}>Reported Timestamp (IST)</span>
                <span className={styles.modalDetailVal}>{formatDateToIST(inspectingTicket.created_at)}</span>
              </div>
              {inspectingTicket.expected_by && (
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalDetailLabel}>Deadline Set by Admin</span>
                  <span className={styles.modalDetailVal} style={{ color: inspectingTicket.overdue ? 'var(--status-overdue-text)' : 'var(--color-success)', fontWeight: 700 }}>
                    {formatDateOnlyIST(inspectingTicket.expected_by)}
                    {inspectingTicket.overdue ? ' ⚠️ OVERDUE' : ''}
                  </span>
                </div>
              )}
              {inspectingTicket.resolved_at && (
                <div className={styles.modalDetailItem}>
                  <span className={styles.modalDetailLabel}>Resolved At</span>
                  <span className={styles.modalDetailVal}>{formatDateToIST(inspectingTicket.resolved_at)}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className={styles.modalDescBox}>
              <span className={styles.modalDetailLabel}>Issue Title &amp; Description</span>
              <strong style={{ fontSize: '1rem', color: 'var(--color-text-primary)' }}>{inspectingTicket.title}</strong>
              <div className={styles.modalDescText}>{inspectingTicket.description}</div>
            </div>
            {inspectingTicket.maintenance_note && (
              <div className={styles.modalDescBox}>
                <span className={styles.modalDetailLabel}>Latest Maintenance Update / Technician Notes</span>
                <div className={styles.modalDescText} style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' }}>{inspectingTicket.maintenance_note}</div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className={styles.lightboxBackdrop} onClick={() => setLightboxPhoto(null)} role="dialog" aria-label="Enlarged photo preview">
          <button type="button" className={styles.lightboxCloseBtn} onClick={() => setLightboxPhoto(null)} aria-label="Close photo preview"><XIcon size={22} /></button>
          <img src={lightboxPhoto} alt="Enlarged issue defect preview" className={styles.lightboxImage} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingTicket && (
        <ConfirmDialog
          isOpen={Boolean(deletingTicket)}
          onClose={() => setDeletingTicket(null)}
          onConfirm={handleDelete}
          title="Delete Ticket (Admin)"
          message={`Are you sure you want to administratively delete ticket #${deletingTicket.id.slice(-6).toUpperCase()} ("${deletingTicket.title}")? This action permanently removes the record from the database.`}
          confirmText="Permanently Delete"
          variant="danger"
          loading={isDeleting}
        />
      )}

      {/* Set Deadline Modal */}
      <Modal
        isOpen={showDeadlineModal}
        onClose={() => setShowDeadlineModal(false)}
        title="⏰ Set Resolution Deadline"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
            Set a deadline by which this issue must be resolved. If the ticket remains unresolved after this date,
            the student will see an <strong style={{ color: 'var(--status-overdue-text)' }}>⚠️ Overdue</strong> alert on their ticket.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--color-text-primary)' }}>
              Resolution Deadline *
            </label>
            <input
              type="date"
              value={deadlineDate}
              min={getTodayDateString()}
              onChange={(e) => setDeadlineDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: '1.5px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '0.9375rem',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--color-text-primary)' }}>
              Note for Student (optional)
            </label>
            <textarea
              value={deadlineNote}
              onChange={(e) => setDeadlineNote(e.target.value)}
              placeholder="e.g. Technician scheduled for visit next week..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: '1.5px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                resize: 'vertical',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" size="sm" onClick={() => setShowDeadlineModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSetDeadline}
              loading={isSettingDeadline}
              icon={<CalendarIcon size={14} />}
              disabled={!deadlineDate}
            >
              Confirm Deadline
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
