export interface User {
  id: number;
  name: string;
  email: string;
  department: string;
  role: string;
  avatar?: string;
  settings?: string; // JSON string
}

export interface TimeLog {
  id: number;
  user_id: number;
  date: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: number | null;
  notes?: string;
}

export interface AuthResponse {
  user: User;
  success: boolean;
}

export interface Client {
  id: number;
  code?: string;
  web_login?: string;
  name: string;
  contact?: string;
  phone?: string;
  cell_phone?: string;
  fax?: string;
  email?: string;
  pec?: string;
  address?: string;
  postcode?: string;
  city?: string;
  province?: string;
  region?: string;
  country?: string;
  fiscal_code?: string;
  vat_code?: string;
  sdi_pec?: string;
  delivery_name?: string;
  delivery_address?: string;
  delivery_postcode?: string;
  delivery_city?: string;
  delivery_province?: string;
  delivery_country?: string;
  price_list?: string;
  payment_name?: string;
  payment_bank?: string;
  custom_field1?: string;
  custom_field2?: string;
  notes?: string;
  agente?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  phone: string;
  email: string;
  category: string;
  notes: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
}

export type TaskStatus = 'Nuovo' | 'In Corso' | 'In Attesa' | 'Completato' | 'Annullato';
export type TaskType = 'cliente' | 'interno' | 'fornitore' | 'chiamata';
export type TaskPriority = 'Bassa' | 'Media' | 'Alta' | 'Urgente';

export interface Task {
  id: number;
  title: string;
  description: string;
  internal_notes?: string;
  category_id: number;
  category_name?: string;
  assignee_id: number;
  assignee_name?: string;
  status: TaskStatus;
  type: TaskType;
  priority: TaskPriority;
  client_id: number | null;
  client_name?: string;
  supplier_id: number | null;
  supplier_name?: string;
  creator_id: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  activity_source?: 'task' | 'call';
  call_duration?: number;
  duration_minutes?: number;
}

export interface Call {
  id: number;
  caller_name: string;
  caller_type: 'cliente' | 'fornitore' | 'esterno';
  reason: string;
  duration: number;
  task_id?: number;
  task_title?: string;
  user_id: number;
  user_name?: string;
  created_at: string;
  duration_minutes?: number;
}

export interface TaskHistory {
  id: number;
  task_id: number;
  user_id: number | null;
  user_name?: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface Attachment {
  id: number;
  task_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  created_at: string;
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  expiredTasks: number;
  todayActivities: number;
  latestCalls: Call[];
  tasksByStatus: { status: string; count: number }[];
  tasksByPriority: { priority: string; count: number }[];
  tasksByDepartment: { department: string; count: number }[];
}

export interface AgentVisit {
  id: number;
  agent_id: number;
  agent_name?: string;
  client_id: number;
  client_name?: string;
  client_address?: string;
  client_city?: string;
  client_contact?: string;
  client_phone?: string;
  client_email?: string;
  client_agente?: string;
  visit_date: string;
  time_slot: string;
  notes?: string;
  is_joint: boolean | number;
  host_agent_id?: number;
  host_agent_name?: string;
  guest_agent_id?: number;
  guest_agent_name?: string;
  created_at: string;
}

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface CoVisitInvite {
  id: number;
  visit_id: number;
  host_agent_id: number;
  host_agent_name?: string;
  guest_agent_id: number;
  guest_agent_name?: string;
  client_id: number;
  client_name?: string;
  client_city?: string;
  client_address?: string;
  visit_date: string;
  time_slot: string;
  status: InviteStatus;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  code: string;
  description: string;
  price: number;
  vat_code: string;
  um: string;
  stock: number;
  created_at?: string;
  barcode?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description_html?: string | null;
  producer_name?: string | null;
  link?: string | null;
  notes?: string | null;
  image_file_name?: string | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
  supplier_product_code?: string | null;
  supplier_net_price?: number | null;
  supplier_gross_price?: number | null;
  supplier_notes?: string | null;
  manage_warehouse?: number | null;
  warehouse_location?: string | null;
  min_stock?: number | null;
  ordered_qty?: number | null;
  weight_um?: string | null;
  net_weight?: number | null;
  gross_weight?: number | null;
  size_um?: string | null;
  net_size_x?: number | null;
  net_size_y?: number | null;
  net_size_z?: number | null;
  custom_field1?: string | null;
  custom_field2?: string | null;
  custom_field3?: string | null;
  custom_field4?: string | null;
  online_promo?: string | null;
  online_warranty?: string | null;
  online_category_image?: string | null;
  online_notes?: string | null;
  online_customized?: number | null;
  classe_provvigione?: string | null;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_code: string;
  description: string;
  qty: number;
  price: number;
  vat_code: string;
  um: string;
}

export interface Order {
  id: number;
  client_id: number;
  client_name: string;
  client_email?: string;
  client_city?: string;
  client_phone?: string;
  agent_id: number | null;
  agent_name: string | null;
  date: string;
  number: string;
  formatted_number?: string;
  payment_name: string;
  payment_bank?: string;
  notes?: string;
  total: number;
  status: string;
  is_imported?: number | boolean;
  is_synced?: number | boolean;
  synced_at?: string | null;
  created_at: string;
  items?: OrderItem[];
}

export interface PaymentMethod {
  id: number;
  name: string;
  installments: number;
  offset_days: number;
  fine_mese: number;
  is_custom_offsets?: number;
  custom_offsets_json?: string;
}
