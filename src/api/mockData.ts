/**
 * FixIt — Local Mock Data & State Store
 * Provides flawless offline resilience when the backend server is starting or unreachable.
 * Persists dynamically in localStorage so user interactions (create, edit, status, TAT) are preserved.
 */

import type { Ticket, IssueType, TokenResponse, UserProfile, Role, TicketTimelineEvent, TimelineStage } from './types';
import { ApiError } from './errors';

const STORAGE_KEYS = {
  TICKETS: 'fixit_store:tickets',
  ISSUE_TYPES: 'fixit_store:issue_types',
  USERS: 'fixit_store:users',
  TIMELINE: 'fixit_store:timeline',
};

const INITIAL_ISSUE_TYPES: IssueType[] = [
  {
    id: 'it_plumbing',
    name: 'Plumbing & Water Supply',
    description: 'Pipes, faucets, restroom fixtures, water coolers, drainage, and leakage repairs.',
    active: true,
  },
  {
    id: 'it_electrical',
    name: 'Electrical & Power',
    description: 'Lighting, switchboards, circuit breakers, power outlets, and wiring faults.',
    active: true,
  },
  {
    id: 'it_hvac',
    name: 'HVAC & Climate Control',
    description: 'Air conditioners, ventilation fans, chillers, and heating systems.',
    active: true,
  },
  {
    id: 'it_carpentry',
    name: 'Carpentry & Furniture',
    description: 'Doors, windows, desks, chairs, locks, cupboards, and partition repairs.',
    active: true,
  },
  {
    id: 'it_civil',
    name: 'Civil & Infrastructure',
    description: 'Masonry, flooring, ceiling tiles, roof maintenance, and structural repairs.',
    active: true,
  },
  {
    id: 'it_network',
    name: 'Network & Smart Fixtures',
    description: 'Projector mounts, smart board fittings, AV cabling, and Wi-Fi access point fixtures.',
    active: true,
  },
];

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'tkt_01a9b8',
    title: 'Water leakage from ceiling in Main Library Room 204',
    description: 'Severe water seepage from overhead pipe joints in the quiet reading hall of 2nd floor library near aisle 12. Poses immediate risk to archival book stacks.',
    issue_type_id: 'it_plumbing',
    issue_type: INITIAL_ISSUE_TYPES[0],
    status: 'open',
    photo_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    expected_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
    overdue: false,
    maintenance_note: 'Technician dispatched with pipe isolation clamp. Pressure testing in progress.',
    reporter_id: 'student@campus.edu',
    reporter_name: 'Aarav Sharma',
    reporter_email: 'student@campus.edu',
  },
  {
    id: 'tkt_02b8c7',
    title: 'Podium AC socket sparking in Seminar Hall 3',
    description: 'The main three-phase 16A wall outlet adjacent to the speaker podium sparked and tripped the secondary circuit breaker when connecting the AV rack.',
    issue_type_id: 'it_electrical',
    issue_type: INITIAL_ISSUE_TYPES[1],
    status: 'open',
    photo_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
    created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    expected_by: new Date(Date.now() - 12 * 3600 * 1000).toISOString().split('T')[0],
    overdue: true,
    maintenance_note: 'Awaiting replacement 16A modular receptacle from central warehouse.',
    reporter_id: 'faculty@campus.edu',
    reporter_name: 'Dr. K. Raman',
    reporter_email: 'faculty@campus.edu',
  },
  {
    id: 'tkt_03c7d6',
    title: 'Broken window latch causing rain draft in Computer Lab 4',
    description: 'South-facing heavy glass window latch is sheared off. Monsoon wind and moisture blowing directly onto server terminal workstations.',
    issue_type_id: 'it_carpentry',
    issue_type: INITIAL_ISSUE_TYPES[3],
    status: 'resolved',
    photo_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
    created_at: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    expected_by: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
    overdue: false,
    maintenance_note: 'Installed new heavy-duty brass sash lock and weatherstripping gasket. Tested and verified airtight.',
    reporter_id: 'student@campus.edu',
    reporter_name: 'Aarav Sharma',
    reporter_email: 'student@campus.edu',
  },
  {
    id: 'tkt_04d6e5',
    title: 'Central AC blower duct vibration in Auditorium Block B',
    description: 'Excessive acoustic resonance and vibration from supply duct damper 2 during morning classes.',
    issue_type_id: 'it_hvac',
    issue_type: INITIAL_ISSUE_TYPES[2],
    status: 'acknowledged',
    created_at: new Date(Date.now() - 140 * 3600 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    acknowledged_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    overdue: false,
    maintenance_note: 'Tightened suspension rods and inserted neoprene anti-vibration pads.',
    reporter_id: 'student@campus.edu',
    reporter_name: 'Aarav Sharma',
    reporter_email: 'student@campus.edu',
  },
];

// In-Memory & LocalStorage Persistence Helpers
export function getStoredIssueTypes(): IssueType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ISSUE_TYPES);
    if (raw) return JSON.parse(raw);
  } catch {}
  saveStoredIssueTypes(INITIAL_ISSUE_TYPES);
  return INITIAL_ISSUE_TYPES;
}

export function saveStoredIssueTypes(items: IssueType[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ISSUE_TYPES, JSON.stringify(items));
  } catch {}
}

export function getStoredTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (raw) {
      const parsed: Ticket[] = JSON.parse(raw);
      // Sanitize any dead blob: URLs that may have been saved from prior sessions
      return parsed.map((t) => {
        if (t.photo_url && t.photo_url.startsWith('blob:')) {
          const fallback = INITIAL_TICKETS.find((init) => init.id === t.id)?.photo_url;
          return { ...t, photo_url: fallback };
        }
        return t;
      });
    }
  } catch {}
  saveStoredTickets(INITIAL_TICKETS);
  return INITIAL_TICKETS;
}

export function saveStoredTickets(items: Ticket[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(items));
  } catch {}
}

export const INITIAL_TIMELINE_EVENTS: TicketTimelineEvent[] = [
  {
    id: 'evt_01',
    ticket_id: 'tkt_01a9b8',
    status: 'reported',
    stage_name: 'Reported',
    updated_by: 'Aarav Sharma',
    user_role: 'student',
    comment: 'Maintenance issue reported in Main Library Room 204.',
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_02',
    ticket_id: 'tkt_01a9b8',
    status: 'under_review',
    stage_name: 'Under Review',
    updated_by: 'System Administrator',
    user_role: 'admin',
    comment: 'Complaint verified and assigned for emergency plumbing review.',
    created_at: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_03',
    ticket_id: 'tkt_01a9b8',
    status: 'in_progress',
    stage_name: 'In Progress',
    updated_by: 'Rajesh Kumar (Chief Maintenance)',
    user_role: 'office_staff',
    comment: 'Technician dispatched with pipe isolation clamp. Pressure testing in progress.',
    created_at: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_04',
    ticket_id: 'tkt_02b8c7',
    status: 'reported',
    stage_name: 'Reported',
    updated_by: 'Dr. K. Raman (Faculty)',
    user_role: 'faculty',
    comment: 'AC socket sparking in Seminar Hall 3 reported during presentation.',
    created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_05',
    ticket_id: 'tkt_02b8c7',
    status: 'under_review',
    stage_name: 'Under Review',
    updated_by: 'Rajesh Kumar (Chief Maintenance)',
    user_role: 'office_staff',
    comment: 'Electrical team verified wall outlet. Secondary circuit breaker isolated.',
    created_at: new Date(Date.now() - 60 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_06',
    ticket_id: 'tkt_02b8c7',
    status: 'in_progress',
    stage_name: 'In Progress',
    updated_by: 'Rajesh Kumar (Chief Maintenance)',
    user_role: 'office_staff',
    comment: 'Awaiting replacement 16A modular receptacle from central warehouse.',
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_07',
    ticket_id: 'tkt_03c7d6',
    status: 'reported',
    stage_name: 'Reported',
    updated_by: 'Aarav Sharma',
    user_role: 'student',
    comment: 'Broken window latch causing rain draft in Computer Lab 4.',
    created_at: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_08',
    ticket_id: 'tkt_03c7d6',
    status: 'under_review',
    stage_name: 'Under Review',
    updated_by: 'Rajesh Kumar (Chief Maintenance)',
    user_role: 'office_staff',
    comment: 'Carpenter assigned to inspect window frame latch.',
    created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_09',
    ticket_id: 'tkt_03c7d6',
    status: 'in_progress',
    stage_name: 'In Progress',
    updated_by: 'Rajesh Kumar (Chief Maintenance)',
    user_role: 'office_staff',
    comment: 'Fitting new heavy-duty brass sash lock and weatherstripping gasket.',
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_10',
    ticket_id: 'tkt_03c7d6',
    status: 'resolved',
    stage_name: 'Resolved',
    updated_by: 'Rajesh Kumar (Chief Maintenance)',
    user_role: 'office_staff',
    comment: 'Installed new heavy-duty brass sash lock and weatherstripping gasket. Tested and verified airtight.',
    created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_11',
    ticket_id: 'tkt_04d6e5',
    status: 'reported',
    stage_name: 'Reported',
    updated_by: 'Aarav Sharma',
    user_role: 'student',
    comment: 'Excessive acoustic resonance and vibration from supply duct damper 2.',
    created_at: new Date(Date.now() - 140 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_12',
    ticket_id: 'tkt_04d6e5',
    status: 'in_progress',
    stage_name: 'In Progress',
    updated_by: 'Rajesh Kumar (Chief Maintenance)',
    user_role: 'office_staff',
    comment: 'Tightened suspension rods and inserted neoprene anti-vibration pads.',
    created_at: new Date(Date.now() - 80 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_13',
    ticket_id: 'tkt_04d6e5',
    status: 'resolved',
    stage_name: 'Resolved',
    updated_by: 'Rajesh Kumar (Chief Maintenance)',
    user_role: 'office_staff',
    comment: 'HVAC resonance dampened. Sound levels verified below 45dB.',
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
  {
    id: 'evt_14',
    ticket_id: 'tkt_04d6e5',
    status: 'closed',
    stage_name: 'Closed',
    updated_by: 'Aarav Sharma',
    user_role: 'student',
    comment: 'Resolution acknowledged and verified by student. Ticket officially closed.',
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

export function getStoredTimelineEvents(): TicketTimelineEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TIMELINE);
    if (raw) return JSON.parse(raw);
  } catch {}
  saveStoredTimelineEvents(INITIAL_TIMELINE_EVENTS);
  return INITIAL_TIMELINE_EVENTS;
}

export function saveStoredTimelineEvents(items: TicketTimelineEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TIMELINE, JSON.stringify(items));
  } catch {}
}

/**
 * Generates an authoritative profile based on email address.
 */
export function mockProfileForEmail(email: string, isAdmin = false): { profile: TokenResponse['profile'] } {
  const clean = email.toLowerCase().trim();
  let role: Role = 'student';
  let dept = 'Computer Science & Engineering';
  let name = 'Aarav Sharma';

  if (isAdmin || clean.includes('admin')) {
    role = 'admin';
    name = 'System Administrator';
    dept = 'Campus Operations Admin';
  } else if (clean.includes('maintenance') || clean.includes('staff')) {
    role = 'office_staff';
    dept = 'Campus Maintenance';
    name = 'Rajesh Kumar (Chief Maintenance)';
  } else if (clean.includes('faculty') || clean.includes('prof') || clean.includes('dr')) {
    role = 'faculty';
    dept = 'Department of Electrical Engineering';
    name = 'Dr. K. Raman (Faculty)';
  }

  return {
    profile: {
      email_id: clean,
      name,
      role,
      dept,
    },
  };
}

/**
 * Converts a browser File object to a persistent, self-contained base64 data URL.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file into data URL'));
    reader.readAsDataURL(file);
  });
}

/**
 * Recomputes the `overdue` flag for a ticket based on today's date.
 * A ticket is overdue if:
 *  - It has an expected_by date
 *  - That date is strictly before today (in YYYY-MM-DD)
 *  - The ticket is not yet resolved or acknowledged
 */
function recomputeOverdue(ticket: Ticket): Ticket {
  const nonFinalStatuses = ['open', 'reported', 'under_review', 'in_progress'];
  if (!ticket.expected_by || !nonFinalStatuses.includes(ticket.status)) {
    return { ...ticket, overdue: false };
  }
  const today = new Date().toISOString().split('T')[0];
  const overdue = ticket.expected_by < today;
  return { ...ticket, overdue };
}

/**
 * Simulates backend operations when port 8000 is not running.
 */
export async function simulateBackendRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    json?: any;
    formData?: FormData;
  }
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(`http://dummy${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);
  const pathname = url.pathname;

  // Small realistic delay (100-200ms) for natural UI feel
  await new Promise((resolve) => setTimeout(resolve, 120));

  // 1. Auth: POST /api/v1/auth/login or /api/v1/auth/admin/login
  if (pathname.includes('/auth/login') || pathname.includes('/auth/admin/login')) {
    const isAdmin = pathname.includes('/admin/login');
    const email = options.json?.email_id || 'student@campus.edu';
    const { profile } = mockProfileForEmail(email, isAdmin);

    const tokenResponse: TokenResponse = {
      access_token: `mock_jwt_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      token_type: 'bearer',
      expires_in: 43200, // 12 hours
      profile,
    };
    return tokenResponse as T;
  }

  // 2. Profile: GET /api/v1/users/me
  if (pathname.includes('/users/me')) {
    const sessionRaw = sessionStorage.getItem('fixit:auth_session') || localStorage.getItem('fixit:auth_session');
    let email = 'student@campus.edu';
    if (sessionRaw) {
      try {
        email = JSON.parse(sessionRaw)?.user?.email || email;
      } catch {}
    }
    const { profile } = mockProfileForEmail(email);
    const userProfile: UserProfile = {
      ...profile,
      phone: '+91 98765 43210',
    };
    return userProfile as T;
  }

  // 3. Issue Types: GET /api/v1/fixit/issue-types
  if (pathname === '/api/v1/fixit/issue-types') {
    if (method === 'GET') {
      const types = getStoredIssueTypes();
      return { items: types, count: types.length } as T;
    }
    if (method === 'POST') {
      const types = getStoredIssueTypes();
      const newType: IssueType = {
        id: `it_${Date.now()}`,
        name: options.json?.name || 'New Category',
        description: options.json?.description || '',
        active: true,
        created_at: new Date().toISOString(),
      };
      types.unshift(newType);
      saveStoredIssueTypes(types);
      return newType as T;
    }
  }

  // Issue Types CRUD: PATCH/DELETE /api/v1/fixit/issue-types/:id
  const issueTypeMatch = pathname.match(/\/api\/v1\/fixit\/issue-types\/(.+)/);
  if (issueTypeMatch) {
    const id = decodeURIComponent(issueTypeMatch[1]);
    const types = getStoredIssueTypes();

    if (method === 'PATCH') {
      const idx = types.findIndex((t) => t.id === id);
      if (idx !== -1) {
        types[idx] = { ...types[idx], ...options.json, updated_at: new Date().toISOString() };
        saveStoredIssueTypes(types);
        return types[idx] as T;
      }
    }
    if (method === 'DELETE') {
      const filtered = types.filter((t) => t.id !== id);
      saveStoredIssueTypes(filtered);
      return null as T;
    }
  }

  // 4. Tickets: GET /api/v1/fixit/tickets
  if (pathname === '/api/v1/fixit/tickets') {
    if (method === 'GET') {
      let tickets = getStoredTickets();
      const statusParam = url.searchParams.get('status');
      const searchParam = url.searchParams.get('search');
      const overdueParam = url.searchParams.get('overdue');

      if (statusParam && statusParam !== 'all') {
        tickets = tickets.filter((t) => t.status === statusParam);
      }
      if (overdueParam === 'true') {
        tickets = tickets.filter((t) => t.overdue);
      }
      if (searchParam) {
        const query = searchParam.toLowerCase();
        tickets = tickets.filter(
          (t) =>
            t.title.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query) ||
            t.id.toLowerCase().includes(query)
        );
      }

      // Cursor pagination simulation
      const limit = Number(url.searchParams.get('limit')) || 25;
      const cursor = url.searchParams.get('cursor');
      let startIndex = 0;
      if (cursor) {
        startIndex = Number(cursor) || 0;
      }
      const pageItems = tickets.slice(startIndex, startIndex + limit);
      const nextIndex = startIndex + limit < tickets.length ? String(startIndex + limit) : null;

      return {
        items: pageItems.map(recomputeOverdue),
        count: tickets.length,
        next_cursor: nextIndex,
      } as T;
    }

    // POST /api/v1/fixit/tickets (create ticket)
    if (method === 'POST') {
      const tickets = getStoredTickets();
      const types = getStoredIssueTypes();

      let title = 'Maintenance Issue';
      let description = '';
      let issueTypeId = types[0]?.id || 'it_plumbing';
      let photoUrl: string | undefined;

      if (options.formData) {
        title = String(options.formData.get('title') || title);
        description = String(options.formData.get('description') || '');
        issueTypeId = String(options.formData.get('issue_type_id') || issueTypeId);
        const photoFile = options.formData.get('photo');
        if (photoFile && photoFile instanceof File && photoFile.size > 0) {
          try {
            photoUrl = await fileToDataUrl(photoFile);
          } catch {
            photoUrl = undefined;
          }
        }
      } else if (options.json) {
        title = options.json.title || title;
        description = options.json.description || '';
        issueTypeId = options.json.issue_type_id || issueTypeId;
      }

      const category = types.find((t) => t.id === issueTypeId) || types[0];
      const sessionRaw = sessionStorage.getItem('fixit:auth_session') || localStorage.getItem('fixit:auth_session');
      let reporterEmail = 'student@campus.edu';
      let reporterName = 'Aarav Sharma';
      if (sessionRaw) {
        try {
          const user = JSON.parse(sessionRaw)?.user;
          reporterEmail = user?.email || reporterEmail;
          reporterName = user?.name || reporterName;
        } catch {}
      }

      const newTicket: Ticket = {
        id: `tkt_${Math.random().toString(36).substring(2, 8)}`,
        title,
        description,
        issue_type_id: issueTypeId,
        issue_type: category,
        status: 'open',
        photo_url: photoUrl,
        created_at: new Date().toISOString(),
        expected_by: new Date(Date.now() + 48 * 3600 * 1000).toISOString().split('T')[0],
        overdue: false,
        reporter_id: reporterEmail,
        reporter_email: reporterEmail,
        reporter_name: reporterName,
      };

      tickets.unshift(newTicket);
      saveStoredTickets(tickets);

      // Automatically create initial "Reported" event in timeline
      const newTimelineEvent: TicketTimelineEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticket_id: newTicket.id,
        status: 'reported',
        stage_name: 'Reported',
        updated_by: reporterName,
        user_role: 'student',
        comment: `Maintenance issue reported: ${title}`,
        created_at: newTicket.created_at,
      };
      const events = getStoredTimelineEvents();
      events.push(newTimelineEvent);
      saveStoredTimelineEvents(events);

      return newTicket as T;
    }
  }

  // 5. Single Ticket: GET/PATCH/DELETE /api/v1/fixit/tickets/:id
  const ticketDetailMatch = pathname.match(/\/api\/v1\/fixit\/tickets\/([^/]+)$/);
  if (ticketDetailMatch) {
    const id = decodeURIComponent(ticketDetailMatch[1]);
    const tickets = getStoredTickets();
    const idx = tickets.findIndex((t) => t.id === id);

    if (idx === -1) {
      throw new Error(`Ticket #${id} not found.`);
    }

    if (method === 'GET') {
      return recomputeOverdue(tickets[idx]) as T;
    }

    if (method === 'PATCH') {
      let patchData: any = {};
      if (options.formData) {
        if (options.formData.has('title')) patchData.title = String(options.formData.get('title') || '');
        if (options.formData.has('description')) patchData.description = String(options.formData.get('description') || '');
        if (options.formData.has('issue_type_id')) {
          const tid = String(options.formData.get('issue_type_id'));
          patchData.issue_type_id = tid;
          const types = getStoredIssueTypes();
          const found = types.find((t) => t.id === tid);
          if (found) patchData.issue_type = found;
        }
        const photoFile = options.formData.get('photo');
        if (photoFile && photoFile instanceof File && photoFile.size > 0) {
          try {
            patchData.photo_url = await fileToDataUrl(photoFile);
          } catch {
            // retain existing
          }
        }
        if (options.formData.get('remove_photo') === 'true') {
          patchData.photo_url = undefined;
        }
      } else if (options.json) {
        patchData = { ...options.json };
        if (patchData.remove_photo) {
          patchData.photo_url = undefined;
        }
      }

      const updated = {
        ...tickets[idx],
        ...patchData,
        updated_at: new Date().toISOString(),
      };
      tickets[idx] = updated;
      saveStoredTickets(tickets);
      return updated as T;
    }

    if (method === 'DELETE') {
      const filtered = tickets.filter((t) => t.id !== id);
      saveStoredTickets(filtered);
      return null as T;
    }
  }

  // 6. Update Status: PUT /api/v1/fixit/tickets/:id/status
  const statusMatch = pathname.match(/\/api\/v1\/fixit\/tickets\/([^/]+)\/status/);
  if (statusMatch && method === 'PUT') {
    const id = decodeURIComponent(statusMatch[1]);
    const tickets = getStoredTickets();
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const { status, note } = options.json;
      const updated: Ticket = {
        ...tickets[idx],
        status,
        maintenance_note: note,
        updated_at: new Date().toISOString(),
        resolved_at: status === 'resolved' ? new Date().toISOString() : tickets[idx].resolved_at,
      };
      tickets[idx] = updated;
      saveStoredTickets(tickets);

      // Log timeline event
      const events = getStoredTimelineEvents();
      events.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticket_id: id,
        status: status === 'resolved' ? 'resolved' : 'in_progress',
        stage_name: status === 'resolved' ? 'Resolved' : 'In Progress',
        updated_by: 'Rajesh Kumar (Chief Maintenance)',
        user_role: 'office_staff',
        comment: note || (status === 'resolved' ? 'Defect repaired and verified.' : 'Maintenance work in progress.'),
        created_at: updated.updated_at || new Date().toISOString(),
      });
      saveStoredTimelineEvents(events);

      return updated as T;
    }
  }

  // 7. Acknowledge: POST /api/v1/fixit/tickets/:id/acknowledge
  const ackMatch = pathname.match(/\/api\/v1\/fixit\/tickets\/([^/]+)\/acknowledge/);
  if (ackMatch && method === 'POST') {
    const id = decodeURIComponent(ackMatch[1]);
    const tickets = getStoredTickets();
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const updated: Ticket = {
        ...tickets[idx],
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      tickets[idx] = updated;
      saveStoredTickets(tickets);

      // Log Closed timeline event
      const events = getStoredTimelineEvents();
      events.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticket_id: id,
        status: 'closed',
        stage_name: 'Closed',
        updated_by: tickets[idx].reporter_name || 'Reporter',
        user_role: 'student',
        comment: 'Resolution confirmed and acknowledged by reporter. Ticket officially closed.',
        created_at: updated.acknowledged_at || new Date().toISOString(),
      });
      saveStoredTimelineEvents(events);

      return updated as T;
    }
  }

  // 7b. Reopen: POST /api/v1/fixit/tickets/:id/reopen  (student raises issue again)
  const reopenMatch = pathname.match(/\/api\/v1\/fixit\/tickets\/([^/]+)\/reopen/);
  if (reopenMatch && method === 'POST') {
    const id = decodeURIComponent(reopenMatch[1]);
    const tickets = getStoredTickets();
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const now = new Date().toISOString();

      // Grab comment from FormData or JSON body
      let comment = 'Issue not resolved satisfactorily.';
      if (options.formData) {
        const fd = options.formData as FormData;
        const raw = fd.get('comment');
        if (raw && String(raw).trim()) comment = String(raw).trim();
      } else if (options.json && typeof options.json === 'object') {
        const j = options.json as Record<string, string>;
        if (j.comment && j.comment.trim()) comment = j.comment.trim();
      }

      const updated: Ticket = {
        ...tickets[idx],
        status: 'open',
        reopened_at: now,
        updated_at: now,
        acknowledged_at: undefined,
      } as any;
      tickets[idx] = updated;
      saveStoredTickets(tickets);

      // Add "Issue Raised Again" timeline event
      const events = getStoredTimelineEvents();
      events.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticket_id: id,
        status: 'under_review',
        stage_name: 'Issue Raised Again',
        updated_by: updated.reporter_name || 'Student',
        user_role: 'student',
        comment,
        created_at: now,
        is_reopen: true,
      } as any);
      saveStoredTimelineEvents(events);

      return updated as T;
    }
    // Ticket not found — return 404-style error
    throw new ApiError(404, 'NOT_FOUND', 'Ticket not found');
  }

  // 8. Update TAT: PUT /api/v1/fixit/tickets/:id/tat
  const tatMatch = pathname.match(/\/api\/v1\/fixit\/tickets\/([^/]+)\/tat/);
  if (tatMatch && method === 'PUT') {
    const id = decodeURIComponent(tatMatch[1]);
    const tickets = getStoredTickets();
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const { expected_by, note } = options.json;
      const today = new Date().toISOString().split('T')[0];
      const updated: Ticket = recomputeOverdue({
        ...tickets[idx],
        expected_by,
        maintenance_note: note || tickets[idx].maintenance_note,
        updated_at: new Date().toISOString(),
        overdue: expected_by < today && !['resolved', 'acknowledged'].includes(tickets[idx].status),
      });
      tickets[idx] = updated;
      saveStoredTickets(tickets);

      // Record a timeline event so the student can see the deadline was set
      const events = getStoredTimelineEvents();
      events.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticket_id: id,
        status: updated.status as any,
        stage_name: 'Deadline Set',
        updated_by: 'Admin',
        user_role: 'admin',
        comment: `Resolution deadline set to ${expected_by}${note ? ': ' + note : '.'}`,
        created_at: updated.updated_at || new Date().toISOString(),
      });
      saveStoredTimelineEvents(events);

      return updated as T;
    }
  }

  // 9. Timeline: GET & POST /api/v1/fixit/tickets/:id/timeline
  const timelineMatch = pathname.match(/\/api\/v1\/fixit\/tickets\/([^/]+)\/timeline/);
  if (timelineMatch) {
    const id = decodeURIComponent(timelineMatch[1]);
    const tickets = getStoredTickets();
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) {
      throw new Error(`Ticket #${id} not found.`);
    }

    if (method === 'GET') {
      const allEvents = getStoredTimelineEvents();
      const ticketEvents = allEvents
        .filter((e) => e.ticket_id === id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return { items: ticketEvents, count: ticketEvents.length } as T;
    }

    if (method === 'POST') {
      const payload = options.json || {};
      const status: TimelineStage = payload.status || 'in_progress';
      const comment: string | undefined = payload.comment?.trim() || undefined;

      const stageNames: Record<TimelineStage, string> = {
        reported: 'Reported',
        under_review: 'Under Review',
        in_progress: 'In Progress',
        resolved: 'Resolved',
        closed: 'Closed',
      };

      const sessionRaw = sessionStorage.getItem('fixit:auth_session') || localStorage.getItem('fixit:auth_session');
      let authorName = 'System Administrator';
      let authorRole: Role = 'admin';
      if (sessionRaw) {
        try {
          const user = JSON.parse(sessionRaw)?.user;
          authorName = user?.name || authorName;
          authorRole = user?.role || authorRole;
        } catch {}
      }

      const newEvent: TicketTimelineEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticket_id: id,
        status,
        stage_name: stageNames[status] || status,
        updated_by: authorName,
        user_role: authorRole,
        comment,
        created_at: new Date().toISOString(),
      };

      const allEvents = getStoredTimelineEvents();
      allEvents.push(newEvent);
      saveStoredTimelineEvents(allEvents);

      // Sync ticket
      const ticketIdx = tickets.findIndex((t) => t.id === id);
      if (ticketIdx !== -1) {
        if (payload.photo_url) {
          tickets[ticketIdx].photo_url = payload.photo_url;
        }
        if (status === 'resolved') {
          tickets[ticketIdx].status = 'resolved';
          tickets[ticketIdx].resolved_at = newEvent.created_at;
          if (comment) tickets[ticketIdx].maintenance_note = comment;
        } else if (status === 'closed') {
          tickets[ticketIdx].status = 'acknowledged';
          tickets[ticketIdx].acknowledged_at = newEvent.created_at;
        } else if (status === 'in_progress' || status === 'under_review') {
          tickets[ticketIdx].status = 'open';
          if (comment) tickets[ticketIdx].maintenance_note = comment;
        }
        tickets[ticketIdx].updated_at = newEvent.created_at;
        saveStoredTickets(tickets);
      }

      return newEvent as T;
    }
  }

  throw new Error(`Unhandled endpoint: ${method} ${pathname}`);
}
