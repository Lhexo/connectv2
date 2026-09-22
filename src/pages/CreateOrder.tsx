import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  ArrowLeft, 
  AlertCircle, 
  User as UserIcon, 
  Calendar, 
  CreditCard, 
  FileText, 
  X, 
  Sparkles,
  Layers,
  ChevronRight,
  Package,
  Printer,
  Copy,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Client, PaymentMethod, Order } from '../types';
import { printOrderDocument, copyOrderToClipboard, downloadOrderPdf, PrintableOrderData } from '../utils/printAndCopyOrder';
import EditableAmountInput from '../components/EditableAmountInput';
import { calculateTaxable, calculateLineTotals, calculateOrderTotals, formatEuro } from '../utils/priceUtils';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface OrderItemDraft {
  product_code: string;
  description: string;
  qty: number;
  price: number;
  vat_code: string;
  um: string;
}

export default function CreateOrder({ user, currentUser }: { user?: any; currentUser?: any }) {
  const activeUser = user || currentUser;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const preselectedClientId = searchParams.get('clientId');
  const editOrderId = searchParams.get('orderId');
  const duplicateOrderId = searchParams.get('duplicateOrderId') || searchParams.get('copyOrderId');

  // Core data
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search states
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Order form state
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || '');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentName, setPaymentName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [cartItems, setCartItems] = useState<OrderItemDraft[]>([]);

  // UI state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccessModal, setOrderSuccessModal] = useState<{ 
    isOpen: boolean; 
    orderNumber?: string; 
    status: 'Nuovo' | 'Bozza';
    orderData?: PrintableOrderData;
  }>({ isOpen: false, status: 'Nuovo' });
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Client search within dropdown/picker
  const [clientSearch, setClientSearch] = useState('');
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);

  // Lock body scroll and isolate touch scroll events on iOS Safari when Cart or Client Modal is open
  useLockBodyScroll(isCartOpen || isClientPickerOpen || orderSuccessModal.isOpen);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [prodRes, clientRes, pmRes] = await Promise.all([
          fetch('/api/easyfatt/products'),
          fetch('/api/clients'),
          fetch('/api/payment-methods')
        ]);

        if (prodRes.ok) {
          const prods: Product[] = await prodRes.json();
          setProducts(prods);
        }

        let cls: Client[] = [];
        if (clientRes.ok) {
          cls = await clientRes.json();
          setClients(cls);
          
          if (preselectedClientId) {
            const found = cls.find(c => String(c.id) === String(preselectedClientId));
            if (found) {
              setSelectedClientId(String(found.id));
              if (found.payment_name) {
                setPaymentName(found.payment_name);
              }
            }
          }
        }

        if (pmRes.ok) {
          const pms: PaymentMethod[] = await pmRes.json();
          setPaymentMethods(pms);
          if (!paymentName && pms.length > 0) {
            setPaymentName(pms[0].name);
          }
        }

        // If editing or duplicating an existing order
        const targetOrderId = editOrderId || duplicateOrderId;
        if (targetOrderId) {
          try {
            // First try single order endpoint
            let targetOrder: any = null;
            const singleRes = await fetch(`/api/easyfatt/orders/${targetOrderId}`);
            if (singleRes.ok) {
              targetOrder = await singleRes.json();
            } else {
              const orderRes = await fetch('/api/easyfatt/orders');
              if (orderRes.ok) {
                const orders: Order[] = await orderRes.json();
                targetOrder = orders.find(o => String(o.id) === String(targetOrderId) || String(o.number) === String(targetOrderId));
              }
            }

            if (targetOrder) {
              // Locate matching client in client list
              const clientList = cls.length > 0 ? cls : clients;
              const matchedClient = (clientList || []).find((c: Client) => 
                (targetOrder.client_id && String(c.id) === String(targetOrder.client_id)) ||
                (preselectedClientId && String(c.id) === String(preselectedClientId)) ||
                (targetOrder.client_name && c.name && c.name.toLowerCase() === targetOrder.client_name.toLowerCase()) ||
                (targetOrder.client_code && c.code && c.code === targetOrder.client_code)
              );

              if (matchedClient) {
                setSelectedClientId(String(matchedClient.id));
                if (matchedClient.payment_name && !targetOrder.payment_name) {
                  setPaymentName(matchedClient.payment_name);
                }
              } else if (targetOrder.client_id) {
                setSelectedClientId(String(targetOrder.client_id));
              } else if (preselectedClientId) {
                setSelectedClientId(String(preselectedClientId));
              }

              if (duplicateOrderId) {
                setOrderDate(new Date().toISOString().split('T')[0]);
                const baseNote = targetOrder.notes || '';
                const copyPrefix = `[Copia da Ord. #${targetOrder.number || targetOrder.id}]`;
                setNotes(baseNote ? `${copyPrefix} ${baseNote}` : copyPrefix);
              } else {
                setOrderDate(targetOrder.date || new Date().toISOString().split('T')[0]);
                setNotes(targetOrder.notes || '');
              }

              if (targetOrder.payment_name) {
                setPaymentName(targetOrder.payment_name);
              }

              // Map items to cart - support items, rows, products, order_items
              let rawItems = targetOrder.items || targetOrder.rows || targetOrder.products || targetOrder.order_items || [];
              if (typeof rawItems === 'string') {
                try { rawItems = JSON.parse(rawItems); } catch (_) { rawItems = []; }
              }

              if (Array.isArray(rawItems) && rawItems.length > 0) {
                const mappedItems: OrderItemDraft[] = rawItems.map((item: any, idx: number) => ({
                  product_code: String(item.product_code || item.code || item.productCode || item.sku || `ART-${idx + 1}`),
                  description: String(item.description || item.product_description || item.name || 'Articolo'),
                  qty: Number(item.qty || item.quantity || item.qta) || 1,
                  price: Number(item.price !== undefined && item.price !== null ? item.price : (item.unit_price !== undefined ? item.unit_price : 0)),
                  vat_code: String(item.vat_code || item.vatCode || item.vat || '22'),
                  um: String(item.um || item.unit || 'pz')
                }));
                setCartItems(mappedItems);
                setIsCartOpen(true);
                
                if (duplicateOrderId) {
                  showToast(`Copia caricata: ${matchedClient?.name || targetOrder.client_name || 'Cliente'} e ${mappedItems.length} articoli pronti nel carrello!`, 'success');
                } else if (editOrderId) {
                  showToast(`Modifica ordine #${targetOrder.number || targetOrder.id}: ${mappedItems.length} articoli caricati nel carrello.`, 'info');
                }
              } else {
                console.warn('[CreateOrder] Order found but has no items:', targetOrder);
                if (duplicateOrderId) {
                  showToast(`Ordine #${targetOrder.number || targetOrder.id} caricato, ma non conteneva articoli memorizzati.`, 'info');
                }
              }
            } else {
              console.warn('[CreateOrder] targetOrderId not found:', targetOrderId);
              showToast(`Ordine #${targetOrderId} non trovato`, 'error');
            }
          } catch (loadOrderErr) {
            console.error('Could not load order for edit/duplicate:', loadOrderErr);
          }
        }
      } catch (err) {
        console.error('Error fetching data for order creation:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [preselectedClientId, editOrderId, duplicateOrderId]);

  // Selected client object
  const selectedClient = useMemo(() => {
    return clients.find(c => String(c.id) === String(selectedClientId)) || null;
  }, [clients, selectedClientId]);

  // When client changes, auto-set payment method if client has one saved
  const handleSelectClient = (c: Client) => {
    setSelectedClientId(String(c.id));
    if (c.payment_name) {
      setPaymentName(c.payment_name);
    }
    setIsClientPickerOpen(false);
    showToast(`Cliente selezionato: ${c.name}`, 'info');
  };

  // Toast helper
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return products.filter(p => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchSearch = !q || 
        p.code.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q) || 
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q));
      const matchStock = !onlyAvailable || Number(p.stock) > 0;
      return matchCat && matchSearch && matchStock;
    });
  }, [products, selectedCategory, productSearch, onlyAvailable]);

  // Cart operations
  const getItemQtyInCart = (productCode: string) => {
    const found = cartItems.find(item => item.product_code === productCode);
    return found ? found.qty : 0;
  };

  const handleAddToCart = (product: Product, delta: number = 1) => {
    const isBackorder = Number(product.stock) <= 0;
    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => item.product_code === product.code);
      if (existingIndex >= 0) {
        const newItems = [...prev];
        const newQty = newItems[existingIndex].qty + delta;
        if (newQty <= 0) {
          newItems.splice(existingIndex, 1);
          showToast(`Rimosso ${product.description}`, 'info');
        } else {
          newItems[existingIndex].qty = newQty;
          showToast(
            isBackorder 
              ? `Aggiornata quantità (Pre-ordine): ${product.description} (${newQty} pz)` 
              : `Aggiornata quantità: ${product.description} (${newQty} pz)`, 
            'success'
          );
        }
        return newItems;
      } else {
        if (delta <= 0) return prev;
        showToast(
          isBackorder 
            ? `Aggiunto in Pre-ordine: ${product.description}` 
            : `Aggiunto all'ordine: ${product.description}`, 
          'success'
        );
        return [
          ...prev,
          {
            product_code: product.code,
            description: product.description,
            qty: delta,
            price: Number(product.price) || 0,
            vat_code: product.vat_code || '22',
            um: product.um || 'pz'
          }
        ];
      }
    });
  };

  const handleUpdateCartItemQty = (productCode: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productCode);
      return;
    }
    setCartItems(prev => prev.map(item => 
      item.product_code === productCode ? { ...item, qty: newQty } : item
    ));
  };

  const handleRemoveFromCart = (productCode: string) => {
    setCartItems(prev => prev.filter(item => item.product_code !== productCode));
    showToast('Articolo rimosso dal carrello', 'info');
  };

  const handleUpdateCartItemPrice = (productCode: string, newPrice: number, index?: number) => {
    const cleanPrice = isNaN(newPrice) ? 0 : Math.round(newPrice * 100) / 100;
    setCartItems(prev => {
      if (typeof index === 'number' && index >= 0 && index < prev.length) {
        const next = [...prev];
        next[index] = { ...next[index], price: cleanPrice };
        return next;
      }
      return prev.map(item => 
        item.product_code === productCode ? { ...item, price: cleanPrice } : item
      );
    });
  };

  const handleUpdateCartItemTotal = (productCode: string, newTotal: number, index?: number) => {
    const cleanTotal = isNaN(newTotal) ? 0 : Math.round(newTotal * 100) / 100;
    setCartItems(prev => {
      if (typeof index === 'number' && index >= 0 && index < prev.length) {
        const next = [...prev];
        const qty = next[index].qty || 1;
        next[index] = { ...next[index], price: Math.round((cleanTotal / qty) * 100) / 100 };
        return next;
      }
      return prev.map(item => {
        if (item.product_code === productCode) {
          const qty = item.qty || 1;
          return { ...item, price: Math.round((cleanTotal / qty) * 100) / 100 };
        }
        return item;
      });
    });
  };

  // Cart Calculations
  const orderTotals = useMemo(() => {
    return calculateOrderTotals(cartItems.map(item => ({
      qty: item.qty,
      price: item.price,
      vatRate: item.vat_code || 22
    })));
  }, [cartItems]);

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  }, [cartItems]);

  const grossSubtotal = useMemo(() => {
    return cartItems
      .filter(item => item.price > 0)
      .reduce((acc, item) => acc + (item.qty * item.price), 0);
  }, [cartItems]);

  const discountTotal = useMemo(() => {
    return cartItems
      .filter(item => item.price < 0)
      .reduce((acc, item) => acc + (item.qty * Math.abs(item.price)), 0);
  }, [cartItems]);

  const totalItemsCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.qty, 0);
  }, [cartItems]);

  // Prepare printable data object for printing and copying
  const buildPrintableOrderData = (customNumber?: string, customStatus?: string): PrintableOrderData => {
    return {
      orderNumber: customNumber || orderSuccessModal.orderNumber || (editOrderId ? `#${editOrderId}` : 'Nuovo'),
      date: orderDate || new Date().toISOString().split('T')[0],
      status: customStatus || orderSuccessModal.status || 'Nuovo',
      clientName: selectedClient?.name || 'Cliente',
      clientCode: selectedClient?.code || '',
      clientAddress: selectedClient?.address || '',
      clientCity: selectedClient?.city || '',
      clientProvince: selectedClient?.province || '',
      clientVat: selectedClient?.vat_code || '',
      clientFiscalCode: selectedClient?.fiscal_code || '',
      clientPhone: selectedClient?.cell_phone || selectedClient?.phone || '',
      clientEmail: selectedClient?.email || '',
      agentName: activeUser?.name || '',
      paymentName: paymentName || 'Bonifico bancario',
      paymentBank: selectedClient?.payment_bank || '',
      notes: notes || '',
      items: cartItems.map(item => {
        const line = calculateLineTotals(item.qty, item.price, item.vat_code || 22);
        return {
          code: item.product_code,
          description: item.description,
          qty: item.qty,
          price: item.price,
          vatRate: line.vatRate,
          taxablePrice: line.unitTaxable,
          taxableTotal: line.totalTaxable,
          total: line.totalGross,
          um: item.um
        };
      }),
      taxableTotal: orderTotals.totalTaxable,
      vatTotal: orderTotals.totalVat,
      total: orderTotals.totalGross
    };
  };

  const handleCopySummary = async (customData?: PrintableOrderData) => {
    const dataToCopy = customData || orderSuccessModal.orderData || buildPrintableOrderData();
    const success = await copyOrderToClipboard(dataToCopy);
    if (success) {
      showToast('Riepilogo ordine copiato negli appunti!', 'success');
    } else {
      showToast('Impossibile copiare negli appunti automaticamente', 'error');
    }
  };

  const handlePrintOrder = (customData?: PrintableOrderData) => {
    const dataToPrint = customData || orderSuccessModal.orderData || buildPrintableOrderData();
    printOrderDocument(dataToPrint);
  };

  const handleDownloadPdf = async (customData?: PrintableOrderData) => {
    const dataToPdf = customData || orderSuccessModal.orderData || buildPrintableOrderData();
    const ok = await downloadOrderPdf(dataToPdf);
    if (ok) {
      showToast('PDF dell\'ordine scaricato con successo!', 'success');
    } else {
      showToast('Impossibile generare il PDF', 'error');
    }
  };

  // Submit Order or Save Draft
  const handleSubmitOrder = async (status: 'Nuovo' | 'Bozza' = 'Nuovo') => {
    if (!selectedClientId) {
      showToast('Seleziona prima il cliente a cui intestare l\'ordine!', 'error');
      setIsClientPickerOpen(true);
      return;
    }

    if (cartItems.length === 0) {
      showToast('Aggiungi almeno un articolo al carrello!', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        client_id: selectedClientId,
        agent_id: activeUser?.id || null,
        agent_name: activeUser?.name || null,
        date: orderDate || new Date().toISOString().split('T')[0],
        payment_name: paymentName || 'Bonifico bancario',
        payment_bank: selectedClient?.payment_bank || '',
        notes: notes || '',
        status: status,
        items: cartItems
      };

      const url = editOrderId 
        ? `/api/easyfatt/orders/${editOrderId}` 
        : '/api/easyfatt/orders';
      const method = editOrderId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        const orderNum = data.number || (data.orderId ? `ORD-${data.orderId}` : (editOrderId ? `ORD-${editOrderId}` : ''));
        const printableSnapshot = buildPrintableOrderData(orderNum, status);
        setOrderSuccessModal({
          isOpen: true,
          orderNumber: orderNum,
          status: status,
          orderData: printableSnapshot
        });
      } else {
        showToast(data.error || 'Errore durante la trasmissione dell\'ordine', 'error');
      }
    } catch (err: any) {
      showToast('Errore di connessione al server', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter clients for modal search
  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return clients.slice(0, 30);
    return clients.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    ).slice(0, 40);
  }, [clients, clientSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-[#5A5A40] uppercase tracking-wider">Caricamento Catalogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 ${
              toastMessage.type === 'error' 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : toastMessage.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {toastMessage.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner: Tactile & Intuitive */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl font-bold">
              <ShoppingBag size={20} />
            </span>
            <span className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider">
              {editOrderId ? 'Modifica Ordine' : 'Nuovo Ordine Agente'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Catalogo Prodotti & Ordini
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Seleziona il cliente, sfoglia il catalogo visivo e componi l'ordine in pochi tocchi.
          </p>
        </div>

        {/* Selected Client Quick Bar / Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsClientPickerOpen(true)}
            className={`px-4 py-3 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer shadow-2xs ${
              selectedClient 
                ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300' 
                : 'bg-amber-50 border-amber-300 hover:bg-amber-100 animate-pulse'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              selectedClient ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              <UserIcon size={18} />
            </div>
            <div className="min-w-0 pr-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                Cliente Selezionato
              </span>
              <span className="text-sm font-black text-gray-900 truncate block">
                {selectedClient ? selectedClient.name : 'Tocca per scegliere cliente *'}
              </span>
              {selectedClient?.city && (
                <span className="text-[11px] text-gray-500 block truncate">
                  {selectedClient.city} {selectedClient.province ? `(${selectedClient.province})` : ''}
                </span>
              )}
            </div>
            <ChevronRight size={18} className="text-gray-400 shrink-0" />
          </button>

          {/* Cart Toggle Button (Desktop & Mobile) */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative bg-[#5A5A40] hover:bg-[#4A4A30] text-white p-3.5 rounded-2xl flex items-center gap-2.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            title="Visualizza Carrello"
          >
            <ShoppingBag size={20} />
            <span className="font-bold text-sm hidden sm:inline">Carrello</span>
            {totalItemsCount > 0 && (
              <span className="bg-amber-400 text-gray-950 text-xs font-black px-2 py-0.5 rounded-full shadow-xs">
                {totalItemsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Order Details Accordion / Settings Bar (Client, Date, Payment, Notes) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* Client summary */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Cliente Intestatario
            </label>
            <button
              type="button"
              onClick={() => setIsClientPickerOpen(true)}
              className="w-full text-left bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 flex items-center justify-between transition-colors"
            >
              <span className="truncate">{selectedClient ? selectedClient.name : 'Seleziona Cliente...'}</span>
              <span className="text-[10px] bg-[#5A5A40] text-white px-2 py-0.5 rounded-md font-bold">Cambia</span>
            </button>
          </div>

          {/* Order Date */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Data Ordine
            </label>
            <div className="relative">
              <input
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 outline-none focus:border-[#5A5A40]"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Metodo di Pagamento
            </label>
            <select
              value={paymentName || ''}
              onChange={e => setPaymentName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 outline-none focus:border-[#5A5A40]"
            >
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.name}>{pm.name}</option>
              ))}
              {!paymentMethods.some(pm => pm.name === paymentName) && paymentName && (
                <option value={paymentName}>{paymentName}</option>
              )}
            </select>
          </div>

          {/* Quick Notes */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Note Ordine (Consegna, etc.)
            </label>
            <input
              type="text"
              placeholder="Es. Consegna urgente mattina..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#5A5A40]"
            />
          </div>
        </div>
      </div>

      {/* Catalog Search & Category Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca per nome articolo, codice..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm font-medium text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#5A5A40] shadow-2xs"
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter toggle: Disponibili */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setOnlyAvailable(!onlyAvailable)}
              className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                onlyAvailable 
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Solo Disponibili
            </button>
            <span className="text-xs text-gray-400 font-bold">
              {filteredProducts.length} Articoli trovati
            </span>
          </div>
        </div>

        {/* Horizontal Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#5A5A40] text-white shadow-2xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            Tutte le Categorie
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#5A5A40] text-white shadow-2xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid: Large, Visual, Touch-Friendly Cards */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-xs max-w-md mx-auto">
          <Package size={44} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">Nessun articolo trovato</h3>
          <p className="text-xs text-gray-500 mb-4">Prova a modificare i filtri di ricerca o la categoria selezionata.</p>
          <button
            type="button"
            onClick={() => { setProductSearch(''); setSelectedCategory('all'); setOnlyAvailable(false); }}
            className="bg-[#5A5A40] text-white text-xs font-bold px-4 py-2 rounded-xl"
          >
            Mostra tutti i prodotti
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 [content-visibility:auto] [contain-intrinsic-size:auto_350px]">
          {filteredProducts.map(product => {
            const qtyInCart = getItemQtyInCart(product.code);
            const isAvailable = Number(product.stock) > 0;
            // Always map from net price properties
            const netPrice = Number((product as any).net_price ?? (product as any).net_price_1 ?? product.price ?? 0) || 0;

            return (
              <motion.div
                layout
                key={product.id}
                className={`bg-white rounded-2xl border p-4 flex flex-col justify-between transition-all hover:shadow-md ${
                  qtyInCart > 0 
                    ? 'border-[#5A5A40] ring-2 ring-[#5A5A40]/15' 
                    : 'border-gray-200/80 shadow-xs'
                }`}
              >
                <div>
                  {/* Top Image or Placeholder */}
                  <div className="relative aspect-4/3 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden mb-3 flex items-center justify-center">
                    {product.image_file_name ? (
                      <img 
                        src={`/uploads/${product.image_file_name}`} 
                        alt={product.description}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain p-2"
                        referrerPolicy="no-referrer"
                        onError={(e: any) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className={`flex flex-col items-center justify-center text-gray-300 ${
                        product.image_file_name ? 'hidden' : 'flex'
                      }`}
                    >
                      <Package size={32} />
                      <span className="text-[10px] text-gray-400 font-bold mt-1">Connect</span>
                    </div>

                    {/* Stock Status Badge */}
                    <div className="absolute top-2 left-2">
                      {isAvailable ? (
                        <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs backdrop-blur-xs">
                          Disp. ({product.stock} {product.um || 'pz'})
                        </span>
                      ) : (
                        <span className="bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs backdrop-blur-xs">
                          In arrivo / Pre-ordine
                        </span>
                      )}
                    </div>

                    {/* Quantity already in cart badge */}
                    {qtyInCart > 0 && (
                      <div className="absolute top-2 right-2 bg-[#5A5A40] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs">
                        Nel Carrello: {qtyInCart}
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">
                      Cod. {product.code}
                    </span>
                    <h4 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug" title={product.description}>
                      {product.description}
                    </h4>
                    {product.category && (
                      <span className="inline-block text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-medium">
                        {product.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price and Cart Controls */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase font-semibold block">Prezzo Base</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black text-[#5A5A40] font-mono leading-tight">
                        {formatEuro(netPrice)}
                      </span>
                      <span className="text-[10px] font-sans font-medium text-gray-500">(Imponibile)</span>
                    </div>
                  </div>

                  {/* Touch Stepper & Add Button */}
                  {qtyInCart > 0 ? (
                    <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product, -1)}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-gray-200 text-gray-800 flex items-center justify-center font-bold shadow-2xs active:scale-95 cursor-pointer transition-colors"
                        title="Diminuisci quantità"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-7 text-center font-black font-mono text-sm text-gray-900">
                        {qtyInCart}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product, 1)}
                        className="w-8 h-8 rounded-lg bg-[#5A5A40] hover:bg-[#4A4A30] text-white flex items-center justify-center font-bold shadow-2xs active:scale-95 cursor-pointer transition-colors"
                        title="Aumenta quantità"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product, 1)}
                      className="bg-[#5A5A40] hover:bg-[#4A4A30] text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Aggiungi</span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Cart Bar for Quick Mobile Access */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto bg-gray-900 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-gray-950 flex items-center justify-center font-black text-sm">
              {totalItemsCount}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                Totale Ordine (Ivato)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-black font-mono text-white">
                  € {orderTotals.totalGross.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  (Imp. € {orderTotals.totalTaxable.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="bg-white/15 hover:bg-white/25 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Vedi Carrello
            </button>
            <button
              type="button"
              onClick={() => handleSubmitOrder('Nuovo')}
              disabled={submitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? 'Invio...' : 'Invia Ordine'}
            </button>
          </div>
        </div>
      )}

      {/* Slide-over / Modal Cart Panel */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity pointer-events-auto cursor-pointer"
            />

            {/* Slide Drawer */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between h-[100dvh] max-h-[100dvh] overflow-hidden pointer-events-auto"
              >
                {/* Cart Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl font-bold">
                      <ShoppingBag size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Riepilogo Carrello</h2>
                      <span className="text-xs text-gray-500">
                        {totalItemsCount} articoli aggiunti
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Selected Client Pill in Cart */}
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                      Destinatario Ordine
                    </span>
                    <span className="text-xs font-bold text-gray-900 block truncate">
                      {selectedClient ? selectedClient.name : 'Nessun cliente selezionato'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsClientPickerOpen(true);
                    }}
                    className="text-xs text-[#5A5A40] font-bold hover:underline cursor-pointer"
                  >
                    {selectedClient ? 'Cambia' : 'Scegli *'}
                  </button>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
                  {cartItems.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 space-y-2">
                      <ShoppingBag size={40} className="mx-auto text-gray-300" />
                      <p className="text-sm font-bold text-gray-600">Il carrello è vuoto</p>
                      <p className="text-xs">Aggiungi gli articoli dal catalogo per iniziare a comporre l'ordine.</p>
                    </div>
                  ) : (
                    cartItems.map((item, idx) => {
                      const line = calculateLineTotals(item.qty, item.price, item.vat_code || 22);
                      return (
                        <div
                          key={item.product_code + idx}
                          className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs space-y-2.5"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono font-bold text-gray-400">
                                  {item.product_code}
                                </span>
                                <span className="text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                  IVA {line.vatRate}%
                                </span>
                                {item.price < 0 && (
                                  <span className="text-[9px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200">
                                    Detrazione / Sconto
                                  </span>
                                )}
                              </div>
                              <h5 className="text-xs font-bold text-gray-900 leading-tight mt-0.5">
                                {item.description}
                              </h5>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.product_code)}
                              className="text-rose-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                              title="Rimuovi"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          {/* Dynamic Imponibile breakdown */}
                          <div className="bg-gray-50/90 p-2 rounded-xl border border-gray-100 text-[11px] space-y-1">
                            <div className="flex justify-between items-center text-gray-600">
                              <span>Prezzo Unit. Imponibile:</span>
                              <span className="font-mono font-bold text-gray-900">€ {line.unitTaxable.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-600">
                              <span>Totale Riga Imponibile:</span>
                              <span className="font-mono font-bold text-gray-900">€ {line.totalTaxable.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="space-y-2 pt-1 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              {/* Quantity Controls */}
                              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartItemQty(item.product_code, item.qty - 1)}
                                  className="w-6 h-6 rounded bg-white hover:bg-gray-200 text-gray-800 flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center font-black font-mono text-xs text-gray-900">
                                  {item.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartItemQty(item.product_code, item.qty + 1)}
                                  className="w-6 h-6 rounded bg-white hover:bg-gray-200 text-gray-800 flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-[10px] text-gray-400 font-medium">
                                Modifica importi:
                              </span>
                            </div>

                            {/* Editable Unit Price and Line Total */}
                            <div className="grid grid-cols-2 gap-2 bg-gray-50/80 p-2 rounded-xl border border-gray-100">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    PREZZO UNIT. IMPONIBILE
                                  </label>
                                  <span className="text-[9px] text-gray-400">cad.</span>
                                </div>
                                <EditableAmountInput
                                  value={item.price}
                                  onChange={(newPrice) => handleUpdateCartItemPrice(item.product_code, newPrice, idx)}
                                  prefix="€"
                                  placeholder="0.00"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    TOTALE RIGA IMPONIBILE
                                  </label>
                                  <span className="text-[9px] text-gray-400">tot.</span>
                                </div>
                                <EditableAmountInput
                                  value={Math.round(line.totalTaxable * 100) / 100}
                                  onChange={(newTotal) => handleUpdateCartItemTotal(item.product_code, newTotal, idx)}
                                  prefix="€"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Cart Footer: Totals & Submit Buttons */}
                <div className="p-5 border-t border-gray-100 bg-gray-50/50 space-y-4 shrink-0 pb-safe pb-[env(safe-area-inset-bottom,1.25rem)]">
                  <div className="space-y-2 text-xs">
                    {discountTotal > 0 && (
                      <>
                        <div className="flex justify-between text-gray-600">
                          <span>Subtotale Articoli (Imponibile):</span>
                          <span className="font-mono font-bold">€ {grossSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-rose-600 font-semibold">
                          <span>Sconti / Detrazioni (Imponibile):</span>
                          <span className="font-mono font-bold">-€ {discountTotal.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-gray-700 font-bold">
                      <span>Totale Imponibile:</span>
                      <span className={`font-mono font-bold ${orderTotals.totalTaxable < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                        {orderTotals.totalTaxable < 0 ? `-€ ${Math.abs(orderTotals.totalTaxable).toFixed(2)}` : `€ ${orderTotals.totalTaxable.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-[11px]">
                      <span>Totale IVA:</span>
                      <span className="font-mono font-bold text-gray-800">€ {orderTotals.totalVat.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-200">
                      <span>Totale Ordine (Ivato):</span>
                      <span className={`font-mono text-base ${orderTotals.totalGross < 0 ? 'text-rose-600' : 'text-[#5A5A40]'}`}>
                        {orderTotals.totalGross < 0
                          ? `-€ ${Math.abs(orderTotals.totalGross).toFixed(2)}`
                          : `€ ${orderTotals.totalGross.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {/* Quick Copy & Print Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopySummary()}
                      disabled={cartItems.length === 0}
                      className="flex-1 py-2 px-3 bg-white hover:bg-gray-100 disabled:opacity-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Copy size={13} />
                      <span>Copia Riepilogo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintOrder()}
                      disabled={cartItems.length === 0}
                      className="flex-1 py-2 px-3 bg-white hover:bg-gray-100 disabled:opacity-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer size={13} />
                      <span>Stampa Anteprima</span>
                    </button>
                  </div>

                  {/* 2 Huge Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSubmitOrder('Nuovo')}
                      disabled={submitting || cartItems.length === 0}
                      className="w-full bg-[#5A5A40] hover:bg-[#4A4A30] disabled:bg-gray-300 text-white py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
                    >
                      <Check size={18} />
                      <span>{submitting ? 'Elaborazione...' : 'Invia Ordine Adesso'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSubmitOrder('Bozza')}
                      disabled={submitting || cartItems.length === 0}
                      className="w-full bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                    >
                      <FileText size={16} className="text-amber-500" />
                      <span>Salva come Bozza (In lavorazione)</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Client Picker Modal */}
      <AnimatePresence>
        {isClientPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClientPickerOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs pointer-events-auto cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-200 z-10 max-h-[90dvh] sm:max-h-[85dvh] flex flex-col pointer-events-auto pb-safe pb-[env(safe-area-inset-bottom,1.5rem)]"
            >
              <div className="flex justify-between items-center pb-4 border-b border-gray-100 shrink-0">
                <div>
                  <h3 className="text-lg font-black text-gray-900">Seleziona Cliente</h3>
                  <p className="text-xs text-gray-500">Scegli a chi intestare l'ordine</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClientPickerOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search input in modal */}
              <div className="py-3 shrink-0">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cerca cliente per nome, città, codice..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#5A5A40]"
                    autoFocus
                  />
                </div>
              </div>

              {/* Clients List */}
              <div className="flex-1 overflow-y-auto overscroll-contain space-y-2 py-2 pr-1">
                {filteredClients.map(c => {
                  const isSelected = String(c.id) === String(selectedClientId);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectClient(c)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected 
                          ? 'bg-[#5A5A40]/10 border-[#5A5A40] text-gray-900 font-bold' 
                          : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold truncate">{c.name}</span>
                          {c.code && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 font-mono px-1.5 py-0.5 rounded">
                              {c.code}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 block truncate">
                          {[c.city, c.province, c.phone].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                      {isSelected && <Check size={18} className="text-[#5A5A40] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Success Confirmation Modal */}
      <AnimatePresence>
        {orderSuccessModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs pointer-events-auto"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl text-center z-10 space-y-4 max-h-[90dvh] overflow-y-auto overscroll-contain pointer-events-auto pb-safe pb-[env(safe-area-inset-bottom,1.5rem)]"
            >
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <Check size={32} />
              </div>

              <div>
                <h3 className="text-xl font-black text-gray-900">
                  {orderSuccessModal.status === 'Bozza' ? 'Bozza Salvata!' : 'Ordine Trasmesso con Successo!'}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {orderSuccessModal.status === 'Bozza'
                    ? 'L\'ordine è stato salvato nelle tue bozze. Potrai riprenderlo e completarlo in qualsiasi momento da "Statistiche & Vendite".'
                    : 'L\'ordine è stato registrato ed è pronto per l\'elaborazione. Lo trovi nel tuo storico ordini.'}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left text-xs space-y-1.5">
                <div className="flex justify-between items-center pb-1 border-b border-gray-200/60">
                  <span className="font-bold text-gray-500">Documento:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {orderSuccessModal.orderNumber ? `#${orderSuccessModal.orderNumber}` : (orderSuccessModal.status === 'Bozza' ? 'Bozza' : 'Confermato')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cliente:</span>
                  <span className="font-bold text-gray-800">{selectedClient?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Articoli:</span>
                  <span className="font-bold text-gray-800">{totalItemsCount} pz ({cartItems.length} linee)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Totale Imponibile:</span>
                  <span className="font-bold text-gray-800 font-mono">€ {orderTotals.totalTaxable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Totale IVA:</span>
                  <span className="font-bold text-gray-800 font-mono">€ {orderTotals.totalVat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-200/60">
                  <span className="text-gray-700 font-bold">Totale Ordine (Ivato):</span>
                  <span className="font-black text-[#5A5A40] font-mono text-sm">€ {orderTotals.totalGross.toFixed(2)}</span>
                </div>
              </div>

              {/* Azioni Riepilogo Ordine: Copia, Stampa e PDF */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopySummary()}
                  className="bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-900 py-2.5 px-2 rounded-xl font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition-all active:scale-98 shadow-2xs cursor-pointer"
                  title="Copia testo formattato negli appunti"
                >
                  <Copy size={15} className="text-amber-700" />
                  <span className="truncate">Copia Testo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintOrder()}
                  className="bg-blue-50 hover:bg-blue-100 border border-blue-200/80 text-blue-900 py-2.5 px-2 rounded-xl font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition-all active:scale-98 shadow-2xs cursor-pointer"
                  title="Stampa documento ordine"
                >
                  <Printer size={15} className="text-blue-700" />
                  <span className="truncate">Stampa</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf()}
                  className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-900 py-2.5 px-2 rounded-xl font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition-all active:scale-98 shadow-2xs cursor-pointer"
                  title="Scarica documento in formato PDF A4"
                >
                  <Download size={15} className="text-emerald-700" />
                  <span className="truncate">Scarica PDF</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrderSuccessModal({ isOpen: false, status: 'Nuovo' });
                    navigate('/statistiche');
                  }}
                  className="w-full bg-[#5A5A40] hover:bg-[#4A4A30] text-white py-3 px-4 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
                >
                  Vai a Statistiche & Vendite
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderSuccessModal({ isOpen: false, status: 'Nuovo' });
                    setCartItems([]);
                    setSelectedClientId('');
                    setNotes('');
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Nuovo Ordine
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
