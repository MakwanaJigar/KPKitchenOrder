import React, { useCallback, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';

/* =========================================================
 * API
 * ========================================================= */

const BASE_API_URL = 'https://replete-software.com/projects/kp_admin/api';

const CUSTOMER_INVOICES_API = `${BASE_API_URL}/customer/invoices`;

/* =========================================================
 * TOKEN KEYS
 * ========================================================= */

const CUSTOMER_TOKEN_KEYS = [
  'token',
  '@kp_kitchen_customer_token',
  '@kp_customer_token',
  'customer_token',
];

/* =========================================================
 * FILTERS
 * ========================================================= */

const FILTER_OPTIONS = [
  {
    id: 'all',

    title: 'All Weeks',

    subtitle: 'All weekly billing invoices',
  },

  {
    id: 'paid',

    title: 'Paid',

    subtitle: 'Fully paid weekly invoices',
  },

  {
    id: 'unpaid',

    title: 'Unpaid',

    subtitle: 'Weekly invoices with an outstanding balance',
  },

  {
    id: 'overdue',

    title: 'Overdue',

    subtitle: 'Past-due weekly invoices',
  },
];

/* =========================================================
 * BASIC HELPERS
 * ========================================================= */

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
};

const parseMoney = value => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const number = Number(String(value).replace(/[^0-9.-]/g, ''));

  return Number.isFinite(number) ? number : 0;
};

const formatMoney = (value, currency = 'AUD') =>
  `${currency} ${parseMoney(value).toFixed(2)}`;

const normalizeStatus = value =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

/* =========================================================
 * DATE
 * ========================================================= */

const safeDate = value => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? new Date(value) : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = value => {
  const date = safeDate(value);

  if (!date) {
    return 'Not available';
  }

  return date.toLocaleDateString(
    'en-AU',

    {
      day: '2-digit',

      month: 'short',

      year: 'numeric',
    },
  );
};

const dateKey = value => {
  const date = safeDate(value);

  if (!date) {
    return '';
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,

    '0',
  )}-${String(date.getDate()).padStart(
    2,

    '0',
  )}`;
};

/* =========================================================
 * MONDAY - SUNDAY WEEK
 * ========================================================= */

const getWeekRange = value => {
  const source = safeDate(value);

  if (!source) {
    return null;
  }

  const working = new Date(source);

  working.setHours(0, 0, 0, 0);

  const day = working.getDay();

  const distanceToMonday = day === 0 ? -6 : 1 - day;
  // const distanceToMonday = day === 0 ;

  const start = new Date(working);

  start.setDate(working.getDate() + distanceToMonday);

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  end.setDate(start.getDate() + 6);

  end.setHours(23, 59, 59, 999);

  return {
    start,

    end,

    key: dateKey(start),
  };
};

/* =========================================================
 * CURRENT BILLING CYCLE
 * ========================================================= */

const getCurrentBillingCycle = (value = new Date()) => {
  const currentWeek = getWeekRange(value);

  if (!currentWeek?.start) {
    return null;
  }

  const start = new Date(currentWeek.start);

  start.setHours(0, 0, 0, 0);

  const nextMonday = new Date(start);

  nextMonday.setDate(nextMonday.getDate() + 7);

  nextMonday.setHours(0, 0, 0, 0);

  return {
    start,

    nextMonday,
  };
};

/* =========================================================
 * CURRENT WEEK CHECK
 * ========================================================= */

const isCurrentWeekInvoice = invoice => {
  if (!invoice) {
    return false;
  }

  const cycle = getCurrentBillingCycle();

  if (!cycle) {
    return false;
  }

  const invoiceDate =
    safeDate(invoice?.startDate) ??
    safeDate(invoice?.createdAt) ??
    safeDate(invoice?.endDate);

  if (!invoiceDate) {
    return false;
  }

  invoiceDate.setHours(0, 0, 0, 0);

  return invoiceDate >= cycle.start && invoiceDate < cycle.nextMonday;
};

/* =========================================================
 * GENERATED CHECK
 * =========================================================
 *
 * Only show invoices the backend has actually generated.
 * An invoice is hidden while:
 *  - the backend flags it as not generated / draft, or
 *  - its billing week is still open (unpaid and not ended yet).
 * ========================================================= */

const NOT_GENERATED_STATUSES = [
  'draft',
  'not_generated',
  'pending_generation',
  'generating',
  'in_progress',
  'open',
];

const isFalseFlag = value =>
  value === false || value === 0 || value === '0' || value === 'false';

const isBackendGenerated = invoice => {
  const raw = invoice?.raw ?? {};

  if (
    isFalseFlag(raw?.is_generated) ||
    isFalseFlag(raw?.isGenerated) ||
    isFalseFlag(raw?.generated)
  ) {
    return false;
  }

  return !NOT_GENERATED_STATUSES.includes(normalizeStatus(invoice?.status));
};

const isBillingPeriodClosed = invoice => {
  if (!invoice || invoice.paid) {
    return true;
  }

  if (isCurrentWeekInvoice(invoice)) {
    return false;
  }

  const end = safeDate(invoice.endDate);

  return !end || end.getTime() < Date.now();
};

/* =========================================================
 * PAGINATION
 * ========================================================= */

const PAGE_SIZE = 4;

/* =========================================================
 * TOKEN
 * ========================================================= */

const getCustomerToken = async () => {
  for (const key of CUSTOMER_TOKEN_KEYS) {
    try {
      const token = await AsyncStorage.getItem(key);

      if (token && String(token).trim()) {
        return String(token).trim();
      }
    } catch (error) {
      console.log('TOKEN READ ERROR:', error);
    }
  }

  return null;
};

/* =========================================================
 * JSON
 * ========================================================= */

const readJsonResponse = async response => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.log('RAW INVOICE RESPONSE:', text);

    throw new Error('The invoice server returned an invalid response.');
  }
};

/* =========================================================
 * EXTRACT INVOICE ARRAY
 * ========================================================= */

const extractInvoicesArray = responseData => {
  const values = [
    responseData?.invoices,
    responseData?.invoices?.data,

    responseData?.weekly_bills,
    responseData?.weeklyBills,
    responseData?.weekly_bills?.data,
    responseData?.weeklyBills?.data,

    responseData?.bills,
    responseData?.bills?.data,

    responseData?.data?.invoices,
    responseData?.data?.invoices?.data,

    responseData?.data?.weekly_bills,
    responseData?.data?.weeklyBills,
    responseData?.data?.weekly_bills?.data,
    responseData?.data?.weeklyBills?.data,

    responseData?.data?.bills,
    responseData?.data?.bills?.data,

    responseData?.data?.data,
    responseData?.data,
    responseData,
  ];

  const arrays = values.filter(Array.isArray);

  /*
   * Important:
   * invoices: [] must not hide a populated weekly_bills array.
   */
  return arrays.find(items => items.length > 0) ?? arrays[0] ?? [];
};

/* =========================================================
 * NORMALIZE INVOICE
 * ========================================================= */

const normalizeInvoice = (rawInvoice, index) => {
  if (!rawInvoice) {
    return null;
  }

  const id = firstValue(
    rawInvoice?.id,
    rawInvoice?.invoice_id,
    rawInvoice?.invoiceId,
    rawInvoice?.bill_id,
    rawInvoice?.billId,
    index + 1,
  );

  const weeklyBillId = firstValue(
    rawInvoice?.weekly_bill_id,
    rawInvoice?.weeklyBillId,
    rawInvoice?.weekly_bill?.id,
    rawInvoice?.weeklyBill?.id,
    rawInvoice?.bill?.weekly_bill_id,
    rawInvoice?.bill?.weeklyBillId,
  );

  const invoiceNumber = firstValue(
    rawInvoice?.invoice_number,
    rawInvoice?.invoiceNumber,
    rawInvoice?.invoice_no,
    rawInvoice?.bill_number,
    rawInvoice?.billNumber,
    rawInvoice?.bill_no,
    rawInvoice?.number,
    `INV-${id}`,
  );

  const totalAmount = parseMoney(
    firstValue(
      rawInvoice?.total_amount,
      rawInvoice?.totalAmount,

      rawInvoice?.invoice_total,
      rawInvoice?.invoiceTotal,

      rawInvoice?.invoice_amount,
      rawInvoice?.invoiceAmount,

      rawInvoice?.grand_total,
      rawInvoice?.grandTotal,

      rawInvoice?.bill_amount,
      rawInvoice?.billAmount,

      rawInvoice?.payable_amount,
      rawInvoice?.payableAmount,

      rawInvoice?.total_due,
      rawInvoice?.totalDue,

      rawInvoice?.amount,
      rawInvoice?.total,

      0,
    ),
  );

  const explicitBalance = firstValue(
    rawInvoice?.balance_amount,
    rawInvoice?.balanceAmount,
    rawInvoice?.balance,

    rawInvoice?.outstanding_amount,
    rawInvoice?.outstandingAmount,

    rawInvoice?.outstanding_balance,
    rawInvoice?.outstandingBalance,

    rawInvoice?.amount_due,
    rawInvoice?.amountDue,

    rawInvoice?.due_amount,
    rawInvoice?.dueAmount,

    rawInvoice?.remaining_amount,
    rawInvoice?.remainingAmount,

    rawInvoice?.remaining_balance,
    rawInvoice?.remainingBalance,

    rawInvoice?.pending_amount,
    rawInvoice?.pendingAmount,

    rawInvoice?.unpaid_amount,
    rawInvoice?.unpaidAmount,

    rawInvoice?.payable_amount,
    rawInvoice?.payableAmount,
  );

  const explicitPaidAmount = firstValue(
    rawInvoice?.paid_amount,
    rawInvoice?.paidAmount,
    rawInvoice?.amount_paid,
    rawInvoice?.amountPaid,
    rawInvoice?.payment_amount,
  );

  let balanceAmount =
    explicitBalance !== null ? parseMoney(explicitBalance) : totalAmount;

  let paidAmount =
    explicitPaidAmount !== null ? parseMoney(explicitPaidAmount) : 0;

  const status = String(
    firstValue(
      rawInvoice?.payment_status,
      rawInvoice?.paymentStatus,

      rawInvoice?.invoice_status,
      rawInvoice?.invoiceStatus,

      rawInvoice?.bill_status,
      rawInvoice?.billStatus,

      rawInvoice?.status,

      'Pending',
    ),
  );

  const normalizedStatus = normalizeStatus(status);

  const explicitPaid = firstValue(
    rawInvoice?.is_paid,
    rawInvoice?.isPaid,
    rawInvoice?.paid,
  );

  let paid =
    explicitPaid === true || explicitPaid === 1 || explicitPaid === '1';

  if (
    [
      'paid',
      'completed',
      'settled',
      'fully_paid',
      'payment_completed',
      'success',
    ].includes(normalizedStatus)
  ) {
    paid = true;
  }

  /*
   * If backend explicitly sends balance = 0,
   * that is authoritative.
   */
  if (explicitBalance !== null && balanceAmount <= 0) {
    paid = true;
  }

  if (paid) {
    balanceAmount = 0;

    if (explicitPaidAmount === null) {
      paidAmount = totalAmount;
    }
  } else {
    if (explicitBalance === null) {
      balanceAmount = Math.max(
        0,

        totalAmount - paidAmount,
      );
    }

    if (explicitPaidAmount === null && totalAmount > balanceAmount) {
      paidAmount = Math.max(
        0,

        totalAmount - balanceAmount,
      );
    }
  }

  const startDate = firstValue(
    rawInvoice?.start_date,
    rawInvoice?.startDate,
    rawInvoice?.week_start_date,
    rawInvoice?.week_start,
    rawInvoice?.billing_start,
    rawInvoice?.billing_start_date,
    rawInvoice?.period_start,
    rawInvoice?.from_date,
    rawInvoice?.cycle_start,
    rawInvoice?.cycleStart,
  );

  const endDate = firstValue(
    rawInvoice?.end_date,
    rawInvoice?.endDate,
    rawInvoice?.week_end_date,
    rawInvoice?.week_end,
    rawInvoice?.billing_end,
    rawInvoice?.billing_end_date,
    rawInvoice?.period_end,
    rawInvoice?.to_date,
    rawInvoice?.cycle_end,
    rawInvoice?.cycleEnd,
  );

  const dueDate = firstValue(
    rawInvoice?.due_date,
    rawInvoice?.dueDate,
    rawInvoice?.payment_due_date,
    rawInvoice?.paymentDueDate,
    rawInvoice?.due_on,
    rawInvoice?.dueOn,
    rawInvoice?.due_at,
    rawInvoice?.dueAt,
  );

  const createdAt = firstValue(
    rawInvoice?.created_at,
    rawInvoice?.createdAt,
    rawInvoice?.generated_at,
    rawInvoice?.generatedAt,
    rawInvoice?.invoice_date,
    rawInvoice?.invoiceDate,
    rawInvoice?.date,
  );

  const paidAt = firstValue(
    rawInvoice?.paid_at,
    rawInvoice?.paidAt,
    rawInvoice?.payment_date,
    rawInvoice?.paymentDate,
    rawInvoice?.paid_date,
  );

  const due = safeDate(dueDate);

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const overdueStatuses = ['overdue', 'over_due', 'past_due', 'pastdue'];

  const overdue = Boolean(
    !paid &&
      balanceAmount > 0 &&
      (overdueStatuses.includes(normalizedStatus) || (due && due < today)),
  );

  const orders = Array.isArray(rawInvoice?.orders)
    ? rawInvoice.orders
    : Array.isArray(rawInvoice?.order_details)
    ? rawInvoice.order_details
    : Array.isArray(rawInvoice?.items)
    ? rawInvoice.items
    : Array.isArray(rawInvoice?.invoice_items)
    ? rawInvoice.invoice_items
    : [];

  return {
    id: String(id),

    invoiceNumber: String(invoiceNumber),

    weeklyBillId:
      weeklyBillId !== null && weeklyBillId !== undefined && weeklyBillId !== ''
        ? String(weeklyBillId)
        : null,

    status,

    paid,

    overdue,

    totalAmount,

    paidAmount,

    balanceAmount,

    currency: String(
      firstValue(
        rawInvoice?.currency,
        rawInvoice?.currency_code,
        rawInvoice?.currencyCode,
        'AUD',
      ),
    ).toUpperCase(),

    startDate,

    endDate,

    dueDate,

    createdAt,

    paidAt,

    paymentMethod: String(
      firstValue(
        rawInvoice?.payment_method,
        rawInvoice?.paymentMethod,
        rawInvoice?.payment_type,
        rawInvoice?.paymentType,
        '',
      ),
    ),

    orders,

    raw: rawInvoice,
  };
};

/* =========================================================
 * GROUPING DATE
 * ========================================================= */

const getGroupingDate = invoice =>
  safeDate(invoice?.startDate) ??
  safeDate(invoice?.createdAt) ??
  safeDate(invoice?.endDate) ??
  safeDate(invoice?.dueDate);

/* =========================================================
 * CREATE WHOLE WEEK INVOICE
 * ========================================================= */

const createWeeklyInvoice = (weekKey, weekRange, invoices) => {
  if (!invoices.length) {
    return null;
  }

  const sourceInvoiceIds = [...new Set(invoices.map(item => String(item.id)))];

  const weeklyBillIds = [
    ...new Set(
      invoices
        .map(item => item.weeklyBillId)
        .filter(value => value !== null && value !== undefined && value !== '')
        .map(String),
    ),
  ];

  /*
   * Payment API can only use one real weekly bill ID.
   * Never silently choose one ID when a grouped week
   * contains multiple different IDs.
   */
  const paymentBillId =
    weeklyBillIds.length === 1
      ? weeklyBillIds[0]
      : invoices.length === 1 && invoices[0].weeklyBillId
      ? String(invoices[0].weeklyBillId)
      : null;

  /*
   * When invoices are grouped by weekly_bill_id there is no
   * pre-computed Monday-Sunday range to fall back on. Derive the
   * display period directly from the invoices themselves so it
   * still represents exactly what this bill covers.
   */
  const derivedRange =
    weekRange ??
    (() => {
      const starts = invoices
        .map(item => safeDate(item.startDate))
        .filter(Boolean);

      const ends = invoices.map(item => safeDate(item.endDate)).filter(Boolean);

      return {
        start: starts.length
          ? new Date(Math.min(...starts.map(date => date.getTime())))
          : null,

        end: ends.length
          ? new Date(Math.max(...ends.map(date => date.getTime())))
          : null,
      };
    })();

  const totalAmount = invoices.reduce(
    (sum, item) => sum + parseMoney(item.totalAmount),

    0,
  );

  const paidAmount = invoices.reduce(
    (sum, item) => sum + parseMoney(item.paidAmount),

    0,
  );

  const balanceAmount = invoices.reduce(
    (sum, item) => sum + (item.paid ? 0 : parseMoney(item.balanceAmount)),

    0,
  );

  const paid = balanceAmount <= 0 || invoices.every(item => item.paid);

  const overdue = !paid && invoices.some(item => item.overdue);

  const orders = [];

  invoices.forEach(item => {
    if (Array.isArray(item.orders) && item.orders.length) {
      orders.push(...item.orders);

      return;
    }

    orders.push({
      id: item.id,

      order_id: firstValue(item.raw?.order_id, item.raw?.orderId, item.id),

      order_number: firstValue(
        item.raw?.order_number,
        item.raw?.order_no,
        item.id,
      ),

      name: firstValue(
        item.raw?.tiffin_name,
        item.raw?.name,
        item.raw?.tiffin?.name,
        'Tiffin Order',
      ),

      quantity: Number(firstValue(item.raw?.quantity, item.raw?.qty, 1)) || 1,

      total_amount: item.totalAmount,

      total: item.totalAmount,

      created_at: item.createdAt,
    });
  });

  const dueDates = invoices.map(item => safeDate(item.dueDate)).filter(Boolean);

  const paidDates = invoices.map(item => safeDate(item.paidAt)).filter(Boolean);

  const createdDates = invoices
    .map(item => safeDate(item.createdAt))
    .filter(Boolean);

  const dueDate = dueDates.length
    ? new Date(Math.max(...dueDates.map(date => date.getTime())))
    : null;

  const paidAt = paidDates.length
    ? new Date(Math.max(...paidDates.map(date => date.getTime())))
    : null;

  const createdAt = createdDates.length
    ? new Date(Math.max(...createdDates.map(date => date.getTime())))
    : derivedRange.end;

  return {
    id: paymentBillId ?? `weekly-${weekKey}`,

    invoiceNumber:
      paymentBillId && invoices.length === 1
        ? invoices[0].invoiceNumber
        : paymentBillId
        ? `BILL-${paymentBillId}`
        : `WEEK-${weekKey}`,

    weeklyBillId: paymentBillId,

    paymentBillId,

    weeklyBillIds,

    sourceInvoiceIds,

    sourceInvoiceCount: invoices.length,

    sourceInvoices: invoices.map(item => ({
      id: item.id,

      invoiceNumber: item.invoiceNumber,

      weeklyBillId: item.weeklyBillId,

      totalAmount: item.totalAmount,

      paidAmount: item.paidAmount,

      balanceAmount: item.balanceAmount,

      paid: item.paid,

      overdue: item.overdue,

      status: item.status,

      startDate: item.startDate,

      endDate: item.endDate,

      dueDate: item.dueDate,

      createdAt: item.createdAt,

      currency: item.currency,

      orders: item.orders,
    })),

    status: paid ? 'Paid' : overdue ? 'Overdue' : 'Payment Due',

    paid,

    overdue,

    totalAmount: Number(totalAmount.toFixed(2)),

    paidAmount: Number(paidAmount.toFixed(2)),

    balanceAmount: Number(balanceAmount.toFixed(2)),

    currency: invoices.find(item => item.currency)?.currency ?? 'AUD',

    startDate: derivedRange.start,

    endDate: derivedRange.end,

    dueDate,

    createdAt,

    paidAt,

    paymentMethod:
      invoices.find(item => item.paymentMethod)?.paymentMethod ?? '',

    orderCount: orders.length,

    orders,

    isWeeklyInvoice: true,
  };
};

/* =========================================================
 * GROUP ALL INVOICES BY THEIR WEEKLY BILL
 * ========================================================= */

/*
 * IMPORTANT:
 * PaymentDetails charges by summing every invoice that shares the
 * same weekly_bill_id, with no date-range restriction. If this
 * screen grouped invoices by a client-guessed Monday-Sunday date
 * window instead, the total shown here could disagree with the
 * total PaymentDetails actually charges through Stripe for the same
 * bill. Group by weekly_bill_id first so both screens always sum
 * the exact same set of invoices. Only fall back to date-based
 * grouping for invoices that have no weekly_bill_id at all.
 */
const groupInvoicesByWeek = invoices => {
  const groups = {};

  invoices.forEach((invoice, index) => {
    const billId =
      invoice.weeklyBillId !== null &&
      invoice.weeklyBillId !== undefined &&
      invoice.weeklyBillId !== ''
        ? String(invoice.weeklyBillId)
        : null;

    let key;

    let range = null;

    if (billId) {
      key = `bill-${billId}`;
    } else {
      const groupingDate = getGroupingDate(invoice);

      range = groupingDate ? getWeekRange(groupingDate) : null;

      key = range?.key ?? `unknown-${invoice.id ?? index}`;
    }

    if (!groups[key]) {
      groups[key] = {
        range,

        invoices: [],
      };
    }

    groups[key].invoices.push(invoice);
  });

  return Object.entries(groups)
    .map(([key, group]) =>
      createWeeklyInvoice(key, group.range, group.invoices),
    )
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = safeDate(a.endDate)?.getTime() ?? 0;

      const bTime = safeDate(b.endDate)?.getTime() ?? 0;

      return bTime - aTime;
    });
};

/* =========================================================
 * ORDER HELPERS
 * ========================================================= */

const getOrderId = order =>
  firstValue(
    order?.order_number,
    order?.order_no,
    order?.order_id,
    order?.orderId,
    order?.id,
    '—',
  );

const getOrderName = order =>
  firstValue(
    order?.tiffin_name,
    order?.tiffin?.name,
    order?.product_name,
    order?.product?.name,
    order?.name,
    'Tiffin Order',
  );

const getOrderQuantity = order =>
  Number(firstValue(order?.quantity, order?.qty, 1)) || 1;

const getOrderAmount = order =>
  parseMoney(
    firstValue(
      order?.total_amount,
      order?.grand_total,
      order?.line_total,
      order?.amount,
      order?.total,
      order?.price,
      0,
    ),
  );

/* =========================================================
 * MAIN COMPONENT
 * ========================================================= */

const WeeklyInvoice = ({ navigation }) => {
  const { width } = useWindowDimensions();

  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');

  const [selectedFilter, setSelectedFilter] = useState('all');

  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  const [paymentAlertVisible, setPaymentAlertVisible] = useState(false);

  const [selectedPaymentInvoice, setSelectedPaymentInvoice] = useState(null);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const responsive = useMemo(
    () => ({
      width: width >= 768 ? Math.min(width, 720) : width,

      padding: width >= 768 ? 24 : width <= 360 ? 12 : 16,
    }),

    [width],
  );

  const fetchInvoices = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError('');

        const token = await getCustomerToken();

        if (!token) {
          throw new Error(
            'Your login session has expired. Please login again.',
          );
        }

        const response = await fetch(
          `${CUSTOMER_INVOICES_API}?_=${Date.now()}`,

          {
            method: 'GET',

            headers: {
              Accept: 'application/json',

              Authorization: `Bearer ${token}`,

              'Cache-Control': 'no-cache',

              Pragma: 'no-cache',
            },
          },
        );

        const result = await readJsonResponse(response);

        console.log(
          'WEEKLY INVOICE API RESPONSE:',

          JSON.stringify(result, null, 2),
        );

        if (!response.ok || result?.success === false) {
          throw new Error(
            result?.message ?? result?.error ?? 'Unable to retrieve invoices.',
          );
        }

        const normalized = extractInvoicesArray(result)
          .map((invoice, index) => normalizeInvoice(invoice, index))
          .filter(Boolean)
          .filter(isBackendGenerated);

        const grouped = groupInvoicesByWeek(normalized).filter(
          isBillingPeriodClosed,
        );

        console.log(
          'WEEKLY INVOICE NORMALIZED:',

          JSON.stringify(
            grouped.map(item => ({
              id: item.id,

              paymentBillId: item.paymentBillId,

              weeklyBillIds: item.weeklyBillIds,

              sourceInvoiceIds: item.sourceInvoiceIds,

              totalAmount: item.totalAmount,

              balanceAmount: item.balanceAmount,

              paid: item.paid,

              overdue: item.overdue,
            })),

            null,

            2,
          ),
        );

        setInvoices(grouped);

        setVisibleCount(PAGE_SIZE);
      } catch (err) {
        console.log('WEEKLY INVOICE ERROR:', err);

        setInvoices([]);

        setError(err?.message ?? 'Unable to load your weekly invoices.');
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },

    [],
  );

  useFocusEffect(
    useCallback(() => {
      fetchInvoices(true);

      return () => {};
    }, [fetchInvoices]),
  );

  const paidInvoices = useMemo(
    () => invoices.filter(item => item.paid),

    [invoices],
  );

  const unpaidInvoices = useMemo(
    () =>
      invoices.filter(item => !item.paid && parseMoney(item.balanceAmount) > 0),

    [invoices],
  );

  const overdueInvoices = useMemo(
    () => invoices.filter(item => item.overdue),

    [invoices],
  );

  const filteredInvoices = useMemo(() => {
    if (selectedFilter === 'paid') {
      return paidInvoices;
    }

    if (selectedFilter === 'unpaid') {
      return unpaidInvoices;
    }

    if (selectedFilter === 'overdue') {
      return overdueInvoices;
    }

    return invoices;
  }, [selectedFilter, invoices, paidInvoices, unpaidInvoices, overdueInvoices]);

  const visibleInvoices = useMemo(
    () => filteredInvoices.slice(0, visibleCount),

    [filteredInvoices, visibleCount],
  );

  const hasMoreInvoices = visibleCount < filteredInvoices.length;

  const selectedFilterData =
    FILTER_OPTIONS.find(item => item.id === selectedFilter) ??
    FILTER_OPTIONS[0];

  const totalAmount = useMemo(
    () =>
      invoices.reduce(
        (sum, item) => sum + parseMoney(item.totalAmount),

        0,
      ),

    [invoices],
  );

  const paidAmount = useMemo(
    () =>
      invoices.reduce(
        (sum, item) => sum + parseMoney(item.paidAmount),

        0,
      ),

    [invoices],
  );

  const dueAmount = useMemo(
    () =>
      invoices.reduce(
        (sum, item) => sum + (item.paid ? 0 : parseMoney(item.balanceAmount)),

        0,
      ),

    [invoices],
  );

  const openPayBill = invoice => {
    if (
      !invoice ||
      invoice.paid ||
      isCurrentWeekInvoice(invoice) ||
      parseMoney(invoice.balanceAmount) <= 0
    ) {
      return;
    }

    /*
     * If a grouped week has multiple rows but no one
     * shared weekly_bill_id, PaymentDetails must not
     * guess an invoice ID as the weekly bill ID.
     */
    if (!invoice.paymentBillId && (invoice.sourceInvoiceIds?.length ?? 0) > 1) {
      setSelectedPaymentInvoice(invoice);

      setPaymentAlertVisible(true);

      return;
    }

    setSelectedPaymentInvoice(invoice);

    setPaymentAlertVisible(true);
  };

  const continueToPayment = () => {
    const invoice = selectedPaymentInvoice;

    if (!invoice || isCurrentWeekInvoice(invoice)) {
      setPaymentAlertVisible(false);

      setSelectedPaymentInvoice(null);

      return;
    }

    /*
     * Never navigate to payment for a multi-row week
     * when the API did not provide one shared weekly bill ID.
     */
    if (!invoice.paymentBillId && (invoice.sourceInvoiceIds?.length ?? 0) > 1) {
      return;
    }

    setPaymentAlertVisible(false);

    setSelectedPaymentInvoice(null);

    setTimeout(
      () => {
        navigation.navigate('PaymentDetails', buildPaymentParams(invoice));
      },

      100,
    );
  };

  const openInvoiceDetails = invoice => {
    const isCurrentWeek = isCurrentWeekInvoice(invoice);

    const canPay =
      !invoice.paid && !isCurrentWeek && parseMoney(invoice.balanceAmount) > 0;

    const payable =
      canPay &&
      (invoice.paymentBillId || (invoice.sourceInvoiceIds?.length ?? 0) <= 1);

    /*
     * JSON round-trip turns Date objects into ISO strings so
     * navigation params stay serializable.
     */
    navigation.navigate('InvoiceDetails', {
      invoice: JSON.parse(JSON.stringify(invoice)),

      paymentParams: payable
        ? JSON.parse(JSON.stringify(buildPaymentParams(invoice)))
        : null,
    });
  };

  const buildPaymentParams = invoice => ({
    weeklyPayment: true,

    invoiceId: invoice.id,

    invoiceNumber: invoice.invoiceNumber,

    paymentBillId: invoice.paymentBillId ?? null,

    weeklyBillId: invoice.paymentBillId ?? null,

    weeklyBillIds: invoice.weeklyBillIds ?? [],

    sourceInvoiceIds: invoice.sourceInvoiceIds ?? [],

    sourceInvoiceCount: invoice.sourceInvoiceCount ?? 1,

    sourceInvoices: invoice.sourceInvoices ?? [],

    orders: invoice.orders ?? [],

    /*
     * These values are only a display/fallback snapshot.
     * PaymentDetails will replace them with the live
     * /customer/invoices values when available.
     */
    totalAmount: parseMoney(invoice.totalAmount),

    paidAmount: parseMoney(invoice.paidAmount),

    balanceAmount: parseMoney(invoice.balanceAmount),

    currency: invoice.currency ?? 'AUD',

    status: invoice.status,

    overdue: Boolean(invoice.overdue),

    startDate: invoice.startDate,

    endDate: invoice.endDate,

    dueDate: invoice.dueDate,

    createdAt: invoice.createdAt,

    source: 'WeeklyInvoice',
  });

  const renderInvoice = ({ item }) => {
    const expanded = expandedInvoiceId === item.id;

    const isCurrentWeek = isCurrentWeekInvoice(item);

    const canPay =
      !item.paid && !isCurrentWeek && parseMoney(item.balanceAmount) > 0;

    return (
      <Pressable
        style={styles.invoiceCard}
        onPress={() => openInvoiceDetails(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.invoiceIcon}>
            <Ionicons name="receipt-outline" size={22} color="#A9090D" />
          </View>

          <View style={styles.cardHeaderMain}>
            <Text style={styles.eyebrow}>WEEKLY INVOICE</Text>

            <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>

            <Text style={styles.period}>
              {formatDate(item.startDate)} – {formatDate(item.endDate)}
            </Text>
          </View>

          <View style={styles.amountArea}>
            <Text style={styles.smallLabel}>WEEK TOTAL</Text>

            <Text style={styles.weekAmount}>
              {formatMoney(
                item.totalAmount,

                item.currency,
              )}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,

              item.paid
                ? styles.paidBadge
                : item.overdue
                ? styles.overdueBadge
                : styles.dueBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,

                item.paid
                  ? styles.paidText
                  : item.overdue
                  ? styles.overdueText
                  : styles.dueText,
              ]}
            >
              {item.paid
                ? 'Paid'
                : item.overdue
                ? 'Overdue'
                : isCurrentWeek
                ? 'Current Week'
                : 'Payment Due'}
            </Text>
          </View>

          <Text style={styles.weekLabel}>Monday – Sunday</Text>
        </View>

        <View style={styles.divider} />

        <InfoLine label="Orders / Tiffins" value={String(item.orderCount)} />

        <InfoLine label="Generated" value={formatDate(item.createdAt)} />

        <InfoLine label="Due Date" value={formatDate(item.dueDate)} />

        <InfoLine
          label="Weekly Bill ID"
          value={
            item.paymentBillId
              ? String(item.paymentBillId)
              : 'Not returned by API'
          }
        />

        <View style={styles.divider} />

        <AmountLine
          label="Weekly Total"
          value={formatMoney(
            item.totalAmount,

            item.currency,
          )}
        />

        <AmountLine
          label="Amount Paid"
          value={formatMoney(
            item.paidAmount,

            item.currency,
          )}
          type="paid"
        />

        <AmountLine
          label="Balance Due"
          value={formatMoney(
            item.balanceAmount,

            item.currency,
          )}
          type={item.balanceAmount > 0 ? 'due' : 'paid'}
        />

        {isCurrentWeek && !item.paid && parseMoney(item.balanceAmount) > 0 && (
          <View style={styles.currentWeekNotice}>
            <View style={styles.currentWeekIcon}>
              <Ionicons name="time-outline" size={18} color="#A9090D" />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.currentWeekTitle}>Current Billing Week</Text>

              <Text style={styles.currentWeekText}>
                Payment will be available after this Monday-to-Monday billing
                cycle is completed.
              </Text>
            </View>
          </View>
        )}

        {item.orders.length > 0 && (
          <>
            <Pressable
              style={styles.expandButton}
              onPress={() => setExpandedInvoiceId(expanded ? null : item.id)}
            >
              <Text style={styles.expandText}>
                {expanded
                  ? 'Hide Weekly Orders'
                  : `View ${item.orders.length} Orders`}
              </Text>

              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={17}
                color="#A9090D"
              />
            </Pressable>

            {expanded && (
              <View style={styles.ordersBox}>
                {item.orders.map((order, index) => (
                  <View
                    key={`${item.id}-${getOrderId(order)}-${index}`}
                    style={styles.orderRow}
                  >
                    <View style={styles.orderIcon}>
                      <Ionicons
                        name="restaurant-outline"
                        size={16}
                        color="#A9090D"
                      />
                    </View>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text style={styles.orderNumber}>
                        Order #{String(getOrderId(order))}
                      </Text>

                      <Text style={styles.orderName}>
                        {String(getOrderName(order))}
                      </Text>

                      <Text style={styles.orderQty}>
                        Qty: {getOrderQuantity(order)}
                      </Text>
                    </View>

                    <Text style={styles.orderAmount}>
                      {formatMoney(
                        getOrderAmount(order),

                        item.currency,
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {canPay && (
          <Pressable
            style={[styles.payButton, item.overdue && styles.payButtonOverdue]}
            onPress={() => openPayBill(item)}
          >
            <View style={styles.payIcon}>
              <Ionicons
                name={item.overdue ? 'alert-circle-outline' : 'card-outline'}
                size={21}
                color={item.overdue ? '#B42318' : '#A9090D'}
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={[
                  styles.payTitle,

                  item.overdue && {
                    color: '#B42318',
                  },
                ]}
              >
                {item.overdue
                  ? 'PAY OVERDUE WEEKLY BILL'
                  : 'PAY WHOLE WEEK BILL'}
              </Text>

              <Text style={styles.paySubtitle}>
                One payment clears all tiffins from this billing week.
              </Text>
            </View>

            <Text
              style={[
                styles.payAmount,

                item.overdue && {
                  color: '#B42318',
                },
              ]}
            >
              {formatMoney(
                item.balanceAmount,

                item.currency,
              )}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={styles.detailsLink}
          onPress={() => openInvoiceDetails(item)}
        >
          <Text style={styles.detailsLinkText}>View Invoice Details</Text>

          <Ionicons name="chevron-forward" size={16} color="#A9090D" />
        </Pressable>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF9F6" />

        <Header navigation={navigation} />

        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#A9090D" />

          <Text style={styles.loadingTitle}>Loading Invoices</Text>

          <Text style={styles.loadingSubtitle}>
            Preparing your weekly billing details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF9F6" />

      <View
        style={[
          styles.container,

          {
            width: responsive.width,
          },
        ]}
      >
        <Header navigation={navigation} />

        {!!error && (
          <View
            style={[
              styles.errorBox,

              {
                marginHorizontal: responsive.padding,
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={20} color="#A9090D" />

            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FlatList
          data={visibleInvoices}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderInvoice}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);

                fetchInvoices(false);
              }}
              colors={['#A9090D']}
              tintColor="#A9090D"
            />
          }
          contentContainerStyle={{
            paddingHorizontal: responsive.padding,

            paddingTop: 18,

            paddingBottom: 60,

            flexGrow: 1,
          }}
          ListHeaderComponent={
            <>
              <View style={styles.summaryHeader}>
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text style={styles.eyebrow}>WEEKLY BILLING</Text>

                  <Text style={styles.sectionTitle}>Invoice Summary</Text>

                  <Text style={styles.summaryText}>
                    Each Monday–Sunday period is combined into one payable
                    weekly bill.
                  </Text>
                </View>

                <View style={styles.weekCount}>
                  <Text style={styles.weekCountNumber}>{invoices.length}</Text>

                  <Text style={styles.weekCountLabel}>WEEKS</Text>
                </View>
              </View>

              <View style={styles.summaryCards}>
                <SummaryBox label="TOTAL" value={totalAmount} color="#A9090D" />

                <SummaryBox label="PAID" value={paidAmount} color="#278850" />

                <SummaryBox label="DUE" value={dueAmount} color="#B87300" />
              </View>

              {/* <View style={styles.billingCycleCard}>
                <View style={styles.billingCycleIcon}>
                  <Ionicons name="calendar-outline" size={20} color="#A9090D" />
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text style={styles.billingCycleTitle}>
                    Weekly Payment Cycle
                  </Text>

                  <Text style={styles.billingCycleText}>
                    Current-week invoices are visible but cannot be paid before
                    the billing cycle closes. Overdue bills remain available for
                    payment.
                  </Text>
                </View>
              </View> */}

              <View style={styles.listHeader}>
                <View>
                  <Text style={styles.eyebrow}>INVOICE HISTORY</Text>

                  <Text style={styles.sectionTitle}>Your Invoices</Text>

                  <Text style={styles.listSubtitle}>
                    {filteredInvoices.length}{' '}
                    {filteredInvoices.length === 1
                      ? 'weekly invoice'
                      : 'weekly invoices'}
                  </Text>
                </View>

                <Pressable
                  style={styles.filterButton}
                  onPress={() => setFilterModalVisible(true)}
                >
                  <Text numberOfLines={1} style={styles.filterText}>
                    {selectedFilterData.title}
                  </Text>
                </Pressable>
              </View>
            </>
          }
          ListFooterComponent={
            hasMoreInvoices ? (
              <TouchableOpacity
                style={styles.showMoreButton}
                activeOpacity={0.85}
                onPress={() => setVisibleCount(count => count + PAGE_SIZE)}
              >
                <Text style={styles.showMoreText}>
                  Show More ({filteredInvoices.length - visibleCount} remaining)
                </Text>

                <Ionicons name="chevron-down" size={16} color="#A9090D" />
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              {/* <Ionicons name="receipt-outline" size={38} color="#B9AEB2" /> */}

              <Text style={styles.emptyTitle}>No Invoices Found</Text>

              <Text style={styles.emptyText}>
                {selectedFilter === 'all'
                  ? 'No billing records are currently available.'
                  : 'No billing records match the selected filter.'}
              </Text>

              {selectedFilter !== 'all' && (
                <TouchableOpacity
                  style={styles.showAllButton}
                  onPress={() => {
                    setSelectedFilter('all');

                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  <Text style={styles.showAllButtonText}>Show All Weeks</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </View>

      <Modal
        visible={paymentAlertVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setPaymentAlertVisible(false);

          setSelectedPaymentInvoice(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => {
              setPaymentAlertVisible(false);

              setSelectedPaymentInvoice(null);
            }}
          />

          <View style={styles.alertCard}>
            <View
              style={[
                styles.alertIcon,

                selectedPaymentInvoice?.overdue && {
                  backgroundColor: '#FEE4E2',
                },
              ]}
            >
              <Ionicons
                name={
                  selectedPaymentInvoice?.overdue
                    ? 'alert-circle-outline'
                    : 'card-outline'
                }
                size={34}
                color={selectedPaymentInvoice?.overdue ? '#B42318' : '#A9090D'}
              />
            </View>

            <Text style={styles.alertEyebrow}>KP CLOUD KITCHEN</Text>

            <Text style={styles.alertTitle}>
              {selectedPaymentInvoice?.overdue
                ? 'Overdue Weekly Payment'
                : 'Pay Whole Week Bill'}
            </Text>

            <Text style={styles.alertDescription}>
              This is one payment for every tiffin included in the selected
              Monday–Sunday billing period.
            </Text>

            {!!selectedPaymentInvoice && (
              <View style={styles.alertSummary}>
                <InfoLine
                  label="Billing Week"
                  value={`${formatDate(
                    selectedPaymentInvoice.startDate,
                  )} – ${formatDate(selectedPaymentInvoice.endDate)}`}
                />

                <InfoLine
                  label="Tiffin Bills"
                  value={String(
                    selectedPaymentInvoice.sourceInvoiceCount ??
                      selectedPaymentInvoice.orderCount,
                  )}
                />

                <InfoLine
                  label="Amount Due"
                  value={formatMoney(
                    selectedPaymentInvoice.balanceAmount,

                    selectedPaymentInvoice.currency,
                  )}
                  strong
                />
              </View>
            )}

            {!selectedPaymentInvoice?.paymentBillId &&
              (selectedPaymentInvoice?.sourceInvoiceIds?.length ?? 0) > 1 && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning-outline" size={18} color="#B87300" />

                  <Text style={styles.warningText}>
                    The API did not return one shared weekly_bill_id for this
                    week. Payment is disabled because the app should never guess
                    a bill ID or charge only one tiffin.
                  </Text>
                </View>
              )}

            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.8}
                onPress={() => {
                  setPaymentAlertVisible(false);

                  setSelectedPaymentInvoice(null);
                }}
              >
                <Text style={styles.cancelText}>Not Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={
                  !selectedPaymentInvoice?.paymentBillId &&
                  (selectedPaymentInvoice?.sourceInvoiceIds?.length ?? 0) > 1
                }
                style={[
                  styles.continueButton,

                  selectedPaymentInvoice?.overdue && {
                    backgroundColor: '#B42318',
                  },

                  !selectedPaymentInvoice?.paymentBillId &&
                    (selectedPaymentInvoice?.sourceInvoiceIds?.length ?? 0) >
                      1 && {
                      opacity: 0.45,
                    },
                ]}
                activeOpacity={0.85}
                onPress={continueToPayment}
              >
                <Text style={styles.continueText}>Continue to Pay</Text>

                <Ionicons name="arrow-forward" size={17} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setFilterModalVisible(false)}
          />

          <SafeAreaView
            style={{
              width: '100%',
            }}
            edges={['bottom', 'left', 'right']}
          >
            <View style={styles.filterSheet}>
              <View style={styles.sheetHandle} />

              <Text style={styles.filterTitle}>Filter Weekly Invoices</Text>

              <Text style={styles.filterSubtitle}>
                Choose which weekly invoices you want to see.
              </Text>

              {FILTER_OPTIONS.map(item => {
                const active = selectedFilter === item.id;

                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.filterOption,

                      active && styles.filterOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedFilter(item.id);

                      setVisibleCount(PAGE_SIZE);

                      setFilterModalVisible(false);
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={[
                          styles.filterOptionTitle,

                          active && {
                            color: '#A9090D',
                          },
                        ]}
                      >
                        {item.title}
                      </Text>

                      <Text style={styles.filterOptionSubtitle}>
                        {item.subtitle}
                      </Text>
                    </View>

                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? '#A9090D' : '#C7BAB4'}
                    />
                  </Pressable>
                );
              })}

              <TouchableOpacity
                style={styles.closeButton}
                activeOpacity={0.85}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

/* =========================================================
 * HEADER
 * ========================================================= */

const Header = ({ navigation }) => (
  <View style={styles.header}>
    <Pressable
      style={styles.backButton}
      hitSlop={10}
      onPress={() => navigation.goBack()}
    >
      <Image
        source={require('../assets/login-icons/back.png')}
        style={styles.backIcon}
        resizeMode="contain"
      />
    </Pressable>

    <View
      style={{
        marginLeft: 12,
      }}
    >
      <Text style={styles.eyebrow}>BILLING</Text>

      <Text style={styles.headerTitle}>Invoices</Text>
    </View>
  </View>
);

/* =========================================================
 * INFO LINE
 * ========================================================= */

const InfoLine = ({ label, value, strong = false }) => (
  <View style={styles.infoLine}>
    <Text style={styles.infoLabel}>{label}</Text>

    <Text
      numberOfLines={2}
      style={[
        styles.infoValue,

        strong && {
          color: '#A9090D',

          fontSize: 12,
        },
      ]}
    >
      {value}
    </Text>
  </View>
);

/* =========================================================
 * AMOUNT LINE
 * ========================================================= */

const AmountLine = ({ label, value, type }) => (
  <View style={styles.amountLine}>
    <Text style={styles.amountLabel}>{label}</Text>

    <Text
      style={[
        styles.amountValue,

        type === 'paid' && {
          color: '#278850',
        },

        type === 'due' && {
          color: '#B87300',
        },
      ]}
    >
      {value}
    </Text>
  </View>
);

/* =========================================================
 * SUMMARY BOX
 * ========================================================= */

const SummaryBox = ({ label, value, color }) => (
  <View style={styles.summaryBox}>
    <Text style={styles.summaryBoxLabel}>{label}</Text>

    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      style={[
        styles.summaryBoxValue,

        {
          color,
        },
      ]}
    >
      {formatMoney(value)}
    </Text>
  </View>
);

export default WeeklyInvoice;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,

    backgroundColor: '#FFF9F6',
  },

  container: {
    flex: 1,

    alignSelf: 'center',

    backgroundColor: '#FFF9F6',
  },

  header: {
    minHeight: 72,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 16,

    borderBottomWidth: 1,

    borderBottomColor: '#F0E4DF',

    backgroundColor: '#FFF9F6',
  },

  backButton: {
    width: 42,

    height: 42,

    borderRadius: 13,

    borderWidth: 1,

    borderColor: '#EFE5E0',

    backgroundColor: '#FFF',

    alignItems: 'center',

    justifyContent: 'center',
  },

  backIcon: {
    width: 19,

    height: 19,

    tintColor: '#A9090D',
  },

  headerTitle: {
    color: '#2C201C',

    fontSize: 21,

    fontWeight: '900',

    marginTop: 2,
  },

  eyebrow: {
    color: '#A9090D',

    fontSize: 7,

    fontWeight: '900',

    letterSpacing: 0.9,
  },

  sectionTitle: {
    color: '#2B201C',

    fontSize: 17,

    fontWeight: '900',

    marginTop: 2,
  },

  summaryHeader: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    marginBottom: 14,
  },

  summaryText: {
    color: '#90817B',

    fontSize: 8,

    lineHeight: 13,

    marginTop: 4,

    paddingRight: 12,
  },

  weekCount: {
    minWidth: 58,

    minHeight: 52,

    borderRadius: 15,

    backgroundColor: '#FFF0EE',

    borderWidth: 1,

    borderColor: '#F2D7D3',

    alignItems: 'center',

    justifyContent: 'center',
  },

  weekCountNumber: {
    color: '#A9090D',

    fontSize: 17,

    fontWeight: '900',
  },

  weekCountLabel: {
    color: '#A8766D',

    fontSize: 6,

    fontWeight: '900',
  },

  summaryCards: {
    flexDirection: 'row',

    marginHorizontal: -4,

    marginBottom: 12,
  },

  summaryBox: {
    flex: 1,

    marginHorizontal: 4,

    padding: 12,

    borderRadius: 15,

    backgroundColor: '#FFF',

    borderWidth: 1,

    borderColor: '#EEE4DF',
  },

  summaryBoxLabel: {
    color: '#978982',

    fontSize: 6.5,

    fontWeight: '900',
  },

  summaryBoxValue: {
    fontSize: 11,

    fontWeight: '900',

    marginTop: 5,
  },

  billingCycleCard: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFF4F2',

    borderWidth: 1,

    borderColor: '#F1D8D2',

    borderRadius: 15,

    padding: 12,

    marginBottom: 22,
  },

  billingCycleIcon: {
    width: 38,

    height: 38,

    borderRadius: 12,

    backgroundColor: '#FFE6E3',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 9,
  },

  billingCycleTitle: {
    color: '#5E332D',

    fontSize: 9,

    fontWeight: '900',
  },

  billingCycleText: {
    color: '#87716B',

    fontSize: 7.5,

    lineHeight: 12,

    marginTop: 3,
  },

  listHeader: {
    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginBottom: 12,
  },

  listSubtitle: {
    color: '#93857F',

    fontSize: 7.5,

    marginTop: 2,
  },

  filterButton: {
    minWidth: 105,

    height: 38,

    paddingHorizontal: 10,

    borderRadius: 12,

    backgroundColor: '#FFF',

    borderWidth: 1,

    borderColor: '#EADFD9',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  filterText: {
    flex: 1,

    color: '#A9090D',

    fontSize: 8,

    fontWeight: '900',

    textAlign: 'center',

    marginRight: 5,
  },

  invoiceCard: {
    backgroundColor: '#FFF',

    borderRadius: 20,

    borderWidth: 1,

    borderColor: '#EEE4DF',

    padding: 15,

    marginBottom: 16,

    shadowColor: '#5C4239',

    shadowOffset: {
      width: 0,

      height: 5,
    },

    shadowOpacity: 0.05,

    shadowRadius: 10,

    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  invoiceIcon: {
    width: 45,

    height: 45,

    borderRadius: 14,

    backgroundColor: '#FFF0EE',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 10,
  },

  cardHeaderMain: {
    flex: 1,

    minWidth: 0,
  },

  invoiceNumber: {
    color: '#342722',

    fontSize: 12,

    fontWeight: '900',

    marginTop: 2,
  },

  period: {
    color: '#94857F',

    fontSize: 7,

    marginTop: 3,
  },

  amountArea: {
    alignItems: 'flex-end',

    marginLeft: 8,
  },

  smallLabel: {
    color: '#9A8A83',

    fontSize: 5.5,

    fontWeight: '900',
  },

  weekAmount: {
    color: '#A9090D',

    fontSize: 13,

    fontWeight: '900',

    marginTop: 3,
  },

  statusRow: {
    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginTop: 12,
  },

  statusBadge: {
    borderRadius: 16,

    paddingHorizontal: 9,

    paddingVertical: 6,
  },

  statusText: {
    fontSize: 7,

    fontWeight: '900',
  },

  paidBadge: {
    backgroundColor: '#EAF7EE',
  },

  paidText: {
    color: '#278850',
  },

  overdueBadge: {
    backgroundColor: '#FEECEB',
  },

  overdueText: {
    color: '#B42318',
  },

  dueBadge: {
    backgroundColor: '#FFF5E6',
  },

  dueText: {
    color: '#B87300',
  },

  weekLabel: {
    color: '#958780',

    fontSize: 7,

    fontWeight: '700',
  },

  divider: {
    height: 1,

    backgroundColor: '#F0E8E4',

    marginVertical: 13,
  },

  infoLine: {
    minHeight: 34,

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    borderBottomWidth: 1,

    borderBottomColor: '#F4EEEB',
  },

  infoLabel: {
    color: '#83746E',

    fontSize: 8,
  },

  infoValue: {
    maxWidth: '62%',

    color: '#443630',

    fontSize: 8.5,

    fontWeight: '900',

    textAlign: 'right',
  },

  amountLine: {
    minHeight: 36,

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    borderBottomWidth: 1,

    borderBottomColor: '#F2EBE7',
  },

  amountLabel: {
    color: '#7F706A',

    fontSize: 8,
  },

  amountValue: {
    color: '#4A3933',

    fontSize: 9,

    fontWeight: '900',
  },

  currentWeekNotice: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFF7ED',

    borderWidth: 1,

    borderColor: '#F1DFC5',

    borderRadius: 12,

    padding: 10,

    marginTop: 12,
  },

  currentWeekIcon: {
    width: 34,

    height: 34,

    borderRadius: 10,

    backgroundColor: '#FFF0E2',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 8,
  },

  currentWeekTitle: {
    color: '#7D4A18',

    fontSize: 8.5,

    fontWeight: '900',
  },

  currentWeekText: {
    color: '#94714D',

    fontSize: 7,

    lineHeight: 11,

    marginTop: 2,
  },

  expandButton: {
    minHeight: 42,

    borderRadius: 12,

    backgroundColor: '#FFF7F4',

    borderWidth: 1,

    borderColor: '#F0DDD6',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    paddingHorizontal: 11,

    marginTop: 13,
  },

  expandText: {
    color: '#A9090D',

    fontSize: 8,

    fontWeight: '900',
  },

  ordersBox: {
    backgroundColor: '#FBF8F6',

    borderRadius: 12,

    paddingHorizontal: 10,

    marginTop: 7,
  },

  orderRow: {
    minHeight: 62,

    flexDirection: 'row',

    alignItems: 'center',

    borderBottomWidth: 1,

    borderBottomColor: '#EEE5E0',
  },

  orderIcon: {
    width: 34,

    height: 34,

    borderRadius: 10,

    backgroundColor: '#FFF0EE',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 9,
  },

  orderNumber: {
    color: '#3F302A',

    fontSize: 8.5,

    fontWeight: '900',
  },

  orderName: {
    color: '#796B65',

    fontSize: 7.5,

    marginTop: 2,
  },

  orderQty: {
    color: '#A1928B',

    fontSize: 6.5,

    marginTop: 2,
  },

  orderAmount: {
    color: '#A9090D',

    fontSize: 8.5,

    fontWeight: '900',

    marginLeft: 8,
  },

  payButton: {
    minHeight: 72,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFF5F3',

    borderWidth: 1,

    borderColor: '#EAC9C5',

    borderRadius: 16,

    padding: 11,

    marginTop: 15,
  },

  payButtonOverdue: {
    backgroundColor: '#FFF1F0',

    borderColor: '#F0B9B5',
  },

  payIcon: {
    width: 42,

    height: 42,

    borderRadius: 13,

    backgroundColor: '#FCE5E3',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 10,
  },

  payTitle: {
    color: '#A9090D',

    fontSize: 9,

    fontWeight: '900',
  },

  paySubtitle: {
    color: '#7D6D68',

    fontSize: 7.2,

    lineHeight: 11,

    marginTop: 3,
  },

  payAmount: {
    color: '#A9090D',

    fontSize: 10,

    fontWeight: '900',

    marginLeft: 8,
  },

  detailsLink: {
    minHeight: 40,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 12,

    borderTopWidth: 1,

    borderTopColor: '#F0E8E4',

    paddingTop: 10,
  },

  detailsLinkText: {
    color: '#A9090D',

    fontSize: 8.5,

    fontWeight: '900',

    marginRight: 4,
  },

  showMoreButton: {
    minHeight: 46,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    borderRadius: 14,

    borderWidth: 1,

    borderColor: '#EAC9C5',

    backgroundColor: '#FFF5F3',

    marginTop: 2,

    marginBottom: 10,
  },

  showMoreText: {
    color: '#A9090D',

    fontSize: 9,

    fontWeight: '900',

    marginRight: 6,
  },

  errorBox: {
    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFF1F1',

    borderWidth: 1,

    borderColor: '#F1D0D0',

    borderRadius: 13,

    padding: 12,

    marginTop: 12,
  },

  errorText: {
    flex: 1,

    color: '#8C3436',

    fontSize: 9,

    lineHeight: 14,

    marginLeft: 8,
  },

  loadingBox: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 25,
  },

  loadingTitle: {
    color: '#2C201C',

    fontSize: 16,

    fontWeight: '900',

    marginTop: 14,
  },

  loadingSubtitle: {
    color: '#91847E',

    fontSize: 8.5,

    textAlign: 'center',

    marginTop: 5,
  },

  emptyBox: {
    minHeight: 280,

    alignItems: 'center',

    justifyContent: 'center',

    padding: 25,
  },

  emptyTitle: {
    color: '#362A25',

    fontSize: 15,

    fontWeight: '900',

    marginTop: 10,
  },

  emptyText: {
    maxWidth: 280,

    color: '#91847E',

    fontSize: 8.5,

    lineHeight: 14,

    textAlign: 'center',

    marginTop: 5,
  },

  showAllButton: {
    minHeight: 40,

    borderRadius: 11,

    backgroundColor: '#A9090D',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 18,

    marginTop: 14,
  },

  showAllButtonText: {
    color: '#FFF',

    fontSize: 8.5,

    fontWeight: '900',
  },

  modalOverlay: {
    flex: 1,

    backgroundColor: 'rgba(35,23,20,.68)',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 20,
  },

  alertCard: {
    width: '100%',

    maxWidth: 390,

    backgroundColor: '#FFFDFC',

    borderRadius: 26,

    padding: 20,

    alignItems: 'center',

    shadowColor: '#251511',

    shadowOffset: {
      width: 0,

      height: 8,
    },

    shadowOpacity: 0.2,

    shadowRadius: 18,

    elevation: 15,
  },

  alertIcon: {
    width: 78,

    height: 78,

    borderRadius: 39,

    backgroundColor: '#FFF0EE',

    alignItems: 'center',

    justifyContent: 'center',
  },

  alertEyebrow: {
    color: '#A9090D',

    fontSize: 7,

    fontWeight: '900',

    letterSpacing: 1,

    marginTop: 12,
  },

  alertTitle: {
    color: '#2C201C',

    fontSize: 19,

    fontWeight: '900',

    textAlign: 'center',

    marginTop: 4,
  },

  alertDescription: {
    maxWidth: 310,

    color: '#796B66',

    fontSize: 9,

    lineHeight: 15,

    textAlign: 'center',

    marginTop: 7,
  },

  alertSummary: {
    width: '100%',

    backgroundColor: '#FBF6F3',

    borderRadius: 15,

    borderWidth: 1,

    borderColor: '#EEE0DA',

    paddingHorizontal: 12,

    marginTop: 16,
  },

  warningBox: {
    width: '100%',

    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFF7E9',

    borderWidth: 1,

    borderColor: '#F0D6A5',

    borderRadius: 12,

    padding: 10,

    marginTop: 12,
  },

  warningText: {
    flex: 1,

    color: '#876A3A',

    fontSize: 7.5,

    lineHeight: 12,

    marginLeft: 7,
  },

  alertButtons: {
    width: '100%',

    flexDirection: 'row',

    marginTop: 18,
  },

  cancelButton: {
    flex: 1,

    minHeight: 48,

    borderRadius: 13,

    backgroundColor: '#F6F0ED',

    borderWidth: 1,

    borderColor: '#E7DCD7',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 5,
  },

  cancelText: {
    color: '#73645E',

    fontSize: 9.5,

    fontWeight: '900',
  },

  continueButton: {
    flex: 1.3,

    minHeight: 48,

    borderRadius: 13,

    backgroundColor: '#A9090D',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    marginLeft: 5,
  },

  continueText: {
    color: '#FFF',

    fontSize: 9.5,

    fontWeight: '900',

    marginRight: 6,
  },

  sheetOverlay: {
    flex: 1,

    backgroundColor: 'rgba(35,23,20,.5)',

    justifyContent: 'flex-end',
  },

  filterSheet: {
    backgroundColor: '#FFFDFC',

    borderTopLeftRadius: 25,

    borderTopRightRadius: 25,

    paddingHorizontal: 18,

    paddingTop: 10,

    paddingBottom: 18,
  },

  sheetHandle: {
    width: 44,

    height: 4,

    borderRadius: 2,

    backgroundColor: '#D8CBC5',

    alignSelf: 'center',

    marginBottom: 15,
  },

  filterTitle: {
    color: '#2D211D',

    fontSize: 17,

    fontWeight: '900',
  },

  filterSubtitle: {
    color: '#8F817B',

    fontSize: 8.5,

    marginTop: 4,

    marginBottom: 13,
  },

  filterOption: {
    minHeight: 62,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FBF8F6',

    borderWidth: 1,

    borderColor: '#EEE4DF',

    borderRadius: 13,

    paddingHorizontal: 12,

    marginBottom: 8,
  },

  filterOptionActive: {
    backgroundColor: '#FFF2F0',

    borderColor: '#E9BDB7',
  },

  filterOptionTitle: {
    color: '#4A3B35',

    fontSize: 10,

    fontWeight: '900',
  },

  filterOptionSubtitle: {
    color: '#91837D',

    fontSize: 7.5,

    marginTop: 3,
  },

  closeButton: {
    minHeight: 48,

    borderRadius: 13,

    backgroundColor: '#A9090D',

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 5,
  },

  closeButtonText: {
    color: '#FFF',

    fontSize: 10,

    fontWeight: '900',
  },
});
