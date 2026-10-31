import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import styles from './TicketDetailPage.module.css';
import { getTicketById, deleteTicket, acknowledgeTicket, updateTicket, reopenTicket } from '@/api/fixit.api';
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from '@/api/config';
import type { Ticket } from '@/api/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import {
  Button,
  Badge,
  Modal,
  TicketTimeline,
  ConfirmDialog,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import {
  ArrowLeftIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarIcon,
  AlertTriangleIcon,
  WrenchIcon,
  UserIcon,
  UploadIcon,
  ImageIcon,
  EyeIcon,
  VideoIcon,
  XIcon,
  DownloadIcon,
} from '@/components/icons';
import { formatDateToIST, formatDateOnlyIST } from '@/utils/date';
import { downloadIssueMedia } from '@/utils/download';
import { EditTicketModal } from './EditTicketModal';
import { UpdateStatusModal } from '../maintenance/UpdateStatusModal';
import { UpdateTATModal } from '../maintenance/UpdateTATModal';

export const TicketDetailPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user, isMaintenanceStaff, isAdmin } = useAuth();
  const toast = useToast();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletePhotoConfirmOpen, setIsDeletePhotoConfirmOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<'open' | 'resolved'>('resolved');
  const [isTATModalOpen, setIsTATModalOpen] = useState(false);

  // Lightbox
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Photo Uploading State
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Timeline Refresh Trigger
  const [timelineRefreshTrigger, setTimelineRefreshTrigger] = useState(0);

  // Action loadings
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isRaisingIssue, setIsRaisingIssue] = useState(false);
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [raiseComment, setRaiseComment] = useState('');

  const fetchTicket = async (signal?: AbortSignal) => {
    if (!ticketId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await getTicketById(ticketId, signal);
      setTicket(data);
    } catch (err: any) {
      if (err?.code !== 'ABORTED') {
        setErrorMsg(err?.message || 'Could not find or retrieve the requested maintenance ticket.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchTicket(controller.signal);
    return () => controller.abort();
  }, [ticketId]);

  useEffect(() => {
    setImageError(false);
  }, [ticket?.photo_url]);

  // Handle Reporter Deleting / Withdrawing Ticket
  const handleDeleteTicket = async () => {
    if (!ticket) return;
    setIsDeleting(true);
    try {
      await deleteTicket(ticket.id);
      toast.success('Ticket Withdrawn', 'Your maintenance ticket has been removed.');
      navigate('/tickets', { replace: true });
    } catch (err: any) {
      toast.error('Withdraw Failed', err?.message || 'Failed to delete ticket.');
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  // Handle Direct Photo Upload / Replace from Details Page
  const handleDirectPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ticket) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid Format', 'Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error('File Too Large', `Image size exceeds the ${MAX_UPLOAD_SIZE_MB}MB limit.`);
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const updated = await updateTicket(ticket.id, {
        photo: file,
      });
      setTicket(updated);
      toast.success('Photo Updated', 'Issue photograph has been attached successfully.');
    } catch (err: any) {
      toast.error('Upload Failed', err?.message || 'Could not update photo.');
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Handle Direct Photo Deletion
  const handleDeletePhoto = async () => {
    if (!ticket) return;
    setIsDeletingPhoto(true);
    try {
      const updated = await updateTicket(ticket.id, {
        remove_photo: true,
      });
      setTicket(updated);
      toast.success('Photo Deleted', 'The photograph was removed from this ticket.');
    } catch (err: any) {
      toast.error('Delete Failed', err?.message || 'Could not remove photo.');
    } finally {
      setIsDeletingPhoto(false);
      setIsDeletePhotoConfirmOpen(false);
    }
  };

  // Handle Reporter Acknowledging Resolved Ticket
  const handleAcknowledge = async () => {
    if (!ticket) return;
    setIsAcknowledging(true);
    try {
      const updated = await acknowledgeTicket(ticket.id);
      setTicket(updated);
      setTimelineRefreshTrigger((prev) => prev + 1);
      toast.success('Resolution Acknowledged', 'Thank you for confirming resolution of this issue.');
    } catch (err: any) {
      toast.error('Acknowledgement Failed', err?.message || 'Failed to acknowledge ticket.');
    } finally {
      setIsAcknowledging(false);
    }
  };

  // Handle Student Raising Issue Again
  const handleRaiseIssueAgain = async () => {
    if (!ticket) return;
    setIsRaisingIssue(true);
    try {
      const updated = await reopenTicket(ticket.id, raiseComment.trim() || 'Issue not resolved satisfactorily.');
      setTicket(updated);
      setTimelineRefreshTrigger((prev) => prev + 1);
      setShowRaiseModal(false);
      setRaiseComment('');
      toast.success('Issue Raised Again', 'Your concern has been submitted. The maintenance team will review it.');
    } catch (err: any) {
      toast.error('Failed to Raise Issue', err?.message || 'Could not raise the issue again.');
    } finally {
      setIsRaisingIssue(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Skeleton width={120} height={36} />
          <Skeleton width={160} height={28} />
        </div>
        <Skeleton width="100%" height={120} borderRadius={16} />
        <Skeleton width="100%" height={320} borderRadius={16} />
      </div>
    );
  }

  if (errorMsg || !ticket) {
    return (
      <div className={styles.container}>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} icon={<ArrowLeftIcon size={14} />}>
          Back
        </Button>
        <EmptyState
          icon={<AlertTriangleIcon size={32} />}
          title="Ticket Not Found"
          description={errorMsg || 'The requested ticket does not exist or you do not have permission to view it.'}
          action={
            <Button variant="primary" onClick={() => navigate('/tickets')}>
              Go to Ticket List
            </Button>
          }
        />
      </div>
    );
  }

  const categoryName = typeof ticket.issue_type === 'object' && ticket.issue_type !== null
    ? ticket.issue_type.name
    : ticket.issue_type || 'General Maintenance';

  const isOwner = Boolean(
    user && (ticket.reporter_id === user.id || ticket.reporter_email === user.email || !ticket.reporter_id)
  );

  const isOpen = ticket.status === 'open';
  const isResolved = ticket.status === 'resolved';

  return (
    <div className={styles.container}>
      {/* Top Bar with Navigation & Contextual Actions */}
      <div className={styles.topBar}>
        <div className={styles.ticketIdentity}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            icon={<ArrowLeftIcon size={14} />}
          >
            Back
          </Button>
          <span className={styles.ticketId}>#{ticket.id.slice(-6).toUpperCase()}</span>
          <Badge variant="category">{categoryName}</Badge>
          {ticket.overdue && <Badge variant="overdue">Overdue</Badge>}
        </div>

        <div className={styles.actionsGroup}>
          {/* Reporter Actions */}
          {isOpen && (isOwner || !isMaintenanceStaff) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                icon={<EditIcon size={14} />}
              >
                Edit Ticket
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsDeleteConfirmOpen(true)}
                icon={<TrashIcon size={14} />}
              >
                Withdraw Ticket
              </Button>
            </>
          )}

          {isResolved && (isOwner || !isMaintenanceStaff) && !ticket.reopened_at && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleAcknowledge}
              loading={isAcknowledging}
              icon={<CheckCircleIcon size={16} />}
            >
              Acknowledge Resolution
            </Button>
          )}

          {isResolved && isOwner && !isMaintenanceStaff && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRaiseModal(true)}
              icon={<AlertTriangleIcon size={14} />}
            >
              Raise Issue Again
            </Button>
          )}

          {/* Maintenance Staff Actions */}
          {isMaintenanceStaff && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTATModalOpen(true)}
                icon={<CalendarIcon size={14} />}
              >
                Set TAT Deadline
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusTarget('open');
                  setIsStatusModalOpen(true);
                }}
                icon={<ClockIcon size={14} />}
              >
                Add Progress Note
              </Button>
              {isOpen ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setStatusTarget('resolved');
                    setIsStatusModalOpen(true);
                  }}
                  icon={<CheckCircleIcon size={14} />}
                >
                  Mark as Resolved
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusTarget('open');
                    setIsStatusModalOpen(true);
                  }}
                  icon={<WrenchIcon size={14} />}
                >
                  Reopen Ticket
                </Button>
              )}
            </>
          )}

          {/* Admin Deletion Action */}
          {isAdmin && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsDeleteConfirmOpen(true)}
              icon={<TrashIcon size={14} />}
            >
              Delete (Admin)
            </Button>
          )}
        </div>
      </div>

      {/* Overdue alert banner inside ticket detail */}
      {ticket.overdue && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.875rem',
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: '2px solid #F59E0B',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            fontSize: '0.9375rem',
            color: '#78350F',
            fontWeight: 500,
            boxShadow: '0 2px 12px rgba(245,158,11,0.18)',
          }}
        >
          <AlertTriangleIcon size={22} style={{ color: '#D97706', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.2rem' }}>
              ⚠️ This issue is Overdue!
            </div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              The resolution deadline was <strong>{ticket.expected_by}</strong> and has passed without the issue being resolved.
              Please contact the maintenance team or raise the issue again.
            </div>
          </div>
        </div>
      )}

      {/* Main Ticket Layout */}
      <div className={styles.grid}>
        {/* Left Card: Core Information */}
        <section className={styles.mainCard}>
          <div className={styles.titleHeader}>
            <h1 className={styles.title}>{ticket.title}</h1>
            <div className={styles.metaRow}>
              <span>Reported {formatDateToIST(ticket.created_at)}</span>
              {ticket.reporter_name && <span>By {ticket.reporter_name}</span>}
              {ticket.updated_at && (
                <span>• Updated {formatDateToIST(ticket.updated_at)}</span>
              )}
            </div>
          </div>

          <div className={styles.descriptionBox}>
            <span className={styles.sectionLabel}>Problem Description & Location</span>
            <div className={styles.descriptionText}>{ticket.description}</div>
          </div>

          {/* Hidden File Input for Direct Photo Update */}
          <input
            type="file"
            ref={photoInputRef}
            style={{ display: 'none' }}
            accept="image/jpeg,image/png,image/webp"
            onChange={handleDirectPhotoUpload}
          />

          {/* Photo Management Section */}
          <div className={styles.photoBox}>
            <div className={styles.photoHeader}>
              <span className={styles.sectionLabel}>Attached Photograph</span>
              {isOpen && (isOwner || !isMaintenanceStaff) && ticket.photo_url && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                    loading={isUploadingPhoto}
                    icon={<UploadIcon size={14} />}
                  >
                    Replace Photo
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setIsDeletePhotoConfirmOpen(true)}
                    loading={isDeletingPhoto}
                    icon={<TrashIcon size={14} />}
                  >
                    Delete Photo
                  </Button>
                </div>
              )}
            </div>

            {ticket.photo_url && !imageError ? (
              ticket.photo_url.startsWith('data:video') ||
              ticket.photo_url.endsWith('.webm') ||
              ticket.photo_url.endsWith('.mp4') ||
              ticket.photo_url.includes('video/') ? (
                <div className={styles.photoFrame} style={{ padding: 0 }}>
                  <video
                    src={ticket.photo_url}
                    controls
                    playsInline
                    style={{ width: '100%', maxHeight: 440, borderRadius: 12, display: 'block', backgroundColor: '#000000' }}
                  />
                  <div className={styles.photoOverlayBar}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <VideoIcon size={14} style={{ color: 'var(--color-electric-cyan)' }} />
                      <span>Live Video Recording with Audio Playback</span>
                    </span>
                    <div className={styles.photoOverlayActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: '#FFFFFF' }}
                        onClick={() => downloadIssueMedia(ticket.photo_url!, `ticket-${ticket.id}-video`)}
                        icon={<DownloadIcon size={14} />}
                      >
                        Download Video
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.photoFrame}>
                  <img
                    src={ticket.photo_url}
                    alt={ticket.title}
                    className={styles.photoImg}
                    onClick={() => setIsLightboxOpen(true)}
                    onError={() => setImageError(true)}
                    title="Click to zoom in full resolution lightbox"
                  />
                  <div className={styles.photoOverlayBar}>
                    <span>Click image to view in full resolution</span>
                    <div className={styles.photoOverlayActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: '#FFFFFF' }}
                        onClick={() => downloadIssueMedia(ticket.photo_url!, `ticket-${ticket.id}-photo`)}
                        icon={<DownloadIcon size={14} />}
                      >
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: '#FFFFFF' }}
                        onClick={() => setIsLightboxOpen(true)}
                        icon={<EyeIcon size={14} />}
                      >
                        Lightbox
                      </Button>
                    </div>
                  </div>
                </div>
              )
            ) : ticket.photo_url && imageError ? (
              <div
                className={styles.emptyPhotoDropzone}
                style={{ borderStyle: 'solid', borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}
              >
                <AlertTriangleIcon size={28} style={{ color: '#DC2626' }} />
                <strong style={{ color: '#991B1B' }}>Photograph Preview Unavailable</strong>
                <span style={{ fontSize: '0.8125rem', color: '#B91C1C' }}>
                  The attached image could not be loaded. You can upload a replacement photo below.
                </span>
                {isOpen && (isOwner || !isMaintenanceStaff) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                    loading={isUploadingPhoto}
                    icon={<UploadIcon size={14} />}
                  >
                    Upload Replacement Photo
                  </Button>
                )}
              </div>
            ) : isOpen && (isOwner || !isMaintenanceStaff) ? (
              /* Add Photo Callout when none exists */
              <div
                className={styles.emptyPhotoDropzone}
                onClick={() => photoInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-electric-blue)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <ImageIcon size={22} />
                </div>
                <strong style={{ fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>
                  {isUploadingPhoto ? 'Uploading Photo...' : 'Add an Issue Photograph'}
                </strong>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Upload clear photos of the defect to assist campus repair teams.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ marginTop: '0.5rem' }}
                  loading={isUploadingPhoto}
                  icon={<UploadIcon size={14} />}
                >
                  Select Image
                </Button>
              </div>
            ) : (
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <ImageIcon size={18} />
                <span>No photograph was attached with this ticket.</span>
              </div>
            )}
          </div>

          {/* Interactive Ticket Progress Timeline */}
          <TicketTimeline
            ticketId={ticket.id}
            currentStatus={ticket.status}
            refreshTrigger={timelineRefreshTrigger}
          />
        </section>

        {/* Right Sidebar: Status, Deadlines & Notes */}
        <aside className={styles.sidebarCard}>
          <div className={styles.panelItem}>
            <span className={styles.panelLabel}>Current Status</span>
            <div>
              <Badge status={ticket.status}>{ticket.status}</Badge>
            </div>
          </div>

          <div className={styles.panelItem}>
            <span className={styles.panelLabel}>Target SLA Turnaround</span>
            <div className={styles.panelValue}>
              {ticket.expected_by ? formatDateOnlyIST(ticket.expected_by) : 'Not assigned yet'}
            </div>
            {ticket.overdue && (
              <span style={{ color: 'var(--status-overdue-text)', fontSize: '0.75rem', fontWeight: 700 }}>
                ⚠️ Official Overdue Status
              </span>
            )}
          </div>

          {ticket.maintenance_note && (
            <div className={styles.noteAlert}>
              <span className={styles.noteAlertTitle}>Latest Maintenance Note</span>
              <p className={styles.noteAlertText}>{ticket.maintenance_note}</p>
            </div>
          )}

          {ticket.reporter_email && (
            <div className={styles.panelItem}>
              <span className={styles.panelLabel}>Reporter Contact</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <UserIcon size={14} style={{ color: 'var(--color-text-muted)' }} />
                <span>{ticket.reporter_email}</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && ticket.photo_url && (
        <div
          className={styles.lightboxBackdrop}
          onClick={() => setIsLightboxOpen(false)}
          role="dialog"
          aria-label="Enlarged issue photograph"
        >
          <div className={styles.lightboxTopBar} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadIssueMedia(ticket.photo_url!, `ticket-${ticket.id}-photo`)}
              icon={<DownloadIcon size={15} />}
              style={{
                backgroundColor: 'rgba(25, 22, 30, 0.75)',
                borderColor: 'rgba(255, 255, 255, 0.25)',
                color: '#FFFFFF',
                backdropFilter: 'blur(12px)',
              }}
            >
              Download Original
            </Button>
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={() => setIsLightboxOpen(false)}
              aria-label="Close enlarged view"
            >
              <XIcon size={24} />
            </button>
          </div>
          <img
            src={ticket.photo_url}
            alt={ticket.title}
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Modals */}
      <EditTicketModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        ticket={ticket}
        onSuccess={(updated) => {
          setTicket(updated);
          setTimelineRefreshTrigger((prev) => prev + 1);
          toast.success('Ticket Updated', 'Maintenance ticket changes have been saved.');
        }}
      />

      <UpdateStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        ticket={ticket}
        targetStatus={statusTarget}
        onSuccess={(updated) => {
          setTicket(updated);
          setTimelineRefreshTrigger((prev) => prev + 1);
          toast.success(
            updated.status === 'resolved' ? 'Ticket Resolved' : 'Status Updated',
            'Maintenance update has been posted.'
          );
        }}
      />

      <UpdateTATModal
        isOpen={isTATModalOpen}
        onClose={() => setIsTATModalOpen(false)}
        ticket={ticket}
        onSuccess={(updated) => {
          setTicket(updated);
          setTimelineRefreshTrigger((prev) => prev + 1);
          toast.success('TAT Updated', 'Turnaround deadline has been recorded.');
        }}
      />

      {/* Confirm Ticket Withdrawal */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteTicket}
        title="Withdraw Ticket"
        message="Are you sure you want to delete or withdraw this maintenance ticket? This action cannot be undone."
        confirmText="Withdraw Ticket"
        variant="danger"
        loading={isDeleting}
      />

      {/* Confirm Photo Deletion */}
      <ConfirmDialog
        isOpen={isDeletePhotoConfirmOpen}
        onClose={() => setIsDeletePhotoConfirmOpen(false)}
        onConfirm={handleDeletePhoto}
        title="Delete Issue Photograph"
        message="Are you sure you want to remove the photograph from this maintenance ticket? You can always upload a new one while the ticket remains open."
        confirmText="Remove Photo"
        variant="danger"
        loading={isDeletingPhoto}
      />

      {/* Raise Issue Again Modal */}
      <Modal
        isOpen={showRaiseModal}
        onClose={() => { setShowRaiseModal(false); setRaiseComment(''); }}
        title="Raise Issue Again"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            If you believe this issue has not been properly resolved, you can raise it again.
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
              onClick={() => { setShowRaiseModal(false); setRaiseComment(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRaiseIssueAgain}
              loading={isRaisingIssue}
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
