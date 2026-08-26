import React, {
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import Ionicons from 'react-native-vector-icons/Ionicons';

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL =
  'https://replete-software.com/projects/kp_admin';

const CART_STORAGE_KEY =
  'kp_customer_cart';

const FREE_SHIPPING_MINIMUM =
  11;

const SHIPPING_CHARGE =
  2;

/* =========================================================
 * Customization Options
 * ========================================================= */

const TIFFIN_GROUPS = [
  {
    key:
      'bread',

    title:
      'Bread',

    options: [
      {
        id:
          'roti',

        name:
          'Roti',

        price:
          0,
      },

      {
        id:
          'plain-thepla',

        name:
          'Plain Thepla',

        price:
          0.25,
      },

      {
        id:
          'methi-thepla',

        name:
          'Methi Thepla',

        price:
          0.5,
      },

      {
        id:
          'plain-paratha',

        name:
          'Plain Paratha',

        price:
          0.75,
      },

      {
        id:
          'aloo-paratha',

        name:
          'Aloo Paratha',

        price:
          1.5,
      },

      {
        id:
          'no-bread',

        name:
          'Remove Bread',

        price:
          0,

        removed:
          true,
      },
    ],
  },

  {
    key:
      'dal',

    title:
      'Dal',

    options: [
      {
        id:
          'dal-fry',

        name:
          'Dal Fry',

        price:
          0,
      },

      {
        id:
          'dal-tadka',

        name:
          'Dal Tadka',

        price:
          0.25,
      },

      {
        id:
          'dal-makhani',

        name:
          'Dal Makhani',

        price:
          0.75,
      },

      {
        id:
          'no-dal',

        name:
          'Remove Dal',

        price:
          0,

        removed:
          true,
      },
    ],
  },

  {
    key:
      'rice',

    title:
      'Rice',

    options: [
      {
        id:
          'plain-rice',

        name:
          'Steamed Rice',

        price:
          0,
      },

      {
        id:
          'jeera-rice',

        name:
          'Jeera Rice',

        price:
          0.5,
      },

      {
        id:
          'veg-pulao',

        name:
          'Veg Pulao',

        price:
          1,
      },

      {
        id:
          'veg-biryani',

        name:
          'Veg Biryani',

        price:
          1.5,
      },

      {
        id:
          'no-rice',

        name:
          'Remove Rice',

        price:
          0,

        removed:
          true,
      },
    ],
  },

  {
    key:
      'salad',

    title:
      'Salad',

    options: [
      {
        id:
          'garden-salad',

        name:
          'Garden Salad',

        price:
          0,
      },

      {
        id:
          'kachumber',

        name:
          'Kachumber Salad',

        price:
          0.25,
      },

      {
        id:
          'no-salad',

        name:
          'Remove Salad',

        price:
          0,

        removed:
          true,
      },
    ],
  },

  {
    key:
      'papad',

    title:
      'Papad',

    options: [
      {
        id:
          'roasted-papad',

        name:
          'Roasted Papad',

        price:
          0,
      },

      {
        id:
          'fried-papad',

        name:
          'Fried Papad',

        price:
          0.25,
      },

      {
        id:
          'masala-papad',

        name:
          'Masala Papad',

        price:
          0.75,
      },

      {
        id:
          'no-papad',

        name:
          'Remove Papad',

        price:
          0,

        removed:
          true,
      },
    ],
  },
];

const EXTRA_ITEMS = [
  {
    id:
      'extra-roti',

    name:
      'Extra Roti',

    price:
      1,
  },

  {
    id:
      'extra-thepla',

    name:
      'Extra Thepla',

    price:
      1.25,
  },

  {
    id:
      'extra-dal',

    name:
      'Extra Dal',

    price:
      2.5,
  },

  {
    id:
      'extra-rice',

    name:
      'Extra Rice',

    price:
      1.5,
  },

  {
    id:
      'extra-salad',

    name:
      'Extra Salad',

    price:
      0.75,
  },

  {
    id:
      'extra-papad',

    name:
      'Extra Papad',

    price:
      0.5,
  },
];

const INITIAL_SELECTIONS = {
  bread:
    'roti',

  dal:
    'dal-fry',

  rice:
    'plain-rice',

  salad:
    'garden-salad',

  papad:
    'roasted-papad',
};

/* =========================================================
 * Component
 * ========================================================= */

const CustomizeTiffin = ({
  navigation,
  route,
}) => {
  const {
    width,
  } = useWindowDimensions();

  const tiffin =
    route?.params?.tiffin ??
    {};

  const [
    selections,
    setSelections,
  ] = useState(
    INITIAL_SELECTIONS,
  );

  const [
    extras,
    setExtras,
  ] = useState({});

  const [
    adding,
    setAdding,
  ] = useState(false);

  /* =======================================================
   * API Tiffin Data
   * ======================================================= */

  const tiffinId =
    tiffin?.id ??
    tiffin?.tiffin_id;

  const tiffinName =
    tiffin?.name ??
    tiffin?.tiffin_name ??
    'Tiffin';

  const description =
    tiffin?.description ??
    '';

  const preparationTime =
    tiffin
      ?.preparationTime ??
    tiffin
      ?.prep_time ??
    '20 min';

  const basePrice =
    Number(
      tiffin?.rawPrice ??
        String(
          tiffin?.price ??
            '0',
        ).replace(
          '$',
          '',
        ),
    ) || 0;

  /* =======================================================
   * Image
   * ======================================================= */

  const getImageUrl =
    value => {
      if (!value) {
        return null;
      }

      const image =
        String(
          value,
        ).trim();

      if (
        image.startsWith(
          'http://',
        ) ||
        image.startsWith(
          'https://',
        )
      ) {
        return image;
      }

      if (
        image.startsWith(
          '/',
        )
      ) {
        return `${BASE_URL}${image}`;
      }

      return `${BASE_URL}/${image}`;
    };

  const image =
    getImageUrl(
      tiffin?.image ??
        tiffin?.image_url,
    );

  /* =======================================================
   * Responsive
   * ======================================================= */

  const responsive =
    useMemo(() => {
      const isTablet =
        width >= 768;

      return {
        width:
          isTablet
            ? Math.min(
                width - 80,
                720,
              )
            : width,

        padding:
          isTablet
            ? 28
            : 16,
      };
    }, [
      width,
    ]);

  /* =======================================================
   * Selected Options
   * ======================================================= */

  const selectedItems =
    useMemo(() => {
      return TIFFIN_GROUPS.map(
        group => {
          const option =
            group.options.find(
              item =>
                item.id ===
                selections[
                  group.key
                ],
            );

          return option
            ? {
                category:
                  group.title,

                ...option,
              }
            : null;
        },
      ).filter(
        Boolean,
      );
    }, [
      selections,
    ]);

  /* =======================================================
   * Customization Price
   * ======================================================= */

  const customizationPrice =
    useMemo(() => {
      return selectedItems.reduce(
        (
          total,
          item,
        ) =>
          total +
          Number(
            item.price ??
              0,
          ),
        0,
      );
    }, [
      selectedItems,
    ]);

  /* =======================================================
   * Extras
   * ======================================================= */

  const selectedExtras =
    useMemo(() => {
      return EXTRA_ITEMS.filter(
        item =>
          Number(
            extras[
              item.id
            ] ??
              0,
          ) > 0,
      ).map(
        item => ({
          ...item,

          quantity:
            Number(
              extras[
                item.id
              ],
            ),

          lineTotal:
            Number(
              extras[
                item.id
              ],
            ) *
            Number(
              item.price,
            ),
        }),
      );
    }, [
      extras,
    ]);

  const extrasPrice =
    useMemo(() => {
      return selectedExtras.reduce(
        (
          total,
          item,
        ) =>
          total +
          Number(
            item.lineTotal ??
              0,
          ),
        0,
      );
    }, [
      selectedExtras,
    ]);

  /* =======================================================
   * Totals
   * ======================================================= */

  const subtotal =
    basePrice +
    customizationPrice +
    extrasPrice;

  const shippingCharge =
    subtotal <
    FREE_SHIPPING_MINIMUM
      ? SHIPPING_CHARGE
      : 0;

  const total =
    subtotal +
    shippingCharge;

  /* =======================================================
   * Update Selection
   * ======================================================= */

  const updateSelection =
    (
      group,
      option,
    ) => {
      setSelections(
        current => ({
          ...current,

          [group]:
            option,
        }),
      );
    };

  /* =======================================================
   * Extra Quantity
   * ======================================================= */

  const changeExtra =
    (
      id,
      change,
    ) => {
      setExtras(
        current => {
          const existing =
            Number(
              current[id] ??
                0,
            );

          return {
            ...current,

            [id]:
              Math.max(
                0,

                existing +
                  change,
              ),
          };
        },
      );
    };

  /* =======================================================
   * Add Customized Tiffin To Cart
   * ======================================================= */

  const handleAddToCart =
    async () => {
      if (
        !tiffinId
      ) {
        Alert.alert(
          'Unable to Add',
          'Tiffin information is missing.',
        );

        return;
      }

      try {
        setAdding(
          true,
        );

        const cartItem = {
          cartId:
            `${tiffinId}-${Date.now()}`,

          tiffinId:
            Number(
              tiffinId,
            ),

          productId:
            Number(
              tiffinId,
            ),

          id:
            Number(
              tiffinId,
            ),

          name:
            tiffinName,

          description,

          image,

          preparationTime,

          currency:
            'USD',

          quantity:
            1,

          basePrice,

          rawPrice:
            basePrice,

          customizationPrice,

          extrasPrice,

          subtotal,

          shippingCharge,

          totalPrice:
            total,

          selections:
            selectedItems,

          extras:
            selectedExtras,

          originalTiffin:
            tiffin,

          addedAt:
            new Date()
              .toISOString(),
        };

        const stored =
          await AsyncStorage.getItem(
            CART_STORAGE_KEY,
          );

        let cart = [];

        if (stored) {
          try {
            const parsed =
              JSON.parse(
                stored,
              );

            if (
              Array.isArray(
                parsed,
              )
            ) {
              cart =
                parsed;
            }
          } catch (
            parseError
          ) {
            cart = [];
          }
        }

        const updatedCart = [
          ...cart,
          cartItem,
        ];

        await AsyncStorage.setItem(
          CART_STORAGE_KEY,

          JSON.stringify(
            updatedCart,
          ),
        );

        navigation.navigate(
          'Order',
        );
      } catch (
        error
      ) {
        console.log(
          'ADD CART ERROR:',
          error,
        );

        Alert.alert(
          'Unable to Add',
          'Something went wrong while adding the tiffin.',
        );
      } finally {
        setAdding(
          false,
        );
      }
    };

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }>

      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFDFB"
      />

      <View
        style={[
          styles.screen,

          {
            width:
              responsive.width,
          },
        ]}>

        {/* Header */}

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
              styles.headerButton
            }

            onPress={() =>
              navigation.goBack()
            }>

            <Image
              source={require('../assets/login-icons/back.png')}

              style={
                styles.headerIcon
              }
            />

          </Pressable>

          <View
            style={{
              flex:
                1,

              marginLeft:
                10,
            }}>

            <Text
              style={
                styles.headerTitle
              }>
              Customize Tiffin
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }>
              {tiffinName}
            </Text>

          </View>

        </View>

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }

          contentContainerStyle={{
            paddingBottom:
              125,
          }}>

          {/* Image */}

          <View
            style={
              styles.hero
            }>

            {image ? (
              <Image
                source={{
                  uri:
                    image,
                }}

                style={
                  styles.heroImage
                }

                resizeMode="cover"
              />
            ) : (
              <Image
                source={require('../assets/tiffin-2.png')}

                style={
                  styles.heroImage
                }

                resizeMode="cover"
              />
            )}

          </View>

          <View
            style={{
              paddingHorizontal:
                responsive.padding,

              paddingTop:
                18,
            }}>

            <View
              style={
                styles.titleRow
              }>

              <View
                style={{
                  flex:
                    1,
                }}>

                <Text
                  style={
                    styles.title
                  }>
                  {
                    tiffinName
                  }
                </Text>

                {!!description && (
                  <Text
                    style={
                      styles.description
                    }>
                    {
                      description
                    }
                  </Text>
                )}

              </View>

              <Text
                style={
                  styles.basePrice
                }>
                $
                {
                  basePrice.toFixed(
                    2,
                  )
                }
              </Text>

            </View>

            {/* Options */}

            {TIFFIN_GROUPS.map(
              group => (
                <View
                  key={
                    group.key
                  }

                  style={
                    styles.group
                  }>

                  <Text
                    style={
                      styles.groupTitle
                    }>
                    {
                      group.title
                    }
                  </Text>

                  {group.options.map(
                    option => {
                      const selected =
                        selections[
                          group.key
                        ] ===
                        option.id;

                      return (
                        <Pressable
                          key={
                            option.id
                          }

                          onPress={() =>
                            updateSelection(
                              group.key,

                              option.id,
                            )
                          }

                          style={[
                            styles.option,

                            selected &&
                              styles.selectedOption,
                          ]}>

                          <View
                            style={[
                              styles.radio,

                              selected &&
                                styles.selectedRadio,
                            ]}>

                            {selected && (
                              <View
                                style={
                                  styles.radioInner
                                }
                              />
                            )}

                          </View>

                          <Text
                            style={[
                              styles.optionName,

                              selected &&
                                styles.selectedOptionName,
                            ]}>

                            {
                              option.name
                            }

                          </Text>

                          <Text
                            style={
                              styles.optionPrice
                            }>

                            {option.price >
                            0
                              ? `+$${option.price.toFixed(
                                  2,
                                )}`
                              : ''}

                          </Text>

                        </Pressable>
                      );
                    },
                  )}

                </View>
              ),
            )}

            {/* Extras */}

            <Text
              style={
                styles.sectionHeading
              }>
              Add Extras
            </Text>

            {EXTRA_ITEMS.map(
              item => {
                const quantity =
                  Number(
                    extras[
                      item.id
                    ] ??
                      0,
                  );

                return (
                  <View
                    key={
                      item.id
                    }

                    style={
                      styles.extra
                    }>

                    <View
                      style={{
                        flex:
                          1,
                      }}>

                      <Text
                        style={
                          styles.extraName
                        }>
                        {
                          item.name
                        }
                      </Text>

                      <Text
                        style={
                          styles.extraPrice
                        }>
                        $
                        {
                          item.price.toFixed(
                            2,
                          )
                        }
                      </Text>

                    </View>

                    <View
                      style={
                        styles.quantity
                      }>

                      <Pressable
                        style={
                          styles.quantityButton
                        }

                        onPress={() =>
                          changeExtra(
                            item.id,
                            -1,
                          )
                        }>

                        <Text>
                          −
                        </Text>

                      </Pressable>

                      <Text
                        style={
                          styles.quantityValue
                        }>
                        {
                          quantity
                        }
                      </Text>

                      <Pressable
                        style={
                          styles.quantityButton
                        }

                        onPress={() =>
                          changeExtra(
                            item.id,
                            1,
                          )
                        }>

                        <Text>
                          +
                        </Text>

                      </Pressable>

                    </View>

                  </View>
                );
              },
            )}

            {/* Summary */}

            <View
              style={
                styles.summary
              }>

              <SummaryRow
                label="Base Tiffin"
                value={basePrice}
              />

              <SummaryRow
                label="Customization"
                value={customizationPrice}
              />

              <SummaryRow
                label="Extras"
                value={extrasPrice}
              />

              <SummaryRow
                label="Shipping"
                value={shippingCharge}
              />

              <View
                style={
                  styles.divider
                }
              />

              <View
                style={
                  styles.totalRow
                }>

                <Text
                  style={
                    styles.totalLabel
                  }>
                  Total
                </Text>

                <Text
                  style={
                    styles.totalValue
                  }>
                  $
                  {
                    total.toFixed(
                      2,
                    )
                  }
                </Text>

              </View>

            </View>

          </View>

        </ScrollView>

        {/* Bottom */}

        <View
          style={[
            styles.bottom,

            {
              paddingHorizontal:
                responsive.padding,
            },
          ]}>

          <View
            style={{
              marginRight:
                14,
            }}>

            <Text
              style={
                styles.bottomLabel
              }>
              Total
            </Text>

            <Text
              style={
                styles.bottomTotal
              }>
              $
              {
                total.toFixed(
                  2,
                )
              }
            </Text>

          </View>

          <TouchableOpacity
            activeOpacity={
              0.85
            }

            disabled={
              adding
            }

            onPress={
              handleAddToCart
            }

            style={
              styles.addButton
            }>

            <Ionicons
              name="cart-outline"
              size={20}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.addText
              }>
              {adding
                ? 'Adding...'
                : 'Add to Cart'}
            </Text>

          </TouchableOpacity>

        </View>

      </View>

    </SafeAreaView>
  );
};

const SummaryRow = ({
  label,
  value,
}) => (
  <View
    style={
      styles.summaryRow
    }>

    <Text
      style={
        styles.summaryLabel
      }>
      {
        label
      }
    </Text>

    <Text
      style={
        styles.summaryValue
      }>
      {value >
      0
        ? `$${Number(
            value,
          ).toFixed(2)}`
        : 'FREE'}
    </Text>

  </View>
);

export default CustomizeTiffin;

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        '#FFFDFB',
    },

    screen: {
      flex:
        1,

      alignSelf:
        'center',

      backgroundColor:
        '#FFFDFB',
    },

    header: {
      minHeight:
        65,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#EEE6E1',
    },

    headerButton: {
      width:
        38,

      height:
        38,

      backgroundColor:
        '#FFF3E8',

      borderRadius:
        20,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    headerIcon: {
      width:
        19,

      height:
        19,
    },

    headerTitle: {
      color:
        '#251A15',

      fontSize:
        16,

      fontWeight:
        '900',
    },

    headerSubtitle: {
      color:
        '#89766D',

      fontSize:
        9,

      marginTop:
        2,
    },

    hero: {
      height:
        240,
    },

    heroImage: {
      width:
        '100%',

      height:
        '100%',
    },

    titleRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',
    },

    title: {
      color:
        '#251A15',

      fontSize:
        20,

      fontWeight:
        '900',
    },

    description: {
      color:
        '#87756D',

      fontSize:
        10,

      lineHeight:
        16,

      marginTop:
        6,

      paddingRight:
        15,
    },

    basePrice: {
      color:
        '#A00B0F',

      fontSize:
        17,

      fontWeight:
        '900',
    },

    group: {
      marginTop:
        22,
    },

    groupTitle: {
      color:
        '#251A15',

      fontSize:
        14,

      fontWeight:
        '900',

      marginBottom:
        9,
    },

    option: {
      minHeight:
        52,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderWidth:
        1,

      borderColor:
        '#EEE4DE',

      borderRadius:
        13,

      paddingHorizontal:
        12,

      marginBottom:
        7,

      backgroundColor:
        '#FFFFFF',
    },

    selectedOption: {
      backgroundColor:
        '#FFF5F5',

      borderColor:
        '#A00B0F',
    },

    radio: {
      width:
        18,

      height:
        18,

      borderRadius:
        9,

      borderWidth:
        1,

      borderColor:
        '#BDAFA7',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        10,
    },

    selectedRadio: {
      borderColor:
        '#A00B0F',
    },

    radioInner: {
      width:
        9,

      height:
        9,

      backgroundColor:
        '#A00B0F',

      borderRadius:
        5,
    },

    optionName: {
      flex:
        1,

      color:
        '#322621',

      fontSize:
        11,

      fontWeight:
        '700',
    },

    selectedOptionName: {
      color:
        '#A00B0F',
    },

    optionPrice: {
      color:
        '#A00B0F',

      fontSize:
        10,

      fontWeight:
        '800',
    },

    sectionHeading: {
      color:
        '#251A15',

      fontSize:
        14,

      fontWeight:
        '900',

      marginTop:
        22,

      marginBottom:
        9,
    },

    extra: {
      minHeight:
        60,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EEE4DE',

      borderRadius:
        13,

      paddingHorizontal:
        12,

      marginBottom:
        8,
    },

    extraName: {
      color:
        '#2B211C',

      fontSize:
        11,

      fontWeight:
        '800',
    },

    extraPrice: {
      color:
        '#8B7770',

      fontSize:
        9,

      marginTop:
        3,
    },

    quantity: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    quantityButton: {
      width:
        30,

      height:
        30,

      backgroundColor:
        '#FFF3E8',

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        9,
    },

    quantityValue: {
      minWidth:
        30,

      textAlign:
        'center',

      fontWeight:
        '900',
    },

    summary: {
      backgroundColor:
        '#FAF5F2',

      borderRadius:
        16,

      padding:
        14,

      marginTop:
        20,
    },

    summaryRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        9,
    },

    summaryLabel: {
      color:
        '#75655D',

      fontSize:
        10,
    },

    summaryValue: {
      color:
        '#2C211C',

      fontSize:
        10,

      fontWeight:
        '800',
    },

    divider: {
      height:
        1,

      backgroundColor:
        '#E4DAD5',

      marginVertical:
        7,
    },

    totalRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    totalLabel: {
      color:
        '#251A15',

      fontSize:
        13,

      fontWeight:
        '900',
    },

    totalValue: {
      color:
        '#A00B0F',

      fontSize:
        17,

      fontWeight:
        '900',
    },

    bottom: {
      position:
        'absolute',

      bottom:
        0,

      left:
        0,

      right:
        0,

      minHeight:
        88,

      backgroundColor:
        '#FFFFFF',

      borderTopWidth:
        1,

      borderTopColor:
        '#EEE4DE',

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingVertical:
        12,
    },

    bottomLabel: {
      color:
        '#82746D',

      fontSize:
        9,
    },

    bottomTotal: {
      color:
        '#A00B0F',

      fontSize:
        18,

      fontWeight:
        '900',
    },

    addButton: {
      flex:
        1,

      minHeight:
        52,

      borderRadius:
        13,

      backgroundColor:
        '#A00B0F',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    addText: {
      color:
        '#FFFFFF',

      fontSize:
        13,

      fontWeight:
        '900',

      marginLeft:
        7,
    },
  });