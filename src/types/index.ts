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
  total_trips?: number;
  completed_trips?: number;
  created_at?: string;
  updated_at?: string;
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
  notes?: string | null;
  is_container_trip?: boolean;
  expected_container_count?: number | null;
  approved_expenses_total: number;
  contribution: number;
  created_at?: string;
  updated_at?: string;
  documents?: TripDocument[];
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
  incurred_at: string;
  created_at?: string;
  fuel_analysis?: FuelAnalysis;
}

export type AdvanceStatus = 'open' | 'settled';

export interface DriverAdvance {
  id: number;
  organization_id: number;
  trip_id: number;
  trip_reference?: string;
  driver_id: number;
  driver_name?: string;
  amount_given: number;
  expenses_accepted: number;
  amount_returned: number;
  balance_remaining: number;
  status: AdvanceStatus;
  settled_at?: string | null;
  notes?: string | null;
  created_at?: string;
}

export type InvoiceStatus = 'unpaid' | 'part_paid' | 'paid' | 'overdue';

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
  balance_due: number;
  due_date: string;
  status: InvoiceStatus;
  notes?: string | null;
  created_at?: string;
  payments?: Payment[];
}

export interface Payment {
  id: number;
  organization_id: number;
  invoice_id: number;
  amount: number;
  method: 'cash' | 'mpesa' | 'bank';
  reference?: string | null;
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

export type TripDocumentType =
  | 'delivery_note'
  | 'container_interchange'
  | 'waybill'
  | 'bill_of_lading'
  | 'customs_release'
  | 'weighbridge_ticket'
  | 'proof_of_delivery';

export type TripDocumentStatus = 'pending' | 'received' | 'verified';
export type ContainerSize = '20' | '40' | '40HC';
export type ContainerType = 'dry' | 'reefer' | 'other';
export type InterchangeDirection = 'out' | 'in';

export interface TripDocumentFile {
  id: number;
  trip_document_id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  page_order: number;
  replaced_by_file_id?: number | null;
  is_current: boolean;
  download_url: string;
  uploaded_by?: number;
  uploaded_at?: string;
}

export interface TripDocument {
  id: number;
  organization_id: number;
  trip_id: number;
  trip?: Trip;
  type: TripDocumentType;
  type_label: string;
  document_number: string;
  normalized_document_number: string;
  issued_date: string;
  status: TripDocumentStatus;
  status_label: string;
  notes?: string | null;

  // Delivery note specific
  receiver_name?: string | null;
  receiver_phone?: string | null;
  delivered_at?: string | null;
  delivery_location?: string | null;
  condition_notes?: string | null;
  signed?: boolean;

  // Container interchange specific
  container_number?: string | null;
  normalized_container_number?: string | null;
  container_size?: ContainerSize | null;
  container_type?: ContainerType | null;
  seal_number?: string | null;
  interchange_direction?: InterchangeDirection | null;
  depot_or_terminal?: string | null;
  interchange_datetime?: string | null;
  free_days_end_date?: string | null;
  iso_check_digit_overridden?: boolean;
  iso_override_reason?: string | null;
  duplicate_override_reason?: string | null;

  // Concurrency & verification
  version: number;
  verified_by?: number | null;
  verified_at?: string | null;
  verified_by_user?: { id: number; name: string } | null;
  created_by?: number;
  created_by_user?: { id: number; name: string } | null;
  created_at?: string;
  updated_at?: string;

  // Files
  files?: TripDocumentFile[];
  current_files?: TripDocumentFile[];
  file_count?: number;
}

export interface StagedUploadResponse {
  status: string;
  data: {
    token: string;
    file_name: string;
    original_name: string;
    size_bytes: number;
    mime_type: string;
    sha256?: string;
  };
}


