/**
 * CampusOS FixIt Operations API
 * Strictly integrates with the organisers' `/api/v1/fixit` endpoints.
 */

import { apiRequest } from './client';
import type {
  Ticket,
  PaginatedTicketsResponse,
  TicketFilters,
  CreateTicketPayload,
  UpdateTicketPayload,
  UpdateStatusPayload,
  UpdateTATPayload,
  IssueType,
  IssueTypesResponse,
  CreateIssueTypePayload,
  UpdateIssueTypePayload,
  TicketTimelineEvent,
  CreateTimelineEventPayload,
  TicketTimelineResponse,
} from './types';

/**
 * Normalizes ticket object to ensure `id` and boolean/date attributes exist cleanly.
 */
function normalizeTicket(item: any): Ticket {
  if (!item) return item;
  return {
    ...item,
    id: item.id || item.ticket_id || '',
    overdue: Boolean(item.overdue),
  };
}

/**
 * Fetches tickets with cursor pagination and optional filters.
 * GET /api/v1/fixit/tickets
 */
export async function getTickets(
  filters: TicketFilters = {},
  signal?: AbortSignal
): Promise<PaginatedTicketsResponse> {
  const query = new URLSearchParams();

  if (filters.cursor) query.set('cursor', filters.cursor);
  if (filters.limit) query.set('limit', String(filters.limit));
  if (filters.status && filters.status !== 'all') query.set('status', filters.status);
  if (filters.issue_type_id) query.set('issue_type_id', filters.issue_type_id);
  if (filters.overdue !== undefined) query.set('overdue', String(filters.overdue));
  if (filters.search && filters.search.trim()) query.set('search', filters.search.trim());

  const queryString = query.toString();
  const endpoint = `/api/v1/fixit/tickets${queryString ? `?${queryString}` : ''}`;

  const data = await apiRequest<PaginatedTicketsResponse | { items: any[]; count?: number; next_cursor?: string }>(
    endpoint,
    { method: 'GET', signal }
  );

  const rawItems = Array.isArray(data?.items) ? data.items : [];
  return {
    items: rawItems.map(normalizeTicket),
    count: typeof data?.count === 'number' ? data.count : rawItems.length,
    next_cursor: data?.next_cursor ?? null,
  };
}

/**
 * Fetches an individual ticket by ID.
 * GET /api/v1/fixit/tickets/{ticket_id}
 */
export async function getTicketById(ticketId: string, signal?: AbortSignal): Promise<Ticket> {
  const data = await apiRequest<Ticket>(`/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'GET',
    signal,
  });
  return normalizeTicket(data);
}

/**
 * Creates a new maintenance ticket with multipart/form-data.
 * POST /api/v1/fixit/tickets
 */
export async function createTicket(payload: CreateTicketPayload, signal?: AbortSignal): Promise<Ticket> {
  const formData = new FormData();
  formData.append('title', payload.title.trim());
  formData.append('description', payload.description.trim());
  formData.append('issue_type_id', payload.issue_type_id);

  if (payload.photo) {
    formData.append('photo', payload.photo);
  }

  const data = await apiRequest<Ticket>('/api/v1/fixit/tickets', {
    method: 'POST',
    formData,
    signal,
  });

  return normalizeTicket(data);
}

/**
 * Updates an open ticket's details (reporter only while open).
 * PATCH /api/v1/fixit/tickets/{ticket_id}
 */
export async function updateTicket(
  ticketId: string,
  payload: UpdateTicketPayload,
  signal?: AbortSignal
): Promise<Ticket> {
  if (payload.photo || payload.remove_photo) {
    const formData = new FormData();
    if (payload.title !== undefined) formData.append('title', payload.title.trim());
    if (payload.description !== undefined) formData.append('description', payload.description.trim());
    if (payload.issue_type_id !== undefined) formData.append('issue_type_id', payload.issue_type_id);
    if (payload.photo) formData.append('photo', payload.photo);
    if (payload.remove_photo) formData.append('remove_photo', 'true');
    const data = await apiRequest<Ticket>(`/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'PATCH',
      formData,
      signal,
    });
    return normalizeTicket(data);
  }

  const data = await apiRequest<Ticket>(`/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    json: payload,
    signal,
  });
  return normalizeTicket(data);
}

/**
 * Deletes or withdraws an open ticket.
 * DELETE /api/v1/fixit/tickets/{ticket_id}
 */
export async function deleteTicket(ticketId: string, signal?: AbortSignal): Promise<void> {
  await apiRequest<void>(`/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'DELETE',
    signal,
  });
}

/**
 * Updates a ticket's status and submits the mandatory maintenance note.
 * PUT /api/v1/fixit/tickets/{ticket_id}/status
 *
 * Payload: { "status": "open" | "resolved", "note": "..." }
 */
export async function updateTicketStatus(
  ticketId: string,
  payload: UpdateStatusPayload,
  signal?: AbortSignal
): Promise<Ticket> {
  const data = await apiRequest<Ticket>(`/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: 'PUT',
    json: {
      status: payload.status,
      note: payload.note.trim(),
    },
    signal,
  });
  return normalizeTicket(data);
}

/**
 * Reporter acknowledges a resolved maintenance ticket.
 * POST /api/v1/fixit/tickets/{ticket_id}/acknowledge
 */
export async function acknowledgeTicket(
  ticketId: string,
  signal?: AbortSignal,
): Promise<Ticket> {
  const data = await apiRequest<Ticket>(
    `/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}/acknowledge`,
    { method: 'POST', signal },
  );
  return normalizeTicket(data);
}

/**
 * Student raises the issue again for a resolved ticket.
 * POST /api/v1/fixit/tickets/{ticket_id}/reopen
 */
export async function reopenTicket(
  ticketId: string,
  comment: string,
  signal?: AbortSignal,
): Promise<Ticket> {
  const formData = new FormData();
  formData.append('comment', comment);
  const data = await apiRequest<Ticket>(
    `/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}/reopen`,
    { method: 'POST', formData, signal },
  );
  return normalizeTicket(data);
}

/**
 * Sets or updates the Turnaround Time (TAT) deadline for a ticket.
 * PUT /api/v1/fixit/tickets/{ticket_id}/tat
 */
export async function updateTicketTAT(
  ticketId: string,
  payload: UpdateTATPayload,
  signal?: AbortSignal,
): Promise<Ticket> {
  const jsonBody: Record<string, string> = { expected_by: payload.expected_by };
  if (payload.note && payload.note.trim()) {
    jsonBody.note = payload.note.trim();
  }
  const data = await apiRequest<Ticket>(
    `/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}/tat`,
    { method: 'PUT', json: jsonBody, signal },
  );
  return normalizeTicket(data);
}


/**
 * Retrieves the list of active issue categories.
 * GET /api/v1/fixit/issue-types
 */
export async function getIssueTypes(signal?: AbortSignal): Promise<IssueType[]> {
  const data = await apiRequest<IssueTypesResponse | IssueType[]>('/api/v1/fixit/issue-types', {
    method: 'GET',
    signal,
  });

  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray((data as IssueTypesResponse).items)) {
    return (data as IssueTypesResponse).items;
  }
  return [];
}

/**
 * Creates a new issue type (Campus Maintenance only).
 * POST /api/v1/fixit/issue-types
 */
export async function createIssueType(
  payload: CreateIssueTypePayload,
  signal?: AbortSignal
): Promise<IssueType> {
  return apiRequest<IssueType>('/api/v1/fixit/issue-types', {
    method: 'POST',
    json: {
      name: payload.name.trim(),
      ...(payload.description ? { description: payload.description.trim() } : {}),
    },
    signal,
  });
}

/**
 * Updates an issue type (Campus Maintenance only).
 * PATCH /api/v1/fixit/issue-types/{issue_type_id}
 */
export async function updateIssueType(
  issueTypeId: string,
  payload: UpdateIssueTypePayload,
  signal?: AbortSignal
): Promise<IssueType> {
  return apiRequest<IssueType>(`/api/v1/fixit/issue-types/${encodeURIComponent(issueTypeId)}`, {
    method: 'PATCH',
    json: payload,
    signal,
  });
}

/**
 * Deletes an issue type (Campus Maintenance only).
 * DELETE /api/v1/fixit/issue-types/{issue_type_id}
 */
export async function deleteIssueType(issueTypeId: string, signal?: AbortSignal): Promise<void> {
  await apiRequest<void>(`/api/v1/fixit/issue-types/${encodeURIComponent(issueTypeId)}`, {
    method: 'DELETE',
    signal,
  });
}

/**
 * Fetches the historical lifecycle timeline events for a ticket.
 * GET /api/v1/fixit/tickets/{ticket_id}/timeline
 */
export async function getTicketTimeline(
  ticketId: string,
  signal?: AbortSignal
): Promise<TicketTimelineEvent[]> {
  const data = await apiRequest<TicketTimelineResponse | TicketTimelineEvent[]>(
    `/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}/timeline`,
    {
      method: 'GET',
      signal,
    }
  );

  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray((data as TicketTimelineResponse).items)) {
    return (data as TicketTimelineResponse).items;
  }
  return [];
}

/**
 * Appends a new stage milestone or audit comment to the ticket timeline.
 * POST /api/v1/fixit/tickets/{ticket_id}/timeline
 */
export async function addTimelineEvent(
  ticketId: string,
  payload: CreateTimelineEventPayload,
  signal?: AbortSignal
): Promise<TicketTimelineEvent> {
  return apiRequest<TicketTimelineEvent>(
    `/api/v1/fixit/tickets/${encodeURIComponent(ticketId)}/timeline`,
    {
      method: 'POST',
      json: payload,
      signal,
    }
  );
}
