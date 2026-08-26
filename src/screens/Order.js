import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  useFocusEffect,
} from '@react-navigation/native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import Ionicons from 'react-native-vector-icons/Ionicons';

/* =========================================================
 * APIs
 * ========================================================= */

const ORDER_API =
  'https://replete-software.com/projects/kp_admin/api/customer/orders';

const PROFILE_API =
  'https://replete-software.com/projects/kp_admin/api/customer/profile';

/* =========================================================
 * STORAGE
 * ========================================================= */

const CART_STORAGE_KEY =
  'kp_customer_cart';

/* =========================================================
 * ORDER ID HELPER
 * ========================================================= */

const extractOrderId = result => {
  return (
    result?.order?.id ??
    result?.data?.order?.id ??
    result?.order_id ??
    result?.data?.order_id ??
    null
  );
};

/* =========================================================
 * DEFAULT TIFFIN ITEMS
 * ========================================================= */

const getDefaultTiffinItems = cartItem => {
  const tiffin =
    cartItem?.originalTiffin ??
    cartItem?.tiffin ??
    cartItem ??
    {};

  const possibleItems =
    tiffin?.default_items ??
    tiffin?.defaultItems ??
    tiffin?.tiffin_items ??
    tiffin?.tiffinItems ??
    tiffin?.included_items ??
    tiffin?.includedItems ??
    tiffin?.menu_items ??
    tiffin?.menuItems ??
    tiffin?.items ??
    [];

  if (!Array.isArray(possibleItems)) {
    return [];
  }

  return possibleItems
    .map((value, index) => {
      if (typeof value === 'string') {
        return {
          id: `default-${index}`,
          name: value,
          quantity: null,
          price: null,
        };
      }

      if (
        value &&
        typeof value === 'object'
      ) {
        const nestedItem =
          value?.item ??
          value?.food_item ??
          value?.product ??
          {};

        return {
          ...value,

          id:
            value?.id ??
            value?.item_id ??
            nestedItem?.id ??
            `default-${index}`,

          name:
            value?.name ??
            value?.item_name ??
            value?.title ??
            value?.food_name ??
            value?.food_item_name ??
            value?.product_name ??
            nestedItem?.name ??
            nestedItem?.title ??
            `Item ${index + 1}`,

          quantity:
            value?.quantity ??
            value?.qty ??
            value?.pivot?.quantity ??
            value?.pivot?.qty ??
            null,

          price:
            value?.price ??
            value?.pivot?.price ??
            nestedItem?.price ??
            null,
        };
      }

      return null;
    })
    .filter(Boolean);
};

/* =========================================================
 * PRODUCT HELPERS
 * ========================================================= */

const getTiffinDescription = item => {
  return (
    item?.description ??
    item?.originalTiffin?.description ??
    item?.originalTiffin?.tiffin_description ??
    ''
  );
};

const getTiffinCategory = item => {
  const original =
    item?.originalTiffin ?? {};

  if (
    original?.category &&
    typeof original.category === 'object'
  ) {
    return (
      original.category?.name ??
      original.category?.title ??
      item?.category ??
      ''
    );
  }

  return (
    item?.category ??
    original?.category_name ??
    original?.category ??
    ''
  );
};

const getTiffinFoodType = item => {
  return (
    item?.foodType ??
    item?.originalTiffin?.food_type ??
    item?.originalTiffin?.foodType ??
    ''
  );
};

const getPreparationTime = item => {
  return (
    item?.preparationTime ??
    item?.originalTiffin?.preparation_time ??
    item?.originalTiffin?.prep_time ??
    ''
  );
};

/* =========================================================
 * ORDER SCREEN
 * ========================================================= */

const Order = ({
  navigation,
}) => {
  const {
    width,
  } = useWindowDimensions();

  /* =======================================================
   * STATES
   * ======================================================= */

  const [
    cart,
    setCart,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    placingOrder,
    setPlacingOrder,
  ] = useState(false);

  const [
    notes,
    setNotes,
  ] = useState('');

  const [
    location,
    setLocation,
  ] = useState(
    'Set delivery address',
  );

  const [
    loginPopupVisible,
    setLoginPopupVisible,
  ] = useState(false);

  /*
   * NEW:
   * Order-success popup state.
   */

  const [
    orderSuccessVisible,
    setOrderSuccessVisible,
  ] = useState(false);

  /*
   * NEW:
   * Keeps created-order details even after
   * the cart is cleared.
   */

  const [
    placedOrder,
    setPlacedOrder,
  ] = useState(null);

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const responsive = useMemo(
    () => ({
      width:
        width >= 768
          ? Math.min(
              width - 80,
              720,
            )
          : width,

      padding:
        width >= 768
          ? 28
          : 14,
    }),
    [width],
  );

  /* =======================================================
   * NORMALIZE CART
   * ======================================================= */

  const normalizeCart = items => {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map(
      (
        item,
        index,
      ) => {
        const parsedPrice =
          Number(
            item?.subtotal ??
              item?.rawPrice ??
              item?.basePrice ??
              String(
                item?.price ?? 0,
              ).replace(
                /[^\d.]/g,
                '',
              ),
          );

        return {
          ...item,

          cartId:
            item?.cartId ??
            `cart-${item?.id ?? index}-${index}`,

          tiffinId:
            item?.tiffinId ??
            item?.productId ??
            item?.id,

          quantity:
            Number(
              item?.quantity ??
                1,
            ),

          subtotal:
            Number.isNaN(
              parsedPrice,
            )
              ? 0
              : parsedPrice,

          selections:
            Array.isArray(
              item?.selections,
            )
              ? item.selections
              : [],

          extras:
            Array.isArray(
              item?.extras,
            )
              ? item.extras
              : [],
        };
      },
    );
  };

  /* =======================================================
   * LOAD CART
   * ======================================================= */

  const loadCart = async () => {
    try {
      setLoading(true);

      const stored =
        await AsyncStorage.getItem(
          CART_STORAGE_KEY,
        );

      if (!stored) {
        setCart([]);
        return;
      }

      const parsed =
        JSON.parse(stored);

      const normalized =
        normalizeCart(parsed);

      setCart(normalized);

      await AsyncStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(
          normalized,
        ),
      );
    } catch (error) {
      console.log(
        'LOAD CART ERROR:',
        error,
      );

      setCart([]);
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
   * LOAD PROFILE
   * ======================================================= */

  const loadProfile = async () => {
    try {
      const token =
        await AsyncStorage.getItem(
          'token',
        );

      if (!token) {
        setLocation(
          'Login to set delivery address',
        );

        return;
      }

      const response =
        await fetch(
          PROFILE_API,
          {
            method:
              'GET',

            headers: {
              Accept:
                'application/json',

              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const responseText =
        await response.text();

      let result = {};

      try {
        result =
          responseText
            ? JSON.parse(
                responseText,
              )
            : {};
      } catch (error) {
        console.log(
          'PROFILE JSON ERROR:',
          error,
        );

        return;
      }

      if (!response.ok) {
        return;
      }

      const profile =
        result?.data?.customer ??
        result?.data?.user ??
        result?.data?.profile ??
        result?.data ??
        result?.customer ??
        result?.user ??
        result;

      let address =
        profile?.delivery_address ??
        profile?.delivery_location ??
        profile?.full_address ??
        null;

      /* =============================================
       * STRING ADDRESS
       * ============================================= */

      if (
        !address &&
        typeof profile?.address ===
          'string'
      ) {
        address =
          profile.address;
      }

      /* =============================================
       * ADDRESS OBJECT
       * ============================================= */

      if (
        !address &&
        profile?.address &&
        typeof profile.address ===
          'object'
      ) {
        address = [
          profile.address
            ?.address_line_1,

          profile.address
            ?.address_line_2,

          profile.address
            ?.street,

          profile.address
            ?.city,

          profile.address
            ?.state,

          profile.address
            ?.postcode ??
            profile.address
              ?.pincode,
        ]
          .filter(Boolean)
          .join(', ');
      }

      /* =============================================
       * FLAT ADDRESS
       * ============================================= */

      if (!address) {
        address = [
          profile?.address_line_1,

          profile?.address_line_2,

          profile?.street,

          profile?.city,

          profile?.state,

          profile?.postcode ??
            profile?.pincode,
        ]
          .filter(Boolean)
          .join(', ');
      }

      setLocation(
        address ||
          'Set delivery address',
      );
    } catch (error) {
      console.log(
        'PROFILE ERROR:',
        error,
      );
    }
  };

  /* =======================================================
   * INITIAL LOAD
   * ======================================================= */

  useEffect(() => {
    loadCart();
    loadProfile();
  }, []);

  /* =======================================================
   * REFRESH WHEN PAGE FOCUSED
   * ======================================================= */

  useFocusEffect(
    useCallback(() => {
      loadCart();
      loadProfile();
    }, []),
  );

  /* =======================================================
   * UPDATE QUANTITY
   * ======================================================= */

  const updateQuantity =
    async (
      cartId,
      change,
    ) => {
      try {
        const updated =
          cart.map(item => {
            if (
              item.cartId !==
              cartId
            ) {
              return item;
            }

            return {
              ...item,

              quantity:
                Math.max(
                  1,

                  Number(
                    item.quantity ??
                      1,
                  ) +
                    change,
                ),
            };
          });

        setCart(updated);

        await AsyncStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify(
            updated,
          ),
        );
      } catch (error) {
        console.log(
          'QUANTITY ERROR:',
          error,
        );
      }
    };

  /* =======================================================
   * REMOVE ITEM
   * ======================================================= */

  const removeItem = item => {
    Alert.alert(
      'Remove Item',

      `Remove ${
        item?.name ??
        'this item'
      } from your cart?`,

      [
        {
          text:
            'Cancel',

          style:
            'cancel',
        },

        {
          text:
            'Remove',

          style:
            'destructive',

          onPress:
            async () => {
              try {
                const updated =
                  cart.filter(
                    value =>
                      value.cartId !==
                      item.cartId,
                  );

                setCart(
                  updated,
                );

                await AsyncStorage.setItem(
                  CART_STORAGE_KEY,
                  JSON.stringify(
                    updated,
                  ),
                );
              } catch (error) {
                console.log(
                  'REMOVE ITEM ERROR:',
                  error,
                );
              }
            },
        },
      ],
    );
  };

  /* =======================================================
   * TOTALS
   * ======================================================= */

  const foodSubtotal =
    useMemo(() => {
      return cart.reduce(
        (
          total,
          item,
        ) => {
          const quantity =
            Number(
              item?.quantity ??
                1,
            );

          const price =
            Number(
              item?.subtotal ??
                item?.rawPrice ??
                item?.basePrice ??
                0,
            );

          return (
            total +
            price * quantity
          );
        },
        0,
      );
    }, [cart]);

  const shipping =
    useMemo(() => {
      if (
        foodSubtotal <=
        0
      ) {
        return 0;
      }

      return foodSubtotal <
        11
        ? 2
        : 0;
    }, [foodSubtotal]);

  const grandTotal =
    foodSubtotal +
    shipping;

  /* =======================================================
   * LOGIN
   * ======================================================= */

  const closeLoginPopup =
    () => {
      setLoginPopupVisible(
        false,
      );
    };

  const handleLoginFromPopup =
    () => {
      setLoginPopupVisible(
        false,
      );

      navigation.navigate(
        'Login',
        {
          redirectTo:
            'Order',

          action:
            'placeOrder',
        },
      );
    };

  /* =======================================================
   * PLACE ORDER
   *
   * IMPORTANT:
   *
   * NO STRIPE HERE
   * NO GOOGLE PAY HERE
   * NO PHONEPE HERE
   * NO CRED HERE
   *
   * This function:
   *
   * 1. Creates order
   * 2. Gets order ID
   * 3. Saves order details
   * 4. Clears cart
   * 5. Shows success popup
   * ======================================================= */

  const handlePlaceOrder =
    async () => {
      if (placingOrder) {
        return;
      }

      /* =============================================
       * EMPTY CART
       * ============================================= */

      if (
        cart.length ===
        0
      ) {
        Alert.alert(
          'Cart Empty',

          'Please add a tiffin before placing your order.',
        );

        return;
      }

      try {
        /* =============================================
         * AUTH
         * ============================================= */

        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (!token) {
          setLoginPopupVisible(
            true,
          );

          return;
        }

        setPlacingOrder(
          true,
        );

        /* =============================================
         * ORDER ITEMS
         * ============================================= */

        const orderItems =
          cart.map(item => {
            return {
              tiffin_id:
                Number(
                  item?.tiffinId ??
                    item?.productId ??
                    item?.id,
                ),

              quantity:
                Number(
                  item?.quantity ??
                    1,
                ),

              price:
                Number(
                  item?.subtotal ??
                    item?.rawPrice ??
                    item?.basePrice ??
                    0,
                ),

              default_items:
                getDefaultTiffinItems(
                  item,
                ),

              customizations:
                item?.selections ??
                [],

              extras:
                item?.extras ??
                [],
            };
          });

        /* =============================================
         * PAYLOAD
         *
         * PAYMENT FIELDS ARE NOT INCLUDED
         * ============================================= */

        const payload = {
          items:
            orderItems,

          notes,

          order_notes:
            notes,

          subtotal:
            Number(
              foodSubtotal.toFixed(
                2,
              ),
            ),

          delivery_fee:
            Number(
              shipping.toFixed(
                2,
              ),
            ),

          total_amount:
            Number(
              grandTotal.toFixed(
                2,
              ),
            ),

          /*
           * Backward compatibility with
           * existing Laravel API.
           */

          tiffin_id:
            Number(
              cart[0]?.tiffinId ??
                cart[0]?.productId ??
                cart[0]?.id,
            ),

          quantity:
            Number(
              cart[0]?.quantity ??
                1,
            ),
        };

        console.log(
          '==============================================',
        );

        console.log(
          'PLACE ORDER PAYLOAD:',
          JSON.stringify(
            payload,
            null,
            2,
          ),
        );

        console.log(
          '==============================================',
        );

        /* =============================================
         * CREATE ORDER
         * ============================================= */

        const response =
          await fetch(
            ORDER_API,
            {
              method:
                'POST',

              headers: {
                Accept:
                  'application/json',

                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify(
                  payload,
                ),
            },
          );

        const responseText =
          await response.text();

        let result = {};

        if (responseText) {
          try {
            result =
              JSON.parse(
                responseText,
              );
          } catch (error) {
            console.log(
              'RAW ORDER RESPONSE:',
              responseText,
            );

            throw new Error(
              'Invalid response from the order server.',
            );
          }
        }

        console.log(
          'ORDER HTTP STATUS:',
          response.status,
        );

        console.log(
          'ORDER RESPONSE:',
          JSON.stringify(
            result,
            null,
            2,
          ),
        );

        /* =============================================
         * UNAUTHORIZED
         * ============================================= */

        if (
          response.status ===
          401
        ) {
          setLoginPopupVisible(
            true,
          );

          return;
        }

        /* =============================================
         * VALIDATION ERROR
         * ============================================= */

        if (
          response.status ===
            422 &&
          result?.errors
        ) {
          const validationErrors =
            Object.values(
              result.errors,
            ).flat();

          throw new Error(
            validationErrors[0] ??
              result?.message ??
              'Order validation failed.',
          );
        }

        /* =============================================
         * HTTP ERROR
         * ============================================= */

        if (!response.ok) {
          throw new Error(
            result?.message ??
              result?.error ??
              'Unable to place your order.',
          );
        }

        if (
          result?.success ===
          false
        ) {
          throw new Error(
            result?.message ??
              'Unable to place your order.',
          );
        }

        /* =============================================
         * EXTRACT ORDER ID
         * ============================================= */

        const orderId =
          extractOrderId(
            result,
          );

        console.log(
          '==============================================',
        );

        console.log(
          'ORDER CREATED SUCCESSFULLY',
        );

        console.log(
          'ORDER ID:',
          orderId,
        );

        console.log(
          '==============================================',
        );

        if (!orderId) {
          throw new Error(
            'Order was created but the order ID was not returned by the server.',
          );
        }

        /* =============================================
         * SAVE ORDER DETAILS
         *
         * IMPORTANT:
         * save amounts BEFORE clearing cart.
         * ============================================= */

        const completedOrder = {
          orderId,

          subtotal:
            Number(
              foodSubtotal.toFixed(
                2,
              ),
            ),

          deliveryFee:
            Number(
              shipping.toFixed(
                2,
              ),
            ),

          totalAmount:
            Number(
              grandTotal.toFixed(
                2,
              ),
            ),

          currency:
            'AUD',
        };

        setPlacedOrder(
          completedOrder,
        );

        /* =============================================
         * CLEAR CART AFTER ORDER CREATED
         * ============================================= */

        await AsyncStorage.removeItem(
          CART_STORAGE_KEY,
        );

        setCart([]);

        setNotes('');

        /* =============================================
         * SHOW CUSTOM SUCCESS POPUP
         * ============================================= */

        setOrderSuccessVisible(
          true,
        );
      } catch (error) {
        console.log(
          '==============================================',
        );

        console.log(
          'PLACE ORDER ERROR:',
          error,
        );

        console.log(
          '==============================================',
        );

        Alert.alert(
          'Order Failed',

          error?.message ??
            'Unable to place your order.',
        );
      } finally {
        setPlacingOrder(
          false,
        );
      }
    };

  /* =======================================================
   * CONTINUE TO PAYMENT
   * ======================================================= */

  const handleContinueToPayment =
    () => {
      if (!placedOrder) {
        setOrderSuccessVisible(
          false,
        );

        return;
      }

      setOrderSuccessVisible(
        false,
      );

      navigation.navigate(
        'PaymentDetails',
        {
          orderId:
            placedOrder.orderId,

          subtotal:
            placedOrder.subtotal,

          deliveryFee:
            placedOrder.deliveryFee,

          totalAmount:
            placedOrder.totalAmount,

          currency:
            placedOrder.currency,
        },
      );
    };

  /* =======================================================
   * RENDER ITEM
   * ======================================================= */

  const renderItem = ({
    item,
  }) => {
    const quantity =
      Number(
        item?.quantity ??
          1,
      );

    const price =
      Number(
        item?.subtotal ??
          item?.rawPrice ??
          item?.basePrice ??
          0,
      );

    const defaultItems =
      getDefaultTiffinItems(
        item,
      );

    const description =
      getTiffinDescription(
        item,
      );

    const category =
      getTiffinCategory(
        item,
      );

    const foodType =
      getTiffinFoodType(
        item,
      );

    const preparationTime =
      getPreparationTime(
        item,
      );

    return (
      <View
        style={
          styles.productCard
        }>

        {/* PRODUCT HEADER */}

        <View
          style={
            styles.productTopSection
          }>

          {item?.image ? (
            <Image
              source={{
                uri:
                  item.image,
              }}
              style={
                styles.productImage
              }
              resizeMode="cover"
            />
          ) : (
            <Image
              source={require('../assets/tiffin-2.png')}
              style={
                styles.productImage
              }
              resizeMode="cover"
            />
          )}

          <View
            style={
              styles.productInfo
            }>

            <View
              style={
                styles.productTitleRow
              }>

              <Text
                numberOfLines={
                  2
                }
                style={
                  styles.productName
                }>
                {item?.name ??
                  'Tiffin'}
              </Text>

              <Text
                style={
                  styles.productPrice
                }>
                $
                {(
                  price *
                  quantity
                ).toFixed(
                  2,
                )}
              </Text>

            </View>

            <View
              style={
                styles.metaRow
              }>

              {!!foodType && (
                <View
                  style={
                    styles.metaBadge
                  }>

                  <Text
                    style={
                      styles.metaText
                    }>
                    {String(
                      foodType,
                    ).toUpperCase()}
                  </Text>

                </View>
              )}

              {!!category && (
                <View
                  style={
                    styles.metaBadge
                  }>

                  <Text
                    style={
                      styles.metaText
                    }>
                    {category}
                  </Text>

                </View>
              )}

            </View>

            {!!preparationTime && (
              <View
                style={
                  styles.preparationRow
                }>

                <Ionicons
                  name="time-outline"
                  size={
                    13
                  }
                  color="#82777C"
                />

                <Text
                  style={
                    styles.preparationText
                  }>
                  {preparationTime}
                </Text>

              </View>
            )}

            {!!description && (
              <Text
                numberOfLines={
                  2
                }
                style={
                  styles.productDescription
                }>
                {description}
              </Text>
            )}

          </View>

        </View>

        {/* ================================================= */}
        {/* INCLUDED ITEMS */}
        {/* ================================================= */}

        {defaultItems.length >
          0 && (
          <View
            style={
              styles.detailSection
            }>

            <Text
              style={
                styles.detailSectionTitle
              }>
              Included Items
            </Text>

            {defaultItems.map(
              (
                defaultItem,
                index,
              ) => (
                <View
                  key={`${item.cartId}-default-${index}`}
                  style={
                    styles.defaultItemRow
                  }>

                  <View
                    style={
                      styles.checkCircle
                    }>

                    <Ionicons
                      name="checkmark"
                      size={
                        10
                      }
                      color="#FFFFFF"
                    />

                  </View>

                  <Text
                    style={
                      styles.defaultItemName
                    }>
                    {
                      defaultItem.name
                    }
                  </Text>

                  {defaultItem.quantity !=
                    null && (
                    <Text
                      style={
                        styles.defaultItemQuantity
                      }>
                      ×{' '}
                      {
                        defaultItem.quantity
                      }
                    </Text>
                  )}

                </View>
              ),
            )}

          </View>
        )}

        {/* ================================================= */}
        {/* CUSTOMIZATION */}
        {/* ================================================= */}

        {!!item?.selections
          ?.length && (
          <View
            style={
              styles.detailSection
            }>

            <Text
              style={
                styles.detailSectionTitle
              }>
              Your Customization
            </Text>

            {item.selections.map(
              (
                selection,
                index,
              ) => (
                <View
                  key={`${item.cartId}-selection-${index}`}
                  style={
                    styles.customizationRow
                  }>

                  <Text
                    style={
                      styles.customizationCategory
                    }>
                    {selection?.category ??
                      'Item'}
                  </Text>

                  <Text
                    style={
                      styles.customizationValue
                    }>
                    {selection?.name ??
                      selection?.title ??
                      'Selected'}
                  </Text>

                </View>
              ),
            )}

          </View>
        )}

        {/* ================================================= */}
        {/* EXTRA ITEMS */}
        {/* ================================================= */}

        {!!item?.extras
          ?.length && (
          <View
            style={
              styles.detailSection
            }>

            <Text
              style={
                styles.detailSectionTitle
              }>
              Extra Items
            </Text>

            {item.extras.map(
              (
                extra,
                index,
              ) => {
                const extraQuantity =
                  Number(
                    extra?.quantity ??
                      1,
                  );

                const extraPrice =
                  Number(
                    extra?.price ??
                      0,
                  );

                return (
                  <View
                    key={`${item.cartId}-extra-${index}`}
                    style={
                      styles.extraRow
                    }>

                    <Text
                      style={
                        styles.extraPlus
                      }>
                      +
                    </Text>

                    <Text
                      style={
                        styles.extraName
                      }>
                      {extra?.name ??
                        'Extra Item'}
                    </Text>

                    <Text
                      style={
                        styles.extraQuantity
                      }>
                      ×{' '}
                      {extraQuantity}
                    </Text>

                    {extraPrice >
                      0 && (
                      <Text
                        style={
                          styles.extraPrice
                        }>
                        +$
                        {(
                          extraPrice *
                          extraQuantity
                        ).toFixed(
                          2,
                        )}
                      </Text>
                    )}

                  </View>
                );
              },
            )}

          </View>
        )}

        {/* ================================================= */}
        {/* QUANTITY + REMOVE */}
        {/* ================================================= */}

        <View
          style={
            styles.actionsRow
          }>

          <View
            style={
              styles.quantityBox
            }>

            <Pressable
              style={
                styles.quantityButton
              }
              onPress={() =>
                updateQuantity(
                  item.cartId,
                  -1,
                )
              }>

              <Image
                source={require('../assets/login-icons/minus.png')}
                style={
                  styles.quantityIcon
                }
                resizeMode="contain"
              />

            </Pressable>

            <Text
              style={
                styles.quantityValue
              }>
              {quantity}
            </Text>

            <Pressable
              style={
                styles.quantityButton
              }
              onPress={() =>
                updateQuantity(
                  item.cartId,
                  1,
                )
              }>

              <Image
                source={require('../assets/login-icons/add.png')}
                style={
                  styles.quantityIcon
                }
                resizeMode="contain"
              />

            </Pressable>

          </View>

          <TouchableOpacity
            activeOpacity={
              0.8
            }
            style={
              styles.removeButton
            }
            onPress={() =>
              removeItem(
                item,
              )
            }>

            <Ionicons
              name="trash-outline"
              size={
                14
              }
              color="#D34848"
            />

            <Text
              style={
                styles.removeText
              }>
              Remove
            </Text>

          </TouchableOpacity>

        </View>

      </View>
    );
  };

  /* =======================================================
   * LOADING
   * ======================================================= */

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.loading
        }>

        <ActivityIndicator
          size="large"
          color="#A00B0F"
        />

        <Text
          style={
            styles.loadingText
          }>
          Loading your cart...
        </Text>

      </SafeAreaView>
    );
  }

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <>

      <SafeAreaView
        style={
          styles.safeArea
        }>

        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFFFFF"
        />

        <View
          style={[
            styles.screen,

            {
              width:
                responsive.width,
            },
          ]}>

          {/* ================================================= */}
          {/* HEADER */}
          {/* ================================================= */}

          <View
            style={[
              styles.header,

              {
                paddingHorizontal:
                  responsive.padding,
              },
            ]}>

            <Pressable
              style={
                styles.backButton
              }
              onPress={() =>
                navigation.goBack()
              }>

              <Image
                source={require('../assets/login-icons/back.png')}
                style={
                  styles.backIcon
                }
                resizeMode="contain"
              />

            </Pressable>

            <View
              style={
                styles.headerContent
              }>

              <Text
                style={
                  styles.headerTitle
                }>
                Cart Summary
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={
                  styles.headerLocation
                }>
                {location}
              </Text>

            </View>

          </View>

          {/* ================================================= */}
          {/* EMPTY CART */}
          {/* ================================================= */}

          {cart.length ===
          0 ? (

            <View
              style={
                styles.emptyContainer
              }>

              <View
                style={
                  styles.emptyIcon
                }>

                <Ionicons
                  name="cart-outline"
                  size={
                    52
                  }
                  color="#A00B0F"
                />

              </View>

              <Text
                style={
                  styles.emptyTitle
                }>
                Your cart is empty
              </Text>

              <Text
                style={
                  styles.emptyText
                }>
                Add your favourite tiffin
                to continue.
              </Text>

              <TouchableOpacity
                activeOpacity={
                  0.85
                }
                style={
                  styles.shopButton
                }
                onPress={() =>
                  navigation.navigate(
                    'MainTabs',
                  )
                }>

                <Text
                  style={
                    styles.shopButtonText
                  }>
                  Browse Menu
                </Text>

              </TouchableOpacity>

            </View>

          ) : (

            <>

              <FlatList
                data={
                  cart
                }
                renderItem={
                  renderItem
                }
                keyExtractor={(
                  item,
                  index,
                ) =>
                  String(
                    item?.cartId ??
                      index,
                  )
                }
                showsVerticalScrollIndicator={
                  false
                }
                contentContainerStyle={{
                  paddingHorizontal:
                    responsive.padding,

                  paddingBottom:
                    220,
                }}
                ListHeaderComponent={
                  <>

                    {/* DELIVERY ADDRESS */}

                    <View
                      style={
                        styles.addressCard
                      }>

                      <View
                        style={
                          styles.addressIcon
                        }>

                        <Ionicons
                          name="location-outline"
                          size={
                            20
                          }
                          color="#A00B0F"
                        />

                      </View>

                      <View
                        style={
                          styles.addressContent
                        }>

                        <Text
                          style={
                            styles.addressLabel
                          }>
                          Delivery Address
                        </Text>

                        <Text
                          numberOfLines={
                            2
                          }
                          style={
                            styles.addressText
                          }>
                          {location}
                        </Text>

                      </View>

                    </View>

                  </>
                }
                ListFooterComponent={
                  <>

                    {/* ================================================= */}
                    {/* ORDER NOTES */}
                    {/* ================================================= */}

                    <View
                      style={
                        styles.sectionCard
                      }>

                      <Text
                        style={
                          styles.sectionTitle
                        }>
                        Order Notes
                      </Text>

                      <TextInput
                        value={
                          notes
                        }
                        onChangeText={
                          setNotes
                        }
                        placeholder="Any special instructions?"
                        placeholderTextColor="#AAA1A5"
                        multiline
                        style={
                          styles.notesInput
                        }
                      />

                    </View>

                    {/* ================================================= */}
                    {/* BILL DETAILS */}
                    {/* ================================================= */}

                    <View
                      style={
                        styles.sectionCard
                      }>

                      <Text
                        style={
                          styles.sectionTitle
                        }>
                        Bill Details
                      </Text>

                      <BillRow
                        label="Food Subtotal"
                        value={`$${foodSubtotal.toFixed(
                          2,
                        )}`}
                      />

                      <BillRow
                        label="Delivery Fee"
                        value={
                          shipping ===
                          0
                            ? 'FREE'
                            : `$${shipping.toFixed(
                                2,
                              )}`
                        }
                        green={
                          shipping ===
                          0
                        }
                      />

                      <View
                        style={
                          styles.divider
                        }
                      />

                      <BillRow
                        label="Grand Total"
                        value={`$${grandTotal.toFixed(
                          2,
                        )}`}
                        total
                      />

                    </View>

                    {/* ================================================= */}
                    {/* ORDER INFO */}
                    {/* ================================================= */}

                    <View
                      style={
                        styles.orderInfo
                      }>

                      <View
                        style={
                          styles.orderInfoIcon
                        }>

                        <Ionicons
                          name="receipt-outline"
                          size={
                            20
                          }
                          color="#278850"
                        />

                      </View>

                      <View
                        style={{
                          flex:
                            1,
                        }}>

                        <Text
                          style={
                            styles.orderInfoTitle
                          }>
                          Ready to place your order
                        </Text>

                        <Text
                          style={
                            styles.orderInfoText
                          }>
                          Review your items,
                          delivery address and
                          total, then tap Place
                          Order to continue.
                        </Text>

                      </View>

                    </View>

                  </>
                }
              />

              {/* ================================================= */}
              {/* BOTTOM BAR */}
              {/* ================================================= */}

              <View
                style={[
                  styles.bottomBar,

                  {
                    paddingHorizontal:
                      responsive.padding,
                  },
                ]}>

                <View
                  style={
                    styles.bottomTotalRow
                  }>

                  <View>

                    <Text
                      style={
                        styles.bottomTotalLabel
                      }>
                      Total Amount
                    </Text>

                    <Text
                      style={
                        styles.bottomTotal
                      }>
                      $
                      {grandTotal.toFixed(
                        2,
                      )}
                    </Text>

                  </View>

                  <Text
                    style={
                      styles.itemCount
                    }>
                    {cart.reduce(
                      (
                        total,
                        item,
                      ) =>
                        total +
                        Number(
                          item?.quantity ??
                            1,
                        ),
                      0,
                    )}{' '}
                    item(s)
                  </Text>

                </View>

                <TouchableOpacity
                  disabled={
                    placingOrder
                  }
                  activeOpacity={
                    0.85
                  }
                  onPress={
                    handlePlaceOrder
                  }
                  style={[
                    styles.placeOrderButton,

                    placingOrder &&
                      styles.disabledButton,
                  ]}>

                  {placingOrder ? (
                    <>

                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.placeOrderText
                        }>
                        Placing Order...
                      </Text>

                    </>
                  ) : (
                    <>

                      <Ionicons
                        name="checkmark-circle-outline"
                        size={
                          20
                        }
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.placeOrderText
                        }>
                        Place Order
                      </Text>

                      <Ionicons
                        name="arrow-forward"
                        size={
                          18
                        }
                        color="#FFFFFF"
                      />

                    </>
                  )}

                </TouchableOpacity>

              </View>

            </>

          )}

        </View>

      </SafeAreaView>

      {/* ===================================================== */}
      {/* LOGIN MODAL */}
      {/* ===================================================== */}

      <Modal
        visible={
          loginPopupVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closeLoginPopup
        }>

        <Pressable
          style={
            styles.loginOverlay
          }
          onPress={
            closeLoginPopup
          }>

          <Pressable
            style={
              styles.loginCard
            }
            onPress={() => {}}>

            <View
              style={
                styles.loginIconOuter
              }>

              <View
                style={
                  styles.loginIconInner
                }>

                <Ionicons
                  name="person-outline"
                  size={
                    29
                  }
                  color="#A00B0F"
                />

              </View>

            </View>

            <Text
              style={
                styles.loginTitle
              }>
              Login Required
            </Text>

            <Text
              style={
                styles.loginDescription
              }>
              Please login before placing
              your order. Your cart will
              remain saved.
            </Text>

            <View
              style={
                styles.loginButtons
              }>

              <TouchableOpacity
                activeOpacity={
                  0.8
                }
                style={
                  styles.cancelLoginButton
                }
                onPress={
                  closeLoginPopup
                }>

                <Text
                  style={
                    styles.cancelLoginText
                  }>
                  Cancel
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={
                  0.85
                }
                style={
                  styles.loginButton
                }
                onPress={
                  handleLoginFromPopup
                }>

                <Ionicons
                  name="log-in-outline"
                  size={
                    17
                  }
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.loginButtonText
                  }>
                  Login
                </Text>

              </TouchableOpacity>

            </View>

          </Pressable>

        </Pressable>

      </Modal>

      {/* ===================================================== */}
      {/* ORDER SUCCESS MODAL */}
      {/* ===================================================== */}

      <Modal
        visible={
          orderSuccessVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}>

        <View
          style={
            styles.orderSuccessOverlay
          }>

          <View
            style={
              styles.orderSuccessCard
            }>

            {/* SUCCESS ICON */}

            <View
              style={
                styles.orderSuccessIconOuter
              }>

              <View
                style={
                  styles.orderSuccessIconInner
                }>

                <Ionicons
                  name="checkmark"
                  size={
                    38
                  }
                  color="#FFFFFF"
                />

              </View>

            </View>

            {/* TITLE */}

            <Text
              style={
                styles.orderSuccessTitle
              }>
              Order Placed Successfully!
            </Text>

            {/* DESCRIPTION */}

            <Text
              style={
                styles.orderSuccessDescription
              }>
              Your order has been successfully
              placed and your cart has been
              cleared.
            </Text>

            {/* ORDER ID */}

            {!!placedOrder?.orderId && (
              <View
                style={
                  styles.orderSuccessOrderBox
                }>

                <Text
                  style={
                    styles.orderSuccessOrderLabel
                  }>
                  ORDER ID
                </Text>

                <Text
                  style={
                    styles.orderSuccessOrderId
                  }>
                  #{placedOrder.orderId}
                </Text>

              </View>
            )}

            {/* AMOUNT */}

            {!!placedOrder && (
              <View
                style={
                  styles.orderSuccessAmountRow
                }>

                <Text
                  style={
                    styles.orderSuccessAmountLabel
                  }>
                  Order Amount
                </Text>

                <Text
                  style={
                    styles.orderSuccessAmount
                  }>
                  {placedOrder.currency}{' '}
                  {Number(
                    placedOrder.totalAmount ??
                      0,
                  ).toFixed(
                    2,
                  )}
                </Text>

              </View>
            )}

            {/* PAYMENT INFO */}

            <View
              style={
                styles.orderSuccessPaymentInfo
              }>

              <Ionicons
                name="card-outline"
                size={
                  18
                }
                color="#A00B0F"
              />

              <Text
                style={
                  styles.orderSuccessPaymentText
                }>
                Your order is placed.
                Continue to choose a payment
                method.
              </Text>

            </View>

            {/* CONTINUE PAYMENT */}

            <TouchableOpacity
              activeOpacity={
                0.85
              }
              style={
                styles.orderSuccessButton
              }
              onPress={
                handleContinueToPayment
              }>

              <Text
                style={
                  styles.orderSuccessButtonText
                }>
                Continue to Payment
              </Text>

              <Ionicons
                name="arrow-forward"
                size={
                  18
                }
                color="#FFFFFF"
              />

            </TouchableOpacity>

          </View>

        </View>

      </Modal>

    </>
  );
};

/* =========================================================
 * BILL ROW
 * ========================================================= */

const BillRow = ({
  label,
  value,
  total = false,
  green = false,
}) => {
  return (
    <View
      style={
        styles.billRow
      }>

      <Text
        style={[
          styles.billLabel,

          total &&
            styles.totalLabel,
        ]}>
        {label}
      </Text>

      <Text
        style={[
          styles.billValue,

          total &&
            styles.totalValue,

          green && {
            color:
              '#278850',
          },
        ]}>
        {value}
      </Text>

    </View>
  );
};

export default Order;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        '#F8F6FA',
    },

    screen: {
      flex: 1,
      alignSelf:
        'center',
      backgroundColor:
        '#F8F6FA',
    },

    loading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F8F6FA',
    },

    loadingText: {
      color:
        '#817782',
      fontSize: 11,
      marginTop: 10,
    },

    /* =====================================================
     * HEADER
     * ===================================================== */

    header: {
      minHeight: 72,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderBottomWidth:
        1,
      borderBottomColor:
        '#F0EBF1',
    },

    backButton: {
      width: 42,
      height: 42,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F9F5F6',
      borderRadius: 14,
    },

    backIcon: {
      width: 19,
      height: 19,
    },

    headerContent: {
      flex: 1,
      marginLeft: 12,
    },

    headerTitle: {
      color:
        '#241D2B',
      fontSize: 20,
      fontWeight:
        '900',
    },

    headerLocation: {
      color:
        '#91888E',
      fontSize: 9,
      marginTop: 2,
    },

    /* =====================================================
     * PRODUCT
     * ===================================================== */

    productCard: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#EEE8EF',
      borderRadius: 17,
      padding: 12,
      marginTop: 13,
    },

    productTopSection: {
      flexDirection:
        'row',
    },

    productImage: {
      width: 92,
      height: 92,
      borderRadius: 14,
      backgroundColor:
        '#F3EFF1',
    },

    productInfo: {
      flex: 1,
      paddingLeft: 12,
    },

    productTitleRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
    },

    productName: {
      flex: 1,
      color:
        '#2A212C',
      fontSize: 13,
      fontWeight:
        '900',
      paddingRight: 8,
    },

    productPrice: {
      color:
        '#A00B0F',
      fontSize: 13,
      fontWeight:
        '900',
    },

    metaRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      marginTop: 7,
    },

    metaBadge: {
      backgroundColor:
        '#F7F2F4',
      borderRadius: 10,
      paddingHorizontal:
        7,
      paddingVertical:
        4,
      marginRight: 5,
      marginBottom: 4,
    },

    metaText: {
      color:
        '#766B72',
      fontSize: 7,
      fontWeight:
        '800',
    },

    preparationRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginTop: 4,
    },

    preparationText: {
      color:
        '#82777C',
      fontSize: 8,
      marginLeft: 4,
    },

    productDescription: {
      color:
        '#91878D',
      fontSize: 8,
      lineHeight: 12,
      marginTop: 5,
    },

    /* =====================================================
     * DETAILS
     * ===================================================== */

    detailSection: {
      borderTopWidth:
        1,
      borderTopColor:
        '#F1ECEF',
      marginTop: 12,
      paddingTop: 11,
    },

    detailSectionTitle: {
      color:
        '#51464C',
      fontSize: 9,
      fontWeight:
        '900',
      marginBottom: 7,
    },

    defaultItemRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 6,
    },

    checkCircle: {
      width: 17,
      height: 17,
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#2E9560',
      marginRight: 7,
    },

    defaultItemName: {
      flex: 1,
      color:
        '#62565D',
      fontSize: 8.5,
    },

    defaultItemQuantity: {
      color:
        '#988E94',
      fontSize: 8,
      fontWeight:
        '800',
    },

    customizationRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      marginBottom: 6,
    },

    customizationCategory: {
      color:
        '#978D93',
      fontSize: 8,
    },

    customizationValue: {
      flex: 1,
      color:
        '#51464C',
      fontSize: 8,
      fontWeight:
        '800',
      textAlign:
        'right',
      marginLeft: 15,
    },

    extraRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 6,
    },

    extraPlus: {
      color:
        '#A00B0F',
      fontWeight:
        '900',
      marginRight: 6,
    },

    extraName: {
      flex: 1,
      color:
        '#5C5057',
      fontSize: 8.5,
    },

    extraQuantity: {
      color:
        '#968B91',
      fontSize: 8,
      marginRight: 8,
    },

    extraPrice: {
      color:
        '#A00B0F',
      fontSize: 8,
      fontWeight:
        '900',
    },

    /* =====================================================
     * ACTIONS
     * ===================================================== */

    actionsRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      borderTopWidth:
        1,
      borderTopColor:
        '#F1ECEF',
      paddingTop: 11,
      marginTop: 10,
    },

    quantityBox: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFF5F5',
      borderWidth: 1,
      borderColor:
        '#F2DADB',
      borderRadius: 10,
    },

    quantityButton: {
      width: 34,
      height: 32,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    quantityIcon: {
      width: 16,
      height: 16,
    },

    quantityValue: {
      minWidth: 28,
      color:
        '#3D3035',
      fontSize: 11,
      fontWeight:
        '900',
      textAlign:
        'center',
    },

    removeButton: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingVertical:
        7,
      paddingHorizontal:
        9,
    },

    removeText: {
      color:
        '#A00B0F',
      fontSize: 8,
      fontWeight:
        '800',
      marginLeft: 4,
    },

    /* =====================================================
     * ADDRESS
     * ===================================================== */

    addressCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#EEE8EF',
      borderRadius: 15,
      padding: 12,
      marginTop: 13,
    },

    addressIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFF0F0',
      marginRight: 11,
    },

    addressContent: {
      flex: 1,
    },

    addressLabel: {
      color:
        '#3B3037',
      fontSize: 9,
      fontWeight:
        '900',
    },

    addressText: {
      color:
        '#8B8187',
      fontSize: 8,
      lineHeight: 12,
      marginTop: 3,
    },

    /* =====================================================
     * SECTIONS
     * ===================================================== */

    sectionCard: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#EEE8EF',
      borderRadius: 15,
      padding: 13,
      marginTop: 13,
    },

    sectionTitle: {
      color:
        '#312632',
      fontSize: 11,
      fontWeight:
        '900',
      marginBottom: 10,
    },

    notesInput: {
      minHeight: 80,
      color:
        '#3D3338',
      fontSize: 9,
      textAlignVertical:
        'top',
      backgroundColor:
        '#FAF7F8',
      borderWidth: 1,
      borderColor:
        '#ECE5E8',
      borderRadius: 12,
      padding: 11,
    },

    /* =====================================================
     * BILL
     * ===================================================== */

    billRow: {
      minHeight: 29,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    billLabel: {
      color:
        '#81767D',
      fontSize: 9,
    },

    billValue: {
      color:
        '#3E343A',
      fontSize: 9,
      fontWeight:
        '800',
    },

    totalLabel: {
      color:
        '#271E29',
      fontSize: 11,
      fontWeight:
        '900',
    },

    totalValue: {
      color:
        '#A00B0F',
      fontSize: 15,
      fontWeight:
        '900',
    },

    divider: {
      height: 1,
      backgroundColor:
        '#ECE6EA',
      marginVertical:
        7,
    },

    /* =====================================================
     * ORDER INFO
     * ===================================================== */

    orderInfo: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#F2FAF5',
      borderWidth: 1,
      borderColor:
        '#DCEFE2',
      borderRadius: 14,
      padding: 11,
      marginTop: 13,
    },

    orderInfoIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#E1F4E7',
      marginRight: 10,
    },

    orderInfoTitle: {
      color:
        '#2F593B',
      fontSize: 9,
      fontWeight:
        '900',
    },

    orderInfoText: {
      color:
        '#63786A',
      fontSize: 7.5,
      lineHeight: 12,
      marginTop: 3,
    },

    /* =====================================================
     * BOTTOM
     * ===================================================== */

    bottomBar: {
      position:
        'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor:
        '#FFFFFF',
      paddingTop: 10,
      paddingBottom: 13,
      borderTopWidth: 1,
      borderTopColor:
        '#ECE7EA',

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: -4,
      },

      shadowOpacity:
        0.06,

      shadowRadius:
        8,

      elevation:
        10,
    },

    bottomTotalRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 9,
    },

    bottomTotalLabel: {
      color:
        '#8A8086',
      fontSize: 8,
    },

    bottomTotal: {
      color:
        '#A00B0F',
      fontSize: 17,
      fontWeight:
        '900',
      marginTop: 2,
    },

    itemCount: {
      color:
        '#8A8086',
      fontSize: 8,
      fontWeight:
        '700',
    },

    placeOrderButton: {
      minHeight: 53,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#A00B0F',
      borderRadius: 13,
      columnGap: 8,
    },

    placeOrderText: {
      color:
        '#FFFFFF',
      fontSize: 12,
      fontWeight:
        '900',
    },

    disabledButton: {
      opacity:
        0.6,
    },

    /* =====================================================
     * EMPTY
     * ===================================================== */

    emptyContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        25,
    },

    emptyIcon: {
      width: 95,
      height: 95,
      borderRadius: 48,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFF0F0',
    },

    emptyTitle: {
      color:
        '#302734',
      fontSize: 18,
      fontWeight:
        '900',
      marginTop: 16,
    },

    emptyText: {
      color:
        '#887F8C',
      fontSize: 10,
      textAlign:
        'center',
      marginTop: 6,
    },

    shopButton: {
      backgroundColor:
        '#A00B0F',
      paddingHorizontal:
        23,
      paddingVertical:
        13,
      borderRadius: 12,
      marginTop: 18,
    },

    shopButtonText: {
      color:
        '#FFFFFF',
      fontSize: 10,
      fontWeight:
        '900',
    },

    /* =====================================================
     * LOGIN
     * ===================================================== */

    loginOverlay: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(24,17,20,0.62)',
      paddingHorizontal:
        22,
    },

    loginCard: {
      width:
        '100%',
      maxWidth:
        380,
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderRadius: 24,
      paddingHorizontal:
        22,
      paddingTop: 27,
      paddingBottom: 20,
    },

    loginIconOuter: {
      width: 82,
      height: 82,
      borderRadius: 41,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFF1F2',
      marginBottom: 15,
    },

    loginIconInner: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FBE0E2',
      borderWidth: 1,
      borderColor:
        '#F3C9CB',
    },

    loginTitle: {
      color:
        '#241D2B',
      fontSize: 20,
      fontWeight:
        '900',
    },

    loginDescription: {
      maxWidth: 290,
      color:
        '#756B72',
      fontSize: 10,
      lineHeight: 17,
      textAlign:
        'center',
      marginTop: 7,
    },

    loginButtons: {
      width:
        '100%',
      flexDirection:
        'row',
      marginTop: 20,
    },

    cancelLoginButton: {
      flex: 1,
      minHeight: 48,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F8F4F5',
      borderWidth: 1,
      borderColor:
        '#E7DEE1',
      borderRadius: 12,
      marginRight: 5,
    },

    cancelLoginText: {
      color:
        '#6D6268',
      fontSize: 10,
      fontWeight:
        '900',
    },

    loginButton: {
      flex: 1,
      minHeight: 48,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#A00B0F',
      borderRadius: 12,
      marginLeft: 5,
    },

    loginButtonText: {
      color:
        '#FFFFFF',
      fontSize: 10,
      fontWeight:
        '900',
      marginLeft: 6,
    },

    /* =====================================================
     * ORDER SUCCESS POPUP
     * ===================================================== */

    orderSuccessOverlay: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(22,15,18,0.64)',
      paddingHorizontal:
        22,
    },

    orderSuccessCard: {
      width:
        '100%',
      maxWidth:
        380,
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderRadius:
        24,
      paddingHorizontal:
        22,
      paddingTop:
        28,
      paddingBottom:
        22,
    },

    orderSuccessIconOuter: {
      width:
        88,
      height:
        88,
      borderRadius:
        44,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#E8F7ED',
    },

    orderSuccessIconInner: {
      width:
        62,
      height:
        62,
      borderRadius:
        31,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#2B965C',
    },

    orderSuccessTitle: {
      color:
        '#241D2B',
      fontSize:
        19,
      fontWeight:
        '900',
      textAlign:
        'center',
      marginTop:
        17,
    },

    orderSuccessDescription: {
      maxWidth:
        300,
      color:
        '#7A7076',
      fontSize:
        10,
      lineHeight:
        17,
      textAlign:
        'center',
      marginTop:
        7,
    },

    orderSuccessOrderBox: {
      minWidth:
        130,
      alignItems:
        'center',
      backgroundColor:
        '#F8F5F6',
      borderWidth:
        1,
      borderColor:
        '#EEE6E9',
      borderRadius:
        12,
      paddingHorizontal:
        16,
      paddingVertical:
        10,
      marginTop:
        16,
    },

    orderSuccessOrderLabel: {
      color:
        '#978B91',
      fontSize:
        7,
      fontWeight:
        '800',
      letterSpacing:
        1,
    },

    orderSuccessOrderId: {
      color:
        '#342A30',
      fontSize:
        13,
      fontWeight:
        '900',
      marginTop:
        3,
    },

    orderSuccessAmountRow: {
      width:
        '100%',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      backgroundColor:
        '#FFF7F7',
      borderRadius:
        12,
      paddingHorizontal:
        13,
      paddingVertical:
        12,
      marginTop:
        13,
    },

    orderSuccessAmountLabel: {
      color:
        '#7E7278',
      fontSize:
        9,
      fontWeight:
        '700',
    },

    orderSuccessAmount: {
      color:
        '#A00B0F',
      fontSize:
        15,
      fontWeight:
        '900',
    },

    orderSuccessPaymentInfo: {
      width:
        '100%',
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFF2F2',
      borderWidth:
        1,
      borderColor:
        '#F4DCDD',
      borderRadius:
        12,
      paddingHorizontal:
        12,
      paddingVertical:
        11,
      marginTop:
        12,
    },

    orderSuccessPaymentText: {
      flex:
        1,
      color:
        '#795E61',
      fontSize:
        8,
      lineHeight:
        13,
      marginLeft:
        8,
    },

    orderSuccessButton: {
      width:
        '100%',
      minHeight:
        51,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#A00B0F',
      borderRadius:
        13,
      marginTop:
        17,
    },

    orderSuccessButtonText: {
      color:
        '#FFFFFF',
      fontSize:
        10.5,
      fontWeight:
        '900',
      marginRight:
        7,
    },
  });