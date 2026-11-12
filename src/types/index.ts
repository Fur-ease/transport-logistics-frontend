export type UserRole = 'owner' | 'manager' | 'accountant' | 'driver';

export interface User {
  id: number;
  organization_id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  driver_id?: number | null;
  organization?: Organization;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  fuel_alert_threshold_pct?: number;
}

export type TruckStatus = 'available' | 'on_trip' | 'maintenance' | 'inactive';

export type TrailerStatus = 'available' | 'in_use' | 'maintenance' | 'inactive';

export interface Trailer {
  id: number;
  organization_id: number;
  reg_number: string;
  type: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  capacity_tons: number;
  tare_weight_tons?: number | null;
  status: TrailerStatus;
  version?: number;
  trips_count?: number;
  active_assignment?: TruckTrailerAssignment | null;
  assignments?: TruckTrailerAssignment[];
  trips?: Trip[];
  created_at?: string;
  updated_at?: string;
}

export interface TruckTrailerAssignment {
  id: number;
  organization_id: number;
  truck_id: number;
  trailer_id: number;
  truck?: Truck;
  trailer?: Trailer;
  coupled_at: string;
  uncoupled_at?: string | null;
  odometer_at_couple?: number | null;
  odometer_at_uncouple?: number | null;
  coupled_by?: number | null;
  uncoupled_by?: number | null;
  coupled_by_user?: Pick<User, 'id' | 'name'> | null;
  uncoupled_by_user?: Pick<User, 'id' | 'name'> | null;
  couple_notes?: string | null;
  uncouple_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Truck {
  id: number;
  organization_id: number;
  reg_number: string;
  make: string;
  model: string;
  year: number;
  type: string;
  capacity_tons: number;
  odometer_km: number;
  status: TruckStatus;
  version?: number;
  total_trips?: number;
  completed_trips?: number;
  trips_count?: number;
  created_at?: string;
  updated_at?: string;
  current_assignment?: TruckTrailerAssignment | null;
  trailer_assignments?: TruckTrailerAssignment[];
  trips?: Trip[];
  maintenance_records?: MaintenanceRecord[];
  compliance_documents?: ComplianceDocument[];
}

export type DriverStatus = 'active' | 'on_trip' | 'on_leave' | 'inactive';

export interface Driver {
  id: number;
  organization_id: number;
  user_id?: number | null;
  name: string;
  phone: string;
  licence_no: string;
  licence_expiry: string;
  status: DriverStatus;
  version?: number;
  total_trips?: number;
  completed_trips?: number;
  user?: User;
  trips?: Trip[];
  advances?: DriverAdvance[];
  compliance_documents?: ComplianceDocument[];
}

export interface Customer {
  id: number;
  organization_id: number;
  name: string;
  phone: string;
  email?: string | null;
  payment_terms_days: number;
  version?: number;
  total_trips?: number;
  total_invoiced?: number;
  total_paid?: number;
  balance_owed?: number;
  aging?: {
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  };
  invoices?: Invoice[];
  trips?: Trip[];
}

export type TripStatus = 'planned' | 'in_transit' | 'delivered' | 'invoiced' | 'paid' | 'cancelled';

export interface Trip {
  id: number;
  organization_id: number;
  reference: string;
  truck_id: number;
  truck?: Truck;
  trailer_id?: number | null;
  trailer?: Trailer | null;
  driver_id: number;
  driver?: Driver;
  customer_id: number;
  customer?: Customer;
  origin: string;
  destination: string;
  cargo_description: string;
  cargo_weight_tons: number;
  agreed_rate: number;
  start_date: string;
  end_date?: string | null;
  start_odometer: number;
  end_odometer?: number | null;
  total_distance_km: number;
  status: TripStatus;
  version?: number;
  is_rate_locked?: boolean;
  has_active_unlock?: boolean;
  notes?: string | null;
  approved_expenses_total: number;
  contribution: number;
  created_at?: string;
  updated_at?: string;
  expenses?: TripExpense[];
  advances?: DriverAdvance[];
  invoice?: Invoice;
}

export type ExpenseCategory =
  | 'fuel'
  | 'allowance'
  | 'toll'
  | 'county_levy_cess'
  | 'border_fees'
  | 'loading_offloading'
  | 'repairs'
  | 'other';

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface FuelAnalysis {
  is_fuel: boolean;
  distance_km?: number;
  litres?: number;
  km_per_litre?: number | null;
  rolling_average_kml?: number | null;
  threshold_pct?: number;
  is_anomaly: boolean;
  deviation_pct?: number;
  warning?: string | null;
  reason?: string | null;
}

export interface TripExpense {
  id: number;
  organization_id: number;
  trip_id: number;
  trip_reference?: string;
  category: ExpenseCategory;
  amount: number;
  litres?: number | null;
  odometer_at_fill?: number | null;
  receipt_path?: string | null;
  entered_by: number;
  entered_by_name?: string;
  status: ExpenseStatus;
  rejection_reason?: string | null;
  version?: number;
  incurred_at: string;
  created_at?: string;
  fuel_analysis?: FuelAnalysis;
}

export type AdvanceStatus = 'open' | 'settled';

export interface AdvanceAdjustment {
  id: number;
  organization_id: number;
  driver_advance_id: number;
  amount: number;
  type: 'additional_advance' | 'reversal_credit';
  reason: string;
  created_by?: number;
  creator?: { id: number; name: string };
  created_at?: string;
}

export interface DriverAdvance {
  id: number;
  organization_id: number;
  trip_id: number;
  trip_reference?: string;
  driver_id: number;
  driver_name?: string;
  amount_given: number;
  total_adjustments?: number;
  adjusted_amount_given?: number;
  expenses_accepted: number;
  amount_returned: number;
  balance_remaining: number;
  status: AdvanceStatus;
  is_locked?: boolean;
  version?: number;
  settled_at?: string | null;
  notes?: string | null;
  created_at?: string;
  adjustments?: AdvanceAdjustment[];
}

export type InvoiceStatus = 'unpaid' | 'part_paid' | 'paid' | 'overdue';

export interface CreditNote {
  id: number;
  organization_id: number;
  invoice_id: number;
  number: string;
  amount: number;
  reason: string;
  issued_by?: number;
  status: 'applied' | 'voided';
  created_at?: string;
}

export interface Invoice {
  id: number;
  organization_id: number;
  customer_id: number;
  customer_name?: string;
  customer?: Customer;
  trip_id: number;
  trip_reference?: string;
  trip?: Trip;
  number: string;
  amount: number;
  total_paid: number;
  total_credited?: number;
  balance_due: number;
  is_amount_locked?: boolean;
  version?: number;
  due_date: string;
  status: InvoiceStatus;
  notes?: string | null;
  created_at?: string;
  payments?: Payment[];
  credit_notes?: CreditNote[];
}

export interface Payment {
  id: number;
  organization_id: number;
  invoice_id: number;
  amount: number;
  method: 'cash' | 'mpesa' | 'bank';
  reference?: string | null;
  status?: 'valid' | 'voided';
  void_reason?: string | null;
  voided_at?: string | null;
  voided_by_name?: string | null;
  paid_at: string;
  created_at?: string;
}

export interface MaintenanceRecord {
  id: number;
  organization_id: number;
  truck_id: number;
  truck?: Truck;
  type: string;
  cost: number;
  odometer: number;
  date: string;
  next_due_date?: string | null;
  next_due_km?: number | null;
  notes?: string | null;
}

export interface ComplianceDocument {
  id: number;
  organization_id: number;
  truck_id?: number | null;
  driver_id?: number | null;
  truck?: Truck;
  driver?: Driver;
  type: 'insurance' | 'ntsa_inspection' | 'licence' | 'speed_governor' | 'permit' | 'other';
  document_number?: string | null;
  expiry_date: string;
  days_until_expiry: number;
  is_expired: boolean;
  is_expiring_soon: boolean;
  notes?: string | null;
}

export interface AuditLog {
  id: number;
  organization_id: number;
  user_id?: number | null;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  auditable_type: string;
  auditable_id: number;
  action: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  reason?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface DashboardStats {
  period: {
    from: string;
    to: string;
  };
  kpis: {
    active_trips: number;
    trips_this_month: number;
    revenue: number;
    direct_costs: number;
    contribution: number;
    contribution_margin_pct: number;
    outstanding_invoices: number;
    overdue_invoices: number;
    overdue_count: number;
  };
  trips_per_truck: TripsPerTruckReport;
  top_trucks: TruckReportStat[];
  bottom_trucks: TruckReportStat[];
  alerts: DashboardAlert[];
  recent_trips: Trip[];
}

export interface DashboardAlert {
  id: string;
  type: 'document_expiry' | 'maintenance_due' | 'overdue_invoice' | 'fuel_anomaly';
  severity: 'critical' | 'high' | 'warning';
  title: string;
  message: string;
  date?: string | null;
  entity?: string | null;
}

export interface TruckReportStat {
  truck_id: number;
  reg_number: string;
  make: string;
  model: string;
  status: TruckStatus;
  capacity_tons: number;
  period: {
    from: string;
    to: string;
    days_in_period: number;
  };
  trips_made: number;
  total_km: number;
  revenue: number;
  expenses: number;
  contribution: number;
  days_on_trip: number;
  utilisation_pct: number;
  days_since_last_trip?: number | null;
}

export interface TripsPerTruckReport {
  period: {
    from: string;
    to: string;
    days: number;
  };
  summary: {
    total_trucks: number;
    total_trips_made: number;
    total_km: number;
    total_revenue: number;
    total_expenses: number;
    total_contribution: number;
    average_utilisation_pct: number;
  };
  trucks: TruckReportStat[];
}

// ── Advancement C: Trip Profit Sheet ──────────────────────────────────────────

export interface TripProfitRow {
  id: number;
  reference: string;
  date: string;
  truck_reg: string;
  driver_name: string;
  customer_name: string;
  route: string;
  revenue: number;
  fuel: number;
  allowance: number;
  tolls_levies: number;
  other_direct: number;
  total_direct_costs: number;
  contribution: number;
  margin_pct: number | null;
  is_negative: boolean;
  pending_expenses_count: number;
  month_group: string;
  status: string;
}

export interface TripProfitSummary {
  trips_count: number;
  revenue: number;
  fuel_cost: number;
  allowance_cost: number;
  tolls_levies_cost: number;
  other_direct_cost: number;
  total_direct_costs: number;
  contribution: number;
  margin_pct: number | null;
  avg_contribution_per_trip: number;
  pending_expenses_count: number;
  total_km: number;
}

export interface TripProfitGroup {
  group_key: string;
  group_type: string;
  label: string;
  subtotal: TripProfitSummary;
  items: TripProfitRow[];
}

export interface TruckSummary {
  truck_reg: string;
  truck_id: number;
  trips_made: number;
  total_km: number;
  revenue: number;
  direct_costs: number;
  contribution: number;
  margin_pct: number | null;
  contribution_per_trip: number;
}

export interface TripProfitReport {
  summary: TripProfitSummary;
  trips: TripProfitRow[];
  all_matching_trips: TripProfitRow[];
  groups: TripProfitGroup[];
  filters_applied: Record<string, unknown>;
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
  truck_summaries: TruckSummary[];
}

export interface ReportExport {
  id: number;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  format: 'pdf' | 'csv';
  scope: 'filtered' | 'all';
  row_count: number;
  file_name?: string;
  download_url?: string;
  error_message?: string;
}

// ── Advancement C: Missing Entries ────────────────────────────────────────────

export interface DataIssue {
  id: number;
  rule_key: string;
  subject_type: string;
  subject_id: number;
  truck?: { id: number; reg_number: string } | null;
  driver?: { id: number; name: string } | null;
  trip?: { id: number; reference: string; route: string } | null;
  status: 'open' | 'resolved' | 'dismissed';
  detected_at: string;
  days_outstanding: number;
  resolved_at?: string | null;
  dismissed_reason?: string | null;
  dismissed_by?: string | null;
  assigned_to?: { id: number; name: string } | null;
  meta: Record<string, unknown>;
}

export interface MissingEntriesSummary {
  total_open: number;
  by_category: Record<string, number>;
  oldest_age_days: number;
  data_completeness_pct: number;
  total_trips: number;
  clean_trips: number;
}

export interface MissingEntriesResponse {
  data: DataIssue[];
  summary: MissingEntriesSummary;
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface OrganizationRuleSetting {
  rule_key: string;
  label: string;
  category: string;
  enabled: boolean;
  threshold_days: number | null;
  threshold_amount: number | null;
  description: string;
}

