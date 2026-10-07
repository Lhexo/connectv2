import { Order, Client, Product, User } from '../types';

export interface PaymentDeadline {
  orderId: number;
  orderNumber: string | number;
  orderDate?: string;
  clientName: string;
  clientId?: number;
  agentName: string;
  date: string;
  amount: number;
  installmentIndex: number;
  totalInstallments: number;
  paymentName: string;
  isOverdue: boolean;
}

export interface ClientPortfolioItem {
  client: Client;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: string | null;
  daysSinceLastOrder?: number | null;
}

export interface ProductStatItem {
  code: string;
  description: string;
  qty: number;
  revenue: number;
  category?: string;
  stock?: number;
}

export interface CategoryStatItem {
  category: string;
  qty: number;
  revenue: number;
  percentage: number;
}

export interface PaymentStatItem {
  name: string;
  count: number;
  total: number;
  volume: number;
  percentage: number;
}

export interface CityStatItem {
  city: string;
  revenue: number;
  count: number;
}

export interface AgentLeaderboardItem {
  name: string;
  totalRevenue: number;
  ordersCount: number;
  activeClients: number;
  aov: number;
}

// Role checking helpers
export const isUserAdmin = (user?: any): boolean => {
  if (!user || !user.role) return false;
  const r = String(user.role).toLowerCase().trim();
  return r === 'admin' || r === 'amministratore' || r === 'administrator';
};

export const isUserCapoArea = (user?: any): boolean => {
  if (!user || !user.role) return false;
  const r = String(user.role).toLowerCase().trim();
  return r === 'capoarea' || r === 'capo_area' || r === 'area_manager';
};

export const isUserAgent = (user?: any): boolean => {
  return !isUserAdmin(user) && !isUserCapoArea(user);
};

// Normalize agent name for safe string comparisons
export const normalizeAgentName = (str?: string | null): string => {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Calculate payment installment deadlines for an order
 */
export const calculateOrderInstallments = (
  order: Order | any,
  paymentMethods: any[] = []
): { date: string; amount: number }[] => {
  if (!order) return [];
  const total = Number(order.total) || 0;
  const paymentName = String(order.payment_name || '').trim();
  const orderDateStr = order.date || new Date().toISOString().split('T')[0];

  // Look for custom config in paymentMethods array if available
  const pm = paymentMethods.find(p => p.name && p.name.toLowerCase() === paymentName.toLowerCase());

  let installmentsNum = pm ? (pm.installments || 1) : 1;
  let offsetDays = pm ? (pm.offset_days || 0) : 0;
  let fineMese = pm ? (pm.fine_mese === 1 || pm.fine_mese === true) : false;
  let customOffsets: number[] | null = null;

  // Pattern detection from standard Danea Easyfatt payment strings
  const lowerName = paymentName.toLowerCase();

  if (!pm) {
    if (lowerName.includes('f.m.') || lowerName.includes('fine mese') || lowerName.includes('fm')) {
      fineMese = true;
    }

    if (lowerName.includes('30-60-90-120') || lowerName.includes('30/60/90/120')) {
      installmentsNum = 4;
      customOffsets = [30, 60, 90, 120];
    } else if (lowerName.includes('30-60-90') || lowerName.includes('30/60/90')) {
      installmentsNum = 3;
      customOffsets = [30, 60, 90];
    } else if (lowerName.includes('30-60') || lowerName.includes('30/60') || lowerName.includes('60-90') || lowerName.includes('60/90')) {
      installmentsNum = 2;
      customOffsets = lowerName.includes('60-90') ? [60, 90] : [30, 60];
    } else if (lowerName.includes('90')) {
      installmentsNum = 1;
      offsetDays = 90;
    } else if (lowerName.includes('60')) {
      installmentsNum = 1;
      offsetDays = 60;
    } else if (lowerName.includes('30')) {
      installmentsNum = 1;
      offsetDays = 30;
    } else if (lowerName.includes('bonifico anticipato') || lowerName.includes('carta') || lowerName.includes('contanti') || lowerName.includes('rimessa diretta')) {
      installmentsNum = 1;
      offsetDays = 0;
      fineMese = false;
    }
  }

  const orderInstallments: { date: string; amount: number }[] = [];

  if (installmentsNum > 1) {
    const baseAmount = Math.floor((total / installmentsNum) * 100) / 100;
    const difference = Math.round((total - (baseAmount * installmentsNum)) * 100) / 100;

    for (let i = 0; i < installmentsNum; i++) {
      let amt = baseAmount;
      if (i === installmentsNum - 1) {
        amt = Math.round((baseAmount + difference) * 100) / 100;
      }

      const currentDate = new Date(orderDateStr);
      let dateStr = orderDateStr;

      if (!isNaN(currentDate.getTime())) {
        let targetDays = offsetDays;
        if (customOffsets && customOffsets.length > 0) {
          targetDays = customOffsets[i] !== undefined 
            ? customOffsets[i] 
            : (customOffsets[customOffsets.length - 1] + (i - customOffsets.length + 1) * 30);
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
    const currentDate = new Date(orderDateStr);
    let dateStr = orderDateStr;

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

    orderInstallments.push({ date: dateStr, amount: total });
  }

  return orderInstallments;
};

/**
 * Filter and compute all payment deadlines from orders
 */
export const computePaymentDeadlines = (
  orders: Order[],
  paymentMethods: any[] = []
): PaymentDeadline[] => {
  const deadlines: PaymentDeadline[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  orders.forEach(order => {
    if (order.status === 'Bozza') return; // Deadlines computed on confirmed/active orders
    const insts = calculateOrderInstallments(order, paymentMethods);
    if (insts && insts.length > 0) {
      insts.forEach((inst, index) => {
        const instDate = new Date(inst.date);
        const isPast = !isNaN(instDate.getTime()) && instDate < today;
        deadlines.push({
          orderId: order.id,
          orderNumber: order.number || order.formatted_number || order.id,
          orderDate: order.date,
          clientName: order.client_name || 'N/D',
          clientId: order.client_id,
          agentName: order.agent_name || 'Diretto',
          date: inst.date,
          amount: inst.amount,
          installmentIndex: index + 1,
          totalInstallments: insts.length,
          paymentName: order.payment_name || 'Standard',
          isOverdue: isPast
        });
      });
    }
  });

  return deadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Extract all distinct agent names available in system
 */
export const getAvailableAgents = (
  usersList: User[] = [],
  clients: Client[] = [],
  orders: Order[] = []
): string[] => {
  const agentsSet = new Set<string>();

  usersList.forEach(u => {
    if (u.name && (u.role === 'agent' || u.role === 'agente' || u.role === 'capoarea' || u.role === 'capo_area')) {
      agentsSet.add(u.name.trim());
    }
  });

  clients.forEach(c => {
    if (c.agente && c.agente.trim()) {
      agentsSet.add(c.agente.trim());
    }
  });

  orders.forEach(o => {
    if (o.agent_name && o.agent_name.trim()) {
      agentsSet.add(o.agent_name.trim());
    }
  });

  return Array.from(agentsSet).sort((a, b) => a.localeCompare(b));
};

/**
 * Get assigned clients in anagrafica based on role and selected filter
 */
export const getAssignedClients = (
  clients: Client[] = [],
  user?: User | any,
  selectedAgentFilter: string = 'all',
  usersList: User[] = []
): Client[] => {
  const isAdmin = isUserAdmin(user);
  const isCapo = isUserCapoArea(user);
  const isAgent = !isAdmin && !isCapo;
  const currentAgentName = normalizeAgentName(user?.name);
  const currentDept = normalizeAgentName(user?.department);

  if (isAgent) {
    // Strictly filter to clients where c.agente matches user's name
    return clients.filter(c => {
      const clAgente = normalizeAgentName(c.agente);
      return clAgente === currentAgentName || clAgente.includes(currentAgentName) || currentAgentName.includes(clAgente);
    });
  }

  if (isCapo) {
    if (selectedAgentFilter === 'all') {
      return clients;
    }

    const target = normalizeAgentName(selectedAgentFilter);
    return clients.filter(c => {
      const clAgente = normalizeAgentName(c.agente);
      return clAgente === target || clAgente.includes(target) || target.includes(clAgente);
    });
  }

  // Admin view
  if (selectedAgentFilter === 'all') {
    return clients;
  }

  const target = normalizeAgentName(selectedAgentFilter);
  return clients.filter(c => {
    const clAgente = normalizeAgentName(c.agente);
    return clAgente === target || clAgente.includes(target) || target.includes(clAgente);
  });
};

/**
 * Filter orders based on user permissions and agent scope
 */
export const getAgentScopedOrders = (
  orders: Order[] = [],
  assignedClients: Client[] = [],
  user?: User | any,
  selectedAgentFilter: string = 'all'
): Order[] => {
  const isAdmin = isUserAdmin(user);
  const isCapo = isUserCapoArea(user);
  const isAgent = !isAdmin && !isCapo;
  const currentAgentName = normalizeAgentName(user?.name);
  const assignedClientIds = new Set(assignedClients.map(c => c.id));

  if (isAgent) {
    return orders.filter(o => {
      const orderAgent = normalizeAgentName(o.agent_name);
      const isDirectAgent = o.agent_id && String(o.agent_id) === String(user?.id);
      const isNameMatch = orderAgent === currentAgentName || orderAgent.includes(currentAgentName) || currentAgentName.includes(orderAgent);
      const isClientAssigned = o.client_id && assignedClientIds.has(o.client_id);
      return isDirectAgent || isNameMatch || isClientAssigned;
    });
  }

  if (selectedAgentFilter === 'all') {
    return orders;
  }

  const target = normalizeAgentName(selectedAgentFilter);
  return orders.filter(o => {
    const orderAgent = normalizeAgentName(o.agent_name);
    const isNameMatch = orderAgent === target || orderAgent.includes(target) || target.includes(orderAgent);
    const isClientAssigned = o.client_id && assignedClientIds.has(o.client_id);
    return isNameMatch || isClientAssigned;
  });
};

/**
 * Comprehensive, Unified Statistics Calculation Engine
 */
export interface StatsCalculationParams {
  orders: Order[];
  clients: Client[];
  products?: Product[];
  usersList?: User[];
  user?: User | any;
  selectedAgentFilter?: string;
  timeRangeFilter?: 'month' | 'prev_month' | 'quarter' | 'year' | 'all' | string;
  orderStatusFilter?: 'all' | 'confirm' | 'draft' | 'Bozza' | 'Nuovo' | 'Confermato' | string;
  customMonthFilter?: string; // e.g. '2026-03' or 'ALL'
  paymentMethods?: any[];
}

export const computeComprehensiveStats = (params: StatsCalculationParams) => {
  const {
    orders = [],
    clients = [],
    products = [],
    usersList = [],
    user,
    selectedAgentFilter = 'all',
    timeRangeFilter = 'month',
    orderStatusFilter = 'all',
    customMonthFilter = 'ALL',
    paymentMethods = []
  } = params;

  const isAdmin = isUserAdmin(user);
  const isCapo = isUserCapoArea(user);
  const isAgent = !isAdmin && !isCapo;

  const availableAgents = getAvailableAgents(usersList, clients, orders);
  const assignedClients = getAssignedClients(clients, user, selectedAgentFilter, usersList);
  const assignedClientIds = new Set(assignedClients.map(c => c.id));
  const agentScopedOrders = getAgentScopedOrders(orders, assignedClients, user, selectedAgentFilter);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Time Range Filtering
  const periodOrders = agentScopedOrders.filter(o => {
    if (!o.date) return false;

    if (customMonthFilter && customMonthFilter !== 'ALL' && customMonthFilter !== 'all') {
      return o.date.startsWith(customMonthFilter);
    }

    const d = new Date(o.date);
    if (isNaN(d.getTime())) return false;

    const orderYear = d.getFullYear();
    const orderMonth = d.getMonth();

    if (timeRangeFilter === 'month') {
      return orderYear === currentYear && orderMonth === currentMonth;
    }
    if (timeRangeFilter === 'prev_month') {
      const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
      return orderYear === prevMonthDate.getFullYear() && orderMonth === prevMonthDate.getMonth();
    }
    if (timeRangeFilter === 'quarter' || timeRangeFilter === '30days') {
      const threeMonthsAgo = new Date(currentYear, currentMonth - 2, 1);
      return d >= threeMonthsAgo;
    }
    if (timeRangeFilter === 'year') {
      return orderYear === currentYear;
    }
    return true; // 'all'
  });

  // Filtered Orders (Applying Status Filter & Search)
  let filteredOrders = [...periodOrders];
  if (orderStatusFilter === 'draft' || orderStatusFilter === 'Bozza') {
    filteredOrders = filteredOrders.filter(o => o.status === 'Bozza');
  } else if (orderStatusFilter === 'confirm' || orderStatusFilter === 'Confermato' || orderStatusFilter === 'completed') {
    filteredOrders = filteredOrders.filter(o => o.status !== 'Bozza');
  } else if (orderStatusFilter === 'Nuovo') {
    filteredOrders = filteredOrders.filter(o => o.status === 'Nuovo');
  }

  // Core metrics
  const periodConfirmedOrders = periodOrders.filter(o => o.status !== 'Bozza');
  const periodDraftOrders = periodOrders.filter(o => o.status === 'Bozza');

  const totalRevenue = periodConfirmedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const draftRevenue = periodDraftOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalSalesAll = periodOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const confirmedOrdersCount = periodConfirmedOrders.length;
  const draftOrdersCount = periodDraftOrders.length;
  const ordersCount = periodOrders.length;
  const aov = confirmedOrdersCount > 0 ? totalRevenue / confirmedOrdersCount : 0;

  // Quantity sold in confirmed orders
  let totalQuantitySold = 0;
  periodConfirmedOrders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(it => {
        totalQuantitySold += Number(it.qty) || 0;
      });
    }
  });

  // Active clients in period
  const activeClientsInPeriod = new Set<number>();
  periodConfirmedOrders.forEach(o => {
    if (o.client_id) activeClientsInPeriod.add(o.client_id);
  });
  const activeClientsCount = activeClientsInPeriod.size;
  const assignedClientsCount = assignedClients.length;
  const portfolioPenetrationRate = assignedClientsCount > 0 
    ? Math.round((activeClientsCount / assignedClientsCount) * 100) 
    : 0;
  const avgRevenuePerClient = activeClientsCount > 0 ? totalRevenue / activeClientsCount : 0;

  // Current month revenue for target calculation
  const currentMonthRevenue = agentScopedOrders
    .filter(o => {
      if (!o.date || o.status === 'Bozza') return false;
      const d = new Date(o.date);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    })
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  // Monthly Sales Chart (Last 6 Months)
  const monthsNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const monthlyChartData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const mIdx = d.getMonth();
    const yr = d.getFullYear();
    const label = `${monthsNames[mIdx]} '${String(yr).slice(-2)}`;

    const mOrders = agentScopedOrders.filter(o => {
      if (!o.date || o.status === 'Bozza') return false;
      const od = new Date(o.date);
      return !isNaN(od.getTime()) && od.getFullYear() === yr && od.getMonth() === mIdx;
    });

    const revenue = mOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const count = mOrders.length;

    monthlyChartData.push({
      name: label,
      fatturato: Math.round(revenue),
      ordini: count
    });
  }

  // Client Portfolio Analysis: Top Spenders & Inactive Clients
  const clientStatsMap = new Map<number, ClientPortfolioItem>();
  assignedClients.forEach(c => {
    clientStatsMap.set(c.id, { client: c, totalSpent: 0, orderCount: 0, lastOrderDate: null });
  });

  agentScopedOrders.forEach(o => {
    if (o.client_id && o.status !== 'Bozza') {
      let entry = clientStatsMap.get(o.client_id);
      if (!entry) {
        const cl = clients.find(c => c.id === o.client_id) || { id: o.client_id, name: o.client_name || 'Cliente' } as Client;
        entry = { client: cl, totalSpent: 0, orderCount: 0, lastOrderDate: null };
        clientStatsMap.set(o.client_id, entry);
      }
      entry.totalSpent += Number(o.total) || 0;
      entry.orderCount += 1;
      if (!entry.lastOrderDate || new Date(o.date) > new Date(entry.lastOrderDate)) {
        entry.lastOrderDate = o.date;
      }
    }
  });

  const clientList = Array.from(clientStatsMap.values());
  const topClients = [...clientList]
    .filter(i => i.totalSpent > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const inactiveClients = clientList
    .filter(item => {
      if (!item.lastOrderDate) return true;
      return new Date(item.lastOrderDate) < sixtyDaysAgo;
    })
    .map(item => {
      const daysSince = item.lastOrderDate
        ? Math.floor((now.getTime() - new Date(item.lastOrderDate).getTime()) / (1000 * 3600 * 24))
        : null;
      return { ...item, daysSinceLastOrder: daysSince };
    })
    .sort((a, b) => {
      if (!a.lastOrderDate) return 1;
      if (!b.lastOrderDate) return -1;
      return new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime();
    })
    .slice(0, 10);

  // Top Products Breakdown in period
  const prodMap: Record<string, ProductStatItem> = {};
  const catMap: Record<string, { category: string; qty: number; revenue: number }> = {};

  periodConfirmedOrders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(it => {
        const code = it.product_code || 'N/D';
        const prod = products.find(p => p.code === code);
        const cat = prod?.category || 'Senza Categoria';
        const stock = prod ? Number(prod.stock) : 0;

        if (!prodMap[code]) {
          prodMap[code] = {
            code,
            description: it.description || prod?.description || code,
            qty: 0,
            revenue: 0,
            category: cat,
            stock
          };
        }

        const qty = Number(it.qty) || 0;
        const price = Number(it.price) || 0;
        prodMap[code].qty += qty;
        prodMap[code].revenue += qty * price;

        if (!catMap[cat]) {
          catMap[cat] = { category: cat, qty: 0, revenue: 0 };
        }
        catMap[cat].qty += qty;
        catMap[cat].revenue += qty * price;
      });
    }
  });

  const topProducts = Object.values(prodMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const totalCatRevenue = Object.values(catMap).reduce((s, c) => s + c.revenue, 0) || 1;
  const categoryBreakdown: CategoryStatItem[] = Object.values(catMap)
    .map(c => ({
      ...c,
      percentage: Math.round((c.revenue / totalCatRevenue) * 100)
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Payment Breakdown
  const pMap: Record<string, { name: string; count: number; total: number }> = {};
  periodConfirmedOrders.forEach(o => {
    const pm = o.payment_name || 'Standard';
    if (!pMap[pm]) {
      pMap[pm] = { name: pm, count: 0, total: 0 };
    }
    pMap[pm].count += 1;
    pMap[pm].total += Number(o.total) || 0;
  });

  const totPay = Object.values(pMap).reduce((s, p) => s + p.total, 0) || 1;
  const paymentBreakdown: PaymentStatItem[] = Object.values(pMap)
    .map(p => ({
      ...p,
      volume: p.total,
      percentage: Math.round((p.total / totPay) * 100)
    }))
    .sort((a, b) => b.total - a.total);

  // Geographic Breakdown (by Client City)
  const cityAggs: Record<string, { city: string; spent: number; ordersCount: number }> = {};
  periodConfirmedOrders.forEach(o => {
    const cl = clients.find(c => c.id === o.client_id);
    const city = (cl?.city || 'Non Specificata').trim();
    if (!cityAggs[city]) {
      cityAggs[city] = { city, spent: 0, ordersCount: 0 };
    }
    cityAggs[city].spent += Number(o.total) || 0;
    cityAggs[city].ordersCount += 1;
  });

  const cityBreakdown: CityStatItem[] = Object.values(cityAggs)
    .map(ca => ({
      city: ca.city,
      revenue: ca.spent,
      count: ca.ordersCount
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Agent Leaderboard (for Admin and Capo Area)
  const agentStatsMap: Record<string, { name: string; totalRevenue: number; ordersCount: number; activeClientsCount: Set<number>; aov: number }> = {};
  availableAgents.forEach(agName => {
    agentStatsMap[agName] = {
      name: agName,
      totalRevenue: 0,
      ordersCount: 0,
      activeClientsCount: new Set<number>(),
      aov: 0
    };
  });

  orders.forEach(o => {
    if (o.status === 'Bozza') return;
    if (!o.date) return;
    const d = new Date(o.date);
    if (isNaN(d.getTime())) return;

    if (timeRangeFilter === 'month' && (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth)) return;
    if (timeRangeFilter === 'prev_month') {
      const prev = new Date(currentYear, currentMonth - 1, 1);
      if (d.getFullYear() !== prev.getFullYear() || d.getMonth() !== prev.getMonth()) return;
    }
    if (timeRangeFilter === 'year' && d.getFullYear() !== currentYear) return;

    const ag = (o.agent_name || 'Diretto').trim();
    if (!agentStatsMap[ag]) {
      agentStatsMap[ag] = {
        name: ag,
        totalRevenue: 0,
        ordersCount: 0,
        activeClientsCount: new Set<number>(),
        aov: 0
      };
    }

    agentStatsMap[ag].totalRevenue += Number(o.total) || 0;
    agentStatsMap[ag].ordersCount += 1;
    if (o.client_id) agentStatsMap[ag].activeClientsCount.add(o.client_id);
  });

  const agentsLeaderboard: AgentLeaderboardItem[] = Object.values(agentStatsMap)
    .map(a => ({
      name: a.name,
      totalRevenue: a.totalRevenue,
      ordersCount: a.ordersCount,
      activeClients: a.activeClientsCount.size,
      aov: a.ordersCount > 0 ? a.totalRevenue / a.ordersCount : 0
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Payment Deadlines (Scadenziario)
  const allDeadlines = computePaymentDeadlines(periodOrders, paymentMethods);

  // Products stock status
  const totalProductsCount = products.length;
  const outOfStockCount = products.filter(p => Number(p.stock) <= 0).length;
  const lowStockCount = products.filter(p => {
    const stock = Number(p.stock);
    const minStock = Number(p.min_stock ?? 5);
    return stock > 0 && stock <= minStock;
  }).length;

  return {
    isAdmin,
    isCapo,
    isAgent,
    availableAgents,
    assignedClients,
    assignedClientIds,
    agentScopedOrders,
    periodOrders,
    filteredOrders,
    periodConfirmedOrders,
    periodDraftOrders,
    totalRevenue,
    totalSales: totalRevenue,
    totalSalesAll,
    draftRevenue,
    draftSales: draftRevenue,
    transmittedSales: totalRevenue,
    confirmedOrdersCount,
    completedOrdersCount: confirmedOrdersCount,
    draftOrdersCount,
    draftsCount: draftOrdersCount,
    ordersCount,
    aov,
    totalQuantitySold,
    activeClientsCount,
    assignedClientsCount,
    portfolioPenetrationRate,
    avgRevenuePerClient,
    currentMonthRevenue,
    monthlyChartData,
    topClients,
    topSpentClients: topClients.map(tc => ({
      id: tc.client.id,
      name: tc.client.name,
      city: tc.client.city || '',
      spent: tc.totalSpent,
      ordersCount: tc.orderCount,
      orderCount: tc.orderCount
    })),
    inactiveClients,
    topProducts,
    categoryBreakdown,
    paymentBreakdown,
    cityBreakdown,
    topCities: cityBreakdown,
    agentsLeaderboard,
    allDeadlines,
    totalProductsCount,
    outOfStockCount,
    lowStockCount
  };
};
