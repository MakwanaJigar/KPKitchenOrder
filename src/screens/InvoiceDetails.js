import React, { useCallback, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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

const PROFILE_API = `${BASE_API_URL}/customer/profile`;

const CUSTOMER_TOKEN_KEYS = [
  'token',
  '@kp_kitchen_customer_token',
  '@kp_customer_token',
  'customer_token',
];

/* =========================================================
 * HELPERS
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

const safeDate = value => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
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

const toText = value => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return [
      value.full_address,
      value.address,
      value.address_line,
      value.address_line_1,
      value.street,
      value.suburb,
      value.city,
      value.state,
      value.postcode,
      value.pincode,
    ]
      .filter(Boolean)
      .join(', ');
  }

  return String(value).trim();
};

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

const getOrderDate = order =>
  firstValue(
    order?.delivery_date,
    order?.deliveryDate,
    order?.order_date,
    order?.orderDate,
    order?.created_at,
    order?.createdAt,
  );

const getOrderQuantity = order =>
  Math.max(1, Number(firstValue(order?.quantity, order?.qty, 1)) || 1);

const getOrderTotal = order =>
  parseMoney(
    firstValue(
      order?.total_amount,
      order?.totalAmount,
      order?.grand_total,
      order?.line_total,
      order?.amount,
      order?.total,
      order?.price,
      0,
    ),
  );

const getOrderDelivery = order =>
  parseMoney(
    firstValue(
      order?.delivery_charge,
      order?.deliveryCharge,
      order?.delivery_fee,
      order?.deliveryFee,
      order?.shipping_charge,
      0,
    ),
  );

const getOrderUnitPrice = order => {
  const explicit = firstValue(
    order?.unit_price,
    order?.unitPrice,
    order?.price,
    order?.tiffin_price,
    order?.tiffin?.price,
    order?.product?.price,
  );

  if (explicit !== null) {
    return parseMoney(explicit);
  }

  const foodTotal = Math.max(0, getOrderTotal(order) - getOrderDelivery(order));

  return foodTotal / getOrderQuantity(order);
};

const getOrderItems = order => {
  const items = Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.order_items)
    ? order.order_items
    : Array.isArray(order?.menu_items)
    ? order.menu_items
    : [];

  return items
    .map(item =>
      typeof item === 'string'
        ? item
        : firstValue(item?.name, item?.item_name, item?.menu_item?.name),
    )
    .filter(Boolean);
};

/* =========================================================
 * CUSTOMER
 * ========================================================= */

const extractProfile = result =>
  result?.data?.customer ??
  result?.data?.user ??
  result?.data ??
  result?.customer ??
  result ??
  {};

const getProfileAddress = profile => {
  let address = toText(
    firstValue(
      profile?.delivery_address,
      profile?.delivery_location,
      profile?.full_address,
      profile?.address,
    ),
  );

  if (!address && Array.isArray(profile?.addresses)) {
    const selected =
      profile.addresses.find(
        value =>
          value?.is_default === true ||
          value?.is_default === 1 ||
          value?.is_default === '1',
      ) ?? profile.addresses[0];

    address = toText(selected);
  }

  return address;
};

/* =========================================================
 * MAIN COMPONENT
 * ========================================================= */

const InvoiceDetails = ({ navigation, route }) => {
  const { width } = useWindowDimensions();

  const invoice = useMemo(
    () => route?.params?.invoice ?? {},

    [route?.params?.invoice],
  );

  const paymentParams = route?.params?.paymentParams ?? null;

  const currency = invoice.currency ?? 'AUD';

  const orders = useMemo(
    () => (Array.isArray(invoice.orders) ? invoice.orders : []),

    [invoice],
  );

  const [profile, setProfile] = useState(null);

  const [profileLoading, setProfileLoading] = useState(true);

  const contentWidth = width >= 768 ? Math.min(width, 720) : width;

  const padding = width >= 768 ? 24 : width <= 360 ? 12 : 16;

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true);

      const token = await getCustomerToken();

      if (!token) {
        return;
      }

      const response = await fetch(PROFILE_API, {
        headers: {
          Accept: 'application/json',

          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return;
      }

      const result = await response.json();

      setProfile(extractProfile(result));
    } catch (error) {
      console.log('INVOICE DETAILS PROFILE ERROR:', error);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();

      return () => {};
    }, [loadProfile]),
  );

  /*
   * Prefer data stored on the invoice/orders (what was actually
   * billed), then fall back to the customer's current profile.
   */
  const customer = useMemo(() => {
    const firstOrder = orders[0] ?? {};

    const rawCustomer =
      invoice?.raw?.customer ??
      invoice?.raw?.user ??
      firstOrder?.customer ??
      firstOrder?.user ??
      {};

    return {
      name: toText(
        firstValue(
          rawCustomer?.name,
          firstOrder?.customer_name,
          profile?.name,
          [profile?.first_name, profile?.last_name].filter(Boolean).join(' '),
        ),
      ),

      phone: toText(
        firstValue(
          rawCustomer?.phone,
          rawCustomer?.mobile,
          firstOrder?.phone,
          firstOrder?.mobile,
          firstOrder?.customer_phone,
          profile?.phone,
          profile?.mobile,
          profile?.phone_number,
          profile?.mobile_number,
        ),
      ),

      email: toText(
        firstValue(rawCustomer?.email, firstOrder?.email, profile?.email),
      ),

      address:
        toText(
          firstValue(
            firstOrder?.delivery_address,
            firstOrder?.deliveryAddress,
            firstOrder?.address,
            firstOrder?.shipping_address,
          ),
        ) || getProfileAddress(profile ?? {}),
    };
  }, [invoice, orders, profile]);

  const totals = useMemo(() => {
    const tiffinCount = orders.reduce(
      (sum, order) => sum + getOrderQuantity(order),

      0,
    );

    const deliveryTotal = orders.reduce(
      (sum, order) => sum + getOrderDelivery(order),

      0,
    );

    const totalAmount = parseMoney(invoice.totalAmount);

    return {
      tiffinCount,

      deliveryTotal,

      subtotal: Math.max(0, totalAmount - deliveryTotal),

      totalAmount,

      paidAmount: parseMoney(invoice.paidAmount),

      balanceAmount: parseMoney(invoice.balanceAmount),
    };
  }, [invoice, orders]);

  const statusLabel = invoice.paid
    ? 'Paid'
    : invoice.overdue
    ? 'Overdue'
    : 'Payment Due';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF9F6" />

      <View style={[styles.container, { width: contentWidth }]}>
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

          <View style={{ marginLeft: 12 }}>
            <Text style={styles.eyebrow}>BILLING</Text>

            <Text style={styles.headerTitle}>Invoice Details</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: padding,

            paddingTop: 18,

            paddingBottom: 60,
          }}
        >
          {/* ================= INVOICE SUMMARY ================= */}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}>
                <Ionicons name="receipt-outline" size={22} color="#A9090D" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>INVOICE NUMBER</Text>

                <Text style={styles.invoiceNumber}>
                  {invoice.invoiceNumber ?? '—'}
                </Text>

                <Text style={styles.period}>
                  {formatDate(invoice.startDate)} –{' '}
                  {formatDate(invoice.endDate)}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,

                  invoice.paid
                    ? styles.paidBadge
                    : invoice.overdue
                    ? styles.overdueBadge
                    : styles.dueBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,

                    invoice.paid
                      ? styles.paidText
                      : invoice.overdue
                      ? styles.overdueText
                      : styles.dueText,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <InfoLine label="Invoice Number" value={invoice.invoiceNumber} />

            {!!invoice.paymentBillId && (
              <InfoLine
                label="Weekly Bill ID"
                value={String(invoice.paymentBillId)}
              />
            )}

            <InfoLine
              label="Billing Period"
              value={`${formatDate(invoice.startDate)} – ${formatDate(
                invoice.endDate,
              )}`}
            />

            <InfoLine
              label="Generated On"
              value={formatDate(invoice.createdAt)}
            />

            <InfoLine label="Due Date" value={formatDate(invoice.dueDate)} />

            {invoice.paid && (
              <InfoLine label="Paid On" value={formatDate(invoice.paidAt)} />
            )}

            {!!invoice.paymentMethod && (
              <InfoLine label="Payment Method" value={invoice.paymentMethod} />
            )}
          </View>

          {/* ================= CUSTOMER ================= */}

          <SectionTitle eyebrow="BILLED TO" title="Customer Details" />

          <View style={styles.card}>
            {profileLoading && !profile ? (
              <ActivityIndicator
                color="#A9090D"
                style={{ marginVertical: 12 }}
              />
            ) : (
              <>
                <DetailRow
                  icon="person-outline"
                  label="Name"
                  value={customer.name}
                />

                <DetailRow
                  icon="call-outline"
                  label="Phone Number"
                  value={customer.phone}
                />

                {!!customer.email && (
                  <DetailRow
                    icon="mail-outline"
                    label="Email"
                    value={customer.email}
                  />
                )}

                <DetailRow
                  icon="location-outline"
                  label="Delivery Address"
                  value={customer.address}
                  last
                />
              </>
            )}
          </View>

          {/* ================= TIFFINS ================= */}

          <SectionTitle
            eyebrow="ORDERED TIFFINS"
            title={`${orders.length} ${
              orders.length === 1 ? 'Order' : 'Orders'
            }`}
            right={`${totals.tiffinCount} tiffin${
              totals.tiffinCount === 1 ? '' : 's'
            }`}
          />

          <View style={styles.card}>
            {orders.length === 0 ? (
              <Text style={styles.emptyText}>
                No tiffin details were returned for this invoice.
              </Text>
            ) : (
              orders.map((order, index) => {
                const quantity = getOrderQuantity(order);

                const unitPrice = getOrderUnitPrice(order);

                const delivery = getOrderDelivery(order);

                const lineTotal = getOrderTotal(order);

                const items = getOrderItems(order);

                const orderDate = getOrderDate(order);

                return (
                  <View
                    key={`${getOrderId(order)}-${index}`}
                    style={[
                      styles.orderRow,

                      index === orders.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                  >
                    <View style={styles.orderTop}>
                      <View style={styles.orderIcon}>
                        <Ionicons
                          name="restaurant-outline"
                          size={16}
                          color="#A9090D"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderName}>
                          {String(getOrderName(order))}
                        </Text>

                        <Text style={styles.orderMeta}>
                          Order #{String(getOrderId(order))}
                          {orderDate ? `  •  ${formatDate(orderDate)}` : ''}
                        </Text>

                        {items.length > 0 && (
                          <Text style={styles.orderItems}>
                            {items.join(', ')}
                          </Text>
                        )}
                      </View>

                      <Text style={styles.orderTotal}>
                        {formatMoney(lineTotal, currency)}
                      </Text>
                    </View>

                    <View style={styles.orderBreakdown}>
                      <MiniLine
                        label="Price per tiffin"
                        value={formatMoney(unitPrice, currency)}
                      />

                      <MiniLine label="Quantity" value={`× ${quantity}`} />

                      {delivery > 0 && (
                        <MiniLine
                          label="Delivery charge"
                          value={formatMoney(delivery, currency)}
                        />
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ================= TOTALS ================= */}

          <SectionTitle eyebrow="PAYMENT" title="Amount Summary" />

          <View style={styles.card}>
            <AmountLine
              label="Tiffin Subtotal"
              value={formatMoney(totals.subtotal, currency)}
            />

            {totals.deliveryTotal > 0 && (
              <AmountLine
                label="Delivery Charges"
                value={formatMoney(totals.deliveryTotal, currency)}
              />
            )}

            <AmountLine
              label="Total Amount"
              value={formatMoney(totals.totalAmount, currency)}
              strong
            />

            <AmountLine
              label="Amount Paid"
              value={formatMoney(totals.paidAmount, currency)}
              type="paid"
            />

            <AmountLine
              label="Balance Due"
              value={formatMoney(totals.balanceAmount, currency)}
              type={totals.balanceAmount > 0 ? 'due' : 'paid'}
              last
            />
          </View>

          {!!paymentParams && (
            <Pressable
              style={[
                styles.payButton,

                invoice.overdue && { backgroundColor: '#B42318' },
              ]}
              onPress={() =>
                navigation.navigate('PaymentDetails', paymentParams)
              }
            >
              <Ionicons name="card-outline" size={19} color="#FFF" />

              <Text style={styles.payButtonText}>
                Pay {formatMoney(totals.balanceAmount, currency)}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

/* =========================================================
 * SMALL COMPONENTS
 * ========================================================= */

const SectionTitle = ({ eyebrow, title, right }) => (
  <View style={styles.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      <Text style={styles.sectionTitle}>{title}</Text>
    </View>

    {!!right && <Text style={styles.sectionRight}>{right}</Text>}
  </View>
);

const InfoLine = ({ label, value }) => (
  <View style={styles.infoLine}>
    <Text style={styles.infoLabel}>{label}</Text>

    <Text numberOfLines={2} style={styles.infoValue}>
      {value || '—'}
    </Text>
  </View>
);

const DetailRow = ({ icon, label, value, last = false }) => (
  <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
    <View style={styles.detailIcon}>
      <Ionicons name={icon} size={16} color="#A9090D" />
    </View>

    <View style={{ flex: 1 }}>
      <Text style={styles.detailLabel}>{label}</Text>

      <Text style={styles.detailValue}>{value || 'Not available'}</Text>
    </View>
  </View>
);

const MiniLine = ({ label, value }) => (
  <View style={styles.miniLine}>
    <Text style={styles.miniLabel}>{label}</Text>

    <Text style={styles.miniValue}>{value}</Text>
  </View>
);

const AmountLine = ({ label, value, type, strong = false, last = false }) => (
  <View style={[styles.amountLine, last && { borderBottomWidth: 0 }]}>
    <Text style={[styles.amountLabel, strong && styles.amountLabelStrong]}>
      {label}
    </Text>

    <Text
      style={[
        styles.amountValue,

        strong && styles.amountValueStrong,

        type === 'paid' && { color: '#278850' },

        type === 'due' && { color: '#B87300' },
      ]}
    >
      {value}
    </Text>
  </View>
);

export default InvoiceDetails;

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

  sectionHeader: {
    flexDirection: 'row',

    alignItems: 'flex-end',

    marginTop: 6,

    marginBottom: 10,
  },

  sectionTitle: {
    color: '#2B201C',

    fontSize: 15,

    fontWeight: '900',

    marginTop: 2,
  },

  sectionRight: {
    color: '#93857F',

    fontSize: 8,

    fontWeight: '700',
  },

  card: {
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

  iconBox: {
    width: 45,

    height: 45,

    borderRadius: 14,

    backgroundColor: '#FFF0EE',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 10,
  },

  invoiceNumber: {
    color: '#342722',

    fontSize: 13,

    fontWeight: '900',

    marginTop: 2,
  },

  period: {
    color: '#94857F',

    fontSize: 7.5,

    marginTop: 3,
  },

  statusBadge: {
    borderRadius: 16,

    paddingHorizontal: 9,

    paddingVertical: 6,

    marginLeft: 8,
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

  detailRow: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    paddingVertical: 10,

    borderBottomWidth: 1,

    borderBottomColor: '#F4EEEB',
  },

  detailIcon: {
    width: 32,

    height: 32,

    borderRadius: 10,

    backgroundColor: '#FFF0EE',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 10,
  },

  detailLabel: {
    color: '#93857F',

    fontSize: 7.5,

    fontWeight: '700',
  },

  detailValue: {
    color: '#3F302A',

    fontSize: 9.5,

    fontWeight: '800',

    lineHeight: 14,

    marginTop: 2,
  },

  orderRow: {
    paddingVertical: 12,

    borderBottomWidth: 1,

    borderBottomColor: '#EEE5E0',
  },

  orderTop: {
    flexDirection: 'row',

    alignItems: 'flex-start',
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

  orderName: {
    color: '#3F302A',

    fontSize: 10,

    fontWeight: '900',
  },

  orderMeta: {
    color: '#A1928B',

    fontSize: 7.5,

    marginTop: 2,
  },

  orderItems: {
    color: '#796B65',

    fontSize: 7.5,

    lineHeight: 11,

    marginTop: 3,
  },

  orderTotal: {
    color: '#A9090D',

    fontSize: 9.5,

    fontWeight: '900',

    marginLeft: 8,
  },

  orderBreakdown: {
    backgroundColor: '#FBF8F6',

    borderRadius: 10,

    paddingHorizontal: 10,

    paddingVertical: 6,

    marginTop: 9,

    marginLeft: 43,
  },

  miniLine: {
    flexDirection: 'row',

    justifyContent: 'space-between',

    paddingVertical: 3,
  },

  miniLabel: {
    color: '#83746E',

    fontSize: 7.5,
  },

  miniValue: {
    color: '#443630',

    fontSize: 8,

    fontWeight: '800',
  },

  emptyText: {
    color: '#91847E',

    fontSize: 8.5,

    textAlign: 'center',

    paddingVertical: 12,
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

    fontSize: 8.5,
  },

  amountLabelStrong: {
    color: '#2C201C',

    fontWeight: '900',
  },

  amountValue: {
    color: '#4A3933',

    fontSize: 9.5,

    fontWeight: '900',
  },

  amountValueStrong: {
    color: '#A9090D',

    fontSize: 12,
  },

  payButton: {
    minHeight: 50,

    borderRadius: 14,

    backgroundColor: '#A9090D',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 4,
  },

  payButtonText: {
    color: '#FFF',

    fontSize: 10.5,

    fontWeight: '900',

    marginLeft: 8,
  },
});
