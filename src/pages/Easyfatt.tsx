import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  RefreshCw, 
  Package, 
  Users, 
  ShoppingCart, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  FileText,
  FileSpreadsheet,
  Copy,
  Info,
  X,
  Search,
  CheckSquare,
  Square,
  Eye,
  Sliders,
  Save,
  Filter,
  ArrowUpDown,
  Layers,
  ExternalLink,
  Image as ImageIcon,
  Tag,
  ArrowLeft,
  Minus,
  Check,
  ChevronDown,
  DollarSign,
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,
  Lock,
  Calendar,
  Clock,
  Printer,
  Building,
  CreditCard,
  MapPin,
  Percent,
  AlertTriangle,
  XCircle,
  ZoomIn,
  Truck,
  ChevronRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import GirovisiteSection from '../components/GirovisiteSection';
import ClientSalesHistory from '../components/ClientSalesHistory';
import { printOrderDocument, copyOrderToClipboard, setCachedCompanyHeader } from '../utils/printAndCopyOrder';
import EditableAmountInput from '../components/EditableAmountInput';
import { useTablePagination } from '../hooks/useTablePagination';
import { DataTablePagination } from '../components/DataTablePagination';
import { TableSortHeader } from '../components/TableSortHeader';
import { calculateTaxable, calculateLineTotals, calculateOrderTotals, formatEuro } from '../utils/priceUtils';

interface Product {
  id: number;
  code: string;
  description: string;
  price: number;
  vat_code: string;
  um: string;
  stock: number;
  created_at: string;
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
  [key: string]: any;
}

interface OrderItem {
  id: number;
  order_id: number;
  product_code: string;
  description: string;
  qty: number;
  price: number;
  vat_code: string;
  um: string;
}

interface Order {
  id: number;
  client_id: number;
  client_name: string;
  client_email: string;
  client_city?: string;
  client_phone?: string;
  agent_id: number | null;
  agent_name: string | null;
  date: string;
  number: string;
  payment_name: string;
  payment_bank: string;
  notes: string;
  total: number;
  status: string;
  is_imported?: number | boolean;
  created_at: string;
  items?: OrderItem[];
}

interface Client {
  id: number;
  code?: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  city: string;
  province?: string;
  region?: string;
  notes: string;
  agente?: string;
}

function parseClientNotes(notesStr: string | null | undefined) {
  if (!notesStr) return { rawNotes: '', daneaData: {} as Record<string, string> };

  let rawNotes = notesStr;
  let daneaData: Record<string, string> = {};

  // Check if there is JSON metadata
  if (notesStr.includes('---DANEA_METADATA---')) {
    const parts = notesStr.split('---DANEA_METADATA---');
    rawNotes = parts[0].trim();
    try {
      daneaData = JSON.parse(parts[1].trim());
    } catch (e) {
      console.error("Failed to parse DANEA_METADATA JSON", e);
    }
  } else {
    // Let's also extract key-value pairs written as text lines
    const lines = notesStr.split('\n');
    const remainingLines: string[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Match common patterns
      const prefixes = [
        { key: 'Note', label: 'Note' },
        { key: 'Note Documenti', label: 'Note doc.' },
        { key: 'Indirizzo', label: 'Indirizzo' },
        { key: 'Cod. Fiscale', label: 'Codice fiscale' },
        { key: 'P. IVA', label: 'Partita Iva' },
        { key: 'Cod. Destinatario SDIC', label: 'Cod. destinatario Fatt. elettr.' },
        { key: 'Pagamento', label: 'Pagamento' },
        { key: 'Banca', label: 'Banca' },
        { key: 'Listino', label: 'Listino' },
        { key: 'Agente', label: 'Agente' },
      ];

      let matched = false;
      for (const pref of prefixes) {
        if (trimmed.startsWith(`${pref.key}:`)) {
          const val = trimmed.substring(pref.key.length + 1).trim();
          if (val) {
            daneaData[pref.label] = val;
          }
          matched = true;
          break;
        }
      }

      if (!matched) {
        remainingLines.push(line);
      }
    });

    // If we parsed prefixes, rawNotes is the rest of the lines
    if (Object.keys(daneaData).length > 0) {
      // Remove any parsed line fields from the notes
      rawNotes = remainingLines.join('\n').trim();
    }
  }

  return { rawNotes, daneaData };
}

export default function Easyfatt({ user, initialTab }: { user?: any; initialTab?: 'orders' | 'clients' | 'products' | 'stats' | 'girovisite' }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'clients' | 'products' | 'stats' | 'girovisite'>(initialTab || 'orders');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      setIsAdminMode(false);
    }
  }, [initialTab]);
  
  // Determine if user has administrator permissions
  const isUserAdmin = user?.role === 'amministratore' || user?.role === 'admin' || user?.department?.toLowerCase().includes('admin') || user?.department?.toLowerCase().includes('direzione');
  
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminTab, setAdminTab] = useState<'connections' | 'commercial-logic' | 'xml-files' | 'manage-products' | 'orders-log' | 'payment-methods' | 'company-header'>('connections');

  const [companyHeader, setCompanyHeader] = useState({
    company_name: 'Connect Beauty S.r.l.',
    company_address: 'Via Armando Diaz 162',
    company_postcode: '35010',
    company_city: 'Vigonza',
    company_province: 'PD',
    company_country: 'Italia',
    company_vat_code: '00165987261',
    company_fiscal_code: '00165987261',
    company_tel: '049/1234567',
    company_fax: '049/1234568',
    company_email: 'info@connect-beauty.it',
    company_pec: 'connectbeauty@pec.it',
    company_website: 'www.connect-beauty.it',
    company_logo: ''
  });
  const [savingCompanyHeader, setSavingCompanyHeader] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [pmForm, setPmForm] = useState<{
    id: number | null;
    name: string;
    offset_days: number;
    installments: number;
    fine_mese: boolean;
    is_custom_offsets: boolean;
    custom_offsets: number[];
  }>({
    id: null,
    name: '',
    offset_days: 30,
    installments: 1,
    fine_mese: false,
    is_custom_offsets: false,
    custom_offsets: [60, 90, 120]
  });
  const [editingPmId, setEditingPmId] = useState<number | null>(null);
  const [pmSearchFilter, setPmSearchFilter] = useState('');

  useEffect(() => {
    if (user) {
      const adminStatus = user.role === 'amministratore' || user.role === 'admin' || user.department?.toLowerCase().includes('admin') || user.department?.toLowerCase().includes('direzione');
      setIsAdminMode(adminStatus);
    }
  }, [user]);
  
  // States for products
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  
  // Advanced catalog states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [productSortBy, setProductSortBy] = useState<'description' | 'price-asc' | 'price-desc' | 'stock-desc'>('description');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modalSubTab, setModalSubTab] = useState<'base' | 'ext' | 'online'>('base');
  const [productForm, setProductForm] = useState({
    code: '',
    description: '',
    price: '',
    vat_code: '22',
    um: 'pz',
    stock: '',
    barcode: '',
    category: '',
    subcategory: '',
    producer_name: '',
    link: '',
    notes: '',
    image_file_name: '',
    custom_field1: '',
    custom_field2: '',
    custom_field3: '',
    custom_field4: '',
    online_promo: '',
    online_warranty: '',
    online_category_image: '',
    online_notes: '',
    online_customized: false
  });

  // States for clients
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  // States for orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // States for XML Order Import (Danea Easyfatt Historical Orders)
  const [isOrdersXmlModalOpen, setIsOrdersXmlModalOpen] = useState(false);
  const [isImportingOrdersXml, setIsImportingOrdersXml] = useState(false);
  const [ordersXmlLogs, setOrdersXmlLogs] = useState<{
    success: boolean;
    importedCount: number;
    skippedOrdersCount: number;
    skippedRowsCount: number;
    autoCreatedPaymentMethods: number;
    logs: { level: 'success' | 'warning' | 'info' | 'error'; message: string }[];
  } | null>(null);
  
  // New order form states
  const [orderForm, setOrderForm] = useState({
    client_id: '',
    date: new Date().toISOString().split('T')[0],
    payment_name: 'Bonifico bancario',
    payment_bank: '',
    notes: '',
    items: [] as Array<{
      product_code: string;
      description: string;
      qty: number;
      price: number;
      vat_code: string;
      um: string;
    }>
  });
  const [selectedProductCode, setSelectedProductCode] = useState('');
  const [selectedProductQty, setSelectedProductQty] = useState(1);
  const [selectedProductPrice, setSelectedProductPrice] = useState(0);

  // Advanced Order Creation Workspace States
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [orderProductSearch, setOrderProductSearch] = useState('');
  const [orderSelectedCategory, setOrderSelectedCategory] = useState<string | null>(null);
  const [orderOnlyAvailable, setOrderOnlyAvailable] = useState(false);
  const [orderProductSortBy, setOrderProductSortBy] = useState<'description' | 'price-asc' | 'price-desc' | 'stock-desc'>('description');
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [isStickyCartOpen, setIsStickyCartOpen] = useState(false);

  // States for UX/UI Optimizations (Tablet-first & Collapsible Accordions)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [isLogisticsOpen, setIsLogisticsOpen] = useState(false);
  const [isDaneaDataOpen, setIsDaneaDataOpen] = useState(false);
  const [isClientHistoryOpen, setIsClientHistoryOpen] = useState(false);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [isWarehouseInfoOpen, setIsWarehouseInfoOpen] = useState(false);

  const handleOpenProductDetail = (p: Product) => {
    setIsWarehouseInfoOpen(false);
    setSelectedDetailProduct(p);
  };

  // States for Stats and Client Detail popup
  const [selectedDetailClient, setSelectedDetailClient] = useState<Client | null>(null);
  const [isClientDetailOpen, setIsClientDetailOpen] = useState(false);
  const [clientModalTab, setClientModalTab] = useState<'panoramica' | 'storico'>('panoramica');
  const [hidePastDeadlines, setHidePastDeadlines] = useState(false);
  const [statsTimeRange, setStatsTimeRange] = useState<'all' | 'year' | 'month' | '30days'>('all');
  const [statsStatusFilter, setStatsStatusFilter] = useState<'all' | 'completed' | 'draft'>('all');
  const [statsAgentFilter, setStatsAgentFilter] = useState<string>('all');
  const [statsChartMetric, setStatsChartMetric] = useState<'revenue' | 'orders'>('revenue');

  // --- UNIVERSAL SERVER-SIDE PAGINATION & DYNAMIC SORTING (Orders Views) ---
  interface AgentOrderTableFilters {
    search: string;
    status: string;
    month: string;
    agent: string;
  }

  const agentOrdersPagination = useTablePagination<AgentOrderTableFilters>({
    initialPage: 1,
    initialLimit: 25,
    initialSortBy: 'date',
    initialSortOrder: 'desc',
    initialFilters: {
      search: '',
      status: 'all',
      month: selectedMonthFilter,
      agent: statsAgentFilter,
    },
  });

  const [agentOrdersData, setAgentOrdersData] = useState<Order[]>([]);
  const [isAgentOrdersLoading, setIsAgentOrdersLoading] = useState(false);

  interface AdminOrderTableFilters {
    search: string;
    status: string;
  }

  const adminOrdersPagination = useTablePagination<AdminOrderTableFilters>({
    initialPage: 1,
    initialLimit: 25,
    initialSortBy: 'date',
    initialSortOrder: 'desc',
    initialFilters: {
      search: '',
      status: 'all',
    },
  });

  const [adminOrdersData, setAdminOrdersData] = useState<Order[]>([]);
  const [isAdminOrdersLoading, setIsAdminOrdersLoading] = useState(false);

  useEffect(() => {
    if (agentOrdersPagination.filters.month !== selectedMonthFilter) {
      agentOrdersPagination.setFilter('month', selectedMonthFilter);
    }
  }, [selectedMonthFilter]);

  useEffect(() => {
    if (agentOrdersPagination.filters.agent !== statsAgentFilter) {
      agentOrdersPagination.setFilter('agent', statsAgentFilter);
    }
  }, [statsAgentFilter]);

  // --- STATS SYSTEM COMPUTATIONS ---
  const stats = React.useMemo(() => {
    // 1. Filter orders based on user selected time range, status, and agent
    let filteredOrders = [...orders];

    if (statsStatusFilter === 'completed') {
      filteredOrders = filteredOrders.filter(o => o.status === 'Esportato' || o.status === 'Confermato' || o.status === 'Inviato');
    } else if (statsStatusFilter === 'draft') {
      filteredOrders = filteredOrders.filter(o => o.status === 'Bozza');
    }

    if (statsAgentFilter !== 'all') {
      filteredOrders = filteredOrders.filter(o => o.agent_name === statsAgentFilter);
    }

    if (selectedMonthFilter !== 'ALL') {
      filteredOrders = filteredOrders.filter(o => o.date && o.date.startsWith(selectedMonthFilter));
    }

    const now = new Date();
    if (statsTimeRange === 'year') {
      const currentYear = now.getFullYear();
      filteredOrders = filteredOrders.filter(o => {
        const d = new Date(o.date);
        return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
      });
    } else if (statsTimeRange === 'month') {
      const monthPrefix = now.toISOString().substring(0, 7);
      filteredOrders = filteredOrders.filter(o => o.date && o.date.startsWith(monthPrefix));
    } else if (statsTimeRange === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredOrders = filteredOrders.filter(o => {
        const d = new Date(o.date);
        return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
      });
    }

    // 2. Orders / Sales stats
    const totalSales = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const draftSales = filteredOrders.filter(o => o.status === 'Bozza').reduce((sum, o) => sum + Number(o.total || 0), 0);
    const transmittedSales = filteredOrders.filter(o => o.status !== 'Bozza').reduce((sum, o) => sum + Number(o.total || 0), 0);
    const ordersCount = filteredOrders.length;
    const completedOrdersCount = filteredOrders.filter(o => o.status !== 'Bozza').length;
    const draftOrdersCount = filteredOrders.filter(o => o.status === 'Bozza').length;
    const aov = ordersCount > 0 ? totalSales / ordersCount : 0;

    // Total quantity of items sold
    let totalQuantitySold = 0;
    filteredOrders.forEach(o => {
      if (o.items) {
        o.items.forEach(item => {
          totalQuantitySold += Number(item.qty || 0);
        });
      }
    });

    // Active clients
    const activeClientIds = new Set(filteredOrders.map(o => o.client_id));
    const activeClientsCount = activeClientIds.size;
    const avgRevenuePerClient = activeClientsCount > 0 ? totalSales / activeClientsCount : 0;

    // 3. Client aggregates (Top spent clients)
    const clientAggregates: Record<number, { id: number; name: string; city: string; spent: number; ordersCount: number; orderCount: number }> = {};
    filteredOrders.forEach(o => {
      if (!clientAggregates[o.client_id]) {
        clientAggregates[o.client_id] = {
          id: o.client_id,
          name: o.client_name || 'N/D',
          city: '',
          spent: 0,
          ordersCount: 0,
          orderCount: 0
        };
        const cl = clients.find(c => c.id === o.client_id);
        if (cl) {
          clientAggregates[o.client_id].city = cl.city || '';
        }
      }
      clientAggregates[o.client_id].spent += Number(o.total || 0);
      clientAggregates[o.client_id].ordersCount += 1;
      clientAggregates[o.client_id].orderCount += 1;
    });

    const topSpentClients = Object.values(clientAggregates)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10);

    // Geographic distribution (by City)
    const cityAggregates: Record<string, { city: string; spent: number; ordersCount: number }> = {};
    Object.values(clientAggregates).forEach(ca => {
      const cityKey = ca.city || 'Non Specificata';
      if (!cityAggregates[cityKey]) {
        cityAggregates[cityKey] = { city: cityKey, spent: 0, ordersCount: 0 };
      }
      cityAggregates[cityKey].spent += ca.spent;
      cityAggregates[cityKey].ordersCount += ca.ordersCount;
    });
    const topCities = Object.values(cityAggregates)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);

    const cityBreakdown = Object.values(cityAggregates)
      .map(ca => ({
        city: ca.city,
        revenue: ca.spent,
        count: ca.ordersCount
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    // 4. Product & Category aggregates
    const productSalesAggregates: Record<string, { code: string; description: string; qty: number; revenue: number; category: string; stock: number }> = {};
    const categorySalesAggregates: Record<string, { category: string; qty: number; revenue: number }> = {};

    filteredOrders.forEach(o => {
      if (o.items) {
        o.items.forEach(item => {
          const prod = products.find(p => p.code === item.product_code);
          const cat = prod?.category || 'Senza Categoria';
          const stock = prod ? Number(prod.stock) : 0;

          if (!productSalesAggregates[item.product_code]) {
            productSalesAggregates[item.product_code] = {
              code: item.product_code,
              description: item.description || prod?.description || '',
              qty: 0,
              revenue: 0,
              category: cat,
              stock
            };
          }
          productSalesAggregates[item.product_code].qty += Number(item.qty || 0);
          productSalesAggregates[item.product_code].revenue += Number(item.qty || 0) * Number(item.price || 0);

          if (!categorySalesAggregates[cat]) {
            categorySalesAggregates[cat] = { category: cat, qty: 0, revenue: 0 };
          }
          categorySalesAggregates[cat].qty += Number(item.qty || 0);
          categorySalesAggregates[cat].revenue += Number(item.qty || 0) * Number(item.price || 0);
        });
      }
    });

    const topProducts = Object.values(productSalesAggregates)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const totalCatRevenue = Object.values(categorySalesAggregates).reduce((sum, cat) => sum + cat.revenue, 0) || 1;
    const categoryBreakdown = Object.values(categorySalesAggregates)
      .map(cat => ({
        ...cat,
        percentage: Math.round((cat.revenue / totalCatRevenue) * 100)
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 5. Payment Methods Breakdown
    const paymentAggregates: Record<string, { name: string; count: number; total: number }> = {};
    filteredOrders.forEach(o => {
      const pmName = o.payment_name || 'Non specificato';
      if (!paymentAggregates[pmName]) {
        paymentAggregates[pmName] = { name: pmName, count: 0, total: 0 };
      }
      paymentAggregates[pmName].count += 1;
      paymentAggregates[pmName].total += Number(o.total || 0);
    });
    const totalPaymentVol = Object.values(paymentAggregates).reduce((sum, pm) => sum + pm.total, 0) || 1;
    const paymentBreakdown = Object.values(paymentAggregates)
      .map(pm => ({
        ...pm,
        volume: pm.total,
        percentage: Math.round((pm.total / totalPaymentVol) * 100)
      }))
      .sort((a, b) => b.volume - a.volume);

    // 6. Agent Performance Breakdown
    const agentAggregates: Record<string, { name: string; count: number; total: number; aov: number }> = {};
    filteredOrders.forEach(o => {
      const agName = o.agent_name || 'Diretto / Sede';
      if (!agentAggregates[agName]) {
        agentAggregates[agName] = { name: agName, count: 0, total: 0, aov: 0 };
      }
      agentAggregates[agName].count += 1;
      agentAggregates[agName].total += Number(o.total || 0);
    });
    Object.values(agentAggregates).forEach(ag => {
      ag.aov = ag.count > 0 ? ag.total / ag.count : 0;
    });
    const agentBreakdown = Object.values(agentAggregates).sort((a, b) => b.total - a.total);

    // 7. Products inventory stats
    const totalProductsCount = products.length;
    const outOfStockCount = products.filter(p => Number(p.stock) <= 0).length;
    const lowStockCount = products.filter(p => {
      const stock = Number(p.stock);
      const minStock = Number(p.min_stock ?? 5);
      return stock > 0 && stock <= minStock;
    }).length;
    const alertProducts = products.filter(p => Number(p.stock) <= Number(p.min_stock ?? 5)).slice(0, 6);

    // 8. Orders trend over dates (last 10 unique dates)
    const ordersByDate: Record<string, { date: string; total: number; count: number }> = {};
    filteredOrders.slice().reverse().forEach(o => {
      const d = o.date;
      if (!ordersByDate[d]) {
        ordersByDate[d] = { date: d, total: 0, count: 0 };
      }
      ordersByDate[d].total += Number(o.total || 0);
      ordersByDate[d].count += 1;
    });
    const orderTrend = Object.values(ordersByDate).slice(-10);

    // Unique list of all agents in orders for filter dropdown
    const availableAgents = Array.from(new Set(orders.map(o => o.agent_name).filter(Boolean))) as string[];

    return {
      filteredOrders,
      totalSales,
      draftSales,
      transmittedSales,
      ordersCount,
      completedOrdersCount,
      draftOrdersCount,
      draftsCount: draftOrdersCount,
      aov,
      totalQuantitySold,
      activeClientsCount,
      avgRevenuePerClient,
      topSpentClients,
      topCities,
      cityBreakdown,
      topProducts,
      categoryBreakdown,
      paymentBreakdown,
      agentBreakdown,
      totalProductsCount,
      outOfStockCount,
      lowStockCount,
      alertProducts,
      orderTrend,
      availableAgents
    };
  }, [orders, clients, products, statsTimeRange, statsStatusFilter, statsAgentFilter, selectedMonthFilter]);

  const displayOrders = React.useMemo(() => {
    let result = orders;
    if (statsAgentFilter && statsAgentFilter !== 'all') {
      result = result.filter(o => o.agent_name === statsAgentFilter);
    }
    if (selectedMonthFilter !== 'ALL') {
      result = result.filter(o => o.date && o.date.startsWith(selectedMonthFilter));
    }
    return result;
  }, [orders, statsAgentFilter, selectedMonthFilter]);

  const calculateOrderInstallments = (order: Order) => {
    const pm = paymentMethods.find(p => p.name === order.payment_name);
    let customOffsets: number[] | null = null;
    if (pm && pm.custom_offsets) {
      try {
        const parsed = typeof pm.custom_offsets === 'string' ? JSON.parse(pm.custom_offsets) : pm.custom_offsets;
        if (Array.isArray(parsed) && parsed.length > 0) {
          customOffsets = parsed.map(Number).filter(n => !isNaN(n));
        }
      } catch (e) {
        customOffsets = null;
      }
    }

    const installmentsNum = pm ? (customOffsets && customOffsets.length > 0 ? customOffsets.length : pm.installments) : 1;
    const offsetDays = pm ? pm.offset_days : 0;
    const fineMese = pm ? pm.fine_mese === 1 || pm.fine_mese === true : false;

    const orderInstallments: { date: string; amount: number }[] = [];
    if (installmentsNum > 1) {
      const baseAmount = Math.floor((order.total / installmentsNum) * 100) / 100;
      const difference = Math.round((order.total - (baseAmount * installmentsNum)) * 100) / 100;

      for (let i = 0; i < installmentsNum; i++) {
        let amt = baseAmount;
        if (i === installmentsNum - 1) {
          amt = Math.round((baseAmount + difference) * 100) / 100;
        }
        let currentDate = new Date(order.date);
        let dateStr = order.date;
        if (!isNaN(currentDate.getTime())) {
          let targetDays = offsetDays;
          if (customOffsets && customOffsets.length > 0) {
            targetDays = customOffsets[i] !== undefined ? customOffsets[i] : (customOffsets[customOffsets.length - 1] + (i - customOffsets.length + 1) * 30);
          } else {
            const gap = offsetDays === 0 ? 30 : offsetDays;
            targetDays = offsetDays + (i * gap);
          }
          let d = new Date(currentDate.getTime() + targetDays * 24 * 60 * 60 * 1000);
          if (fineMese) {
            d = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          }
          dateStr = d.toISOString().split('T')[0];
        }
        orderInstallments.push({ date: dateStr, amount: amt });
      }
    } else {
      let currentDate = new Date(order.date);
      let dateStr = order.date;
      if (!isNaN(currentDate.getTime())) {
        let targetDays = offsetDays;
        if (customOffsets && customOffsets.length > 0) {
          targetDays = customOffsets[0];
        }
        let d = new Date(currentDate.getTime() + targetDays * 24 * 60 * 60 * 1000);
        if (fineMese) {
          d = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        }
        dateStr = d.toISOString().split('T')[0];
      }
      orderInstallments.push({ date: dateStr, amount: order.total });
    }
    return orderInstallments;
  };

  // Computed list of all payment installment deadlines across filtered orders
  const allDeadlines = React.useMemo(() => {
    const deadlines: {
      orderId: number;
      orderNumber: string | number;
      clientName: string;
      agentName: string;
      date: string;
      amount: number;
      installmentIndex: number;
      totalInstallments: number;
      paymentName: string;
      isOverdue: boolean;
    }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    stats.filteredOrders.forEach(order => {
      const insts = calculateOrderInstallments(order);
      if (insts && insts.length > 0) {
        insts.forEach((inst, index) => {
          const instDate = new Date(inst.date);
          const isPast = !isNaN(instDate.getTime()) && instDate < today;
          deadlines.push({
            orderId: order.id,
            orderNumber: order.number || order.id,
            clientName: order.client_name || 'N/D',
            agentName: order.agent_name || 'Amministratore',
            date: inst.date,
            amount: inst.amount,
            installmentIndex: index + 1,
            totalInstallments: insts.length,
            paymentName: order.payment_name || 'N/D',
            isOverdue: isPast
          });
        });
      }
    });

    // Sort by date ascending
    deadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return deadlines;
  }, [stats.filteredOrders, paymentMethods]);

  // Available Months for Transversal Monthly Temporal Filter
  const availableMonths = React.useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.date && o.date.length >= 7) set.add(o.date.substring(0, 7));
    });
    allDeadlines.forEach(d => {
      if (d.date && d.date.length >= 7) set.add(d.date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [orders, allDeadlines]);

  const formatMonthLabel = (yyyyMm: string) => {
    if (yyyyMm === 'ALL') return 'Tutti i Mesi';
    const [y, m] = yyyyMm.split('-');
    if (!y || !m) return yyyyMm;
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  };

  const visibleDeadlines = React.useMemo(() => {
    return allDeadlines.filter(d => {
      const matchMonth = selectedMonthFilter === 'ALL' || (d.date && d.date.startsWith(selectedMonthFilter));
      const matchPast = !hidePastDeadlines || !d.isOverdue;
      return matchMonth && matchPast;
    });
  }, [allDeadlines, hidePastDeadlines, selectedMonthFilter]);

  const handleViewClientDetails = (clientId: number) => {
    const c = clients.find(cl => cl.id === clientId);
    if (c) {
      setSelectedDetailClient(c);
      setClientModalTab('panoramica');
      setIsClientDetailOpen(true);
    } else {
      showStatus('Cliente non trovato nelle anagrafiche', 'error');
    }
  };

  const getClientStats = (clientId: number, clientObj?: Client | null) => {
    const targetIdStr = String(clientId);
    const targetName = clientObj?.name ? String(clientObj.name).trim().toLowerCase() : '';
    const targetCode = clientObj?.code ? String(clientObj.code).trim().toLowerCase() : '';

    const clientOrders = orders.filter(o => {
      if (String(o.client_id) === targetIdStr) return true;
      if (targetName && o.client_name && String(o.client_name).trim().toLowerCase() === targetName) return true;
      if (targetCode && (o as any).client_code && String((o as any).client_code).trim().toLowerCase() === targetCode) return true;
      return false;
    });
    const totalSpent = clientOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const count = clientOrders.length;
    const aov = count > 0 ? totalSpent / count : 0;

    // Payment method frequency
    const paymentCounts: Record<string, number> = {};
    clientOrders.forEach(o => {
      if (o.payment_name) {
        paymentCounts[o.payment_name] = (paymentCounts[o.payment_name] || 0) + 1;
      }
    });
    const topPayment = Object.entries(paymentCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/D';

    // Top products purchased by this client
    const productPurchased: Record<string, { code: string; description: string; qty: number; spent: number }> = {};
    clientOrders.forEach(o => {
      if (o.items) {
        o.items.forEach(item => {
          const pCode = item.product_code || (item as any).code || item.description || 'N/D';
          const pDesc = item.description || (item as any).name || pCode;
          const pQty = Number(item.qty || (item as any).quantity || 0);
          const pPrice = Number(item.price || (item as any).unit_price || 0);

          if (!productPurchased[pCode]) {
            productPurchased[pCode] = {
              code: pCode,
              description: pDesc,
              qty: 0,
              spent: 0
            };
          }
          productPurchased[pCode].qty += pQty;
          productPurchased[pCode].spent += pQty * pPrice;
        });
      }
    });
    const topProducts = Object.values(productPurchased)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Aggregated scadenze (by month) and detailed installments
    const monthlyPayments: Record<string, { month: string; total: number; installments: { orderId: number; orderNumber: string; date: string; amount: number }[] }> = {};
    const allInstallments: { orderId: number; orderNumber: string; date: string; amount: number; paymentName: string }[] = [];

    clientOrders.forEach(order => {
      const orderInstallments = calculateOrderInstallments(order);

      orderInstallments.forEach(inst => {
        allInstallments.push({
          orderId: order.id,
          orderNumber: order.number || String(order.id),
          date: inst.date,
          amount: inst.amount,
          paymentName: order.payment_name
        });

        // Group by YYYY-MM
        const monthKey = inst.date.substring(0, 7); // "YYYY-MM"
        if (!monthlyPayments[monthKey]) {
          monthlyPayments[monthKey] = {
            month: monthKey,
            total: 0,
            installments: []
          };
        }
        monthlyPayments[monthKey].total += inst.amount;
        monthlyPayments[monthKey].installments.push({
          orderId: order.id,
          orderNumber: order.number || String(order.id),
          date: inst.date,
          amount: inst.amount
        });
      });
    });

    const sortedMonthlyPayments = Object.values(monthlyPayments).sort((a, b) => a.month.localeCompare(b.month));
    const sortedAllInstallments = allInstallments.sort((a, b) => a.date.localeCompare(b.date));

    return {
      clientOrders,
      totalSpent,
      count,
      aov,
      topPayment,
      topProducts,
      sortedMonthlyPayments,
      sortedAllInstallments
    };
  };

  // Status and logs
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDirectConfigOpen, setIsDirectConfigOpen] = useState(false);

  // File import refs
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const productXlsxFileInputRef = useRef<HTMLInputElement>(null);
  const clientFileInputRef = useRef<HTMLInputElement>(null);

  // Custom Easyfatt integration settings & commercial logic
  const [easyfattUsername, setEasyfattUsername] = useState('admin@connect.com');
  const [easyfattPassword, setEasyfattPassword] = useState('password123');
  const [defaultPayment, setDefaultPayment] = useState('Bonifico bancario');
  const [minOrderTotal, setMinOrderTotal] = useState(0);
  const [defaultNotes, setDefaultNotes] = useState('');
  const [defaultVat, setDefaultVat] = useState('22');
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [easyfattLogs, setEasyfattLogs] = useState<string[]>([]);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(false);
  const [productLinkFilter, setProductLinkFilter] = useState<'all' | 'only_with_link' | 'hide_with_link'>('all');
  const [productCommissionFilter, setProductCommissionFilter] = useState<'all' | 'only_with_commission' | 'hide_with_commission'>('all');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResultMsg, setTestResultMsg] = useState<string>('');
  const [testResultDetails, setTestResultDetails] = useState<string>('');

  // Link Scheda Prodotto Filter Helpers
  const hasProductLink = (p: Product) => Boolean(p.link && p.link.trim() !== '');

  const matchesLinkFilter = (p: Product) => {
    if (productLinkFilter === 'only_with_link') {
      return hasProductLink(p);
    }
    if (productLinkFilter === 'hide_with_link') {
      return !hasProductLink(p);
    }
    return true;
  };

  // Commission Class Filter Helpers
  const hasProductCommissionClass = (p: Product) => {
    const pAny = p as any;
    const val = p.classe_provvigione ?? pAny['Classe provvigione'] ?? pAny['classe provvigione'] ?? pAny['commission_class'] ?? pAny['provvigione'] ?? pAny['cl_provv'];
    return Boolean(val !== null && val !== undefined && String(val).trim() !== '');
  };

  const matchesCommissionFilter = (p: Product) => {
    if (productCommissionFilter === 'only_with_commission') {
      return hasProductCommissionClass(p);
    }
    if (productCommissionFilter === 'hide_with_commission') {
      return !hasProductCommissionClass(p);
    }
    return true;
  };

  useEffect(() => {
    fetchProducts();
    fetchClients();
    fetchOrders();
    fetchEasyfattSettings();
    fetchEasyfattLogs();
    fetchPaymentMethods();
    fetchCompanyHeader();
  }, []);

  useEffect(() => {
    if (paymentMethods.length > 0) {
      const pmNames = paymentMethods.map(p => p.name);
      if (!pmNames.includes(orderForm.payment_name)) {
        if (defaultPayment && pmNames.includes(defaultPayment)) {
          setOrderForm(prev => ({ ...prev, payment_name: defaultPayment }));
        } else {
          setOrderForm(prev => ({ ...prev, payment_name: pmNames[0] }));
        }
      }
    }
  }, [paymentMethods, defaultPayment]);

  const fetchEasyfattLogs = async () => {
    try {
      const res = await fetch('/api/easyfatt/logs');
      if (res.ok) {
        const data = await res.json();
        if (data.logs) setEasyfattLogs(data.logs);
      }
    } catch (err) {
      console.error('Error fetching easyfatt logs:', err);
    }
  };

  const handleClearEasyfattLogs = async () => {
    try {
      const res = await fetch('/api/easyfatt/logs/clear', { method: 'POST' });
      if (res.ok) {
        showStatus('Log di diagnostica ripuliti con successo!', 'success');
        fetchEasyfattLogs();
      }
    } catch (err) {
      console.error('Error clearing easyfatt logs:', err);
    }
  };

  const fetchEasyfattSettings = async () => {
    try {
      const res = await fetch('/api/easyfatt/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.username) setEasyfattUsername(data.username);
        if (data.password) setEasyfattPassword(data.password);
        if (data.default_payment) setDefaultPayment(data.default_payment);
        if (data.min_order_total !== undefined) setMinOrderTotal(data.min_order_total);
        if (data.default_notes !== undefined) setDefaultNotes(data.default_notes);
        if (data.default_vat !== undefined) setDefaultVat(data.default_vat);
        if (data.prices_include_vat !== undefined) setPricesIncludeVat(data.prices_include_vat === 1);
        if (data.product_link_filter !== undefined) setProductLinkFilter(data.product_link_filter as 'all' | 'only_with_link' | 'hide_with_link');
        if (data.product_commission_filter !== undefined) setProductCommissionFilter(data.product_commission_filter as 'all' | 'only_with_commission' | 'hide_with_commission');
      }
    } catch (err) {
      console.error('Error fetching easyfatt settings:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/easyfatt/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: easyfattUsername, 
          password: easyfattPassword,
          default_payment: defaultPayment,
          min_order_total: minOrderTotal,
          default_notes: defaultNotes,
          default_vat: defaultVat,
          prices_include_vat: pricesIncludeVat ? 1 : 0,
          product_link_filter: productLinkFilter,
          product_commission_filter: productCommissionFilter
        })
      });
      if (res.ok) {
        showStatus('Impostazioni Easyfatt salvate con successo!', 'success');
      } else {
        const err = await res.json();
        showStatus(err.error || 'Errore durante il salvataggio delle impostazioni', 'error');
      }
    } catch (err) {
      console.error('Error saving easyfatt settings:', err);
      showStatus('Errore di connessione', 'error');
    }
  };

  const handleUpdateCommissionFilter = async (filter: 'all' | 'only_with_commission' | 'hide_with_commission') => {
    setProductCommissionFilter(filter);
    try {
      const res = await fetch('/api/easyfatt/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: easyfattUsername, 
          password: easyfattPassword,
          default_payment: defaultPayment,
          min_order_total: minOrderTotal,
          default_notes: defaultNotes,
          default_vat: defaultVat,
          prices_include_vat: pricesIncludeVat ? 1 : 0,
          product_link_filter: productLinkFilter,
          product_commission_filter: filter
        })
      });
      if (res.ok) {
        const labelMap = {
          all: 'Tutti i prodotti visibili nel catalogo',
          only_with_commission: 'Mostrati solo i prodotti con Classe Provvigione popolata',
          hide_with_commission: 'Mostrati solo i prodotti con Classe Provvigione vuota'
        };
        showStatus(`Filtro applicato: ${labelMap[filter]}`, 'success');
      }
    } catch (e) {
      console.error('Error updating commission filter', e);
    }
  };

  const fetchCompanyHeader = async () => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/easyfatt/company-header', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.company_name || data.company_vat_code)) {
          setCompanyHeader(prev => ({ ...prev, ...data }));
          setCachedCompanyHeader(data);
        }
      }
    } catch (err) {
      console.error('Error fetching company header:', err);
    }
  };

  const handleSaveCompanyHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompanyHeader(true);
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/easyfatt/company-header', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(companyHeader)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.data) {
          setCompanyHeader(prev => ({ ...prev, ...data.data }));
          setCachedCompanyHeader(data.data);
        } else {
          setCachedCompanyHeader(companyHeader);
        }
        showStatus('Intestazione aziendale e logo salvati con successo!', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        showStatus('Errore durante il salvataggio: ' + (errData.error || 'Errore generico'), 'error');
      }
    } catch (err: any) {
      showStatus('Errore di connessione: ' + err.message, 'error');
    } finally {
      setSavingCompanyHeader(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showStatus('La dimensione del logo non può superare 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyHeader(prev => ({ ...prev, company_logo: reader.result as string }));
        showStatus('Logo caricato in anteprima. Clicca su "Salva Intestazione" per confermare.', 'info');
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadOrderPDF = async (order: Order) => {
    showStatus(`Generazione PDF in corso per l'ordine #${order.number || order.id}...`, 'info');
    
    const client = clients.find(c => c.id === order.client_id);
    const clientMeta = client ? parseClientNotes(client.notes).daneaData : {};

    const subtotal = order.items?.reduce((sum, item) => sum + (item.qty * item.price), 0) || order.total;
    const pricesTaxIncluded = pricesIncludeVat;
    const netTotal = pricesTaxIncluded ? subtotal / 1.22 : subtotal;
    const vatTotal = pricesTaxIncluded ? subtotal - netTotal : subtotal * (Number(defaultVat || 22) / 100);
    const grandTotal = pricesTaxIncluded ? subtotal : netTotal + vatTotal;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#111827';
    container.style.fontFamily = 'Helvetica, Arial, sans-serif';
    container.style.boxSizing = 'border-box';

    container.innerHTML = `
      <div style="width: 100%; max-width: 714px; margin: 0 auto; background: #ffffff; padding: 24px; box-sizing: border-box; color: #111827; font-size: 11px; line-height: 1.4;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #5A5A40; padding-bottom: 16px; margin-bottom: 20px;">
          <div style="max-width: 55%;">
            ${companyHeader.company_logo ? `<img src="${companyHeader.company_logo}" style="max-height: 60px; max-width: 200px; object-fit: contain; margin-bottom: 10px; display: block;" />` : ''}
            <div style="font-size: 16px; font-weight: 800; color: #111827; margin-bottom: 4px; font-family: Georgia, serif;">${companyHeader.company_name || 'Connect Beauty S.r.l.'}</div>
            <div style="font-size: 10px; color: #4B5563; line-height: 1.4;">
              ${companyHeader.company_address ? `${companyHeader.company_address}<br/>` : ''}
              ${companyHeader.company_postcode || companyHeader.company_city ? `${companyHeader.company_postcode} ${companyHeader.company_city} (${companyHeader.company_province}) - ${companyHeader.company_country}<br/>` : ''}
              ${companyHeader.company_vat_code ? `<strong>P.IVA:</strong> ${companyHeader.company_vat_code} ` : ''}
              ${companyHeader.company_fiscal_code ? ` | <strong>C.F.:</strong> ${companyHeader.company_fiscal_code}` : ''}<br/>
              ${companyHeader.company_tel ? `<strong>Tel:</strong> ${companyHeader.company_tel} ` : ''}
              ${companyHeader.company_email ? ` | <strong>Email:</strong> ${companyHeader.company_email}` : ''}<br/>
              ${companyHeader.company_pec ? `<strong>PEC:</strong> ${companyHeader.company_pec} ` : ''}
              ${companyHeader.company_website ? ` | <strong>Web:</strong> ${companyHeader.company_website}` : ''}
            </div>
          </div>

          <div style="text-align: right; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px; width: 220px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #5A5A40;">Conferma d'Ordine</div>
            <div style="font-size: 20px; font-weight: 900; color: #111827; margin: 2px 0;">N° ${String(order.number || order.id).padStart(4, '0')}</div>
            <div style="font-size: 10px; color: #4B5563;">Data: <strong>${new Date(order.date).toLocaleDateString('it-IT')}</strong></div>
            <div style="font-size: 10px; color: #6B7280; margin-top: 2px;">Stato: <span style="font-weight: 800; color: #5A5A40;">${order.status}</span></div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px;">
            <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; margin-bottom: 4px; border-bottom: 1px solid #E5E7EB; padding-bottom: 2px;">Spettabile Cliente</div>
            <div style="font-size: 12px; font-weight: 800; color: #111827;">${order.client_name}</div>
            <div style="font-size: 10px; color: #4B5563; margin-top: 2px; line-height: 1.4;">
              ${clientMeta['Indirizzo'] || ''}<br/>
              ${clientMeta['CAP'] || ''} ${clientMeta['Città'] || order.client_city || ''} (${clientMeta['Provincia'] || ''})<br/>
              ${clientMeta['Partita Iva'] ? `<strong>P.IVA:</strong> ${clientMeta['Partita Iva']}` : ''}
              ${clientMeta['Codice fiscale'] ? ` | <strong>C.F.:</strong> ${clientMeta['Codice fiscale']}` : ''}<br/>
              ${clientMeta['Tel'] || order.client_phone ? `<strong>Tel:</strong> ${clientMeta['Tel'] || order.client_phone}` : ''}
              ${clientMeta['E-mail'] || order.client_email ? ` | <strong>Email:</strong> ${clientMeta['E-mail'] || order.client_email}` : ''}
            </div>
          </div>

          <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px;">
            <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; margin-bottom: 4px; border-bottom: 1px solid #E5E7EB; padding-bottom: 2px;">Condizioni Commerciali</div>
            <div style="font-size: 10px; color: #4B5563; line-height: 1.5;">
              <strong>Agente / Referente:</strong> ${order.agent_name || 'Amministratore'}<br/>
              <strong>Pagamento:</strong> ${order.payment_name || 'Non specificato'}<br/>
              <strong>Banca d'Appoggio:</strong> ${order.payment_bank || 'N/D'}<br/>
              <strong>Listino Applicato:</strong> Standard / Netto
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <thead>
              <tr style="background: #5A5A40; color: #ffffff; text-align: left;">
                <th style="padding: 6px 8px; font-weight: 800;">Codice</th>
                <th style="padding: 6px 8px; font-weight: 800;">Descrizione Prodotto</th>
                <th style="padding: 6px 8px; text-align: center; font-weight: 800;">Q.tà</th>
                <th style="padding: 6px 8px; text-align: center; font-weight: 800;">U.M.</th>
                <th style="padding: 6px 8px; text-align: right; font-weight: 800;">Prezzo Unit.</th>
                <th style="padding: 6px 8px; text-align: center; font-weight: 800;">IVA</th>
                <th style="padding: 6px 8px; text-align: right; font-weight: 800;">Totale (€)</th>
              </tr>
            </thead>
            <tbody>
              ${order.items?.map((item, idx) => `
                <tr style="border-bottom: 1px solid #E5E7EB; background: ${idx % 2 === 0 ? '#ffffff' : '#F9FAFB'};">
                  <td style="padding: 6px 8px; font-family: monospace; font-weight: bold; color: #374151;">${item.product_code}</td>
                  <td style="padding: 6px 8px; font-weight: 600; color: #111827;">${item.description}</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${item.qty}</td>
                  <td style="padding: 6px 8px; text-align: center; color: #6B7280;">${item.um || 'pz'}</td>
                  <td style="padding: 6px 8px; text-align: right; font-family: monospace;">€ ${item.price.toFixed(2)}</td>
                  <td style="padding: 6px 8px; text-align: center; color: #6B7280;">${item.vat_code || '22'}%</td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: bold; font-family: monospace; color: #111827;">€ ${(item.qty * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 20px;">
          <div style="flex: 1;">
            ${order.notes ? `
              <div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 8px; border-radius: 8px; margin-bottom: 8px;">
                <strong style="color: #92400E; font-size: 9px;">Note Ordine:</strong><br/>
                <span style="color: #78350F; font-size: 9px;">${order.notes}</span>
              </div>
            ` : ''}
            ${defaultNotes ? `
              <div style="color: #6B7280; font-size: 9px; line-height: 1.3;">
                <strong>Note Commerciali:</strong> ${defaultNotes}
              </div>
            ` : ''}
          </div>

          <div style="width: 230px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 10px; color: #4B5563;">
              <span>Totale Imponibile:</span>
              <span style="font-weight: 700; font-family: monospace;">€ ${netTotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 10px; color: #4B5563;">
              <span>Totale IVA (${defaultVat}%):</span>
              <span style="font-weight: 700; font-family: monospace;">€ ${vatTotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0 0 0; font-size: 14px; font-weight: 900; color: #5A5A40; border-top: 2px solid #E5E7EB; margin-top: 4px;">
              <span>TOTALE ORDINE:</span>
              <span style="font-family: monospace;">€ ${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding-top: 10px; font-size: 8px; color: #9CA3AF; text-align: center;">
          ${companyHeader.company_name} - Documento generato digitalmente in data ${new Date().toLocaleDateString('it-IT')}
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const safeOrderNum = String(order.number || order.id).replace(/\//g, '_');
      const filename = `Ordine_${safeOrderNum}_${(order.client_name || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      pdf.save(filename);
      showStatus(`PDF scaricato con successo: ${filename}`, 'success');
    } catch (err: any) {
      console.error('Errore creazione PDF:', err);
      showStatus('Errore durante la creazione del PDF. Generazione tramite finestra di stampa...', 'error');
      openPrintWindow(order);
    } finally {
      document.body.removeChild(container);
    }
  };

  const openPrintWindow = (order: Order) => {
    const client = clients.find(c => String(c.id) === String(order.client_id)) ||
                   clients.find(c => order.client_name && c.name.toLowerCase() === order.client_name.toLowerCase()) ||
                   clients.find(c => Boolean((order as any).client_code) && c.code && c.code === (order as any).client_code);
    printOrderDocument(order, client);
  };

  const handleCopyOrderText = async (order: Order) => {
    const client = clients.find(c => String(c.id) === String(order.client_id)) ||
                   clients.find(c => order.client_name && c.name.toLowerCase() === order.client_name.toLowerCase()) ||
                   clients.find(c => Boolean((order as any).client_code) && c.code && c.code === (order as any).client_code);
    const ok = await copyOrderToClipboard(order, client);
    if (ok) {
      showStatus('Riepilogo ordine copiato negli appunti!', 'success');
    } else {
      showStatus('Impossibile copiare il riepilogo.', 'error');
    }
  };

  const handleUpdateLinkFilter = async (newFilter: 'all' | 'only_with_link' | 'hide_with_link') => {
    setProductLinkFilter(newFilter);
    try {
      const res = await fetch('/api/easyfatt/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: easyfattUsername, 
          password: easyfattPassword,
          default_payment: defaultPayment,
          min_order_total: minOrderTotal,
          default_notes: defaultNotes,
          default_vat: defaultVat,
          prices_include_vat: pricesIncludeVat ? 1 : 0,
          product_link_filter: newFilter,
          product_commission_filter: productCommissionFilter
        })
      });
      if (res.ok) {
        const labelMap = {
          all: 'Tutti i prodotti visibili nel catalogo',
          only_with_link: 'Mostrati solo i prodotti con Link Scheda',
          hide_with_link: 'Nascosti a tutti gli utenti i prodotti con Link Scheda'
        };
        showStatus(`Filtro applicato: ${labelMap[newFilter]}`, 'success');
      }
    } catch (err) {
      console.error('Error updating link filter:', err);
    }
  };

  const handleTestConnection = async (endpoint: 'orders' | 'products') => {
    setTestStatus('testing');
    setTestResultMsg('');
    setTestResultDetails('');

    const credentials = btoa(`${easyfattUsername}:${easyfattPassword}`);
    const url = endpoint === 'orders' 
      ? '/api/easyfatt/download-orders?appver=2' 
      : '/api/easyfatt/import-products';

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Authorization': credentials
        }
      });

      const text = await res.text();
      
      if (res.ok) {
        setTestStatus('success');
        setTestResultMsg(`Connessione riuscita con successo! Stato HTTP: ${res.status} OK`);
        const snippet = text.length > 500 ? text.substring(0, 500) + '...' : text;
        setTestResultDetails(snippet);
        setTimeout(fetchEasyfattLogs, 1000);
      } else {
        setTestStatus('error');
        setTestResultMsg(`Errore di collegamento. Stato HTTP: ${res.status}`);
        setTestResultDetails(text || 'Nessun dettaglio aggiuntivo fornito dal server.');
        setTimeout(fetchEasyfattLogs, 1000);
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestResultMsg('Impossibile connettersi al server.');
      setTestResultDetails(err.message || String(err));
    }
  };

  const showStatus = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => {
      setStatusMsg(null);
    }, 5000);
  };

  // Fetch functions
  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/easyfatt/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const fetchAgentOrders = useCallback(async () => {
    setIsAgentOrdersLoading(true);
    try {
      const res = await fetch(`/api/easyfatt/orders?${agentOrdersPagination.queryString}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.pagination) {
          setAgentOrdersData(json.data);
          agentOrdersPagination.updatePagination(json.pagination);
        } else if (Array.isArray(json)) {
          setAgentOrdersData(json);
        }
      }
    } catch (err) {
      console.error('Error fetching paginated agent orders:', err);
    } finally {
      setIsAgentOrdersLoading(false);
    }
  }, [agentOrdersPagination.queryString]);

  const fetchAdminOrders = useCallback(async () => {
    setIsAdminOrdersLoading(true);
    try {
      const res = await fetch(`/api/easyfatt/orders?${adminOrdersPagination.queryString}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.pagination) {
          setAdminOrdersData(json.data);
          adminOrdersPagination.updatePagination(json.pagination);
        } else if (Array.isArray(json)) {
          setAdminOrdersData(json);
        }
      }
    } catch (err) {
      console.error('Error fetching paginated admin orders:', err);
    } finally {
      setIsAdminOrdersLoading(false);
    }
  }, [adminOrdersPagination.queryString]);

  useEffect(() => {
    fetchAgentOrders();
  }, [fetchAgentOrders]);

  useEffect(() => {
    fetchAdminOrders();
  }, [fetchAdminOrders]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/easyfatt/orders');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          setOrders(data.data);
        } else if (Array.isArray(data)) {
          setOrders(data);
        }
      }
      fetchAgentOrders();
      fetchAdminOrders();
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch('/api/payment-methods');
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data);
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    }
  };

  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pmForm.name.trim()) {
      showStatus('Inserire un nome valido per il metodo di pagamento', 'error');
      return;
    }
    setLoading(true);
    const method = editingPmId ? 'PUT' : 'POST';
    const url = editingPmId ? `/api/admin/payment-methods/${editingPmId}` : '/api/admin/payment-methods';

    let customOffsetsPayload: number[] | null = null;
    let finalInstallments = Number(pmForm.installments) || 1;
    let finalOffsetDays = Number(pmForm.offset_days) || 0;

    if (pmForm.is_custom_offsets) {
      const validOffsets = pmForm.custom_offsets.map(n => Number(n)).filter(n => !isNaN(n) && n >= 0);
      if (validOffsets.length === 0) {
        showStatus('Specifica almeno un giorno di scostamento per la rata libera', 'error');
        setLoading(false);
        return;
      }
      customOffsetsPayload = validOffsets;
      finalInstallments = validOffsets.length;
      finalOffsetDays = validOffsets[0];
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pmForm.name,
          offset_days: finalOffsetDays,
          installments: finalInstallments,
          fine_mese: pmForm.fine_mese,
          custom_offsets: customOffsetsPayload
        })
      });

      const data = await res.json();
      if (res.ok) {
        showStatus(data.message || (editingPmId ? 'Metodo di pagamento aggiornato' : 'Metodo di pagamento creato'));
        setPmForm({
          id: null,
          name: '',
          offset_days: 30,
          installments: 1,
          fine_mese: false,
          is_custom_offsets: false,
          custom_offsets: [60, 90, 120]
        });
        setEditingPmId(null);
        fetchPaymentMethods();
      } else {
        showStatus(data.error || 'Errore durante il salvataggio del metodo di pagamento', 'error');
      }
    } catch (err) {
      showStatus('Si è verificato un errore di rete', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePaymentMethod = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/payment-methods/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showStatus(data.message || 'Metodo di pagamento eliminato con successo');
        fetchPaymentMethods();
      } else {
        showStatus(data.error || 'Impossibile eliminare il metodo di pagamento', 'error');
      }
    } catch (err) {
      showStatus('Errore durante l\'eliminazione del metodo di pagamento', 'error');
    }
  };

  // Product actions
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const method = editingProduct ? 'PUT' : 'POST';
    const url = editingProduct ? `/api/easyfatt/products/${editingProduct.id}` : '/api/easyfatt/products';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: productForm.code,
          description: productForm.description,
          price: Number(productForm.price) || 0,
          vat_code: productForm.vat_code,
          um: productForm.um,
          stock: Number(productForm.stock) || 0,
          barcode: productForm.barcode || null,
          category: productForm.category || null,
          subcategory: productForm.subcategory || null,
          producer_name: productForm.producer_name || null,
          link: productForm.link || null,
          notes: productForm.notes || null,
          image_file_name: productForm.image_file_name || null,
          custom_field1: productForm.custom_field1 || null,
          custom_field2: productForm.custom_field2 || null,
          custom_field3: productForm.custom_field3 || null,
          custom_field4: productForm.custom_field4 || null,
          online_promo: productForm.online_promo || null,
          online_warranty: productForm.online_warranty || null,
          online_category_image: productForm.online_category_image || null,
          online_notes: productForm.online_notes || null,
          online_customized: productForm.online_customized ? 1 : 0
        })
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(editingProduct ? 'Prodotto aggiornato con successo' : 'Prodotto inserito con successo');
        setIsProductModalOpen(false);
        setEditingProduct(null);
        setProductForm({
          code: '', description: '', price: '', vat_code: '22', um: 'pz', stock: '',
          barcode: '', category: '', subcategory: '', producer_name: '', link: '', notes: '', image_file_name: '',
          custom_field1: '', custom_field2: '', custom_field3: '', custom_field4: '',
          online_promo: '', online_warranty: '', online_category_image: '', online_notes: '', online_customized: false
        });
        fetchProducts();
      } else {
        showStatus(data.error || 'Errore durante il salvataggio del prodotto', 'error');
      }
    } catch (err) {
      showStatus('Si è verificato un errore di rete', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    try {
      const res = await fetch(`/api/easyfatt/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showStatus('Prodotto eliminato con successo');
        fetchProducts();
      } else {
        showStatus('Impossibile eliminare il prodotto', 'error');
      }
    } catch (err) {
      showStatus('Errore durante l\'eliminazione del prodotto', 'error');
    }
  };

  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      code: prod.code,
      description: prod.description,
      price: String(prod.price),
      vat_code: prod.vat_code,
      um: prod.um,
      stock: String(prod.stock),
      barcode: prod.barcode || '',
      category: prod.category || '',
      subcategory: prod.subcategory || '',
      producer_name: prod.producer_name || '',
      link: prod.link || '',
      notes: prod.notes || '',
      image_file_name: prod.image_file_name || '',
      custom_field1: prod.custom_field1 || '',
      custom_field2: prod.custom_field2 || '',
      custom_field3: prod.custom_field3 || '',
      custom_field4: prod.custom_field4 || '',
      online_promo: prod.online_promo || '',
      online_warranty: prod.online_warranty || '',
      online_category_image: prod.online_category_image || '',
      online_notes: prod.online_notes || '',
      online_customized: prod.online_customized === 1
    });
    setIsProductModalOpen(true);
  };

  // Order actions
  const handleAddOrderItem = () => {
    if (!selectedProductCode) return;
    const prod = products.find(p => p.code === selectedProductCode);
    if (!prod) return;

    // Check if product is already in order
    const isAlreadyAdded = orderForm.items.some(i => i.product_code === selectedProductCode);
    if (isAlreadyAdded) {
      showStatus('Prodotto già aggiunto all\'ordine', 'error');
      return;
    }

    setOrderForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_code: prod.code,
          description: prod.description,
          qty: selectedProductQty,
          price: selectedProductPrice || prod.price,
          vat_code: prod.vat_code,
          um: prod.um
        }
      ]
    }));

    setSelectedProductCode('');
    setSelectedProductQty(1);
    setSelectedProductPrice(0);
  };

  const handleRemoveOrderItem = (code: string, index?: number) => {
    setOrderForm(prev => {
      if (typeof index === 'number' && index >= 0 && index < prev.items.length) {
        const newItems = [...prev.items];
        newItems.splice(index, 1);
        return { ...prev, items: newItems };
      }
      return {
        ...prev,
        items: prev.items.filter(i => String(i.product_code).trim() !== String(code).trim())
      };
    });
  };

  // Advanced filtered products for order creator (Base without category)
  const orderBaseFilteredProducts = products.filter(p => {
    const searchLower = orderProductSearch.toLowerCase();
    const matchesSearch = 
      p.code.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower) ||
      (p.category && p.category.toLowerCase().includes(searchLower)) ||
      (p.subcategory && p.subcategory.toLowerCase().includes(searchLower)) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchLower));
    
    const matchesAvailability = !orderOnlyAvailable || Number(p.stock) > 0;
    const matchesLink = matchesLinkFilter(p);
    const matchesCommission = matchesCommissionFilter(p);
    
    return matchesSearch && matchesAvailability && matchesLink && matchesCommission;
  });

  // Dynamic order product categories matching current active filters
  const orderProductCategories = Array.from(new Set(orderBaseFilteredProducts.map(p => p.category).filter(Boolean))) as string[];

  const orderFilteredProducts = orderBaseFilteredProducts
    .filter(p => !orderSelectedCategory || p.category === orderSelectedCategory)
    .sort((a, b) => {
      if (orderProductSortBy === 'price-asc') return Number(a.price) - Number(b.price);
      if (orderProductSortBy === 'price-desc') return Number(b.price) - Number(a.price);
      if (orderProductSortBy === 'stock-desc') return Number(b.stock) - Number(a.stock);
      return a.description.localeCompare(b.description);
    });

  const getProductQty = (code: string) => productQuantities[code] || 1;

  const setProductQty = (code: string, val: number) => {
    setProductQuantities(prev => ({
      ...prev,
      [code]: Math.max(1, val)
    }));
  };

  const handleAddProductToOrder = (prod: Product, qty: number, priceOverride?: number) => {
    const isBackorder = Number(prod.stock) <= 0;
    const existingIndex = orderForm.items.findIndex(i => i.product_code === prod.code);
    if (existingIndex > -1) {
      setOrderForm(prev => {
        const newItems = [...prev.items];
        newItems[existingIndex].qty += qty;
        return { ...prev, items: newItems };
      });
      showStatus(
        isBackorder 
          ? `Quantità in Pre-ordine aggiornata per ${prod.description}` 
          : `Quantità aggiornata per ${prod.description}`, 
        'success'
      );
    } else {
      setOrderForm(prev => ({
        ...prev,
        items: [
          ...prev.items,
          {
            product_code: prod.code,
            description: prod.description,
            qty: qty,
            price: priceOverride !== undefined ? priceOverride : prod.price,
            vat_code: prod.vat_code || '22',
            um: prod.um || 'pz'
          }
        ]
      }));
      showStatus(
        isBackorder 
          ? `Inserito in Pre-ordine: ${prod.description}` 
          : `Aggiunto all'ordine: ${prod.description}`, 
        'success'
      );
    }
  };

  const getItemQtyInCart = (code: string) => {
    const found = orderForm.items.find(i => i.product_code === code);
    return found ? found.qty : 0;
  };

  const handleUpdateItemQty = (code: string, newQty: number, index?: number) => {
    if (newQty < 1) {
      handleRemoveOrderItem(code, index);
      return;
    }
    setOrderForm(prev => {
      if (typeof index === 'number' && index >= 0 && index < prev.items.length) {
        const newItems = [...prev.items];
        newItems[index] = { ...newItems[index], qty: newQty };
        return { ...prev, items: newItems };
      }
      return {
        ...prev,
        items: prev.items.map(i => String(i.product_code).trim() === String(code).trim() ? { ...i, qty: newQty } : i)
      };
    });
  };

  const handleUpdateItemPrice = (code: string, newPrice: number, index?: number) => {
    const cleanPrice = isNaN(newPrice) ? 0 : Math.round(newPrice * 100) / 100;
    setOrderForm(prev => {
      if (typeof index === 'number' && index >= 0 && index < prev.items.length) {
        const newItems = [...prev.items];
        newItems[index] = { ...newItems[index], price: cleanPrice };
        return { ...prev, items: newItems };
      }
      return {
        ...prev,
        items: prev.items.map(i => String(i.product_code).trim() === String(code).trim() ? { ...i, price: cleanPrice } : i)
      };
    });
  };

  const handleUpdateItemTotal = (code: string, newTotal: number, index?: number) => {
    const cleanTotal = isNaN(newTotal) ? 0 : Math.round(newTotal * 100) / 100;
    setOrderForm(prev => {
      if (typeof index === 'number' && index >= 0 && index < prev.items.length) {
        const newItems = [...prev.items];
        const qty = newItems[index].qty || 1;
        newItems[index] = { ...newItems[index], price: Math.round((cleanTotal / qty) * 100) / 100 };
        return { ...prev, items: newItems };
      }
      return {
        ...prev,
        items: prev.items.map(i => {
          if (String(i.product_code).trim() === String(code).trim()) {
            const qty = i.qty || 1;
            return { ...i, price: Math.round((cleanTotal / qty) * 100) / 100 };
          }
          return i;
        })
      };
    });
  };

  const handleCancelOrderCreation = () => {
    setIsCreatingOrder(false);
    setIsStickyCartOpen(false);
    setEditingOrderId(null);
    const initialPayment = paymentMethods.find(p => p.name === defaultPayment)?.name 
      || paymentMethods[0]?.name 
      || 'Bonifico bancario';
    setOrderForm({
      client_id: '',
      date: new Date().toISOString().split('T')[0],
      payment_name: initialPayment,
      payment_bank: '',
      notes: defaultNotes || '',
      items: []
    });
    setClientSearchQuery('');
    showStatus('Compilazione ordine annullata', 'info');
  };

  const handleOrderSubmit = async (status: 'Nuovo' | 'Bozza' = 'Nuovo') => {
    if (!orderForm.client_id) {
      showStatus('Seleziona un cliente', 'error');
      return;
    }
    if (orderForm.items.length === 0) {
      showStatus('Aggiungi almeno un prodotto all\'ordine', 'error');
      return;
    }

    // Check minimum order amount if set and status is 'Nuovo'
    if (status === 'Nuovo' && minOrderTotal > 0) {
      const currentTotal = orderForm.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
      if (currentTotal < minOrderTotal) {
        showStatus(`Impossibile inviare: il totale ordine (€ ${currentTotal.toFixed(2)}) è inferiore al minimo d'ordine configurato (€ ${minOrderTotal.toFixed(2)})`, 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const url = editingOrderId 
        ? `/api/easyfatt/orders/${editingOrderId}` 
        : '/api/easyfatt/orders';
      const method = editingOrderId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderForm, status })
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(
          status === 'Bozza' 
            ? 'Bozza dell\'ordine salvata con successo!' 
            : (editingOrderId ? 'Ordine aggiornato e completato!' : 'Ordine registrato con successo!')
        );
        setIsOrderModalOpen(false);
        setIsCreatingOrder(false);
        setEditingOrderId(null);
        setClientSearchQuery('');
        const initialPayment = paymentMethods.find(p => p.name === defaultPayment)?.name 
          || paymentMethods[0]?.name 
          || 'Bonifico bancario';
        setOrderForm({
          client_id: '',
          date: new Date().toISOString().split('T')[0],
          payment_name: initialPayment,
          payment_bank: '',
          notes: defaultNotes || '',
          items: []
        });
        fetchOrders();
        fetchProducts(); // Refresh stock quantities
      } else {
        showStatus(data.error || 'Errore durante la creazione dell\'ordine', 'error');
      }
    } catch (err) {
      showStatus('Errore di connessione al server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditOrder = (order: Order) => {
    if (order.status !== 'Bozza') {
      showStatus('Un ordine già inviato non può essere modificato.', 'error');
      return;
    }
    setEditingOrderId(order.id);
    setOrderForm({
      client_id: String(order.client_id),
      date: order.date,
      payment_name: order.payment_name || defaultPayment || 'Bonifico bancario',
      payment_bank: order.payment_bank || '',
      notes: order.notes || defaultNotes || '',
      items: (order.items || []).map((it: any) => ({
        product_code: it.product_code,
        description: it.description,
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0,
        vat_code: it.vat_code || defaultVat || '22',
        um: it.um || 'pz'
      }))
    });
    setActiveTab('products');
    setIsCreatingOrder(true);
    showStatus(`Modifica bozza #${order.number || order.id}: puoi aggiungere o modificare articoli dal catalogo.`);
  };

  const handleCopyOrder = (order: Order) => {
    setEditingOrderId(null);
    setOrderForm({
      client_id: String(order.client_id),
      date: new Date().toISOString().split('T')[0],
      payment_name: order.payment_name || defaultPayment || 'Bonifico bancario',
      payment_bank: order.payment_bank || '',
      notes: order.notes ? `[Copia da Ord. #${order.number || order.id}] ${order.notes}` : `Copia da Ord. #${order.number || order.id}`,
      items: (order.items || []).map((it: any) => ({
        product_code: it.product_code || it.code || '',
        description: it.description || '',
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0,
        vat_code: it.vat_code || defaultVat || '22',
        um: it.um || 'pz'
      }))
    });
    setActiveTab('products');
    setIsCreatingOrder(true);
    showStatus(`Copia dell'ordine #${order.number || order.id} caricata nel carrello! Puoi aggiungere o modificare articoli dal catalogo.`);
  };

  // Permission helper: agents and capoarea can delete drafts only for their assigned clients; admins can delete any draft
  const canDeleteOrder = (order: Order | null): boolean => {
    if (!order || order.status !== 'Bozza') return false;
    if (isUserAdmin) return true;

    const role = (user?.role || '').toLowerCase().trim();
    const isAgent = role === 'agent' || role === 'agente';
    const isCapoArea = role === 'capoarea' || role === 'capo_area' || role === 'area_manager';
    if (!isAgent && !isCapoArea) return false;

    const curName = (user?.name || '').toLowerCase().trim();
    const curId = user?.id ? Number(user.id) : null;
    const curDept = (user?.department || '').toLowerCase().trim();

    // 1. Direct assignment on order
    if (curId && order.agent_id && curId === Number(order.agent_id)) return true;
    if (curName && order.agent_name && (
      order.agent_name.toLowerCase().trim() === curName || 
      order.agent_name.toLowerCase().includes(curName) || 
      curName.includes(order.agent_name.toLowerCase().trim())
    )) return true;

    // 2. Client assigned to user or region/department match
    const client = clients.find(c => 
      c.id === order.client_id || 
      (c.code && (order as any).client_code && c.code === (order as any).client_code) || 
      (c.name && order.client_name && c.name.toLowerCase() === order.client_name.toLowerCase())
    );
    if (client) {
      const clAgente = String((client as any).agente || '').toLowerCase().trim();
      if (curName && clAgente && (clAgente === curName || clAgente.includes(curName) || curName.includes(clAgente))) return true;
      if (isCapoArea) {
        if (curDept) {
          const clRegion = String(client.region || '').toLowerCase().trim();
          const clProvince = String(client.province || '').toLowerCase().trim();
          if (clRegion && (curDept.includes(clRegion) || clRegion.includes(curDept))) return true;
          if (clProvince && (curDept.includes(clProvince) || clProvince.includes(curDept))) return true;
        }
        return true;
      }
    }

    if (isCapoArea) return true;
    return false;
  };

  const handleConfirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeletingOrder(true);
    try {
      const res = await fetch(`/api/easyfatt/orders/${orderToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        showStatus(`Bozza d'ordine #${orderToDelete.number || orderToDelete.id} eliminata con successo!`, 'success');
        if (selectedOrder && selectedOrder.id === orderToDelete.id) {
          setIsOrderDetailOpen(false);
          setSelectedOrder(null);
        }
        setOrderToDelete(null);
        fetchOrders();
      } else {
        const data = await res.json().catch(() => ({}));
        showStatus(data.error || 'Impossibile cancellare la bozza', 'error');
      }
    } catch (err) {
      showStatus('Errore durante la cancellazione della bozza', 'error');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const handleDeleteOrder = async (id: number) => {
    const targetOrder = orders.find(o => String(o.id) === String(id));
    if (targetOrder) {
      if (!canDeleteOrder(targetOrder)) {
        showStatus('Non hai i permessi per eliminare questa bozza (puoi eliminare solo bozze dei tuoi clienti).', 'error');
        return;
      }
      setOrderToDelete(targetOrder);
      return;
    }
    try {
      const res = await fetch(`/api/easyfatt/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showStatus('Bozza cancellata con successo dal sistema', 'success');
        fetchOrders();
      } else {
        const data = await res.json().catch(() => ({}));
        showStatus(data.error || 'Impossibile cancellare la bozza', 'error');
      }
    } catch (err) {
      showStatus('Errore durante la cancellazione della bozza', 'error');
    }
  };

  const handleTransmitDraft = async (id: number) => {
    try {
      const res = await fetch(`/api/easyfatt/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Nuovo' })
      });
      if (res.ok) {
        showStatus('Ordine trasmesso con successo!', 'success');
        fetchOrders();
      } else {
        const err = await res.json();
        showStatus(err.error || 'Impossibile trasmettere l\'ordine', 'error');
      }
    } catch (err) {
      showStatus('Errore durante la trasmissione dell\'ordine', 'error');
    }
  };

  const toggleSelectOrder = (id: number) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
    );
  };

  const currentAdminOrders = adminOrdersData.length > 0 ? adminOrdersData : orders;
  const isAllCurrentPageSelected = currentAdminOrders.length > 0 && currentAdminOrders.every(o => selectedOrderIds.includes(o.id));

  const toggleSelectAllOrders = () => {
    const pageIds = currentAdminOrders.map(o => o.id);
    if (isAllCurrentPageSelected) {
      setSelectedOrderIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  // Export functions
  const handleExportClients = () => {
    window.open('/api/easyfatt/export-clients', '_blank');
    showStatus('Anagrafiche esportate in formato Easyfatt-XML');
  };

  const handleExportClientsXlsx = () => {
    window.open('/api/easyfatt/export-clients?format=xlsx', '_blank');
    showStatus('Anagrafiche esportate in formato Easyfatt-XLSX');
  };

  const handleExportProducts = () => {
    window.open('/api/easyfatt/export-products', '_blank');
    showStatus('Catalogo prodotti esportato in formato Easyfatt-XML');
  };

  const handleExportSelectedOrders = () => {
    if (selectedOrderIds.length === 0) {
      showStatus('Seleziona almeno un ordine da trasmettere', 'error');
      return;
    }
    window.open(`/api/easyfatt/export-orders?ids=${selectedOrderIds.join(',')}`, '_blank');
    showStatus(`Esportati ${selectedOrderIds.length} ordini in formato Easyfatt-XML per l'importazione`);
    setSelectedOrderIds([]);
    setTimeout(fetchOrders, 1500); // refresh orders statuses (will be updated to "Esportato")
  };

  const handleTestDownloadOrders = () => {
    window.open('/api/easyfatt/download-orders?appver=2', '_blank');
    showStatus('Anteprima tracciato XML ordini generata');
  };

  // Import file processing
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'products' | 'clients') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    const url = type === 'products' ? '/api/easyfatt/import-products' : '/api/easyfatt/import-clients';

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(`Importazione completata con successo! Nuovi inseriti: ${data.imported || 0}, Aggiornati: ${data.updated || 0}`);
        if (type === 'products') fetchProducts();
        else fetchClients();
      } else {
        showStatus(data.error || 'Errore durante l\'importazione dei dati XML', 'error');
      }
    } catch (err) {
      showStatus('Errore di connessione o formato non valido', 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleImportProductsXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/easyfatt/import-products-xlsx', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        let msg = `Importazione Excel completata! Articoli aggiornati/arricchiti: ${data.updated || 0}. Righe senza corrispondenza (ignorate): ${data.ignored || 0}.`;
        if (data.createdColumns && data.createdColumns.length > 0) {
          msg += ` Nuovi campi creati nel CRM: ${data.createdColumns.join(', ')}.`;
        }
        showStatus(msg, 'success');
        fetchProducts();
      } else {
        showStatus(data.error || 'Errore durante l\'importazione del file Excel (.xlsx)', 'error');
      }
    } catch (err) {
      showStatus('Errore di connessione o formato file non valido', 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleImportOrdersXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingOrdersXml(true);
    setOrdersXmlLogs(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/easyfatt/import-orders-xml', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setOrdersXmlLogs(data);
        setIsOrdersXmlModalOpen(true);
        showStatus(`Importazione ordini completata! ${data.importedCount || 0} ordini elaborati con successo.`, 'success');
        fetchOrders();
      } else {
        showStatus(data.error || 'Errore durante l\'importazione del file XML ordini', 'error');
      }
    } catch (err) {
      showStatus('Errore di connessione o formato XML ordini non valido', 'error');
    } finally {
      setIsImportingOrdersXml(false);
      e.target.value = '';
    }
  };

  // Filters
  const filteredProducts = products.filter(p => 
    (p.code.toLowerCase().includes(productSearch.toLowerCase()) ||
     p.description.toLowerCase().includes(productSearch.toLowerCase())) &&
    matchesLinkFilter(p) &&
    matchesCommissionFilter(p)
  );

  // Base filtered products (matching search, stock availability, link filter, commission filter - without category filter)
  const agentBaseFilteredProducts = products.filter(p => {
    const searchLower = productSearch.toLowerCase();
    const matchesSearch = 
      p.code.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower) ||
      (p.category && p.category.toLowerCase().includes(searchLower)) ||
      (p.subcategory && p.subcategory.toLowerCase().includes(searchLower));
    
    const matchesAvailability = !onlyAvailable || Number(p.stock) > 0;
    const matchesLink = matchesLinkFilter(p);
    const matchesCommission = matchesCommissionFilter(p);
    
    return matchesSearch && matchesAvailability && matchesLink && matchesCommission;
  });

  // Dynamic list of unique product categories derived ONLY from products matching active non-category filters
  const productCategories = Array.from(new Set(agentBaseFilteredProducts.map(p => p.category).filter(Boolean))) as string[];

  // Agent-specific advanced catalog filtering & sorting
  const agentFilteredProducts = agentBaseFilteredProducts
    .filter(p => !selectedCategory || p.category === selectedCategory)
    .sort((a, b) => {
      if (productSortBy === 'price-asc') {
        return Number(a.price) - Number(b.price);
      }
      if (productSortBy === 'price-desc') {
        return Number(b.price) - Number(a.price);
      }
      if (productSortBy === 'stock-desc') {
        return Number(b.stock) - Number(a.stock);
      }
      // default: alphabetical by description
      return a.description.localeCompare(b.description);
    });

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.city && c.city.toLowerCase().includes(clientSearch.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(clientSearch.toLowerCase()))
  );

  const orderTotalImponibile = orderForm.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const isBelowMinOrderTotal = minOrderTotal > 0 && orderTotalImponibile < minOrderTotal;

  return (
    <div className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto bg-[#faf7f9] space-y-5 sm:space-y-6 lg:space-y-8 min-h-screen">
      
      {/* Dashboard Operativa Integrata (Connect Sales & Order Hub) */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-xl relative overflow-hidden space-y-6">
        {/* Branding accent line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#5A5A40] via-[#8C8C6B] to-[#5A5A40]" />
        
        {/* Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
          
          {/* Section 1: Connect Branding & Status Summary */}
          <div className="md:col-span-2 lg:col-span-5 space-y-4 border-b md:border-b-0 lg:border-r border-gray-100 pb-5 md:pb-0 lg:pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-[#5A5A40]/15">
                <RefreshCw size={11} className="animate-spin-slow" />
                Connect Hub
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sincronizzazione Attiva
              </span>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-black tracking-tight text-gray-900 flex items-center gap-2">
                Connect Business Hub
              </h1>
              <p className="text-xs text-gray-500 leading-relaxed max-w-md">
                Piattaforma centralizzata per la gestione agenti, inserimento ordini in tempo reale, consultazione catalogo e gestione completa dell'anagrafica clienti.
              </p>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button 
                onClick={() => { setIsAdminMode(false); setActiveTab('products'); setIsCreatingOrder(false); }}
                className="bg-gray-50 hover:bg-[#5A5A40]/5 border border-gray-150 hover:border-[#5A5A40]/20 p-3 rounded-xl transition-all text-left cursor-pointer group"
              >
                <span className="text-[9px] uppercase font-black text-gray-400 block tracking-wider group-hover:text-[#5A5A40]">Catalogo Prodotti</span>
                <span className="text-sm font-black text-gray-800 font-mono flex items-center justify-between mt-0.5">
                  {filteredProducts.length !== products.length ? (
                    <span>{filteredProducts.length} <span className="text-xs text-gray-400 font-normal">/ {products.length}</span></span>
                  ) : (
                    <span>{products.length} articoli</span>
                  )}
                  <Package size={14} className="text-gray-400 group-hover:text-[#5A5A40]" />
                </span>
              </button>

              <button 
                onClick={() => { setIsAdminMode(false); setActiveTab('clients'); setIsCreatingOrder(false); }}
                className="bg-gray-50 hover:bg-[#5A5A40]/5 border border-gray-150 hover:border-[#5A5A40]/20 p-3 rounded-xl transition-all text-left cursor-pointer group"
              >
                <span className="text-[9px] uppercase font-black text-gray-400 block tracking-wider group-hover:text-[#5A5A40]">Anagrafica Clienti</span>
                <span className="text-sm font-black text-gray-800 font-mono flex items-center justify-between mt-0.5">
                  {clients.length} registrati
                  <Users size={14} className="text-gray-400 group-hover:text-[#5A5A40]" />
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: Connect Operational Stats */}
          <div className="md:col-span-1 lg:col-span-3 flex flex-col justify-center space-y-4">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-1">Stato Ordini</span>
              <div className="bg-[#FDFDFB] border border-[#E5E7EB] rounded-2xl p-4 space-y-3 shadow-xs">
                <button 
                  onClick={() => { setIsAdminMode(false); setActiveTab('orders'); setIsCreatingOrder(false); }}
                  className="w-full flex items-center justify-between text-xs hover:bg-gray-50 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="text-gray-500 font-medium">Bozze Locali:</span>
                  <span className="font-mono font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    {orders.filter(o => o.status === 'Bozza').length}
                  </span>
                </button>
                <button 
                  onClick={() => { setIsAdminMode(false); setActiveTab('orders'); setIsCreatingOrder(false); }}
                  className="w-full flex items-center justify-between text-xs border-t border-gray-100 pt-2 hover:bg-gray-50 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="text-gray-500 font-medium">Ordini Confermati:</span>
                  <span className="font-mono font-black text-[#5A5A40] bg-[#5A5A40]/5 px-2 py-0.5 rounded-md border border-[#5A5A40]/10">
                    {orders.filter(o => o.status !== 'Bozza').length}
                  </span>
                </button>
                <button 
                  onClick={() => { setIsAdminMode(false); setActiveTab('orders'); setIsCreatingOrder(false); }}
                  className="w-full flex items-center justify-between text-xs border-t border-gray-100 pt-2 hover:bg-gray-50 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="text-gray-500 font-medium">Trasmessi in Sede:</span>
                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    {orders.filter(o => o.status !== 'Bozza').length}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Pulsanti Rapidi (Ordini, Catalogo, Anagrafica) */}
          <div className="md:col-span-1 lg:col-span-4 space-y-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-2">Pulsanti Rapidi</span>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Pulsante 1: Lista Ordini */}
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setActiveTab('orders');
                  setIsCreatingOrder(false);
                }}
                className="flex flex-col items-start p-3 bg-gray-50 hover:bg-[#5A5A40]/5 text-gray-800 border border-gray-200 hover:border-[#5A5A40]/30 rounded-2xl transition-all group cursor-pointer text-left active:scale-95"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <FileText size={18} className="text-[#5A5A40] group-hover:scale-110 transition-transform" />
                  <span className="bg-[#5A5A40]/10 text-[#5A5A40] text-[9px] font-bold px-1.5 py-0.5 rounded">{orders.length}</span>
                </div>
                <span className="text-xs font-black block">Lista Ordini</span>
                <span className="text-[10px] text-gray-500 block mt-0.5 leading-tight">Storico & Bozze</span>
              </button>

              {/* Pulsante 2: Catalogo Prodotti */}
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setActiveTab('products');
                  setIsCreatingOrder(false);
                }}
                className="flex flex-col items-start p-3 bg-gray-50 hover:bg-[#5A5A40]/5 text-gray-800 border border-gray-200 hover:border-[#5A5A40]/30 rounded-2xl transition-all group cursor-pointer text-left active:scale-95"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <Package size={18} className="text-[#5A5A40] group-hover:scale-110 transition-transform" />
                  <span className="bg-[#5A5A40]/10 text-[#5A5A40] text-[9px] font-bold px-1.5 py-0.5 rounded">{filteredProducts.length}</span>
                </div>
                <span className="text-xs font-black block">Catalogo</span>
                <span className="text-[10px] text-gray-500 block mt-0.5 leading-tight">Prodotti & Listini</span>
              </button>

              {/* Pulsante 3: Anagrafica Clienti */}
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setActiveTab('clients');
                  setIsCreatingOrder(false);
                }}
                className="flex flex-col items-start p-3 bg-gray-50 hover:bg-[#5A5A40]/5 text-gray-800 border border-gray-200 hover:border-[#5A5A40]/30 rounded-2xl transition-all group cursor-pointer text-left active:scale-95"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <Users size={18} className="text-[#5A5A40] group-hover:scale-110 transition-transform" />
                  <span className="bg-[#5A5A40]/10 text-[#5A5A40] text-[9px] font-bold px-1.5 py-0.5 rounded">{clients.length}</span>
                </div>
                <span className="text-xs font-black block">Anagrafica</span>
                <span className="text-[10px] text-gray-500 block mt-0.5 leading-tight">Clienti & Rubrica</span>
              </button>

              {/* Pulsante 4: Girovisite */}
              <button
                onClick={() => {
                  setIsAdminMode(false);
                  setActiveTab('girovisite');
                  setIsCreatingOrder(false);
                }}
                className="flex flex-col items-start p-3 bg-gray-50 hover:bg-[#5A5A40]/5 text-gray-800 border border-gray-200 hover:border-[#5A5A40]/30 rounded-2xl transition-all group cursor-pointer text-left active:scale-95"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <Calendar size={18} className="text-[#5A5A40] group-hover:scale-110 transition-transform" />
                  <span className="bg-[#5A5A40]/10 text-[#5A5A40] text-[9px] font-bold px-1.5 py-0.5 rounded">Girovisite</span>
                </div>
                <span className="text-xs font-black block">Girovisite</span>
                <span className="text-[10px] text-gray-500 block mt-0.5 leading-tight">Calendario & Affiancamenti</span>
              </button>
            </div>

            {/* Extra Admin Connect Links */}
            {isUserAdmin && (
              <div className="flex gap-2 justify-end pt-1 flex-wrap">
                <button 
                  onClick={() => { setIsAdminMode(true); setAdminTab('connections'); }}
                  className="text-[10px] font-bold text-[#5A5A40] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sliders size={12} /> Configurazione Connect Hub
                </button>
                <span className="text-gray-300">|</span>
                <button 
                  onClick={() => { setIsAdminMode(true); setAdminTab('commercial-logic'); }}
                  className="text-[10px] font-bold text-[#5A5A40] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Layers size={12} /> Sconti e Listini
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Role-Based Mode Selector Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-3xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            isAdminMode ? "bg-[#5A5A40]/10 text-[#5A5A40]" : "bg-emerald-50 text-emerald-700"
          )}>
            {isAdminMode ? <Sliders size={18} /> : <ShoppingCart size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-black text-[#111827] uppercase tracking-wider">
              {isAdminMode ? "Console Amministratore" : "Vista Operativa Agente"}
            </h3>
            <p className="text-[11px] text-[#6B7280]">
              {isAdminMode 
                ? "Gestione tecnica delle connessioni, sincronizzazione dati e configurazione listini Connect." 
                : "Sezione facilitata per l'inserimento degli ordini e la consultazione rapida del catalogo e dei clienti."}
            </p>
          </div>
        </div>

        {/* Toggler (Only visible to admin users, standard users are locked in Agent View) */}
        {isUserAdmin ? (
          <div className="bg-gray-100 p-1 rounded-2xl flex gap-1 self-start md:self-auto">
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActiveTab('orders'); // default to orders in agent mode
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                !isAdminMode 
                  ? "bg-white text-[#111827] shadow-sm" 
                  : "text-[#6B7280] hover:text-[#111827]"
              )}
            >
              <ShoppingCart size={14} />
              Vista Agente
            </button>
            <button
              onClick={() => {
                setIsAdminMode(true);
                setAdminTab('connections'); // default to connections in admin mode
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                isAdminMode 
                  ? "bg-[#5A5A40] text-white shadow-sm" 
                  : "text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <Sliders size={14} />
              Console Admin
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border border-emerald-100 self-start md:self-auto">
            Accesso Agente Attivo
          </div>
        )}
      </div>

      {/* Status Message Overlay / Banner */}
      <AnimatePresence>
        {statusMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold shadow-lg",
              statusMsg.type === 'success' 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : statusMsg.type === 'info'
                ? "bg-slate-900 border-slate-700 text-slate-100"
                : "bg-rose-50 border-rose-200 text-rose-800"
            )}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : statusMsg.type === 'info' ? (
              <Info size={18} className="text-sky-400" />
            ) : (
              <AlertCircle size={18} className="text-rose-600" />
            )}
            <span className="flex-1">{statusMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* ECOSYSTEM INTERFACE 1: AGENT VIEW (Semplificata, Immediata, Sicura)        */}
      {/* ========================================================================= */}
      {!isAdminMode && (
        <div className="space-y-6">
          {/* Navigation Tabs for Agent */}
          <div className="flex border-b border-[#E5E7EB] gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('orders')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                activeTab === 'orders' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <FileText size={16} />
              Panoramica Ordini & Bozze ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                activeTab === 'products' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <Package size={16} />
              Giacenze & Catalogo Prodotti ({isAdminMode ? filteredProducts.length : agentFilteredProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('clients')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                activeTab === 'clients' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <Users size={16} />
              Anagrafiche Clienti ({clients.length})
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                activeTab === 'stats' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <BarChart3 size={16} />
              Statistiche & Analisi Portafoglio
            </button>
            <button
              onClick={() => setActiveTab('girovisite')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                activeTab === 'girovisite' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <Calendar size={16} />
              Girovisite & Affiancamenti
            </button>
          </div>

          {/* FILTRO TEMPORALE MENSILE (Trasversale per Ordini, Statistiche e Rate) */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs font-bold text-gray-700 w-full md:w-auto">
              <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40] shrink-0">
                <Calendar size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Filtro Periodo & Mese</div>
                <div className="text-xs font-bold text-gray-900 truncate flex items-center gap-1.5">
                  <span>Mese selezionato:</span>
                  <span className="text-[#5A5A40] font-black underline bg-[#5A5A40]/5 px-2 py-0.5 rounded-lg capitalize">
                    {formatMonthLabel(selectedMonthFilter)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto justify-start md:justify-end">
              <button
                type="button"
                onClick={() => setSelectedMonthFilter('ALL')}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-xl transition-all border active:scale-95 cursor-pointer",
                  selectedMonthFilter === 'ALL'
                    ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-2xs"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200"
                )}
              >
                Tutti i Mesi
              </button>

              {availableMonths.slice(0, 5).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMonthFilter(m)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-xl transition-all border capitalize active:scale-95 cursor-pointer",
                    selectedMonthFilter === m
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-2xs"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200"
                  )}
                >
                  {formatMonthLabel(m)}
                </button>
              ))}

              {availableMonths.length > 5 && (
                <select
                  value={availableMonths.includes(selectedMonthFilter) ? selectedMonthFilter : ''}
                  onChange={(e) => setSelectedMonthFilter(e.target.value || 'ALL')}
                  className="px-2.5 py-1.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#5A5A40] cursor-pointer"
                >
                  <option value="">Altri Mesi...</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* AGENT TAB 1: ORDERS (Nuovo Ordine e lista ordini) */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                {isCreatingOrder ? (
                  /* ============================================== */
                  /* WORKSPACE 2.1: STACKED ROW-BASED ORDER CREATOR */
                  /* ============================================== */
                  <div className="space-y-6 animate-fadeIn w-full">
                    
                    {/* TOP ROW: Header Navigation & Quick Status */}
                    <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handleCancelOrderCreation}
                          className="p-3 hover:bg-gray-100 text-gray-600 rounded-2xl transition-colors border border-gray-150 shadow-xs"
                          title="Torna alla lista ordini"
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <div>
                          <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-widest animate-pulse inline-block">
                            Spazio di Lavoro Agenti
                          </span>
                          <h3 className="text-xl font-serif font-black text-[#111827] mt-0.5">
                            Nuovo Ordine Cliente
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-start sm:self-auto">
                        <span className={cn(
                          "px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2",
                          orderForm.client_id 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                            : "bg-amber-50 border-amber-200 text-amber-800"
                        )}>
                          <span className={cn("w-2 h-2 rounded-full", orderForm.client_id ? "bg-emerald-500" : "bg-amber-500")} />
                          {orderForm.client_id ? 'Cliente Selezionato' : 'Seleziona Cliente'}
                        </span>

                        <div className="bg-[#5A5A40]/10 border border-[#5A5A40]/15 text-[#5A5A40] font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2">
                          <ShoppingCart size={14} />
                          <span>Articoli in Ordine: {orderForm.items.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* SPLIT GRID CONTAINER */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                      
                      {/* LEFT PANEL: CATALOG SEARCH & INSERTION (7/12 width on XL) */}
                      <div className="xl:col-span-7 space-y-6">
                        
                        {/* SELEZIONE CATALOGO PRODOTTI (The catalog item selector) */}
                        <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-6">
                          
                          {/* Search & Sorting filters Row */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                            <div>
                              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                1. Catalogo Prodotti (Filtra & Scegli Articoli)
                              </h4>
                              <p className="text-xs text-gray-400 mt-1">
                                Sfoglia l'intero archivio prodotti per inserire le quantità desiderate nelle righe d'ordine.
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              {/* Search Input */}
                              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-[#5A5A40]/15 transition-all w-full sm:w-48">
                                <Search size={14} className="text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Cerca..."
                                  value={orderProductSearch}
                                  onChange={(e) => setOrderProductSearch(e.target.value)}
                                  className="bg-transparent border-none outline-none w-full text-xs font-semibold text-gray-700"
                                />
                              </div>

                              {/* Sort Selector */}
                              <select
                                value={orderProductSortBy}
                                onChange={(e: any) => setOrderProductSortBy(e.target.value)}
                                className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer"
                              >
                                <option value="description">Alfabetico (A-Z)</option>
                                <option value="price-asc">Prezzo crescente</option>
                                <option value="price-desc">Prezzo decrescente</option>
                                <option value="stock-desc">Giacenza decrescente</option>
                              </select>

                              {/* Availability Toggle */}
                              <button
                                type="button"
                                onClick={() => setOrderOnlyAvailable(!orderOnlyAvailable)}
                                className={cn(
                                  "px-3 py-2 text-xs font-bold border rounded-xl flex items-center gap-1.5 transition-all",
                                  orderOnlyAvailable
                                    ? "bg-[#5A5A40]/10 border-[#5A5A40]/30 text-[#5A5A40]"
                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                )}
                                title="Mostra solo disponibili in magazzino"
                              >
                                <CheckSquare size={13} className={orderOnlyAvailable ? "text-[#5A5A40]" : "text-gray-400"} />
                                <span>Disponibili</span>
                              </button>
                            </div>
                          </div>

                          {/* Horizontal Categories Quick Bar */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Filtro rapido Categoria</label>
                            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                              <button
                                type="button"
                                onClick={() => setOrderSelectedCategory(null)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0",
                                  !orderSelectedCategory
                                    ? "bg-[#5A5A40] border-transparent text-white shadow-xs"
                                    : "bg-gray-50 border-gray-200/60 text-gray-600 hover:bg-gray-100"
                                )}
                              >
                                Tutti ({orderBaseFilteredProducts.length})
                              </button>
                              {orderProductCategories.sort().map(cat => {
                                const count = orderBaseFilteredProducts.filter(p => p.category === cat).length;
                                const isSelected = orderSelectedCategory === cat;
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setOrderSelectedCategory(isSelected ? null : cat)}
                                    className={cn(
                                      "px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0",
                                      isSelected
                                        ? "bg-[#5A5A40] border-transparent text-white shadow-xs"
                                        : "bg-gray-50 border-gray-200/60 text-gray-600 hover:bg-gray-100"
                                    )}
                                  >
                                    {cat} ({count})
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Wide Horizontal Products Catalog Rows */}
                          <div className="max-h-[500px] overflow-y-auto pr-2 divide-y divide-gray-100 [content-visibility:auto]">
                            {orderFilteredProducts.length === 0 ? (
                              <div className="py-12 text-center text-gray-400 italic text-xs font-semibold bg-gray-50/50 rounded-2xl border">
                                Nessun prodotto corrisponde ai criteri impostati.
                              </div>
                            ) : (
                              orderFilteredProducts.map(p => {
                                const qty = getProductQty(p.code);
                                const isLowStock = Number(p.stock) > 0 && Number(p.stock) <= 5;
                                const isOutOfStock = Number(p.stock) <= 0;

                                return (
                                  <div key={p.id} className="py-3.5 first:pt-0 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group">
                                    
                                    {/* Left Section: Image & Product Details */}
                                    <div className="flex gap-3 items-center min-w-0 flex-1 w-full">
                                      <div className="w-11 h-11 bg-gray-50 rounded-xl border border-gray-150 flex-shrink-0 flex items-center justify-center overflow-hidden relative shadow-inner">
                                        {p.image_file_name ? (
                                          <img
                                            src={`/uploads/${encodeURIComponent(p.image_file_name.trim())}`}
                                            alt={p.description}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-contain p-1"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                          />
                                        ) : (
                                          <ImageIcon size={16} className="text-[#C4C4A0] stroke-1" />
                                        )}
                                      </div>
                                      
                                      <div className="min-w-0 flex-1 space-y-0.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-mono text-[8px] bg-indigo-50 text-indigo-700 font-bold px-1 rounded border border-indigo-150">
                                            {p.code}
                                          </span>
                                          {p.category && (
                                            <span className="text-[8px] font-black uppercase tracking-wider text-[#5A5A40]">
                                              {p.category}
                                            </span>
                                          )}
                                        </div>
                                        
                                        <h4 className="text-xs font-bold text-gray-800 group-hover:text-[#5A5A40] transition-colors leading-snug break-words pr-2">
                                          {p.description}
                                        </h4>
                                      </div>
                                    </div>

                                    {/* Right Section: Availability, Price, Stepper, and Add button */}
                                    <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto flex-shrink-0 border-t md:border-t-0 border-gray-50 pt-2 md:pt-0">
                                      <div className="flex items-center gap-3">
                                        {/* Availability Status */}
                                        <div className="text-right">
                                          {isOutOfStock ? (
                                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                                              <Clock size={10} className="text-amber-600" />
                                              Pre-ordine (0)
                                            </span>
                                          ) : isLowStock ? (
                                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100 animate-pulse">
                                              Scarse ({p.stock})
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                                              Disp. {p.stock}
                                            </span>
                                          )}
                                        </div>

                                        {/* Unit Price */}
                                        <div className="text-right min-w-[90px]">
                                          <div className="font-mono text-xs font-black text-[#5A5A40]">
                                            € {p.price.toFixed(2)}
                                          </div>
                                          <div className="text-[10px] text-gray-400 font-medium">
                                            Imponibile
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {/* Stepper */}
                                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                                          <button
                                            type="button"
                                            onClick={() => setProductQty(p.code, qty - 1)}
                                            className="p-1 hover:bg-gray-200 text-gray-500 transition-colors"
                                          >
                                            <Minus size={10} />
                                          </button>
                                          <input
                                            type="number"
                                            min="1"
                                            value={qty}
                                            onChange={(e) => setProductQty(p.code, parseInt(e.target.value) || 1)}
                                            className="w-8 bg-transparent border-none text-center text-xs font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono p-0"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => setProductQty(p.code, qty + 1)}
                                            className="p-1 hover:bg-gray-200 text-gray-500 transition-colors"
                                          >
                                            <Plus size={10} />
                                          </button>
                                        </div>

                                        {/* Add / Pre-order Button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleAddProductToOrder(p, qty);
                                            setProductQty(p.code, 1);
                                          }}
                                          className={cn(
                                            "px-3 py-1.5 transition-all rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-xs active:scale-95",
                                            isOutOfStock
                                              ? "bg-amber-600 text-white hover:bg-amber-700"
                                              : "bg-[#5A5A40] text-white hover:bg-[#4E4E37]"
                                          )}
                                        >
                                          <Plus size={12} />
                                          <span>{isOutOfStock ? "Pre-ordina" : "Aggiungi"}</span>
                                        </button>
                                      </div>
                                    </div>

                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT PANEL: CLIENT METADATA & ORDER LINES SUMMARY (5/12 width on XL) */}
                      <div className="xl:col-span-5 space-y-6 xl:sticky xl:top-6">
                        
                        {/* 2. DATI CLIENTE & CONDIZIONI ORDINE */}
                        <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-5 shadow-xs space-y-4">
                          <div className="border-b border-gray-100 pb-2">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                              2. Dati Cliente & Condizioni
                            </h4>
                          </div>

                          <div className="space-y-4">
                            {/* Client Selector */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">
                                Cliente Selezionato *
                              </label>
                              
                              {!orderForm.client_id ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-[#5A5A40]/15 transition-all">
                                    <Search size={14} className="text-gray-400" />
                                    <input
                                      type="text"
                                      placeholder="Cerca cliente..."
                                      value={clientSearchQuery}
                                      onChange={(e) => setClientSearchQuery(e.target.value)}
                                      className="bg-transparent border-none outline-none w-full text-xs font-semibold text-gray-700"
                                    />
                                  </div>

                                  <div className="max-h-[140px] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white shadow-xs">
                                    {clients
                                      .filter(c =>
                                        c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                                        (c.city && c.city.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                                      )
                                      .map(c => (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => {
                                            let newPayment = orderForm.payment_name;
                                            if (c.notes) {
                                              const { daneaData } = parseClientNotes(c.notes);
                                              if (daneaData['Pagamento']) {
                                                const clientPm = daneaData['Pagamento'];
                                                const found = paymentMethods.find(p => p.name === clientPm || p.name.toLowerCase() === clientPm.toLowerCase());
                                                if (found) newPayment = found.name;
                                                else if (clientPm) newPayment = clientPm;
                                              }
                                            }
                                            setOrderForm(prev => ({ ...prev, client_id: String(c.id), payment_name: newPayment }));
                                            setClientSearchQuery('');
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-[#FDFDFB] transition-colors flex items-center justify-between text-xs"
                                        >
                                          <div className="font-bold text-gray-700">{c.name}</div>
                                          <div className="text-gray-400 text-[9px] font-mono">{c.city || 'N/D'}</div>
                                        </button>
                                      ))}
                                    {clients.filter(c =>
                                      c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                                      (c.city && c.city.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                                    ).length === 0 && (
                                      <div className="text-center py-4 text-xs text-gray-400 italic">
                                        Nessun cliente trovato
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                (() => {
                                  const selectedClient = clients.find(c => String(c.id) === orderForm.client_id);
                                  return (
                                    <div className="p-3 bg-[#5A5A40]/5 rounded-xl border border-[#5A5A40]/10 flex items-start justify-between gap-3">
                                      <div className="space-y-0.5 min-w-0 flex-1">
                                        <div className="font-black text-xs text-[#111827] truncate">
                                          {selectedClient?.name}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-medium truncate">
                                          {selectedClient?.city && `Città: ${selectedClient.city}`}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setOrderForm(prev => ({ ...prev, client_id: '' }))}
                                        className="text-[9px] font-black uppercase tracking-wider text-[#5A5A40] bg-white border border-gray-200 px-2 py-1 rounded hover:bg-[#5A5A40]/10 transition-all shrink-0"
                                      >
                                        Cambia
                                      </button>
                                    </div>
                                  );
                                })()
                              )}
                            </div>

                            {/* Date & Payment Selector */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                                  Data Ordine *
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={orderForm.date}
                                  onChange={(e) => setOrderForm({ ...orderForm, date: e.target.value })}
                                  className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-xs"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                                  Pagamento *
                                </label>
                                <select
                                  value={orderForm.payment_name}
                                  onChange={(e) => setOrderForm({ ...orderForm, payment_name: e.target.value })}
                                  className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-xs cursor-pointer"
                                >
                                  {paymentMethods.length > 0 ? (
                                    paymentMethods.map((pm) => (
                                      <option key={pm.id} value={pm.name}>
                                        {pm.name}
                                      </option>
                                    ))
                                  ) : (
                                    <>
                                      <option value="Bonifico bancario">Bonifico bancario</option>
                                      <option value="R.D. 30 gg">R.D. 30 gg</option>
                                      <option value="R.D. 60/90 gg">R.D. 60/90 gg</option>
                                      <option value="Contrassegno">Contrassegno</option>
                                      <option value="Contanti">Contanti</option>
                                    </>
                                  )}
                                </select>
                              </div>
                            </div>

                            {/* Support Bank & Notes */}
                            <div className="space-y-2.5">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                                  Banca d'Appoggio
                                </label>
                                <input
                                  type="text"
                                  value={orderForm.payment_bank}
                                  onChange={(e) => setOrderForm({ ...orderForm, payment_bank: e.target.value })}
                                  placeholder="Es: Intesa Sanpaolo"
                                  className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-xs"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                                  Note dell'Ordine
                                </label>
                                <textarea
                                  value={orderForm.notes}
                                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                                  placeholder="Indicazioni di consegna..."
                                  rows={2}
                                  className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none font-medium text-xs text-gray-700 resize-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 3. RIGHE DELL'ORDINE INSERITE */}
                        <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-5 shadow-xs space-y-4">
                          <div className="border-b border-gray-100 pb-2 flex justify-between items-center">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                              3. Righe dell'Ordine
                            </h4>
                            <span className="text-[10px] font-bold bg-[#5A5A40]/10 text-[#5A5A40] px-2.5 py-0.5 rounded-full">
                              {orderForm.items.length} articoli
                            </span>
                          </div>

                          {orderForm.items.length === 0 ? (
                            <div className="py-10 text-center text-gray-400 italic text-xs font-semibold bg-gray-50/50 rounded-xl border flex flex-col items-center justify-center gap-1.5">
                              <ShoppingCart size={24} className="text-gray-300 stroke-1" />
                              <div>Nessun articolo inserito nell'ordine.</div>
                              <div className="text-[9px] text-gray-400 font-normal">Scegli dal catalogo prodotti a sinistra.</div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                                {orderForm.items.map((item, idx) => {
                                  const line = calculateLineTotals(item.qty, item.price, item.vat_code || 22);
                                  return (
                                    <div key={`${item.product_code}-${idx}`} className="p-3 bg-gray-50 rounded-xl border border-gray-150 relative group/row space-y-2">
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-mono text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1 rounded">
                                              {item.product_code}
                                            </span>
                                            <span className="text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                              IVA {line.vatRate}%
                                            </span>
                                            {item.price < 0 && (
                                              <span className="text-[9px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200">
                                                Detrazione
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-xs font-bold text-gray-800 truncate mt-0.5">
                                            {item.description}
                                          </div>
                                        </div>
                                        
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveOrderItem(item.product_code, idx);
                                          }}
                                          className="text-gray-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                          title="Rimuovi"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>

                                      {/* Dynamic Imponibile breakdown */}
                                      <div className="bg-gray-50/90 p-2 rounded-lg border border-gray-200/70 text-[11px] space-y-1">
                                        <div className="flex justify-between items-center text-gray-600">
                                          <span>Prezzo Unit. Imponibile:</span>
                                          <span className="font-mono font-bold text-gray-900">€ {line.unitTaxable.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-gray-600">
                                          <span>Totale Riga Imponibile:</span>
                                          <span className="font-mono font-bold text-gray-900">€ {line.totalTaxable.toFixed(2)}</span>
                                        </div>
                                      </div>

                                      <div className="space-y-2 mt-2 pt-2 border-t border-gray-200/50">
                                        <div className="flex justify-between items-center">
                                          {/* Stepper qty */}
                                          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateItemQty(item.product_code, item.qty - 1, idx);
                                              }}
                                              className="text-gray-400 hover:text-gray-600 transition-colors px-2 py-0.5 cursor-pointer font-bold text-xs"
                                            >
                                              <Minus size={9} />
                                            </button>
                                            <span className="font-mono text-xs font-black text-gray-800 px-1.5">{item.qty}</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateItemQty(item.product_code, item.qty + 1, idx);
                                              }}
                                              className="text-gray-400 hover:text-gray-600 transition-colors px-2 py-0.5 cursor-pointer font-bold text-xs"
                                            >
                                              <Plus size={9} />
                                            </button>
                                          </div>

                                          <span className="text-[10px] font-mono text-gray-400">
                                            {item.um || 'pz'}
                                          </span>
                                        </div>

                                        {/* Interactive Price & Line Total Inputs */}
                                        <div className="grid grid-cols-2 gap-1.5 bg-white/80 p-1.5 rounded-lg border border-gray-150">
                                          <div>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">PREZZO UNIT. IMPONIBILE</div>
                                            <EditableAmountInput
                                              value={item.price}
                                              onChange={(newPrice) => handleUpdateItemPrice(item.product_code, newPrice, idx)}
                                              prefix="€"
                                              placeholder="0.00"
                                            />
                                          </div>
                                          <div>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">TOTALE RIGA IMPONIBILE</div>
                                            <EditableAmountInput
                                              value={Math.round(line.totalTaxable * 100) / 100}
                                              onChange={(newTotal) => handleUpdateItemTotal(item.product_code, newTotal, idx)}
                                              prefix="€"
                                              placeholder="0.00"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                    </div>
                                  );
                                })}
                              </div>

                              {/* Live Summary & Buttons inside sticky block */}
                              {(() => {
                                const grossTotal = orderForm.items.filter(i => i.price > 0).reduce((sum, item) => sum + (item.qty * item.price), 0);
                                const discountTotal = orderForm.items.filter(i => i.price < 0).reduce((sum, item) => sum + (item.qty * item.price), 0);
                                const totals = calculateOrderTotals(orderForm.items);

                                return (
                                  <div className="p-4 bg-[#FDFDFB] rounded-2xl border border-[#C4C4A0]/20 space-y-3">
                                    <div className="space-y-1.5 text-xs">
                                      <div className="flex justify-between text-gray-500">
                                        <span>Righe Totali:</span>
                                        <span className="font-mono font-bold text-gray-800">{orderForm.items.reduce((sum, item) => sum + item.qty, 0)} pz</span>
                                      </div>

                                      {discountTotal < 0 && (
                                        <>
                                          <div className="flex justify-between text-gray-500">
                                            <span>Subtotale Lordo:</span>
                                            <span className="font-mono font-bold text-gray-800">€ {grossTotal.toFixed(2)}</span>
                                          </div>
                                          <div className="flex justify-between text-rose-600 font-medium">
                                            <span>Sconti / Detrazioni:</span>
                                            <span className="font-mono font-bold">- € {Math.abs(discountTotal).toFixed(2)}</span>
                                          </div>
                                        </>
                                      )}

                                      <div className="flex justify-between text-gray-700 font-semibold">
                                        <span>Totale Imponibile:</span>
                                        <span className={cn("font-mono font-bold", totals.totalTaxable < 0 ? "text-rose-600" : "text-gray-800")}>
                                          € {totals.totalTaxable.toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-gray-600 text-[11px]">
                                        <span>Totale IVA:</span>
                                        <span className="font-mono font-bold text-gray-800">€ {totals.totalVat.toFixed(2)}</span>
                                      </div>
                                      <div className="border-t border-dashed border-gray-200 my-2 pt-2 flex justify-between text-sm">
                                        <span className="font-black text-gray-700">Totale Ordine (Ivato):</span>
                                        <span className={cn("font-mono font-black", totals.totalGross < 0 ? "text-rose-600" : "text-[#5A5A40]")}>
                                          € {totals.totalGross.toFixed(2)}
                                        </span>
                                      </div>
                                    </div>

                                {minOrderTotal > 0 && (
                                  <div className="text-center">
                                    <span className={cn(
                                      "inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider border w-full justify-center",
                                      isBelowMinOrderTotal 
                                        ? "bg-amber-50 text-amber-700 border-amber-150" 
                                        : "bg-emerald-50 text-emerald-700 border-emerald-150"
                                    )}>
                                      <span className={cn("w-1.5 h-1.5 rounded-full", isBelowMinOrderTotal ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
                                      {isBelowMinOrderTotal 
                                        ? `Sotto minimo ordine (€ ${minOrderTotal.toFixed(2)})` 
                                        : "Soglia minima ordine superata"}
                                    </span>
                                  </div>
                                )}

                                <div className="space-y-2 pt-2 border-t border-gray-100">
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      disabled={loading || !orderForm.client_id || orderForm.items.length === 0}
                                      onClick={() => handleOrderSubmit('Bozza')}
                                      className={cn(
                                        "py-2.5 text-[11px] font-bold text-[#5A5A40] bg-white hover:bg-[#5A5A40]/5 border border-[#5A5A40] rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 active:scale-95",
                                        (!orderForm.client_id || orderForm.items.length === 0) ? "opacity-40 cursor-not-allowed" : ""
                                      )}
                                    >
                                      <FileText size={12} />
                                      <span>Bozza</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={handleCancelOrderCreation}
                                      className="py-2.5 text-[11px] font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-gray-200 rounded-xl transition-all shadow-xs"
                                    >
                                      Annulla
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={loading || !orderForm.client_id || orderForm.items.length === 0 || isBelowMinOrderTotal}
                                    onClick={() => handleOrderSubmit('Nuovo')}
                                    className={cn(
                                      "w-full py-3 text-xs font-black text-white rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95",
                                      (!orderForm.client_id || orderForm.items.length === 0 || isBelowMinOrderTotal)
                                        ? "bg-gray-200 cursor-not-allowed text-gray-400"
                                        : "bg-[#5A5A40] hover:bg-[#4E4E37]"
                                    )}
                                  >
                                    <Save size={13} />
                                    <span>Invia Ordine a Sede</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                  </div>
                ) : (
                  /* ============================================== */
                  /* DEFAULT VIEW: ORDERS LIST TABLE & DASHBOARD    */
                  /* ============================================== */
                  <div className="space-y-6 w-full animate-fadeIn">
                    
                    {/* DASHBOARD GENERAL WIDGETS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Widget 1: Fatturato Totale */}
                      <div className="bg-white rounded-[1.75rem] border border-[#E5E7EB] p-5 shadow-xs flex items-center gap-4 hover:border-[#5A5A40]/30 transition-all">
                        <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center text-[#5A5A40] shrink-0">
                          <DollarSign size={22} />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280]">Fatturato Totale</span>
                          <h4 className="text-lg font-black text-[#111827] truncate">€ {stats.totalSales.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                          <p className="text-[10px] text-gray-500 font-medium truncate">
                            Pronti: <span className="text-[#5A5A40] font-black">€{stats.transmittedSales.toLocaleString('it-IT')}</span> • Bozze: <span className="font-bold">€{stats.draftSales.toLocaleString('it-IT')}</span>
                          </p>
                        </div>
                      </div>

                      {/* Widget 2: Volume Ordini */}
                      <div className="bg-white rounded-[1.75rem] border border-[#E5E7EB] p-5 shadow-xs flex items-center gap-4 hover:border-[#5A5A40]/30 transition-all">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700 shrink-0 border border-emerald-100">
                          <ShoppingCart size={22} />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280]">Volume Ordini</span>
                          <h4 className="text-lg font-black text-[#111827] truncate">{stats.ordersCount} Contratti</h4>
                          <p className="text-[10px] text-gray-500 font-medium truncate">
                            Inviati: <span className="text-emerald-700 font-black">{stats.completedOrdersCount}</span> • Bozze in attesa: <span className="font-bold text-gray-600">{stats.draftOrdersCount}</span>
                          </p>
                        </div>
                      </div>

                      {/* Widget 3: Valore Medio Contratto */}
                      <div className="bg-white rounded-[1.75rem] border border-[#E5E7EB] p-5 shadow-xs flex items-center gap-4 hover:border-[#5A5A40]/30 transition-all">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-700 shrink-0 border border-indigo-100">
                          <TrendingUp size={22} />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280]">Ticket Medio (AOV)</span>
                          <h4 className="text-lg font-black text-[#111827] truncate">€ {stats.aov.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                          <p className="text-[10px] text-gray-500 font-semibold truncate">Valore medio per stipula</p>
                        </div>
                      </div>

                      {/* Widget 4: Giacenze & Stock */}
                      <div className="bg-white rounded-[1.75rem] border border-[#E5E7EB] p-5 shadow-xs flex items-center gap-4 hover:border-[#5A5A40]/30 transition-all">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                          stats.outOfStockCount > 0 
                            ? "bg-rose-50 text-rose-700 border-rose-100 animate-pulse" 
                            : stats.lowStockCount > 0 
                            ? "bg-amber-50 text-amber-700 border-amber-100" 
                            : "bg-gray-50 text-gray-600 border-gray-100"
                        )}>
                          <Package size={22} />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280]">Monitor Stock</span>
                          <h4 className="text-lg font-black text-[#111827] truncate">{stats.totalProductsCount} Prodotti</h4>
                          <p className="text-[10px] text-gray-500 font-semibold truncate">
                            {stats.outOfStockCount > 0 ? (
                              <span className="text-rose-600 font-bold">{stats.outOfStockCount} Esauriti!</span>
                            ) : stats.lowStockCount > 0 ? (
                              <span className="text-amber-600 font-bold">{stats.lowStockCount} Sotto scorta</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">Scorte Ottimali</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* TABLE WORKSPACE */}
                    <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-5">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-lg font-serif font-bold text-[#111827]">Panoramica Ordini & Bozze Create</h3>
                            {isAgentOrdersLoading && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <RefreshCw size={10} className="animate-spin" />
                                Caricamento...
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#6B7280]">Paginazione server-side & ordinamento dinamico per colonna. Visualizza, modifica, invia o duplica gli ordini.</p>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab('products');
                            setIsCreatingOrder(true);
                            showStatus("Seleziona i prodotti dal Catalogo per comporre l'ordine.");
                          }}
                          className="flex items-center justify-center gap-2 px-5 py-3 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer shrink-0"
                        >
                          <Plus size={16} />
                          Componi Nuovo Ordine dal Catalogo
                        </button>
                      </div>

                      {/* Filter & Search Toolbar (Preserves active month, agent, and sort) */}
                      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#F9FAFB] p-3.5 rounded-2xl border border-gray-200">
                        {/* Search Input */}
                        <div className="relative flex-1">
                          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Cerca per cliente, num. ordine, agente, pagamento..."
                            value={agentOrdersPagination.filters.search}
                            onChange={(e) => agentOrdersPagination.setFilter('search', e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                          />
                          {agentOrdersPagination.filters.search && (
                            <button
                              onClick={() => agentOrdersPagination.setFilter('search', '')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
                              title="Cancella ricerca"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>

                        {/* Status Filter Pills */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shrink-0">
                          {[
                            { label: 'Tutti gli stati', value: 'all' },
                            { label: 'Confermati & Inviati', value: 'Confermato' },
                            { label: 'Bozze', value: 'Bozza' },
                          ].map(pill => (
                            <button
                              key={pill.value}
                              onClick={() => agentOrdersPagination.setFilter('status', pill.value)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                agentOrdersPagination.filters.status === pill.value
                                  ? "bg-[#5A5A40] text-white shadow-xs"
                                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                              )}
                            >
                              {pill.label}
                            </button>
                          ))}
                        </div>

                        {/* Reset Filters (if customized) */}
                        {(agentOrdersPagination.filters.search || agentOrdersPagination.filters.status !== 'all') && (
                          <button
                            onClick={() => {
                              agentOrdersPagination.resetFilters();
                              agentOrdersPagination.setFilter('month', selectedMonthFilter);
                              agentOrdersPagination.setFilter('agent', statsAgentFilter);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-bold border border-rose-200 transition-colors shrink-0 cursor-pointer"
                          >
                            <X size={13} />
                            Azzera filtri
                          </button>
                        )}
                      </div>

                      {/* Orders Table Container */}
                      <div className="space-y-4">
                          <div className="overflow-x-auto relative">
                            {isAgentOrdersLoading && (
                              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
                                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md border border-gray-100 text-xs font-bold text-gray-700">
                                  <RefreshCw size={14} className="animate-spin text-[#5A5A40]" />
                                  Aggiornamento ordini...
                                </div>
                              </div>
                            )}
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-[#E5E7EB] text-[10px] uppercase tracking-widest text-[#6B7280]">
                                  <TableSortHeader
                                    columnKey="number"
                                    sortState={agentOrdersPagination.sortState}
                                    onSort={agentOrdersPagination.toggleSort}
                                  >
                                    Num / ID
                                  </TableSortHeader>
                                  <TableSortHeader
                                    columnKey="client_name"
                                    sortState={agentOrdersPagination.sortState}
                                    onSort={agentOrdersPagination.toggleSort}
                                  >
                                    Cliente
                                  </TableSortHeader>
                                  <TableSortHeader
                                    columnKey="agent_name"
                                    sortState={agentOrdersPagination.sortState}
                                    onSort={agentOrdersPagination.toggleSort}
                                  >
                                    Agente
                                  </TableSortHeader>
                                  <TableSortHeader
                                    columnKey="date"
                                    sortState={agentOrdersPagination.sortState}
                                    onSort={agentOrdersPagination.toggleSort}
                                  >
                                    Data
                                  </TableSortHeader>
                                  <TableSortHeader
                                    columnKey="payment_name"
                                    sortState={agentOrdersPagination.sortState}
                                    onSort={agentOrdersPagination.toggleSort}
                                  >
                                    Metodo Pagamento
                                  </TableSortHeader>
                                  <TableSortHeader
                                    columnKey="total"
                                    sortState={agentOrdersPagination.sortState}
                                    onSort={agentOrdersPagination.toggleSort}
                                  >
                                    Totale
                                  </TableSortHeader>
                                  <TableSortHeader
                                    columnKey="status"
                                    sortState={agentOrdersPagination.sortState}
                                    onSort={agentOrdersPagination.toggleSort}
                                  >
                                    Stato Trasmissione
                                  </TableSortHeader>
                                  <th className="py-3 px-4 font-black text-right">Azioni</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E5E7EB] [content-visibility:auto]">
                                {agentOrdersData.length === 0 && !isAgentOrdersLoading ? (
                                  <tr>
                                    <td colSpan={8} className="py-16 text-center text-[#9CA3AF]">
                                      <ShoppingCart size={40} className="mx-auto text-gray-300 stroke-1 mb-2" />
                                      <p className="text-xs font-bold text-gray-700">Nessun ordine trovato con i criteri selezionati.</p>
                                      <p className="text-[11px] text-gray-400 mt-1">Prova a modificare la ricerca, il filtro mese o a resettare i filtri per vedere tutti gli ordini.</p>
                                    </td>
                                  </tr>
                                ) : (
                                  (agentOrdersData.length > 0 ? agentOrdersData : displayOrders.slice(0, agentOrdersPagination.pagination.limit)).map(order => (
                                  <tr key={order.id} className="hover:bg-[#F9FAFB] text-xs transition-colors">
                                    <td className="py-4 px-4 font-mono font-bold text-[#111827]">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>#{order.number || order.id}</span>
                                        {Boolean(order.is_imported) && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200" title="Ordine Storico Importato da XML Easyfatt">
                                            Storico XML
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-4 px-4 font-semibold text-[#111827]">
                                      <button
                                        onClick={() => handleViewClientDetails(order.client_id)}
                                        className="hover:text-[#5A5A40] hover:underline text-left font-semibold cursor-pointer focus:outline-none"
                                      >
                                        {order.client_name}
                                      </button>
                                    </td>
                                    <td className="py-4 px-4 text-gray-500">
                                      {order.agent_name || 'Nessun Agente'}
                                    </td>
                                    <td className="py-4 px-4 text-gray-500 font-mono">
                                      {order.date}
                                    </td>
                                    <td className="py-4 px-4 text-gray-500">
                                      {order.payment_name}
                                    </td>
                                    <td className="py-4 px-4 font-mono font-black text-[#5A5A40]">
                                      € {order.total.toFixed(2)}
                                    </td>
                                    <td className="py-4 px-4">
                                      <span className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                        order.status === 'Bozza'
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      )}>
                                        <span className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          order.status === 'Bozza' ? "bg-amber-500" : "bg-emerald-500"
                                        )} />
                                        {order.status === 'Bozza' ? 'Bozza' : 'Confermato & Trasmesso'}
                                      </span>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                      <div className="flex items-center justify-end flex-wrap gap-1.5">
                                        <button
                                          onClick={() => {
                                            setSelectedOrder(order);
                                            setIsOrderDetailOpen(true);
                                          }}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-all text-[11px] cursor-pointer"
                                          title="Visualizza dettagli ordine"
                                        >
                                          <Eye size={13} />
                                          Apri
                                        </button>
                                        
                                        <button
                                          onClick={() => handleEditOrder(order)}
                                          disabled={order.status !== 'Bozza'}
                                          className={cn(
                                            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all text-[11px]",
                                            order.status === 'Bozza'
                                              ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer"
                                              : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-50"
                                          )}
                                          title={order.status === 'Bozza' ? "Modifica bozza nel Catalogo" : "Ordine già inviato: modifica disattivata"}
                                        >
                                          <Edit3 size={13} />
                                          Modifica
                                        </button>

                                        <button
                                          onClick={() => handleCopyOrder(order)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold transition-all text-[11px] cursor-pointer"
                                          title="Copia e duplica questo ordine"
                                        >
                                          <Copy size={13} />
                                          Copia Ordine
                                        </button>

                                        {order.status === 'Bozza' && (
                                          <>
                                            <button
                                              onClick={() => handleTransmitDraft(order.id)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold transition-all text-[11px] cursor-pointer"
                                              title="Trasmetti bozza alla Sede"
                                            >
                                              <CheckCircle2 size={13} />
                                              Invia
                                            </button>

                                            {canDeleteOrder(order) && (
                                              <button
                                                onClick={() => setOrderToDelete(order)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold transition-all text-[11px] cursor-pointer"
                                                title="Cancella totalmente questa bozza dal sistema"
                                              >
                                                <Trash2 size={13} />
                                                Cancella
                                              </button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )))}
                              </tbody>
                            </table>
                          </div>

                          {/* Universal Pagination Controls */}
                          <DataTablePagination
                            pagination={agentOrdersPagination.pagination}
                            onPageChange={agentOrdersPagination.setPage}
                            onLimitChange={agentOrdersPagination.setLimit}
                            itemName="ordini"
                            isLoading={isAgentOrdersLoading}
                          />
                        </div>
                    </div>
                </div>
              )}
              </div>
            )}

            {/* AGENT TAB 2: PRODUCTS (Read-only catalogo con stock e ricerca) */}
            {activeTab === 'products' && (
              <div className="space-y-6">
                {/* Search & Statistics Bar */}
                <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-serif font-black text-[#111827]">Consultazione Catalogo</h3>
                    <p className="text-xs text-[#6B7280]">
                      Trovati <span className="font-bold text-[#5A5A40] font-mono">{agentFilteredProducts.length}</span> articoli su <span className="font-bold font-mono">{products.length}</span> totali in archivio.
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search Field */}
                    <div className="flex items-center gap-2.5 bg-[#F4F5F6] px-4 py-2.5 rounded-xl text-xs border border-[#E5E7EB] w-full sm:w-80 focus-within:ring-2 focus-within:ring-[#5A5A40]/10 transition-all">
                      <Search size={15} className="text-gray-400" />
                      <input
                        type="text"
                        placeholder="Cerca per codice, descrizione o tag..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="bg-transparent border-none outline-none w-full text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Catalog Grid Layout with Left Filter Sidebar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                  
                  {/* Left Sidebar: Filters & Categories */}
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-5 shadow-xs space-y-6 md:sticky md:top-6">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                      <Filter size={15} className="text-[#5A5A40]" />
                      <h4 className="text-xs uppercase font-black tracking-widest text-[#111827]">Filtri Catalogo</h4>
                    </div>

                    {/* Stock Availability Toggle */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setOnlyAvailable(!onlyAvailable)}
                        className="flex items-center gap-2.5 text-xs text-gray-700 font-bold hover:text-[#5A5A40] transition-colors w-full text-left"
                      >
                        <div className="text-[#5A5A40] flex-shrink-0">
                          {onlyAvailable ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                        Solo articoli in pronta consegna ({agentBaseFilteredProducts.filter(p => Number(p.stock) > 0).length})
                      </button>
                    </div>

                    {/* Sorting Select */}
                    <div className="space-y-2 border-t border-gray-100 pt-4">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Ordinamento</label>
                      <div className="relative">
                        <select
                          value={productSortBy}
                          onChange={(e: any) => setProductSortBy(e.target.value)}
                          className="w-full bg-[#F4F5F6] border border-[#E5E7EB] px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[#5A5A40]/15"
                        >
                          <option value="description">Alfabetico (A-Z)</option>
                          <option value="price-asc">Prezzo: Crescente</option>
                          <option value="price-desc">Prezzo: Decrescente</option>
                          <option value="stock-desc">Disponibilità decrescente</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500">
                          <ArrowUpDown size={13} />
                        </div>
                      </div>
                    </div>

                    {/* Category List */}
                    <div className="space-y-2 border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          Categorie ({productCategories.length})
                        </label>
                        {selectedCategory && (
                          <button
                            onClick={() => setSelectedCategory(null)}
                            className="text-[9px] font-bold text-rose-600 hover:underline"
                          >
                            Resetta
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                        <button
                          onClick={() => setSelectedCategory(null)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between",
                            !selectedCategory 
                              ? "bg-[#5A5A40]/10 text-[#5A5A40] border border-[#5A5A40]/10" 
                              : "bg-transparent text-gray-600 hover:bg-gray-50 hover:text-[#5A5A40]"
                          )}
                        >
                          <span>Tutte le categorie</span>
                          <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-lg border border-gray-200/50 text-gray-500">
                            {agentBaseFilteredProducts.length}
                          </span>
                        </button>

                        {productCategories.sort().map(cat => {
                          const count = agentBaseFilteredProducts.filter(p => p.category === cat).length;
                          const isSelected = selectedCategory === cat;
                          return (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(isSelected ? null : cat)}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between",
                                isSelected 
                                  ? "bg-[#5A5A40] text-white font-bold shadow-xs" 
                                  : "bg-transparent text-gray-600 hover:bg-gray-50 hover:text-[#5A5A40]"
                              )}
                            >
                              <span className="truncate pr-2">{cat}</span>
                              <span className={cn(
                                "font-mono text-[10px] px-1.5 py-0.5 rounded-lg border",
                                isSelected 
                                  ? "bg-white/20 border-white/20 text-white" 
                                  : "bg-gray-50 border-gray-100 text-gray-400"
                              )}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Products Grid */}
                  <div className="md:col-span-3 space-y-4">
                    {agentFilteredProducts.length === 0 ? (
                      <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-16 text-center text-gray-400 space-y-4 shadow-xs">
                        <div className="w-16 h-16 bg-[#F4F5F6] rounded-2xl flex items-center justify-center mx-auto border border-gray-100">
                          <ImageIcon size={32} className="stroke-1 text-[#C4C4A0]" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-gray-700">Nessun articolo corrispondente</p>
                          <p className="text-xs text-gray-400 max-w-sm mx-auto">Nessun prodotto corrisponde ai criteri o alla parola chiave cercata. Prova a reimpostare i filtri o la barra di ricerca.</p>
                        </div>
                        <button
                          onClick={() => {
                            setProductSearch('');
                            setSelectedCategory(null);
                            setOnlyAvailable(false);
                          }}
                          className="px-4 py-2 bg-[#5A5A40] hover:bg-[#4E4E37] text-white text-xs font-bold rounded-xl transition-all"
                        >
                          Azzera Filtri
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 [content-visibility:auto] [contain-intrinsic-size:auto_450px]">
                        {agentFilteredProducts.map(p => {
                          const stockNum = Number(p.stock);
                          const minStockNum = Number(p.min_stock ?? 5);
                          const isOutOfStock = stockNum <= 0;
                          const isLowStock = stockNum > 0 && stockNum <= minStockNum;
                          const qtyInCart = getItemQtyInCart(p.code);
                          const isInCart = qtyInCart > 0;
                          
                          const imageUrl = p.image_file_name ? `/uploads/${encodeURIComponent(p.image_file_name.trim())}` : null;

                          return (
                            <div
                              key={p.id}
                              className={cn(
                                "flex flex-col bg-white rounded-2xl transition-all relative overflow-hidden group shadow-xs border h-full justify-between",
                                isInCart 
                                  ? "border-emerald-500 bg-emerald-50/10 shadow-emerald-100/50 shadow-md ring-1 ring-emerald-500/30" 
                                  : "border-[#E5E7EB] hover:border-[#5A5A40]/40 hover:bg-[#FDFDFB] hover:shadow-md"
                              )}
                            >
                              {/* Top Edge-to-Edge Image Container (Vertical Stack) */}
                              <div className="relative w-full h-52 sm:h-56 bg-[#F8F9FA] border-b border-gray-100 flex items-center justify-center overflow-hidden group/img cursor-pointer shrink-0">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={p.description}
                                    loading="lazy"
                                    decoding="async"
                                    onClick={() => handleOpenProductDetail(p)}
                                    className="w-full h-full object-contain p-3 transition-transform duration-300 group-hover/img:scale-105"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.style.display = 'none';
                                      const placeholderEl = e.currentTarget.nextSibling as HTMLDivElement;
                                      if (placeholderEl) {
                                        placeholderEl.style.display = 'flex';
                                      }
                                    }}
                                  />
                                ) : null}
                                <div
                                  className="absolute inset-0 flex flex-col items-center justify-center bg-[#F3F4F6] text-gray-400 gap-1.5"
                                  style={{ display: imageUrl ? 'none' : 'flex' }}
                                  onClick={() => handleOpenProductDetail(p)}
                                >
                                  <ImageIcon size={36} className="stroke-1 text-[#C4C4A0]" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nessuna Immagine</span>
                                </div>

                                {/* Zoom Button Overlay */}
                                {imageUrl && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLightboxImage({ url: imageUrl, title: p.description });
                                    }}
                                    className="absolute top-2.5 right-2.5 p-1.5 bg-black/65 hover:bg-black/85 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-all backdrop-blur-xs text-[10px] font-bold flex items-center gap-1 shadow-xs z-20 cursor-pointer"
                                    title="Ingrandisci foto prodotto"
                                  >
                                    <ZoomIn size={13} />
                                    <span>Ingrandisci</span>
                                  </button>
                                )}

                                {/* In-Cart Badge Top Left Overlay */}
                                {isInCart && (
                                  <div className="absolute top-2.5 left-2.5 z-20 bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1.5 backdrop-blur-xs">
                                    <CheckCircle2 size={12} className="text-emerald-200" />
                                    <span>In Ordine: {qtyInCart} {p.um || 'pz'}</span>
                                  </div>
                                )}

                                {/* Stock Availability Badge Bottom Left Overlay */}
                                <div className="absolute bottom-2.5 left-2.5 z-20">
                                  <span className={cn(
                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border backdrop-blur-md shadow-2xs",
                                    isOutOfStock
                                      ? "bg-amber-50/95 text-amber-800 border-amber-200/80"
                                      : isLowStock
                                      ? "bg-amber-50/95 text-amber-700 border-amber-200/60"
                                      : "bg-emerald-50/95 text-emerald-800 border-emerald-200/60"
                                  )}>
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      isOutOfStock ? "bg-amber-500" : isLowStock ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                                    )} />
                                    {isOutOfStock ? "Pre-ordine" : isLowStock ? "Scarse" : "Disponibile"}
                                  </span>
                                </div>
                              </div>

                              {/* Card Body & Details */}
                              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                <div className="space-y-2">
                                  {/* Code & Category Row */}
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100 truncate max-w-[130px]">
                                      {p.code}
                                    </span>
                                    {p.category && (
                                      <span className="text-[9px] font-black uppercase text-[#5A5A40] tracking-wider truncate max-w-[130px]">
                                        {p.category}
                                      </span>
                                    )}
                                  </div>

                                  {/* Title (Description) */}
                                  <h4 
                                    onClick={() => handleOpenProductDetail(p)}
                                    className="text-sm font-bold text-[#111827] hover:text-[#5A5A40] transition-colors leading-snug line-clamp-2 cursor-pointer"
                                    title={p.description}
                                  >
                                    {p.description}
                                  </h4>

                                  {/* Button to consult product notes & detailed sheet */}
                                  {(p.notes || p.description_html) && (
                                    <div className="pt-0.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenProductDetail(p);
                                        }}
                                        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#5A5A40] bg-[#5A5A40]/10 hover:bg-[#5A5A40]/20 px-2.5 py-1 rounded-lg border border-[#5A5A40]/20 transition-all cursor-pointer w-full justify-center group/sheet"
                                        title="Consulta note e descrizione estesa nella scheda prodotto"
                                      >
                                        <FileText size={12} className="text-[#5A5A40]" />
                                        <span>Scheda Dettagliata & Note</span>
                                      </button>
                                    </div>
                                  )}

                                  {/* High Visual Highlight for External Link (Google Drive / Promo) */}
                                  {p.link && p.link.trim() !== '' && (
                                    <div className="pt-0.5">
                                      <a
                                        href={p.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center justify-center gap-1.5 text-xs font-black text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200/80 transition-all w-full shadow-2xs group/link"
                                        title="Apri specifiche tecniche o promozioni esterne su Google Drive"
                                      >
                                        <ExternalLink size={13} className="text-blue-600 transition-transform group-hover/link:scale-110" />
                                        <span>Specifiche / Promo (Drive)</span>
                                      </a>
                                    </div>
                                  )}
                                </div>

                                {/* Price & Stock Row */}
                                <div className="pt-3 border-t border-gray-100 space-y-3">
                                  <div className="flex items-end justify-between">
                                    <div>
                                      <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Prezzo Netto</div>
                                      <div className="text-base font-serif font-black text-[#5A5A40]">
                                        € {Number(p.price).toFixed(2)}
                                      </div>
                                    </div>

                                    <div className="text-right">
                                      <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Giacenza</div>
                                      <div className={cn(
                                        "text-xs font-mono font-black",
                                        isOutOfStock ? "text-amber-600" : "text-gray-900"
                                      )}>
                                        {p.stock} <span className="text-[9px] font-semibold uppercase">{p.um || 'pz'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Bottom Direct Order Controls */}
                                  {isInCart ? (
                                    <div className="flex items-center justify-between bg-emerald-600 text-white rounded-xl shadow-xs overflow-hidden border border-emerald-700 w-full">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateItemQty(p.code, qtyInCart - 1);
                                        }}
                                        className="px-3 py-2 hover:bg-emerald-700 active:bg-emerald-800 transition-colors font-black text-xs cursor-pointer flex-1 flex justify-center"
                                        title="Riduci quantità"
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <span className="px-3 text-xs font-black font-mono min-w-[36px] text-center bg-emerald-700/60 py-2">
                                        {qtyInCart} {p.um || 'pz'}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateItemQty(p.code, qtyInCart + 1);
                                        }}
                                        className="px-3 py-2 hover:bg-emerald-700 active:bg-emerald-800 transition-colors font-black text-xs cursor-pointer flex-1 flex justify-center"
                                        title="Aumenta quantità"
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddProductToOrder(p, 1);
                                      }}
                                      className={cn(
                                        "w-full py-2 px-3 rounded-xl transition-all active:scale-98 flex items-center justify-center gap-1.5 shadow-xs border font-black text-xs cursor-pointer",
                                        isOutOfStock
                                          ? "bg-amber-600 text-white hover:bg-amber-700 border-amber-600"
                                          : "bg-[#5A5A40] text-white hover:bg-[#4E4E37] border-transparent"
                                      )}
                                      title={isOutOfStock ? "Aggiungi come Pre-ordine" : "Aggiungi all'ordine"}
                                    >
                                      {isOutOfStock ? <Clock size={14} /> : <ShoppingCart size={14} />}
                                      <span>{isOutOfStock ? "Pre-ordina" : "+ Aggiungi al Carrello"}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AGENT TAB 3: CLIENTS (Read-only lista clienti) */}
            {activeTab === 'clients' && (
              <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-5">
                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#111827]">Anagrafica Clienti</h3>
                    <p className="text-xs text-[#6B7280]">Visualizza i recapiti e l'ubicazione dei clienti.</p>
                  </div>
                  
                  <div className="flex items-center gap-2.5 bg-[#F4F5F6] px-3.5 py-2 rounded-xl text-xs border border-[#E5E7EB] w-full sm:w-80 focus-within:ring-2 focus-within:ring-[#5A5A40]/10 transition-all">
                    <Search size={15} className="text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filtra clienti..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredClients.length === 0 ? (
                    <p className="col-span-full text-center py-12 text-xs text-gray-400 font-bold">Nessun cliente corrispondente ai criteri.</p>
                  ) : (
                    filteredClients.map(c => {
                      const { rawNotes, daneaData } = parseClientNotes(c.notes);
                      const hasDanea = Object.keys(daneaData).length > 0;
                      return (
                        <div key={c.id} className="p-5 bg-white border border-[#E5E7EB] rounded-2xl flex flex-col justify-between hover:shadow-xs hover:border-[#5A5A40]/30 transition-all">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[9px] bg-[#5A5A40]/10 text-[#5A5A40] font-black px-2 py-0.5 rounded-lg border border-[#5A5A40]/5">
                                COD: {c.code || String(c.id).padStart(4, '0')}
                              </span>
                              {hasDanea && (
                                <span className="text-[8px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                                  <Lock size={9} />
                                  Danea Sync
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-black text-[#111827]">{c.name}</h4>
                            <div className="space-y-1 text-xs text-gray-600">
                              {c.city && <p className="font-bold text-[#5A5A40]">{c.city}</p>}
                              <p><strong>Contatto:</strong> {c.contact || 'N/D'}</p>
                              <p><strong>Tel:</strong> {c.phone || 'N/D'}</p>
                              <p className="text-blue-600 truncate"><strong>Email:</strong> {c.email || 'N/D'}</p>
                            </div>
                          </div>
                          {rawNotes && (
                            <div className="mt-3 pt-2 border-t border-gray-50 text-[10px] text-gray-400 italic truncate" title={rawNotes}>
                              "{rawNotes}"
                            </div>
                          )}
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => {
                                setSelectedDetailClient(c);
                                setIsClientDetailOpen(true);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-[#5A5A40]/10 text-gray-700 hover:text-[#5A5A40] border border-gray-200 hover:border-[#5A5A40]/20 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                            >
                              <BarChart3 size={13} />
                              Vedi Analisi & Scheda
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* AGENT TAB 4: STATISTICHE & ANALISI AVANZATA PORTAFOGLIO */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                {/* HEADER & FILTERS BAR */}
                <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center">
                        <BarChart3 size={18} />
                      </div>
                      <h3 className="text-xl font-serif font-black text-[#111827]">Statistiche & Analisi Portafoglio Agente</h3>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      Analisi completa su fatturato, scadenze di pagamento, prodotti top seller, portafoglio clienti e dati geografici.
                    </p>
                  </div>

                  {/* CONTROLS & FILTERS */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Time Range Filter */}
                    <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 rounded-xl">
                      <Calendar size={14} className="text-[#5A5A40]" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Periodo:</span>
                      <select
                        value={statsTimeRange || 'all'}
                        onChange={(e) => setStatsTimeRange(e.target.value as any)}
                        className="bg-transparent text-xs font-bold text-[#111827] outline-none cursor-pointer"
                      >
                        <option value="all">Tutti i Tempi</option>
                        <option value="month">Mese in Corso</option>
                        <option value="30days">Ultimi 30 Giorni</option>
                        <option value="year">Anno Corrente</option>
                      </select>
                    </div>

                    {/* Order Status Filter */}
                    <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 rounded-xl">
                      <Filter size={14} className="text-[#5A5A40]" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Stato:</span>
                      <select
                        value={statsStatusFilter || 'all'}
                        onChange={(e) => setStatsStatusFilter(e.target.value as any)}
                        className="bg-transparent text-xs font-bold text-[#111827] outline-none cursor-pointer"
                      >
                        <option value="all">Tutti (Confermati + Bozze)</option>
                        <option value="confirm">Solo Confermati/Inviati</option>
                        <option value="draft">Solo Bozze</option>
                      </select>
                    </div>

                    {/* Agent Filter */}
                    {isUserAdmin ? (
                      <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 rounded-xl">
                        <Users size={14} className="text-[#5A5A40]" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Agente:</span>
                        <select
                          value={statsAgentFilter || 'all'}
                          onChange={(e) => setStatsAgentFilter(e.target.value)}
                          className="bg-transparent text-xs font-bold text-[#111827] outline-none cursor-pointer"
                        >
                          <option value="all">Tutti gli Agenti</option>
                          {Array.from(new Set(orders.map(o => o.agent_name).filter(Boolean))).map(agent => (
                            <option key={agent} value={agent}>{agent}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-[#5A5A40]/10 border border-[#5A5A40]/20 px-3 py-2 rounded-xl text-[#5A5A40]">
                        <Users size={14} />
                        <span className="text-[10px] font-bold uppercase text-[#5A5A40]">Agente:</span>
                        <span className="text-xs font-black">{user?.name || 'Mio Portafoglio'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* KPI METRIC CARDS (6 CARDS) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  {/* KPI 1: Fatturato Totale */}
                  <div className="p-5 rounded-2xl border bg-white border-[#E5E7EB] shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Fatturato Totale</span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <TrendingUp size={14} />
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-[#111827]">
                      € {stats.totalSales.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h4>
                    <p className="text-[10px] text-gray-500 font-semibold truncate">
                      Da {stats.filteredOrders.length} ordini selezionati
                    </p>
                  </div>

                  {/* KPI 2: Volume Ordini & Bozze */}
                  <div className="p-5 rounded-2xl border bg-white border-[#E5E7EB] shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Ordini & Bozze</span>
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <ShoppingCart size={14} />
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-[#111827]">
                      {stats.ordersCount} <span className="text-xs font-normal text-gray-500">inv.</span> / {stats.draftsCount} <span className="text-xs font-normal text-gray-500">bozze</span>
                    </h4>
                    <p className="text-[10px] text-emerald-600 font-bold">
                      {stats.ordersCount + stats.draftsCount > 0 ? Math.round((stats.ordersCount / (stats.ordersCount + stats.draftsCount)) * 100) : 0}% tasso di conferma
                    </p>
                  </div>

                  {/* KPI 3: Ticket Medio AOV */}
                  <div className="p-5 rounded-2xl border bg-white border-[#E5E7EB] shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Valore Medio (AOV)</span>
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <DollarSign size={14} />
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-[#111827]">
                      € {stats.aov.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h4>
                    <p className="text-[10px] text-gray-500 font-semibold">
                      Media per singolo contratto
                    </p>
                  </div>

                  {/* KPI 4: Quantita Pezzi Venduti */}
                  <div className="p-5 rounded-2xl border bg-white border-[#E5E7EB] shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Pezzi Venduti</span>
                      <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                        <Package size={14} />
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-[#111827]">
                      {stats.totalQuantitySold.toLocaleString('it-IT')} <span className="text-xs font-normal text-gray-500">pz</span>
                    </h4>
                    <p className="text-[10px] text-gray-500 font-semibold">
                      Volume articoli movimentati
                    </p>
                  </div>

                  {/* KPI 5: Clienti Attivi */}
                  <div className="p-5 rounded-2xl border bg-white border-[#E5E7EB] shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Clienti Attivi</span>
                      <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Users size={14} />
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-[#111827]">
                      {stats.activeClientsCount} <span className="text-xs font-normal text-gray-500">clienti</span>
                    </h4>
                    <p className="text-[10px] text-gray-500 font-semibold">
                      Media/cliente: € {stats.avgRevenuePerClient.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                    </p>
                  </div>

                  {/* KPI 6: Scorte Magazzino */}
                  <div className="p-5 rounded-2xl border bg-white border-[#E5E7EB] shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Stato Giacenze</span>
                      <div className="w-7 h-7 rounded-lg bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center">
                        <Activity size={14} />
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-[#111827]">
                      {stats.totalProductsCount} <span className="text-xs font-normal text-gray-500">art.</span>
                    </h4>
                    <p className="text-[10px] font-bold">
                      {stats.outOfStockCount > 0 ? (
                        <span className="text-rose-600">{stats.outOfStockCount} esauriti!</span>
                      ) : stats.lowStockCount > 0 ? (
                        <span className="text-amber-600">{stats.lowStockCount} in scorta min.</span>
                      ) : (
                        <span className="text-emerald-600">Stock regolare</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* PIANIFICAZIONE SCADENZE E RATE DI PAGAMENTO */}
                <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center">
                          <Clock size={18} />
                        </div>
                        <h4 className="text-lg font-serif font-black text-[#111827]">Pianificazione Scadenze & Rate di Pagamento</h4>
                      </div>
                      <p className="text-xs text-[#6B7280]">
                        Calendario scadenziario generato automaticamente dalle condizioni di pagamento degli ordini (RB, Bonifici, Acconti, ecc.).
                      </p>
                    </div>

                    {/* TEMPORAL FILTER TOGGLE */}
                    <label className="flex items-center gap-2.5 cursor-pointer bg-[#F9FAFB] hover:bg-gray-100 px-4 py-2.5 rounded-xl border border-[#E5E7EB] transition-all text-xs font-bold text-[#111827] shadow-2xs select-none">
                      <input
                        type="checkbox"
                        checked={hidePastDeadlines}
                        onChange={(e) => setHidePastDeadlines(e.target.checked)}
                        className="w-4 h-4 rounded text-[#5A5A40] focus:ring-[#5A5A40] border-gray-300 accent-[#5A5A40]"
                      />
                      <Filter size={14} className="text-[#5A5A40]" />
                      <span>Nascondi scadenze passate (antecedenti ad oggi)</span>
                    </label>
                  </div>

                  {/* DEADLINES STATS SUMMARY BADGES */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-800">Scadenze In Essere / Future</span>
                        <p className="text-base font-black text-emerald-950">
                          {allDeadlines.filter(d => !d.isOverdue).length} rate
                        </p>
                      </div>
                      <span className="text-sm font-mono font-black text-emerald-700">
                        € {allDeadlines.filter(d => !d.isOverdue).reduce((s, d) => s + d.amount, 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-800">Scadenze Antecedenti / Passate</span>
                        <p className="text-base font-black text-amber-950">
                          {allDeadlines.filter(d => d.isOverdue).length} rate {hidePastDeadlines ? '(Nascoste)' : '(Visibili)'}
                        </p>
                      </div>
                      <span className="text-sm font-mono font-black text-amber-700">
                        € {allDeadlines.filter(d => d.isOverdue).reduce((s, d) => s + d.amount, 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-600">Totale Rate Visualizzate</span>
                        <p className="text-base font-black text-gray-900">
                          {visibleDeadlines.length} rate
                        </p>
                      </div>
                      <span className="text-sm font-mono font-black text-[#5A5A40]">
                        € {visibleDeadlines.reduce((s, d) => s + d.amount, 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* DEADLINES TABLE */}
                  {visibleDeadlines.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                      <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-xs font-bold text-gray-500">Nessuna scadenza trovata per il filtro selezionato.</p>
                      {hidePastDeadlines && (
                        <button
                          onClick={() => setHidePastDeadlines(false)}
                          className="mt-3 text-xs text-[#5A5A40] underline font-bold"
                        >
                          Mostra anche le scadenze passate
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/80 text-[10px] uppercase font-black tracking-wider text-gray-500 border-b border-gray-100">
                            <th className="p-3.5">Ordine #</th>
                            <th className="p-3.5">Cliente</th>
                            <th className="p-3.5">Rata / Modalità</th>
                            <th className="p-3.5">Data Scadenza</th>
                            <th className="p-3.5 text-right">Importo Rata</th>
                            <th className="p-3.5 text-center">Stato Scadenza</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {visibleDeadlines.map((d, idx) => (
                            <tr key={`${d.orderId}-${d.installmentIndex}-${idx}`} className={cn(
                              "hover:bg-gray-50/50 transition-colors",
                              d.isOverdue ? "bg-amber-50/20" : ""
                            )}>
                              <td className="p-3.5 font-mono font-bold text-gray-800">
                                Ord. #{d.orderNumber}
                              </td>
                              <td className="p-3.5 font-bold text-[#111827]">
                                {d.clientName}
                              </td>
                              <td className="p-3.5 text-gray-600">
                                <span className="font-bold text-[#5A5A40]">Rata {d.installmentIndex}/{d.totalInstallments}</span>
                                <span className="text-[10px] text-gray-400 block truncate max-w-[180px]">{d.paymentName}</span>
                              </td>
                              <td className="p-3.5 font-mono font-bold text-gray-700">
                                {d.date.split('-').reverse().join('/')}
                              </td>
                              <td className="p-3.5 text-right font-mono font-bold text-[#111827]">
                                € {d.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3.5 text-center">
                                {d.isOverdue ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    <Clock size={10} />
                                    Scaduta / Antecedente
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 size={10} />
                                    In Essere / Futura
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* GRAPH & ANALYTICS GRIDS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sales Trend Chart (Custom SVG) */}
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <h4 className="text-sm font-serif font-black text-[#111827] flex items-center gap-2">
                        <Activity size={16} className="text-[#5A5A40]" />
                        Andamento Cronologico Vendite
                      </h4>
                      <span className="text-[10px] bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-bold border border-gray-200">
                        {stats.orderTrend.length} Punti Data
                      </span>
                    </div>

                    {stats.orderTrend.length === 0 ? (
                      <div className="h-56 flex items-center justify-center text-xs text-gray-400 font-bold">
                        Nessun dato cronologico disponibile nei filtri selezionati.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-full h-56 relative pt-2">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                            <line x1="40" y1="20" x2="480" y2="20" stroke="#F3F4F6" strokeWidth="1" strokeDasharray="3" />
                            <line x1="40" y1="60" x2="480" y2="60" stroke="#F3F4F6" strokeWidth="1" strokeDasharray="3" />
                            <line x1="40" y1="100" x2="480" y2="100" stroke="#F3F4F6" strokeWidth="1" strokeDasharray="3" />
                            <line x1="40" y1="140" x2="480" y2="140" stroke="#F3F4F6" strokeWidth="1" strokeDasharray="3" />
                            
                            {(() => {
                              const maxTotal = Math.max(...stats.orderTrend.map(t => t.total), 100);
                              const paddingLeft = 60;
                              const width = 400;
                              const height = 120;
                              const count = stats.orderTrend.length;
                              const step = count > 1 ? width / (count - 1) : width;

                              const points = stats.orderTrend.map((t, i) => {
                                const x = paddingLeft + i * step;
                                const y = 140 - (t.total / maxTotal) * height;
                                return { x, y, ...t };
                              });

                              const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                              const areaPath = points.length > 0 
                                ? `${linePath} L ${points[points.length - 1].x} 140 L ${points[0].x} 140 Z` 
                                : '';

                              return (
                                <>
                                  {areaPath && (
                                    <path 
                                      d={areaPath} 
                                      fill="url(#trendGradFull)" 
                                      opacity="0.35" 
                                    />
                                  )}
                                  {linePath && (
                                    <path 
                                      d={linePath} 
                                      fill="none" 
                                      stroke="#5A5A40" 
                                      strokeWidth="2.5" 
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  )}

                                  <defs>
                                    <linearGradient id="trendGradFull" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#5A5A40" />
                                      <stop offset="100%" stopColor="#5A5A40" stopOpacity="0" />
                                    </linearGradient>
                                  </defs>

                                  {points.map((p, i) => (
                                    <g key={i} className="group cursor-pointer">
                                      <circle 
                                        cx={p.x} 
                                        cy={p.y} 
                                        r="5" 
                                        fill="#5A5A40" 
                                        stroke="#FFF" 
                                        strokeWidth="2" 
                                        className="transition-all hover:scale-150"
                                      />
                                      <text 
                                        x={p.x} 
                                        y={p.y - 12} 
                                        textAnchor="middle" 
                                        className="text-[10px] font-mono font-bold fill-gray-800"
                                      >
                                        €{Math.round(p.total)}
                                      </text>
                                      <text 
                                        x={p.x} 
                                        y="160" 
                                        textAnchor="middle" 
                                        className="text-[9px] font-mono font-bold fill-gray-500"
                                      >
                                        {p.date.split('-').slice(1).reverse().join('/')}
                                      </text>
                                      <text 
                                        x={p.x} 
                                        y="172" 
                                        textAnchor="middle" 
                                        className="text-[8px] font-bold fill-indigo-600"
                                      >
                                        ({p.count} ord)
                                      </text>
                                    </g>
                                  ))}
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PRODOTTI TOP SELLER */}
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <h4 className="text-sm font-serif font-black text-[#111827] flex items-center gap-2">
                        <Package size={16} className="text-emerald-600" />
                        Classifica Prodotti Più Venduti
                      </h4>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Top {stats.topProducts.length} Articoli</span>
                    </div>

                    {stats.topProducts.length === 0 ? (
                      <p className="text-xs text-gray-400 py-12 text-center font-bold">Nessun articolo venduto nel periodo.</p>
                    ) : (
                      <div className="space-y-3.5">
                        {stats.topProducts.map((p, idx) => {
                          const maxQty = Math.max(...stats.topProducts.map(tp => tp.qty), 1);
                          const pct = (p.qty / maxQty) * 100;
                          return (
                            <div key={p.code} className="p-3 bg-gray-50/60 rounded-xl border border-gray-100 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="text-[#111827] truncate">{p.description}</span>
                                  <span className="text-[9px] font-mono text-gray-400">({p.code})</span>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-emerald-700 font-mono font-black">{p.qty} pz</span>
                                  <span className="text-[10px] text-gray-500 block font-mono">€ {Math.round(p.revenue)}</span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ADDITIONAL BREAKDOWNS (CLIENTI TOP, CATEGORIE, PAGAMENTI, CITTÀ) */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {/* TOP CLIENTS */}
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-5 shadow-xs space-y-4">
                    <h5 className="text-xs font-serif font-black text-[#111827] uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                      <Users size={14} className="text-[#5A5A40]" />
                      Clienti Top per Fatturato
                    </h5>
                    {stats.topSpentClients.length === 0 ? (
                      <p className="text-[11px] text-gray-400 py-6 text-center font-bold">Nessun acquirente.</p>
                    ) : (
                      <div className="space-y-3">
                        {stats.topSpentClients.map((c, idx) => (
                          <div key={c.id} className="flex items-center justify-between text-xs font-bold border-b border-gray-50 pb-2 last:border-none">
                            <div className="min-w-0">
                              <span className="text-gray-900 truncate block">{idx + 1}. {c.name}</span>
                              <span className="text-[9px] text-gray-400 block">{c.city || 'Città non spec.'} ({c.orderCount} ordini)</span>
                            </div>
                            <span className="text-[#5A5A40] font-mono font-black shrink-0">
                              € {Math.round(c.spent).toLocaleString('it-IT')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CATEGORIES BREAKDOWN */}
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-5 shadow-xs space-y-4">
                    <h5 className="text-xs font-serif font-black text-[#111827] uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                      <Layers size={14} className="text-indigo-600" />
                      Ripartizione Categorie
                    </h5>
                    {stats.categoryBreakdown.length === 0 ? (
                      <p className="text-[11px] text-gray-400 py-6 text-center font-bold">Nessuna categoria registrata.</p>
                    ) : (
                      <div className="space-y-3">
                        {stats.categoryBreakdown.map((cat) => (
                          <div key={cat.category} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-gray-800 truncate">{cat.category}</span>
                              <span className="text-indigo-700 font-mono text-[11px]">€ {Math.round(cat.revenue)}</span>
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                              <span>{cat.qty} pz venduti</span>
                              <span>{cat.percentage}% del totale</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${cat.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PAYMENT METHODS */}
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-5 shadow-xs space-y-4">
                    <h5 className="text-xs font-serif font-black text-[#111827] uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                      <CreditCard size={14} className="text-amber-600" />
                      Modalità di Pagamento
                    </h5>
                    {stats.paymentBreakdown.length === 0 ? (
                      <p className="text-[11px] text-gray-400 py-6 text-center font-bold">Nessun metodo registrato.</p>
                    ) : (
                      <div className="space-y-3">
                        {stats.paymentBreakdown.map((pm) => (
                          <div key={pm.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-gray-800 truncate">{pm.name}</span>
                              <span className="text-amber-700 font-mono text-[11px]">€ {Math.round(pm.volume)}</span>
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                              <span>{pm.count} transazioni</span>
                              <span>{pm.percentage}% quota</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pm.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* GEOGRAPHIC DISTRIBUTION */}
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-5 shadow-xs space-y-4">
                    <h5 className="text-xs font-serif font-black text-[#111827] uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2.5">
                      <MapPin size={14} className="text-rose-600" />
                      Distribuzione Geografica
                    </h5>
                    {stats.cityBreakdown.length === 0 ? (
                      <p className="text-[11px] text-gray-400 py-6 text-center font-bold">Nessun dato geografico.</p>
                    ) : (
                      <div className="space-y-3">
                        {stats.cityBreakdown.map((ct) => (
                          <div key={ct.city} className="flex items-center justify-between text-xs font-bold border-b border-gray-50 pb-2 last:border-none">
                            <div>
                              <span className="text-gray-800 block">{ct.city}</span>
                              <span className="text-[9px] text-gray-400 font-mono">{ct.count} ordini stipulati</span>
                            </div>
                            <span className="text-rose-700 font-mono font-black">
                              € {Math.round(ct.revenue).toLocaleString('it-IT')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AGENT TAB 5: GIROVISITE & AFFIANCAMENTI */}
            {activeTab === 'girovisite' && (
              <GirovisiteSection 
                currentUser={user} 
                onSelectClient={(id) => {
                  const cl = clients.find(c => c.id === id || String(c.id) === String(id));
                  if (cl) {
                    setSelectedDetailClient(cl);
                    setIsClientDetailOpen(true);
                  }
                }} 
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ECOSYSTEM INTERFACE 2: ADMIN CONSOLE (Avanzata, XML Potente, Config)        */}
      {/* ========================================================================= */}
      {isAdminMode && (
        <div className="space-y-6">
          {/* Global hidden inputs for file uploads to prevent ref-null errors when tabs switch */}
          <input
            type="file"
            ref={productFileInputRef}
            onChange={(e) => handleImportFile(e, 'products')}
            accept=".xml"
            className="hidden"
          />
          <input
            type="file"
            ref={clientFileInputRef}
            onChange={(e) => handleImportFile(e, 'clients')}
            accept=".xml,.xlsx,.xls"
            className="hidden"
          />
          {/* Navigation Tabs for Admin */}
          <div className="flex border-b border-[#E5E7EB] gap-2 overflow-x-auto font-sans">
            <button
              onClick={() => setAdminTab('connections')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                adminTab === 'connections' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <Sliders size={16} />
              1. Collegamenti API
            </button>
            <button
              onClick={() => setAdminTab('commercial-logic')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                adminTab === 'commercial-logic' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <Sliders size={16} />
              2. Logiche Commerciali Ordini
            </button>
            <button
              onClick={() => setAdminTab('xml-files')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                adminTab === 'xml-files' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <Upload size={16} />
              3. Import / Export File XML
            </button>
            <button
              onClick={() => setAdminTab('manage-products')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                adminTab === 'manage-products' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <Package size={16} />
              4. Controllo Catalogo & CRUD ({products.length})
            </button>
            <button
              onClick={() => setAdminTab('orders-log')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                adminTab === 'orders-log' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <ShoppingCart size={16} />
              5. Manutenzione Ordini ({orders.length})
            </button>
            <button
              onClick={() => setAdminTab('payment-methods')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                adminTab === 'payment-methods' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <DollarSign size={16} />
              6. Metodi di Pagamento ({paymentMethods.length})
            </button>
            <button
              onClick={() => setAdminTab('company-header')}
              className={cn(
                "px-6 py-3.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5 whitespace-nowrap",
                adminTab === 'company-header' 
                  ? "border-[#5A5A40] text-[#5A5A40]" 
                  : "border-transparent text-[#6B7280] hover:text-[#5A5A40]"
              )}
            >
              <Building size={16} />
              7. Intestazione & Logo PDF
            </button>
          </div>

          {adminTab === 'connections' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans mt-6">
                {/* LEFT COLUMN: Parametri di Collegamento */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 md:p-8 shadow-xs space-y-6">
                    <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                      <div className="w-10 h-10 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl flex items-center justify-center">
                        <Sliders size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-serif font-black text-[#111827]">Parametri di Collegamento</h3>
                        <p className="text-xs text-[#6B7280]">Configura il tuo software desktop Danea Easyfatt con questi parametri.</p>
                      </div>
                    </div>

                    {/* 1. URL Endpoint */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-[#6B7280] font-black uppercase tracking-wider flex items-center gap-1">
                        <span>Indirizzo URL di Ricezione (nel modulo e-commerce di Easyfatt)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={`${window.location.origin}/api/easyfatt/download-orders`}
                          className="bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3 rounded-xl font-mono text-[10px] text-[#111827] w-full focus:outline-none focus:ring-1 focus:ring-[#5A5A40]/30"
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/easyfatt/download-orders`);
                            showStatus("URL di sincronizzazione copiata!", "success");
                          }}
                          className="px-4 py-3 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl transition-all text-xs font-bold whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          Copia
                        </button>
                      </div>
                    </div>

                    {/* 2. Credentials Form */}
                    <form onSubmit={handleSaveSettings} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <span className="text-[10px] text-[#6B7280] font-black uppercase tracking-wider block">Nome Utente / Login</span>
                          <input 
                            type="text" 
                            value={easyfattUsername}
                            onChange={(e) => setEasyfattUsername(e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] px-4 py-2.5 rounded-xl font-mono text-xs text-[#111827] focus:ring-2 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] outline-none transition-all"
                            placeholder="Esempio: admin@connect.com"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] text-[#6B7280] font-black uppercase tracking-wider block">Password di Connessione</span>
                          <input 
                            type="text" 
                            value={easyfattPassword}
                            onChange={(e) => setEasyfattPassword(e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] px-4 py-2.5 rounded-xl font-mono text-xs text-[#111827] focus:ring-2 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] outline-none transition-all"
                            placeholder="Esempio: password123"
                            required
                          />
                        </div>
                      </div>

                      {/* Prices Include Vat Toggle */}
                      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 flex items-start gap-3">
                        <input 
                          type="checkbox"
                          id="pricesIncludeVat"
                          checked={pricesIncludeVat}
                          onChange={(e) => setPricesIncludeVat(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#5A5A40] focus:ring-[#5A5A40]"
                        />
                        <div className="space-y-0.5">
                          <label htmlFor="pricesIncludeVat" className="text-xs text-[#111827] font-bold select-none cursor-pointer">
                            I prezzi del portale includono l'IVA
                          </label>
                          <span className="block text-[10px] text-[#6B7280] leading-relaxed">
                            Se attivo, i prezzi esportati su Easyfatt saranno lordi (già ivati), altrimenti verranno esportati come valori imponibili netti.
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="flex items-center gap-2 px-5 py-3 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
                        >
                          <Save size={14} />
                          Salva Credenziali
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Modern Compact Environmental Info instead of giant wall of text */}
                  <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 flex gap-4 text-xs text-amber-800">
                    <Info className="shrink-0 mt-0.5 text-amber-600" size={18} />
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-amber-900 text-xs">Nota per la Sincronizzazione Locale</h4>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        Gli ambienti di sviluppo protetti (come AI Studio) bloccano le connessioni esterne automatiche di terze parti a causa di policy sui cookie di sessione (generando errori come <strong>405 Method Not Allowed</strong> o <strong>302 Redirect</strong>).
                      </p>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        <strong>Nessun problema:</strong> una volta pubblicato sul tuo server di produzione finale, l'automatismo funzionerà perfettamente! Ora puoi testare lo scambio dati usando gli <strong>Strumenti di Diagnostica e Simulazione</strong> a destra.
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Diagnostica e Strumenti */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Test & Simulation Card */}
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-6">
                    <div>
                      <h4 className="font-serif font-black text-sm text-[#111827]">Strumenti di Simulazione & Test</h4>
                      <p className="text-[11px] text-[#6B7280] mt-1">Usa queste utility per emulare le chiamate del software Easyfatt direttamente dal browser.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button 
                        onClick={handleTestDownloadOrders}
                        className="flex items-center justify-center gap-2 p-3 bg-[#F9FAFB] hover:bg-gray-100 border border-[#E5E7EB] text-[#111827] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer text-center"
                        title="Scarica il file XML reale degli ordini pronti per Danea"
                      >
                        <FileCode size={14} className="text-[#5A5A40]" />
                        <span>Anteprima XML Ordini</span>
                      </button>

                      <button
                        onClick={() => handleTestConnection('orders')}
                        disabled={testStatus === 'testing'}
                        className="flex items-center justify-center gap-2 p-3 bg-[#5A5A40]/5 hover:bg-[#5A5A40]/10 text-[#5A5A40] border border-[#5A5A40]/10 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer text-center"
                      >
                        <RefreshCw size={14} className={cn("text-[#5A5A40]", testStatus === 'testing' && "animate-spin")} />
                        <span>{testStatus === 'testing' ? 'Verifica...' : 'Testa API'}</span>
                      </button>
                    </div>

                    {testStatus !== 'idle' && (
                      <div className={`p-4 rounded-2xl border text-[11px] space-y-2 leading-relaxed ${
                        testStatus === 'success' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                          : testStatus === 'testing'
                          ? 'bg-gray-50 border-gray-200 text-gray-700 animate-pulse'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}>
                        <div className="font-bold flex items-center gap-1.5">
                          {testStatus === 'success' && <CheckCircle2 size={14} className="text-emerald-600" />}
                          {testStatus === 'error' && <AlertCircle size={14} className="text-rose-600" />}
                          <span>{testResultMsg}</span>
                        </div>
                        {testResultDetails && (
                          <pre className="bg-black/5 p-2 rounded-lg text-[9px] font-mono overflow-x-auto max-h-24 whitespace-pre-wrap leading-tight text-gray-700">
                            {testResultDetails}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* DRAG-AND-DROP SIMULATOR QUICK IMPORT */}
                    <div className="pt-4 border-t border-gray-100">
                      <span className="text-[10px] text-[#6B7280] font-black uppercase tracking-wider block mb-2">Simulatore Catalogo Easyfatt</span>
                      <div 
                        onClick={() => productFileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 hover:border-[#5A5A40]/50 bg-[#F9FAFB] hover:bg-[#5A5A40]/5 rounded-2xl p-4 text-center cursor-pointer transition-all space-y-2 group animate-none"
                      >
                        <Upload size={18} className="mx-auto text-gray-400 group-hover:text-[#5A5A40] transition-colors" />
                        <div>
                          <span className="block text-xs font-bold text-gray-700">Trascina o scegli file .xml</span>
                          <span className="block text-[10px] text-gray-400 mt-0.5">Carica l'export articoli di Easyfatt</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DIAGNOSTIC LOGS PANEL */}
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-serif font-black text-sm text-[#111827]">Log Diagnostico API</h4>
                        <p className="text-[10px] text-[#6B7280]">Chiamate in tempo reale degli endpoint.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={fetchEasyfattLogs}
                          className="p-1.5 text-[#6B7280] hover:text-[#5A5A40] bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                          title="Aggiorna log"
                        >
                          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
                        </button>
                        <button
                          onClick={handleClearEasyfattLogs}
                          className="text-[9px] font-bold text-red-600 hover:text-white hover:bg-red-600 transition-colors border border-red-200 px-2.5 py-1 rounded-lg cursor-pointer"
                        >
                          Svuota
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#1E1E1E] text-[#D4D4D4] border border-gray-800 rounded-2xl p-3.5 h-44 overflow-y-auto font-mono text-[9px] space-y-1.5 shadow-inner">
                      {easyfattLogs && easyfattLogs.length > 0 ? (
                        easyfattLogs.map((log, i) => {
                          let isErr = log.includes('ERROR') || log.includes('405') || log.includes('401') || log.includes('500');
                          let isPost = log.includes('POST');
                          let isGet = log.includes('GET');
                          return (
                            <div key={i} className={`py-1 border-b border-gray-800/40 last:border-0 leading-relaxed ${
                              isErr 
                                ? 'text-rose-400 font-bold bg-rose-950/25 px-2 rounded-md' 
                                : isPost 
                                ? 'text-indigo-300 bg-indigo-950/15 px-2 rounded-md' 
                                : isGet 
                                ? 'text-emerald-300 bg-emerald-950/15 px-2 rounded-md' 
                                : 'text-[#C5C5C5]'
                            }`}>
                              {log}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-gray-500 italic text-center py-14 text-[10px]">Nessuna richiesta registrata.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ADMIN TAB 2: LOGICHE COMMERCIALI ORDINAZIONI */}
            {adminTab === 'commercial-logic' && (
              <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-8 shadow-xs space-y-6">
                <div>
                  <h3 className="text-xl font-serif font-black text-[#111827]">Configurazione Logiche Commerciali Ordini</h3>
                  <p className="text-xs text-[#6B7280] mt-1">Imposta le regole e i preset commerciali di base per tutti i nuovi ordini raccolti dagli agenti sul territorio.</p>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">Metodo di Pagamento Predefinito</label>
                      <select 
                        value={defaultPayment || ''}
                        onChange={(e) => setDefaultPayment(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[#E5E7EB] px-4 py-3 rounded-xl font-bold text-xs text-[#111827] shadow-xs focus:ring-2 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] outline-none transition-all cursor-pointer"
                      >
                        {paymentMethods.length > 0 ? (
                          paymentMethods.map((pm) => (
                            <option key={pm.id} value={pm.name}>
                              {pm.name}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Bonifico bancario">Bonifico bancario</option>
                            <option value="R.B. 30/60 gg F.M.">R.B. 30/60 gg F.M.</option>
                            <option value="Contanti">Contanti</option>
                            <option value="Carta di Credito">Carta di Credito</option>
                            <option value="Contrassegno">Contrassegno</option>
                          </>
                        )}
                      </select>
                      <p className="text-[11px] text-gray-400">Metodo di pagamento autoselezionato all'apertura del modulo d'ordine.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">Aliquota IVA Predefinita per Articoli</label>
                      <select 
                        value={defaultVat || '22'}
                        onChange={(e) => setDefaultVat(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[#E5E7EB] px-4 py-3 rounded-xl font-bold text-xs text-[#111827] shadow-xs focus:ring-2 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] outline-none transition-all cursor-pointer"
                      >
                        <option value="22">22% - Aliquota Ordinaria</option>
                        <option value="10">10% - Aliquota Ridotta</option>
                        <option value="4">4% - Aliquota Minima</option>
                        <option value="0">0% - Esente</option>
                      </select>
                      <p className="text-[11px] text-gray-400">Codice IVA applicato automaticamente se non specificato sul singolo prodotto.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">Importo Minimo d'Ordine (€)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        value={minOrderTotal}
                        onChange={(e) => setMinOrderTotal(Number(e.target.value))}
                        className="w-full bg-[#F8F9FA] border border-[#E5E7EB] px-4 py-3 rounded-xl font-bold text-xs text-[#111827] shadow-xs focus:ring-2 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] outline-none transition-all"
                        placeholder="Es: 150.00"
                      />
                      <p className="text-[11px] text-gray-400">Sotto questa soglia l'agente non potrà inviare l'ordine definitivo, ma potrà salvarlo come bozza.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">Note e Clausole Predefinite</label>
                      <textarea 
                        rows={2}
                        value={defaultNotes}
                        onChange={(e) => setDefaultNotes(e.target.value)}
                        className="w-full bg-[#F8F9FA] border border-[#E5E7EB] px-4 py-2.5 rounded-xl text-xs text-[#111827] shadow-xs focus:ring-2 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] outline-none transition-all"
                        placeholder="Es: Merce da consegnare al mattino..."
                      />
                      <p className="text-[11px] text-gray-400">Testo precompilato inserito automaticamente nel campo note dell'ordine.</p>
                    </div>

                    <div className="space-y-2 md:col-span-2 bg-[#F8F9FA] p-4.5 rounded-2xl border border-gray-200 mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <ExternalLink size={15} className="text-[#5A5A40]" />
                        <label className="text-xs font-black uppercase tracking-wider text-[#111827]">
                          Filtro Visibilità 'Link Scheda Prodotto' (Anagrafica Easyfatt)
                        </label>
                      </div>
                      <select 
                        value={productLinkFilter}
                        onChange={(e) => setProductLinkFilter(e.target.value as 'all' | 'only_with_link' | 'hide_with_link')}
                        className="w-full bg-white border border-[#E5E7EB] px-4 py-3 rounded-xl font-bold text-xs text-[#111827] shadow-xs focus:ring-2 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] outline-none transition-all cursor-pointer"
                      >
                        <option value="all">Tutti i prodotti visibili (Senza restrizioni sui link)</option>
                        <option value="only_with_link">Mostra SOLO i prodotti che hanno il campo &quot;Link Scheda Prodotto&quot; compilato</option>
                        <option value="hide_with_link">NASCONDI a tutti gli utenti i prodotti che hanno il campo &quot;Link Scheda Prodotto&quot; compilato</option>
                      </select>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Controllo visibilità globale catalogo: mostra o nasconde a tutti gli utenti (agenti e clienti) gli articoli con il campo &lt;Link&gt; dell&apos;anagrafica Easyfatt compilato.
                      </p>
                    </div>

                    <div className="space-y-2 md:col-span-2 bg-[#F8F9FA] p-4.5 rounded-2xl border border-gray-200 mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Percent size={15} className="text-[#5A5A40]" />
                        <label className="text-xs font-black uppercase tracking-wider text-[#111827]">
                          Filtro Visibilità 'Classe Provvigione' (Provvigioni Agenti)
                        </label>
                      </div>
                      <select 
                        value={productCommissionFilter}
                        onChange={(e) => setProductCommissionFilter(e.target.value as 'all' | 'only_with_commission' | 'hide_with_commission')}
                        className="w-full bg-white border border-[#E5E7EB] px-4 py-3 rounded-xl font-bold text-xs text-[#111827] shadow-xs focus:ring-2 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40] outline-none transition-all cursor-pointer"
                      >
                        <option value="all">Tutti i prodotti visibili (Nessun vincolo su classe provvigionale)</option>
                        <option value="only_with_commission">Mostra SOLO i prodotti con &quot;Classe Provvigione&quot; assegnata</option>
                        <option value="hide_with_commission">NASCONDI i prodotti con &quot;Classe Provvigione&quot; (Mostra solo senza provvigione)</option>
                      </select>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Controllo visibilità per provvigioni: limita la visualizzazione nel catalogo e nella raccolta ordini in base alla presenza della classe provvigionale dell&apos;articolo.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md"
                    >
                      <Save size={14} />
                      Salva Logiche Commerciali
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ADMIN TAB 2: MANUAL XML FILES UPLOAD/DOWNLOAD */}
            {adminTab === 'xml-files' && (
              <div>
                {/* Hidden File Inputs */}
                <input
                  type="file"
                  ref={productFileInputRef}
                  accept=".xml"
                  onChange={(e) => handleImportFile(e, 'products')}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={productXlsxFileInputRef}
                  accept=".xlsx, .xls"
                  onChange={handleImportProductsXlsx}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={clientFileInputRef}
                  accept=".xml, .xlsx, .xls"
                  onChange={(e) => handleImportFile(e, 'clients')}
                  className="hidden"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 items-stretch">
                  {/* Product XML & XLSX Import/Export Card */}
                  <div className="bg-white rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-[#E5E7EB] p-4 sm:p-6 lg:p-8 shadow-xs flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                          <Package size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-150">
                          XML & XLSX (Excel)
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base sm:text-lg font-serif font-black text-[#111827]">Gestione Catalogo Prodotti XML / XLSX</h3>
                        <p className="text-xs text-[#6B7280] leading-relaxed mt-1">
                          Sincronizza e arricchisci i dati del catalogo prodotti. Puoi eseguire un allineamento completo tramite file XML di Easyfatt, oppure un arricchimento mirato caricando un file Excel (.xlsx).
                        </p>
                      </div>

                      <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10px] sm:text-xs text-indigo-900 leading-relaxed space-y-2">
                        <div>
                          <strong>Sincronizzazione XML Easyfatt:</strong> Abbina per <strong>Codice Articolo (Code)</strong>. Se già presente aggiorna giacenze e prezzi; se inesistente, crea il nuovo articolo.
                        </div>
                        <div className="border-t border-indigo-200/50 pt-2">
                          <strong>Arricchimento Dati Excel (.xlsx):</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1 text-[11px] text-indigo-950 font-medium">
                            <li>Matching riga per riga sul campo univoco <strong>Cod.</strong></li>
                            <li>Se <strong>Cod.</strong> trova corrispondenza: aggiorna/popola i campi della scheda prodotto nel CRM.</li>
                            <li>Se <strong>Cod.</strong> non trova corrispondenza: ignora la riga (non crea nuovi prodotti e non blocca l'importazione).</li>
                            <li><strong>Creazione Dinamica Campi:</strong> Se una colonna/campo del file XLSX non esiste nel CRM, viene creata automaticamente a sistema durante l'importazione.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => productFileInputRef.current?.click()}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                      >
                        <Upload size={16} />
                        Carica File XML Prodotti (Sincronizzazione Completa)
                      </button>
                      <button
                        onClick={() => productXlsxFileInputRef.current?.click()}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                      >
                        <FileSpreadsheet size={16} />
                        Carica File XLSX Prodotti (Aggiornamento / Arricchimento Catalogo)
                      </button>
                      <button
                        onClick={handleExportProducts}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-[#F9FAFB] text-[#111827] border border-[#E5E7EB] rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                      >
                        <Download size={16} />
                        Scarica Catalogo XML Easyfatt
                      </button>
                    </div>
                  </div>

                  {/* Clients XML/XLSX Import/Export Card */}
                  <div className="bg-white rounded-2xl sm:rounded-3xl lg:rounded-[2rem] border border-[#E5E7EB] p-4 sm:p-6 lg:p-8 shadow-xs flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                          <Users size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-150">
                          XML & XLSX Support
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base sm:text-lg font-serif font-black text-[#111827]">Gestione Anagrafiche Clienti XML / XLSX</h3>
                        <p className="text-xs text-[#6B7280] leading-relaxed mt-1">
                          Sincronizza l'elenco dei clienti del portale. Carica il file XML o l'elenco Excel (.xlsx) delle anagrafiche per sovrascrivere o inserire i dati di spedizione, fatturazione e contatto, o esporta i clienti creati dagli agenti per caricarli in Danea.
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 bg-amber-50/50 border border-amber-100 rounded-2xl text-[10px] sm:text-xs text-amber-900 leading-relaxed space-y-2">
                        <div>
                          <strong>Associazione Record:</strong> L'importatore esegue l'abbinamento incrociato verificando l'ID anagrafico (Cod.), la Ragione Sociale (Denominazione) e l'indirizzo E-mail.
                        </div>
                        <div className="border-t border-amber-200/50 pt-2">
                          <strong>Struttura Excel (XLSX) Supportata:</strong>
                          <div className="font-mono text-[9px] bg-white/80 p-2 rounded-lg mt-1 overflow-x-auto whitespace-pre border border-amber-200/40">
                            Cod. • Codice fiscale • Partita Iva • Denominazione • Indirizzo • Cap • Città • Prov. • Regione • Nazione • Cod. destinatario Fatt. elettr. • Rif. ammin. Fatt. elettr. • Referente • Tel. • Cell • Fax • e-mail • Pec • Sconti • Listino • Fido • Agente • Pagamento • Banca • Ns Banca • Data Mandato SDD • Emissione SDD • Resp. trasporto • Porto • Fatt. con Iva • Dich. d'intento • Data dich. d'intento • Conto reg. • Rit. acconto? • Doc via e-mail? • Avviso nuovi doc. • Note doc. • Home page • Login web • Extra 1-6 • Note
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => clientFileInputRef.current?.click()}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                      >
                        <Upload size={16} />
                        Carica File XML / XLSX Clienti
                      </button>
                      <button
                        onClick={handleExportClients}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-[#F9FAFB] text-[#111827] border border-[#E5E7EB] rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                      >
                        <Download size={16} />
                        Scarica Clienti XML Easyfatt
                      </button>
                      <button
                        onClick={handleExportClientsXlsx}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-[#F9FAFB] text-[#111827] border border-[#E5E7EB] rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                      >
                        <Download size={16} />
                        Scarica Clienti XLSX Easyfatt (Struttura Originale)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ADMIN TAB 3: PRODUCT DATABASE MANAGEMENT (Full CRUD: Modify/Delete/Add) */}
            {adminTab === 'manage-products' && (
              <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-serif font-black text-[#111827]">Anagrafica Articoli & Catalogo</h3>
                      <span className="bg-[#5A5A40]/10 text-[#5A5A40] border border-[#5A5A40]/20 text-[10px] font-black px-2.5 py-0.5 rounded-full font-mono">
                        {filteredProducts.length} / {products.length}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">Console di amministrazione dei prodotti. Modifica i parametri e i campi personalizzati di Easyfatt.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex items-center gap-2.5 bg-[#F4F5F6] px-3.5 py-1.5 rounded-xl text-xs border border-[#E5E7EB]">
                      <Search size={14} className="text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filtra catalogo..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs w-full sm:w-48"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setEditingProduct(null);
                        setProductForm({
                          code: '', description: '', price: '', vat_code: '22', um: 'pz', stock: '',
                          barcode: '', category: '', subcategory: '', producer_name: '', link: '', notes: '', image_file_name: '',
                          custom_field1: '', custom_field2: '', custom_field3: '', custom_field4: '',
                          online_promo: '', online_warranty: '', online_category_image: '', online_notes: '', online_customized: false
                        });
                        setIsProductModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      <Plus size={15} />
                      Nuovo Prodotto
                    </button>
                  </div>
                </div>

                {/* Global Link Filter Control Bar */}
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ExternalLink size={15} className="text-[#5A5A40]" />
                    <span className="text-xs font-bold text-[#111827]">
                      Filtro Visibilità Scheda Prodotto (&lt;Link&gt;):
                    </span>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider",
                      productLinkFilter === 'only_with_link' 
                        ? "bg-blue-100 text-blue-800 border border-blue-200" 
                        : productLinkFilter === 'hide_with_link'
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    )}>
                      {productLinkFilter === 'only_with_link' ? 'Solo con Link Scheda' : productLinkFilter === 'hide_with_link' ? 'Nascosti con Link Scheda' : 'Mostra Tutti'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 shadow-xs">
                    <button
                      onClick={() => handleUpdateLinkFilter('all')}
                      className={cn(
                        "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer",
                        productLinkFilter === 'all' 
                          ? "bg-[#5A5A40] text-white shadow-xs" 
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      Mostra Tutti ({products.length})
                    </button>
                    <button
                      onClick={() => handleUpdateLinkFilter('only_with_link')}
                      className={cn(
                        "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer",
                        productLinkFilter === 'only_with_link' 
                          ? "bg-blue-600 text-white shadow-xs" 
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      Solo con Link Scheda ({products.filter(p => p.link && p.link.trim() !== '').length})
                    </button>
                    <button
                      onClick={() => handleUpdateLinkFilter('hide_with_link')}
                      className={cn(
                        "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer",
                        productLinkFilter === 'hide_with_link' 
                          ? "bg-amber-600 text-white shadow-xs" 
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      Nascondi con Link Scheda ({products.filter(p => !p.link || p.link.trim() === '').length})
                    </button>
                  </div>
                </div>

                {/* Global Commission Class Filter Control Bar */}
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Percent size={15} className="text-[#5A5A40]" />
                    <span className="text-xs font-bold text-[#111827]">
                      Filtro Visibilità Classe Provvigione:
                    </span>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider",
                      productCommissionFilter === 'only_with_commission' 
                        ? "bg-purple-100 text-purple-800 border border-purple-200" 
                        : productCommissionFilter === 'hide_with_commission'
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    )}>
                      {productCommissionFilter === 'only_with_commission' 
                        ? 'Solo Popolati (Con Provvigione)' 
                        : productCommissionFilter === 'hide_with_commission' 
                        ? 'Solo Vuoti (Senza Provvigione)' 
                        : 'Mostra Tutti'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 shadow-xs">
                    <button
                      onClick={() => handleUpdateCommissionFilter('all')}
                      className={cn(
                        "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer",
                        productCommissionFilter === 'all' 
                          ? "bg-[#5A5A40] text-white shadow-xs" 
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      Mostra Tutti ({products.length})
                    </button>
                    <button
                      onClick={() => handleUpdateCommissionFilter('only_with_commission')}
                      className={cn(
                        "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer",
                        productCommissionFilter === 'only_with_commission' 
                          ? "bg-purple-600 text-white shadow-xs" 
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      Solo Popolati ({products.filter(hasProductCommissionClass).length})
                    </button>
                    <button
                      onClick={() => handleUpdateCommissionFilter('hide_with_commission')}
                      className={cn(
                        "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer",
                        productCommissionFilter === 'hide_with_commission' 
                          ? "bg-amber-600 text-white shadow-xs" 
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      Solo Vuoti ({products.filter(p => !hasProductCommissionClass(p)).length})
                    </button>
                  </div>
                </div>

                {/* Filter Counter Status Bar */}
                <div className="bg-[#F4F5F6] border border-[#E5E7EB] rounded-xl px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#111827]">
                      Articoli Visibili: <span className="font-mono text-[#5A5A40] font-black text-sm">{filteredProducts.length}</span> <span className="text-gray-400 font-medium">/ {products.length} totali in archivio</span>
                    </span>
                    {(productSearch || productLinkFilter !== 'all' || productCommissionFilter !== 'all') && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                        Filtri Attivi
                      </span>
                    )}
                  </div>
                  {(productSearch || productLinkFilter !== 'all' || productCommissionFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setProductSearch('');
                        handleUpdateLinkFilter('all');
                        handleUpdateCommissionFilter('all');
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer self-start sm:self-auto"
                    >
                      Resetta tutti i filtri
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto max-h-[480px] space-y-2.5 pr-1 [content-visibility:auto] [contain-intrinsic-size:auto_75px]">
                  {filteredProducts.length === 0 ? (
                    <p className="text-center py-12 text-xs text-gray-400 font-bold">Nessun prodotto trovato per i filtri correnti.</p>
                  ) : (
                    filteredProducts.map(p => (
                      <div key={p.id} className="p-4 bg-[#F8F9FA] hover:bg-gray-100 border border-[#E5E7EB] rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[9px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-lg border border-indigo-100">
                              {p.code}
                            </span>
                            <span className="text-[9px] bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded">
                              IVA: {p.vat_code}%
                            </span>
                            <span className="text-[9px] bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded uppercase">
                              {p.um}
                            </span>
                            {p.online_customized === 1 && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded">
                                E-commerce
                              </span>
                            )}
                            {p.link && p.link.trim() !== '' && (
                              <a
                                href={p.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[9px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200/80 transition-colors"
                                title={`Scheda Prodotto: ${p.link}`}
                              >
                                <ExternalLink size={10} /> Link Scheda
                              </a>
                            )}
                            {hasProductCommissionClass(p) && (
                              <span 
                                className="inline-flex items-center gap-1 text-[9px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200/80"
                                title={`Classe Provvigione: ${p.classe_provvigione || (p as any)['Classe provvigione'] || (p as any)['classe provvigione'] || (p as any)['commission_class'] || (p as any)['provvigione']}`}
                              >
                                <Percent size={10} /> Cl. Provv: {p.classe_provvigione || (p as any)['Classe provvigione'] || (p as any)['classe provvigione'] || (p as any)['commission_class'] || (p as any)['provvigione']}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-black text-[#111827]">{p.description}</h4>
                        </div>
                        
                        <div className="flex items-center gap-6 justify-between sm:justify-end">
                          <div className="text-left sm:text-right">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Listino</div>
                            <div className="text-sm font-serif font-black text-[#5A5A40]">€ {Number(p.price).toFixed(2)}</div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Magazzino</div>
                            <div className="text-sm font-mono font-black text-gray-800">{p.stock}</div>
                          </div>
                          <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
                            <button
                              onClick={() => openEditProduct(p)}
                              className="p-2 hover:bg-white text-gray-500 rounded-xl transition-all border border-transparent hover:border-gray-200"
                              title="Modifica scheda"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition-all border border-transparent hover:border-rose-100"
                              title="Elimina definitivo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ADMIN TAB 4: HISTORIC ORDERS & BULK STATE CORRECTION (Admin list) */}
            {adminTab === 'orders-log' && (
              <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-serif font-black text-[#111827]">Amministrazione & Trasmissione Ordini</h3>
                      {isAdminOrdersLoading && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <RefreshCw size={10} className="animate-spin" />
                          Caricamento...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7280]">Gestione ordini con paginazione server-side, ordinamento dinamico per colonna e correzione stati per Easyfatt.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 bg-purple-700 hover:bg-purple-800 text-white shadow-xs cursor-pointer">
                      <Upload size={14} />
                      {isImportingOrdersXml ? 'Importazione XML in corso...' : 'Importa Ordini Storici XML'}
                      <input
                        type="file"
                        accept=".xml"
                        onChange={handleImportOrdersXml}
                        disabled={isImportingOrdersXml}
                        className="hidden"
                      />
                    </label>

                    <button
                      onClick={handleExportSelectedOrders}
                      disabled={selectedOrderIds.length === 0}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs",
                        selectedOrderIds.length > 0
                          ? "bg-[#5A5A40] text-white hover:bg-[#4E4E37] cursor-pointer"
                          : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed"
                      )}
                    >
                      <Download size={14} />
                      Esporta Selezionati XML ({selectedOrderIds.length})
                    </button>
                    
                    {/* Bulk reset / state correction tool */}
                    <button
                      onClick={async () => {
                        if (selectedOrderIds.length === 0) return;
                        if (!confirm(`Vuoi segnare come "Nuovo" (pronto al download) gli ${selectedOrderIds.length} ordini selezionati?`)) return;
                        for (const id of selectedOrderIds) {
                          await fetch(`/api/easyfatt/orders/${id}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'Nuovo' })
                          });
                        }
                        showStatus("Stato ordini ripristinato a 'Nuovo'", "success");
                        setSelectedOrderIds([]);
                        fetchAdminOrders();
                        fetchOrders();
                      }}
                      disabled={selectedOrderIds.length === 0}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border cursor-pointer",
                        selectedOrderIds.length > 0
                          ? "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800"
                          : "bg-[#F3F4F6] text-[#9CA3AF] border-transparent cursor-not-allowed"
                      )}
                    >
                      Segna come Nuovo
                    </button>

                    <button
                      onClick={async () => {
                        if (selectedOrderIds.length === 0) return;
                        if (!confirm(`Vuoi segnare come "Esportato" gli ${selectedOrderIds.length} ordini selezionati?`)) return;
                        for (const id of selectedOrderIds) {
                          await fetch(`/api/easyfatt/orders/${id}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'Esportato' })
                          });
                        }
                        showStatus("Stato ordini modificato a 'Esportato'", "success");
                        setSelectedOrderIds([]);
                        fetchAdminOrders();
                        fetchOrders();
                      }}
                      disabled={selectedOrderIds.length === 0}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border cursor-pointer",
                        selectedOrderIds.length > 0
                          ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
                          : "bg-[#F3F4F6] text-[#9CA3AF] border-transparent cursor-not-allowed"
                      )}
                    >
                      Segna come Esportato
                    </button>
                  </div>
                </div>

                {/* Admin Filter & Search Toolbar */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#F9FAFB] p-3.5 rounded-2xl border border-gray-200">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filtra per cliente, numero ordine, agente o pagamento..."
                      value={adminOrdersPagination.filters.search}
                      onChange={(e) => adminOrdersPagination.setFilter('search', e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                    />
                    {adminOrdersPagination.filters.search && (
                      <button
                        onClick={() => adminOrdersPagination.setFilter('search', '')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
                        title="Cancella ricerca"
                      >
                        <XCircle size={14} />
                      </button>
                    )}
                  </div>

                  {/* Status Filter Pills */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shrink-0">
                    {[
                      { label: 'Tutti', value: 'all' },
                      { label: 'Confermati', value: 'Confermato' },
                      { label: 'Bozze', value: 'Bozza' },
                    ].map(pill => (
                      <button
                        key={pill.value}
                        onClick={() => adminOrdersPagination.setFilter('status', pill.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                          adminOrdersPagination.filters.status === pill.value
                            ? "bg-[#5A5A40] text-white shadow-xs"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        )}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>

                  {/* Reset Filters */}
                  {(adminOrdersPagination.filters.search || adminOrdersPagination.filters.status !== 'all') && (
                    <button
                      onClick={() => adminOrdersPagination.resetFilters()}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-bold border border-rose-200 transition-colors shrink-0 cursor-pointer"
                    >
                      <X size={13} />
                      Azzera filtri
                    </button>
                  )}
                </div>

                {/* Grid listing orders */}
                <div className="space-y-4">
                    <div className="overflow-x-auto relative">
                      {isAdminOrdersLoading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
                          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md border border-gray-100 text-xs font-bold text-gray-700">
                            <RefreshCw size={14} className="animate-spin text-[#5A5A40]" />
                            Caricamento ordini...
                          </div>
                        </div>
                      )}
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-[10px] uppercase tracking-widest text-[#6B7280]">
                            <th className="py-3 px-4">
                              <button onClick={toggleSelectAllOrders} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
                                {(() => {
                                  const currentItems = adminOrdersData.length > 0 ? adminOrdersData : orders.slice(0, adminOrdersPagination.pagination.limit);
                                  const isAllSelected = currentItems.length > 0 && currentItems.every(o => selectedOrderIds.includes(o.id));
                                  return isAllSelected ? (
                                    <CheckSquare size={16} className="text-[#5A5A40]" />
                                  ) : (
                                    <Square size={16} className="text-gray-400" />
                                  );
                                })()}
                              </button>
                            </th>
                            <TableSortHeader
                              columnKey="number"
                              sortState={adminOrdersPagination.sortState}
                              onSort={adminOrdersPagination.toggleSort}
                            >
                              Num / ID
                            </TableSortHeader>
                            <TableSortHeader
                              columnKey="client_name"
                              sortState={adminOrdersPagination.sortState}
                              onSort={adminOrdersPagination.toggleSort}
                            >
                              Cliente
                            </TableSortHeader>
                            <TableSortHeader
                              columnKey="agent_name"
                              sortState={adminOrdersPagination.sortState}
                              onSort={adminOrdersPagination.toggleSort}
                            >
                              Agente
                            </TableSortHeader>
                            <TableSortHeader
                              columnKey="date"
                              sortState={adminOrdersPagination.sortState}
                              onSort={adminOrdersPagination.toggleSort}
                            >
                              Data
                            </TableSortHeader>
                            <TableSortHeader
                              columnKey="payment_name"
                              sortState={adminOrdersPagination.sortState}
                              onSort={adminOrdersPagination.toggleSort}
                            >
                              Metodo Pagamento
                            </TableSortHeader>
                            <TableSortHeader
                              columnKey="total"
                              sortState={adminOrdersPagination.sortState}
                              onSort={adminOrdersPagination.toggleSort}
                            >
                              Totale
                            </TableSortHeader>
                            <TableSortHeader
                              columnKey="status"
                              sortState={adminOrdersPagination.sortState}
                              onSort={adminOrdersPagination.toggleSort}
                            >
                              Stato
                            </TableSortHeader>
                            <th className="py-3 px-4 font-black text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB] [content-visibility:auto]">
                          {adminOrdersData.length === 0 && !isAdminOrdersLoading ? (
                            <tr>
                              <td colSpan={9} className="py-16 text-center text-[#9CA3AF]">
                                <ShoppingCart size={40} className="mx-auto text-gray-300 stroke-1 mb-2" />
                                <p className="text-xs font-bold text-gray-700">Nessun ordine trovato per i criteri specificati.</p>
                                <p className="text-[11px] text-gray-400 mt-1">Modifica la ricerca o azzera i filtri per visualizzare gli ordini registrati.</p>
                              </td>
                            </tr>
                          ) : (
                            (adminOrdersData.length > 0 ? adminOrdersData : orders.slice(0, adminOrdersPagination.pagination.limit)).map(order => (
                            <tr key={order.id} className="hover:bg-[#F9FAFB] text-xs transition-colors">
                              <td className="py-4 px-4">
                                <button onClick={() => toggleSelectOrder(order.id)} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
                                  {selectedOrderIds.includes(order.id) ? (
                                    <CheckSquare size={16} className="text-[#5A5A40]" />
                                  ) : (
                                    <Square size={16} className="text-gray-400" />
                                  )}
                                </button>
                              </td>
                              <td className="py-4 px-4 font-mono font-bold text-[#111827]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>#{order.number || order.id}</span>
                                  {Boolean(order.is_imported) && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200" title="Ordine Storico Importato da XML Easyfatt">
                                      Storico XML
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 font-bold text-[#111827]">
                                <button
                                  onClick={() => handleViewClientDetails(order.client_id)}
                                  className="hover:text-[#5A5A40] hover:underline text-left font-bold cursor-pointer focus:outline-none"
                                >
                                  {order.client_name}
                                </button>
                              </td>
                              <td className="py-4 px-4 text-gray-500">
                                {order.agent_name || 'N/D'}
                              </td>
                              <td className="py-4 px-4 text-gray-500 font-mono">
                                {order.date}
                              </td>
                              <td className="py-4 px-4 text-gray-500">
                                {order.payment_name}
                              </td>
                              <td className="py-4 px-4 font-mono font-bold text-emerald-600">
                                € {order.total.toFixed(2)}
                              </td>
                              <td className="py-4 px-4">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                  order.status === 'Bozza'
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                )}>
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    order.status === 'Bozza' ? "bg-amber-500" : "bg-emerald-500"
                                  )} />
                                  {order.status === 'Bozza' ? 'Bozza' : 'Confermato & Trasmesso'}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right space-x-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setIsOrderDetailOpen(true);
                                  }}
                                  className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors inline-block cursor-pointer"
                                  title="Dettagli ordine"
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  onClick={() => openPrintWindow(order)}
                                  className="p-1.5 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors inline-block cursor-pointer"
                                  title="Stampa / Salva PDF"
                                >
                                  <Printer size={15} />
                                </button>
                                <button
                                  onClick={() => handleCopyOrderText(order)}
                                  className="p-1.5 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors inline-block cursor-pointer"
                                  title="Copia riepilogo negli appunti"
                                >
                                  <Copy size={15} />
                                </button>
                                <button
                                  onClick={() => handleEditOrder(order)}
                                  disabled={order.status !== 'Bozza'}
                                  className={cn(
                                    "p-1.5 rounded-lg transition-colors inline-block",
                                    order.status === 'Bozza'
                                      ? "hover:bg-amber-50 text-amber-600 cursor-pointer"
                                      : "text-gray-300 cursor-not-allowed opacity-40"
                                  )}
                                  title={order.status === 'Bozza' ? "Modifica bozza" : "Ordine già inviato: modifica disattivata"}
                                >
                                  <Edit3 size={15} />
                                </button>

                                {order.status === 'Bozza' && (
                                  <>
                                    <button
                                      onClick={() => handleTransmitDraft(order.id)}
                                      className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors inline-block cursor-pointer"
                                      title="Trasmetti bozza alla Sede"
                                    >
                                      <CheckCircle2 size={15} />
                                    </button>
                                    {canDeleteOrder(order) && (
                                      <button
                                        onClick={() => setOrderToDelete(order)}
                                        className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors inline-block cursor-pointer"
                                        title="Cancella totalmente questa bozza dal sistema"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>

                    {/* Universal Pagination Controls for Admin Orders */}
                    <DataTablePagination
                      pagination={adminOrdersPagination.pagination}
                      onPageChange={adminOrdersPagination.setPage}
                      onLimitChange={adminOrdersPagination.setLimit}
                      itemName="ordini"
                      isLoading={isAdminOrdersLoading}
                    />
                  </div>
              </div>
            )}

            {/* ADMIN TAB 6: METODI DI PAGAMENTO */}
            {adminTab === 'payment-methods' && (
              <div className="space-y-6 font-sans mt-6">
                {/* Banner informativo Collegamento Nominale */}
                <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <CreditCard size={16} className="text-amber-700 shrink-0" />
                    <span>Integrazione e Collegamento Nominale con Easyfatt</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    I metodi di pagamento aggiunti automaticamente durante l'importazione XML vengono rilevati con parametri intelligenti (rate, offset, fine mese).
                    Modificando il nome di un metodo di pagamento, <strong>tutti gli ordini ed i clienti collegati verranno aggiornati in automatico</strong> per preservare la coerenza ed il collegamento nominale.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LEFT COLUMN: Metodi Esistenti */}
                  <div className="lg:col-span-8 bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                      <div>
                        <h3 className="text-lg font-serif font-black text-[#111827]">Configurazione Metodi di Pagamento</h3>
                        <p className="text-xs text-[#6B7280]">Gestisci i termini di pagamento e le scadenze (rate) inviate nei file XML a Easyfatt.</p>
                      </div>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Cerca metodo..."
                          value={pmSearchFilter}
                          onChange={(e) => setPmSearchFilter(e.target.value)}
                          className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 w-full sm:w-48 font-medium"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-[10px] uppercase tracking-widest text-[#6B7280]">
                            <th className="py-3 px-4 font-black">Nome Metodo</th>
                            <th className="py-3 px-4 font-black">Offset (GG)</th>
                            <th className="py-3 px-4 font-black">Rate / F.M.</th>
                            <th className="py-3 px-4 font-black">Uso Collegato</th>
                            <th className="py-3 px-4 font-black text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                          {paymentMethods.filter((pm) => !pmSearchFilter || pm.name.toLowerCase().includes(pmSearchFilter.toLowerCase())).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-xs text-gray-400 font-bold uppercase tracking-wider">
                                {pmSearchFilter ? 'Nessun metodo trovato per questa ricerca.' : 'Nessun metodo di pagamento configurato.'}
                              </td>
                            </tr>
                          ) : (
                            paymentMethods
                              .filter((pm) => !pmSearchFilter || pm.name.toLowerCase().includes(pmSearchFilter.toLowerCase()))
                              .map((pm) => {
                                let parsedCustom: number[] | null = null;
                                if (pm.custom_offsets) {
                                  try {
                                    const parsed = typeof pm.custom_offsets === 'string' ? JSON.parse(pm.custom_offsets) : pm.custom_offsets;
                                    if (Array.isArray(parsed) && parsed.length > 0) {
                                      parsedCustom = parsed.map(Number).filter(n => !isNaN(n));
                                    }
                                  } catch (e) {
                                    parsedCustom = null;
                                  }
                                }

                                return (
                                  <tr key={pm.id} className="hover:bg-[#F9FAFB] text-xs transition-colors">
                                    <td className="py-4 px-4 font-bold text-[#111827]">
                                      {pm.name}
                                      {parsedCustom && (
                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                          Rata Libera
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-4 px-4 font-mono text-gray-600">
                                      {parsedCustom ? (
                                        <span className="text-[#5A5A40] font-bold">[{parsedCustom.join(', ')}] gg</span>
                                      ) : (
                                        `${pm.offset_days} gg`
                                      )}
                                    </td>
                                    <td className="py-4 px-4 font-mono font-bold text-[#5A5A40]">
                                      {parsedCustom ? (
                                        `${parsedCustom.length} rate libere ${pm.fine_mese === 1 || pm.fine_mese === true ? '(F.M.)' : ''}`
                                      ) : (
                                        `${pm.installments} ${pm.installments === 1 ? 'rata' : 'rate'} ${pm.fine_mese === 1 || pm.fine_mese === true ? '(F.M.)' : ''}`
                                      )}
                                    </td>
                                    <td className="py-4 px-4">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100" title="Ordini collegati a questo metodo">
                                          <FileText size={10} />
                                          {pm.orders_count || 0} ordini
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-100" title="Clienti collegati a questo metodo">
                                          <Users size={10} />
                                          {pm.clients_count || 0} clienti
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                                      <button
                                        onClick={() => {
                                          let offsetsList: number[] = [60, 90, 120];
                                          let hasCustomOffsets = false;
                                          if (pm.custom_offsets) {
                                            try {
                                              const parsed = typeof pm.custom_offsets === 'string' ? JSON.parse(pm.custom_offsets) : pm.custom_offsets;
                                              if (Array.isArray(parsed) && parsed.length > 0) {
                                                offsetsList = parsed.map(Number).filter(n => !isNaN(n));
                                                hasCustomOffsets = true;
                                              }
                                            } catch (e) {
                                              hasCustomOffsets = false;
                                            }
                                          }
                                          setEditingPmId(pm.id);
                                          setPmForm({
                                            id: pm.id,
                                            name: pm.name,
                                            offset_days: pm.offset_days,
                                            installments: pm.installments,
                                            fine_mese: pm.fine_mese === 1 || pm.fine_mese === true,
                                            is_custom_offsets: hasCustomOffsets,
                                            custom_offsets: offsetsList
                                          });
                                        }}
                                        className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors inline-block cursor-pointer"
                                        title="Modifica metodo"
                                      >
                                        <Edit3 size={15} />
                                      </button>
                                      <button
                                        onClick={() => handleDeletePaymentMethod(pm.id)}
                                        className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors inline-block cursor-pointer"
                                        title="Elimina metodo"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Nuovo / Modifica Form */}
                  <div className="lg:col-span-4 bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs h-fit space-y-6">
                    <div>
                      <h3 className="text-md font-serif font-black text-[#111827]">
                        {editingPmId ? 'Modifica Metodo' : 'Nuovo Metodo di Pagamento'}
                      </h3>
                      <p className="text-xs text-[#6B7280]">
                        {editingPmId ? 'Aggiorna i parametri ed applica la modifica nominale in cascata.' : 'Crea un nuovo termine di pagamento per gli ordini XML.'}
                      </p>
                    </div>

                    {editingPmId && (
                      <div className="p-3 bg-blue-50/80 border border-blue-200/90 rounded-xl text-xs text-blue-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-blue-950 text-[11px]">
                          <Info size={13} className="text-blue-600 shrink-0" />
                          <span>Aggiornamento Collegamento Nominale</span>
                        </div>
                        <p className="text-[10px] leading-tight text-blue-800">
                          Rinominando questo metodo, i <strong>{paymentMethods.find(p => p.id === editingPmId)?.orders_count || 0} ordini</strong> ed i <strong>{paymentMethods.find(p => p.id === editingPmId)?.clients_count || 0} clienti</strong> collegati verranno aggiornati simultaneamente.
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleSavePaymentMethod} className="space-y-4 text-xs font-bold text-gray-700">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Nome Metodo *</label>
                        <input
                          required
                          type="text"
                          placeholder="Es. R.B. 60/90/120 gg F.M."
                          value={pmForm.name}
                          onChange={(e) => setPmForm({ ...pmForm, name: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold text-[#111827]"
                        />
                      </div>

                      {/* FLAG RATA LIBERA */}
                      <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/20 rounded-xl p-3 space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="pm_is_custom_offsets"
                            checked={pmForm.is_custom_offsets}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPmForm({
                                ...pmForm,
                                is_custom_offsets: checked,
                                custom_offsets: checked && pmForm.custom_offsets.length === 0 ? [60, 90, 120] : pmForm.custom_offsets
                              });
                            }}
                            className="h-4 w-4 text-[#5A5A40] focus:ring-[#5A5A40]/20 border-gray-300 rounded cursor-pointer"
                          />
                          <label htmlFor="pm_is_custom_offsets" className="text-xs font-black text-[#5A5A40] cursor-pointer select-none">
                            Pagamenti "Rata lib." (Scadenze Personalizzate)
                          </label>
                        </div>
                        <p className="text-[10px] font-normal text-gray-500 leading-tight pl-6">
                          Abilita questa opzione se il metodo prevede giorni di scostamento specifici per ciascuna rata (es. 1ª rata a 60 gg, 2ª a 90 gg, 3ª a 120 gg).
                        </p>
                      </div>

                      {/* BLOCCO DINAMICO SCADENZE PER RATA LIBERA */}
                      {pmForm.is_custom_offsets ? (
                        <div className="space-y-3 bg-amber-50/40 border border-amber-200/60 rounded-2xl p-3.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                              Scadenze Rate ({pmForm.custom_offsets.length} {pmForm.custom_offsets.length === 1 ? 'rata' : 'rate'})
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const lastOffset = pmForm.custom_offsets.length > 0 ? pmForm.custom_offsets[pmForm.custom_offsets.length - 1] : 30;
                                setPmForm({
                                  ...pmForm,
                                  custom_offsets: [...pmForm.custom_offsets, lastOffset + 30]
                                });
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold bg-[#5A5A40] text-white rounded-lg hover:bg-[#4E4E37] transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              + Aggiungi Rata
                            </button>
                          </div>

                          {/* Preset Rapidi */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[10px] text-gray-400 font-semibold">Preset:</span>
                            {[
                              { label: '30/60/90', val: [30, 60, 90] },
                              { label: '60/90/120', val: [60, 90, 120] },
                              { label: '30/60/90/120', val: [30, 60, 90, 120] },
                              { label: '60/120/180', val: [60, 120, 180] }
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  setPmForm({
                                    ...pmForm,
                                    custom_offsets: [...preset.val]
                                  });
                                }}
                                className="px-2 py-0.5 text-[9px] font-bold bg-white border border-amber-200 text-amber-800 rounded-md hover:bg-amber-100 transition-colors cursor-pointer"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          {/* Lista righe dinamiche */}
                          <div className="space-y-2 pt-2">
                            {pmForm.custom_offsets.map((offsetVal, index) => (
                              <div key={index} className="flex items-center gap-2 bg-white p-2 border border-amber-200/80 rounded-xl shadow-2xs">
                                <span className="text-[10px] font-bold text-amber-900 w-16 shrink-0">
                                  {index + 1}ª Rata:
                                </span>
                                <div className="flex-1 flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    max="720"
                                    value={offsetVal}
                                    onChange={(e) => {
                                      const newVal = Number(e.target.value) || 0;
                                      const updated = [...pmForm.custom_offsets];
                                      updated[index] = newVal;
                                      setPmForm({ ...pmForm, custom_offsets: updated });
                                    }}
                                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#111827] focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
                                    placeholder="Giorni"
                                  />
                                  <span className="text-[10px] text-gray-500 font-medium">gg</span>
                                </div>
                                {pmForm.custom_offsets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = pmForm.custom_offsets.filter((_, i) => i !== index);
                                      setPmForm({ ...pmForm, custom_offsets: updated });
                                    }}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Rimuovi questa rata"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-amber-800/80 italic font-medium">
                            Esempio [{pmForm.custom_offsets.join(', ')}]: La 1ª rata scade dopo {pmForm.custom_offsets[0] || 0} giorni, la 2ª dopo {pmForm.custom_offsets[1] || 0} giorni, ecc.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Offset Pagamento (Giorni) *</label>
                            <input
                              required
                              type="number"
                              min="0"
                              max="365"
                              placeholder="Es. 30"
                              value={pmForm.offset_days}
                              onChange={(e) => setPmForm({ ...pmForm, offset_days: Number(e.target.value) || 0 })}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold text-[#111827]"
                            />
                            <p className="text-[10px] font-normal text-gray-400 mt-1">Giorni da aggiungere alla data dell'ordine per calcolare la prima scadenza.</p>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Numero di Rate (Scadenze) *</label>
                            <input
                              required
                              type="number"
                              min="1"
                              max="12"
                              placeholder="Es. 1"
                              value={pmForm.installments}
                              onChange={(e) => setPmForm({ ...pmForm, installments: Number(e.target.value) || 1 })}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold text-[#111827]"
                            />
                            <p className="text-[10px] font-normal text-gray-400 mt-1">Il totale dell'ordine sarà suddiviso in scadenze uguali. Eventuali arrotondamenti sull'ultima rata.</p>
                          </div>
                        </>
                      )}

                      <div className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          id="pm_fine_mese"
                          checked={pmForm.fine_mese}
                          onChange={(e) => setPmForm({ ...pmForm, fine_mese: e.target.checked })}
                          className="h-4 w-4 text-[#5A5A40] focus:ring-[#5A5A40]/20 border-gray-300 rounded cursor-pointer"
                        />
                        <label htmlFor="pm_fine_mese" className="text-[11px] font-bold text-gray-700 cursor-pointer select-none">
                          Fine Mese (F.M.)
                        </label>
                      </div>

                      <div className="flex gap-2 pt-2">
                        {editingPmId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPmId(null);
                              setPmForm({
                                id: null,
                                name: '',
                                offset_days: 30,
                                installments: 1,
                                fine_mese: false,
                                is_custom_offsets: false,
                                custom_offsets: [60, 90, 120]
                              });
                            }}
                            className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 text-xs transition-colors cursor-pointer"
                          >
                            Annulla
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-2.5 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          {editingPmId ? 'Salva Modifiche' : 'Crea Metodo'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* ADMIN TAB 7: INTESTAZIONE AZIENDALE & LOGO PER PDF */}
            {adminTab === 'company-header' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans mt-6">
                {/* LEFT COLUMN: FORM DI CONFIGURAZIONE */}
                <div className="lg:col-span-7 bg-white rounded-[2rem] border border-[#E5E7EB] p-6 sm:p-8 shadow-xs space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl flex items-center justify-center">
                      <Building size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-black text-[#111827]">Intestazione e Dati Aziendali per PDF</h3>
                      <p className="text-xs text-[#6B7280]">Definisci l'intestazione ufficiale, i riferimenti fiscali ed il logo aziendale stampati sui PDF degli ordini.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveCompanyHeader} className="space-y-5 text-xs">
                    {/* Logo Upload Section */}
                    <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-wider text-[#5A5A40] block">
                        Logo Aziendale (JPG / PNG - Max 2MB)
                      </label>
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        {companyHeader.company_logo ? (
                          <div className="relative group border border-gray-200 bg-white p-2 rounded-xl shadow-2xs">
                            <img 
                              src={companyHeader.company_logo} 
                              alt="Logo Aziendale" 
                              className="h-16 max-w-[200px] object-contain" 
                            />
                            <button
                              type="button"
                              onClick={() => setCompanyHeader(prev => ({ ...prev, company_logo: '' }))}
                              className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors shadow-xs"
                              title="Rimuovi logo"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="h-16 w-40 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 text-[10px] font-bold">
                            Nessun logo caricato
                          </div>
                        )}

                        <div className="flex-1 w-full sm:w-auto">
                          <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:border-[#5A5A40] text-[#111827] font-bold rounded-xl text-xs cursor-pointer transition-all shadow-2xs w-full sm:w-auto">
                            <Upload size={14} className="text-[#5A5A40]" />
                            {companyHeader.company_logo ? 'Sostituisci Logo' : 'Carica Logo Immagine'}
                            <input 
                              type="file" 
                              accept="image/png, image/jpeg, image/jpg, image/webp" 
                              onChange={handleLogoUpload}
                              className="hidden" 
                            />
                          </label>
                          <p className="text-[10px] text-gray-400 mt-1">Consigliato: Sfondo trasparente o bianco (PNG/JPG).</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Ragione Sociale / Nome Azienda *</label>
                        <input
                          required
                          type="text"
                          value={companyHeader.company_name}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_name: e.target.value })}
                          placeholder="Es. Connect Beauty S.r.l."
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold text-[#111827]"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Indirizzo Sede Legale / Operativa</label>
                        <input
                          type="text"
                          value={companyHeader.company_address}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_address: e.target.value })}
                          placeholder="Es. Via Roma, 123"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">CAP</label>
                        <input
                          type="text"
                          value={companyHeader.company_postcode}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_postcode: e.target.value })}
                          placeholder="Es. 20121"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Città</label>
                        <input
                          type="text"
                          value={companyHeader.company_city}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_city: e.target.value })}
                          placeholder="Es. Milano"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Provincia (Sigla)</label>
                        <input
                          type="text"
                          maxLength={2}
                          value={companyHeader.company_province}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_province: e.target.value.toUpperCase() })}
                          placeholder="Es. MI"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Nazione</label>
                        <input
                          type="text"
                          value={companyHeader.company_country}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_country: e.target.value })}
                          placeholder="Es. Italia"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Partita IVA</label>
                        <input
                          type="text"
                          value={companyHeader.company_vat_code}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_vat_code: e.target.value })}
                          placeholder="Es. IT12345678901"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Codice Fiscale</label>
                        <input
                          type="text"
                          value={companyHeader.company_fiscal_code}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_fiscal_code: e.target.value })}
                          placeholder="Es. 12345678901"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Telefono Contatto</label>
                        <input
                          type="text"
                          value={companyHeader.company_tel}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_tel: e.target.value })}
                          placeholder="Es. +39 02 1234567"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Email Contatto</label>
                        <input
                          type="email"
                          value={companyHeader.company_email}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_email: e.target.value })}
                          placeholder="Es. info@connectbeauty.it"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Indirizzo PEC</label>
                        <input
                          type="email"
                          value={companyHeader.company_pec}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_pec: e.target.value })}
                          placeholder="Es. connectbeauty@pec.it"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Sito Web</label>
                        <input
                          type="text"
                          value={companyHeader.company_website}
                          onChange={(e) => setCompanyHeader({ ...companyHeader, company_website: e.target.value })}
                          placeholder="Es. www.connectbeauty.it"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-xs font-bold text-[#111827]"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-end">
                      <button
                        type="submit"
                        disabled={savingCompanyHeader}
                        className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-bold rounded-xl text-xs transition-colors shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        <Check size={16} />
                        {savingCompanyHeader ? 'Salvataggio...' : 'Salva Intestazione & Logo'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* RIGHT COLUMN: ANTEPRIMA INTESTAZIONE */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white rounded-[2rem] border border-[#E5E7EB] p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#5A5A40] flex items-center gap-2">
                        <Printer size={14} /> Anteprima Testata PDF
                      </h4>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                        Stampa A4
                      </span>
                    </div>

                    <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-2xs space-y-4 font-sans text-xs">
                      <div className="flex justify-between items-start border-b-2 border-[#5A5A40] pb-3">
                        <div className="space-y-1.5 max-w-[65%]">
                          {companyHeader.company_logo ? (
                            <img 
                              src={companyHeader.company_logo} 
                              alt="Logo" 
                              className="h-10 max-w-[140px] object-contain mb-1" 
                            />
                          ) : null}
                          <div className="text-sm font-serif font-black text-[#111827]">{companyHeader.company_name || 'Connect Beauty S.r.l.'}</div>
                          <div className="text-[10px] text-gray-600 leading-tight space-y-0.5">
                            {companyHeader.company_address && <div>{companyHeader.company_address}</div>}
                            {(companyHeader.company_postcode || companyHeader.company_city) && (
                              <div>{companyHeader.company_postcode} {companyHeader.company_city} ({companyHeader.company_province}) - {companyHeader.company_country}</div>
                            )}
                            {companyHeader.company_vat_code && (
                              <div>P.IVA: <span className="font-mono font-bold">{companyHeader.company_vat_code}</span></div>
                            )}
                            {companyHeader.company_tel && <div>Tel: {companyHeader.company_tel}</div>}
                            {companyHeader.company_email && <div>Email: {companyHeader.company_email}</div>}
                          </div>
                        </div>

                        <div className="text-right bg-gray-50 border border-gray-200 rounded-xl p-3 text-[10px]">
                          <div className="font-black uppercase text-[#5A5A40]">Conferma d'Ordine</div>
                          <div className="text-base font-black font-mono text-[#111827]">N° 0042</div>
                          <div className="text-gray-500">Data: {new Date().toLocaleDateString('it-IT')}</div>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-[10px] text-gray-500 italic text-center">
                        Tutti i documenti scaricati in formato PDF e le stampe degli ordini utilizzeranno questa intestazione personalizzata.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
      )}

      {/* MODAL 1: ADD / EDIT PRODUCT */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProductModalOpen(false)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-[#E5E7EB] overflow-hidden z-20 max-h-[90vh] flex flex-col"
            >
              <div className="p-8 pb-4 flex items-center justify-between border-b border-[#F3F4F6]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center text-[#5A5A40]">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-bold text-[#111827]">
                      {editingProduct ? 'Modifica Articolo' : 'Nuovo Articolo'}
                    </h3>
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Catalog Sync Tool</p>
                  </div>
                </div>
                <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Sub-tabs inside modal */}
              <div className="px-8 pt-4 bg-gray-50/50 border-b border-[#F3F4F6] flex gap-4">
                <button
                  type="button"
                  onClick={() => setModalSubTab('base')}
                  className={cn(
                    "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all",
                    modalSubTab === 'base' ? "border-[#5A5A40] text-[#5A5A40]" : "border-transparent text-gray-400 hover:text-gray-600"
                  )}
                >
                  Dati Base
                </button>
                <button
                  type="button"
                  onClick={() => setModalSubTab('ext')}
                  className={cn(
                    "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all",
                    modalSubTab === 'ext' ? "border-[#5A5A40] text-[#5A5A40]" : "border-transparent text-gray-400 hover:text-gray-600"
                  )}
                >
                  Dati Easyfatt
                </button>
                <button
                  type="button"
                  onClick={() => setModalSubTab('online')}
                  className={cn(
                    "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all",
                    modalSubTab === 'online' ? "border-[#5A5A40] text-[#5A5A40]" : "border-transparent text-gray-400 hover:text-gray-600"
                  )}
                >
                  E-Commerce Online
                </button>
              </div>

              <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                {modalSubTab === 'base' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Codice Articolo *</label>
                        <input
                          required
                          type="text"
                          value={productForm.code}
                          onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                          placeholder="Es. SV-008"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Codice a Barre (Barcode)</label>
                        <input
                          type="text"
                          value={productForm.barcode}
                          onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                          placeholder="Codice EAN/UPC"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Descrizione Prodotto *</label>
                      <input
                        required
                        type="text"
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        placeholder="Es. Latte detergente lenitivo 200ml"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Prezzo Listino (€) *</label>
                        <input
                          required
                          type="number"
                          step="0.01"
                          min="0"
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Giacenza Magazzino</label>
                        <input
                          type="number"
                          min="0"
                          value={productForm.stock}
                          onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                          placeholder="0"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Aliquota IVA (%)</label>
                        <input
                          type="text"
                          value={productForm.vat_code}
                          onChange={(e) => setProductForm({ ...productForm, vat_code: e.target.value })}
                          placeholder="22"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Unità di Misura (UM)</label>
                        <input
                          type="text"
                          value={productForm.um}
                          onChange={(e) => setProductForm({ ...productForm, um: e.target.value })}
                          placeholder="pz"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {modalSubTab === 'ext' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Categoria</label>
                        <input
                          type="text"
                          value={productForm.category}
                          onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                          placeholder="Viso, Corpo, Capelli"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Sotto-categoria</label>
                        <input
                          type="text"
                          value={productForm.subcategory}
                          onChange={(e) => setProductForm({ ...productForm, subcategory: e.target.value })}
                          placeholder="Crema idratante"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Produttore (Brand)</label>
                        <input
                          type="text"
                          value={productForm.producer_name}
                          onChange={(e) => setProductForm({ ...productForm, producer_name: e.target.value })}
                          placeholder="Connect"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Nome File Immagine</label>
                        <input
                          type="text"
                          value={productForm.image_file_name}
                          onChange={(e) => setProductForm({ ...productForm, image_file_name: e.target.value })}
                          placeholder="prodotto.jpg"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Link Scheda Prodotto</label>
                      <input
                        type="url"
                        value={productForm.link}
                        onChange={(e) => setProductForm({ ...productForm, link: e.target.value })}
                        placeholder="https://connect.com/scheda-prodotto"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Campo Libero 1</label>
                        <input
                          type="text"
                          value={productForm.custom_field1}
                          onChange={(e) => setProductForm({ ...productForm, custom_field1: e.target.value })}
                          placeholder="Uso custom 1"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Campo Libero 2</label>
                        <input
                          type="text"
                          value={productForm.custom_field2}
                          onChange={(e) => setProductForm({ ...productForm, custom_field2: e.target.value })}
                          placeholder="Uso custom 2"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Note Articolo (Easyfatt)</label>
                      <textarea
                        value={productForm.notes}
                        onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
                        placeholder="Note inserite nel gestionale Easyfatt"
                        rows={3}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                      />
                    </div>
                  </div>
                )}

                {modalSubTab === 'online' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                      <input
                        type="checkbox"
                        id="online_customized"
                        checked={productForm.online_customized}
                        onChange={(e) => setProductForm({ ...productForm, online_customized: e.target.checked })}
                        className="w-4 h-4 text-[#5A5A40] border-gray-300 rounded focus:ring-[#5A5A40]/20"
                      />
                      <label htmlFor="online_customized" className="text-xs font-bold text-indigo-900 select-none cursor-pointer">
                        Articolo Personalizzato in E-Commerce (impedisce sovrascrittura di alcuni dati sensibili)
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Dettagli Promozione On-Line</label>
                        <input
                          type="text"
                          value={productForm.online_promo}
                          onChange={(e) => setProductForm({ ...productForm, online_promo: e.target.value })}
                          placeholder="Es. Sconto 15% fino a fine mese"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Garanzia (mesi / e-commerce)</label>
                        <input
                          type="text"
                          value={productForm.online_warranty}
                          onChange={(e) => setProductForm({ ...productForm, online_warranty: e.target.value })}
                          placeholder="Es. 24 mesi"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Immagine Categoria On-Line (URL)</label>
                      <input
                        type="text"
                        value={productForm.online_category_image}
                        onChange={(e) => setProductForm({ ...productForm, online_category_image: e.target.value })}
                        placeholder="https://connect.com/images/categories/viso.jpg"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Note Aggiuntive E-Commerce</label>
                      <textarea
                        value={productForm.online_notes}
                        onChange={(e) => setProductForm({ ...productForm, online_notes: e.target.value })}
                        placeholder="Queste informazioni rimangono protette e non vengono sovrascritte durante le importazioni massive di Easyfatt."
                        rows={4}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6]">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-200"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-[#5A5A40] hover:bg-[#4E4E37] rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingProduct ? 'Salva Modifiche' : 'Crea Prodotto'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: NEW CUSTOMER ORDER */}
      <AnimatePresence>
        {isOrderModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOrderModalOpen(false)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-[#E5E7EB] overflow-hidden z-20 max-h-[90vh] flex flex-col"
            >
              <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center text-[#5A5A40]">
                      <ShoppingCart size={20} />
                    </div>
                    <h3 className="text-xl font-serif font-bold text-[#111827]">
                      Compila Ordine Cliente (Agenti)
                    </h3>
                  </div>
                  <button onClick={() => setIsOrderModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X size={18} className="text-gray-500" />
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleOrderSubmit('Nuovo'); }} className="space-y-6">
                  {/* Client & Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Seleziona Cliente *</label>
                      <select
                        required
                        value={orderForm.client_id || ''}
                        onChange={(e) => setOrderForm({ ...orderForm, client_id: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                      >
                        <option value="">-- Seleziona cliente --</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.city || 'N/D'})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Data Ordine *</label>
                      <input
                        required
                        type="date"
                        value={orderForm.date}
                        onChange={(e) => setOrderForm({ ...orderForm, date: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Payment terms */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Modalità Pagamento</label>
                      <select
                        value={orderForm.payment_name || ''}
                        onChange={(e) => setOrderForm({ ...orderForm, payment_name: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                      >
                        {paymentMethods.length > 0 ? (
                          paymentMethods.map((pm) => (
                            <option key={pm.id} value={pm.name}>
                              {pm.name} ({pm.installments} rat{pm.installments === 1 ? 'a' : 'e'}, offset {pm.offset_days} gg)
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Bonifico bancario">Bonifico bancario (1 rata, offset 30 gg)</option>
                            <option value="Ricevuta bancaria 30/60 gg">Ricevuta bancaria 30/60 gg (2 rate, offset 30 gg)</option>
                            <option value="Contanti alla consegna">Contanti alla consegna (1 rata, offset 0 gg)</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Banca di Appoggio</label>
                      <input
                        type="text"
                        value={orderForm.payment_bank}
                        onChange={(e) => setOrderForm({ ...orderForm, payment_bank: e.target.value })}
                        placeholder="Es. Intesa Sanpaolo S.p.A."
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Product Picker */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Aggiungi articoli all'ordine</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="text-[9px] uppercase text-gray-400 font-bold ml-1">Prodotto</label>
                        <select
                          value={selectedProductCode || ''}
                          onChange={(e) => {
                            setSelectedProductCode(e.target.value);
                            const prod = products.find(p => p.code === e.target.value);
                            if (prod) setSelectedProductPrice(prod.price);
                          }}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-xs font-bold"
                        >
                          <option value="">Seleziona...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.code}>{p.code} - {p.description.substring(0, 30)}... (€ {p.price})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] uppercase text-gray-400 font-bold ml-1">Prezzo (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={selectedProductPrice || ''}
                          onChange={(e) => setSelectedProductPrice(Number(e.target.value))}
                          placeholder="Prezzo"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-xs font-bold font-mono"
                        />
                      </div>

                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[9px] uppercase text-gray-400 font-bold ml-1">Quantità</label>
                          <input
                            type="number"
                            min="1"
                            value={selectedProductQty}
                            onChange={(e) => setSelectedProductQty(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-xs font-bold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddOrderItem}
                          className="px-3.5 py-2.5 bg-[#5A5A40] text-white font-bold text-xs rounded-lg hover:bg-[#4E4E37] transition-all"
                        >
                          Inserisci
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Order Items Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Righe dell'Ordine</h4>
                    {orderForm.items.length === 0 ? (
                      <p className="text-center py-6 text-xs text-gray-400 italic font-semibold bg-gray-50 rounded-2xl border">Nessun articolo inserito nell'ordine.</p>
                    ) : (
                      <div className="border border-gray-200 rounded-2xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-gray-50 text-gray-500 font-bold text-[10px] uppercase">
                            <tr>
                              <th className="py-2.5 px-3">Codice</th>
                              <th className="py-2.5 px-3">Descrizione</th>
                              <th className="py-2.5 px-3">Prezzo Unit.</th>
                              <th className="py-2.5 px-3">Quantità</th>
                              <th className="py-2.5 px-3">Totale</th>
                              <th className="py-2.5 px-3 text-right"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderForm.items.map((i, idx) => (
                              <tr key={`${i.product_code}-${idx}`} className={cn("border-t transition-colors", i.price < 0 ? "bg-rose-50/40 hover:bg-rose-50/70" : "bg-white hover:bg-gray-50")}>
                                <td className="py-2.5 px-3 font-mono font-bold text-[#111827]">
                                  <div className="flex items-center gap-1.5">
                                    <span>{i.product_code}</span>
                                    {i.price < 0 && (
                                      <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.2 rounded">
                                        Detrazione
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-gray-700 font-semibold">{i.description}</td>
                                <td className="py-2.5 px-3 font-mono w-28">
                                  <EditableAmountInput
                                    value={i.price}
                                    onChange={(newP) => handleUpdateItemPrice(i.product_code, newP, idx)}
                                    prefix="€"
                                    placeholder="0.00"
                                  />
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-gray-800">{i.qty} {i.um}</td>
                                <td className="py-2.5 px-3 font-mono font-bold w-32">
                                  <EditableAmountInput
                                    value={Math.round(i.qty * i.price * 100) / 100}
                                    onChange={(newTot) => handleUpdateItemTotal(i.product_code, newTot, idx)}
                                    prefix="€"
                                    placeholder="0.00"
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOrderItem(i.product_code, idx)}
                                    className="p-1 hover:bg-rose-50 text-rose-500 rounded"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {(() => {
                          const gross = orderForm.items.filter(i => i.price > 0).reduce((sum, item) => sum + (item.qty * item.price), 0);
                          const discounts = orderForm.items.filter(i => i.price < 0).reduce((sum, item) => sum + (item.qty * item.price), 0);
                          const net = orderForm.items.reduce((sum, item) => sum + (item.qty * item.price), 0);

                          return (
                            <div className="bg-[#5A5A40]/5 p-3.5 border-t space-y-1.5">
                              {discounts < 0 && (
                                <div className="flex justify-between items-center text-xs text-gray-600">
                                  <span>Subtotale Lordo: € {gross.toFixed(2)}</span>
                                  <span className="text-rose-600 font-bold">Detrazioni / Sconti: - € {Math.abs(discounts).toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-sm font-bold text-[#5A5A40]">
                                <span>TOTALE IMPONIBILE ORDINE:</span>
                                <span className={cn("font-mono text-base font-black", net < 0 ? "text-rose-600" : "text-[#5A5A40]")}>
                                  € {net.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 ml-1">Note / Commenti Interni (saranno visibili in Easyfatt)</label>
                    <textarea
                      value={orderForm.notes}
                      onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                      rows={2}
                      placeholder="Commenti facoltativi per l'amministrazione, es: Consegnare di pomeriggio"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm font-bold"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-gray-100">
                    {minOrderTotal > 0 && orderForm.items.length > 0 && (
                      <div className="text-left sm:mr-auto">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                          isBelowMinOrderTotal 
                            ? "bg-amber-50 text-amber-700 border-amber-200" 
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}>
                          <span className={cn("w-1 h-1 rounded-full", isBelowMinOrderTotal ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
                          {isBelowMinOrderTotal 
                            ? `Sotto minimo d'ordine (€ ${minOrderTotal.toFixed(2)})` 
                            : "Soglia minima superata"}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsOrderModalOpen(false)}
                        className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-200"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        disabled={loading || !orderForm.client_id || orderForm.items.length === 0}
                        onClick={() => handleOrderSubmit('Bozza')}
                        className={cn(
                          "px-4 py-2 text-xs font-bold text-[#5A5A40] bg-white hover:bg-[#5A5A40]/5 border border-[#5A5A40] rounded-xl flex items-center gap-1.5 active:scale-95",
                          (!orderForm.client_id || orderForm.items.length === 0) ? "opacity-40 cursor-not-allowed" : ""
                        )}
                      >
                        <FileText size={13} />
                        Bozza
                      </button>
                      <button
                        type="button"
                        disabled={loading || !orderForm.client_id || orderForm.items.length === 0 || isBelowMinOrderTotal}
                        onClick={() => handleOrderSubmit('Nuovo')}
                        className={cn(
                          "px-5 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-1 shadow-sm active:scale-95",
                          (!orderForm.client_id || orderForm.items.length === 0 || isBelowMinOrderTotal)
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-[#5A5A40] hover:bg-[#4E4E37]"
                        )}
                      >
                        <Save className="w-3.5 h-3.5" />
                        Invia Ordine
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: ORDER DETAIL VIEW */}
      <AnimatePresence>
        {isOrderDetailOpen && selectedOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOrderDetailOpen(false)}
              className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-[#E5E7EB] overflow-hidden z-20"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center text-[#5A5A40]">
                      <FileCode size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-bold text-[#111827]">
                        Dettaglio Ordine #{String(selectedOrder.number || selectedOrder.id).padStart(4, '0')}
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{selectedOrder.date}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsOrderDetailOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X size={18} className="text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Customer and agent card */}
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-bold text-gray-400 uppercase text-[9px] tracking-wider mb-0.5">Cliente</div>
                      <button
                        onClick={() => {
                          handleViewClientDetails(selectedOrder.client_id);
                          setIsOrderDetailOpen(false);
                        }}
                        className="font-black text-gray-800 text-sm hover:text-[#5A5A40] hover:underline text-left cursor-pointer focus:outline-none"
                      >
                        {selectedOrder.client_name}
                      </button>
                      <div className="text-gray-500 font-semibold">{selectedOrder.client_email}</div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-400 uppercase text-[9px] tracking-wider mb-0.5">Agente di Vendita</div>
                      <div className="font-black text-gray-800 text-sm">{selectedOrder.agent_name || 'Amministratore'}</div>
                      <div className="text-gray-500 font-semibold">Connect Italia</div>
                    </div>
                  </div>

                  {/* Payment details card */}
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-bold text-gray-400 uppercase text-[9px] tracking-wider mb-0.5">Pagamento</div>
                      <div className="font-bold text-gray-800">{selectedOrder.payment_name}</div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-400 uppercase text-[9px] tracking-wider mb-0.5">Banca</div>
                      <div className="font-bold text-gray-800">{selectedOrder.payment_bank || 'N/D'}</div>
                    </div>
                  </div>

                  {/* Order Installments Plan */}
                  {(() => {
                    const insts = calculateOrderInstallments(selectedOrder);
                    if (insts && insts.length > 0) {
                      return (
                        <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-2xl space-y-2">
                          <div className="font-bold text-[#5A5A40] uppercase text-[9px] tracking-wider border-b border-amber-100 pb-1 flex items-center gap-1">
                            <Calendar size={11} />
                            Piano di Scadenza Rate Calcolato
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                            {insts.map((inst, index) => {
                              const isOverdue = new Date(inst.date) < new Date();
                              return (
                                <div key={index} className="flex justify-between items-center bg-white p-2 rounded-xl border border-amber-100/50">
                                  <div className="flex flex-col">
                                    <span className="text-gray-400 font-sans font-bold">Rata {index + 1}</span>
                                    <span className="font-bold text-gray-700 flex items-center gap-1">
                                      {new Date(inst.date).toLocaleDateString('it-IT')}
                                      {isOverdue && (
                                        <span className="text-[7px] bg-rose-50 text-rose-500 px-1 py-0.2 rounded border border-rose-100 uppercase tracking-widest font-black font-sans scale-90 origin-left">Scaduto</span>
                                      )}
                                    </span>
                                  </div>
                                  <span className="font-bold text-[#5A5A40] text-xs">€ {inst.amount.toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Order items */}
                  <div className="space-y-1.5">
                    <div className="font-bold text-gray-400 uppercase text-[9px] tracking-wider mb-1">Prodotti Acquistati</div>
                    <div className="border border-gray-100 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 font-bold text-[10px] text-gray-500">
                          <tr>
                            <th className="py-2 px-3">Codice</th>
                            <th className="py-2 px-3">Articolo</th>
                            <th className="py-2 px-3">Qta</th>
                            <th className="py-2 px-3">Prezzo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items?.map(i => (
                            <tr key={i.id} className="border-t hover:bg-gray-50 text-xs">
                              <td className="py-2.5 px-3 font-mono font-bold text-gray-700">{i.product_code}</td>
                              <td className="py-2.5 px-3 font-semibold text-gray-800">{i.description}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-gray-600">{i.qty}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">€ {i.price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Internal comment */}
                  {selectedOrder.notes && (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <div className="font-bold text-amber-800 uppercase text-[9px] tracking-wider mb-0.5">Note dell'ordine (XML comment)</div>
                      <p className="text-amber-900 leading-relaxed font-bold">"{selectedOrder.notes}"</p>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Totale Ordine</div>
                      <div className="text-xl font-black text-[#5A5A40]">€ {selectedOrder.total.toFixed(2)}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => openPrintWindow(selectedOrder)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-black text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                        title="Stampa o Salva PDF tramite finestra del browser"
                      >
                        <Printer size={14} />
                        Stampa
                      </button>
                      <button
                        onClick={() => handleCopyOrderText(selectedOrder)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95 border border-gray-200"
                        title="Copia testo del riepilogo d'ordine negli appunti"
                      >
                        <Copy size={14} />
                        Copia Testo
                      </button>
                      <button
                        onClick={() => {
                          window.open(`/api/easyfatt/export-orders?ids=${selectedOrder.id}`, '_blank');
                          showStatus(`Esportato ordine #${selectedOrder.number || selectedOrder.id} in formato Easyfatt-XML`);
                          setIsOrderDetailOpen(false);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Download size={14} />
                        Scarica XML
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CLIENT DETAILS & STATISTICS MODAL */}
      <AnimatePresence>
        {isClientDetailOpen && selectedDetailClient && (() => {
          const clientStats = getClientStats(selectedDetailClient.id, selectedDetailClient);
          const { rawNotes, daneaData } = parseClientNotes(selectedDetailClient.notes);
          const hasDaneaData = Object.keys(daneaData).length > 0;

          // Helper to copy text to clipboard
          const copyToClipboard = (text: string, fieldId: string) => {
            navigator.clipboard.writeText(text);
            setCopiedText(fieldId);
            setTimeout(() => setCopiedText(null), 1500);
          };

          return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsClientDetailOpen(false)}
                className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={cn(
                  "relative w-full bg-white rounded-[2.5rem] shadow-2xl border border-[#E5E7EB] overflow-hidden z-20 flex flex-col max-h-[90vh] transition-all duration-300",
                  clientModalTab === 'storico' ? "max-w-5xl" : "max-w-3xl"
                )}
              >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center text-[#5A5A40]">
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-serif font-black text-[#111827] truncate max-w-[280px] sm:max-w-[360px]">
                          {selectedDetailClient.name}
                        </h3>
                        <span className="text-[9px] bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-md font-mono font-bold">
                          COD: {selectedDetailClient.code || String(selectedDetailClient.id).padStart(4, '0')}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Anagrafica Collegata
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Tab Switcher */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
                      <button 
                        onClick={() => setClientModalTab('panoramica')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                          clientModalTab === 'panoramica'
                            ? "bg-white text-[#5A5A40] shadow-xs"
                            : "text-gray-500 hover:text-gray-900"
                        )}
                      >
                        <FileText size={13} />
                        <span>Panoramica Danea</span>
                      </button>
                      <button 
                        onClick={() => setClientModalTab('storico')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                          clientModalTab === 'storico'
                            ? "bg-white text-[#5A5A40] shadow-xs"
                            : "text-gray-500 hover:text-gray-900"
                        )}
                      >
                        <BarChart3 size={13} />
                        <span>Storico & Insight</span>
                        <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.2 rounded-full font-mono font-bold">
                          {clientStats.count}
                        </span>
                      </button>
                    </div>

                    <button 
                      onClick={() => setIsClientDetailOpen(false)} 
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer text-gray-500"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Body (Scrollable) */}
                {clientModalTab === 'storico' ? (
                  <div className="p-6 overflow-y-auto overscroll-contain max-h-[calc(90dvh-80px)]">
                    <ClientSalesHistory 
                      clientId={selectedDetailClient.id} 
                      clientName={selectedDetailClient.name} 
                      isAdmin={true} 
                    />
                  </div>
                ) : (
                  <div className="p-6 overflow-y-auto overscroll-contain space-y-6">
                    {/* Banner to Switch to Full History */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-[#5A5A40]/10 via-[#5A5A40]/5 to-transparent rounded-2xl border border-[#5A5A40]/15">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center shrink-0">
                          <BarChart3 size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-900">Analisi Approfondita Consumi & Riordini</h4>
                          <p className="text-[11px] text-gray-500">Consulta trend d'acquisto, scorte, riordini stimati e storico riga per riga</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setClientModalTab('storico')}
                        className="px-3 py-1.5 bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                      >
                        <span>Apri Storico</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {/* KPI Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 bg-[#5A5A40]/5 rounded-2xl border border-[#5A5A40]/10 text-center">
                      <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Fatturato</span>
                      <span className="text-sm font-black text-[#5A5A40] font-mono mt-1 block">
                        € {clientStats.totalSpent.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-center">
                      <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Contratti</span>
                      <span className="text-sm font-black text-emerald-800 font-mono mt-1 block">
                        {clientStats.count} ordini
                      </span>
                    </div>
                    <div className="p-4 bg-indigo-50/35 rounded-2xl border border-indigo-100 text-center">
                      <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Ticket Medio</span>
                      <span className="text-sm font-black text-indigo-950 font-mono mt-1 block">
                        € {clientStats.aov.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Split Content: Registry info & Preferences */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Customer Registry Details */}
                    <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100 space-y-3 text-xs">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                        <FileText size={13} className="text-[#5A5A40]" />
                        Dati di Contatto & Sede
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-400 font-semibold uppercase text-[9px] block">Referente</span>
                          <span className="font-bold text-gray-800">{selectedDetailClient.contact || 'N/D'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-400 font-semibold uppercase text-[9px] block">Telefono</span>
                            <span className="font-bold text-gray-800 font-mono">{selectedDetailClient.phone || 'N/D'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 font-semibold uppercase text-[9px] block">Città</span>
                            <span className="font-bold text-[#5A5A40]">{selectedDetailClient.city || 'N/D'}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold uppercase text-[9px] block">Email principale</span>
                          <a href={`mailto:${selectedDetailClient.email}`} className="font-bold text-blue-600 hover:underline break-all block">
                            {selectedDetailClient.email || 'N/D'}
                          </a>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold uppercase text-[9px] block">Pagamento Preferito</span>
                          <span className="font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[11px] inline-block mt-0.5">
                            {clientStats.topPayment}
                          </span>
                        </div>
                        {rawNotes && (
                          <div>
                            <span className="text-gray-400 font-semibold uppercase text-[9px] block">Note in Anagrafica</span>
                            <p className="text-[11px] text-gray-500 italic leading-relaxed font-medium mt-0.5 whitespace-pre-line">
                              "{rawNotes}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Top Products Purchased */}
                    <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100 space-y-3 text-xs flex flex-col justify-between">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                          <Package size={13} className="text-emerald-600" />
                          Prodotti più Acquistati
                        </h4>
                        
                        {clientStats.topProducts.length === 0 ? (
                          <div className="py-12 text-center text-gray-400 font-bold">
                            Nessun acquisto registrato per questo cliente.
                          </div>
                        ) : (
                          <div className="space-y-3 mt-2">
                            {clientStats.topProducts.map((p) => {
                              const maxQty = Math.max(...clientStats.topProducts.map(tp => tp.qty), 1);
                              const pct = (p.qty / maxQty) * 100;
                              return (
                                <div key={p.code} className="space-y-1">
                                  <div className="flex justify-between text-[11px] font-bold">
                                    <span className="text-gray-700 truncate max-w-[150px]" title={p.description}>{p.description}</span>
                                    <span className="text-[#5A5A40] font-mono">{p.qty} pz</span>
                                  </div>
                                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-emerald-500 h-full rounded-full" 
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-100/30 text-[10px] flex items-center gap-2 mt-4">
                        <Check size={14} className="shrink-0 text-emerald-600" />
                        <span className="font-bold">Aggregazione automatica da storico fatture XML</span>
                      </div>
                    </div>
                  </div>

                  {/* DANEA EASYFATT SYNCHRONIZED METADATA (Collapsible Accordion) */}
                  {hasDaneaData && (
                    <div className="bg-amber-50/20 border border-amber-900/10 rounded-[1.75rem] overflow-hidden transition-all">
                      <button
                        type="button"
                        onClick={() => setIsDaneaDataOpen(!isDaneaDataOpen)}
                        className="w-full p-5 flex items-center justify-between text-left hover:bg-amber-50/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-amber-900/10 rounded-xl flex items-center justify-center text-amber-900 shrink-0">
                            <Lock size={15} />
                          </div>
                          <div>
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                              <span>Campi Anagrafica Danea Easyfatt</span>
                              <span className="text-[8px] bg-amber-900/10 text-amber-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Sola Lettura
                              </span>
                            </h4>
                            <p className="text-[10px] text-amber-900/60 font-semibold mt-0.5">
                              Sincronizzato da tracciato XML — Clicca per {isDaneaDataOpen ? 'comprimere' : 'espandere dati fiscali e condizioni'}
                            </p>
                          </div>
                        </div>
                        <ChevronDown size={18} className={cn("text-amber-900/70 transition-transform duration-200", isDaneaDataOpen && "rotate-180")} />
                      </button>

                      {isDaneaDataOpen && (
                        <div className="p-5 pt-0 border-t border-amber-900/5 space-y-4 animate-fadeIn">
                          {/* Structured Grid Layout for Easyfatt Data */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-3">
                            {/* 1. Dati Fiscali */}
                            <div className="p-3 bg-white rounded-xl border border-gray-150/70 space-y-2.5 shadow-2xs">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-1.5 flex items-center gap-1">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Fisco & Invoicing
                              </h5>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-gray-400 font-semibold uppercase text-[8px] block">Partita IVA</span>
                                  <div className="flex items-center justify-between gap-1 mt-0.5">
                                    <span className="font-bold text-gray-800 font-mono text-[11px]">{daneaData['Partita Iva'] || 'N/D'}</span>
                                    {daneaData['Partita Iva'] && (
                                      <button
                                        onClick={() => copyToClipboard(daneaData['Partita Iva'], 'piva')}
                                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                        title="Copia Partita IVA"
                                      >
                                        {copiedText === 'piva' ? <Check size={11} className="text-emerald-600" /> : <FileText size={11} />}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-400 font-semibold uppercase text-[8px] block">Codice Fiscale</span>
                                  <div className="flex items-center justify-between gap-1 mt-0.5">
                                    <span className="font-bold text-gray-800 font-mono text-[11px]">{daneaData['Codice fiscale'] || 'N/D'}</span>
                                    {daneaData['Codice fiscale'] && (
                                      <button
                                        onClick={() => copyToClipboard(daneaData['Codice fiscale'], 'cf')}
                                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                        title="Copia Codice Fiscale"
                                      >
                                        {copiedText === 'cf' ? <Check size={11} className="text-emerald-600" /> : <FileText size={11} />}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-400 font-semibold uppercase text-[8px] block">Codice SDI</span>
                                  <div className="flex items-center justify-between gap-1 mt-0.5">
                                    <span className={cn(
                                      "font-bold font-mono text-[11px] px-1.5 py-0.5 rounded",
                                      daneaData['Cod. destinatario Fatt. elettr.'] ? "bg-amber-500/10 text-amber-950" : "text-gray-400"
                                    )}>
                                      {daneaData['Cod. destinatario Fatt. elettr.'] || 'N/D'}
                                    </span>
                                    {daneaData['Cod. destinatario Fatt. elettr.'] && (
                                      <button
                                        onClick={() => copyToClipboard(daneaData['Cod. destinatario Fatt. elettr.'], 'sdi')}
                                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                        title="Copia Codice SDI"
                                      >
                                        {copiedText === 'sdi' ? <Check size={11} className="text-emerald-600" /> : <FileText size={11} />}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {daneaData['Pec'] && (
                                  <div>
                                    <span className="text-gray-400 font-semibold uppercase text-[8px] block">Indirizzo PEC</span>
                                    <div className="flex items-center justify-between gap-1 mt-0.5">
                                      <span className="font-bold text-gray-800 font-mono text-[10px] truncate max-w-[120px]" title={daneaData['Pec']}>{daneaData['Pec']}</span>
                                      <button
                                        onClick={() => copyToClipboard(daneaData['Pec'], 'pec')}
                                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                        title="Copia PEC"
                                      >
                                        {copiedText === 'pec' ? <Check size={11} className="text-emerald-600" /> : <FileText size={11} />}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 2. Sede & Spedizione */}
                            <div className="p-3 bg-white rounded-xl border border-gray-150/70 space-y-2.5 shadow-2xs">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-1.5 flex items-center gap-1">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Sede & Spedizione
                              </h5>
                              <div className="space-y-2">
                                {daneaData['Indirizzo'] && (
                                  <div>
                                    <span className="text-gray-400 font-semibold uppercase text-[8px] block">Indirizzo</span>
                                    <span className="font-bold text-gray-800 block mt-0.5 leading-tight">{daneaData['Indirizzo']}</span>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                  {daneaData['Cap'] && (
                                    <div>
                                      <span className="text-gray-400 font-semibold uppercase text-[8px] block">C.A.P.</span>
                                      <span className="font-bold text-gray-800 font-mono">{daneaData['Cap']}</span>
                                    </div>
                                  )}
                                  {daneaData['Prov.'] && (
                                    <div>
                                      <span className="text-gray-400 font-semibold uppercase text-[8px] block">Provincia</span>
                                      <span className="font-bold text-gray-800 font-mono">{daneaData['Prov.']}</span>
                                    </div>
                                  )}
                                </div>
                                {daneaData['Regione'] && (
                                  <div>
                                    <span className="text-gray-400 font-semibold uppercase text-[8px] block">Regione</span>
                                    <span className="font-bold text-gray-800">{daneaData['Regione']}</span>
                                  </div>
                                )}
                                {daneaData['Nazione'] && daneaData['Nazione'] !== 'Italia' && (
                                  <div>
                                    <span className="text-gray-400 font-semibold uppercase text-[8px] block">Nazione</span>
                                    <span className="font-bold text-gray-800">{daneaData['Nazione']}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 3. Condizioni Commerciali */}
                            <div className="p-3 bg-white rounded-xl border border-gray-150/70 space-y-2.5 shadow-2xs">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-1.5 flex items-center gap-1">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                Condizioni Vendita
                              </h5>
                              <div className="space-y-2">
                                {daneaData['Listino'] && (
                                  <div>
                                    <span className="text-gray-400 font-semibold uppercase text-[8px] block">Listino Associato</span>
                                    <span className="font-bold text-[#5A5A40] bg-[#5A5A40]/5 px-1.5 py-0.5 rounded text-[10px] inline-block mt-0.5">
                                      {daneaData['Listino']}
                                    </span>
                                  </div>
                                )}
                                {daneaData['Sconti'] && (
                                  <div>
                                    <span className="text-gray-400 font-semibold uppercase text-[8px] block">Sconti Riservati</span>
                                    <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] inline-block font-mono mt-0.5">
                                      {daneaData['Sconti']}
                                    </span>
                                  </div>
                                )}
                                {daneaData['Fido'] && (
                                  <div>
                                    <span className="text-gray-400 font-semibold uppercase text-[8px] block">Fido Accordato</span>
                                    <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] inline-block font-mono mt-0.5">
                                      {daneaData['Fido']}
                                    </span>
                                  </div>
                                )}
                                {daneaData['Agente'] && (
                                  <div>
                                    <span className="text-gray-400 font-semibold uppercase text-[8px] block">Agente Associato</span>
                                    <span className="font-bold text-gray-800 block mt-0.5 truncate">{daneaData['Agente']}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Payment & Invoicing Details block if exist */}
                          {(daneaData['Pagamento'] || daneaData['Banca'] || daneaData['Note doc.']) && (
                            <div className="p-3.5 bg-white/60 rounded-xl border border-amber-900/5 space-y-2 text-[11px] text-gray-700">
                              <span className="text-gray-400 font-bold uppercase text-[8px] tracking-wider block">Modalità Pagamento & Note Interne</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                                {daneaData['Pagamento'] && (
                                  <div>
                                    <strong className="text-gray-500">Pagamento:</strong> <span className="font-semibold text-gray-800">{daneaData['Pagamento']}</span>
                                  </div>
                                )}
                                {daneaData['Banca'] && (
                                  <div>
                                    <strong className="text-gray-500">Banca d'Appoggio:</strong> <span className="font-semibold text-gray-800">{daneaData['Banca']}</span>
                                  </div>
                                )}
                                {daneaData['Note doc.'] && (
                                  <div className="sm:col-span-2 italic text-gray-500 border-t border-amber-900/5 pt-1.5 mt-1">
                                    <strong className="text-gray-400 not-italic font-black uppercase text-[8px]">Nota per Documenti:</strong> "{daneaData['Note doc.']}"
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Client Order History */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <ShoppingCart size={13} className="text-indigo-600" />
                      Storico Contratti e Ordini ({clientStats.clientOrders.length})
                    </h4>
                    
                    {clientStats.clientOrders.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400 font-semibold">
                        Nessun ordine inserito per questo cliente.
                      </div>
                    ) : (
                      <div className="border border-gray-100 rounded-2xl overflow-hidden overflow-x-auto font-sans">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
                            <tr>
                              <th className="py-2.5 px-3">ID / Numero</th>
                              <th className="py-2.5 px-3">Data</th>
                              <th className="py-2.5 px-3">Pagamento</th>
                              <th className="py-2.5 px-3">Totale</th>
                              <th className="py-2.5 px-3">Stato</th>
                              <th className="py-2.5 px-3 text-right">Azioni</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium">
                            {clientStats.clientOrders.map((order) => (
                              <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
                                <td className="py-3 px-3 font-mono font-bold text-gray-900">
                                  #{order.number || order.id}
                                </td>
                                <td className="py-3 px-3 text-gray-500 font-mono">
                                  {order.date}
                                </td>
                                <td className="py-3 px-3 text-gray-500 truncate max-w-[120px]" title={order.payment_name}>
                                  {order.payment_name}
                                </td>
                                <td className="py-3 px-3 font-mono font-bold text-[#5A5A40]">
                                  € {order.total.toFixed(2)}
                                </td>
                                <td className="py-3 px-3">
                                  <span className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                    order.status === 'Esportato' 
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                      : "bg-gray-50 text-gray-500 border-gray-100"
                                  )}>
                                    {order.status === 'Esportato' ? 'Inviato' : 'Bozza'}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <button
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setIsOrderDetailOpen(true);
                                      setIsClientDetailOpen(false);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-[#5A5A40]/10 text-gray-700 hover:text-[#5A5A40] rounded-lg font-black transition-all text-[10px] cursor-pointer"
                                  >
                                    <Eye size={11} />
                                    Vedi
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Client Payment Installments & Cashflow Aggregation */}
                  {(() => {
                    const todayDateStr = new Date().toISOString().substring(0, 10);
                    const currentYearMonth = todayDateStr.substring(0, 7);

                    const allInstallments = clientStats.sortedAllInstallments || [];
                    const pastInstallmentsCount = allInstallments.filter((inst: any) => inst.date < todayDateStr).length;

                    const displayInstallments = allInstallments.filter((inst: any) => {
                      if (hidePastDeadlines) {
                        return inst.date >= todayDateStr;
                      }
                      return true;
                    });

                    const displayMonthlyPayments = (clientStats.sortedMonthlyPayments || []).map((gp: any) => {
                      if (!hidePastDeadlines) return gp;
                      const filteredInsts = gp.installments.filter((inst: any) => inst.date >= todayDateStr);
                      const total = filteredInsts.reduce((sum: number, item: any) => sum + item.amount, 0);
                      return { ...gp, total, installments: filteredInsts };
                    }).filter((gp: any) => {
                      if (!hidePastDeadlines) return true;
                      return gp.month >= currentYearMonth && gp.installments.length > 0;
                    });

                    return (
                      <div className="space-y-4 pt-2 border-t border-gray-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                              <Calendar size={13} className="text-[#5A5A40]" />
                              Pianificazione Scadenze e Rate di Pagamento
                            </h4>
                            {pastInstallmentsCount > 0 && hidePastDeadlines && (
                              <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200/60">
                                {pastInstallmentsCount} passate nascoste
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setHidePastDeadlines(!hidePastDeadlines)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold transition-all border cursor-pointer select-none shrink-0",
                              hidePastDeadlines
                                ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs hover:bg-[#4E4E37]"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                            )}
                          >
                            <Filter size={12} className={hidePastDeadlines ? "text-white" : "text-gray-400"} />
                            <span>{hidePastDeadlines ? "Mostra anche passate" : "Nascondi scadenze passate"}</span>
                          </button>
                        </div>

                        {allInstallments.length === 0 ? (
                          <div className="p-6 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400 font-semibold">
                            Nessuna scadenza pianificata per questo cliente.
                          </div>
                        ) : displayInstallments.length === 0 ? (
                          <div className="p-6 text-center border border-dashed border-amber-200 bg-amber-50/30 rounded-2xl text-xs space-y-2">
                            <p className="text-amber-900 font-bold">
                              Tutte le scadenze pianificate per questo cliente ({pastInstallmentsCount}) sono antecedenti alla data odierna.
                            </p>
                            <button
                              type="button"
                              onClick={() => setHidePastDeadlines(false)}
                              className="px-3 py-1.5 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Mostra scadenze passate
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Monthly Aggregation Card */}
                            <div className="bg-[#F9FAFB] rounded-2xl border border-gray-150/70 p-4 space-y-3">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1 border-b border-gray-100 pb-2">
                                <Activity size={12} className="text-emerald-600" />
                                Aggregazione Mensile Flussi
                              </h5>
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {displayMonthlyPayments.map((gp: any) => {
                                  const [year, month] = gp.month.split('-');
                                  const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
                                  return (
                                    <div key={gp.month} className="bg-white p-3 rounded-xl border border-gray-150/70 shadow-2xs flex flex-col space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-gray-800 capitalize text-xs">
                                          {monthName}
                                        </span>
                                        <span className="font-mono font-bold text-emerald-700 text-xs">
                                          € {gp.total.toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pt-1.5 border-t border-gray-50">
                                        {gp.installments.map((inst: any, idx: number) => (
                                          <span key={idx} className="text-[9px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded-md font-mono border border-gray-100">
                                            Ord. #{inst.orderNumber}: €{inst.amount.toFixed(2)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Detailed Installments Timeline */}
                            <div className="bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] p-4 space-y-3">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1 border-b border-gray-100 pb-2">
                                <Clock size={12} className="text-amber-600" />
                                Scadenze Cronologiche ({displayInstallments.length})
                              </h5>
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 font-mono text-[11px]">
                                {displayInstallments.map((inst: any, idx: number) => {
                                  const isOverdue = new Date(inst.date) < new Date();
                                  return (
                                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-gray-150/70 shadow-2xs flex items-center justify-between">
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-black text-gray-900 text-xs">
                                            {new Date(inst.date).toLocaleDateString('it-IT')}
                                          </span>
                                          {isOverdue && (
                                            <span className="text-[8px] bg-rose-50 text-rose-600 px-1.5 py-0.2 rounded border border-rose-100 font-bold uppercase tracking-wider">
                                              Scaduto
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[9px] text-gray-400 font-sans font-semibold truncate max-w-[150px]" title={inst.paymentName}>
                                          Ord. #{inst.orderNumber} • {inst.paymentName}
                                        </div>
                                      </div>
                                      <div className="font-bold text-[#5A5A40]">
                                        € {inst.amount.toFixed(2)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                )}
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* 2. SLIDE-OUT DETAIL DRAWER (Product Technical Sheet) */}
      <AnimatePresence>
        {selectedDetailProduct && (
          <div 
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex justify-end"
            onClick={() => setSelectedDetailProduct(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] font-black px-2.5 py-0.5 rounded-lg border border-[#5A5A40]/20">
                      {selectedDetailProduct.code}
                    </span>
                    {selectedDetailProduct.barcode && (
                      <span className="font-mono text-[10px] text-gray-400 font-medium">
                        EAN: {selectedDetailProduct.barcode}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-serif font-black text-[#111827]">
                    Scheda Prodotto Dettagliata
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDetailProduct(null)}
                  className="p-2.5 hover:bg-gray-200 text-gray-500 rounded-full transition-all border border-transparent hover:border-gray-300 cursor-pointer"
                  title="Chiudi scheda (o premi ESC)"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Hero Product View & Quick Order Control */}
                <div className="bg-[#F8F9FA] rounded-2xl border border-gray-100 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                    <div className="w-40 h-40 bg-white rounded-2xl border border-gray-200 p-2 overflow-hidden flex items-center justify-center shrink-0 relative shadow-xs">
                      {selectedDetailProduct.image_file_name ? (
                        <img
                          src={`/uploads/${encodeURIComponent(selectedDetailProduct.image_file_name.trim())}`}
                          alt={selectedDetailProduct.description}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.style.display = 'none';
                            const placeholderEl = e.currentTarget.nextSibling as HTMLDivElement;
                            if (placeholderEl) {
                              placeholderEl.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center bg-[#F3F4F6] text-gray-400 gap-1"
                        style={{ display: selectedDetailProduct.image_file_name ? 'none' : 'flex' }}
                      >
                        <ImageIcon size={36} className="stroke-1 text-[#C4C4A0]" />
                        <span className="text-[9px] uppercase font-bold text-gray-400">Nessuna Foto</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <span className="text-[10px] text-[#5A5A40] font-black uppercase tracking-widest bg-[#5A5A40]/10 px-2.5 py-0.5 rounded-full border border-[#5A5A40]/10 inline-block">
                        {selectedDetailProduct.category || "Generico"}
                        {selectedDetailProduct.subcategory ? ` › ${selectedDetailProduct.subcategory}` : ""}
                      </span>
                      <h4 className="text-lg font-bold font-serif text-[#111827] leading-snug">
                        {selectedDetailProduct.description}
                      </h4>

                      <div className="pt-2 flex items-center justify-center sm:justify-start gap-4">
                        <div>
                          <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Prezzo Listino</div>
                          <div className="text-2xl font-serif font-black text-[#5A5A40]">
                            € {Number(selectedDetailProduct.price).toFixed(2)}
                          </div>
                        </div>

                        <div className="border-l border-gray-200 pl-4">
                          <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Disponibilità</div>
                          <div className={cn(
                            "text-lg font-mono font-black",
                            Number(selectedDetailProduct.stock) <= 0 ? "text-rose-600" : "text-gray-900"
                          )}>
                            {selectedDetailProduct.stock} <span className="text-xs uppercase">{selectedDetailProduct.um || 'pz'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Drawer Direct Order Stepper Box */}
                  <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-gray-600">
                      {getItemQtyInCart(selectedDetailProduct.code) > 0 ? (
                        <span className="text-emerald-700 font-black flex items-center gap-1">
                          <CheckCircle2 size={14} /> In ordine: {getItemQtyInCart(selectedDetailProduct.code)} {selectedDetailProduct.um || 'pz'}
                        </span>
                      ) : (
                        <span>Aggiungi direttamente all'ordine:</span>
                      )}
                    </div>

                    {getItemQtyInCart(selectedDetailProduct.code) > 0 ? (
                      <div className="flex items-center bg-emerald-600 text-white rounded-xl shadow-xs overflow-hidden border border-emerald-700">
                        <button
                          onClick={() => handleUpdateItemQty(selectedDetailProduct.code, getItemQtyInCart(selectedDetailProduct.code) - 1)}
                          className="px-3 py-2 hover:bg-emerald-700 active:bg-emerald-800 transition-colors font-black text-sm cursor-pointer"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="px-4 text-sm font-black font-mono bg-emerald-700/50 py-2 min-w-[36px] text-center">
                          {getItemQtyInCart(selectedDetailProduct.code)}
                        </span>
                        <button
                          onClick={() => {
                            handleUpdateItemQty(selectedDetailProduct.code, getItemQtyInCart(selectedDetailProduct.code) + 1);
                          }}
                          className="px-3 py-2 hover:bg-emerald-700 active:bg-emerald-800 transition-colors font-black text-sm cursor-pointer"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          handleAddProductToOrder(selectedDetailProduct, 1);
                        }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95",
                          Number(selectedDetailProduct.stock) <= 0
                            ? "bg-amber-600 text-white hover:bg-amber-700"
                            : "bg-[#5A5A40] text-white hover:bg-[#4E4E37]"
                        )}
                      >
                        {Number(selectedDetailProduct.stock) <= 0 ? (
                          <>
                            <Clock size={15} />
                            <span>Aggiungi in Pre-ordine</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={15} />
                            <span>Aggiungi all'Ordine</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* 1. Descrizione e Note Dettagliate Prodotto */}
                {(selectedDetailProduct.notes || selectedDetailProduct.description_html) && (
                  <div className="bg-white rounded-2xl border border-gray-200/80 p-5 space-y-3 shadow-2xs">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] border-b border-gray-100 pb-2 flex items-center gap-1.5">
                      <FileText size={13} className="text-[#5A5A40]" />
                      <span>Descrizione Dettagliata & Note Prodotto</span>
                    </h5>
                    {selectedDetailProduct.notes && (
                      <div className="text-xs text-gray-800 leading-relaxed font-medium bg-[#F8F9FA] p-3.5 rounded-xl border border-gray-200/60 whitespace-pre-line">
                        {selectedDetailProduct.notes}
                      </div>
                    )}
                    {selectedDetailProduct.description_html && (
                      <div className="pt-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Formattazione HTML Estesa</div>
                        <div 
                          className="text-xs text-gray-600 prose prose-sm max-w-none leading-relaxed bg-[#F8F9FA] p-3.5 rounded-xl border border-gray-200/60"
                          dangerouslySetInnerHTML={{ __html: selectedDetailProduct.description_html }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Specs Grid - Collapsible Accordion (CLOSED by default) */}
                <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-2xs transition-all">
                  <button
                    type="button"
                    onClick={() => setIsWarehouseInfoOpen(!isWarehouseInfoOpen)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center text-[#5A5A40] shrink-0">
                        <Package size={16} />
                      </div>
                      <div>
                        <h5 className="text-[11px] font-black uppercase tracking-widest text-[#5A5A40]">
                          Specifiche Logistiche & Magazzino
                        </h5>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {isWarehouseInfoOpen ? 'Clicca per comprimere' : 'Clicca per consultare ubicazione, scorte e peso'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {isWarehouseInfoOpen ? 'Aperto' : 'Chiuso'}
                      </span>
                      <ChevronDown size={18} className={cn("text-gray-400 transition-transform duration-200", isWarehouseInfoOpen && "rotate-180")} />
                    </div>
                  </button>

                  {isWarehouseInfoOpen && (
                    <div className="p-5 pt-2 border-t border-gray-100 space-y-4 bg-[#FAFBFB]">
                      <div className="grid grid-cols-2 gap-y-3.5 gap-x-6 text-xs">
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Ubicazione Magazzino</div>
                          <div className="font-medium text-gray-800">{selectedDetailProduct.warehouse_location || "Non specificata"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Scorta Minima</div>
                          <div className="font-medium text-gray-800">{selectedDetailProduct.min_stock ?? 0.0} {selectedDetailProduct.um}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Quantità in Arrivo</div>
                          <div className="font-medium text-gray-800">{selectedDetailProduct.ordered_qty ?? 0.0} {selectedDetailProduct.um}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Aliquota IVA / Codice</div>
                          <div className="font-mono font-bold text-gray-800">{selectedDetailProduct.vat_code}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Peso Netto / Lordo</div>
                          <div className="font-medium text-gray-800">
                            {selectedDetailProduct.net_weight ?? 0} / {selectedDetailProduct.gross_weight ?? 0} {selectedDetailProduct.weight_um || 'kg'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Produttore</div>
                          <div className="font-medium text-gray-800">{selectedDetailProduct.producer_name || "-"}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Custom Fields (Easyfatt) */}
                {(selectedDetailProduct.custom_field1 || selectedDetailProduct.custom_field2 || selectedDetailProduct.custom_field3 || selectedDetailProduct.custom_field4) && (
                  <div className="bg-[#F8F9FA] rounded-2xl border border-gray-100 p-5 space-y-3">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] border-b border-gray-200 pb-2">Campi Personalizzati</h5>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {selectedDetailProduct.custom_field1 && (
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Campo 1</div>
                          <div className="font-bold text-gray-800 mt-0.5">{selectedDetailProduct.custom_field1}</div>
                        </div>
                      )}
                      {selectedDetailProduct.custom_field2 && (
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Campo 2</div>
                          <div className="font-bold text-gray-800 mt-0.5">{selectedDetailProduct.custom_field2}</div>
                        </div>
                      )}
                      {selectedDetailProduct.custom_field3 && (
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Campo 3</div>
                          <div className="font-bold text-gray-800 mt-0.5">{selectedDetailProduct.custom_field3}</div>
                        </div>
                      )}
                      {selectedDetailProduct.custom_field4 && (
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Campo 4</div>
                          <div className="font-bold text-gray-800 mt-0.5">{selectedDetailProduct.custom_field4}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* External Link */}
                {selectedDetailProduct.link && selectedDetailProduct.link.trim() !== '' && (
                  <div className="pt-2">
                    <a
                      href={selectedDetailProduct.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-xl border border-blue-200 flex items-center justify-center gap-2 transition-colors"
                    >
                      <ExternalLink size={15} />
                      <span>Apri Link Scheda Prodotto Esterna</span>
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. STICKY ORDER DRAWER (Carrello Sempre A Portata di Mano) */}
      <AnimatePresence>
        {(orderForm.items.length > 0 || isCreatingOrder) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-[760px] z-[90] bg-[#111827]/95 text-white backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3"
          >
            {/* Left: Client Selection Indicator */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {orderForm.client_id ? (
                <button
                  onClick={() => setIsStickyCartOpen(true)}
                  className="flex items-center gap-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-bold transition-all truncate max-w-[220px] cursor-pointer"
                  title="Clicca per modificare cliente o completare l'ordine"
                >
                  <Users size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {clients.find(c => String(c.id) === String(orderForm.client_id))?.name || 'Cliente Selezionato'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setIsStickyCartOpen(true)}
                  className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all animate-pulse cursor-pointer"
                  title="Seleziona un cliente per l'ordine"
                >
                  <AlertCircle size={14} className="text-amber-400 shrink-0" />
                  <span>Seleziona Cliente!</span>
                </button>
              )}
            </div>

            {/* Middle: Live Order Summary */}
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setIsStickyCartOpen(true)}
              title="Apri dettaglio carrello"
            >
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/30 shrink-0 group-hover:scale-105 transition-transform">
                <ShoppingCart size={20} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-300">
                  <span className="text-white font-black">{orderForm.items.reduce((s, i) => s + i.qty, 0)} pz</span> in {orderForm.items.length} articoli
                </div>
                <div className="text-sm font-serif font-black text-emerald-400">
                  € {orderForm.items.reduce((s, i) => s + (i.qty * i.price), 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Right: Primary Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <button
                onClick={() => setIsStickyCartOpen(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Eye size={14} />
                <span>Vedi Ordine ({orderForm.items.length})</span>
              </button>

              <button
                onClick={() => handleOrderSubmit('Nuovo')}
                disabled={!orderForm.client_id || orderForm.items.length === 0}
                className="px-3.5 py-2 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={!orderForm.client_id ? "Seleziona prima un cliente per inviare" : "Invia ordine alla sede"}
              >
                <Save size={14} />
                <span>Invia</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelOrderCreation();
                }}
                className="p-2 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                title="Svuota carrello"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. EXPANDED CHECKOUT & CART SHEET */}
      <AnimatePresence>
        {isStickyCartOpen && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-gray-200 w-full max-w-3xl max-h-[90dvh] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center text-[#5A5A40]">
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-black text-[#111827]">Riepilogo Ordine & Checkout</h3>
                    <p className="text-xs text-gray-500 font-medium">Gestione articoli, selezione cliente e invio ordine</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsStickyCartOpen(false)}
                  className="p-2.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
                {/* Client Selection Section */}
                <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-gray-200 space-y-3">
                  <label className="text-xs font-black uppercase text-[#5A5A40] flex items-center gap-1.5">
                    <Users size={15} />
                    <span>Seleziona Cliente per l'Ordine *</span>
                  </label>

                  <select
                    value={orderForm.client_id || ''}
                    onChange={(e) => {
                      const selectedClientId = e.target.value;
                      const selectedClientObj = clients.find(c => String(c.id) === String(selectedClientId));
                      let newPayment = orderForm.payment_name;
                      if (selectedClientObj?.notes) {
                        const { daneaData } = parseClientNotes(selectedClientObj.notes);
                        if (daneaData['Pagamento']) {
                          const clientPm = daneaData['Pagamento'];
                          const found = paymentMethods.find(p => p.name === clientPm || p.name.toLowerCase() === clientPm.toLowerCase());
                          if (found) newPayment = found.name;
                          else if (clientPm) newPayment = clientPm;
                        }
                      }
                      setOrderForm(prev => ({ ...prev, client_id: selectedClientId, payment_name: newPayment }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 shadow-2xs cursor-pointer"
                  >
                    <option value="">-- Nessun cliente selezionato --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code || 'Senza codice'}) - {c.city || 'Città n.d.'}
                      </option>
                    ))}
                  </select>

                  {orderForm.client_id && (
                    <div className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60 flex items-center gap-1.5">
                      <CheckCircle2 size={13} />
                      <span>Cliente collegato all'ordine corrente</span>
                    </div>
                  )}
                </div>

                {/* Items List in Order */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <h4 className="text-xs font-black uppercase text-gray-700 flex items-center gap-1.5">
                      <Package size={15} className="text-[#5A5A40]" />
                      <span>Articoli in Carrello ({orderForm.items.length})</span>
                    </h4>
                    {orderForm.items.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelOrderCreation();
                        }}
                        className="text-[11px] text-rose-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        title="Svuota l'intero carrello"
                      >
                        <Trash2 size={12} /> Svuota
                      </button>
                    )}
                  </div>

                  {orderForm.items.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <ShoppingCart size={32} className="mx-auto text-gray-300 mb-2 stroke-1" />
                      <p className="text-xs font-bold text-gray-500">Il carrello dell'ordine è vuoto</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Aggiungi prodotti direttamente dal catalogo con un semplice click.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                      {orderForm.items.map((item, idx) => (
                        <div
                          key={`${item.product_code}-${idx}`}
                          className="bg-white p-3 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs hover:border-gray-300 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[9px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100">
                                {item.product_code}
                              </span>
                              <span className="text-xs font-black text-gray-900 truncate">
                                {item.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {item.price < 0 ? (
                                <span className="text-[9px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200">
                                  Detrazione
                                </span>
                              ) : null}
                              <span className="text-[10px] text-gray-400 font-medium">Prezzo unit.:</span>
                              <div className="w-24">
                                <EditableAmountInput
                                  value={item.price}
                                  onChange={(newPrice) => handleUpdateItemPrice(item.product_code, newPrice, idx)}
                                  prefix="€"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 pt-2 sm:pt-0">
                            {/* Stepper */}
                            <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateItemQty(item.product_code, item.qty - 1, idx);
                                }}
                                className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 font-black text-xs transition-colors cursor-pointer"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="px-3 text-xs font-black font-mono bg-white py-1 text-center min-w-[28px]">
                                {item.qty}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateItemQty(item.product_code, item.qty + 1, idx);
                                }}
                                className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 font-black text-xs transition-colors cursor-pointer"
                              >
                                <Plus size={12} />
                              </button>
                            </div>

                            {/* Item total editable */}
                            <div className="text-right w-28">
                              <EditableAmountInput
                                value={Math.round(item.qty * item.price * 100) / 100}
                                onChange={(newTotal) => handleUpdateItemTotal(item.product_code, newTotal, idx)}
                                prefix="€"
                                placeholder="0.00"
                              />
                            </div>

                            {/* Delete line */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveOrderItem(item.product_code, idx);
                              }}
                              className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer flex items-center justify-center"
                              title="Rimuovi articolo dall'ordine"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Modalità di Pagamento</label>
                    <select
                      value={orderForm.payment_name || ''}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, payment_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 cursor-pointer"
                    >
                      {paymentMethods.length > 0 ? (
                        paymentMethods.map((pm) => (
                          <option key={pm.id} value={pm.name}>
                            {pm.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Bonifico bancario">Bonifico bancario</option>
                          <option value="R.B. 30/60 gg F.M.">R.B. 30/60 gg F.M.</option>
                          <option value="Contanti">Contanti</option>
                          <option value="Carta di Credito">Carta di Credito</option>
                          <option value="Contrassegno">Contrassegno</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Note o Commenti per la Sede</label>
                    <input
                      type="text"
                      placeholder="E.g. Consegna urgente di mattina..."
                      value={orderForm.notes}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30"
                    />
                  </div>
                </div>

                {/* Financial Totals */}
                {orderForm.items.length > 0 && (() => {
                  const gross = orderForm.items.filter(i => i.price > 0).reduce((s, i) => s + (i.qty * i.price), 0);
                  const discounts = orderForm.items.filter(i => i.price < 0).reduce((s, i) => s + (i.qty * i.price), 0);
                  const imponibile = orderForm.items.reduce((s, i) => s + (i.qty * i.price), 0);
                  const vat = Math.max(0, imponibile * 0.22);
                  const total = imponibile + vat;

                  return (
                    <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-gray-200 space-y-2">
                      {discounts < 0 && (
                        <>
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Subtotale Lordo:</span>
                            <span className="font-mono font-bold">€ {gross.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-rose-600 font-medium">
                            <span>Sconti / Detrazioni:</span>
                            <span className="font-mono font-bold">- € {Math.abs(discounts).toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-xs text-gray-700 font-semibold">
                        <span>Totale Imponibile Netto:</span>
                        <span className={cn("font-mono font-bold", imponibile < 0 ? "text-rose-600" : "text-gray-900")}>
                          € {imponibile.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>IVA Stimata (22%):</span>
                        <span className="font-mono font-bold">€ {vat.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base font-serif font-black text-[#111827] border-t border-gray-200 pt-2">
                        <span>Totale Ordine Ivato:</span>
                        <span className={cn(total < 0 ? "text-rose-600" : "text-[#5A5A40]")}>
                          € {total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3 shrink-0">
                <button
                  onClick={() => setIsStickyCartOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Continua la navigazione
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleOrderSubmit('Bozza');
                      setIsStickyCartOpen(false);
                    }}
                    disabled={orderForm.items.length === 0}
                    className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Salva come Bozza
                  </button>

                  <button
                    onClick={() => {
                      handleOrderSubmit('Nuovo');
                      setIsStickyCartOpen(false);
                    }}
                    disabled={!orderForm.client_id || orderForm.items.length === 0}
                    className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer active:scale-95"
                  >
                    <Save size={15} />
                    <span>Invia Ordine Finale</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* XML Orders Import Result Modal */}
      <AnimatePresence>
        {isOrdersXmlModalOpen && ordersXmlLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-100 text-purple-700 rounded-2xl">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-black text-gray-900">
                      Esito Importazione XML Ordini Storici
                    </h3>
                    <p className="text-xs text-gray-500">
                      Report dettagliato dell'elaborazione del tracciato Danea Easyfatt.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOrdersXmlModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Summary KPIs */}
              <div className="p-6 bg-white border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-100 rounded-2xl text-center">
                  <div className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Ordini Importati</div>
                  <div className="text-xl font-mono font-black text-emerald-700 mt-1">{ordersXmlLogs.importedCount}</div>
                </div>

                <div className="p-3.5 bg-amber-50/80 border border-amber-100 rounded-2xl text-center">
                  <div className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Ordini Scartati</div>
                  <div className="text-xl font-mono font-black text-amber-700 mt-1">{ordersXmlLogs.skippedOrdersCount}</div>
                </div>

                <div className="p-3.5 bg-blue-50/80 border border-blue-100 rounded-2xl text-center">
                  <div className="text-[10px] font-black uppercase text-blue-800 tracking-wider">Righe Scartate</div>
                  <div className="text-xl font-mono font-black text-blue-700 mt-1">{ordersXmlLogs.skippedRowsCount}</div>
                </div>

                <div className="p-3.5 bg-purple-50/80 border border-purple-100 rounded-2xl text-center">
                  <div className="text-[10px] font-black uppercase text-purple-800 tracking-wider">Pagamenti Creati</div>
                  <div className="text-xl font-mono font-black text-purple-700 mt-1">{ordersXmlLogs.autoCreatedPaymentMethods}</div>
                </div>
              </div>

              {/* Scrollable Detailed Logs */}
              <div className="p-6 flex-1 overflow-y-auto space-y-2.5 max-h-[45vh] bg-gray-50/30">
                <div className="text-xs font-bold text-gray-700 mb-2 flex items-center justify-between">
                  <span>Log Dettagliati dell'operazione ({ordersXmlLogs.logs.length} messaggi):</span>
                </div>
                {ordersXmlLogs.logs.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nessun log registrato.</p>
                ) : (
                  ordersXmlLogs.logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-xl border text-xs leading-relaxed font-mono font-medium flex items-start gap-2.5",
                        log.level === 'success'
                          ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                          : log.level === 'warning'
                          ? "bg-amber-50/60 border-amber-200 text-amber-900"
                          : log.level === 'info'
                          ? "bg-purple-50/60 border-purple-200 text-purple-900"
                          : "bg-rose-50/60 border-rose-200 text-rose-900"
                      )}
                    >
                      <span className="shrink-0 mt-0.5">
                        {log.level === 'success' && <CheckSquare size={14} className="text-emerald-600" />}
                        {log.level === 'warning' && <AlertTriangle size={14} className="text-amber-600" />}
                        {log.level === 'info' && <Info size={14} className="text-purple-600" />}
                        {log.level === 'error' && <XCircle size={14} className="text-rose-600" />}
                      </span>
                      <span className="flex-1 break-words">{log.message}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex justify-end">
                <button
                  onClick={() => setIsOrdersXmlModalOpen(false)}
                  className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  Chiudi & Aggiorna Vista
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. LIGHTBOX OVERLAY FOR FULLSCREEN PRODUCT IMAGES */}
      <AnimatePresence>
        {lightboxImage && (
          <div
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer"
            onClick={() => setLightboxImage(null)}
          >
            <div
              className="relative max-w-4xl max-h-[85vh] flex flex-col items-center cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer"
                title="Chiudi ingrandimento"
              >
                <X size={24} />
              </button>
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                decoding="async"
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
              {lightboxImage.title && (
                <p className="mt-4 text-sm font-bold text-white/90 text-center bg-black/60 px-5 py-2.5 rounded-xl backdrop-blur-xs border border-white/10 max-w-2xl">
                  {lightboxImage.title}
                </p>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
