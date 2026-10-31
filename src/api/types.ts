/**
 * FixIt — Master API & Domain Types
 * Strict typing adhering directly to CampusOS & FixIt backend specifications
 */

export type Role = 'student' | 'faculty' | 'office_staff' | 'admin';

export type TicketStatus = 'open' | 'resolved' | 'acknowledged';

export type TimelineStage = 'reported' | 'under_review' | 'in_progress' | 'resolved' | 'closed';

export interface TicketTimelineEvent {
  id: string;
  ticket_id: string;
  status: TimelineStage;
  stage_name: string;
  updated_by: string;
  user_role: Role;
  comment?: string;
  created_at: string; // ISO UTC timestamp
}

export interface CreateTimelineEventPayload {
  status: TimelineStage;
  comment?: string;
}

export interface TicketTimelineResponse {
  items: TicketTimelineEvent[];
  count: number;
}

export interface UserProfile {
  name: string;
  email_id: string;
  role: Role;
  dept?: string;
  phone?: string;
  avatar_url?: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: number; // timestamp in ms (12h expiration)
  user: {
    id: string; // email_id is used as key
    name: string;
    email: string;
    role: Role;
    dept?: string;
  };
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // in seconds (e.g. 43200 for 12 hours)
  profile: {
    role: Role;
    name: string;
    email_id: string;
    dept?: string;
  };
}

export interface IssueType {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TicketNote {
  note: string;
  created_at: string;
  author_name?: string;
  author_role?: string;
  status_at_note?: TicketStatus;
}

export interface Ticket {
  id: string; // or ticket_id
  ticket_id?: string;
  title: string;
  description: string;
  issue_type_id: string;
  issue_type?: IssueType | string;
  status: TicketStatus;
  photo_url?: string;
  created_at: string; // UTC ISO timestamp
  updated_at?: string; // UTC ISO timestamp
  expected_by?: string; // YYYY-MM-DD
  overdue?: boolean; // authoritative indicator from backend
  resolved_at?: string;
  acknowledged_at?: string;
  reopened_at?: string; // timestamp when ticket was reopened by reporter

  maintenance_note?: string; // latest maintenance update note
  notes?: TicketNote[];
  reporter_id?: string;
  reporter_name?: string;
  reporter_email?: string;
  reporter_dept?: string;
}

export interface PaginatedTicketsResponse {
  items: Ticket[];
  count: number;
  next_cursor?: string | null;
}

export interface IssueTypesResponse {
  items: IssueType[];
  count?: number;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  issue_type_id: string;
  photo?: File | null;
}

export interface UpdateTicketPayload {
  title?: string;
  description?: string;
  issue_type_id?: string;
  photo?: File | null;
  remove_photo?: boolean;
  photo_url?: string | null;
}

export interface UpdateStatusPayload {
  status: 'open' | 'resolved';
  note: string; // A short maintenance note is required
  photo?: File; // optional photo for status update (e.g., resolution image)
}

export interface UpdateTATPayload {
  expected_by: string; // YYYY-MM-DD format
  note?: string;
}

export interface CreateIssueTypePayload {
  name: string;
  description?: string;
}

export interface UpdateIssueTypePayload {
  name?: string;
  description?: string;
}

export interface TicketFilters {
  status?: TicketStatus | 'all';
  issue_type_id?: string;
  overdue?: boolean;
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export interface SystemStats {
  total: number;
  open: number;
  resolved: number;
  acknowledged: number;
  overdue: number;
}
