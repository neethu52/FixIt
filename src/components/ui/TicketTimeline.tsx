import React, { useState, useEffect } from 'react';
import styles from './TicketTimeline.module.css';
import { getTicketTimeline } from '@/api/fixit.api';
import type { TicketTimelineEvent, TimelineStage, TicketStatus } from '@/api/types';
import { CheckIcon, AlertTriangleIcon } from '../icons';
import { formatDateToIST, formatRelativeTime } from '@/utils/date';
import { Button } from './Button';

export interface TicketTimelineProps {
  ticketId: string;
  currentStatus: TicketStatus;
  refreshTrigger?: number;
  onRefresh?: () => void;
  className?: string;
}

interface StageDefinition {
  key: TimelineStage;
  label: string;
  defaultRole: string;
  upcomingHint: string;
}

const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    key: 'reported',
    label: 'Reported',
    defaultRole: 'Student / Reporter',
    upcomingHint: 'Issue reported to campus facility portal.',
  },
  {
    key: 'under_review',
    label: 'Under Review',
    defaultRole: 'Administrator / Reviewer',
    upcomingHint: 'Awaiting administrative verification and priority review.',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    defaultRole: 'Maintenance Staff',
    upcomingHint: 'Awaiting technician dispatch and physical repair work.',
  },
  {
    key: 'resolved',
    label: 'Resolved',
    defaultRole: 'Maintenance Staff',
    upcomingHint: 'Pending maintenance resolution and defect fix.',
  },
  {
    key: 'closed',
    label: 'Closed',
    defaultRole: 'Ticket Reporter',
    upcomingHint: 'Pending reporter closure and resolution confirmation.',
  },
];

export const TicketTimeline: React.FC<TicketTimelineProps> = ({
  ticketId,
  currentStatus,
  refreshTrigger = 0,
  className = '',
}) => {
  const [events, setEvents] = useState<TicketTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTimeline = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await getTicketTimeline(ticketId, signal);
      setEvents(data);
    } catch (err: any) {
      if (err?.code !== 'ABORTED') {
        setErrorMsg(err?.message || 'Failed to load ticket progress timeline.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchTimeline(controller.signal);
    return () => controller.abort();
  }, [ticketId, refreshTrigger, currentStatus]);

  // Determine which canonical stage index is the latest active milestone
  const stageKeys = STAGE_DEFINITIONS.map((s) => s.key);

  // Map each event to its stage
  const eventsByStage = new Map<TimelineStage, TicketTimelineEvent>();
  for (const ev of events) {
    eventsByStage.set(ev.status, ev);
  }

  // Also synthesize status matching if intermediate review events were bypassed
  let highestReachedIndex = 0;
  if (events.length > 0) {
    for (let i = stageKeys.length - 1; i >= 0; i--) {
      if (eventsByStage.has(stageKeys[i])) {
        highestReachedIndex = i;
        break;
      }
    }
  }

  // Fallback sync with ticket status
  if (currentStatus === 'acknowledged' && highestReachedIndex < 4) {
    highestReachedIndex = 4;
  } else if (currentStatus === 'resolved' && highestReachedIndex < 3) {
    highestReachedIndex = 3;
  }

  const isFullyClosed = currentStatus === 'acknowledged' || eventsByStage.has('closed');

  return (
    <section className={`${styles.timelineCard} ${className}`} aria-label="Ticket progress timeline">
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Ticket Progress</h2>
          <span className={styles.subtitle}>
            Live chronological milestones and maintenance transition history
          </span>
        </div>
        <div className={styles.liveBadge}>
          <span className={styles.pulseDot} aria-hidden="true" />
          <span>{isFullyClosed ? 'Closed & Verified' : 'Active Lifecycle'}</span>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className={styles.skeletonItem}>
              <div className={styles.skeletonNode} />
              <div className={styles.skeletonBody}>
                <div className={styles.skeletonBarLong} />
                <div className={styles.skeletonBarShort} />
              </div>
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#FEF2F2',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #FECACA',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#DC2626', fontWeight: 600 }}>
            <AlertTriangleIcon size={18} />
            <span>Could not load timeline events</span>
          </div>
          <span style={{ fontSize: '0.8125rem', color: '#991B1B' }}>{errorMsg}</span>
          <Button variant="outline" size="sm" onClick={() => fetchTimeline()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className={styles.timelineTrack}>
          {STAGE_DEFINITIONS.map((stageDef, index) => {
            const isLast = index === STAGE_DEFINITIONS.length - 1;
            const event = eventsByStage.get(stageDef.key);

            // Determine stage visual state:
            // - If stage index < highestReachedIndex: COMPLETED
            // - If stage index === highestReachedIndex:
            //     - If fully closed and this is closed: COMPLETED
            //     - Otherwise: CURRENT
            // - If stage index > highestReachedIndex: UPCOMING
            let stageState: 'completed' | 'current' | 'upcoming';
            if (index < highestReachedIndex) {
              stageState = 'completed';
            } else if (index === highestReachedIndex) {
              stageState = isFullyClosed ? 'completed' : 'current';
            } else {
              stageState = 'upcoming';
            }

            // Line style connecting to next stage
            const isLineCompleted = index < highestReachedIndex;

            return (
              <div key={stageDef.key} className={styles.timelineItem}>
                {/* Node & Connecting Line Column */}
                <div className={styles.nodeColumn}>
                  <div
                    className={`${styles.nodeCircle} ${
                      stageState === 'completed'
                        ? styles.nodeCompleted
                        : stageState === 'current'
                        ? styles.nodeCurrent
                        : styles.nodeUpcoming
                    }`}
                  >
                    {stageState === 'completed' ? (
                      <CheckIcon size={18} />
                    ) : stageState === 'current' ? (
                      <span className={styles.currentDot} />
                    ) : (
                      <span className={styles.upcomingDot} />
                    )}
                  </div>

                  {!isLast && (
                    <div
                      className={`${styles.connectingLine} ${
                        isLineCompleted ? styles.lineCompleted : styles.linePending
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Content Details Area */}
                <div className={styles.contentArea}>
                  <div className={styles.stageHeaderRow}>
                    <span
                      className={`${styles.stageTitle} ${
                        stageState === 'completed'
                          ? styles.titleCompleted
                          : stageState === 'current'
                          ? styles.titleCurrent
                          : styles.titleUpcoming
                      }`}
                    >
                      {stageDef.label}
                    </span>

                    {stageState === 'current' && (
                      <span className={styles.currentPill}>Current Stage</span>
                    )}
                    {stageState === 'completed' && index === highestReachedIndex && isFullyClosed && (
                      <span className={styles.completedPill}>Completed</span>
                    )}
                  </div>

                  {event ? (
                    <>
                      <div className={styles.metaRow}>
                        <span className={styles.actorTag}>
                          <span>{stageDef.label === 'Reported' ? 'Submitted by' : 'Updated by'}</span>
                          <strong>{event.updated_by}</strong>
                          <span className={styles.roleChip}>
                            {event.user_role === 'office_staff' ? 'Maintenance' : event.user_role}
                          </span>
                        </span>
                        <span>•</span>
                        <span className={styles.relativeTime}>
                          {formatRelativeTime(event.created_at)}
                        </span>
                        <span>•</span>
                        <span className={styles.exactTime}>
                          ({formatDateToIST(event.created_at)})
                        </span>
                      </div>

                      {event.comment && (
                        <div
                          className={`${styles.commentBox} ${
                            stageState === 'completed' ? styles.commentCompleted : ''
                          }`}
                        >
                          "{event.comment}"
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.upcomingHint}>
                      {stageState === 'current'
                        ? 'Currently active. Maintenance actions underway.'
                        : stageDef.upcomingHint}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
