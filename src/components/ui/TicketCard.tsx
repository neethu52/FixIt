import React from 'react';
import styles from './TicketCard.module.css';
import type { Ticket } from '@/api/types';
import { Badge } from './Badge';
import { CalendarIcon, ClockIcon, ImageIcon, AlertTriangleIcon, VideoIcon } from '../icons';
import { formatDateToIST, formatDateOnlyIST } from '@/utils/date';
import { truncateText } from '@/utils/format';

export interface TicketCardProps {
  ticket: Ticket;
  onClick: (ticket: Ticket) => void;
  className?: string;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onClick, className = '' }) => {
  const [imageError, setImageError] = React.useState(false);

  const categoryName = typeof ticket.issue_type === 'object' && ticket.issue_type !== null
    ? ticket.issue_type.name
    : ticket.issue_type || 'General Maintenance';

  const isOverdue = Boolean(ticket.overdue);

  return (
    <article
      className={`${styles.card} ${isOverdue ? styles.isOverdue : ''} ${className}`}
      onClick={() => onClick(ticket)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(ticket);
        }
      }}
      aria-label={`View ticket: ${ticket.title}`}
    >
      <div className={styles.header}>
        <div className={styles.ticketIdWrapper}>
          <span className={styles.ticketId}>#{ticket.id.slice(-6).toUpperCase()}</span>
          <Badge variant="category" showDot={false}>
            {categoryName}
          </Badge>
        </div>
        <div className={styles.badges}>
          {isOverdue && <Badge variant="overdue">Overdue</Badge>}
          <Badge status={ticket.status}>{ticket.status}</Badge>
        </div>
      </div>

      {/* Overdue alert banner — shown prominently inside the card */}
      {isOverdue && (
        <div className={styles.overdueAlert} role="alert">
          <AlertTriangleIcon size={15} />
          <span>
            ⚠️ <strong>Overdue!</strong> This issue was due by{' '}
            <strong>{formatDateOnlyIST(ticket.expected_by!)}</strong> and has not been resolved yet.
          </span>
        </div>
      )}

      <div className={styles.body}>
        {ticket.photo_url && !imageError ? (
          ticket.photo_url.startsWith('data:video') ||
          ticket.photo_url.endsWith('.webm') ||
          ticket.photo_url.endsWith('.mp4') ||
          ticket.photo_url.includes('video/') ? (
            <div className={styles.thumbnailWrapper} style={{ position: 'relative' }}>
              <video src={ticket.photo_url} className={styles.thumbnail} preload="metadata" />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.35)',
                  color: '#00F2FE',
                  borderRadius: 'inherit',
                }}
              >
                <VideoIcon size={20} />
              </div>
            </div>
          ) : (
            <div className={styles.thumbnailWrapper}>
              <img
                src={ticket.photo_url}
                alt={ticket.title}
                className={styles.thumbnail}
                loading="lazy"
                onError={() => setImageError(true)}
              />
            </div>
          )
        ) : (
          <div className={styles.thumbnailWrapper} aria-hidden="true" title="No photograph attached">
            <ImageIcon size={24} style={{ color: 'var(--color-text-muted)' }} />
          </div>
        )}

        <div className={styles.info}>
          <h3 className={styles.title}>{ticket.title}</h3>
          <p className={styles.description}>{truncateText(ticket.description, 140)}</p>
        </div>
      </div>

      {ticket.maintenance_note && (
        <div className={styles.notePreview}>
          <span className={styles.noteLabel}>Update:</span>
          <span>{truncateText(ticket.maintenance_note, 90)}</span>
        </div>
      )}

      <footer className={styles.footer}>
        <div className={styles.dateGroup}>
          <ClockIcon size={14} />
          <span>Reported {formatDateToIST(ticket.created_at)}</span>
        </div>

        {ticket.expected_by && (
          <div className={`${styles.expectedGroup} ${isOverdue ? styles.overdue : ''}`}>
            <CalendarIcon size={14} />
            <span>Due: {formatDateOnlyIST(ticket.expected_by)}</span>
          </div>
        )}
      </footer>
    </article>
  );
};
