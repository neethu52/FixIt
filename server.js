#!/usr/bin/env node
/**
 * FixIt — CampusOS Backend Server
 * Complete reference implementation of the CampusOS and FixIt backend specifications.
 * Pure Node.js (zero external dependencies) with CORS, authentication, and full CRUD.
 *
 * Runs on: http://localhost:8000
 * Base API: /api/v1
 */

import http from 'node:http';
import crypto from 'node:crypto';

const PORT = process.env.PORT || 8000;

// In-Memory Database (Pre-seeded with realistic data)
const db = {
  issueTypes: [
    {
      id: 'it_plumbing',
      name: 'Plumbing & Water Supply',
      description: 'Pipes, faucets, restroom fixtures, water coolers, drainage, and leakage repairs.',
      active: true,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'it_electrical',
      name: 'Electrical & Power',
      description: 'Lighting, switchboards, circuit breakers, power outlets, and wiring faults.',
      active: true,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'it_hvac',
      name: 'HVAC & Climate Control',
      description: 'Air conditioners, ventilation fans, chillers, and heating systems.',
      active: true,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'it_carpentry',
      name: 'Carpentry & Furniture',
      description: 'Doors, windows, desks, chairs, locks, cupboards, and partition repairs.',
      active: true,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 'it_civil',
      name: 'Civil & Infrastructure',
      description: 'Masonry, flooring, ceiling tiles, roof maintenance, and structural repairs.',
      active: true,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ],

  tickets: [
    {
      id: 'tkt_01a9b8',
      title: 'Water leakage from ceiling in Main Library Room 204',
      description: 'Severe water seepage from overhead pipe joints in the quiet reading hall of 2nd floor library near aisle 12. Poses immediate risk to archival book stacks.',
      issue_type_id: 'it_plumbing',
      status: 'open',
      photo_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
      created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
      expected_by: new Date(Date.now() + 24 * 3600000).toISOString().split('T')[0],
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
      status: 'open',
      photo_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
      created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
      expected_by: new Date(Date.now() - 12 * 3600000).toISOString().split('T')[0],
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
      status: 'resolved',
      photo_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      created_at: new Date(Date.now() - 96 * 3600000).toISOString(),
      resolved_at: new Date(Date.now() - 12 * 3600000).toISOString(),
      expected_by: new Date(Date.now() - 24 * 3600000).toISOString().split('T')[0],
      overdue: false,
      maintenance_note: 'Installed new heavy-duty brass sash lock and weatherstripping gasket. Tested and verified airtight.',
      reporter_id: 'student@campus.edu',
      reporter_name: 'Aarav Sharma',
      reporter_email: 'student@campus.edu',
    },
  ],

  timelineEvents: [
    {
      id: 'evt_01',
      ticket_id: 'tkt_01a9b8',
      status: 'reported',
      stage_name: 'Reported',
      updated_by: 'Aarav Sharma',
      user_role: 'student',
      comment: 'Maintenance issue reported in Main Library Room 204.',
      created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    {
      id: 'evt_02',
      ticket_id: 'tkt_01a9b8',
      status: 'under_review',
      stage_name: 'Under Review',
      updated_by: 'System Administrator',
      user_role: 'admin',
      comment: 'Complaint verified and prioritized for emergency plumbing dispatch.',
      created_at: new Date(Date.now() - 2.5 * 3600000).toISOString(),
    },
    {
      id: 'evt_03',
      ticket_id: 'tkt_01a9b8',
      status: 'in_progress',
      stage_name: 'In Progress',
      updated_by: 'Rajesh Kumar (Chief Maintenance)',
      user_role: 'office_staff',
      comment: 'Technician dispatched with pipe isolation clamp. Pressure testing in progress.',
      created_at: new Date(Date.now() - 1.5 * 3600000).toISOString(),
    },
    {
      id: 'evt_04',
      ticket_id: 'tkt_02b8c7',
      status: 'reported',
      stage_name: 'Reported',
      updated_by: 'Dr. K. Raman',
      user_role: 'faculty',
      comment: 'AC socket sparking in Seminar Hall 3 reported during presentation.',
      created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
    },
    {
      id: 'evt_05',
      ticket_id: 'tkt_02b8c7',
      status: 'under_review',
      stage_name: 'Under Review',
      updated_by: 'Rajesh Kumar (Chief Maintenance)',
      user_role: 'office_staff',
      comment: 'Electrical team inspected wall socket. Tripped breaker isolated.',
      created_at: new Date(Date.now() - 60 * 3600000).toISOString(),
    },
    {
      id: 'evt_06',
      ticket_id: 'tkt_02b8c7',
      status: 'in_progress',
      stage_name: 'In Progress',
      updated_by: 'Rajesh Kumar (Chief Maintenance)',
      user_role: 'office_staff',
      comment: 'Awaiting replacement 16A modular receptacle from central warehouse.',
      created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
    },
    {
      id: 'evt_07',
      ticket_id: 'tkt_03c7d6',
      status: 'reported',
      stage_name: 'Reported',
      updated_by: 'Aarav Sharma',
      user_role: 'student',
      comment: 'Broken window latch causing rain draft in Computer Lab 4.',
      created_at: new Date(Date.now() - 96 * 3600000).toISOString(),
    },
    {
      id: 'evt_08',
      ticket_id: 'tkt_03c7d6',
      status: 'under_review',
      stage_name: 'Under Review',
      updated_by: 'Rajesh Kumar (Chief Maintenance)',
      user_role: 'office_staff',
      comment: 'Carpenter assigned to inspect window frame and measurements.',
      created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
    },
    {
      id: 'evt_09',
      ticket_id: 'tkt_03c7d6',
      status: 'in_progress',
      stage_name: 'In Progress',
      updated_by: 'Rajesh Kumar (Chief Maintenance)',
      user_role: 'office_staff',
      comment: 'Fitting new heavy-duty brass sash lock and weatherstripping gasket.',
      created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
    },
    {
      id: 'evt_10',
      ticket_id: 'tkt_03c7d6',
      status: 'resolved',
      stage_name: 'Resolved',
      updated_by: 'Rajesh Kumar (Chief Maintenance)',
      user_role: 'office_staff',
      comment: 'Installed new heavy-duty brass sash lock and weatherstripping gasket. Tested and verified airtight.',
      created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    },
  ],
};

const STAGE_NAMES = {
  reported: 'Reported',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

function getAuthProfile(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.includes('admin')) {
    return getProfileForEmail('admin@campus.edu', true);
  } else if (auth.includes('maintenance')) {
    return getProfileForEmail('staff@campus.edu', false);
  } else if (auth.includes('faculty')) {
    return getProfileForEmail('faculty@campus.edu', false);
  }
  return getProfileForEmail('student@campus.edu', false);
}

function getProfileForEmail(email, isAdmin = false) {
  const clean = String(email || '').toLowerCase().trim();
  let role = 'student';
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
    email_id: clean || 'student@campus.edu',
    name,
    role,
    dept,
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';

      if (contentType.includes('application/json')) {
        try {
          resolve(JSON.parse(buffer.toString('utf8')));
        } catch (err) {
          reject(err);
        }
      } else if (contentType.includes('multipart/form-data')) {
        // Robust multipart binary parser for form fields and image attachments
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]).trim() : null;
        const result = {};

        if (boundary) {
          const boundaryBuf = Buffer.from(`--${boundary}`);
          let searchPos = 0;

          while (true) {
            const startIdx = buffer.indexOf(boundaryBuf, searchPos);
            if (startIdx === -1) break;

            const nextIdx = buffer.indexOf(boundaryBuf, startIdx + boundaryBuf.length);
            if (nextIdx === -1) break;

            const part = buffer.subarray(startIdx + boundaryBuf.length, nextIdx);
            searchPos = nextIdx;

            const sep = Buffer.from('\r\n\r\n');
            const sepIdx = part.indexOf(sep);
            if (sepIdx === -1) continue;

            const headerStr = part.subarray(0, sepIdx).toString('utf8');
            let content = part.subarray(sepIdx + 4);

            // Strip trailing \r\n before next boundary
            if (content.length >= 2 && content[content.length - 2] === 0x0d && content[content.length - 1] === 0x0a) {
              content = content.subarray(0, content.length - 2);
            }

            const nameMatch = headerStr.match(/name="([^"]+)"/);
            if (!nameMatch) continue;
            const fieldName = nameMatch[1];

            const filenameMatch = headerStr.match(/filename="([^"]*)"/);
            if (filenameMatch && filenameMatch[1]) {
              const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
              const mime = ctMatch ? ctMatch[1].trim() : 'image/jpeg';
              if (content.length > 0) {
                // Store as self-contained base64 data URI for reliable, cross-origin rendering
                result[fieldName] = `data:${mime};base64,${content.toString('base64')}`;
              }
            } else {
              result[fieldName] = content.toString('utf8').trim();
            }
          }
        }
        resolve(result);
      } else {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:8000'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // 1. POST /api/v1/auth/login
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const email = body.email_id || 'student@campus.edu';
      if (email.toLowerCase().includes('admin')) {
        return sendJson(res, 400, {
          error: { code: 'USE_ADMIN_LOGIN', message: 'Administrator accounts must authenticate via /auth/admin/login.' },
        });
      }
      const profile = getProfileForEmail(email, false);
      return sendJson(res, 200, {
        access_token: `jwt_${crypto.randomBytes(16).toString('hex')}`,
        token_type: 'bearer',
        expires_in: 43200,
        profile,
      });
    }

    // 2. POST /api/v1/auth/admin/login
    if (pathname === '/api/v1/auth/admin/login' && method === 'POST') {
      const body = await parseBody(req);
      const email = body.email_id || 'admin@campus.edu';
      const profile = getProfileForEmail(email, true);
      return sendJson(res, 200, {
        access_token: `admin_jwt_${crypto.randomBytes(16).toString('hex')}`,
        token_type: 'bearer',
        expires_in: 43200,
        profile,
      });
    }

    // 3. GET /api/v1/users/me
    if (pathname === '/api/v1/users/me' && method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      const isAdmin = authHeader.includes('admin');
      const profile = getProfileForEmail(isAdmin ? 'admin@campus.edu' : 'student@campus.edu', isAdmin);
      return sendJson(res, 200, profile);
    }

    // 4. GET & POST /api/v1/fixit/issue-types
    if (pathname === '/api/v1/fixit/issue-types') {
      if (method === 'GET') {
        return sendJson(res, 200, { items: db.issueTypes, count: db.issueTypes.length });
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const newType = {
          id: `it_${Date.now()}`,
          name: body.name || 'New Category',
          description: body.description || '',
          active: true,
          created_at: new Date().toISOString(),
        };
        db.issueTypes.unshift(newType);
        return sendJson(res, 201, newType);
      }
    }

    // PATCH & DELETE /api/v1/fixit/issue-types/:id
    const typeMatch = pathname.match(/^\/api\/v1\/fixit\/issue-types\/(.+)$/);
    if (typeMatch) {
      const id = decodeURIComponent(typeMatch[1]);
      const idx = db.issueTypes.findIndex((t) => t.id === id);
      if (idx === -1) {
        return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Category not found.' } });
      }
      if (method === 'PATCH') {
        const body = await parseBody(req);
        db.issueTypes[idx] = { ...db.issueTypes[idx], ...body, updated_at: new Date().toISOString() };
        return sendJson(res, 200, db.issueTypes[idx]);
      }
      if (method === 'DELETE') {
        db.issueTypes.splice(idx, 1);
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        });
        return res.end();
      }
    }

    // 5. GET & POST /api/v1/fixit/tickets
    if (pathname === '/api/v1/fixit/tickets') {
      if (method === 'GET') {
        let results = [...db.tickets];
        const status = parsedUrl.searchParams.get('status');
        const overdue = parsedUrl.searchParams.get('overdue');
        const search = parsedUrl.searchParams.get('search');

        if (status && status !== 'all') {
          results = results.filter((t) => t.status === status);
        }
        if (overdue === 'true') {
          results = results.filter((t) => t.overdue);
        }
        if (search) {
          const q = search.toLowerCase();
          results = results.filter(
            (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.id.includes(q)
          );
        }

        const limit = Number(parsedUrl.searchParams.get('limit')) || 25;
        const cursor = Number(parsedUrl.searchParams.get('cursor')) || 0;
        const pageItems = results.slice(cursor, cursor + limit);
        const nextCursor = cursor + limit < results.length ? String(cursor + limit) : null;

        // Auto-recompute overdue on every response
        const today = new Date().toISOString().split('T')[0];
        const nonFinalStatuses = ['open', 'reported', 'under_review', 'in_progress'];
        const withOverdue = pageItems.map((t) => ({
          ...t,
          overdue: t.expected_by && nonFinalStatuses.includes(t.status) ? t.expected_by < today : false,
        }));

        return sendJson(res, 200, {
          items: withOverdue,
          count: results.length,
          next_cursor: nextCursor,
        });
      }

      if (method === 'POST') {
        const body = await parseBody(req);
        const category = db.issueTypes.find((t) => t.id === body.issue_type_id) || db.issueTypes[0];
        const newTicket = {
          id: `tkt_${crypto.randomBytes(3).toString('hex')}`,
          title: body.title || 'Reported Issue',
          description: body.description || '',
          issue_type_id: body.issue_type_id || db.issueTypes[0].id,
          issue_type: category,
          status: 'open',
          photo_url: body.photo || body.photo_url || null,
          created_at: new Date().toISOString(),
          expected_by: new Date(Date.now() + 48 * 3600000).toISOString().split('T')[0],
          overdue: false,
          reporter_id: 'student@campus.edu',
          reporter_name: 'Aarav Sharma',
          reporter_email: 'student@campus.edu',
        };
        db.tickets.unshift(newTicket);
        // Automatically create initial "Reported" timeline event
        db.timelineEvents.push({
          id: `evt_${crypto.randomBytes(4).toString('hex')}`,
          ticket_id: newTicket.id,
          status: 'reported',
          stage_name: 'Reported',
          updated_by: newTicket.reporter_name || 'Reporter',
          user_role: 'student',
          comment: `Maintenance issue reported: ${newTicket.title}`,
          created_at: newTicket.created_at,
        });
        return sendJson(res, 201, newTicket);
      }
    }

    // 6. PUT /api/v1/fixit/tickets/:id/status
    const statusMatch = pathname.match(/^\/api\/v1\/fixit\/tickets\/([^/]+)\/status$/);
    if (statusMatch && method === 'PUT') {
      const id = decodeURIComponent(statusMatch[1]);
      const idx = db.tickets.findIndex((t) => t.id === id);
      if (idx === -1) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

      const body = await parseBody(req);
      const profile = getAuthProfile(req);
      db.tickets[idx].status = body.status;
      db.tickets[idx].maintenance_note = body.note;
      db.tickets[idx].updated_at = new Date().toISOString();
      if (body.photo || body.photo_url) {
        db.tickets[idx].photo_url = body.photo || body.photo_url;
      }
      if (body.status === 'resolved') {
        db.tickets[idx].resolved_at = new Date().toISOString();
        db.timelineEvents.push({
          id: `evt_${crypto.randomBytes(4).toString('hex')}`,
          ticket_id: id,
          status: 'resolved',
          stage_name: 'Resolved',
          updated_by: profile.name,
          user_role: profile.role,
          comment: body.note || 'Issue resolved by maintenance technician.',
          created_at: db.tickets[idx].resolved_at,
        });
      } else {
        db.timelineEvents.push({
          id: `evt_${crypto.randomBytes(4).toString('hex')}`,
          ticket_id: id,
          status: 'in_progress',
          stage_name: 'In Progress',
          updated_by: profile.name,
          user_role: profile.role,
          comment: body.note || 'Maintenance update logged.',
          created_at: db.tickets[idx].updated_at,
        });
      }
      return sendJson(res, 200, db.tickets[idx]);
    }

    // 7. POST /api/v1/fixit/tickets/:id/acknowledge
    const ackMatch = pathname.match(/^\/api\/v1\/fixit\/tickets\/([^/]+)\/acknowledge$/);
    if (ackMatch && method === 'POST') {
      const id = decodeURIComponent(ackMatch[1]);
      const idx = db.tickets.findIndex((t) => t.id === id);
      if (idx === -1) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

      const profile = getAuthProfile(req);
      db.tickets[idx].status = 'acknowledged';
      db.tickets[idx].acknowledged_at = new Date().toISOString();
      db.tickets[idx].updated_at = db.tickets[idx].acknowledged_at;
      db.timelineEvents.push({
        id: `evt_${crypto.randomBytes(4).toString('hex')}`,
        ticket_id: id,
        status: 'closed',
        stage_name: 'Closed',
        updated_by: profile.name,
        user_role: profile.role,
        comment: 'Resolution confirmed and acknowledged by reporter. Ticket officially closed.',
        created_at: db.tickets[idx].acknowledged_at,
      });
      return sendJson(res, 200, db.tickets[idx]);
    }

    // 7b. POST /api/v1/fixit/tickets/:id/reopen  (student raises issue again)
    const reopenMatch = pathname.match(/^\/api\/v1\/fixit\/tickets\/([^/]+)\/reopen$/);
    if (reopenMatch && method === 'POST') {
      const id = decodeURIComponent(reopenMatch[1]);
      const idx = db.tickets.findIndex((t) => t.id === id);
      if (idx === -1) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

      const body = await parseBody(req);
      const profile = getAuthProfile(req);
      const now = new Date().toISOString();

      // Reset status to open
      db.tickets[idx].status = 'open';
      db.tickets[idx].reopened_at = now;
      db.tickets[idx].updated_at = now;
      // Clear acknowledged_at so the acknowledge button can reappear only after re-resolution
      delete db.tickets[idx].acknowledged_at;

      // Add a timeline event
      db.timelineEvents.push({
        id: `evt_${crypto.randomBytes(4).toString('hex')}`,
        ticket_id: id,
        status: 'under_review',
        stage_name: 'Issue Raised Again',
        updated_by: profile.name,
        user_role: profile.role,
        comment: body.comment
          ? String(body.comment).trim()
          : 'Student reported that the issue has not been resolved satisfactorily.',
        created_at: now,
        is_reopen: true,
      });

      return sendJson(res, 200, db.tickets[idx]);
    }

    // 8. PUT /api/v1/fixit/tickets/:id/tat
    const tatMatch = pathname.match(/^\/api\/v1\/fixit\/tickets\/([^/]+)\/tat$/);
    if (tatMatch && method === 'PUT') {
      const id = decodeURIComponent(tatMatch[1]);
      const idx = db.tickets.findIndex((t) => t.id === id);
      if (idx === -1) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

      const body = await parseBody(req);
      const today = new Date().toISOString().split('T')[0];
      const nonFinal = ['open', 'reported', 'under_review', 'in_progress'];
      db.tickets[idx].expected_by = body.expected_by;
      if (body.note) db.tickets[idx].maintenance_note = body.note;
      db.tickets[idx].updated_at = new Date().toISOString();
      // Recompute overdue
      db.tickets[idx].overdue =
        body.expected_by && nonFinal.includes(db.tickets[idx].status)
          ? body.expected_by < today
          : false;
      // Add a timeline event so student sees the deadline
      const profile = getAuthProfile(req);
      db.timelineEvents.push({
        id: `evt_${crypto.randomBytes(4).toString('hex')}`,
        ticket_id: id,
        status: db.tickets[idx].status,
        stage_name: 'Deadline Set',
        updated_by: profile.name,
        user_role: profile.role,
        comment: `Resolution deadline set to ${body.expected_by}${body.note ? ': ' + body.note : '.'}`,
        created_at: db.tickets[idx].updated_at,
      });
      return sendJson(res, 200, db.tickets[idx]);
    }

    // 9. GET, PATCH, DELETE /api/v1/fixit/tickets/:id
    const ticketMatch = pathname.match(/^\/api\/v1\/fixit\/tickets\/([^/]+)$/);
    if (ticketMatch) {
      const id = decodeURIComponent(ticketMatch[1]);
      const idx = db.tickets.findIndex((t) => t.id === id);
      if (idx === -1) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

      if (method === 'GET') {
        const today = new Date().toISOString().split('T')[0];
        const nonFinal = ['open', 'reported', 'under_review', 'in_progress'];
        const t = db.tickets[idx];
        return sendJson(res, 200, {
          ...t,
          overdue: t.expected_by && nonFinal.includes(t.status) ? t.expected_by < today : false,
        });
      }
      if (method === 'PATCH') {
        const body = await parseBody(req);
        if (body.remove_photo === 'true' || body.remove_photo === true) {
          body.photo_url = null;
        } else if (body.photo) {
          body.photo_url = body.photo;
        }
        if (body.issue_type_id) {
          const cat = db.issueTypes.find((t) => t.id === body.issue_type_id);
          if (cat) body.issue_type = cat;
        }
        db.tickets[idx] = { ...db.tickets[idx], ...body, updated_at: new Date().toISOString() };
        return sendJson(res, 200, db.tickets[idx]);
      }
      if (method === 'DELETE') {
        db.tickets.splice(idx, 1);
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        });
        return res.end();
      }
    }

    // 10. GET & POST /api/v1/fixit/tickets/:id/timeline
    const timelineMatch = pathname.match(/^\/api\/v1\/fixit\/tickets\/([^/]+)\/timeline$/);
    if (timelineMatch) {
      const ticketId = decodeURIComponent(timelineMatch[1]);
      const ticket = db.tickets.find((t) => t.id === ticketId);
      if (!ticket) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

      if (method === 'GET') {
        const events = db.timelineEvents
          .filter((e) => e.ticket_id === ticketId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return sendJson(res, 200, { items: events, count: events.length });
      }

      if (method === 'POST') {
        const body = await parseBody(req);
        const profile = getAuthProfile(req);
        const validStages = ['reported', 'under_review', 'in_progress', 'resolved', 'closed'];

        if (!body.status || !validStages.includes(body.status)) {
          return sendJson(res, 400, {
            error: { code: 'INVALID_STATUS', message: `Invalid timeline stage. Must be one of: ${validStages.join(', ')}` },
          });
        }

        // Authorization check: Only staff or admin can transition review/progress/resolve
        if (['under_review', 'in_progress', 'resolved'].includes(body.status) && profile.role !== 'office_staff' && profile.role !== 'admin') {
          return sendJson(res, 403, {
            error: { code: 'FORBIDDEN', message: 'Only Maintenance Staff or Administrators can advance this stage.' },
          });
        }

        const newEvent = {
          id: `evt_${crypto.randomBytes(4).toString('hex')}`,
          ticket_id: ticketId,
          status: body.status,
          stage_name: STAGE_NAMES[body.status] || body.status,
          updated_by: profile.name,
          user_role: profile.role,
          comment: body.comment ? String(body.comment).trim() : undefined,
          created_at: new Date().toISOString(),
        };

        db.timelineEvents.push(newEvent);

        if (body.photo || body.photo_url) {
          ticket.photo_url = body.photo || body.photo_url;
        }

        // Sync ticket status
        if (body.status === 'resolved') {
          ticket.status = 'resolved';
          ticket.resolved_at = newEvent.created_at;
          if (body.comment) ticket.maintenance_note = body.comment;
        } else if (body.status === 'closed') {
          ticket.status = 'acknowledged';
          ticket.acknowledged_at = newEvent.created_at;
        } else if (body.status === 'in_progress' || body.status === 'under_review') {
          ticket.status = 'open';
          if (body.comment) ticket.maintenance_note = body.comment;
        }
        ticket.updated_at = newEvent.created_at;

        return sendJson(res, 201, newEvent);
      }
    }

    // 404 Not Found
    return sendJson(res, 404, {
      error: { code: 'NOT_FOUND', message: `No route for ${method} ${pathname}` },
    });
  } catch (err) {
    return sendJson(res, 500, {
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Internal Server Error' },
    });
  }
});

server.listen(PORT, () => {
  console.log(`[CampusOS Backend] Running at http://localhost:${PORT}`);
  console.log(`[CampusOS Backend] Endpoints:`);
  console.log(`  - POST http://localhost:${PORT}/api/v1/auth/login`);
  console.log(`  - POST http://localhost:${PORT}/api/v1/auth/admin/login`);
  console.log(`  - GET  http://localhost:${PORT}/api/v1/users/me`);
  console.log(`  - GET  http://localhost:${PORT}/api/v1/fixit/tickets`);
  console.log(`  - GET  http://localhost:${PORT}/api/v1/fixit/issue-types`);
});
