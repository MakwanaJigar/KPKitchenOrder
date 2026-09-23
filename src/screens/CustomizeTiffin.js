import React, {
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
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

import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================================================
 * CONFIG
 * ========================================================= */

const BASE_URL =
  'https://replete-software.com/projects/kp_admin/public';

const CART_STORAGE_KEY =
  'kp_customer_cart';

const FREE_SHIPPING_MINIMUM =
  11;

const SHIPPING_CHARGE =
  2;

/* =========================================================
 * HELPERS
 * ========================================================= */

const normalizeMoney =
  value => {
    const number =
      Number(
        String(
          value ?? 0,
        ).replace(
          /[^\d.-]/g,
          '',
        ),
      );

    return Number.isFinite(
      number,
    )
      ? number
      : 0;
  };

const normalizeIncludedItem =
  (
    item,
    index,
  ) => {
    if (
      typeof item ===
      'string'
    ) {
      return {
        id:
          `included-${index}`,

        name:
          item,

        price:
          0,
      };
    }

    if (
      item &&
      typeof item ===
        'object'
    ) {
      return {
        ...item,

        id:
          item?.id ??
          item?.item_id ??
          `included-${index}`,

        name:
          item?.name ??
          item?.item_name ??
          item?.title ??
          item?.food_name ??
          `Item ${index + 1}`,

        price:
          normalizeMoney(
            item?.price ??
            item?.pivot?.price ??
            0,
          ),
      };
    }

    return null;
  };

const normalizeAddon =
  (
    addon,
    index,
    groupName =
      'Add-ons',
  ) => {
    if (
      !addon
    ) {
      return null;
    }

    const nested =
      addon?.addon ??
      addon?.adon ??
      addon?.item ??
      addon?.extra ??
      {};

    const rawId =
      addon?.adon_id ??
      addon?.addon_id ??
      addon?.addonId ??
      addon?.id ??
      nested?.id ??
      null;

    if (
      rawId === null ||
      rawId === undefined
    ) {
      return null;
    }

    const numericId =
      Number(
        rawId,
      );

    const id =
      Number.isFinite(
        numericId,
      )
        ? numericId
        : rawId;

    const price =
      normalizeMoney(
        addon?.price ??
        addon?.unit_price ??
        addon?.unitPrice ??
        addon?.additional_price ??
        addon?.extra_price ??
        addon?.pivot?.price ??
        nested?.price ??
        0,
      );

    const resolvedGroup =
      addon?.addonGroup ??
      addon?.group ??
      addon?.groupName ??
      addon?.category?.name ??
      groupName;

    return {
      ...addon,

      id,

      adon_id:
        id,

      addon_id:
        id,

      addonId:
        id,

      name:
        addon?.name ??
        addon?.adon_name ??
        addon?.addon_name ??
        addon?.title ??
        nested?.name ??
        nested?.title ??
        `Add-on ${index + 1}`,

      price,

      rawPrice:
        price,

      addonGroup:
        resolvedGroup,

      group:
        resolvedGroup,

      groupName:
        resolvedGroup,
    };
  };

/* =========================================================
 * COMPONENT
 * ========================================================= */

const CustomizeTiffin =
  ({
    navigation,
    route,
  }) => {
    const {
      width,
    } =
      useWindowDimensions();

    const tiffin =
      route?.params?.tiffin ??
      {};

    const tiffinId =
      Number(
        tiffin?.id ??
        tiffin?.tiffin_id,
      );

    const tiffinName =
      tiffin?.name ??
      tiffin?.tiffin_name ??
      'Tiffin';

    const description =
      tiffin?.description ??
      tiffin?.tiffin_description ??
      '';

    const basePrice =
      normalizeMoney(
        tiffin?.rawPrice ??
        tiffin?.price ??
        tiffin?.tiffin_price ??
        0,
      );

    const status =
      tiffin?.status ??
      '';

    const imageValue =
      tiffin?.image ??
      tiffin?.image_url ??
      tiffin?.tiffin_image;

    const getImageUrl =
      value => {
        if (
          !value
        ) {
          return null;
        }

        const string =
          String(
            value,
          ).trim();

        if (
          string.includes(
            '/uploads/',
          )
        ) {
          const index =
            string.indexOf(
              '/uploads/',
            );

          return (
            BASE_URL +
            string.substring(
              index,
            )
          );
        }

        if (
          string.startsWith(
            'http://',
          ) ||
          string.startsWith(
            'https://',
          )
        ) {
          return string;
        }

        if (
          string.startsWith(
            '/',
          )
        ) {
          return `${BASE_URL}${string}`;
        }

        return `${BASE_URL}/${string}`;
      };

    const image =
      getImageUrl(
        imageValue,
      );

    /* =====================================================
     * CATEGORY / FOOD TYPE
     * ===================================================== */

    const category =
      useMemo(
        () => {
          if (
            tiffin?.category &&
            typeof tiffin.category ===
              'object'
          ) {
            return (
              tiffin.category?.name ??
              tiffin.category?.title ??
              ''
            );
          }

          return (
            tiffin?.category ??
            tiffin?.category_name ??
            ''
          );
        },
        [
          tiffin,
        ],
      );

    const foodType =
      useMemo(
        () => {
          if (
            tiffin?.foodType ||
            tiffin?.food_type
          ) {
            return String(
              tiffin?.foodType ??
              tiffin?.food_type,
            ).toUpperCase();
          }

          const value =
            String(
              category,
            )
              .trim()
              .toLowerCase();

          if (
            value.includes(
              'non-veg',
            ) ||
            value.includes(
              'non vegetarian',
            )
          ) {
            return 'NON-VEGETARIAN';
          }

          if (
            value.includes(
              'vegetarian',
            ) ||
            value ===
              'veg'
          ) {
            return 'VEGETARIAN';
          }

          return '';
        },
        [
          tiffin,
          category,
        ],
      );

    /* =====================================================
     * INCLUDED ITEMS
     * ===================================================== */

    const includedItems =
      useMemo(
        () => {
          const possible =
            tiffin?.items ??
            tiffin?.included_items ??
            tiffin?.includedItems ??
            tiffin?.tiffin_items ??
            tiffin?.menu_items ??
            [];

          if (
            !Array.isArray(
              possible,
            )
          ) {
            return [];
          }

          return possible
            .map(
              normalizeIncludedItem,
            )
            .filter(
              Boolean,
            );
        },
        [
          tiffin,
        ],
      );

    /* =====================================================
     * CHOICE COMPONENTS (e.g. rice: Tawa pulaw / Jeera Rice)
     * ===================================================== */

    const components =
      useMemo(
        () =>
          Array.isArray(
            tiffin?.components,
          )
            ? tiffin.components.filter(
                component =>
                  component?.key &&
                  Array.isArray(
                    component?.options,
                  ) &&
                  component.options.length >
                    0,
              )
            : [],
        [
          tiffin,
        ],
      );

    const choiceComponents =
      components.filter(
        component =>
          component?.type !==
            'fixed' &&
          component.options.length >
            1,
      );

    const [
      selectedOptions,
      setSelectedOptions,
    ] =
      useState(
        () => {
          const initial =
            {};

          components.forEach(
            component => {
              const option =
                component.options.find(
                  value =>
                    value?.default,
                ) ??
                component.options[0];

              initial[
                component.key
              ] =
                tiffin?.default_selections?.[
                  component.key
                ] ??
                option?.name;
            },
          );

          return initial;
        },
      );

    const customizationPrice =
      components.reduce(
        (
          total,
          component,
        ) => {
          const option =
            component.options.find(
              value =>
                value?.name ===
                selectedOptions[
                  component.key
                ],
            );

          return (
            total +
            normalizeMoney(
              option?.price_delta ??
              0,
            )
          );
        },
        0,
      );

    const customizations =
      components.map(
        component => ({
          key:
            component.key,

          label:
            component.label,

          name:
            selectedOptions[
              component.key
            ],
        }),
      );

    /* =====================================================
     * ADDONS
     * ===================================================== */

    const addonItems =
      useMemo(
        () => {
          const source =
            route?.params?.addonList ??
            route?.params?.allAddons ??
            tiffin?.addonList ??
            route?.params?.available_add_ons ??
            route?.params?.addonGroups ??
            route?.params?.adons ??
            route?.params?.addons ??
            tiffin?.addonGroups ??
            tiffin?.adons ??
            tiffin?.addons ??
            [];

          let flattened =
            [];

          if (
            Array.isArray(
              source,
            )
          ) {
            flattened =
              source;
          } else if (
            source &&
            typeof source ===
              'object'
          ) {
            flattened =
              Object.entries(
                source,
              ).flatMap(
                ([
                  groupName,
                  values,
                ]) => {
                  if (
                    !Array.isArray(
                      values,
                    )
                  ) {
                    return [];
                  }

                  return values.map(
                    item => ({
                      ...item,

                      groupName:
                        item?.groupName ??
                        groupName,
                    }),
                  );
                },
              );
          }

          return flattened
            .map(
              (
                addon,
                index,
              ) =>
                normalizeAddon(
                  addon,
                  index,
                  addon?.groupName ??
                  addon?.group ??
                  addon?.category?.name ??
                  'Add-ons',
                ),
            )
            .filter(
              Boolean,
            )
            .filter(
              addon => {
                const statusValue =
                  String(
                    addon?.status ??
                    'Active',
                  )
                    .trim()
                    .toLowerCase();

                return (
                  statusValue === '' ||
                  statusValue === 'active' ||
                  statusValue === 'available' ||
                  statusValue === '1' ||
                  statusValue === 'true'
                );
              },
            );
        },
        [
          route?.params,
          tiffin,
        ],
      );

    /* =====================================================
     * QUANTITIES
     * ===================================================== */

    const [
      extras,
      setExtras,
    ] =
      useState({});

    const [
      adding,
      setAdding,
    ] =
      useState(false);

    const addLockRef =
      useRef(false);

    const responsive =
      useMemo(
        () => ({
          width:
            width >=
            768
              ? Math.min(
                  width - 80,
                  720,
                )
              : width,

          padding:
            width >=
            768
              ? 28
              : 16,
        }),
        [
          width,
        ],
      );

    const changeExtra =
      (
        id,
        change,
      ) => {
        setExtras(
          current => ({
            ...current,

            [id]:
              Math.max(
                0,
                Number(
                  current[
                    id
                  ] ??
                  0,
                ) +
                  change,
              ),
          }),
        );
      };

    const selectedExtras =
      useMemo(
        () => {
          return addonItems
            .filter(
              item =>
                Number(
                  extras[
                    item.id
                  ] ??
                  0,
                ) >
                0,
            )
            .map(
              item => {
                const quantity =
                  Math.max(
                    1,
                    Number(
                      extras[
                        item.id
                      ] ??
                      1,
                    ) || 1,
                  );

                const price =
                  normalizeMoney(
                    item.price,
                  );

                return {
                  ...item,

                  id:
                    item.id,

                  adon_id:
                    item.id,

                  addon_id:
                    item.id,

                  addonId:
                    item.id,

                  quantity,

                  qty:
                    quantity,

                  price,

                  unit_price:
                    price,

                  total:
                    Number(
                      (
                        price *
                        quantity
                      ).toFixed(
                        2,
                      ),
                    ),

                  lineTotal:
                    Number(
                      (
                        price *
                        quantity
                      ).toFixed(
                        2,
                      ),
                    ),
                };
              },
            );
        },
        [
          addonItems,
          extras,
        ],
      );

    const extrasPrice =
      selectedExtras.reduce(
        (
          total,
          item,
        ) =>
          total +
          normalizeMoney(
            item.total,
          ),
        0,
      );

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

    /* =====================================================
     * ADD TO CART
     * ===================================================== */

    const handleAddToCart =
      async () => {
        if (
          !Number.isFinite(
            tiffinId,
          ) ||
          tiffinId <=
            0
        ) {
          Alert.alert(
            'Unable to Add',
            'The selected tiffin does not have a valid ID.',
          );

          return;
        }

        if (
          adding ||
          addLockRef.current
        ) {
          return;
        }

        addLockRef.current =
          true;

        try {
          setAdding(
            true,
          );

          const cartItem = {
            cartId:
              `${tiffinId}-${Date.now()}`,

            id:
              tiffinId,

            tiffinId,

            productId:
              tiffinId,

            name:
              tiffinName,

            description,

            image,

            category,

            foodType,

            status,

            quantity:
              1,

            items:
              includedItems,

            includedItems:
              includedItems,

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
              selectedOptions,

            components,

            default_selections:
              tiffin?.default_selections ??
              {},

            customizations,

            extras:
              selectedExtras,

            selectedExtras:
              selectedExtras,

            selectedAddons:
              selectedExtras,

            addons:
              selectedExtras,

            adons:
              selectedExtras,

            add_ons:
              selectedExtras.map(
                addon => ({
                  id:
                    addon.id,

                  name:
                    addon.name,

                  price:
                    addon.price,

                  qty:
                    addon.quantity,
                }),
              ),

            isCustomized:
              true,

            /*
             * Distinguish fixed-tiffin
             * add-on customization from
             * Home custom boxes.
             */
            isCustomBox:
              false,

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

          let cart =
            [];

          if (
            stored
          ) {
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
              error
            ) {
              cart =
                [];
            }
          }

          await AsyncStorage.setItem(
            CART_STORAGE_KEY,

            JSON.stringify(
              [
                ...cart,
                cartItem,
              ],
            ),
          );

          navigation.navigate(
            'Order',
          );
        } catch (
          error
        ) {
          console.log(
            'ADD TIFFIN ERROR:',
            error,
          );

          Alert.alert(
            'Unable to Add',
            'Something went wrong while adding the tiffin.',
          );
        } finally {
          addLockRef.current =
            false;

          setAdding(
            false,
          );
        }
      };

    const isVegetarian =
      foodType ===
        'VEGETARIAN' ||
      foodType ===
        'VEG';

    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'top',
          'left',
          'right',
        ]}
      >
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
          ]}
        >
          <View
            style={[
              styles.header,

              {
                paddingHorizontal:
                  responsive.padding,
              },
            ]}
          >
            <Pressable
              onPress={() =>
                navigation.goBack()
              }
              style={
                styles.backButton
              }
            >
              <Image
                source={require('../assets/login-icons/back.png')}
                style={
                  styles.headerIcon
                }
              />
            </Pressable>

            <View
              style={{
                flex: 1,
                marginLeft: 12,
              }}
            >
              <Text
                style={
                  styles.headerEyebrow
                }
              >
                BUILD YOUR MEAL
              </Text>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Add-ons
              </Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={{
              paddingBottom:
                130,
            }}
          >
            <View
              style={
                styles.hero
              }
            >
              <Image
                source={
                  image
                    ? {
                        uri:
                          image,
                      }
                    : require('../assets/tiffin-2.png')
                }
                style={
                  styles.heroImage
                }
              />

              {!!foodType && (
                <View
                  style={[
                    styles.foodBadge,

                    !isVegetarian &&
                      styles.nonVegBadge,
                  ]}
                >
                  <View
                    style={[
                      styles.foodDot,

                      !isVegetarian &&
                        styles.nonVegDot,
                    ]}
                  />

                  <Text
                    style={
                      styles.foodText
                    }
                  >
                    {foodType}
                  </Text>
                </View>
              )}
            </View>

            <View
              style={{
                padding:
                  responsive.padding,
              }}
            >
              <View
                style={
                  styles.infoCard
                }
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.title
                    }
                  >
                    {tiffinName}
                  </Text>

                  {!!description && (
                    <Text
                      style={
                        styles.description
                      }
                    >
                      {description}
                    </Text>
                  )}
                </View>

                <Text
                  style={
                    styles.basePrice
                  }
                >
                  $
                  {basePrice.toFixed(
                    2,
                  )}
                </Text>
              </View>

              {includedItems.length >
                0 && (
                <View
                  style={
                    styles.section
                  }
                >
                  <Text
                    style={
                      styles.sectionLabel
                    }
                  >
                    YOUR TIFFIN
                  </Text>

                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Included Items
                  </Text>

                  <View
                    style={
                      styles.itemCard
                    }
                  >
                    {includedItems.map(
                      item => (
                        <View
                          key={
                            String(
                              item.id,
                            )
                          }
                          style={
                            styles.includedRow
                          }
                        >
                          <View
                            style={
                              styles.smallDot
                            }
                          />

                          <Text
                            style={
                              styles.includedName
                            }
                          >
                            {item.name}
                          </Text>
                        </View>
                      ),
                    )}
                  </View>
                </View>
              )}

              {choiceComponents.map(
                component => (
                  <View
                    key={
                      component.key
                    }
                    style={
                      styles.section
                    }
                  >
                    <Text
                      style={
                        styles.sectionLabel
                      }
                    >
                      CHOOSE ONE
                    </Text>

                    <Text
                      style={
                        styles.sectionTitle
                      }
                    >
                      {component.label}
                    </Text>

                    {component.options.map(
                      option => {
                        const selected =
                          selectedOptions[
                            component.key
                          ] ===
                          option.name;

                        const delta =
                          normalizeMoney(
                            option?.price_delta ??
                            0,
                          );

                        return (
                          <Pressable
                            key={
                              option.name
                            }
                            onPress={() =>
                              setSelectedOptions(
                                current => ({
                                  ...current,

                                  [component.key]:
                                    option.name,
                                }),
                              )
                            }
                            style={[
                              styles.addonCard,

                              selected &&
                                styles.optionCardSelected,
                            ]}
                          >
                            <View
                              style={[
                                styles.radio,

                                selected &&
                                  styles.radioSelected,
                              ]}
                            >
                              {selected && (
                                <View
                                  style={
                                    styles.radioDot
                                  }
                                />
                              )}
                            </View>

                            <View
                              style={{
                                flex: 1,
                              }}
                            >
                              <Text
                                style={
                                  styles.addonName
                                }
                              >
                                {option.name}
                              </Text>

                              {delta !==
                                0 && (
                                <Text
                                  style={
                                    styles.addonPrice
                                  }
                                >
                                  {delta >
                                  0
                                    ? '+'
                                    : '-'}
                                  $
                                  {Math.abs(
                                    delta,
                                  ).toFixed(
                                    2,
                                  )}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                        );
                      },
                    )}
                  </View>
                ),
              )}

              <View
                style={
                  styles.section
                }
              >
                <Text
                  style={
                    styles.sectionLabel
                  }
                >
                  OPTIONAL EXTRAS
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Add-ons
                </Text>

                {addonItems.length ===
                0 ? (
                  <View
                    style={
                      styles.emptyAddons
                    }
                  >
                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      No add-ons are available for this tiffin.
                    </Text>
                  </View>
                ) : (
                  addonItems.map(
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
                            String(
                              item.id,
                            )
                          }
                          style={
                            styles.addonCard
                          }
                        >
                          <View
                            style={{
                              flex: 1,
                            }}
                          >
                            <Text
                              style={
                                styles.addonName
                              }
                            >
                              {item.name}
                            </Text>

                            <Text
                              style={
                                styles.addonPrice
                              }
                            >
                              +$
                              {item.price.toFixed(
                                2,
                              )}
                            </Text>
                          </View>

                          {quantity <=
                          0 ? (
                            <Pressable
                              onPress={() =>
                                changeExtra(
                                  item.id,
                                  1,
                                )
                              }
                              style={
                                styles.addButton
                              }
                            >
                              <Text
                                style={
                                  styles.addText
                                }
                              >
                                ADD +
                              </Text>
                            </Pressable>
                          ) : (
                            <View
                              style={
                                styles.qtyControl
                              }
                            >
                              <Pressable
                                onPress={() =>
                                  changeExtra(
                                    item.id,
                                    -1,
                                  )
                                }
                                style={
                                  styles.qtyButton
                                }
                              >
                                <Text
                                  style={
                                    styles.qtyButtonText
                                  }
                                >
                                  −
                                </Text>
                              </Pressable>

                              <Text
                                style={
                                  styles.qtyText
                                }
                              >
                                {quantity}
                              </Text>

                              <Pressable
                                onPress={() =>
                                  changeExtra(
                                    item.id,
                                    1,
                                  )
                                }
                                style={[
                                  styles.qtyButton,
                                  styles.qtyPlus,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.qtyButtonText,
                                    {
                                      color:
                                        '#fff',
                                    },
                                  ]}
                                >
                                  +
                                </Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    },
                  )
                )}
              </View>
            </View>
          </ScrollView>

          <View
            style={
              styles.bottomBar
            }
          >
            <View>
              <Text
                style={
                  styles.bottomLabel
                }
              >
                TIFFIN TOTAL
              </Text>

              <Text
                style={
                  styles.totalText
                }
              >
                $
                {total.toFixed(
                  2,
                )}
              </Text>
            </View>

            <TouchableOpacity
              disabled={
                adding
              }
              onPress={
                handleAddToCart
              }
              style={
                styles.continueButton
              }
            >
              {adding ? (
                <ActivityIndicator
                  color="#fff"
                />
              ) : (
                <Text
                  style={
                    styles.continueText
                  }
                >
                  Add To Order →
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  };

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#FFFDFB',
    },

    screen: {
      flex: 1,
      alignSelf: 'center',
      backgroundColor: '#FFFDFB',
    },

    header: {
      height: 70,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#F0E5DC',
    },

    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#F8F0E9',
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },

    headerEyebrow: {
      color: '#A00B0F',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    headerTitle: {
      color: '#25170F',
      fontSize: 20,
      fontWeight: '900',
      marginTop: 2,
    },

    hero: {
      height: 210,
      position: 'relative',
    },

    heroImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },

    foodBadge: {
      position: 'absolute',
      left: 16,
      bottom: 15,
      backgroundColor: '#EDF9F1',
      borderRadius: 15,
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
    },

    nonVegBadge: {
      backgroundColor: '#FFF0F0',
    },

    foodDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#36A268',
      marginRight: 5,
    },

    nonVegDot: {
      backgroundColor: '#BC3131',
    },

    foodText: {
      color: '#3D443E',
      fontSize: 8,
      fontWeight: '900',
    },

    infoCard: {
      backgroundColor: '#fff',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#EEDFD4',
      padding: 15,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },

    title: {
      color: '#28170F',
      fontSize: 18,
      fontWeight: '900',
    },

    description: {
      color: '#8E786B',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 5,
    },

    basePrice: {
      color: '#A00B0F',
      fontSize: 17,
      fontWeight: '900',
      marginLeft: 10,
    },

    section: {
      marginTop: 22,
    },

    sectionLabel: {
      color: '#A00B0F',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    sectionTitle: {
      color: '#28170F',
      fontSize: 17,
      fontWeight: '900',
      marginTop: 3,
      marginBottom: 10,
    },

    itemCard: {
      backgroundColor: '#fff',
      borderRadius: 15,
      borderWidth: 1,
      borderColor: '#EEE1D8',
      paddingHorizontal: 13,
    },

    includedRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#F5ECE5',
    },

    smallDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#A00B0F',
      marginRight: 9,
    },

    includedName: {
      color: '#4B382D',
      fontSize: 11,
      fontWeight: '700',
    },

    addonCard: {
      minHeight: 66,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#EEE1D8',
      borderRadius: 14,
      padding: 12,
      marginBottom: 9,
      flexDirection: 'row',
      alignItems: 'center',
    },

    optionCardSelected: {
      borderColor: '#8B210C',
      backgroundColor: '#FFF7EB',
    },

    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: '#C9B3A4',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    radioSelected: {
      borderColor: '#8B210C',
    },

    radioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#8B210C',
    },

    addonName: {
      color: '#2F1D13',
      fontSize: 12,
      fontWeight: '900',
    },

    addonPrice: {
      color: '#A00B0F',
      fontSize: 9,
      fontWeight: '800',
      marginTop: 4,
    },

    addButton: {
      minWidth: 68,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#FFF5E9',
      borderWidth: 1,
      borderColor: '#C99155',
      alignItems: 'center',
      justifyContent: 'center',
    },

    addText: {
      color: '#8B210C',
      fontSize: 9,
      fontWeight: '900',
    },

    qtyControl: {
      height: 32,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#DDB479',
      backgroundColor: '#FFF7EB',
    },

    qtyButton: {
      width: 29,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },

    qtyPlus: {
      backgroundColor: '#8B210C',
      borderRadius: 15,
    },

    qtyButtonText: {
      color: '#986F4D',
      fontSize: 17,
      fontWeight: '900',
    },

    qtyText: {
      minWidth: 24,
      textAlign: 'center',
      color: '#3E2418',
      fontSize: 10,
      fontWeight: '900',
    },

    emptyAddons: {
      padding: 18,
      backgroundColor: '#F9F4EF',
      borderRadius: 13,
    },

    emptyText: {
      color: '#8A7568',
      textAlign: 'center',
      fontSize: 10,
    },

    bottomBar: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 10,
      minHeight: 72,
      backgroundColor: '#342216',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#B79157',
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      elevation: 10,
    },

    bottomLabel: {
      color: '#D0AD7C',
      fontSize: 7,
      fontWeight: '900',
    },

    totalText: {
      color: '#F1B94F',
      fontSize: 20,
      fontWeight: '900',
      marginTop: 3,
    },

    continueButton: {
      height: 46,
      minWidth: 145,
      borderRadius: 12,
      backgroundColor: '#8B210C',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 15,
    },

    continueText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '900',
    },
  });

export default CustomizeTiffin;