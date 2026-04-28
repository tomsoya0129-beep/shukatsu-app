import { api } from "./client";
import type {
  CalendarEvent,
  Company,
  CompanyInput,
  DashboardSummary,
  Internship,
  InternshipInput,
  InternshipSession,
  InternshipSessionInput,
  InternshipStep,
  InternshipStepInput,
  LoginResponse,
  Reminder,
  Selection,
  SelectionInput,
  SelectionStep,
  SelectionStepInput,
  Submission,
  SubmissionInput,
  User,
} from "./types";

// --- Auth ---
export async function signup(data: {
  first_name: string;
  birthday: string;
  display_name?: string;
  email?: string;
}): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>("/api/auth/signup", data);
  return res.data;
}

export async function login(data: {
  first_name: string;
  birthday: string;
}): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>("/api/auth/login", data);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>("/api/auth/me");
  return res.data;
}

export async function updateMe(data: {
  display_name?: string | null;
  email?: string | null;
}): Promise<User> {
  const res = await api.patch<User>("/api/auth/me", data);
  return res.data;
}

// --- Companies ---
export async function listCompanies(): Promise<Company[]> {
  const res = await api.get<Company[]>("/api/companies");
  return res.data;
}
export async function createCompany(data: CompanyInput): Promise<Company> {
  const res = await api.post<Company>("/api/companies", data);
  return res.data;
}
export async function updateCompany(
  id: number,
  data: Partial<CompanyInput>
): Promise<Company> {
  const res = await api.patch<Company>(`/api/companies/${id}`, data);
  return res.data;
}
export async function deleteCompany(id: number): Promise<void> {
  await api.delete(`/api/companies/${id}`);
}
export async function reorderCompanies(ids: number[]): Promise<void> {
  await api.post("/api/companies/reorder", { ids });
}

// --- Internships ---
export async function listInternships(): Promise<Internship[]> {
  const res = await api.get<Internship[]>("/api/internships");
  return res.data;
}
export async function createInternship(
  data: InternshipInput
): Promise<Internship> {
  const res = await api.post<Internship>("/api/internships", data);
  return res.data;
}
export async function updateInternship(
  id: number,
  data: Partial<InternshipInput>
): Promise<Internship> {
  const res = await api.patch<Internship>(`/api/internships/${id}`, data);
  return res.data;
}
export async function deleteInternship(id: number): Promise<void> {
  await api.delete(`/api/internships/${id}`);
}
export async function reorderInternships(ids: number[]): Promise<void> {
  await api.post("/api/internships/reorder", { ids });
}
export async function addInternshipStep(
  internshipId: number,
  data: InternshipStepInput
): Promise<InternshipStep> {
  const res = await api.post<InternshipStep>(
    `/api/internships/${internshipId}/steps`,
    data
  );
  return res.data;
}
export async function updateInternshipStep(
  internshipId: number,
  stepId: number,
  data: Partial<InternshipStepInput>
): Promise<InternshipStep> {
  const res = await api.patch<InternshipStep>(
    `/api/internships/${internshipId}/steps/${stepId}`,
    data
  );
  return res.data;
}
export async function deleteInternshipStep(
  internshipId: number,
  stepId: number
): Promise<void> {
  await api.delete(`/api/internships/${internshipId}/steps/${stepId}`);
}
export async function addInternshipSession(
  internshipId: number,
  data: InternshipSessionInput
): Promise<InternshipSession> {
  const res = await api.post<InternshipSession>(
    `/api/internships/${internshipId}/sessions`,
    data
  );
  return res.data;
}
export async function updateInternshipSession(
  internshipId: number,
  sessionId: number,
  data: Partial<InternshipSessionInput>
): Promise<InternshipSession> {
  const res = await api.patch<InternshipSession>(
    `/api/internships/${internshipId}/sessions/${sessionId}`,
    data
  );
  return res.data;
}
export async function deleteInternshipSession(
  internshipId: number,
  sessionId: number
): Promise<void> {
  await api.delete(`/api/internships/${internshipId}/sessions/${sessionId}`);
}

// --- Selections ---
export async function listSelections(): Promise<Selection[]> {
  const res = await api.get<Selection[]>("/api/selections");
  return res.data;
}
export async function createSelection(
  data: SelectionInput
): Promise<Selection> {
  const res = await api.post<Selection>("/api/selections", data);
  return res.data;
}
export async function updateSelection(
  id: number,
  data: Partial<SelectionInput>
): Promise<Selection> {
  const res = await api.patch<Selection>(`/api/selections/${id}`, data);
  return res.data;
}
export async function deleteSelection(id: number): Promise<void> {
  await api.delete(`/api/selections/${id}`);
}
export async function reorderSelections(ids: number[]): Promise<void> {
  await api.post("/api/selections/reorder", { ids });
}
export async function addStep(
  selectionId: number,
  data: SelectionStepInput
): Promise<SelectionStep> {
  const res = await api.post<SelectionStep>(
    `/api/selections/${selectionId}/steps`,
    data
  );
  return res.data;
}
export async function updateStep(
  selectionId: number,
  stepId: number,
  data: Partial<SelectionStepInput>
): Promise<SelectionStep> {
  const res = await api.patch<SelectionStep>(
    `/api/selections/${selectionId}/steps/${stepId}`,
    data
  );
  return res.data;
}
export async function deleteStep(
  selectionId: number,
  stepId: number
): Promise<void> {
  await api.delete(`/api/selections/${selectionId}/steps/${stepId}`);
}
export async function addSubmission(
  selectionId: number,
  data: SubmissionInput
): Promise<Submission> {
  const res = await api.post<Submission>(
    `/api/selections/${selectionId}/submissions`,
    data
  );
  return res.data;
}
export async function updateSubmission(
  selectionId: number,
  submissionId: number,
  data: Partial<SubmissionInput>
): Promise<Submission> {
  const res = await api.patch<Submission>(
    `/api/selections/${selectionId}/submissions/${submissionId}`,
    data
  );
  return res.data;
}
export async function deleteSubmission(
  selectionId: number,
  submissionId: number
): Promise<void> {
  await api.delete(`/api/selections/${selectionId}/submissions/${submissionId}`);
}

// --- Calendar / Dashboard ---
export async function calendarEvents(): Promise<CalendarEvent[]> {
  const res = await api.get<CalendarEvent[]>("/api/calendar/events");
  return res.data;
}
export async function dashboardSummary(): Promise<DashboardSummary> {
  const res = await api.get<DashboardSummary>("/api/dashboard");
  return res.data;
}

// --- Notifications ---
export interface NotificationPrefs {
  email_enabled: boolean;
  deadline_3d: boolean;
  deadline_1d: boolean;
  aptitude_3d: boolean;
  aptitude_1d: boolean;
  interview_1d: boolean;
  interview_1h: boolean;
  intern_start_1d: boolean;
  intern_start_1h: boolean;
  briefing_1d: boolean;
  briefing_1h: boolean;
  submission_3d: boolean;
  submission_1d: boolean;
  offer_3d: boolean;
  offer_1d: boolean;
}
export interface PrefsResponse {
  email: string | null;
  prefs: NotificationPrefs;
  provider?: string;
  configured?: boolean;
}
export async function getPrefs(): Promise<PrefsResponse> {
  const res = await api.get<PrefsResponse>("/api/notifications/prefs");
  return res.data;
}
export async function updatePrefs(data: {
  email?: string | null;
  prefs?: NotificationPrefs;
}): Promise<PrefsResponse> {
  const res = await api.patch<PrefsResponse>("/api/notifications/prefs", data);
  return res.data;
}
export async function sendTestEmail(): Promise<{ ok: boolean; to: string }> {
  const res = await api.post("/api/notifications/test");
  return res.data as { ok: boolean; to: string };
}
export async function regenerateReminders(): Promise<{ ok: boolean; reminders: number }> {
  const res = await api.post("/api/notifications/regenerate");
  return res.data as { ok: boolean; reminders: number };
}

// --- Reminders ---
export async function listReminders(): Promise<Reminder[]> {
  const res = await api.get<Reminder[]>("/api/reminders");
  return res.data;
}
export async function listDueReminders(): Promise<Reminder[]> {
  const res = await api.get<Reminder[]>("/api/reminders/due");
  return res.data;
}

// --- AI Import ---
export interface ParsedEvent {
  company_name: string | null;
  event_kind: string | null;
  step_type: string | null;
  label: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  mode: "online" | "offline" | null;
  location: string | null;
  online_url: string | null;
  meeting_code: string | null;
  meeting_password: string | null;
  mypage_url: string | null;
  recruit_url: string | null;
  login_id: string | null;
  notes: string | null;
}
export interface ParseResponse {
  parsed: ParsedEvent;
  raw_text?: string | null;
  confidence?: string | null;
}
export async function parseImportText(text: string): Promise<ParseResponse> {
  const res = await api.post<ParseResponse>("/api/import/parse-text", { text });
  return res.data;
}
export async function parseImportImage(file: File): Promise<ParseResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await api.post<ParseResponse>("/api/import/parse-image", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
export async function getImportStatus(): Promise<{ available: boolean; model: string | null }> {
  const res = await api.get("/api/import/status");
  return res.data as { available: boolean; model: string | null };
}
