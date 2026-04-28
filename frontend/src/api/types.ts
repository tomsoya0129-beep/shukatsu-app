export interface User {
  id: number;
  first_name: string;
  birthday: string;
  display_name: string | null;
  email: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Company {
  id: number;
  user_id: number;
  name: string;
  industry: string | null;
  location: string | null;
  recruit_url: string | null;
  mypage_url: string | null;
  login_id: string | null;
  color: string;
  tags: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyInput = Omit<
  Company,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export interface Internship {
  id: number;
  user_id: number;
  company_id: number;
  title: string | null;
  entry_deadline: string | null;
  entry_deadline_time: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  mode: "online" | "offline" | "hybrid";
  online_url: string | null;
  meeting_code: string | null;
  meeting_password: string | null;
  related_url: string | null;
  memo: string | null;
  briefing_date: string | null;
  briefing_time: string | null;
  status:
    | "not_applied"
    | "applied"
    | "waiting"
    | "accepted"
    | "rejected"
    | "completed";
  created_at: string;
  updated_at: string;
  steps: InternshipStep[];
  sessions: InternshipSession[];
}

export interface InternshipSession {
  id: number;
  internship_id: number;
  label: string | null;
  order_index: number;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  mode: "online" | "offline" | null;
  location: string | null;
  online_url: string | null;
  meeting_code: string | null;
  meeting_password: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export type InternshipSessionInput = Omit<
  InternshipSession,
  "id" | "internship_id" | "created_at" | "updated_at"
>;

export interface InternshipStep {
  id: number;
  internship_id: number;
  step_type: StepType;
  label: string | null;
  order_index: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
  start_date: string | null;
  start_time: string | null;
  location: string | null;
  mode: "online" | "offline" | null;
  online_url: string | null;
  meeting_code: string | null;
  meeting_password: string | null;
  result: "pending" | "waiting" | "passed" | "failed" | "skipped";
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export type InternshipStepInput = Omit<
  InternshipStep,
  "id" | "internship_id" | "created_at" | "updated_at"
>;

export type InternshipInput = Omit<
  Internship,
  "id" | "user_id" | "created_at" | "updated_at" | "steps" | "sessions"
>;

export type StepType =
  | "briefing"
  | "es"
  | "aptitude"
  | "gd"
  | "interview_1"
  | "interview_2"
  | "interview_3"
  | "interview_final"
  | "other";

export interface SelectionStep {
  id: number;
  selection_id: number;
  step_type: StepType;
  label: string | null;
  order_index: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
  start_date: string | null;
  start_time: string | null;
  location: string | null;
  mode: "online" | "offline" | null;
  online_url: string | null;
  meeting_code: string | null;
  meeting_password: string | null;
  result: "pending" | "waiting" | "passed" | "failed" | "skipped";
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export type SelectionStepInput = Omit<
  SelectionStep,
  "id" | "selection_id" | "created_at" | "updated_at"
>;

export type DocType =
  | "resume"
  | "transcript"
  | "health_check"
  | "portfolio"
  | "cover_letter"
  | "other";

export interface Submission {
  id: number;
  selection_id: number;
  doc_type: DocType;
  label: string | null;
  deadline: string | null;
  submitted: boolean;
  memo: string | null;
}

export type SubmissionInput = Omit<Submission, "id" | "selection_id">;

export interface Selection {
  id: number;
  user_id: number;
  company_id: number;
  title: string | null;
  entry_deadline?: string | null;
  entry_deadline_time?: string | null;
  aptitude_deadline?: string | null;
  aptitude_deadline_time?: string | null;
  result_announcement_date: string | null;
  overall_status:
    | "in_progress"
    | "waiting"
    | "offer"
    | "accepted"
    | "declined"
    | "rejected"
    | "withdrawn";
  offer_deadline: string | null;
  offer_event_date: string | null;
  offer_salary: string | null;
  offer_location: string | null;
  memo: string | null;
  steps: SelectionStep[];
  submissions: Submission[];
  created_at: string;
  updated_at: string;
}

export type SelectionInput = Omit<
  Selection,
  "id" | "user_id" | "steps" | "submissions" | "created_at" | "updated_at"
>;

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  color: string;
  kind:
    | "intern_period"
    | "intern_deadline"
    | "intern_briefing"
    | "selection_deadline"
    | "step"
    | "offer_deadline"
    | "result";
  company_id: number;
  ref_id: number;
  allDay: boolean;
  extra: Record<string, unknown>;
}

export interface DashboardSummary {
  active_selections: number;
  offers: number;
  upcoming_events: CalendarEvent[];
  total_companies: number;
  total_internships: number;
}

export interface Reminder {
  id: number;
  ref_type: string;
  ref_id: number;
  title: string;
  remind_at: string;
  channel: "inapp" | "email";
  sent: boolean;
}
