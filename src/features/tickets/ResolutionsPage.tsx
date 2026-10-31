import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import styles from './ResolutionsPage.module.css';
import { getTickets, acknowledgeTicket, reopenTicket } from '@/api/fixit.api';
import type { Ticket } from '@/api/types';
import { Button, Badge, EmptyState, TicketCardSkeleton, Modal } from '@/components/ui';
import { CheckCircleIcon, ClockIcon, ArrowRightIcon, AlertTriangleIcon } from '@/components/icons';
import { formatDateToIST } from '@/utils/date';

export const ResolutionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [resolvedTickets, setResolvedTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Raise Issue Again state
  const [raiseTargetId, setRaiseTargetId] = useState<string | null>(null);
  const [raiseComment, setRaiseComment] = useState('');
  const [isRaising, setIsRaising] = useState(false);

  const fetchResolved = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Fetch tickets that are resolved or acknowledged
      const [resResolved, resAck] = await Promise.all([
        getTickets({ status: 'resolved', limit: 50 }, signal),
        getTickets({ status: 'acknowledged', limit: 50 }, signal),
      ]);
      const combined = [...resResolved.items, ...resAck.items];
      // Sort newest first
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setResolvedTickets(combined);
    } catch (err: any) {
      if (err?.code !== 'ABORTED') {
        setErrorMsg(err?.message || 'Failed to load resolved tickets.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchResolved(controller.signal);
    return () => controller.abort();
  }, []);

  const handleAcknowledge = async (ticketId: string) => {
    setAcknowledgingId(ticketId);
    try {
      const updated = await acknowledgeTicket(ticketId);
      setResolvedTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? updated : t))
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to acknowledge ticket.');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleRaiseIssueAgain = async () => {
    if (!raiseTargetId) return;
    setIsRaising(true);
    try {
      await reopenTicket(raiseTargetId, raiseComment.trim() || 'Issue not resolved satisfactorily.');
      // Remove from resolved list since it's now open again
      setResolvedTickets((prev) => prev.filter((t) => t.id !== raiseTargetId));
      setRaiseTargetId(null);
      setRaiseComment('');
    } catch (err: any) {
      alert(err?.message || 'Failed to raise issue again.');
    } finally {
      setIsRaising(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Resolution Center</h1>
        <p className={styles.subtitle}>
          Review completed repairs, inspect maintenance closure notes, and acknowledge satisfaction.
        </p>
      </div>

      {isLoading ? (
        <div className={styles.cardGrid}>
          <TicketCardSkeleton />
          <TicketCardSkeleton />
          <TicketCardSkeleton />
        </div>
      ) : errorMsg ? (
        <EmptyState
          icon={<CheckCircleIcon size={32} />}
          title="Could Not Fetch Resolutions"
          description={errorMsg}
          action={
            <Button variant="outline" size="sm" onClick={() => fetchResolved()}>
              Try Again
            </Button>
          }
        />
      ) : resolvedTickets.length === 0 ? (
        <EmptyState
          icon={<CheckCircleIcon size={36} />}
          title="No Resolved Tickets Yet"
          description="When maintenance completes repairs on your tickets, they will appear here for inspection and formal acknowledgement."
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/tickets')}>
              View Active Tickets
            </Button>
          }
        />
      ) : (
        <div className={styles.cardGrid}>
          {resolvedTickets.map((ticket) => {
            const isResolved = ticket.status === 'resolved';
            const wasReopened = Boolean((ticket as any).reopened_at);

            return (
              <div key={ticket.id} className={styles.resolutionCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.ticketId}>#{ticket.id.slice(-6).toUpperCase()}</span>
                  <Badge status={ticket.status}>{ticket.status}</Badge>
                </div>

                <h3 className={styles.cardTitle}>{ticket.title}</h3>

                {ticket.maintenance_note ? (
                  <div className={styles.noteContainer}>
                    <span className={styles.noteLabel}>Official Resolution Note</span>
                    <p className={styles.noteText}>{ticket.maintenance_note}</p>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    Repairs completed by Campus Maintenance team.
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {isResolved && !wasReopened ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => handleAcknowledge(ticket.id)}
                        loading={acknowledgingId === ticket.id}
                        icon={<CheckCircleIcon size={16} />}
                      >
                        Acknowledge Repair
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setRaiseTargetId(ticket.id); setRaiseComment(''); }}
                        icon={<AlertTriangleIcon size={14} />}
                        title="Raise issue again if not satisfied"
                      >
                        Raise Again
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      icon={<ArrowRightIcon size={14} />}
                    >
                      View Details
                    </Button>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <ClockIcon size={12} />
                    Reported {formatDateToIST(ticket.created_at)}
                  </span>
                  {ticket.resolved_at && (
                    <span>Resolved {formatDateToIST(ticket.resolved_at)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Raise Issue Again Modal */}
      <Modal
        isOpen={Boolean(raiseTargetId)}
        onClose={() => { setRaiseTargetId(null); setRaiseComment(''); }}
        title="Raise Issue Again"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            If the repair was not satisfactory, you can raise this issue again.
            The maintenance team will be notified and will review your concern.
          </p>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-text-primary)' }}>
              Describe the problem (optional)
            </label>
            <textarea
              value={raiseComment}
              onChange={(e) => setRaiseComment(e.target.value)}
              placeholder="E.g. The tap is still leaking after the repair..."
              rows={4}
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
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRaiseTargetId(null); setRaiseComment(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRaiseIssueAgain}
              loading={isRaising}
              icon={<AlertTriangleIcon size={14} />}
            >
              Submit & Raise Issue
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
