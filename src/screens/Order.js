import React, { useCallback, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useFocusEffect } from '@react-navigation/native';

import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================================================
 * API
 * ========================================================= */

const ORDER_API =
  'https://replete-software.com/projects/kp_admin/api/customer/orders';

const PROFILE_API =
  'https://replete-software.com/projects/kp_admin/api/customer/profile';

const CUSTOMIZE_TIFFIN_API =
  'https://replete-software.com/projects/kp_admin/api/customer/customize-tiffin';

/* =========================================================
 * STORAGE
 * ========================================================= */

const CART_STORAGE_KEY = 'kp_customer_cart';

const WEEKLY_ORDERS_STORAGE_KEY = 'kp_customer_weekly_orders';

const ADDRESS_STORAGE_KEY = 'kp_customer_addresses';

const SELECTED_ADDRESS_STORAGE_KEY = 'kp_selected_delivery_address_id';

/* =========================================================
 * DELIVERY ADDRESS HELPERS
 * ========================================================= */

const readJson = async (key, fallback) => {
  try {
    const stored = await AsyncStorage.getItem(key);

    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const isTruthyFlag = value => value === true || value === 1 || value === '1';

const getAddressText = address => {
  const line = firstText(
    address?.full_address,
    address?.address_line,
    address?.address,
  );

  const text =
    line ||
    [
      address?.addressLine1 ?? address?.address_line_1,
      address?.addressLine2 ?? address?.address_line_2,
      address?.suburb ?? address?.city,
      address?.state,
    ]
      .filter(Boolean)
      .map(value => String(value).trim())
      .filter(Boolean)
      .join(', ');

  const pincode = String(address?.pincode ?? address?.postcode ?? '').trim();

  return pincode && !text.includes(pincode) ? `${text} ${pincode}` : text;
};

const normalizeAddresses = list => {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map((item, index) => ({
      id: String(item?.id ?? `address-${index}`),

      type: String(item?.type ?? item?.address_type ?? 'Home'),

      text: getAddressText(item),

      pincode: String(item?.pincode ?? item?.postcode ?? '').trim(),

      isDefault:
        isTruthyFlag(item?.is_default) || isTruthyFlag(item?.isDefault),
    }))
    .filter(item => item.text);
};

/* =========================================================
 * HELPERS
 * ========================================================= */

const toSafeNumber = value => {
  const number = Number(String(value ?? 0).replace(/[^0-9.-]/g, ''));

  return Number.isFinite(number) ? number : 0;
};

const formatMoney = value => `$${toSafeNumber(value).toFixed(2)}`;

/* =========================================================
 * CHECK CUSTOM TIFFIN
 * ========================================================= */

const isCustomBoxItem = item => {
  if (item?.isFixedTiffin === true || item?.type === 'fixed_tiffin') {
    return false;
  }

  return (
    item?.isCustomBox === true ||
    item?.is_custom_box === true ||
    item?.type === 'custom_tiffin' ||
    item?.custom === true ||
    (item?.isCustomized === true &&
      (Array.isArray(item?.customBoxItems) ||
        Array.isArray(item?.selectedItems)))
  );
};

/* =========================================================
 * GET TIFFIN ID
 * ========================================================= */

const getValidTiffinId = item => {
  const candidates = [
    item?.fixedTiffinId,
    item?.tiffinId,
    item?.tiffin_id,
    item?.productId,
    item?.product_id,
    item?.baseTiffinId,
    item?.originalTiffin?.id,
    item?.originalTiffin?.tiffin_id,
    item?.id,
  ];

  for (const candidate of candidates) {
    const id = Number(candidate);

    if (Number.isFinite(id) && id > 0) {
      return id;
    }
  }

  return null;
};

/* =========================================================
 * CUSTOM TIFFIN ID
 * ========================================================= */

const extractCustomTiffinId = result => {
  const candidates = [
    result?.tiffin?.id,
    result?.tiffin?.tiffin_id,

    result?.data?.tiffin?.id,
    result?.data?.tiffin?.tiffin_id,

    result?.custom_tiffin?.id,
    result?.custom_tiffin?.tiffin_id,

    result?.data?.custom_tiffin?.id,
    result?.data?.custom_tiffin?.tiffin_id,

    result?.tiffin_id,
    result?.data?.tiffin_id,
  ];

  for (const candidate of candidates) {
    const id = Number(candidate);

    if (Number.isFinite(id) && id > 0) {
      return id;
    }
  }

  return null;
};

/* =========================================================
 * ORDER ID
 * ========================================================= */

const extractOrderId = result => {
  const candidates = [
    result?.order?.id,
    result?.order?.order_id,
    result?.order?.order_number,

    result?.data?.order?.id,
    result?.data?.order?.order_id,
    result?.data?.order?.order_number,

    result?.data?.data?.order?.id,
    result?.data?.data?.id,

    result?.data?.id,

    result?.order_id,
    result?.orderId,

    result?.data?.order_id,

    result?.order_number,

    result?.id,
  ];

  return (
    candidates.find(
      value =>
        value !== undefined && value !== null && String(value).trim() !== '',
    ) ?? null
  );
};

/* =========================================================
 * SELECTED ITEMS
 * ========================================================= */

const getCartSelectedItems = item => {
  const candidates = isCustomBoxItem(item)
    ? [
        item?.customBoxItems,
        item?.selectedItems,
        item?.selectedAddons,
        item?.extras,
        item?.selectedExtras,
        item?.addons,
        item?.adons,
        item?.add_ons,
      ]
    : [
        item?.selectedAddons,
        item?.extras,
        item?.selectedExtras,
        item?.addons,
        item?.adons,
        item?.add_ons,
      ];

  for (const value of candidates) {
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }

  return [];
};

/* =========================================================
 * NORMALIZE SELECTED ITEM
 * ========================================================= */

const normalizeSelectedItem = (item, index = 0) => {
  if (!item) {
    return null;
  }

  const nested = item?.item ?? item?.addon ?? item?.adon ?? item?.extra ?? {};

  const rawId =
    item?.item_id ??
    item?.itemId ??
    item?.adon_id ??
    item?.addon_id ??
    item?.addonId ??
    nested?.item_id ??
    nested?.id ??
    item?.id ??
    null;

  const id = Number(rawId);

  if (!Number.isFinite(id) || id <= 0) {
    console.log('INVALID SELECTED ITEM:', item);

    return null;
  }

  const quantity = Math.max(1, Number(item?.quantity ?? item?.qty ?? 1) || 1);

  const price = toSafeNumber(
    item?.price ?? item?.unit_price ?? item?.rawPrice ?? nested?.price ?? 0,
  );

  const total = Number((price * quantity).toFixed(2));

  const name =
    item?.name ??
    item?.item_name ??
    item?.adon_name ??
    item?.addon_name ??
    nested?.name ??
    `Item ${index + 1}`;

  return {
    id,

    item_id: id,

    itemId: id,

    adon_id: id,

    addon_id: id,

    addonId: id,

    name,

    item_name: name,

    quantity,

    qty: quantity,

    price,

    unit_price: price,

    subtotal: total,

    total,

    line_total: total,

    total_price: total,
  };
};

const getNormalizedSelectedItems = item =>
  getCartSelectedItems(item).map(normalizeSelectedItem).filter(Boolean);

/* =========================================================
 * PRICE
 * ========================================================= */

const getCartBasePrice = item => {
  if (isCustomBoxItem(item)) {
    return 0;
  }

  return toSafeNumber(
    item?.basePrice ??
      item?.rawPrice ??
      item?.price ??
      item?.originalTiffin?.rawPrice ??
      item?.originalTiffin?.price ??
      0,
  );
};

const getSelectedItemsTotal = item =>
  getNormalizedSelectedItems(item).reduce(
    (total, selected) => total + toSafeNumber(selected.total),
    0,
  );

const getCartUnitPrice = item => {
  if (isCustomBoxItem(item)) {
    return Number(getSelectedItemsTotal(item).toFixed(2));
  }

  const basePrice = getCartBasePrice(item);

  const customization = toSafeNumber(
    item?.customizationPrice ?? item?.customization_total ?? 0,
  );

  const addons = getSelectedItemsTotal(item);

  return Number(
    Math.max(
      basePrice + customization + addons,

      toSafeNumber(item?.subtotal),

      basePrice,
    ).toFixed(2),
  );
};

/*
 * Backend expects selections as { componentKey: optionName },
 * e.g. { "rice-1": "Tawa pulaw" }. Required single_choice
 * components fail with "Please choose an option for ..."
 * when missing, so fall back to the tiffin's defaults.
 */
const getCartSelections = item => {
  const selections = {};

  const tiffin = item?.originalTiffin ?? {};

  const defaults =
    item?.default_selections ?? tiffin?.default_selections ?? null;

  if (defaults && typeof defaults === 'object' && !Array.isArray(defaults)) {
    Object.assign(selections, defaults);
  }

  const components = Array.isArray(item?.components)
    ? item.components
    : Array.isArray(tiffin?.components)
    ? tiffin.components
    : [];

  components.forEach(component => {
    const key = component?.key;

    const options = Array.isArray(component?.options) ? component.options : [];

    if (!key || selections[key] || options.length === 0) {
      return;
    }

    const option = options.find(value => value?.default) ?? options[0];

    if (option?.name) {
      selections[key] = option.name;
    }
  });

  const chosen = item?.selections;

  if (chosen && typeof chosen === 'object' && !Array.isArray(chosen)) {
    Object.assign(selections, chosen);
  }

  return selections;
};

/* =========================================================
 * ORDER COMPONENT
 * ========================================================= */

const Order = ({ navigation }) => {
  const { width } = useWindowDimensions();

  const [cart, setCart] = useState([]);

  const [loading, setLoading] = useState(true);

  const [placingOrder, setPlacingOrder] = useState(false);

  const [notes, setNotes] = useState('');

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [addresses, setAddresses] = useState([]);

  const [selectedAddressId, setSelectedAddressId] = useState(null);

  const [addressPickerVisible, setAddressPickerVisible] = useState(false);

  const selectedAddress =
    addresses.find(item => item.id === selectedAddressId) ?? null;

  const [loginVisible, setLoginVisible] = useState(false);

  const [successVisible, setSuccessVisible] = useState(false);

  const [orderReference, setOrderReference] = useState(null);

  /* =======================================================
   * CUSTOM POPUP
   * ======================================================= */

  const [customPopup, setCustomPopup] = useState({
    visible: false,

    type: 'error',

    title: '',

    message: '',
  });

  const showCustomPopup = (type, title, message) => {
    setCustomPopup({
      visible: true,

      type,

      title,

      message: String(message ?? '').trim(),
    });
  };

  const closeCustomPopup = () => {
    setCustomPopup(previous => ({
      ...previous,

      visible: false,
    }));
  };

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const responsive = useMemo(
    () => ({
      width: width >= 768 ? Math.min(width - 80, 720) : width,

      padding: width >= 768 ? 28 : 14,
    }),
    [width],
  );

  /* =======================================================
   * LOAD CART
   * ======================================================= */

  const loadCart = async () => {
    try {
      setLoading(true);

      const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);

      if (!raw) {
        setCart([]);

        return;
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        setCart([]);

        return;
      }

      const normalized = parsed
        .map((item, index) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const custom = isCustomBoxItem(item);

          if (!custom) {
            const tiffinId = getValidTiffinId(item);

            if (tiffinId) {
              return {
                ...item,

                cartId: item?.cartId ?? `fixed-${tiffinId}-${index}`,

                type: 'fixed_tiffin',

                isFixedTiffin: true,

                id: tiffinId,

                fixedTiffinId: tiffinId,

                tiffin_id: tiffinId,

                tiffinId: tiffinId,

                productId: tiffinId,

                isCustomBox: false,

                custom: false,

                quantity: Math.max(1, Number(item?.quantity ?? 1) || 1),
              };
            }
          }

          return {
            ...item,

            cartId: item?.cartId ?? `custom-${index}`,

            quantity: Math.max(1, Number(item?.quantity ?? 1) || 1),
          };
        })
        .filter(Boolean);

      setCart(normalized);
    } catch (error) {
      console.log('LOAD CART ERROR:', error);

      setCart([]);
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
   * PROFILE
   * ======================================================= */

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      const loginState = await AsyncStorage.getItem('isLoggedIn');

      const loggedIn = Boolean(token) && loginState === 'true';

      setIsLoggedIn(loggedIn);

      if (!loggedIn) {
        setAddresses([]);

        setSelectedAddressId(null);

        return;
      }

      /*
       * Local copy first (instant), then the profile API
       * which is the source of truth.
       */
      let list = normalizeAddresses(await readJson(ADDRESS_STORAGE_KEY, []));

      try {
        const response = await fetch(PROFILE_API, {
          headers: {
            Accept: 'application/json',

            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();

          const profile =
            result?.data?.customer ??
            result?.data?.user ??
            result?.data ??
            result?.customer ??
            result;

          if (Array.isArray(profile?.addresses) && profile.addresses.length) {
            list = normalizeAddresses(profile.addresses);
          } else if (!list.length) {
            const single = firstText(
              profile?.delivery_address,
              profile?.delivery_location,
              profile?.full_address,
            );

            if (single) {
              list = normalizeAddresses([
                { id: 'profile', address_line: single, is_default: true },
              ]);
            }
          }
        }
      } catch (error) {
        console.log('PROFILE ERROR:', error);
      }

      setAddresses(list);

      const savedId = await AsyncStorage.getItem(SELECTED_ADDRESS_STORAGE_KEY);

      const selected =
        list.find(item => item.id === savedId) ??
        list.find(item => item.isDefault) ??
        list[0] ??
        null;

      setSelectedAddressId(selected?.id ?? null);
    } catch (error) {
      console.log('PROFILE ERROR:', error);
    }
  };

  const selectAddress = async address => {
    setSelectedAddressId(address.id);

    setAddressPickerVisible(false);

    try {
      await AsyncStorage.setItem(SELECTED_ADDRESS_STORAGE_KEY, address.id);
    } catch (error) {
      console.log('SAVE SELECTED ADDRESS ERROR:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCart();

      loadProfile();

      return () => {};
    }, []),
  );

  /* =======================================================
   * SAVE CART
   * ======================================================= */

  const saveCart = async newCart => {
    setCart(newCart);

    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
  };

  const increaseQuantity = async cartId => {
    const newCart = cart.map(item =>
      String(item.cartId) === String(cartId)
        ? {
            ...item,

            quantity: Math.max(1, Number(item.quantity ?? 1) || 1) + 1,
          }
        : item,
    );

    await saveCart(newCart);
  };

  const decreaseQuantity = async cartId => {
    const newCart = cart.map(item =>
      String(item.cartId) === String(cartId)
        ? {
            ...item,

            quantity: Math.max(1, (Number(item.quantity ?? 1) || 1) - 1),
          }
        : item,
    );

    await saveCart(newCart);
  };

  const removeItem = async cartId => {
    const newCart = cart.filter(item => String(item.cartId) !== String(cartId));

    await saveCart(newCart);
  };

  /* =======================================================
   * TOTAL
   * ======================================================= */

  const foodSubtotal = useMemo(
    () =>
      cart.reduce((total, item) => {
        const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1);

        return total + getCartUnitPrice(item) * quantity;
      }, 0),
    [cart],
  );

  const shipping = foodSubtotal > 0 && foodSubtotal < 11 ? 2 : 0;

  const grandTotal = foodSubtotal + shipping;

  /* =======================================================
   * CUSTOM TIFFIN API
   * ======================================================= */

  const resolveCustomTiffinId = async token => {
    const response = await fetch(`${CUSTOMIZE_TIFFIN_API}?_=${Date.now()}`, {
      headers: {
        Accept: 'application/json',

        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();

    let result = {};

    try {
      result = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error('Invalid custom tiffin response.');
    }

    if (!response.ok) {
      throw new Error(result?.message ?? 'Unable to load custom tiffin.');
    }

    const id = extractCustomTiffinId(result);

    if (!id) {
      throw new Error(
        'The custom tiffin API did not return a valid tiffin ID.',
      );
    }

    return id;
  };

  /* =======================================================
   * SAVE WEEKLY
   * ======================================================= */

  const saveWeeklyEntries = async entries => {
    try {
      const raw = await AsyncStorage.getItem(WEEKLY_ORDERS_STORAGE_KEY);

      let oldEntries = [];

      if (raw) {
        try {
          const parsed = JSON.parse(raw);

          oldEntries = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          oldEntries = [];
        }
      }

      await AsyncStorage.setItem(
        WEEKLY_ORDERS_STORAGE_KEY,
        JSON.stringify([...oldEntries, ...entries]),
      );
    } catch (error) {
      console.log('SAVE WEEKLY ERROR:', error);
    }
  };

  /* =======================================================
   * PLACE ORDER
   * ======================================================= */

  const handlePlaceOrder = async () => {
    if (placingOrder) {
      return;
    }

    if (cart.length === 0) {
      showCustomPopup('warning', 'Cart Empty', 'Please add a tiffin first.');

      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        setLoginVisible(true);

        return;
      }

      if (!selectedAddress) {
        showCustomPopup(
          'warning',
          'Delivery Address Required',
          'Please select or add a delivery address before placing your order.',
        );

        return;
      }

      setPlacingOrder(true);

      const hasCustom = cart.some(isCustomBoxItem);

      let customTiffinId = null;

      if (hasCustom) {
        customTiffinId = await resolveCustomTiffinId(token);
      }

      const originalCart = [...cart];

      let remainingCart = [...cart];

      const orderIds = [];

      const weeklyEntries = [];

      let remainingDeliveryFee = Number(shipping.toFixed(2));

      for (let index = 0; index < originalCart.length; index += 1) {
        const cartItem = originalCart[index];

        const custom = isCustomBoxItem(cartItem);

        const tiffinId = custom ? customTiffinId : getValidTiffinId(cartItem);

        if (!tiffinId) {
          throw new Error(
            `${cartItem?.name ?? 'Tiffin'} has an invalid tiffin ID.`,
          );
        }

        const quantity = Math.max(1, Number(cartItem?.quantity ?? 1) || 1);

        const selectedItems = getNormalizedSelectedItems(cartItem);

        let orderItem = null;

        let customItems = [];

        let normalAddons = [];

        let normalAddonsTotal = 0;

        let itemSubtotal = 0;

        if (custom) {
          if (selectedItems.length === 0) {
            throw new Error(
              `${
                cartItem?.name ?? 'Custom tiffin'
              } has no valid selected items.`,
            );
          }

          const selectedTotal = selectedItems.reduce(
            (total, selected) => total + toSafeNumber(selected.total),
            0,
          );

          customItems = selectedItems.map(selected => ({
            item_id: selected.item_id,

            quantity: selected.quantity,

            qty: selected.quantity,

            price: selected.price,

            unit_price: selected.price,

            subtotal: selected.total,

            total: selected.total,

            line_total: selected.total,

            name: selected.name,
          }));

          itemSubtotal = Number((selectedTotal * quantity).toFixed(2));

          orderItem = {
            tiffin_id: tiffinId,

            quantity,

            type: 'custom_tiffin',

            order_item_type: 'custom_tiffin',

            is_custom: true,

            is_custom_box: true,

            is_custom_tiffin: true,

            custom_tiffin: true,

            name: cartItem?.name ?? 'Custom tiffin',

            price: 0,

            unit_price: 0,

            base_price: 0,

            customization_total: 0,

            addons_total: 0,

            adons_total: 0,

            addon_total: 0,

            extras_total: 0,

            line_total: itemSubtotal,

            total: itemSubtotal,

            total_price: itemSubtotal,

            addons: [],

            adons: [],

            add_ons: [],

            extras: [],

            addon_ids: [],

            adon_ids: [],

            customizations: [],

            selections: [],

            custom_items: customItems,

            custom_box_items: customItems,

            selected_items: customItems,

            custom_item_ids: customItems.map(value => value.item_id),
          };
        } else {
          const unitPrice = getCartUnitPrice(cartItem);

          normalAddons = selectedItems.map(addon => ({
            ...addon,

            tiffin_id: tiffinId,
          }));

          normalAddonsTotal = normalAddons.reduce(
            (total, addon) => total + toSafeNumber(addon.total),
            0,
          );

          itemSubtotal = Number((unitPrice * quantity).toFixed(2));

          orderItem = {
            tiffin_id: tiffinId,

            quantity,

            type: 'tiffin',

            order_item_type: 'tiffin',

            is_custom: false,

            is_custom_box: false,

            is_custom_tiffin: false,

            custom_tiffin: false,

            name: cartItem?.name ?? 'Tiffin',

            price: unitPrice,

            unit_price: unitPrice,

            base_price: getCartBasePrice(cartItem),

            customization_total: toSafeNumber(
              cartItem?.customizationPrice ??
                cartItem?.customization_total ??
                0,
            ),

            addons_total: normalAddonsTotal,

            adons_total: normalAddonsTotal,

            addon_total: normalAddonsTotal,

            extras_total: normalAddonsTotal,

            line_total: itemSubtotal,

            total: itemSubtotal,

            total_price: itemSubtotal,

            customizations: Array.isArray(cartItem?.customizations)
              ? cartItem.customizations
              : [],

            selections: getCartSelections(cartItem),

            addons: normalAddons,

            adons: normalAddons,

            add_ons: normalAddons,

            extras: normalAddons,

            addon_ids: normalAddons.map(
              addon => addon.addon_id ?? addon.item_id,
            ),

            adon_ids: normalAddons.map(addon => addon.adon_id ?? addon.item_id),

            custom_items: [],

            custom_box_items: [],

            selected_items: [],
          };
        }

        const orderDeliveryFee = remainingDeliveryFee;

        remainingDeliveryFee = 0;

        const orderGrandTotal = Number(
          (itemSubtotal + orderDeliveryFee).toFixed(2),
        );

        const payload = {
          tiffin_id: tiffinId,

          quantity,

          items: [orderItem],

          notes: notes.trim(),

          order_notes: notes.trim(),

          subtotal: itemSubtotal,

          delivery_fee: orderDeliveryFee,

          shipping: orderDeliveryFee,

          total_amount: orderGrandTotal,

          grand_total: orderGrandTotal,

          customization_total: custom
            ? 0
            : toSafeNumber(orderItem.customization_total),

          addons_total: custom
            ? 0
            : Number((normalAddonsTotal * quantity).toFixed(2)),

          adons_total: custom
            ? 0
            : Number((normalAddonsTotal * quantity).toFixed(2)),

          selections: custom ? {} : orderItem.selections,

          addons: custom ? [] : normalAddons,

          adons: custom ? [] : normalAddons,

          add_ons: custom ? [] : normalAddons,

          extras: custom ? [] : normalAddons,

          addon_ids: custom
            ? []
            : normalAddons.map(addon => addon.addon_id ?? addon.item_id),

          adon_ids: custom
            ? []
            : normalAddons.map(addon => addon.adon_id ?? addon.item_id),

          custom_items: custom ? customItems : [],

          custom_box_items: custom ? customItems : [],

          selected_items: custom ? customItems : [],

          custom_item_ids: custom
            ? customItems.map(value => value.item_id)
            : [],

          has_custom_tiffin: custom,

          is_custom: custom,

          is_custom_box: custom,

          order_type: custom ? 'custom_tiffin' : 'standard',

          ...(selectedAddress && {
            delivery_address: selectedAddress.text,

            delivery_pincode: selectedAddress.pincode,

            ...(/^\d+$/.test(selectedAddress.id) && {
              address_id: Number(selectedAddress.id),
            }),
          }),
        };

        const response = await fetch(ORDER_API, {
          method: 'POST',

          headers: {
            Accept: 'application/json',

            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify(payload),
        });

        const responseText = await response.text();

        let result = {};

        try {
          result = responseText ? JSON.parse(responseText) : {};
        } catch (error) {
          throw new Error(
            `Invalid response while placing ${cartItem?.name ?? 'tiffin'}.`,
          );
        }

        if (response.status === 401) {
          setLoginVisible(true);

          throw new Error('Your login session has expired.');
        }

        if (response.status === 422) {
          const errors =
            result?.errors && typeof result.errors === 'object'
              ? Object.values(result.errors).flat().filter(Boolean)
              : [];

          throw new Error(
            errors[0] ??
              result?.message ??
              `${cartItem?.name ?? 'Tiffin'} could not be ordered.`,
          );
        }

        if (!response.ok || result?.success === false) {
          throw new Error(
            result?.message ??
              `${cartItem?.name ?? 'Tiffin'} could not be ordered.`,
          );
        }

        const orderId =
          extractOrderId(result) ?? `ORDER-${Date.now()}-${index + 1}`;

        orderIds.push(orderId);

        weeklyEntries.push({
          id: orderId,

          order_id: orderId,

          subtotal: itemSubtotal,

          delivery_fee: orderDeliveryFee,

          total_amount: orderGrandTotal,

          grand_total: orderGrandTotal,

          currency: 'AUD',

          notes: notes.trim(),

          type: custom ? 'custom_tiffin' : 'fixed_tiffin',

          items: [cartItem],

          created_at: new Date().toISOString(),

          serverOrder:
            result?.order ?? result?.data?.order ?? result?.data ?? result,
        });

        remainingCart = remainingCart.filter(
          value => String(value?.cartId) !== String(cartItem?.cartId),
        );

        await AsyncStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify(remainingCart),
        );

        setCart([...remainingCart]);
      }

      await saveWeeklyEntries(weeklyEntries);

      await AsyncStorage.removeItem(CART_STORAGE_KEY);

      setCart([]);

      setNotes('');

      setOrderReference(orderIds.join(', '));

      setSuccessVisible(true);
    } catch (error) {
      console.log('PLACE ORDER ERROR:', error);

      try {
        const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);

        const remaining = raw ? JSON.parse(raw) : [];

        setCart(Array.isArray(remaining) ? remaining : []);
      } catch (reloadError) {
        console.log('RELOAD CART ERROR:', reloadError);
      }

      const errorMessage = error?.message ?? 'Unable to place your order.';

      const normalizedErrorMessage = String(errorMessage).trim().toLowerCase();

      const isPendingBillMessage = [
        'pending bill',
        'pending payment',
        'payment due',
        'bill due',
        'overdue',
        'outstanding bill',
        'outstanding payment',
        'unpaid bill',
        'unpaid invoice',
        'invoice due',
      ].some(keyword => normalizedErrorMessage.includes(keyword));

      showCustomPopup(
        isPendingBillMessage ? 'payment' : 'error',

        isPendingBillMessage ? 'Payment Required' : 'Order Failed',

        errorMessage,
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  /* =======================================================
   * RENDER ITEM
   * ======================================================= */

  const renderCartItem = ({ item }) => {
    const custom = isCustomBoxItem(item);

    const selectedItems = getNormalizedSelectedItems(item);

    const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1);

    const unitPrice = getCartUnitPrice(item);

    const total = Number((unitPrice * quantity).toFixed(2));

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          {item?.image ? (
            <Image
              source={{
                uri: item.image,
              }}
              style={styles.foodImage}
            />
          ) : (
            <View style={[styles.foodImage, styles.noImage]}>
              <Image
                source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                style={styles.noImageIcon}
                resizeMode="contain"
              />
            </View>
          )}

          <View style={styles.cardInfo}>
            <Text style={styles.name} numberOfLines={2}>
              {item?.name ?? 'Tiffin'}
            </Text>

            {custom && (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>CUSTOM BUILT</Text>
              </View>
            )}

            <Text style={styles.price}>{formatMoney(total)}</Text>
          </View>
        </View>

        {selectedItems.length > 0 && (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedTitle}>
              {custom ? 'YOUR SELECTED ITEMS' : 'SELECTED ADD-ONS'}
            </Text>

            {selectedItems.map((selected, index) => (
              <View
                key={`${selected.item_id}-${index}`}
                style={styles.selectedRow}
              >
                <Text style={styles.selectedName}>{selected.name}</Text>

                <Text style={styles.selectedQty}>×{selected.quantity}</Text>

                <Text style={styles.selectedPrice}>
                  {formatMoney(selected.total)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <View style={styles.quantityControl}>
            <Pressable
              style={styles.quantityButton}
              onPress={() => decreaseQuantity(item.cartId)}
            >
              <Text style={styles.minus}>−</Text>
            </Pressable>

            <Text style={styles.quantityValue}>{quantity}</Text>

            <Pressable
              style={[styles.quantityButton, styles.plus]}
              onPress={() => increaseQuantity(item.cartId)}
            >
              <Text style={styles.plusText}>+</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.remove}
            onPress={() => removeItem(item.cartId)}
          >
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#A00B0F" />

        <Text style={styles.loadingText}>Loading order...</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
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
            <Pressable style={styles.back} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>

            <View>
              <Text style={styles.eyebrow}>YOUR CART</Text>

              <Text style={styles.title}>Review Order</Text>
            </View>
          </View>

          {cart.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Image
                  source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                  style={styles.emptyIconImage}
                />
              </View>

              <Text style={styles.emptyTitle}>Your Cart is Empty</Text>

              <Text style={styles.emptyText}>
                Add a fixed tiffin or customise your own meal.
              </Text>

              <Pressable
                style={styles.homeButton}
                onPress={() => navigation.navigate('MainTabs')}
              >
                <Text style={styles.homeButtonText}>Browse Tiffins</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <FlatList
                data={cart}
                keyExtractor={(item, index) => String(item?.cartId ?? index)}
                renderItem={renderCartItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: responsive.padding,

                  paddingTop: 14,

                  paddingBottom: 220,
                }}
                ListHeaderComponent={
                  isLoggedIn ? (
                    <Pressable
                      style={styles.delivery}
                      onPress={() =>
                        addresses.length
                          ? setAddressPickerVisible(true)
                          : navigation.navigate('AddAddress')
                      }
                    >
                      <View style={styles.deliveryHeader}>
                        <Text style={styles.deliveryLabel}>
                          DELIVERY TO
                          {selectedAddress
                            ? ` · ${selectedAddress.type.toUpperCase()}`
                            : ''}
                        </Text>

                        <Text style={styles.deliveryChange}>
                          {addresses.length ? 'CHANGE' : 'ADD'}
                        </Text>
                      </View>

                      <View style={styles.deliveryRow}>
                        <Image
                          source={require('../assets/login-icons/location.png')}
                          style={styles.locationIcon}
                        />

                        <Text style={styles.deliveryText} numberOfLines={2}>
                          {selectedAddress?.text ?? 'Select delivery address'}
                        </Text>
                      </View>
                    </Pressable>
                  ) : null
                }
                ListFooterComponent={
                  <>
                    <View style={styles.notes}>
                      <Text style={styles.sectionTitle}>
                        Order Instructions
                      </Text>

                      <TextInput
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        placeholder="Any special instructions?"
                        placeholderTextColor="#A9988E"
                        textAlignVertical="top"
                        style={styles.input}
                      />
                    </View>

                    <View style={styles.summary}>
                      <Text style={styles.sectionTitle}>Order Summary</Text>

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>subtotal</Text>

                        <Text style={styles.summaryValue}>
                          {formatMoney(foodSubtotal)}
                        </Text>
                      </View>

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Delivery</Text>

                        <Text
                          style={
                            shipping === 0
                              ? styles.freeText
                              : styles.summaryValue
                          }
                        >
                          {shipping === 0 ? 'FREE' : formatMoney(shipping)}
                        </Text>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.summaryRow}>
                        <Text style={styles.totalLabel}>Total</Text>

                        <Text style={styles.total}>
                          {formatMoney(grandTotal)}
                        </Text>
                      </View>
                    </View>
                  </>
                }
              />

              <View style={styles.bottomBar}>
                <View>
                  <Text style={styles.bottomLabel}>ORDER TOTAL</Text>

                  <Text style={styles.bottomTotal}>
                    {formatMoney(grandTotal)}
                  </Text>
                </View>

                <Pressable
                  disabled={placingOrder}
                  style={[styles.placeButton, placingOrder && styles.disabled]}
                  onPress={handlePlaceOrder}
                >
                  {placingOrder ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.placeText}>Place Order →</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>

      {/* DELIVERY ADDRESS PICKER */}

      <Modal
        visible={addressPickerVisible}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setAddressPickerVisible(false)}
      >
        <View style={styles.addressSheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setAddressPickerVisible(false)}
          />

          <SafeAreaView edges={['bottom']} style={styles.addressSheet}>
            <View style={styles.addressSheetHandle} />

            <Text style={styles.sectionTitle}>Select Delivery Address</Text>

            <Text style={styles.addressSheetSubtitle}>
              Choose one of your saved addresses.
            </Text>

            <FlatList
              data={addresses}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const active = item.id === selectedAddressId;

                return (
                  <Pressable
                    style={[
                      styles.addressOption,
                      active && styles.addressOptionActive,
                    ]}
                    onPress={() => selectAddress(item)}
                  >
                    <Image
                      source={require('../assets/login-icons/location.png')}
                      style={styles.locationIcon}
                    />

                    <View style={styles.addressOptionBody}>
                      <Text style={styles.addressOptionType}>
                        {item.type}
                        {item.isDefault ? (
                          <Text style={styles.addressDefaultTag}>
                            {'  '}Default
                          </Text>
                        ) : null}
                      </Text>

                      <Text style={styles.addressOptionText}>{item.text}</Text>
                    </View>

                    <View
                      style={[
                        styles.addressRadio,
                        active && styles.addressRadioActive,
                      ]}
                    >
                      {active && <View style={styles.addressRadioDot} />}
                    </View>
                  </Pressable>
                );
              }}
              ListFooterComponent={
                <Pressable
                  style={styles.addAddressButton}
                  onPress={() => {
                    setAddressPickerVisible(false);

                    navigation.navigate('AddAddress');
                  }}
                >
                  <Text style={styles.addAddressText}>+ Add New Address</Text>
                </Pressable>
              }
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* CUSTOM PAYMENT / ERROR POPUP */}

      <Modal
        visible={customPopup.visible}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={closeCustomPopup}
      >
        <View style={styles.customPopupOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeCustomPopup}
          />

          <View style={styles.customPopupCard}>
            <View style={styles.customPopupTopAccent} />

            <View
              style={[
                styles.customPopupIconWrap,

                customPopup.type === 'payment'
                  ? styles.customPopupIconPayment
                  : customPopup.type === 'warning'
                  ? styles.customPopupIconWarning
                  : styles.customPopupIconError,
              ]}
            >
              <Text
                style={[
                  styles.customPopupIconText,

                  customPopup.type === 'payment'
                    ? styles.customPopupIconTextPayment
                    : customPopup.type === 'warning'
                    ? styles.customPopupIconTextWarning
                    : styles.customPopupIconTextError,
                ]}
              >
                {customPopup.type === 'payment' ? '$' : '!'}
              </Text>
            </View>

            <Text style={styles.customPopupEyebrow}>
              {customPopup.type === 'payment'
                ? 'PAYMENT NOTICE'
                : customPopup.type === 'warning'
                ? 'KP KITCHEN'
                : 'ORDER NOTICE'}
            </Text>

            <Text style={styles.customPopupTitle}>{customPopup.title}</Text>

            <Text style={styles.customPopupMessage}>{customPopup.message}</Text>

            {customPopup.type === 'payment' && (
              <View style={styles.customPopupInfoBox}>
                <Text style={styles.customPopupInfoText}>
                  Please clear your outstanding bill before placing a new order.
                </Text>
              </View>
            )}

            <Pressable
              style={styles.customPopupPrimaryButton}
              onPress={closeCustomPopup}
            >
              <Text style={styles.customPopupPrimaryButtonText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* LOGIN MODAL */}

      <Modal
        visible={loginVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLoginVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Login Required</Text>

            <Text style={styles.modalText}>
              Please login before placing your order.
            </Text>

            <Pressable
              style={styles.modalButton}
              onPress={() => {
                setLoginVisible(false);

                navigation.navigate('Login');
              }}
            >
              <Text style={styles.modalButtonText}>Login</Text>
            </Pressable>

            <Pressable onPress={() => setLoginVisible(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* SUCCESS MODAL */}

      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successCircle}>
              <Text style={styles.success}>✓</Text>
            </View>

            <Text style={styles.modalTitle}>Order Placed!</Text>

            <Text style={styles.modalText}>
              All tiffins in your cart were placed successfully.
            </Text>

            {!!orderReference && (
              <View style={styles.referenceBox}>
                <Text style={styles.referenceLabel}>ORDER REFERENCE</Text>

                <Text style={styles.reference}>{String(orderReference)}</Text>
              </View>
            )}

            <Pressable
              style={styles.modalButton}
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
              <Text style={styles.modalButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default Order;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,

    backgroundColor: '#FFF9F6',
  },

  loading: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF9F6',
  },

  loadingText: {
    color: '#89766B',

    fontSize: 10,

    marginTop: 10,
  },

  screen: {
    flex: 1,

    alignSelf: 'center',

    backgroundColor: '#F8F6F3',
  },

  header: {
    minHeight: 80,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFF9F6',

    borderBottomWidth: 1,

    borderBottomColor: '#EEE2DA',
  },

  back: {
    width: 46,

    height: 46,

    borderRadius: 13,

    backgroundColor: '#F7EEE8',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 12,
  },

  backText: {
    fontSize: 28,

    color: '#8B210C',

    lineHeight: 30,
  },

  eyebrow: {
    color: '#A00B0F',

    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 1,
  },

  title: {
    color: '#26170F',

    fontSize: 22,

    fontWeight: '900',

    marginTop: 2,
  },

  delivery: {
    backgroundColor: '#FFFFFF',

    borderRadius: 15,

    borderWidth: 1,

    borderColor: '#EEE1D8',

    padding: 14,

    marginBottom: 14,
  },

  deliveryLabel: {
    color: '#A00B0F',

    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 0.7,
  },

  deliveryHeader: {
    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',
  },

  deliveryChange: {
    color: '#A00B0F',

    fontSize: 8.5,

    fontWeight: '900',

    letterSpacing: 0.5,
  },

  addressSheetOverlay: {
    flex: 1,

    backgroundColor: 'rgba(0,0,0,0.5)',

    justifyContent: 'flex-end',
  },

  addressSheet: {
    maxHeight: '75%',

    backgroundColor: '#FFFDFB',

    borderTopLeftRadius: 24,

    borderTopRightRadius: 24,

    paddingHorizontal: 18,

    paddingTop: 10,

    paddingBottom: 24,
  },

  addressSheetHandle: {
    width: 44,

    height: 4,

    borderRadius: 2,

    backgroundColor: '#D8CBC5',

    alignSelf: 'center',

    marginBottom: 14,
  },

  addressSheetSubtitle: {
    color: '#8F817B',

    fontSize: 9.5,

    marginTop: 3,

    marginBottom: 12,
  },

  addressOption: {
    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FBF7F3',

    borderWidth: 1,

    borderColor: '#EEE1D8',

    borderRadius: 13,

    padding: 12,

    marginBottom: 8,
  },

  addressOptionActive: {
    backgroundColor: '#FFF2F0',

    borderColor: '#E9BDB7',
  },

  addressOptionBody: {
    flex: 1,

    marginHorizontal: 10,
  },

  addressOptionType: {
    color: '#39261C',

    fontSize: 11,

    fontWeight: '900',
  },

  addressDefaultTag: {
    color: '#278850',

    fontSize: 9,

    fontWeight: '800',
  },

  addressOptionText: {
    color: '#6F5E55',

    fontSize: 10,

    lineHeight: 14,

    marginTop: 3,
  },

  addressRadio: {
    width: 18,

    height: 18,

    borderRadius: 9,

    borderWidth: 2,

    borderColor: '#C7BAB4',

    alignItems: 'center',

    justifyContent: 'center',
  },

  addressRadioActive: {
    borderColor: '#A00B0F',
  },

  addressRadioDot: {
    width: 8,

    height: 8,

    borderRadius: 4,

    backgroundColor: '#A00B0F',
  },

  addAddressButton: {
    minHeight: 46,

    borderRadius: 13,

    borderWidth: 1,

    borderStyle: 'dashed',

    borderColor: '#D9B8B2',

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 4,
  },

  addAddressText: {
    color: '#A00B0F',

    fontSize: 11,

    fontWeight: '900',
  },

  deliveryRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 7,
  },

  locationIcon: {
    width: 18,

    height: 18,

    marginRight: 8,

    resizeMode: 'contain',
  },

  deliveryText: {
    flex: 1,

    color: '#39261C',

    fontSize: 11,

    fontWeight: '700',
  },

  card: {
    backgroundColor: '#FFFFFF',

    borderRadius: 17,

    padding: 14,

    marginBottom: 13,

    borderWidth: 1,

    borderColor: '#EBDDD3',
  },

  cardTop: {
    flexDirection: 'row',

    alignItems: 'flex-start',
  },

  foodImage: {
    width: 82,

    height: 78,

    borderRadius: 12,

    resizeMode: 'cover',
  },

  noImage: {
    backgroundColor: '#FFF3EB',

    alignItems: 'center',

    justifyContent: 'center',
  },

  noImageIcon: {
    width: 30,

    height: 30,
  },

  cardInfo: {
    flex: 1,

    marginLeft: 12,
  },

  name: {
    color: '#2D1A10',

    fontSize: 14,

    fontWeight: '900',
  },

  customBadge: {
    alignSelf: 'flex-start',

    backgroundColor: '#F8EEDB',

    borderRadius: 8,

    paddingHorizontal: 7,

    paddingVertical: 4,

    marginTop: 6,
  },

  customBadgeText: {
    color: '#8B210C',

    fontSize: 7,

    fontWeight: '900',
  },

  price: {
    color: '#A00B0F',

    fontSize: 14,

    fontWeight: '900',

    marginTop: 7,
  },

  selectedBox: {
    backgroundColor: '#FFF9F1',

    borderRadius: 12,

    padding: 10,

    marginTop: 12,
  },

  selectedTitle: {
    color: '#95663B',

    fontSize: 7,

    fontWeight: '900',

    marginBottom: 6,
  },

  selectedRow: {
    flexDirection: 'row',

    alignItems: 'center',

    minHeight: 28,
  },

  selectedName: {
    flex: 1,

    color: '#493226',

    fontSize: 9,
  },

  selectedQty: {
    color: '#9A7A65',

    fontSize: 8,

    marginHorizontal: 8,
  },

  selectedPrice: {
    color: '#A00B0F',

    fontSize: 9,

    fontWeight: '900',
  },

  actions: {
    marginTop: 13,

    paddingTop: 12,

    borderTopWidth: 1,

    borderTopColor: '#F1E8E2',

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',
  },

  quantityControl: {
    height: 34,

    flexDirection: 'row',

    borderWidth: 1,

    borderColor: '#DDBB8E',

    borderRadius: 17,

    overflow: 'hidden',

    alignItems: 'center',
  },

  quantityButton: {
    width: 33,

    height: 33,

    alignItems: 'center',

    justifyContent: 'center',
  },

  minus: {
    color: '#906B4F',

    fontSize: 18,

    fontWeight: '900',
  },

  plus: {
    backgroundColor: '#8B210C',
  },

  plusText: {
    color: '#FFFFFF',

    fontSize: 17,

    fontWeight: '900',
  },

  quantityValue: {
    minWidth: 30,

    textAlign: 'center',

    fontWeight: '900',

    color: '#332117',

    fontSize: 10,
  },

  remove: {
    paddingHorizontal: 13,

    height: 34,

    borderRadius: 10,

    backgroundColor: '#FFF1F1',

    alignItems: 'center',

    justifyContent: 'center',
  },

  removeText: {
    color: '#A00B0F',

    fontWeight: '900',

    fontSize: 9,
  },

  notes: {
    backgroundColor: '#FFFFFF',

    padding: 15,

    borderRadius: 15,

    borderWidth: 1,

    borderColor: '#EBDDD3',

    marginTop: 5,
  },

  sectionTitle: {
    color: '#2F1D13',

    fontSize: 14,

    fontWeight: '900',
  },

  input: {
    minHeight: 80,

    backgroundColor: '#FBF7F3',

    borderRadius: 10,

    padding: 10,

    marginTop: 10,

    textAlignVertical: 'top',

    color: '#3F3028',
  },

  summary: {
    backgroundColor: '#FFFFFF',

    padding: 15,

    borderRadius: 15,

    borderWidth: 1,

    borderColor: '#EBDDD3',

    marginTop: 12,
  },

  summaryRow: {
    minHeight: 34,

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',
  },

  summaryLabel: {
    color: '#8B776B',

    fontSize: 10,
  },

  summaryValue: {
    color: '#443126',

    fontSize: 10,

    fontWeight: '800',
  },

  freeText: {
    color: '#2E8B57',

    fontSize: 10,

    fontWeight: '900',
  },

  divider: {
    height: 1,

    backgroundColor: '#EEE5DF',

    marginVertical: 8,
  },

  totalLabel: {
    fontWeight: '900',

    fontSize: 14,

    color: '#26170F',
  },

  total: {
    color: '#A00B0F',

    fontWeight: '900',

    fontSize: 17,
  },

  bottomBar: {
    position: 'absolute',

    left: 8,

    right: 8,

    bottom: 8,

    minHeight: 76,

    backgroundColor: '#16110F',

    borderRadius: 18,

    padding: 11,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    elevation: 15,
  },

  bottomLabel: {
    color: '#9C7D64',

    fontSize: 7,

    fontWeight: '900',
  },

  bottomTotal: {
    color: '#E4BC55',

    fontSize: 21,

    fontWeight: '900',

    marginTop: 2,
  },

  placeButton: {
    minWidth: 160,

    height: 52,

    backgroundColor: '#A00B0F',

    borderRadius: 14,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 15,
  },

  disabled: {
    opacity: 0.6,
  },

  placeText: {
    color: '#FFFFFF',

    fontWeight: '900',

    fontSize: 10,
  },

  empty: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    padding: 30,
  },

  emptyIcon: {
    width: 80,

    height: 80,

    borderRadius: 40,

    backgroundColor: '#FFF1E9',

    alignItems: 'center',

    justifyContent: 'center',
  },

  emptyIconImage: {
    width: 35,

    height: 35,

    resizeMode: 'contain',
  },

  emptyTitle: {
    fontSize: 20,

    fontWeight: '900',

    color: '#2F1D13',

    marginTop: 17,
  },

  emptyText: {
    color: '#8D7A6D',

    fontSize: 10,

    textAlign: 'center',

    marginTop: 7,
  },

  homeButton: {
    height: 46,

    paddingHorizontal: 22,

    backgroundColor: '#A00B0F',

    borderRadius: 12,

    justifyContent: 'center',

    marginTop: 18,
  },

  homeButtonText: {
    color: '#FFFFFF',

    fontWeight: '900',
  },

  /* CUSTOM POPUP */

  customPopupOverlay: {
    flex: 1,

    backgroundColor: 'rgba(25, 16, 12, 0.72)',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 22,
  },

  customPopupCard: {
    width: '100%',

    maxWidth: 380,

    backgroundColor: '#FFF9F6',

    borderRadius: 24,

    paddingHorizontal: 22,

    paddingTop: 34,

    paddingBottom: 22,

    alignItems: 'center',

    borderWidth: 1,

    borderColor: '#ECDDD4',

    overflow: 'hidden',

    elevation: 18,

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,

      height: 10,
    },

    shadowOpacity: 0.22,

    shadowRadius: 20,
  },

  customPopupTopAccent: {
    position: 'absolute',

    left: 0,

    right: 0,

    top: 0,

    height: 6,

    backgroundColor: '#A00B0F',
  },

  customPopupIconWrap: {
    width: 72,

    height: 72,

    borderRadius: 36,

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 14,

    borderWidth: 1,
  },

  customPopupIconPayment: {
    backgroundColor: '#FFF3D6',

    borderColor: '#E9C86A',
  },

  customPopupIconWarning: {
    backgroundColor: '#FFF3E8',

    borderColor: '#EFCBA8',
  },

  customPopupIconError: {
    backgroundColor: '#FDECEC',

    borderColor: '#F0C1C3',
  },

  customPopupIconText: {
    fontSize: 32,

    fontWeight: '900',
  },

  customPopupIconTextPayment: {
    color: '#9B6C00',
  },

  customPopupIconTextWarning: {
    color: '#A45A12',
  },

  customPopupIconTextError: {
    color: '#A00B0F',
  },

  customPopupEyebrow: {
    color: '#A00B0F',

    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 1.2,

    textAlign: 'center',
  },

  customPopupTitle: {
    color: '#26170F',

    fontSize: 21,

    fontWeight: '900',

    textAlign: 'center',

    marginTop: 5,
  },

  customPopupMessage: {
    color: '#7F6D63',

    fontSize: 11,

    lineHeight: 18,

    textAlign: 'center',

    marginTop: 9,
  },

  customPopupInfoBox: {
    width: '100%',

    backgroundColor: '#FFF3E6',

    borderRadius: 12,

    borderWidth: 1,

    borderColor: '#F0D5B9',

    paddingHorizontal: 12,

    paddingVertical: 10,

    marginTop: 16,
  },

  customPopupInfoText: {
    color: '#8B5A2B',

    fontSize: 9.5,

    lineHeight: 15,

    fontWeight: '700',

    textAlign: 'center',
  },

  customPopupPrimaryButton: {
    width: '100%',

    height: 50,

    backgroundColor: '#A00B0F',

    borderRadius: 13,

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 18,
  },

  customPopupPrimaryButtonText: {
    color: '#FFFFFF',

    fontSize: 11,

    fontWeight: '900',

    letterSpacing: 0.2,
  },

  /* NORMAL MODALS */

  modalOverlay: {
    flex: 1,

    backgroundColor: 'rgba(0,0,0,0.65)',

    alignItems: 'center',

    justifyContent: 'center',

    padding: 24,
  },

  modalCard: {
    width: '100%',

    maxWidth: 370,

    backgroundColor: '#FFFFFF',

    borderRadius: 20,

    padding: 24,

    alignItems: 'center',
  },

  modalTitle: {
    color: '#26170F',

    fontSize: 20,

    fontWeight: '900',

    textAlign: 'center',
  },

  modalText: {
    color: '#89766B',

    fontSize: 10,

    lineHeight: 16,

    textAlign: 'center',

    marginTop: 8,
  },

  modalButton: {
    width: '100%',

    height: 48,

    backgroundColor: '#A00B0F',

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 20,
  },

  modalButtonText: {
    color: '#FFFFFF',

    fontWeight: '900',
  },

  cancel: {
    color: '#87756A',

    fontSize: 10,

    marginTop: 14,
  },

  successCircle: {
    width: 70,

    height: 70,

    borderRadius: 35,

    backgroundColor: '#EAF8EF',

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 15,
  },

  success: {
    color: '#2F955B',

    fontSize: 38,

    fontWeight: '900',
  },

  referenceBox: {
    width: '100%',

    backgroundColor: '#FBF6EF',

    borderRadius: 10,

    padding: 10,

    alignItems: 'center',

    marginTop: 14,
  },

  referenceLabel: {
    color: '#9A816E',

    fontSize: 7,

    fontWeight: '900',
  },

  reference: {
    color: '#8B210C',

    fontWeight: '900',

    fontSize: 11,

    marginTop: 4,

    textAlign: 'center',
  },
});
