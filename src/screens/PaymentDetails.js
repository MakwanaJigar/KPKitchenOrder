import React, { useCallback, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
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

import {
  PlatformPay,
  usePlatformPay,
  useStripe,
} from '@stripe/stripe-react-native';

/* =========================================================
 * CONFIG
 * ========================================================= */

const BASE_API_URL = 'https://replete-software.com/projects/kp_admin/api';

const CUSTOMER_INVOICES_API = `${BASE_API_URL}/customer/invoices`;

const BUSINESS_NAME = 'KP Cloud Kitchen';

const DEFAULT_CURRENCY = 'AUD';

const MERCHANT_COUNTRY = 'AU';

const WEEKLY_ORDERS_STORAGE_KEY = 'kp_customer_weekly_orders';

const PENDING_PAYMENT_LOCK_KEY = 'kp_customer_pending_payment_lock';

const FREE_DELIVERY_MINIMUM = 11;

const DELIVERY_CHARGE = 2;

/* =========================================================
 * AUTH TOKEN KEYS
 * ========================================================= */

const CUSTOMER_TOKEN_KEYS = [
  'token',
  '@kp_kitchen_customer_token',
  '@kp_customer_token',
  'customer_token',
];

/* =========================================================
 * PAYMENT ENDPOINTS
 * ========================================================= */

const getCreateBillPaymentIntentApi = weeklyBillId =>
  `${BASE_API_URL}/customer/weekly-bills/${weeklyBillId}/create-payment-intent`;

const getConfirmBillPaymentApi = weeklyBillId =>
  `${BASE_API_URL}/customer/weekly-bills/${weeklyBillId}/confirm-payment`;

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

/* =========================================================
 * MONEY
 * ========================================================= */

const parseMoney = value => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const number = Number(String(value).replace(/[^0-9.-]/g, ''));

  return Number.isFinite(number) ? number : 0;
};

/* =========================================================
 * STRIPE / BACKEND AMOUNT NORMALIZER
 * ========================================================= */

const normalizeBackendPaymentAmount = (value, expectedAmount = 0) => {
  const raw = parseMoney(value);

  if (raw <= 0) {
    return null;
  }

  const expected = parseMoney(expectedAmount);

  /*
   * Stripe PaymentIntent amounts are normally returned in cents.
   * Some custom APIs return dollars instead. Detect cents safely by
   * comparing the response with the amount that the screen expects.
   */
  if (expected > 0 && raw > expected * 10) {
    return Number((raw / 100).toFixed(2));
  }

  return Number(raw.toFixed(2));
};

/* =========================================================
 * STATUS
 * ========================================================= */

const normalizeStatus = value =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const PAYMENT_DUE_STATUSES = [
  'pending',
  'payment_due',
  'due',
  'unpaid',
  'pending_payment',
  'payment_pending',
  'partially_paid',
  'partial',
  'outstanding',
  'overdue',
  'over_due',
  'past_due',
  'pastdue',
];

const OVERDUE_STATUSES = ['overdue', 'over_due', 'past_due', 'pastdue'];

const PAID_STATUSES = [
  'paid',
  'completed',
  'settled',
  'payment_completed',
  'fully_paid',
  'success',
];

const hasPaymentDueStatus = value =>
  PAYMENT_DUE_STATUSES.includes(normalizeStatus(value));

const hasExplicitOverdueStatus = value =>
  OVERDUE_STATUSES.includes(normalizeStatus(value));

/* =========================================================
 * DATE HELPERS
 * ========================================================= */

const safeDate = value => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? new Date(value) : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = value => {
  const date = safeDate(value);

  if (!date) {
    return null;
  }

  date.setHours(0, 0, 0, 0);

  return date;
};

const formatDate = value => {
  const date = safeDate(value);

  if (!date) {
    return 'Not available';
  }

  return date.toLocaleDateString('en-AU', {
    day: '2-digit',

    month: 'short',

    year: 'numeric',
  });
};

const dateKey = value => {
  const date = safeDate(value);

  if (!date) {
    return '';
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
};

/* =========================================================
 * MONDAY BILLING HELPERS
 * ========================================================= */

const getCurrentMonday = (value = new Date()) => {
  const date = startOfDay(value);

  if (!date) {
    return null;
  }

  const day = date.getDay();

  const daysSinceMonday = day === 0 ? 6 : day - 1;

  date.setDate(date.getDate() - daysSinceMonday);

  return date;
};

const getNextMonday = value => {
  const monday = getCurrentMonday(value);

  if (!monday) {
    return null;
  }

  const next = new Date(monday);

  next.setDate(next.getDate() + 7);

  return next;
};

const isMondayPaymentDay = (value = new Date()) => {
  const date = startOfDay(value);

  return Boolean(date && date.getDay() === 1);
};

/* =========================================================
 * ORDER BILLING BREAKDOWN
 * ========================================================= */

const getOrderBillingBreakdown = order => {
  const subtotalValue = firstValue(
    order?.subtotal,
    order?.sub_total,
    order?.subTotal,
    order?.food_total,
    order?.foodTotal,
    order?.items_total,
    order?.itemsTotal,
    order?.tiffin_total,
    order?.tiffinTotal,
    order?.base_total,
    order?.baseTotal,
    order?.base_price,
    order?.basePrice,
    order?.tiffin_price,
    order?.tiffinPrice,
    order?.food_subtotal,
    order?.foodSubtotal,
  );

  const deliveryValue = firstValue(
    order?.delivery_charge,
    order?.deliveryCharge,
    order?.delivery_fee,
    order?.deliveryFee,
    order?.shipping_charge,
    order?.shippingCharge,
    order?.shipping_fee,
    order?.shippingFee,
  );

  const storedTotal = parseMoney(
    firstValue(
      order?.total_amount,
      order?.totalAmount,
      order?.grand_total,
      order?.grandTotal,
      order?.order_total,
      order?.orderTotal,
      order?.total,
      order?.amount,
      0,
    ),
  );

  const quantity = Math.max(
    1,

    Number(firstValue(order?.quantity, order?.qty, 1)) || 1,
  );

  const unitPriceValue = firstValue(
    order?.price,
    order?.unit_price,
    order?.unitPrice,
    order?.tiffin?.price,
    order?.product?.price,
  );

  const explicitDelivery = parseMoney(deliveryValue);

  let subtotal =
    subtotalValue !== null
      ? parseMoney(subtotalValue)
      : unitPriceValue !== null
      ? parseMoney(unitPriceValue) * quantity
      : storedTotal;

  if (
    subtotalValue === null &&
    unitPriceValue === null &&
    explicitDelivery > 0 &&
    storedTotal >= explicitDelivery
  ) {
    subtotal = Math.max(
      0,

      storedTotal - explicitDelivery,
    );
  }

  const calculatedDelivery =
    subtotal > 0 && subtotal < FREE_DELIVERY_MINIMUM ? DELIVERY_CHARGE : 0;

  const deliveryCharge =
    explicitDelivery > 0 ? explicitDelivery : calculatedDelivery;

  const total = Math.max(
    storedTotal,

    subtotal + deliveryCharge,
  );

  return {
    subtotal: Number(subtotal.toFixed(2)),

    deliveryCharge: Number(deliveryCharge.toFixed(2)),

    total: Number(total.toFixed(2)),
  };
};

/* =========================================================
 * ORDER DATE
 * ========================================================= */

const getOrderDate = order =>
  safeDate(
    firstValue(
      order?.created_at,
      order?.createdAt,
      order?.order_date,
      order?.orderDate,
      order?.placed_at,
      order?.placedAt,
      order?.date,
    ),
  );

/* =========================================================
 * GET TOKEN
 * ========================================================= */

const getCustomerToken = async () => {
  for (const key of CUSTOMER_TOKEN_KEYS) {
    try {
      const token = await AsyncStorage.getItem(key);

      if (token && String(token).trim()) {
        return String(token).trim();
      }
    } catch (error) {
      console.log(`TOKEN READ ERROR [${key}]:`, error);
    }
  }

  return null;
};

/* =========================================================
 * READ API JSON
 * ========================================================= */

const readJsonResponse = async response => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.log('RAW API RESPONSE:', text);

    throw new Error('The server returned an invalid response.');
  }
};

/* =========================================================
 * EXTRACT INVOICE ARRAY
 * ========================================================= */

const extractInvoicesArray = responseData => {
  const possibleArrays = [
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

  const arrays = possibleArrays.filter(Array.isArray);

  const nonEmpty = arrays.find(value => value.length > 0);

  if (nonEmpty) {
    return nonEmpty;
  }

  return arrays[0] ?? [];
};

/* =========================================================
 * NORMALIZE INVOICE
 * ========================================================= */

const normalizeInvoice = rawInvoice => {
  if (!rawInvoice) {
    return null;
  }

  const id = firstValue(
    rawInvoice?.id,
    rawInvoice?.invoice_id,
    rawInvoice?.invoiceId,
    rawInvoice?.bill_id,
    rawInvoice?.billId,
    rawInvoice?.weekly_bill_id,
    rawInvoice?.weeklyBillId,
  );

  if (id === null) {
    return null;
  }

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
    rawInvoice?.invoice_no,
    rawInvoice?.invoiceNumber,
    rawInvoice?.bill_number,
    rawInvoice?.bill_no,
    rawInvoice?.billNumber,
    rawInvoice?.number,
    `#${id}`,
  );

  const serverTotal = parseMoney(
    firstValue(
      rawInvoice?.total_amount,
      rawInvoice?.totalAmount,
      rawInvoice?.invoice_total,
      rawInvoice?.invoiceTotal,
      rawInvoice?.grand_total,
      rawInvoice?.grandTotal,
      rawInvoice?.invoice_amount,
      rawInvoice?.invoiceAmount,
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

  const balanceValue = firstValue(
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

  let serverBalance =
    balanceValue !== null ? parseMoney(balanceValue) : serverTotal;

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

  if (PAID_STATUSES.includes(normalizedStatus)) {
    paid = true;
  }

  if (balanceValue !== null && serverBalance <= 0) {
    paid = true;
  }

  const nestedOrders = Array.isArray(rawInvoice?.orders)
    ? rawInvoice.orders
    : Array.isArray(rawInvoice?.items)
    ? rawInvoice.items
    : Array.isArray(rawInvoice?.order_details)
    ? rawInvoice.order_details
    : Array.isArray(rawInvoice?.invoice_items)
    ? rawInvoice.invoice_items
    : [];

  const invoiceLooksLikeSingleOrder =
    Boolean(
      firstValue(
        rawInvoice?.order_id,
        rawInvoice?.orderId,
        rawInvoice?.order_number,
        rawInvoice?.order_no,
        rawInvoice?.tiffin_id,
        rawInvoice?.tiffinId,
        rawInvoice?.product_id,
        rawInvoice?.productId,
        rawInvoice?.tiffin?.id,
        rawInvoice?.product?.id,
      ),
    ) ||
    (nestedOrders.length === 0 && serverTotal > 0);

  const orders =
    nestedOrders.length > 0
      ? nestedOrders
      : invoiceLooksLikeSingleOrder
      ? [rawInvoice]
      : [];

  const breakdowns = orders.map(getOrderBillingBreakdown);

  const correctedOrdersTotal = breakdowns.reduce(
    (sum, item) => sum + item.total,

    0,
  );

  const deliveryChargeTotal = breakdowns.reduce(
    (sum, item) => sum + item.deliveryCharge,

    0,
  );

  /*
   * IMPORTANT PAYMENT RULE:
   *
   * The backend invoice values are the source of truth for money.
   * Do not increase the payable balance by recalculating delivery or
   * order totals on the device. A client-side correction can make a
   * $60 outstanding balance become a larger Stripe charge.
   */
  const totalAmount = serverTotal > 0 ? serverTotal : correctedOrdersTotal;

  const balanceAmount = paid ? 0 : Math.max(0, serverBalance);

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

  const startDate = firstValue(
    rawInvoice?.start_date,
    rawInvoice?.startDate,
    rawInvoice?.week_start_date,
    rawInvoice?.week_start,
    rawInvoice?.billing_start,
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
    rawInvoice?.period_end,
    rawInvoice?.to_date,
    rawInvoice?.cycle_end,
    rawInvoice?.cycleEnd,
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

  const due = startOfDay(dueDate);

  const today = startOfDay(new Date());

  const currentMonday = getCurrentMonday(today);

  const start = startOfDay(startDate);

  const end = startOfDay(endDate);

  const created = startOfDay(createdAt);

  const completedByDate = Boolean(
    currentMonday &&
      ((start && start < currentMonday) ||
        (end && end < currentMonday) ||
        (!start && !end && created && created < currentMonday)),
  );

  const overdue = Boolean(
    !paid &&
      balanceAmount > 0 &&
      (hasExplicitOverdueStatus(normalizedStatus) ||
        (due && today && due < today) ||
        (hasPaymentDueStatus(normalizedStatus) && completedByDate)),
  );

  return {
    id: String(id),

    invoiceNumber: String(invoiceNumber),

    weeklyBillId:
      weeklyBillId !== null && weeklyBillId !== undefined && weeklyBillId !== ''
        ? String(weeklyBillId)
        : null,

    totalAmount,

    balanceAmount,

    deliveryChargeTotal,

    currency: String(
      firstValue(
        rawInvoice?.currency,
        rawInvoice?.currency_code,
        rawInvoice?.currencyCode,
        DEFAULT_CURRENCY,
      ),
    ).toUpperCase(),

    status,

    paid,

    overdue,

    startDate,

    endDate,

    dueDate,

    createdAt,

    orders,

    raw: rawInvoice,
  };
};

/* =========================================================
 * CURRENT BILLING CYCLE
 * ========================================================= */

const isCurrentBillingCycle = invoice => {
  if (!invoice) {
    return false;
  }

  const monday = getCurrentMonday();

  const nextMonday = getNextMonday();

  if (!monday || !nextMonday) {
    return false;
  }

  const start = startOfDay(invoice.startDate);

  if (start) {
    return start >= monday && start < nextMonday;
  }

  const end = startOfDay(invoice.endDate);

  if (end) {
    return end >= monday && end < nextMonday;
  }

  return false;
};

/* =========================================================
 * COMPLETED BILLING CYCLE
 * ========================================================= */

const isCompletedBillingCycle = invoice => {
  if (!invoice) {
    return false;
  }

  const currentMonday = getCurrentMonday();

  const today = startOfDay(new Date());

  if (!currentMonday || !today) {
    return false;
  }

  if (isCurrentBillingCycle(invoice)) {
    return false;
  }

  const start = startOfDay(invoice.startDate);

  if (start) {
    return start < currentMonday;
  }

  const end = startOfDay(invoice.endDate);

  if (end) {
    return end < currentMonday;
  }

  const due = startOfDay(invoice.dueDate);

  if (due && due <= today) {
    return true;
  }

  const created = startOfDay(invoice.createdAt);

  if (created && created < currentMonday) {
    return true;
  }

  return hasPaymentDueStatus(invoice.status);
};

/* =========================================================
 * OUTSTANDING INVOICE
 * ========================================================= */

const isOutstandingInvoice = invoice =>
  Boolean(invoice && !invoice.paid && parseMoney(invoice.balanceAmount) > 0);

/* =========================================================
 * PAYABLE INVOICE
 * ========================================================= */

const isPayableInvoice = invoice => {
  if (!isOutstandingInvoice(invoice)) {
    return false;
  }

  if (isCurrentBillingCycle(invoice)) {
    return false;
  }

  if (isCompletedBillingCycle(invoice)) {
    return true;
  }

  const due = startOfDay(invoice.dueDate);

  const today = startOfDay(new Date());

  if (due && today && due <= today) {
    return true;
  }

  if (hasPaymentDueStatus(invoice.status)) {
    return true;
  }

  return false;
};

/* =========================================================
 * BLOCKING / OVERDUE
 * ========================================================= */

const isBlockingInvoice = invoice =>
  Boolean(
    isOutstandingInvoice(invoice) &&
      !isCurrentBillingCycle(invoice) &&
      invoice.overdue,
  );

/* =========================================================
 * SAVE PAYMENT LOCK
 * ========================================================= */

const savePendingPaymentLock = async invoices => {
  const overdueInvoices = (Array.isArray(invoices) ? invoices : []).filter(
    isBlockingInvoice,
  );

  const first = overdueInvoices[0] ?? null;

  await AsyncStorage.setItem(
    PENDING_PAYMENT_LOCK_KEY,

    JSON.stringify({
      hasPendingPayment: overdueInvoices.length > 0,

      pendingInvoiceCount: overdueInvoices.length,

      invoiceId: first?.id ?? null,

      invoiceNumber: first?.invoiceNumber ?? null,

      amount: first?.balanceAmount ?? 0,

      updatedAt: new Date().toISOString(),
    }),
  );
};

/* =========================================================
 * BUILD WEEKLY PAYMENT INVOICE
 * ========================================================= */

const buildWeeklyPaymentInvoice = (normalizedInvoices, routeParams) => {
  const sourceIds = Array.isArray(routeParams?.sourceInvoiceIds)
    ? routeParams.sourceInvoiceIds.map(String)
    : [];

  const requestedWeeklyBillId = firstValue(
    routeParams?.paymentBillId,
    routeParams?.weeklyBillId,
  );

  const requestedStart = dateKey(routeParams?.startDate);

  const requestedEnd = dateKey(routeParams?.endDate);

  let matching = [];

  /*
   * Resolve the live weekly bill first. The Stripe endpoint is keyed by
   * weekly_bill_id, so this ID must be the primary selector. Stale
   * source invoice IDs are only a fallback.
   */
  if (requestedWeeklyBillId !== null) {
    matching = normalizedInvoices.filter(
      item =>
        item.weeklyBillId &&
        String(item.weeklyBillId) === String(requestedWeeklyBillId),
    );
  }

  if (matching.length === 0 && sourceIds.length > 0) {
    matching = normalizedInvoices.filter(item =>
      sourceIds.includes(String(item.id)),
    );
  }

  if (matching.length === 0 && (requestedStart || requestedEnd)) {
    matching = normalizedInvoices.filter(item => {
      const startMatch =
        !requestedStart || dateKey(item.startDate) === requestedStart;

      const endMatch = !requestedEnd || dateKey(item.endDate) === requestedEnd;

      return startMatch && endMatch;
    });
  }

  /*
   * Important:
   * sourceInvoices is only a fallback if the current
   * /customer/invoices request cannot find the bill.
   */
  let usedRouteSnapshot = false;

  if (matching.length === 0 && Array.isArray(routeParams?.sourceInvoices)) {
    usedRouteSnapshot = true;

    matching = routeParams.sourceInvoices
      .map(item =>
        normalizeInvoice({
          id: item.id,

          invoice_number: item.invoiceNumber,

          weekly_bill_id: item.weeklyBillId ?? requestedWeeklyBillId,

          total_amount: parseMoney(item.totalAmount),

          balance_amount: item.paid ? 0 : parseMoney(item.balanceAmount),

          currency: item.currency ?? DEFAULT_CURRENCY,

          status: item.status ?? 'Payment Due',

          is_paid: Boolean(item.paid),

          start_date: item.startDate,

          end_date: item.endDate,

          due_date: item.dueDate,

          created_at: item.createdAt,

          orders: Array.isArray(item.orders) ? item.orders : [],
        }),
      )
      .filter(Boolean);
  }

  const sourceInvoiceIds =
    matching.length > 0
      ? [...new Set(matching.map(item => String(item.id)))]
      : sourceIds;

  const weeklyBillIds = [
    ...new Set(
      matching
        .map(item => item.weeklyBillId)
        .filter(value => value !== null && value !== undefined && value !== '')
        .map(String),
    ),
  ];

  /*
   * Prefer the weekly_bill_id from the latest API.
   *
   * The ID passed from WeeklyInvoice is only used when
   * live data could not resolve a weekly bill.
   */
  const paymentBillId =
    !usedRouteSnapshot && weeklyBillIds.length === 1
      ? weeklyBillIds[0]
      : !usedRouteSnapshot && matching.length === 1 && matching[0].weeklyBillId
      ? String(matching[0].weeklyBillId)
      : requestedWeeklyBillId !== null
      ? String(requestedWeeklyBillId)
      : weeklyBillIds.length === 1
      ? weeklyBillIds[0]
      : null;

  const serverTotal = matching.reduce(
    (sum, item) => sum + parseMoney(item.totalAmount),

    0,
  );

  const serverBalance = matching.reduce(
    (sum, item) => sum + (item.paid ? 0 : parseMoney(item.balanceAmount)),

    0,
  );

  const serverDelivery = matching.reduce(
    (sum, item) => sum + parseMoney(item.deliveryChargeTotal),

    0,
  );

  /*
   * CRITICAL FIX:
   *
   * Do not use:
   *
   * Math.max(serverBalance, routeBalance)
   *
   * When live invoices are available the latest API
   * balance is authoritative.
   */
  const hasLiveMatchingInvoices = matching.length > 0 && !usedRouteSnapshot;

  const totalAmount = hasLiveMatchingInvoices
    ? serverTotal
    : matching.length > 0
    ? serverTotal
    : parseMoney(routeParams?.totalAmount);

  const balanceAmount = hasLiveMatchingInvoices
    ? serverBalance
    : matching.length > 0
    ? serverBalance
    : parseMoney(routeParams?.balanceAmount);

  const paid =
    matching.length > 0
      ? matching.every(item => item.paid) || balanceAmount <= 0
      : balanceAmount <= 0;

  const dueDates = matching.map(item => safeDate(item.dueDate)).filter(Boolean);

  const dueDate = hasLiveMatchingInvoices
    ? dueDates.length > 0
      ? new Date(Math.max(...dueDates.map(date => date.getTime())))
      : null
    : routeParams?.dueDate ??
      (dueDates.length > 0
        ? new Date(Math.max(...dueDates.map(date => date.getTime())))
        : null);

  const due = startOfDay(dueDate);

  const today = startOfDay(new Date());

  const liveOverdue = matching.some(item => item.overdue);

  const overdue = Boolean(
    !paid &&
      balanceAmount > 0 &&
      (liveOverdue ||
        (!hasLiveMatchingInvoices && routeParams?.overdue === true) ||
        (due && today && due < today)),
  );

  const matchingOrders = matching.flatMap(item =>
    Array.isArray(item.orders) ? item.orders : [],
  );

  const routeOrders = Array.isArray(routeParams?.orders)
    ? routeParams.orders
    : [];

  const orders = matchingOrders.length > 0 ? matchingOrders : routeOrders;

  return {
    id: String(
      firstValue(
        routeParams?.invoiceId,
        paymentBillId,
        `weekly-${requestedStart || 'bill'}`,
      ),
    ),

    invoiceNumber: String(
      firstValue(
        routeParams?.invoiceNumber,
        `WEEK-${requestedStart || 'BILL'}`,
      ),
    ),

    weeklyPayment: true,

    weeklyBillId: paymentBillId,

    paymentBillId,

    sourceInvoiceIds,

    sourceInvoiceCount: Math.max(
      sourceInvoiceIds.length,

      Number(routeParams?.sourceInvoiceCount ?? 0),

      orders.length,
    ),

    totalAmount,

    balanceAmount,

    deliveryChargeTotal: hasLiveMatchingInvoices
      ? serverDelivery
      : Math.max(
          serverDelivery,

          parseMoney(routeParams?.deliveryChargeTotal),
        ),

    currency: String(
      firstValue(
        matching.find(item => item.currency)?.currency,

        routeParams?.currency,

        DEFAULT_CURRENCY,
      ),
    ).toUpperCase(),

    status: String(
      matching.length > 0
        ? paid
          ? 'Paid'
          : overdue
          ? 'Overdue'
          : 'Payment Due'
        : firstValue(
            routeParams?.status,

            overdue ? 'Overdue' : paid ? 'Paid' : 'Payment Due',
          ),
    ),

    paid,

    overdue,

    startDate: firstValue(
      matching[0]?.startDate,

      routeParams?.startDate,
    ),

    endDate: firstValue(
      matching[0]?.endDate,

      routeParams?.endDate,
    ),

    dueDate,

    createdAt: firstValue(
      matching[0]?.createdAt,

      routeParams?.createdAt,
    ),

    orders,
  };
};

/* =========================================================
 * SELECT DEFAULT INVOICE
 * ========================================================= */

const selectNormalInvoice = (invoices, routeParams) => {
  const requestedId = firstValue(routeParams?.invoiceId, routeParams?.id);

  if (requestedId !== null) {
    const found = invoices.find(
      item => String(item.id) === String(requestedId) && isPayableInvoice(item),
    );

    if (found) {
      return found;
    }
  }

  const overdue = invoices.find(isBlockingInvoice);

  if (overdue) {
    return overdue;
  }

  return invoices.find(isPayableInvoice) ?? null;
};

/* =========================================================
 * COMPONENT
 * ========================================================= */

const PaymentDetails = ({ navigation, route }) => {
  const { width } = useWindowDimensions();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const { isPlatformPaySupported, confirmPlatformPayPayment } =
    usePlatformPay();

  const routeParams = route?.params ?? {};

  const [weeklyOrders, setWeeklyOrders] = useState([]);

  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  const [allInvoices, setAllInvoices] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');

  const [processingMethod, setProcessingMethod] = useState(null);

  const [popup, setPopup] = useState({
    visible: false,

    type: 'info',

    title: '',

    message: '',
  });

  const [successVisible, setSuccessVisible] = useState(false);

  const [successfulMethod, setSuccessfulMethod] = useState('');

  const responsive = useMemo(
    () => ({
      width: width >= 768 ? Math.min(width - 80, 720) : width,

      padding: width >= 768 ? 28 : 14,
    }),

    [width],
  );

  const showPopup = (type, title, message) => {
    setPopup({
      visible: true,

      type,

      title,

      message,
    });
  };

  /* =====================================================
   * LOAD INVOICES
   * ===================================================== */

  const loadInvoices = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
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
          'CUSTOMER INVOICES API RESPONSE:',

          JSON.stringify(result, null, 2),
        );

        if (!response.ok || result?.success === false) {
          throw new Error(
            result?.message || result?.error || 'Unable to load invoices.',
          );
        }

        const rawInvoices = extractInvoicesArray(result);

        console.log(
          'CUSTOMER RAW INVOICES:',

          JSON.stringify(rawInvoices, null, 2),
        );

        const normalized = rawInvoices
          .map(normalizeInvoice)
          .filter(Boolean)
          .sort((a, b) => {
            const aPriority = a.overdue
              ? 3
              : isPayableInvoice(a)
              ? 2
              : a.paid
              ? 0
              : 1;

            const bPriority = b.overdue
              ? 3
              : isPayableInvoice(b)
              ? 2
              : b.paid
              ? 0
              : 1;

            if (aPriority !== bPriority) {
              return bPriority - aPriority;
            }

            const aDate =
              safeDate(a.dueDate) ??
              safeDate(a.endDate) ??
              safeDate(a.createdAt);

            const bDate =
              safeDate(b.dueDate) ??
              safeDate(b.endDate) ??
              safeDate(b.createdAt);

            return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
          });

        console.log(
          'CUSTOMER NORMALIZED INVOICES:',

          JSON.stringify(
            normalized.map(item => ({
              id: item.id,

              invoiceNumber: item.invoiceNumber,

              weeklyBillId: item.weeklyBillId,

              status: item.status,

              paid: item.paid,

              overdue: item.overdue,

              balanceAmount: item.balanceAmount,

              totalAmount: item.totalAmount,

              startDate: item.startDate,

              endDate: item.endDate,

              dueDate: item.dueDate,

              createdAt: item.createdAt,

              currentCycle: isCurrentBillingCycle(item),

              completedCycle: isCompletedBillingCycle(item),

              payable: isPayableInvoice(item),
            })),

            null,

            2,
          ),
        );

        setAllInvoices(normalized);

        await savePendingPaymentLock(normalized);

        const selected =
          routeParams?.weeklyPayment === true
            ? buildWeeklyPaymentInvoice(
                normalized,

                routeParams,
              )
            : selectNormalInvoice(
                normalized,

                routeParams,
              );

        console.log(
          'SELECTED PAYMENT INVOICE:',

          JSON.stringify(selected, null, 2),
        );

        if (!selected) {
          setGeneratedInvoice(null);

          setWeeklyOrders([]);

          return;
        }

        setGeneratedInvoice(selected);

        setWeeklyOrders(Array.isArray(selected.orders) ? selected.orders : []);
      } catch (err) {
        console.log('PAYMENT DETAILS ERROR:', err);

        setGeneratedInvoice(null);

        setWeeklyOrders([]);

        setError(err?.message || 'Unable to retrieve your invoice.');
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },

    [
      routeParams?.weeklyPayment,
      routeParams?.paymentBillId,
      routeParams?.weeklyBillId,
      routeParams?.invoiceId,
      routeParams?.invoiceNumber,
      routeParams?.startDate,
      routeParams?.endDate,
      routeParams?.balanceAmount,
      routeParams?.totalAmount,
      routeParams?.overdue,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      loadInvoices();

      return () => {};
    }, [loadInvoices]),
  );

  const invoiceId = generatedInvoice?.id ?? null;

  const invoiceNumber = generatedInvoice?.invoiceNumber ?? null;

  const isWholeWeekPayment = Boolean(
    generatedInvoice?.weeklyPayment || routeParams?.weeklyPayment,
  );

  const sourceInvoiceIds = Array.isArray(generatedInvoice?.sourceInvoiceIds)
    ? generatedInvoice.sourceInvoiceIds.map(String)
    : [];

  /*
   * generatedInvoice contains the ID resolved from the
   * LIVE API. Give it priority over navigation params.
   */
  const paymentBillId = firstValue(
    generatedInvoice?.paymentBillId,
    generatedInvoice?.weeklyBillId,

    routeParams?.paymentBillId,
    routeParams?.weeklyBillId,

    isWholeWeekPayment ? null : invoiceId,
  );

  const currency = String(
    generatedInvoice?.currency ?? DEFAULT_CURRENCY,
  ).toUpperCase();

  const invoiceTotal = parseMoney(generatedInvoice?.totalAmount);

  const invoiceAmount = parseMoney(
    generatedInvoice?.balanceAmount ?? generatedInvoice?.totalAmount,
  );

  const deliveryTotal = parseMoney(generatedInvoice?.deliveryChargeTotal);

  const invoicePaid = Boolean(generatedInvoice?.paid);

  /*
   * Do not allow a stale route overdue flag to turn a
   * live paid invoice back into an overdue invoice.
   */
  const invoiceOverdue = Boolean(
    !invoicePaid &&
      invoiceAmount > 0 &&
      (generatedInvoice?.overdue ||
        (!generatedInvoice && routeParams?.overdue)),
  );

  const currentWeek = Boolean(
    generatedInvoice && isCurrentBillingCycle(generatedInvoice),
  );

  const completedCycle = Boolean(
    generatedInvoice && isCompletedBillingCycle(generatedInvoice),
  );

  const mondayPaymentDay = isMondayPaymentDay();

  const payableInvoices = allInvoices.filter(isPayableInvoice);

  const overdueInvoices = allInvoices.filter(isBlockingInvoice);

  const currentMonday = getCurrentMonday();

  const nextMonday = getNextMonday();

  /*
   * Overdue bills:
   * payable immediately.
   *
   * Normal weekly bills:
   * Monday only after completed cycle.
   */
  const paymentAllowed = Boolean(
    !loading &&
      generatedInvoice &&
      paymentBillId &&
      !invoicePaid &&
      invoiceAmount > 0 &&
      (invoiceOverdue || (completedCycle && !currentWeek && mondayPaymentDay)),
  );

  const validatePayment = () => {
    if (!generatedInvoice) {
      showPopup(
        'warning',

        'Invoice Not Available',

        'There is currently no generated payable weekly invoice.',
      );

      return false;
    }

    if (isWholeWeekPayment && !paymentBillId) {
      showPopup(
        'warning',

        'Weekly Bill ID Missing',

        'This weekly invoice does not contain a valid weekly bill ID.',
      );

      return false;
    }

    if (invoicePaid) {
      showPopup(
        'success',

        'Invoice Already Paid',

        'This weekly invoice has already been paid.',
      );

      return false;
    }

    if (invoiceAmount <= 0) {
      showPopup(
        'warning',

        'Nothing to Pay',

        'There is no outstanding balance on this weekly bill.',
      );

      return false;
    }

    if (!invoiceOverdue) {
      if (currentWeek) {
        showPopup(
          'info',

          'Billing Week Still Open',

          `The current billing cycle (${formatDate(
            currentMonday,
          )} – ${formatDate(nextMonday)}) is still active.`,
        );

        return false;
      }

      if (!completedCycle) {
        showPopup(
          'info',

          'Billing Cycle Not Completed',

          'This weekly bill is not yet available for payment.',
        );

        return false;
      }

      if (!mondayPaymentDay) {
        showPopup(
          'info',

          'Payments Available on Monday',

          'Normal weekly bills can only be paid on Monday. Overdue bills can be paid immediately.',
        );

        return false;
      }
    }

    return true;
  };

  /* =====================================================
   * CREATE PAYMENT INTENT
   * ===================================================== */

  const createPaymentIntent = async () => {
    const token = await getCustomerToken();

    if (!token) {
      throw new Error('Your login session has expired.');
    }

    console.log(
      'CREATE WEEKLY PAYMENT INTENT:',

      JSON.stringify(
        {
          paymentBillId,

          invoiceId,

          sourceInvoiceIds,

          invoiceAmount,

          invoicePaid,

          invoiceOverdue,
        },

        null,

        2,
      ),
    );

    const response = await fetch(
      getCreateBillPaymentIntentApi(paymentBillId),

      {
        method: 'POST',

        headers: {
          Accept: 'application/json',

          'Content-Type': 'application/json',

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          bill_id: paymentBillId,

          weekly_bill_id: paymentBillId,

          invoice_id: invoiceId,

          invoice_ids: sourceInvoiceIds,

          source_invoice_ids: sourceInvoiceIds,

          weekly_payment: isWholeWeekPayment,

          payable_type: 'weekly_bill',

          amount: Number(invoiceAmount.toFixed(2)),

          weekly_total: Number(invoiceAmount.toFixed(2)),

          delivery_charge: Number(deliveryTotal.toFixed(2)),

          currency: currency.toLowerCase(),
        }),
      },
    );

    const result = await readJsonResponse(response);

    console.log(
      'CREATE PAYMENT INTENT RESPONSE:',

      JSON.stringify(result, null, 2),
    );

    if (!response.ok || result?.success === false) {
      const backendMessage = String(
        result?.message || result?.error || 'Unable to prepare weekly payment.',
      );

      const normalizedMessage = backendMessage.toLowerCase();

      /*
       * If backend says this bill no longer has a balance,
       * immediately reload /customer/invoices.
       */
      if (
        normalizedMessage.includes('no outstanding balance') ||
        normalizedMessage.includes('nothing to pay') ||
        normalizedMessage.includes('already paid') ||
        normalizedMessage.includes('zero outstanding balance')
      ) {
        await loadInvoices(true);
      }

      throw new Error(backendMessage);
    }

    /*
     * PAYMENT SAFETY CHECK
     */
    const backendAmountRaw = firstValue(
      result?.amount,
      result?.payable_amount,
      result?.payment_amount,
      result?.data?.amount,
      result?.data?.payable_amount,
      result?.data?.payment_amount,
      result?.payment_intent?.amount,
      result?.data?.payment_intent?.amount,
    );

    const backendPaymentAmount = normalizeBackendPaymentAmount(
      backendAmountRaw,
      invoiceAmount,
    );

    if (
      backendPaymentAmount !== null &&
      Math.abs(backendPaymentAmount - invoiceAmount) > 0.009
    ) {
      console.log('PAYMENT AMOUNT MISMATCH:', {
        paymentBillId,
        invoiceAmount,
        backendPaymentAmount,
        backendAmountRaw,
      });

      throw new Error(
        `Payment amount mismatch. Your outstanding balance is $${invoiceAmount.toFixed(
          2,
        )}, but the server prepared $${backendPaymentAmount.toFixed(
          2,
        )}. Payment has been blocked. Please refresh the bill or contact support.`,
      );
    }

    const clientSecret = firstValue(
      result?.stripe_client_secret,
      result?.client_secret,
      result?.data?.stripe_client_secret,
      result?.data?.client_secret,
    );

    const paymentIntentId = firstValue(
      result?.payment_intent_id,
      result?.data?.payment_intent_id,
      result?.payment_intent?.id,
      result?.data?.payment_intent?.id,
    );

    if (!clientSecret) {
      throw new Error('Stripe client secret was not returned by the server.');
    }

    return {
      clientSecret,

      paymentIntentId,
    };
  };

  /* =====================================================
   * CONFIRM PAYMENT
   * ===================================================== */

  const confirmBackendPayment = async (paymentIntentId, paymentMethod) => {
    const token = await getCustomerToken();

    if (!token) {
      throw new Error('Your login session has expired.');
    }

    const response = await fetch(
      getConfirmBillPaymentApi(paymentBillId),

      {
        method: 'POST',

        headers: {
          Accept: 'application/json',

          'Content-Type': 'application/json',

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          payment_intent_id: paymentIntentId,

          payment_method: paymentMethod,

          bill_id: paymentBillId,

          weekly_bill_id: paymentBillId,

          invoice_id: invoiceId,

          invoice_ids: sourceInvoiceIds,

          source_invoice_ids: sourceInvoiceIds,

          weekly_payment: isWholeWeekPayment,

          amount: Number(invoiceAmount.toFixed(2)),

          weekly_total: Number(invoiceAmount.toFixed(2)),

          delivery_charge: Number(deliveryTotal.toFixed(2)),
        }),
      },
    );

    const result = await readJsonResponse(response);

    if (!response.ok || result?.success === false) {
      throw new Error(
        result?.message ||
          result?.error ||
          'Weekly payment could not be verified.',
      );
    }

    return result;
  };

  /* =====================================================
   * COMPLETE PAYMENT
   * ===================================================== */

  const completePayment = async paymentMethod => {
    await AsyncStorage.removeItem(WEEKLY_ORDERS_STORAGE_KEY).catch(() => {});

    const updated = allInvoices.map(item => {
      const belongsToWeek =
        sourceInvoiceIds.includes(String(item.id)) ||
        String(item.id) === String(invoiceId) ||
        (paymentBillId &&
          item.weeklyBillId &&
          String(item.weeklyBillId) === String(paymentBillId));

      if (!belongsToWeek) {
        return item;
      }

      return {
        ...item,

        paid: true,

        status: 'Paid',

        balanceAmount: 0,

        overdue: false,
      };
    });

    setAllInvoices(updated);

    setGeneratedInvoice(previous =>
      previous
        ? {
            ...previous,

            paid: true,

            status: 'Paid',

            balanceAmount: 0,

            overdue: false,
          }
        : previous,
    );

    setWeeklyOrders([]);

    await savePendingPaymentLock(updated);

    setSuccessfulMethod(paymentMethod);

    setSuccessVisible(true);
  };

  /* =====================================================
   * CARD PAYMENT
   * ===================================================== */

  const handleCardPayment = async () => {
    if (processingMethod || !validatePayment()) {
      return;
    }

    try {
      setProcessingMethod('card');

      const payment = await createPaymentIntent();

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: BUSINESS_NAME,

        paymentIntentClientSecret: payment.clientSecret,

        allowsDelayedPaymentMethods: false,
      });

      if (initError) {
        throw new Error(initError.message || 'Unable to initialize payment.');
      }

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        const code = String(paymentError.code ?? '').toLowerCase();

        if (code === 'canceled' || code === 'cancelled') {
          return;
        }

        throw new Error(paymentError.message || 'Card payment failed.');
      }

      await confirmBackendPayment(payment.paymentIntentId, 'stripe');

      await completePayment('Card');
    } catch (err) {
      showPopup(
        'error',

        'Card Payment Failed',

        err?.message || 'Unable to process your weekly bill.',
      );
    } finally {
      setProcessingMethod(null);
    }
  };

  /* =====================================================
   * GOOGLE PAY
   * ===================================================== */

  const handleGooglePay = async () => {
    if (processingMethod || !validatePayment()) {
      return;
    }

    if (Platform.OS !== 'android') {
      showPopup(
        'info',

        'Google Pay',

        'Google Pay is available on Android devices.',
      );

      return;
    }

    try {
      setProcessingMethod('google');

      const supported = await isPlatformPaySupported({
        googlePay: {
          testEnv: __DEV__,
        },
      });

      if (!supported) {
        throw new Error('Google Pay is not available on this device.');
      }

      const payment = await createPaymentIntent();

      const { error: payError } = await confirmPlatformPayPayment(
        payment.clientSecret,

        {
          googlePay: {
            testEnv: __DEV__,

            merchantName: BUSINESS_NAME,

            merchantCountryCode: MERCHANT_COUNTRY,

            currencyCode: currency,

            billingAddressConfig: {
              format: PlatformPay.BillingAddressFormat.Full,

              isPhoneNumberRequired: false,

              isRequired: false,
            },
          },
        },
      );

      if (payError) {
        throw new Error(payError.message || 'Google Pay payment failed.');
      }

      await confirmBackendPayment(
        payment.paymentIntentId,

        'google_pay',
      );

      await completePayment('Google Pay');
    } catch (err) {
      showPopup(
        'error',

        'Google Pay',

        err?.message || 'Unable to process Google Pay.',
      );
    } finally {
      setProcessingMethod(null);
    }
  };

  /* =====================================================
   * APPLE PAY
   * ===================================================== */

  const handleApplePay = async () => {
    if (processingMethod || !validatePayment()) {
      return;
    }

    if (Platform.OS !== 'ios') {
      showPopup(
        'info',

        'Apple Pay',

        'Apple Pay is available on iOS devices.',
      );

      return;
    }

    try {
      setProcessingMethod('apple');

      const supported = await isPlatformPaySupported();

      if (!supported) {
        throw new Error('Apple Pay is not available on this device.');
      }

      const payment = await createPaymentIntent();

      const { error: payError } = await confirmPlatformPayPayment(
        payment.clientSecret,

        {
          applePay: {
            merchantCountryCode: MERCHANT_COUNTRY,

            currencyCode: currency,

            cartItems: [
              {
                label: `Weekly Bill ${invoiceNumber ?? ''}`,

                amount: invoiceAmount.toFixed(2),

                paymentType: PlatformPay.PaymentType.Immediate,
              },
            ],
          },
        },
      );

      if (payError) {
        throw new Error(payError.message || 'Apple Pay payment failed.');
      }

      await confirmBackendPayment(
        payment.paymentIntentId,

        'apple_pay',
      );

      await completePayment('Apple Pay');
    } catch (err) {
      showPopup(
        'error',

        'Apple Pay',

        err?.message || 'Unable to process Apple Pay.',
      );
    } finally {
      setProcessingMethod(null);
    }
  };

  const paymentMethods = [
    {
      id: 'card',

      title: 'Pay with Card',

      subtitle: 'Visa, Mastercard and supported cards',

      image: require('../assets/login-icons/card-pay.png'),

      onPress: handleCardPayment,
    },

    {
      id: 'google',

      title: 'Google Pay',

      subtitle: 'Pay securely using Google Pay',

      image: require('../assets/login-icons/google-pay.png'),

      onPress: handleGooglePay,
    },

    {
      id: 'apple',

      title: 'Apple Pay',

      subtitle: 'Pay securely using Apple Pay',

      image: require('../assets/login-icons/apple-pay.png'),

      onPress: handleApplePay,
    },
  ];

  const popupTheme = {
    error: {
      icon: 'close-circle-outline',

      color: '#C83D43',

      bg: '#FDEBEC',
    },

    warning: {
      icon: 'warning-outline',

      color: '#B87300',

      bg: '#FFF4DD',
    },

    success: {
      icon: 'checkmark-circle-outline',

      color: '#278850',

      bg: '#E8F6ED',
    },

    info: {
      icon: 'information-circle-outline',

      color: '#A00B0F',

      bg: '#FFF0F0',
    },
  }[popup.type] ?? {
    icon: 'information-circle-outline',

    color: '#A00B0F',

    bg: '#FFF0F0',
  };

  const billCount = Math.max(
    sourceInvoiceIds.length,

    Number(generatedInvoice?.sourceInvoiceCount ?? 0),

    weeklyOrders.length,
  );

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF9F6" />

        <View
          style={[
            styles.screen,

            {
              width: responsive.width,
            },
          ]}
        >
          <View
            style={[
              styles.header,

              {
                paddingHorizontal: responsive.padding,
              },
            ]}
          >
            <Pressable
              style={styles.backButton}
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
                flex: 1,

                marginLeft: 12,
              }}
            >
              <Text style={styles.eyebrow}>WEEKLY BILLING</Text>

              <Text style={styles.headerTitle}>Payment Details</Text>
            </View>

            {loading ? (
              <ActivityIndicator color="#A00B0F" />
            ) : (
              <View
                style={{
                  width: 20,
                }}
              />
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadInvoices(true)}
                colors={['#A00B0F']}
                tintColor="#A00B0F"
              />
            }
            contentContainerStyle={[
              styles.content,

              {
                paddingHorizontal: responsive.padding,
              },
            ]}
          >
            <View style={styles.ruleCard}>
              <View style={styles.ruleIcon}>
                <Image
                  source={require('../assets/login-icons/7-days.png')}
                  style={styles.locationIcon}
                />
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.ruleTitle}>Monday-to-Monday Billing</Text>

                <Text style={styles.ruleText}>
                  Normal completed weekly bills are payable on Monday. Overdue
                  bills can be paid immediately on any day. Current-week orders
                  cannot be paid before the billing cycle is completed.
                </Text>

                <Text style={styles.rulePeriod}>
                  Current cycle: {formatDate(currentMonday)} –{' '}
                  {formatDate(nextMonday)}
                </Text>
              </View>
            </View>

            {loading && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#A00B0F" />

                <Text style={styles.loadingText}>
                  Checking your weekly bills...
                </Text>
              </View>
            )}

            {!!error && !loading && (
              <View style={styles.errorCard}>
                {/* <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color="#A00B0F"
                /> */}

                <View
                  style={{
                    flex: 1,

                    marginLeft: 9,
                  }}
                >
                  <Text style={styles.errorTitle}>Unable to Load Bills</Text>

                  <Text style={styles.errorText}>{error}</Text>

                  <Pressable
                    onPress={() => loadInvoices()}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {!loading &&
              !error &&
              !generatedInvoice &&
              payableInvoices.length === 0 && (
                <View style={[styles.emptyCard, styles.noPaymentCard]}>
                  <View style={styles.noPaymentIcon}>
                    <Image
                      source={require('../assets/login-icons/no-due-payment-method.png')}
                      style={styles.locationIconLarge}
                    />
                  </View>

                  <Text style={styles.noPaymentTitle}>No Payment Due</Text>

                  <Text style={styles.noPaymentText}>
                    There is currently no completed weekly bill waiting for
                    payment.
                  </Text>
                </View>
              )}

            {!loading &&
              payableInvoices.length > 0 &&
              overdueInvoices.length === 0 && (
                <View style={styles.paymentDueCard}>
                  {/* <Ionicons name="receipt-outline" size={22} color="#A00B0F" /> */}

                  <View
                    style={{
                      flex: 1,

                      marginLeft: 10,
                    }}
                  >
                    <Text style={styles.paymentDueTitle}>Payment Due</Text>

                    <Text style={styles.paymentDueText}>
                      You have {payableInvoices.length} unpaid weekly bill
                      {payableInvoices.length === 1 ? '' : 's'} with an
                      outstanding balance.
                    </Text>
                  </View>
                </View>
              )}

            {!loading && overdueInvoices.length > 0 && (
              <View style={styles.blockCard}>
                <Image
                  source={require('../assets/login-icons/block-order.png')}
                  style={styles.locationIcon}
                />

                <View
                  style={{
                    flex: 1,

                    marginLeft: 10,
                  }}
                >
                  <Text style={styles.blockTitle}>New Orders Are Blocked</Text>

                  <Text style={styles.blockText}>
                    You have {overdueInvoices.length} overdue weekly bill
                    {overdueInvoices.length === 1 ? '' : 's'}. Please clear the
                    overdue balance before placing a new order.
                  </Text>
                </View>
              </View>
            )}

            {generatedInvoice && isWholeWeekPayment && (
              <View
                style={[
                  styles.weekInfoCard,

                  invoiceOverdue && styles.weekInfoOverdue,
                ]}
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={[
                      styles.weekInfoEyebrow,

                      invoiceOverdue && {
                        color: '#B42318',
                      },
                    ]}
                  >
                    {invoiceOverdue ? 'OVERDUE WEEKLY BILL' : 'WEEKLY BILL'}
                  </Text>

                  <Text style={styles.weekInfoTitle}>
                    {billCount} tiffin bill
                    {billCount === 1 ? '' : 's'} included
                  </Text>

                  <Text style={styles.weekInfoText}>
                    All orders from this billing week are combined into one
                    weekly bill.
                  </Text>
                </View>
              </View>
            )}

            {generatedInvoice && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text style={styles.summarySmall}>WEEKLY BILL</Text>

                    <Text style={styles.summaryPeriod}>
                      {formatDate(generatedInvoice.startDate)} –{' '}
                      {formatDate(generatedInvoice.endDate)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,

                      invoicePaid
                        ? styles.paidPill
                        : invoiceOverdue
                        ? styles.overduePill
                        : styles.readyPill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,

                        invoicePaid
                          ? styles.paidStatus
                          : invoiceOverdue
                          ? styles.overdueStatus
                          : styles.readyStatus,
                      ]}
                    >
                      {invoicePaid
                        ? 'Paid'
                        : invoiceOverdue
                        ? 'Overdue'
                        : currentWeek
                        ? 'Current Week'
                        : !mondayPaymentDay
                        ? 'Pay Monday'
                        : 'Payment Due'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <SummaryRow
                  label="Invoice Number"
                  value={invoiceNumber || `#${invoiceId}`}
                />

                <SummaryRow
                  label="Weekly Bill ID"
                  value={
                    paymentBillId
                      ? String(paymentBillId)
                      : 'Not returned by API'
                  }
                />

                <SummaryRow
                  label="Tiffin Bills in Week"
                  value={String(billCount)}
                />

                <SummaryRow
                  label="Status"
                  value={generatedInvoice.status || 'Payment Due'}
                />

                <SummaryRow
                  label="Due Date"
                  value={formatDate(generatedInvoice.dueDate)}
                />

                <SummaryRow
                  label="Delivery Charges"
                  value={`${currency} ${deliveryTotal.toFixed(2)}`}
                />

                <SummaryRow
                  label="Invoice Total"
                  value={`${currency} ${invoiceTotal.toFixed(2)}`}
                />

                <View style={styles.divider} />

                <View style={styles.totalRow}>
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text style={styles.totalLabel}>
                      {invoicePaid ? 'Paid' : 'Amount Due'}
                    </Text>

                    <Text style={styles.totalNote}>
                      Includes applicable delivery charges.
                    </Text>
                  </View>

                  <Text style={styles.totalAmount}>
                    {currency} {invoiceAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {generatedInvoice && (
              <>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.eyebrow}>WEEKLY DETAILS</Text>

                    <Text style={styles.sectionTitle}>
                      Tiffins in this Week
                    </Text>
                  </View>

                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{weeklyOrders.length}</Text>
                  </View>
                </View>

                {weeklyOrders.length > 0 ? (
                  <View style={styles.ordersCard}>
                    {weeklyOrders.map((order, index) => {
                      const billing = getOrderBillingBreakdown(order);

                      const id = firstValue(
                        order?.order_number,
                        order?.order_id,
                        order?.orderId,
                        order?.id,
                        index + 1,
                      );

                      const orderDate = getOrderDate(order);

                      return (
                        <View
                          key={`${id}-${index}`}
                          style={[
                            styles.orderRow,

                            index === weeklyOrders.length - 1 && {
                              borderBottomWidth: 0,
                            },
                          ]}
                        >
                          <View style={styles.orderIcon}>
                            <Image
                              source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                              style={styles.locationIcon}
                            />
                          </View>

                          <View
                            style={{
                              flex: 1,
                            }}
                          >
                            <Text style={styles.orderTitle}>
                              Order #{String(id)}
                            </Text>

                            <Text style={styles.orderDate}>
                              {orderDate
                                ? formatDate(orderDate)
                                : 'Weekly invoice order'}
                            </Text>

                            {billing.deliveryCharge > 0 && (
                              <Text style={styles.deliveryText}>
                                Food {currency} {billing.subtotal.toFixed(2)} +
                                Delivery {currency}{' '}
                                {billing.deliveryCharge.toFixed(2)}
                              </Text>
                            )}
                          </View>

                          <Text style={styles.orderAmount}>
                            {currency} {billing.total.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Image
                      source={require('../assets/login-icons/empty-cart.png')}
                      style={styles.locationIcon}
                    />

                    <Text style={styles.emptyTitle}>No Order Details</Text>

                    <Text style={styles.emptyText}>
                      Individual order information was not returned by the
                      invoice API.
                    </Text>
                  </View>
                )}
              </>
            )}

            {generatedInvoice &&
              isWholeWeekPayment &&
              !paymentBillId &&
              !loading && (
                <View style={styles.missingBillCard}>
                  {/* <Ionicons name="warning-outline" size={22} color="#B87300" /> */}

                  <View
                    style={{
                      flex: 1,

                      marginLeft: 9,
                    }}
                  >
                    <Text style={styles.missingTitle}>
                      Weekly Bill ID Missing
                    </Text>

                    <Text style={styles.missingText}>
                      This weekly invoice does not contain a valid shared
                      weekly_bill_id. Payment is blocked to prevent an incorrect
                      partial payment.
                    </Text>
                  </View>
                </View>
              )}

            {generatedInvoice &&
              invoiceOverdue &&
              !invoicePaid &&
              paymentBillId &&
              invoiceAmount > 0 && (
                <View style={styles.overduePayCard}>
                  {/* <View style={styles.overduePayIcon}>
                    <Ionicons name="alert-circle" size={26} color="#B42318" />
                  </View> */}

                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text style={styles.overduePayEyebrow}>
                      OVERDUE PAYMENT
                    </Text>

                    <Text style={styles.overduePayTitle}>
                      Pay this overdue bill now
                    </Text>

                    <Text style={styles.overduePayText}>
                      This bill is overdue. You can pay it now using any
                      available payment method below.
                    </Text>

                    <Text style={styles.overduePayAmount}>
                      Amount due: {currency} {invoiceAmount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

            {paymentAllowed && (
              <>
                <Text
                  style={[
                    styles.sectionTitle,

                    {
                      marginTop: 22,

                      marginBottom: 10,
                    },
                  ]}
                >
                  {invoiceOverdue ? 'Pay Overdue Bill' : 'Pay Weekly Bill'}
                </Text>

                <View style={styles.methodsCard}>
                  {paymentMethods.map((method, index) => (
                    <TouchableOpacity
                      key={method.id}
                      disabled={Boolean(processingMethod)}
                      activeOpacity={0.8}
                      onPress={method.onPress}
                      style={[
                        styles.methodRow,

                        index === paymentMethods.length - 1 && {
                          borderBottomWidth: 0,
                        },
                      ]}
                    >
                      <View style={styles.methodIcon}>
                        {processingMethod === method.id ? (
                          <ActivityIndicator color="#A00B0F" />
                        ) : (
                          <Image
                            source={method.image}
                            style={styles.methodLogo}
                            resizeMode="contain"
                          />
                        )}
                      </View>

                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text style={styles.methodTitle}>{method.title}</Text>

                        <Text style={styles.methodSubtitle}>
                          {method.subtitle}
                        </Text>
                      </View>

                      {/* <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#A00B0F"
                      /> */}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {generatedInvoice &&
              !paymentAllowed &&
              !invoiceOverdue &&
              !loading &&
              paymentBillId && (
                <View
                  style={[
                    styles.emptyCard,

                    {
                      marginTop: 18,
                    },
                  ]}
                >
                  {/* <Ionicons
                    name={
                      invoicePaid
                        ? 'checkmark-circle-outline'
                        : 'lock-closed-outline'
                    }
                    size={32}
                    color={invoicePaid ? '#278850' : '#A00B0F'}
                  /> */}

                  <Text style={styles.emptyTitle}>
                    {invoicePaid
                      ? 'Weekly Bill Already Paid'
                      : currentWeek
                      ? 'Billing Week Still Open'
                      : !mondayPaymentDay
                      ? 'Payment Available on Monday'
                      : 'Payment Not Available'}
                  </Text>

                  <Text style={styles.emptyText}>
                    {invoicePaid
                      ? 'The complete weekly bill has already been paid.'
                      : currentWeek
                      ? 'Current-week orders cannot be paid before the billing cycle is completed.'
                      : !mondayPaymentDay
                      ? 'Normal weekly bill payments are available on Monday.'
                      : 'There is currently no payable weekly balance.'}
                  </Text>
                </View>
              )}

            <View
              style={{
                height: 45,
              }}
            />
          </ScrollView>
        </View>
      </SafeAreaView>

      <Modal
        visible={popup.visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() =>
          setPopup(previous => ({
            ...previous,

            visible: false,
          }))
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupCard}>
            <View
              style={[
                styles.popupIcon,

                {
                  backgroundColor: popupTheme.bg,
                },
              ]}
            >
              {/* <Ionicons
                name={popupTheme.icon}
                size={36}
                color={popupTheme.color}
              /> */}
            </View>

            <Text style={styles.popupTitle}>{popup.title}</Text>

            <Text style={styles.popupMessage}>{popup.message}</Text>

            <TouchableOpacity
              style={styles.popupButton}
              activeOpacity={0.85}
              onPress={() =>
                setPopup(previous => ({
                  ...previous,

                  visible: false,
                }))
              }
            >
              <Text style={styles.popupButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupCard}>
            <View
              style={[
                styles.popupIcon,

                {
                  backgroundColor: '#E8F7ED',
                },
              ]}
            >
              {/* <Ionicons name="checkmark-circle" size={42} color="#278850" /> */}
            </View>

            <Text style={styles.popupTitle}>Weekly Bill Paid!</Text>

            <Text style={styles.popupMessage}>
              Your complete weekly bill has been paid successfully using{' '}
              {successfulMethod}.
            </Text>

            <TouchableOpacity
              style={styles.popupButton}
              activeOpacity={0.85}
              onPress={() => {
                setSuccessVisible(false);

                navigation.reset({
                  index: 0,

                  routes: [
                    {
                      name: 'MainTabs',
                    },
                  ],
                });
              }}
            >
              <Text style={styles.popupButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

/* =========================================================
 * SUMMARY ROW
 * ========================================================= */

const SummaryRow = ({ label, value }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>

    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

export default PaymentDetails;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,

    backgroundColor: '#FFF9F6',
  },

  screen: {
    flex: 1,

    alignSelf: 'center',

    backgroundColor: '#FFF9F6',
  },

  content: {
    paddingTop: 10,

    paddingBottom: 30,
  },

  header: {
    minHeight: 72,

    flexDirection: 'row',

    alignItems: 'center',
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

    tintColor: '#A00B0F',
  },

  eyebrow: {
    color: '#A00B0F',

    fontSize: 9,

    fontWeight: '900',

    letterSpacing: 0.9,
  },

  headerTitle: {
    color: '#2C201C',

    fontSize: 23,

    fontWeight: '900',

    marginTop: 2,
  },

  ruleCard: {
    flexDirection: 'row',

    backgroundColor: '#FFF',

    borderWidth: 1,

    borderColor: '#EFE2DB',

    borderRadius: 16,

    padding: 13,

    marginBottom: 12,
  },

  ruleIcon: {
    width: 42,

    height: 42,

    borderRadius: 13,

    backgroundColor: '#FFF0F0',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 10,
  },

  ruleTitle: {
    color: '#352722',

    fontSize: 12,

    fontWeight: '900',
  },

  ruleText: {
    color: '#81736D',

    fontSize: 10,

    lineHeight: 15,

    marginTop: 3,
  },

  rulePeriod: {
    color: '#A00B0F',

    fontSize: 10,

    fontWeight: '900',

    marginTop: 6,
  },

  loadingCard: {
    minHeight: 150,

    backgroundColor: '#FFFFFF',

    borderRadius: 16,

    borderWidth: 1,

    borderColor: '#EFE5E0',

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 15,
  },

  loadingText: {
    color: '#81736D',

    fontSize: 11,

    fontWeight: '700',

    marginTop: 10,
  },

  paymentDueCard: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFF5F5',

    borderWidth: 1,

    borderColor: '#F0B7B9',

    borderRadius: 16,

    padding: 14,

    marginBottom: 12,
  },

  paymentDueTitle: {
    color: '#A00B0F',

    fontSize: 13,

    fontWeight: '900',
  },

  paymentDueText: {
    color: '#775255',

    fontSize: 11,

    lineHeight: 17,

    marginTop: 4,
  },

  blockCard: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFF7E9',

    borderWidth: 1,

    borderColor: '#F0D6A5',

    borderRadius: 16,

    padding: 13,

    marginBottom: 12,
  },

  blockTitle: {
    color: '#8A5700',

    fontSize: 12,

    fontWeight: '900',
  },

  blockText: {
    color: '#876A3A',

    fontSize: 10,

    lineHeight: 15,

    marginTop: 3,
  },

  weekInfoCard: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFF4F2',

    borderWidth: 1,

    borderColor: '#EFCFC9',

    borderRadius: 17,

    padding: 13,

    marginBottom: 12,
  },

  weekInfoOverdue: {
    backgroundColor: '#FFF1F0',

    borderColor: '#F2BBB7',
  },

  weekInfoEyebrow: {
    color: '#A00B0F',

    fontSize: 9,

    fontWeight: '900',

    letterSpacing: 0.7,
  },

  weekInfoTitle: {
    color: '#4A2F2A',

    fontSize: 14,

    fontWeight: '900',

    marginTop: 3,
  },

  weekInfoText: {
    color: '#846B65',

    fontSize: 10,

    lineHeight: 15,

    marginTop: 3,
  },

  summaryCard: {
    backgroundColor: '#A00B0F',

    borderRadius: 20,

    padding: 18,

    marginBottom: 15,
  },

  summaryTop: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  summarySmall: {
    color: '#DAB9BA',

    fontSize: 9,

    fontWeight: '900',

    letterSpacing: 1,
  },

  summaryPeriod: {
    color: '#FFF',

    fontSize: 14,

    fontWeight: '900',

    marginTop: 4,
  },

  statusPill: {
    paddingHorizontal: 9,

    paddingVertical: 6,

    borderRadius: 16,

    marginLeft: 8,
  },

  paidPill: {
    backgroundColor: '#E8F6ED',
  },

  overduePill: {
    backgroundColor: '#FEECEB',
  },

  readyPill: {
    backgroundColor: 'rgba(255,255,255,.14)',
  },

  statusText: {
    fontSize: 9.5,

    fontWeight: '900',
  },

  paidStatus: {
    color: '#278850',
  },

  overdueStatus: {
    color: '#B42318',
  },

  readyStatus: {
    color: '#FFF',
  },

  divider: {
    height: 1,

    backgroundColor: 'rgba(255,255,255,.16)',

    marginVertical: 13,
  },

  summaryRow: {
    flexDirection: 'row',

    justifyContent: 'space-between',

    marginBottom: 9,
  },

  summaryLabel: {
    flex: 1,

    color: '#E0C7C7',

    fontSize: 10.5,
  },

  summaryValue: {
    maxWidth: '58%',

    color: '#FFF',

    fontSize: 11,

    fontWeight: '900',

    textAlign: 'right',
  },

  totalRow: {
    flexDirection: 'row',

    alignItems: 'flex-end',
  },

  totalLabel: {
    color: '#FFF',

    fontSize: 12,

    fontWeight: '900',
  },

  totalNote: {
    maxWidth: 220,

    color: '#D2AEAF',

    fontSize: 9,

    lineHeight: 13,

    marginTop: 4,
  },

  totalAmount: {
    color: '#FFF',

    fontSize: 22,

    fontWeight: '900',

    marginLeft: 10,
  },

  errorCard: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFF1F1',

    borderWidth: 1,

    borderColor: '#F0D1D3',

    borderRadius: 14,

    padding: 13,

    marginBottom: 15,
  },

  errorTitle: {
    color: '#A00B0F',

    fontSize: 12,

    fontWeight: '900',
  },

  errorText: {
    color: '#8A393C',

    fontSize: 10,

    lineHeight: 15,

    marginTop: 4,
  },

  retryButton: {
    alignSelf: 'flex-start',

    minHeight: 34,

    paddingHorizontal: 14,

    borderRadius: 9,

    backgroundColor: '#A00B0F',

    justifyContent: 'center',

    marginTop: 10,
  },

  retryButtonText: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '900',
  },

  sectionHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginTop: 4,

    marginBottom: 10,
  },

  sectionTitle: {
    color: '#281E1A',

    fontSize: 18,

    fontWeight: '900',

    marginTop: 2,
  },

  countBadge: {
    minWidth: 32,

    height: 32,

    borderRadius: 16,

    backgroundColor: '#FFF0F0',

    alignItems: 'center',

    justifyContent: 'center',
  },

  countText: {
    color: '#A00B0F',

    fontSize: 12,

    fontWeight: '900',
  },

  ordersCard: {
    backgroundColor: '#FFF',

    borderWidth: 1,

    borderColor: '#EEE5E0',

    borderRadius: 15,

    paddingHorizontal: 12,
  },

  orderRow: {
    minHeight: 70,

    flexDirection: 'row',

    alignItems: 'center',

    borderBottomWidth: 1,

    borderBottomColor: '#F2EBE7',
  },

  orderIcon: {
    width: 36,

    height: 36,

    borderRadius: 11,

    backgroundColor: '#FFF0F0',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 10,
  },

  orderTitle: {
    color: '#342722',

    fontSize: 11.5,

    fontWeight: '900',
  },

  orderDate: {
    color: '#9B8B84',

    fontSize: 9.5,

    marginTop: 3,
  },

  deliveryText: {
    color: '#A56A42',

    fontSize: 9,

    lineHeight: 13,

    marginTop: 3,

    fontWeight: '700',
  },

  orderAmount: {
    color: '#A00B0F',

    fontSize: 12,

    fontWeight: '900',

    marginLeft: 8,
  },

  emptyCard: {
    minHeight: 130,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF',

    borderWidth: 1,

    borderColor: '#EEE5E0',

    borderRadius: 15,

    padding: 18,
  },

  emptyTitle: {
    color: '#4A3C36',

    fontSize: 13,

    fontWeight: '900',

    marginTop: 8,
  },

  emptyText: {
    maxWidth: 300,

    color: '#998B85',

    fontSize: 10,

    lineHeight: 15,

    textAlign: 'center',

    marginTop: 4,
  },

  noPaymentCard: {
    minHeight: 210,

    marginBottom: 18,

    paddingHorizontal: 24,
  },

  noPaymentIcon: {
    width: 72,

    height: 72,

    borderRadius: 36,

    backgroundColor: '#E8F6ED',

    alignItems: 'center',

    justifyContent: 'center',
  },

  noPaymentTitle: {
    color: '#2F3D35',

    fontSize: 15,

    fontWeight: '900',

    marginTop: 12,
  },

  noPaymentText: {
    maxWidth: 330,

    color: '#7F8B84',

    fontSize: 10,

    lineHeight: 16,

    textAlign: 'center',

    marginTop: 6,
  },

  missingBillCard: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFF7E9',

    borderWidth: 1,

    borderColor: '#F0D6A5',

    borderRadius: 15,

    padding: 12,

    marginTop: 17,
  },

  missingTitle: {
    color: '#8A5700',

    fontSize: 12,

    fontWeight: '900',
  },

  missingText: {
    color: '#876A3A',

    fontSize: 10,

    lineHeight: 15,

    marginTop: 3,
  },

  overduePayCard: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFF1F0',

    borderWidth: 1,

    borderColor: '#F2BBB7',

    borderRadius: 16,

    padding: 14,

    marginTop: 16,

    marginBottom: 4,
  },

  overduePayIcon: {
    width: 46,

    height: 46,

    borderRadius: 23,

    backgroundColor: '#FDE4E2',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 11,
  },

  overduePayEyebrow: {
    color: '#B42318',

    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 0.8,
  },

  overduePayTitle: {
    color: '#5A1C18',

    fontSize: 13,

    fontWeight: '900',

    marginTop: 3,
  },

  overduePayText: {
    color: '#87524D',

    fontSize: 10,

    lineHeight: 15,

    marginTop: 4,
  },

  overduePayAmount: {
    color: '#A00B0F',

    fontSize: 11,

    fontWeight: '900',

    marginTop: 7,
  },

  methodsCard: {
    backgroundColor: '#FFF',

    borderWidth: 1,

    borderColor: '#EFE5E0',

    borderRadius: 18,

    overflow: 'hidden',
  },

  methodRow: {
    minHeight: 76,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 12,

    borderBottomWidth: 1,

    borderBottomColor: '#F2EAE6',
  },

  methodIcon: {
    width: 48,

    height: 48,

    borderRadius: 14,

    backgroundColor: '#FAF8F8',

    borderWidth: 1,

    borderColor: '#F1EBE8',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 12,
  },

  methodLogo: {
    width: 35,

    height: 35,
  },

  methodTitle: {
    color: '#30231E',

    fontSize: 13,

    fontWeight: '900',
  },

  methodSubtitle: {
    color: '#94847D',

    fontSize: 9.5,

    lineHeight: 13,

    marginTop: 3,
  },

  modalOverlay: {
    flex: 1,

    backgroundColor: 'rgba(20,15,18,.66)',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 22,
  },

  popupCard: {
    width: '100%',

    maxWidth: 380,

    backgroundColor: '#FFF',

    borderRadius: 24,

    padding: 24,

    alignItems: 'center',
  },

  popupIcon: {
    width: 78,

    height: 78,

    borderRadius: 39,

    alignItems: 'center',

    justifyContent: 'center',
  },

  popupTitle: {
    color: '#2A2027',

    fontSize: 21,

    fontWeight: '900',

    textAlign: 'center',

    marginTop: 14,
  },

  popupMessage: {
    color: '#776D72',

    fontSize: 12,

    lineHeight: 18,

    textAlign: 'center',

    marginTop: 7,
  },

  popupButton: {
    width: '100%',

    minHeight: 48,

    backgroundColor: '#A00B0F',

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 20,
  },

  popupButtonText: {
    color: '#FFF',

    fontSize: 12,

    fontWeight: '900',
  },

  locationIcon: {
    width: 25,

    height: 25,

    resizeMode: 'contain',
  },

  locationIconLarge: {
    width: 40,

    height: 40,

    resizeMode: 'contain',
  },
});
