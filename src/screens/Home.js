import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import AppAlert from '../components/AppAlert';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getTiffins } from '../redux/Action';

/* =========================================================
 * CONFIG
 * ========================================================= */

const BASE_URL = 'https://replete-software.com/projects/kp_admin/public';

const PROFILE_API =
  'https://replete-software.com/projects/kp_admin/api/customer/profile';

const NOTIFICATION_API =
  'https://replete-software.com/projects/kp_admin/api/customer/notifications';

const CUSTOMIZE_TIFFIN_API =
  'https://replete-software.com/projects/kp_admin/api/customer/customize-tiffin';

const CART_STORAGE_KEY = 'kp_customer_cart';

const READ_NOTIFICATION_IDS_KEY = 'kp_read_notification_ids';

const DELETED_NOTIFICATION_IDS_KEY = 'kp_deleted_notification_ids';

const NOTIFICATION_UNREAD_COUNT_KEY = 'kp_unread_notification_count';

const CUSTOM_TIFFIN_ID = 41;

const BOTTOM_TAB_HEIGHT = 68;

/* =========================================================
 * HELPERS
 * ========================================================= */

const toSafeNumber = value => {
  const number = Number(String(value ?? 0).replace(/[^0-9.-]/g, ''));

  return Number.isFinite(number) ? number : 0;
};

/* =========================================================
 * READ STORED NOTIFICATION IDS
 * ========================================================= */

const getStoredIdList = async key => {
  try {
    const stored = await AsyncStorage.getItem(key);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(value => String(value));
  } catch (error) {
    console.log(`READ ${key} ERROR:`, error);

    return [];
  }
};

/* =========================================================
 * FIXED TIFFIN ID
 * ========================================================= */

const getFixedTiffinId = meal => {
  const candidates = [
    meal?.fixedTiffinId,
    meal?.numericId,
    meal?.tiffin_id,
    meal?.tiffinId,
    meal?.productId,
    meal?.id,
    meal?.tiffin?.id,
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
 * IMAGE
 * ========================================================= */

const getImageUrl = image => {
  if (!image) {
    return null;
  }

  const value = String(image).trim();

  if (value.includes('/uploads/')) {
    const index = value.indexOf('/uploads/');

    return BASE_URL + value.substring(index);
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (value.startsWith('/')) {
    return BASE_URL + value;
  }

  return `${BASE_URL}/${value}`;
};

/* =========================================================
 * SANITIZE DEFAULT ITEMS
 * ========================================================= */

const sanitizeDefaultItems = items => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((value, index) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value === 'string') {
        const cleanName = value.trim();

        if (!cleanName) {
          return null;
        }

        return {
          id: `default-${index}`,

          item_id: null,

          name: cleanName,

          quantity: 1,

          price: 0,
        };
      }

      if (typeof value !== 'object') {
        return null;
      }

      const nested =
        value?.item ??
        value?.food_item ??
        value?.foodItem ??
        value?.menu_item ??
        value?.menuItem ??
        value?.dish ??
        value?.product ??
        {};

      const itemId =
        value?.item_id ?? value?.itemId ?? nested?.id ?? value?.id ?? null;

      const itemName =
        value?.name ??
        value?.item_name ??
        value?.itemName ??
        value?.title ??
        value?.dish_name ??
        nested?.name ??
        nested?.item_name ??
        nested?.title ??
        `Item ${index + 1}`;

      return {
        id: value?.id ?? itemId ?? `default-${index}`,

        item_id: itemId,

        name: String(itemName).trim() || `Item ${index + 1}`,

        quantity:
          Number(
            value?.quantity ??
              value?.qty ??
              value?.pivot?.quantity ??
              value?.pivot?.qty ??
              1,
          ) || 1,

        price: toSafeNumber(
          value?.price ??
            value?.unit_price ??
            value?.pivot?.price ??
            nested?.price ??
            nested?.unit_price ??
            0,
        ),
      };
    })
    .filter(Boolean);
};

/* =========================================================
 * TIFFIN ITEMS SOURCE
 * ========================================================= */

const getTiffinItemsSource = tiffin => {
  if (!tiffin || typeof tiffin !== 'object') {
    return [];
  }

  const candidates = [
    tiffin?.items,
    tiffin?.tiffin_items,
    tiffin?.tiffinItems,
    tiffin?.default_items,
    tiffin?.defaultItems,
    tiffin?.included_items,
    tiffin?.includedItems,
    tiffin?.menu_items,
    tiffin?.menuItems,
    tiffin?.food_items,
    tiffin?.foodItems,
    tiffin?.contents,
    tiffin?.tiffin?.items,
    tiffin?.data?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      if (candidate.length > 0) {
        return candidate;
      }

      continue;
    }

    if (candidate && typeof candidate === 'object') {
      const groupedValues = Object.values(candidate)
        .filter(Array.isArray)
        .flat();

      if (groupedValues.length > 0) {
        return groupedValues;
      }
    }

    if (typeof candidate === 'string') {
      const value = candidate.trim();

      if (!value) {
        continue;
      }

      try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }

        if (parsed && typeof parsed === 'object') {
          const groupedValues = Object.values(parsed)
            .filter(Array.isArray)
            .flat();

          if (groupedValues.length > 0) {
            return groupedValues;
          }
        }
      } catch (error) {
        const commaSeparatedItems = value
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);

        if (commaSeparatedItems.length > 0) {
          return commaSeparatedItems;
        }
      }
    }
  }

  return [];
};

/* =========================================================
 * NOTIFICATION HELPERS
 * ========================================================= */

const extractNotificationArray = result => {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (Array.isArray(result?.notifications)) {
    return result.notifications;
  }

  if (Array.isArray(result?.data?.notifications)) {
    return result.data.notifications;
  }

  if (Array.isArray(result?.data?.data)) {
    return result.data.data;
  }

  if (Array.isArray(result?.notifications?.data)) {
    return result.notifications.data;
  }

  if (Array.isArray(result?.data?.notifications?.data)) {
    return result.data.notifications.data;
  }

  return null;
};

const getNotificationId = notification => {
  const rawData =
    notification?.data && typeof notification.data === 'object'
      ? notification.data
      : {};

  const id =
    notification?.id ??
    notification?.notification_id ??
    rawData?.id ??
    rawData?.notification_id ??
    null;

  return id === null || id === undefined ? null : String(id);
};

const isServerNotificationRead = notification => {
  const rawData =
    notification?.data && typeof notification.data === 'object'
      ? notification.data
      : {};

  const readAt =
    notification?.read_at ??
    notification?.readAt ??
    rawData?.read_at ??
    rawData?.readAt ??
    null;

  if (readAt) {
    return true;
  }

  const value =
    notification?.is_read ??
    notification?.isRead ??
    notification?.read ??
    rawData?.is_read ??
    rawData?.isRead ??
    rawData?.read;

  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true' ||
    value === 'read'
  );
};

/* =========================================================
 * HOME
 * ========================================================= */

const Home = ({ navigation }) => {
  const { width } = useWindowDimensions();

  const insets = useSafeAreaInsets();

  const dispatch = useDispatch();

  const { tiffins, loading, error } = useSelector(state => state.tiffin);

  const [cartCount, setCartCount] = useState(0);

  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [addingItemId, setAddingItemId] = useState(null);

  const [cartPopupVisible, setCartPopupVisible] = useState(false);

  const [addedTiffin, setAddedTiffin] = useState(null);

  const [userLocation, setUserLocation] = useState('Set delivery location');

  const [activeHomeTab, setActiveHomeTab] = useState('fixed');

  const [activeCustomCategory, setActiveCustomCategory] = useState('all');

  const [customQuantities, setCustomQuantities] = useState({});

  const [savingCustomBox, setSavingCustomBox] = useState(false);

  const [customApiTiffin, setCustomApiTiffin] = useState(null);

  const [customApiItems, setCustomApiItems] = useState([]);

  const [customApiGrouped, setCustomApiGrouped] = useState({});

  const [customLoading, setCustomLoading] = useState(false);

  const [customError, setCustomError] = useState('');

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const layout = useMemo(() => {
    const tablet = width >= 768;

    return {
      pageWidth: tablet ? Math.min(width - 64, 900) : width,

      padding: tablet ? 28 : 16,

      fixedCardWidth: tablet ? '48.5%' : '100%',
    };
  }, [width]);

  const customBottom = BOTTOM_TAB_HEIGHT + Math.max(insets.bottom, 6) + 6;

  /* =======================================================
   * LOAD TIFFINS
   * ======================================================= */

  useEffect(() => {
    dispatch(getTiffins());
  }, [dispatch]);

  /* =======================================================
   * CART
   * ======================================================= */

  const getStoredCart = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(CART_STORAGE_KEY);

      if (!value) {
        return [];
      }

      const parsed = JSON.parse(value);

      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.log('GET CART ERROR:', err);

      return [];
    }
  }, []);

  const updateCartCount = useCallback(async () => {
    const cart = await getStoredCart();

    const count = cart.reduce(
      (total, item) => total + Math.max(1, Number(item?.quantity ?? 1) || 1),
      0,
    );

    setCartCount(count);
  }, [getStoredCart]);

  /* =======================================================
   * PROFILE
   * ======================================================= */

  const fetchLocation = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        return;
      }

      const response = await fetch(
        `${PROFILE_API}?_=${Date.now()}`,

        {
          headers: {
            Accept: 'application/json',

            Authorization: `Bearer ${token}`,

            'Cache-Control': 'no-cache',

            Pragma: 'no-cache',
          },
        },
      );

      if (!response.ok) {
        return;
      }

      const result = await response.json();

      const profile =
        result?.data?.customer ??
        result?.data?.user ??
        result?.data ??
        result?.customer ??
        result;

      let location =
        profile?.delivery_address ??
        profile?.delivery_location ??
        profile?.full_address ??
        '';

      if (!location && typeof profile?.address === 'string') {
        location = profile.address;
      }

      if (!location && Array.isArray(profile?.addresses)) {
        const address =
          profile.addresses.find(
            item =>
              item?.is_default === true ||
              item?.is_default === 1 ||
              item?.is_default === '1',
          ) ?? profile.addresses[0];

        location =
          address?.full_address ??
          address?.address_line ??
          address?.address_line_1 ??
          address?.address ??
          '';
      }

      setUserLocation(location || 'Set delivery location');
    } catch (err) {
      console.log('LOCATION ERROR:', err);
    }
  }, []);

  /* =======================================================
   * NOTIFICATION COUNT
   * ======================================================= */

  const fetchUnreadNotificationCount = useCallback(async () => {
    try {
      /*
       * First use the local count.
       *
       * This gives immediate correct result
       * when returning from Notification page.
       */
      const localStoredCount = await AsyncStorage.getItem(
        NOTIFICATION_UNREAD_COUNT_KEY,
      );

      if (localStoredCount !== null) {
        const parsedLocalCount = Number(localStoredCount);

        if (Number.isFinite(parsedLocalCount)) {
          setUnreadNotificationCount(Math.max(0, parsedLocalCount));
        }
      } else {
        setUnreadNotificationCount(0);
      }

      const token = await AsyncStorage.getItem('token');

      if (!token) {
        setUnreadNotificationCount(0);

        await AsyncStorage.setItem(NOTIFICATION_UNREAD_COUNT_KEY, '0');

        return;
      }

      /*
       * Read the SAME local state
       * used by Notification.js
       */
      const [storedReadIds, storedDeletedIds] = await Promise.all([
        getStoredIdList(READ_NOTIFICATION_IDS_KEY),

        getStoredIdList(DELETED_NOTIFICATION_IDS_KEY),
      ]);

      const readSet = new Set(storedReadIds.map(String));

      const deletedSet = new Set(storedDeletedIds.map(String));

      const response = await fetch(
        `${NOTIFICATION_API}?_=${Date.now()}`,

        {
          method: 'GET',

          headers: {
            Accept: 'application/json',

            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,

            'Cache-Control': 'no-cache',

            Pragma: 'no-cache',
          },
        },
      );

      if (!response.ok) {
        /*
         * Do not bring stale server count
         * back when API fails.
         */
        return;
      }

      const responseText = await response.text();

      let result = {};

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.log('HOME NOTIFICATION JSON ERROR:', parseError);

        return;
      }

      const notifications = extractNotificationArray(result);

      /*
       * Preferred path:
       * use actual notification records.
       */
      if (Array.isArray(notifications)) {
        const unread = notifications.filter(notification => {
          const id = getNotificationId(notification);

          /*
           * Locally deleted:
           * never count it.
           */
          if (id && deletedSet.has(id)) {
            return false;
          }

          /*
           * Locally read:
           * never count it.
           */
          if (id && readSet.has(id)) {
            return false;
          }

          /*
           * Backend already marked read.
           */
          if (isServerNotificationRead(notification)) {
            return false;
          }

          return true;
        }).length;

        setUnreadNotificationCount(unread);

        await AsyncStorage.setItem(
          NOTIFICATION_UNREAD_COUNT_KEY,

          String(unread),
        );

        return;
      }

      /*
       * If backend only returns unread_count,
       * local state takes priority if local
       * read/deleted data exists.
       */
      if (readSet.size > 0 || deletedSet.size > 0) {
        const localCount = Number(localStoredCount ?? 0);

        setUnreadNotificationCount(
          Number.isFinite(localCount) ? Math.max(0, localCount) : 0,
        );

        return;
      }

      /*
       * Final fallback:
       * direct unread count from API.
       */
      const directUnreadCount =
        result?.unread_count ??
        result?.unreadCount ??
        result?.unread_notifications_count ??
        result?.unreadNotificationsCount ??
        result?.data?.unread_count ??
        result?.data?.unreadCount ??
        result?.data?.unread_notifications_count ??
        result?.data?.unreadNotificationsCount ??
        0;

      const parsedCount = Number(directUnreadCount);

      const finalCount = Number.isFinite(parsedCount)
        ? Math.max(0, parsedCount)
        : 0;

      setUnreadNotificationCount(finalCount);

      await AsyncStorage.setItem(
        NOTIFICATION_UNREAD_COUNT_KEY,

        String(finalCount),
      );
    } catch (err) {
      console.log('NOTIFICATION COUNT ERROR:', err);

      /*
       * On error, continue using local
       * shared notification count.
       */
      try {
        const localCount = await AsyncStorage.getItem(
          NOTIFICATION_UNREAD_COUNT_KEY,
        );

        const parsed = Number(localCount ?? 0);

        setUnreadNotificationCount(
          Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
        );
      } catch (storageError) {
        setUnreadNotificationCount(0);
      }
    }
  }, []);

  /* =======================================================
   * SCREEN FOCUS
   * ======================================================= */

  useFocusEffect(
    useCallback(() => {
      updateCartCount();

      fetchLocation();

      /*
       * Runs every time Home becomes active,
       * including returning from Notification.
       */
      fetchUnreadNotificationCount();

      return () => {};
    }, [updateCartCount, fetchLocation, fetchUnreadNotificationCount]),
  );

  /* =======================================================
   * ADD-ONS
   * ======================================================= */

  const normalizeAddon = (addon, groupName, index) => {
    if (!addon) {
      return null;
    }

    const rawId =
      addon?.adon_id ?? addon?.addon_id ?? addon?.addonId ?? addon?.id ?? null;

    const numeric = Number(rawId);

    const addonId = Number.isFinite(numeric) ? numeric : rawId;

    const price = toSafeNumber(addon?.price ?? addon?.unit_price ?? 0);

    return {
      id: addonId ?? `addon-${groupName}-${index}`,

      adon_id: addonId,

      addon_id: addonId,

      addonId,

      name: addon?.name ?? addon?.title ?? `Add-on ${index + 1}`,

      description: addon?.description ?? '',

      price,

      rawPrice: price,

      group: groupName,

      groupName,

      image: getImageUrl(addon?.image),
    };
  };

  const normalizeAddonData = item => {
    const source = item?.adons ?? item?.addons ?? item?.add_ons ?? {};

    const addonGroups = {};

    const addonList = [];

    if (source && typeof source === 'object' && !Array.isArray(source)) {
      Object.entries(source).forEach(([group, values]) => {
        if (!Array.isArray(values)) {
          return;
        }

        const normalized = values
          .map((addon, index) => normalizeAddon(addon, group, index))
          .filter(Boolean);

        addonGroups[group] = normalized;

        addonList.push(...normalized);
      });
    } else if (Array.isArray(source)) {
      source.forEach((addon, index) => {
        const group = addon?.category?.name ?? addon?.group ?? 'Add-ons';

        const normalized = normalizeAddon(addon, group, index);

        if (!normalized) {
          return;
        }

        if (!addonGroups[group]) {
          addonGroups[group] = [];
        }

        addonGroups[group].push(normalized);

        addonList.push(normalized);
      });
    }

    return {
      addonGroups,

      addonList,
    };
  };

  /* =======================================================
   * FIXED TIFFINS
   * ======================================================= */

  const meals = useMemo(() => {
    if (!Array.isArray(tiffins)) {
      return [];
    }

    return tiffins
      .filter(item => {
        const backendId = Number(
          item?.id ?? item?.tiffin_id ?? item?.tiffinId ?? 0,
        );

        return backendId !== CUSTOM_TIFFIN_ID;
      })
      .map((item, index) => {
        const backendId = item?.id ?? item?.tiffin_id ?? item?.tiffinId ?? null;

        const numericId = Number(backendId);

        const rawPrice = toSafeNumber(
          item?.price ?? item?.tiffin_price ?? item?.rawPrice ?? 0,
        );

        const { addonGroups, addonList } = normalizeAddonData(item);

        const status = String(item?.status ?? 'Active')
          .trim()
          .toLowerCase();

        const includedItems = sanitizeDefaultItems(getTiffinItemsSource(item));

        return {
          ...item,

          id: backendId !== null ? String(backendId) : `fixed-${index}`,

          numericId: Number.isFinite(numericId) ? numericId : null,

          tiffin_id: Number.isFinite(numericId) ? numericId : null,

          tiffinId: Number.isFinite(numericId) ? numericId : null,

          name: item?.name ?? item?.tiffin_name ?? 'Tiffin',

          description: item?.description ?? item?.tiffin_description ?? '',

          rawPrice,

          price: `$${rawPrice.toFixed(2)}`,

          image: getImageUrl(
            item?.image_url ?? item?.image ?? item?.tiffin_image,
          ),

          items: includedItems,

          defaultItems: includedItems,

          addonGroups,

          addonList,

          available:
            status === '' ||
            status === 'active' ||
            status === 'available' ||
            status === '1' ||
            status === 'true',
        };
      });
  }, [tiffins]);

  const handleTiffinPress = meal => {
    if (!meal?.available) {
      return;
    }

    navigation.navigate(
      'CustomizeTiffin',

      {
        tiffin: meal,

        addonGroups: meal.addonGroups,

        addonList: meal.addonList,

        allAddons: meal.addonList,

        adons: meal.addonGroups,

        addons: meal.addonGroups,

        available_add_ons: meal.addonGroups,
      },
    );
  };

  /* =======================================================
   * ADD FIXED TIFFIN
   * ======================================================= */

  const handleAddToCart = async meal => {
    if (!meal?.available) {
      AppAlert.alert(
        'Unavailable',

        'This tiffin is currently unavailable.',
      );

      return;
    }

    const tiffinId = getFixedTiffinId(meal);

    if (!tiffinId) {
      AppAlert.alert(
        'Unable to Add',

        'This tiffin does not have a valid tiffin ID.',
      );

      return;
    }

    const price = toSafeNumber(
      meal?.rawPrice ?? meal?.tiffin_price ?? meal?.price ?? 0,
    );

    try {
      setAddingItemId(String(meal.id));

      const cart = await getStoredCart();

      const existingIndex = cart.findIndex(item => {
        if (
          item?.isCustomBox === true ||
          item?.custom === true ||
          item?.type === 'custom_tiffin'
        ) {
          return false;
        }

        return getFixedTiffinId(item) === tiffinId;
      });

      const oldQuantity =
        existingIndex >= 0
          ? Math.max(
              1,

              Number(cart[existingIndex]?.quantity ?? 1) || 1,
            )
          : 0;

      const fixedCartItem = {
        cartId:
          existingIndex >= 0
            ? cart[existingIndex]?.cartId ?? `fixed-${tiffinId}`
            : `fixed-${tiffinId}-${Date.now()}`,

        type: 'fixed_tiffin',

        isFixedTiffin: true,

        id: tiffinId,

        fixedTiffinId: tiffinId,

        tiffin_id: tiffinId,

        tiffinId,

        productId: tiffinId,

        name: meal?.name ?? 'Tiffin',

        description: meal?.description ?? '',

        image: meal?.image ?? null,

        category: meal?.category ?? 'Tiffin',

        quantity: oldQuantity + 1,

        basePrice: price,

        rawPrice: price,

        price,

        subtotal: price,

        totalPrice: price,

        grandTotal: price,

        items: sanitizeDefaultItems(meal?.items),

        defaultItems: sanitizeDefaultItems(meal?.items),

        customizationPrice: 0,

        extrasPrice: 0,

        selections: meal?.default_selections ?? {},

        components: Array.isArray(meal?.components) ? meal.components : [],

        default_selections: meal?.default_selections ?? {},

        customizations: [],

        extras: [],

        selectedExtras: [],

        selectedAddons: [],

        addons: [],

        adons: [],

        add_ons: [],

        isCustomized: false,

        isCustomBox: false,

        custom: false,

        originalTiffin: {
          id: tiffinId,

          tiffin_id: tiffinId,

          tiffinId,

          name: meal?.name ?? 'Tiffin',

          image: meal?.image ?? null,

          rawPrice: price,

          price,

          items: sanitizeDefaultItems(meal?.items),

          components: Array.isArray(meal?.components) ? meal.components : [],

          default_selections: meal?.default_selections ?? {},
        },

        addedAt: new Date().toISOString(),
      };

      let updatedCart;

      if (existingIndex >= 0) {
        updatedCart = [...cart];

        updatedCart[existingIndex] = fixedCartItem;
      } else {
        updatedCart = [...cart, fixedCartItem];
      }

      await AsyncStorage.setItem(
        CART_STORAGE_KEY,

        JSON.stringify(updatedCart),
      );

      const count = updatedCart.reduce(
        (total, item) =>
          total +
          Math.max(
            1,

            Number(item?.quantity ?? 1) || 1,
          ),
        0,
      );

      setCartCount(count);

      setAddedTiffin(fixedCartItem);

      setCartPopupVisible(true);
    } catch (err) {
      AppAlert.alert(
        'Unable to Add',

        err?.message ?? 'Unable to add this tiffin.',
      );
    } finally {
      setAddingItemId(null);
    }
  };

  /* =======================================================
   * CUSTOM TIFFIN API
   * ======================================================= */

  const fetchCustomTiffinData = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setCustomLoading(true);
        }

        setCustomError('');

        const token = await AsyncStorage.getItem('token');

        if (!token) {
          throw new Error('Please login to load custom tiffin items.');
        }

        const response = await fetch(
          `${CUSTOMIZE_TIFFIN_API}?_=${Date.now()}`,

          {
            headers: {
              Accept: 'application/json',

              Authorization: `Bearer ${token}`,
            },
          },
        );

        const text = await response.text();

        const result = text ? JSON.parse(text) : {};

        if (!response.ok) {
          throw new Error(result?.message ?? 'Unable to load custom tiffin.');
        }

        const items = Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result?.data?.items)
          ? result.data.items
          : [];

        const grouped =
          result?.items_grouped && typeof result.items_grouped === 'object'
            ? result.items_grouped
            : result?.data?.items_grouped &&
              typeof result.data.items_grouped === 'object'
            ? result.data.items_grouped
            : {};

        const tiffin = result?.tiffin ??
          result?.data?.tiffin ?? {
            id: CUSTOM_TIFFIN_ID,

            tiffin_id: CUSTOM_TIFFIN_ID,

            name: 'Custom tiffin',

            pricing: 'sum_of_selected_items',
          };

        setCustomApiTiffin(tiffin);

        setCustomApiItems(items);

        setCustomApiGrouped(grouped);

        if (items.length === 0) {
          setCustomError('No custom tiffin items are available today.');
        }
      } catch (err) {
        setCustomError(err?.message ?? 'Unable to load custom tiffin.');
      } finally {
        setCustomLoading(false);
      }
    },

    [],
  );

  useEffect(() => {
    if (activeHomeTab === 'custom') {
      fetchCustomTiffinData();
    }
  }, [activeHomeTab, fetchCustomTiffinData]);

  /* =======================================================
   * CUSTOM DISHES
   * ======================================================= */

  const customDishes = useMemo(
    () =>
      Array.isArray(customApiItems)
        ? customApiItems.map((item, index) => {
            const customId = String(
              item?.id ?? item?.item_id ?? `custom-${index}`,
            );

            const price = toSafeNumber(item?.price ?? item?.unit_price ?? 0);

            return {
              ...item,

              customId,

              item_id: item?.item_id ?? null,

              itemId: item?.item_id ?? null,

              name: item?.name ?? `Item ${index + 1}`,

              category: String(item?.category ?? 'Others').trim() || 'Others',

              rawPrice: price,

              price,

              displayPrice: `$${price.toFixed(2)}`,

              image: getImageUrl(item?.image_url ?? item?.image),
            };
          })
        : [],

    [customApiItems],
  );

  const customCategories = useMemo(() => {
    let names =
      customApiGrouped &&
      typeof customApiGrouped === 'object' &&
      !Array.isArray(customApiGrouped)
        ? Object.keys(customApiGrouped)
        : [];

    if (names.length === 0) {
      names = [...new Set(customDishes.map(item => item.category))];
    }

    return [
      {
        key: 'all',

        label: 'All Offerings',
      },

      ...names.map(name => ({
        key: name,

        label: name,
      })),
    ];
  }, [customApiGrouped, customDishes]);

  const visibleCustomDishes = useMemo(
    () =>
      activeCustomCategory === 'all'
        ? customDishes
        : customDishes.filter(
            item => String(item.category) === String(activeCustomCategory),
          ),

    [customDishes, activeCustomCategory],
  );

  /* =======================================================
   * CUSTOM QUANTITY
   * ======================================================= */

  const addCustomItem = item => {
    setCustomQuantities(current => ({
      ...current,

      [item.customId]: 1,
    }));
  };

  const increaseCustomQuantity = item => {
    setCustomQuantities(current => ({
      ...current,

      [item.customId]: Number(current[item.customId] ?? 0) + 1,
    }));
  };

  const decreaseCustomQuantity = item => {
    setCustomQuantities(current => {
      const quantity = Number(current[item.customId] ?? 0);

      return {
        ...current,

        [item.customId]: quantity <= 1 ? 0 : quantity - 1,
      };
    });
  };

  const customSummary = useMemo(() => {
    let quantity = 0;

    let total = 0;

    customDishes.forEach(item => {
      const qty = Number(customQuantities[item.customId] ?? 0);

      quantity += qty;

      total += qty * item.rawPrice;
    });

    return {
      quantity,

      total,
    };
  }, [customDishes, customQuantities]);

  /* =======================================================
   * CUSTOM REVIEW
   * ======================================================= */

  const handleReviewCustomBox = async () => {
    if (savingCustomBox) {
      return;
    }

    if (customSummary.quantity < 3) {
      AppAlert.alert(
        'Minimum 3 Items',

        'Please select at least 3 items.',
      );

      return;
    }

    try {
      setSavingCustomBox(true);

      const baseTiffinId = Number(
        customApiTiffin?.id ?? customApiTiffin?.tiffin_id ?? CUSTOM_TIFFIN_ID,
      );

      const selected = customDishes
        .filter(item => Number(customQuantities[item.customId] ?? 0) > 0)
        .map(item => {
          const quantity = Number(customQuantities[item.customId]) || 1;

          const itemId = Number(item?.item_id ?? item?.itemId ?? item?.id);

          const total = Number((item.rawPrice * quantity).toFixed(2));

          return {
            id: itemId,

            item_id: itemId,

            itemId,

            name: item.name,

            image: item.image,

            category: item.category,

            quantity,

            qty: quantity,

            price: item.rawPrice,

            unit_price: item.rawPrice,

            rawPrice: item.rawPrice,

            total,

            subtotal: total,

            line_total: total,
          };
        });

      const total = selected.reduce(
        (sum, item) => sum + item.total,

        0,
      );

      const cart = await getStoredCart();

      const customBox = {
        cartId: `custom-${Date.now()}`,

        type: 'custom_tiffin',

        id: baseTiffinId,

        tiffin_id: baseTiffinId,

        tiffinId: baseTiffinId,

        productId: baseTiffinId,

        name: customApiTiffin?.name ?? 'Custom Tiffin Box',

        description: 'Your personally selected tiffin items',

        image: selected[0]?.image ?? null,

        quantity: 1,

        rawPrice: 0,

        price: 0,

        basePrice: 0,

        subtotal: Number(total.toFixed(2)),

        totalPrice: Number(total.toFixed(2)),

        grandTotal: Number(total.toFixed(2)),

        customBoxItems: selected,

        selectedItems: selected,

        extras: selected,

        selectedAddons: selected,

        addons: selected,

        adons: selected,

        isCustomized: true,

        isCustomBox: true,

        custom: true,
      };

      await AsyncStorage.setItem(
        CART_STORAGE_KEY,

        JSON.stringify([...cart, customBox]),
      );

      await updateCartCount();

      setCustomQuantities({});

      navigation.navigate('Order');
    } catch (err) {
      AppAlert.alert(
        'Unable to Continue',

        err?.message ?? 'Unable to save custom tiffin.',
      );
    } finally {
      setSavingCustomBox(false);
    }
  };

  /* =======================================================
   * FIXED TIFFIN CARD
   * ======================================================= */

  const renderFixedMealCard = item => {
    const adding = String(addingItemId) === String(item.id);

    const itemCount = Array.isArray(item?.items) ? item.items.length : 0;

    return (
      <View
        key={item.id}
        style={[
          styles.fixedCard,

          {
            width: layout.fixedCardWidth,
          },
        ]}
      >
        <Pressable
          onPress={() => handleTiffinPress(item)}
          style={({ pressed }) => [pressed && styles.cardPressed]}
        >
          <View style={styles.fixedImageWrap}>
            {item.image ? (
              <Image
                source={{
                  uri: item.image,
                }}
                style={styles.fixedImage}
              />
            ) : (
              <View style={[styles.fixedImage, styles.noImage]}>
                <Image
                  source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                  style={styles.noImageIcon}
                />
              </View>
            )}

            <View pointerEvents="none" style={styles.imageShade} />

            <View style={styles.mealTypeBadge}>
              <View style={styles.mealTypeDot} />

              <Text style={styles.mealTypeText}>FIXED TIFFIN</Text>
            </View>

            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeLabel}>FROM</Text>

              <Text style={styles.priceBadgeText}>{item.price}</Text>
            </View>
          </View>

          <View style={styles.fixedInfo}>
            <View style={styles.tiffinTitleArea}>
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text numberOfLines={2} style={styles.fixedName}>
                  {item.name}
                </Text>

                {!!item.description && (
                  <Text numberOfLines={2} style={styles.description}>
                    {item.description}
                  </Text>
                )}
              </View>

              <View style={styles.openDetailsCircle}>
                <Text style={styles.openDetailsArrow}>›</Text>
              </View>
            </View>

            <View style={styles.includedSection}>
              <View style={styles.includedHeader}>
                <View style={styles.includedHeaderLeft}>
                  <View style={styles.includedIconBox}>
                    <Image
                      source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                      style={styles.includedIcon}
                    />
                  </View>

                  <View>
                    <Text style={styles.includedTitle}>Included Items</Text>

                    <Text style={styles.includedSubtitle}>
                      Everything in your meal
                    </Text>
                  </View>
                </View>

                <View style={styles.itemCountBadge}>
                  <Text style={styles.itemCountNumber}>{itemCount}</Text>

                  <Text style={styles.itemCountLabel}>ITEMS</Text>
                </View>
              </View>

              {itemCount > 0 ? (
                <View style={styles.itemChipsWrap}>
                  {item.items.map((tiffinItem, index) => {
                    const quantity = Math.max(
                      1,

                      Number(tiffinItem?.quantity ?? 1) || 1,
                    );

                    return (
                      <View
                        key={`tiffin-${item.id}-item-${
                          tiffinItem?.item_id ?? tiffinItem?.id ?? index
                        }`}
                        style={styles.itemChip}
                      >
                        <View style={styles.itemChipDot} />

                        <Text style={styles.itemChipText}>
                          {tiffinItem?.name ?? `Item ${index + 1}`}
                        </Text>

                        {quantity > 1 && (
                          <View style={styles.itemQuantityBadge}>
                            <Text style={styles.itemQuantityText}>
                              ×{quantity}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.noItemsContainer}>
                  <Text style={styles.noItemsText}>
                    Tiffin items are currently unavailable.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.customizeRow}>
              <View style={styles.customizeLine} />

              <Text style={styles.customizeHint}>
                Tap card to view & customise
              </Text>

              <View style={styles.customizeLine} />
            </View>
          </View>
        </Pressable>

        <View style={styles.fixedButtonWrap}>
          <Pressable
            disabled={adding}
            onPress={() => handleAddToCart(item)}
            style={({ pressed }) => [
              styles.addButton,

              pressed && !adding && styles.addButtonPressed,

              adding && styles.disabledButton,
            ]}
          >
            {adding ? (
              <View style={styles.addingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />

                <Text style={styles.addingText}>Adding...</Text>
              </View>
            ) : (
              <>
                <View style={styles.addIconCircle}>
                  <Image
                    source={require('../assets/login-icons/add-cart.png')}
                    style={styles.addIcon}
                  />
                </View>

                <View style={styles.addButtonTextArea}>
                  <Text style={styles.addText}>ADD TO CART</Text>

                  <Text style={styles.addSubText}>Add this fixed meal</Text>
                </View>

                <Text style={styles.addArrow}>→</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  /* =======================================================
   * CUSTOM DISH
   * ======================================================= */

  const renderCustomDish = item => {
    const quantity = Number(customQuantities[item.customId] ?? 0);

    return (
      <View key={item.customId} style={styles.customCard}>
        {item.image ? (
          <Image
            source={{
              uri: item.image,
            }}
            style={styles.customImage}
          />
        ) : (
          <View style={[styles.customImage, styles.noImage]}>
            <Image
              source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
              style={styles.customNoImageIcon}
            />
          </View>
        )}

        <View style={styles.customInfo}>
          <Text style={styles.customName}>{item.name}</Text>

          <Text style={styles.customPrice}>{item.displayPrice}</Text>
        </View>

        {quantity <= 0 ? (
          <Pressable
            style={styles.customAdd}
            onPress={() => addCustomItem(item)}
          >
            <Text style={styles.customAddText}>ADD +</Text>
          </Pressable>
        ) : (
          <View style={styles.qtyControl}>
            <Pressable
              style={styles.qtyButton}
              onPress={() => decreaseCustomQuantity(item)}
            >
              <Text>−</Text>
            </Pressable>

            <Text style={styles.qtyValue}>{quantity}</Text>

            <Pressable
              style={[styles.qtyButton, styles.qtyPlus]}
              onPress={() => increaseCustomQuantity(item)}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                }}
              >
                +
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  /* =======================================================
   * LOADING
   * ======================================================= */

  if (loading && meals.length === 0) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#8B210C" />
      </SafeAreaView>
    );
  }

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />

        <View
          style={[
            styles.screen,

            {
              width: layout.pageWidth,

              paddingHorizontal: layout.padding,
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom:
                activeHomeTab === 'custom' && customSummary.quantity > 0
                  ? 170
                  : 45,
            }}
            refreshControl={
              <RefreshControl
                refreshing={
                  activeHomeTab === 'custom' ? customLoading : loading
                }
                onRefresh={() => {
                  dispatch(getTiffins());

                  if (activeHomeTab === 'custom') {
                    fetchCustomTiffinData(false);
                  }

                  updateCartCount();

                  fetchLocation();

                  fetchUnreadNotificationCount();
                }}
              />
            }
          >
            {/* HEADER */}

            <View style={styles.header}>
              <View style={styles.locationArea}>
                <Image
                  source={require('../assets/login-icons/location.png')}
                  style={styles.locationIcon}
                />

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text style={styles.locationLabel}>Delivering to</Text>

                  <Text numberOfLines={1} style={styles.location}>
                    {userLocation}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                {/* BELL */}

                <Pressable
                  style={styles.headerButton}
                  onPress={() => navigation.navigate('Notification')}
                >
                  <Image
                    source={require('../assets/login-icons/notification.png')}
                    style={styles.headerIcon}
                  />

                  {Number(unreadNotificationCount) > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {Number(unreadNotificationCount) > 99
                          ? '99+'
                          : unreadNotificationCount}
                      </Text>
                    </View>
                  )}
                </Pressable>

                {/* CART */}

                <Pressable
                  style={styles.headerButton}
                  onPress={() => navigation.navigate('Order')}
                >
                  <Image
                    source={require('../assets/login-icons/add-cart.png')}
                    style={styles.headerIcon}
                  />

                  {cartCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{cartCount}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {/* TABS */}

            <View style={styles.tabs}>
              <Pressable
                style={[
                  styles.tab,

                  activeHomeTab === 'fixed' && styles.activeTab,
                ]}
                onPress={() => setActiveHomeTab('fixed')}
              >
                <Text
                  style={[
                    styles.tabText,

                    activeHomeTab === 'fixed' && styles.activeTabText,
                  ]}
                >
                  Fixed Tiffins
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.tab,

                  activeHomeTab === 'custom' && styles.activeTab,
                ]}
                onPress={() => setActiveHomeTab('custom')}
              >
                <Text
                  style={[
                    styles.tabText,

                    activeHomeTab === 'custom' && styles.activeTabText,
                  ]}
                >
                  Make Your Own
                </Text>
              </Pressable>
            </View>

            {/* FIXED */}

            {activeHomeTab === 'fixed' && (
              <>
                <View style={styles.fixedSectionHeading}>
                  <Text style={styles.heading}>Freshly prepared for you</Text>

                  <Text style={styles.subheading}>
                    Complete meals, ready when you are
                  </Text>
                </View>

                {!!error && <Text style={styles.error}>{String(error)}</Text>}

                <View style={styles.fixedGrid}>
                  {meals.map(renderFixedMealCard)}
                </View>
              </>
            )}

            {/* CUSTOM */}

            {activeHomeTab === 'custom' && (
              <>
                {customLoading && customDishes.length === 0 && (
                  <View style={styles.centerState}>
                    <ActivityIndicator size="large" color="#8B210C" />

                    <Text style={styles.stateText}>
                      Loading today&apos;s dishes...
                    </Text>
                  </View>
                )}

                {!!customError && !customLoading && (
                  <View style={styles.errorBox}>
                    <Text style={styles.error}>{customError}</Text>
                  </View>
                )}

                {customDishes.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{
                      marginBottom: 12,
                    }}
                  >
                    {customCategories.map(category => (
                      <Pressable
                        key={category.key}
                        onPress={() => setActiveCustomCategory(category.key)}
                        style={[
                          styles.category,

                          activeCustomCategory === category.key &&
                            styles.activeCategory,
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryText,

                            activeCustomCategory === category.key &&
                              styles.activeCategoryText,
                          ]}
                        >
                          {category.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}

                {visibleCustomDishes.map(renderCustomDish)}
              </>
            )}
          </ScrollView>

          {/* CUSTOM TOTAL */}

          {activeHomeTab === 'custom' && customSummary.quantity > 0 && (
            <View
              style={[
                styles.customBottom,

                {
                  bottom: customBottom,
                },
              ]}
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.selectedLabel}>
                  {customSummary.quantity} ITEMS SELECTED
                </Text>

                <Text style={styles.selectedTotal}>
                  ${customSummary.total.toFixed(2)}
                </Text>
              </View>

              <Pressable
                disabled={savingCustomBox}
                style={styles.reviewButton}
                onPress={handleReviewCustomBox}
              >
                {savingCustomBox ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.reviewText}>Review Tiffin Box →</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* CART SUCCESS */}

      <Modal
        visible={cartPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCartPopupVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successCircle}>
              <Text style={styles.successIcon}>✓</Text>
            </View>

            <Text style={styles.modalTitle}>Added to Cart!</Text>

            <Text style={styles.modalText}>
              {addedTiffin?.name ?? 'Tiffin'} has been added to your cart.
            </Text>

            <Pressable
              style={styles.viewCart}
              onPress={() => {
                setCartPopupVisible(false);

                navigation.navigate('Order');
              }}
            >
              <Text style={styles.viewCartText}>View Cart</Text>
            </Pressable>

            <Pressable onPress={() => setCartPopupVisible(false)}>
              <Text style={styles.continueText}>Continue Shopping</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default Home;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,

    backgroundColor: '#FAF8F5',
  },

  loading: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FAF8F5',
  },

  screen: {
    flex: 1,

    alignSelf: 'center',

    position: 'relative',
  },

  header: {
    minHeight: 65,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },

  locationArea: {
    flex: 1,

    flexDirection: 'row',

    alignItems: 'center',
  },

  locationIcon: {
    width: 20,

    height: 20,

    marginRight: 8,
  },

  locationLabel: {
    fontSize: 9,

    color: '#99909D',
  },

  location: {
    fontSize: 12,

    color: '#211A25',

    fontWeight: '800',
  },

  headerActions: {
    flexDirection: 'row',
  },

  headerButton: {
    width: 38,

    height: 38,

    backgroundColor: '#FFFFFF',

    borderRadius: 12,

    borderWidth: 1,

    borderColor: '#EEE6DF',

    alignItems: 'center',

    justifyContent: 'center',

    marginLeft: 8,
  },

  headerIcon: {
    width: 19,

    height: 19,

    resizeMode: 'contain',
  },

  badge: {
    position: 'absolute',

    top: -5,

    right: -5,

    minWidth: 18,

    height: 18,

    paddingHorizontal: 4,

    borderRadius: 9,

    backgroundColor: '#8B210C',

    alignItems: 'center',

    justifyContent: 'center',

    borderWidth: 1.5,

    borderColor: '#FFFFFF',
  },

  badgeText: {
    color: '#FFFFFF',

    fontSize: 8,

    fontWeight: '900',
  },

  tabs: {
    height: 52,

    flexDirection: 'row',

    backgroundColor: '#F2E8DE',

    borderRadius: 16,

    padding: 4,

    marginBottom: 20,

    borderWidth: 1,

    borderColor: '#EADDD1',
  },

  tab: {
    flex: 1,

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',
  },

  activeTab: {
    backgroundColor: '#8B210C',

    elevation: 3,

    shadowColor: '#8B210C',

    shadowOffset: {
      width: 0,

      height: 3,
    },

    shadowOpacity: 0.2,

    shadowRadius: 6,
  },

  tabText: {
    color: '#8A7567',

    fontSize: 12,

    fontWeight: '700',
  },

  activeTabText: {
    color: '#FFFFFF',

    fontWeight: '900',
  },

  fixedSectionHeading: {
    marginBottom: 17,
  },

  heading: {
    color: '#201613',

    fontSize: 22,

    lineHeight: 29,

    fontWeight: '900',

    letterSpacing: -0.4,
  },

  subheading: {
    color: '#8E817A',

    fontSize: 10.5,

    marginTop: 3,
  },

  fixedGrid: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    alignItems: 'flex-start',

    justifyContent: 'space-between',
  },

  fixedCard: {
    backgroundColor: '#FFFFFF',

    borderRadius: 22,

    borderWidth: 1,

    borderColor: '#EEE4DA',

    marginBottom: 22,

    overflow: 'hidden',

    elevation: 7,

    shadowColor: '#6D4C3D',

    shadowOffset: {
      width: 0,

      height: 7,
    },

    shadowOpacity: 0.12,

    shadowRadius: 16,
  },

  cardPressed: {
    opacity: 0.96,
  },

  fixedImageWrap: {
    width: '100%',

    height: 205,

    position: 'relative',

    backgroundColor: '#F6EEE7',
  },

  fixedImage: {
    width: '100%',

    height: '100%',

    resizeMode: 'cover',
  },

  noImage: {
    backgroundColor: '#F8F0E7',

    alignItems: 'center',

    justifyContent: 'center',
  },

  noImageIcon: {
    width: 46,

    height: 46,

    resizeMode: 'contain',

    opacity: 0.65,
  },

  imageShade: {
    position: 'absolute',

    left: 0,

    right: 0,

    bottom: 0,

    height: 70,

    backgroundColor: 'rgba(35, 18, 10, 0.10)',
  },

  mealTypeBadge: {
    position: 'absolute',

    top: 13,

    left: 13,

    minHeight: 30,

    paddingHorizontal: 11,

    borderRadius: 15,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: 'rgba(255,255,255,0.94)',

    borderWidth: 1,

    borderColor: 'rgba(255,255,255,0.9)',

    elevation: 3,
  },

  mealTypeDot: {
    width: 7,

    height: 7,

    borderRadius: 4,

    marginRight: 6,

    backgroundColor: '#43A047',
  },

  mealTypeText: {
    color: '#49372F',

    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 0.5,
  },

  priceBadge: {
    position: 'absolute',

    top: 13,

    right: 13,

    minWidth: 68,

    paddingHorizontal: 11,

    paddingVertical: 7,

    alignItems: 'center',

    borderRadius: 14,

    backgroundColor: '#8B210C',

    elevation: 5,

    shadowColor: '#8B210C',

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: 0.28,

    shadowRadius: 8,
  },

  priceBadgeLabel: {
    color: '#EBC8C0',

    fontSize: 6.5,

    lineHeight: 8,

    fontWeight: '800',

    letterSpacing: 0.7,
  },

  priceBadgeText: {
    color: '#FFFFFF',

    fontSize: 14,

    lineHeight: 18,

    fontWeight: '900',

    marginTop: 1,
  },

  fixedInfo: {
    paddingHorizontal: 16,

    paddingTop: 17,

    paddingBottom: 13,
  },

  tiffinTitleArea: {
    flexDirection: 'row',

    alignItems: 'flex-start',
  },

  fixedName: {
    color: '#211713',

    fontSize: 18,

    lineHeight: 24,

    fontWeight: '900',

    letterSpacing: -0.35,
  },

  description: {
    color: '#8C7B73',

    fontSize: 10,

    lineHeight: 15,

    marginTop: 5,
  },

  openDetailsCircle: {
    width: 32,

    height: 32,

    marginLeft: 10,

    borderRadius: 16,

    backgroundColor: '#F9F1EB',

    borderWidth: 1,

    borderColor: '#EDDED2',

    alignItems: 'center',

    justifyContent: 'center',
  },

  openDetailsArrow: {
    color: '#8B210C',

    fontSize: 24,

    lineHeight: 27,

    fontWeight: '500',

    marginTop: -2,
  },

  includedSection: {
    marginTop: 16,

    padding: 13,

    borderRadius: 16,

    borderWidth: 1,

    borderColor: '#EEE2D7',

    backgroundColor: '#FCF9F6',
  },

  includedHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginBottom: 12,
  },

  includedHeaderLeft: {
    flexDirection: 'row',

    alignItems: 'center',

    flex: 1,
  },

  includedIconBox: {
    width: 34,

    height: 34,

    marginRight: 9,

    borderRadius: 10,

    backgroundColor: '#F7E7DF',

    alignItems: 'center',

    justifyContent: 'center',
  },

  includedIcon: {
    width: 17,

    height: 17,

    resizeMode: 'contain',

    tintColor: '#8B210C',
  },

  includedTitle: {
    color: '#34241D',

    fontSize: 11,

    fontWeight: '900',
  },

  includedSubtitle: {
    color: '#A09088',

    fontSize: 7.5,

    marginTop: 2,
  },

  itemCountBadge: {
    minWidth: 43,

    height: 34,

    borderRadius: 11,

    paddingHorizontal: 7,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#ECDDD1',
  },

  itemCountNumber: {
    color: '#8B210C',

    fontSize: 12,

    lineHeight: 13,

    fontWeight: '900',
  },

  itemCountLabel: {
    color: '#9B8980',

    fontSize: 5.5,

    lineHeight: 8,

    fontWeight: '900',

    letterSpacing: 0.3,
  },

  itemChipsWrap: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    marginHorizontal: -3,

    marginVertical: -3,
  },

  itemChip: {
    minHeight: 30,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 10,

    margin: 3,

    borderRadius: 15,

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#EADFD6',
  },

  itemChipDot: {
    width: 5,

    height: 5,

    marginRight: 6,

    borderRadius: 3,

    backgroundColor: '#C8914B',
  },

  itemChipText: {
    color: '#59453B',

    fontSize: 8.5,

    fontWeight: '700',
  },

  itemQuantityBadge: {
    minWidth: 21,

    height: 19,

    marginLeft: 6,

    paddingHorizontal: 5,

    borderRadius: 9.5,

    backgroundColor: '#8B210C',

    alignItems: 'center',

    justifyContent: 'center',
  },

  itemQuantityText: {
    color: '#FFFFFF',

    fontSize: 7,

    fontWeight: '900',
  },

  noItemsContainer: {
    minHeight: 43,

    borderRadius: 11,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 10,

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#EEE6DF',
  },

  noItemsText: {
    color: '#A1938B',

    fontSize: 8.5,

    textAlign: 'center',
  },

  customizeRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 14,
  },

  customizeLine: {
    flex: 1,

    height: 1,

    backgroundColor: '#F0E7E0',
  },

  customizeHint: {
    marginHorizontal: 9,

    color: '#A4938A',

    fontSize: 7.5,

    fontWeight: '700',
  },

  fixedButtonWrap: {
    paddingHorizontal: 14,

    paddingBottom: 15,
  },

  addButton: {
    width: '100%',

    minHeight: 56,

    paddingHorizontal: 11,

    borderRadius: 16,

    backgroundColor: '#8B210C',

    flexDirection: 'row',

    alignItems: 'center',

    elevation: 5,

    shadowColor: '#8B210C',

    shadowOffset: {
      width: 0,

      height: 5,
    },

    shadowOpacity: 0.2,

    shadowRadius: 9,
  },

  addButtonPressed: {
    opacity: 0.9,

    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  disabledButton: {
    opacity: 0.6,
  },

  addIconCircle: {
    width: 36,

    height: 36,

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  addIcon: {
    width: 18,

    height: 18,

    resizeMode: 'contain',

    tintColor: '#FFFFFF',
  },

  addButtonTextArea: {
    flex: 1,

    marginLeft: 10,
  },

  addText: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '900',

    letterSpacing: 0.3,
  },

  addSubText: {
    color: '#E7C9C2',

    fontSize: 7,

    marginTop: 2,
  },

  addArrow: {
    color: '#FFFFFF',

    fontSize: 20,

    fontWeight: '700',

    marginRight: 3,
  },

  addingContainer: {
    flex: 1,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  addingText: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '800',

    marginLeft: 8,
  },

  category: {
    height: 35,

    paddingHorizontal: 14,

    justifyContent: 'center',

    borderRadius: 18,

    backgroundColor: '#F8F3ED',

    borderWidth: 1,

    borderColor: '#E8DED4',

    marginRight: 8,
  },

  activeCategory: {
    backgroundColor: '#8B210C',

    borderColor: '#8B210C',
  },

  categoryText: {
    color: '#8A7567',

    fontSize: 10,

    fontWeight: '700',
  },

  activeCategoryText: {
    color: '#FFFFFF',

    fontWeight: '900',
  },

  customCard: {
    minHeight: 80,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFFFFF',

    borderRadius: 15,

    borderWidth: 1,

    borderColor: '#EDE3D8',

    padding: 10,

    marginBottom: 10,
  },

  customImage: {
    width: 66,

    height: 58,

    borderRadius: 10,

    resizeMode: 'cover',
  },

  customNoImageIcon: {
    width: 27,

    height: 27,
  },

  customInfo: {
    flex: 1,

    marginLeft: 10,
  },

  customName: {
    color: '#2C1A12',

    fontSize: 11,

    fontWeight: '900',
  },

  customPrice: {
    color: '#9F2B18',

    fontSize: 10,

    fontWeight: '900',

    marginTop: 6,
  },

  customAdd: {
    minWidth: 72,

    height: 32,

    borderRadius: 16,

    borderWidth: 1,

    borderColor: '#C98A48',

    alignItems: 'center',

    justifyContent: 'center',
  },

  customAddText: {
    color: '#8B210C',

    fontSize: 9,

    fontWeight: '900',
  },

  qtyControl: {
    height: 32,

    flexDirection: 'row',

    alignItems: 'center',

    borderWidth: 1,

    borderColor: '#E0B875',

    borderRadius: 16,

    overflow: 'hidden',
  },

  qtyButton: {
    width: 30,

    height: 30,

    alignItems: 'center',

    justifyContent: 'center',
  },

  qtyPlus: {
    backgroundColor: '#8B210C',
  },

  qtyValue: {
    minWidth: 25,

    textAlign: 'center',

    fontWeight: '900',
  },

  customBottom: {
    position: 'absolute',

    left: 8,

    right: 8,

    minHeight: 72,

    backgroundColor: '#332116',

    borderRadius: 15,

    flexDirection: 'row',

    alignItems: 'center',

    padding: 11,

    elevation: 15,
  },

  selectedLabel: {
    color: '#D8BA8B',

    fontSize: 7,

    fontWeight: '900',
  },

  selectedTotal: {
    color: '#E7B348',

    fontSize: 18,

    fontWeight: '900',

    marginTop: 4,
  },

  reviewButton: {
    minWidth: 140,

    height: 45,

    backgroundColor: '#8B210C',

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',
  },

  reviewText: {
    color: '#FFFFFF',

    fontSize: 9,

    fontWeight: '900',
  },

  centerState: {
    minHeight: 160,

    alignItems: 'center',

    justifyContent: 'center',
  },

  stateText: {
    marginTop: 10,

    color: '#8A7567',
  },

  error: {
    color: '#A00B0F',
  },

  errorBox: {
    padding: 15,

    backgroundColor: '#FFF3F3',

    borderRadius: 12,

    marginBottom: 12,
  },

  modalOverlay: {
    flex: 1,

    backgroundColor: 'rgba(0,0,0,0.60)',

    alignItems: 'center',

    justifyContent: 'center',

    padding: 20,
  },

  modalCard: {
    width: '100%',

    maxWidth: 380,

    backgroundColor: '#FFFFFF',

    borderRadius: 24,

    padding: 26,

    alignItems: 'center',

    elevation: 15,
  },

  successCircle: {
    width: 68,

    height: 68,

    borderRadius: 34,

    backgroundColor: '#EAF8EF',

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 4,
  },

  successIcon: {
    color: '#2F955B',

    fontSize: 34,

    lineHeight: 39,

    fontWeight: '900',
  },

  modalTitle: {
    color: '#211A25',

    fontSize: 20,

    fontWeight: '900',

    marginTop: 8,
  },

  modalText: {
    maxWidth: 290,

    color: '#777777',

    fontSize: 12,

    lineHeight: 19,

    marginTop: 8,

    textAlign: 'center',
  },

  viewCart: {
    width: '100%',

    height: 50,

    borderRadius: 14,

    backgroundColor: '#A00B0F',

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 20,
  },

  viewCartText: {
    color: '#FFFFFF',

    fontSize: 12,

    fontWeight: '900',
  },

  continueText: {
    color: '#8B210C',

    marginTop: 16,

    fontSize: 11,

    fontWeight: '800',
  },
});
