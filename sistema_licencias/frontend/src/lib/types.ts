/** Contratos de la API de TramitesBAR usados por la interfaz. */

export type Role =
  | "citizen"
  | "admin_pagos"
  | "admin_salud"
  | "admin_turnos"
  | "admin_cuentas"
  | "admin"
  | "superadmin";

export type UserStatus = "active" | "suspended" | "pending";

export type ProcedureStatus =
  | "in_progress"
  | "under_review"
  | "completed"
  | "rejected"
  | "cancelled";

export type StepStatus =
  | "pending"
  | "in_progress"
  | "scheduled"
  | "submitted"
  | "completed"
  | "rejected";

export type PaymentStatus =
  | "pending"
  | "claimed"
  | "pending_second"
  | "approved"
  | "rejected"
  | "refunded";

export type DocumentStatus = "pending" | "approved" | "rejected";

export type AppointmentStatus =
  | "available"
  | "booked"
  | "completed"
  | "no_show"
  | "cancelled";

export interface Profile {
  first_name: string;
  last_name: string;
  dni_masked: string;
  birth_date: string;
  phone: string | null;
  address: string | null;
  locality: string;
}

export interface User {
  id: number;
  email: string;
  role: Role;
  status: UserStatus;
  email_verified: boolean;
  mfa_enabled: boolean;
  profile: Profile | null;
  created_at: string;
}

export interface SessionPayload {
  user: User;
  csrf_token: string;
  mfa_enrollment_required: boolean;
}

export interface MessageResponse {
  message: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Matrix {
  id: number;
  license_category: string;
  min_age: number;
  max_age: number | null;
  fee_amount: string;
  validity_years: number;
  steps: string[];
  required_documents: string[];
  theory_questions: number;
  theory_pass_ratio: number;
  theory_minutes: number;
  max_theory_attempts: number;
  requires_health: boolean;
  requires_practical: boolean;
  notes: string | null;
}

export interface ProcedureType {
  id: number;
  code: string;
  name: string;
  short_description: string;
  description: string;
  icon: string;
  sort_order: number;
  matrix: Matrix[];
}

export interface Step {
  code: string;
  label: string;
  position: number;
  status: StepStatus;
  data: Record<string, unknown>;
  notes: string | null;
  completed_at: string | null;
}

export interface DocumentItem {
  id: number;
  kind: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  status: DocumentStatus;
  review_notes: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  reference: string;
  amount: string;
  method: string;
  status: PaymentStatus;
  receipt_document_id: number | null;
  payer_name: string | null;
  claimed_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

export interface PaymentAdmin extends Payment {
  procedure_code: string;
  citizen_email: string;
  citizen_name: string;
  second_reviewed_by: number | null;
}

export interface PaymentInstructions {
  reference: string;
  amount: string;
  status: PaymentStatus;
  alias: string | null;
  cbu: string | null;
  holder: string | null;
  bank: string | null;
  message: string;
}

export interface PaymentImport {
  id: number;
  filename: string;
  total_rows: number;
  matched_rows: number;
  exception_rows: number;
  created_at: string;
  details: Record<string, unknown>;
}

export interface LicenseSummary {
  id: number;
  license_number: string;
  category: string;
  issued_at: string;
  expires_at: string;
  status: string;
  qr_token: string;
}

export interface Procedure {
  id: number;
  public_code: string;
  procedure_type: ProcedureType;
  matrix: Matrix;
  license_category: string;
  status: ProcedureStatus;
  current_step: string | null;
  steps: Step[];
  documents: DocumentItem[];
  payment: Payment | null;
  license: LicenseSummary | null;
  data: Record<string, unknown>;
  rejection_reason: string | null;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
}

export interface ProcedureListItem {
  id: number;
  public_code: string;
  procedure_type_code: string;
  procedure_type_name: string;
  license_category: string;
  status: ProcedureStatus;
  current_step: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface UserSummary {
  id: number;
  email: string;
  name: string;
  dni_masked: string;
}

export interface AdminProcedure extends Procedure {
  citizen: UserSummary;
}

export interface Appointment {
  id: number;
  scheduled_at: string;
  location: string;
  instructor: string | null;
  status: AppointmentStatus;
  result: "passed" | "failed" | null;
  notes: string | null;
}

export interface AdminAppointment extends Appointment {
  kind: string;
  capacity: number;
  procedure_id: number | null;
  procedure_code: string | null;
  citizen_name: string | null;
}

export interface AttemptQuestion {
  index: number;
  prompt: string;
  options: string[];
}

export interface AttemptStart {
  attempt_id: number;
  questions: AttemptQuestion[];
  total: number;
  pass_score: number;
  started_at: string;
  expires_at: string;
}

export interface AttemptResult {
  attempt_id: number;
  status: string;
  score: number;
  total: number;
  pass_score: number;
  passed: boolean;
  submitted_at: string | null;
}

export interface AttemptSummary {
  id: number;
  attempt_number: number;
  status: string;
  score: number | null;
  total: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
}

export interface License {
  id: number;
  license_number: string;
  category: string;
  issued_at: string;
  expires_at: string;
  status: string;
  qr_token: string;
  verify_path: string;
}

export interface PublicLicense {
  found: boolean;
  license_number: string | null;
  holder: string | null;
  category: string | null;
  status: string | null;
  issued_at: string | null;
  expires_at: string | null;
  municipality: string;
  message: string;
  verified_at: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  items: NotificationItem[];
  unread: number;
}

export interface PolicySummary {
  slug: string;
  title: string;
  version: number;
  mandatory: boolean;
  content_hash: string;
  effective_at: string;
}

export interface Policy extends PolicySummary {
  body_md: string;
}

export interface LearningMaterial {
  id: number;
  code: string;
  title: string;
  description: string;
  kind: string;
  url: string | null;
  body_md: string | null;
  sort_order: number;
}

export interface BariChatResponse {
  answer: string;
  intent: string;
  links: Array<{ label?: string; href?: string; url?: string }>;
  suggestions: string[];
  source: string;
}

export interface BariGuide {
  procedure_code: string;
  procedure_name: string;
  steps: Array<Record<string, unknown>>;
  materials: LearningMaterial[];
}

export interface Dashboard {
  procedures_by_status: Record<string, number>;
  payments_pending: number;
  documents_pending: number;
  appointments_upcoming: number;
  licenses_active: number;
  users_total: number;
  questions_reviewed: number;
  questions_pending: number;
}

export interface UserAdmin {
  id: number;
  email: string;
  role: Role;
  status: UserStatus;
  email_verified: boolean;
  mfa_enabled: boolean;
  name: string | null;
  dni_masked: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface Question {
  id: number;
  category: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  active: boolean;
  reviewed: boolean;
  source: string | null;
}

export interface AuditEntry {
  id: number;
  actor_user_id: number | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
  entry_hash: string;
}

export interface AuditVerify {
  valid: boolean;
  checked: number;
  broken_at: number | null;
  message: string;
}

export interface LicenseAdmin {
  id: number;
  license_number: string;
  category: string;
  issued_at: string;
  expires_at: string;
  status: string;
  citizen_email: string;
  citizen_name: string;
  procedure_code: string;
}

export interface AdminPolicy {
  id: number;
  slug: string;
  title: string;
  version: number;
  mandatory: boolean;
  active: boolean;
  effective_at: string;
  content_hash: string;
}

export interface MfaSetup {
  secret: string;
  otpauth_uri: string;
}

export interface MfaRecovery {
  recovery_codes: string[];
}

export interface SessionInfo {
  id: number;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  is_current: boolean;
}
