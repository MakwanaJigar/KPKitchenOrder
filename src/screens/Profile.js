import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
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

import {
  removeFcmToken,
} from '../notifications/NotificationService';

import {
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';

/* =========================================================
 * APIs
 * ========================================================= */

const PROFILE_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/profile';

const PROFILE_EDIT_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/profile/edit';

const LOGOUT_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/logout';

/* =========================================================
 * STORAGE
 * ========================================================= */

const ADDRESS_STORAGE_KEY =
  'kp_customer_addresses';

const PROFILE_IMAGE_STORAGE_KEY =
  'kp_customer_profile_image';

/* =========================================================
 * EMPTY ADDRESS
 * ========================================================= */

const createEmptyAddress = index => ({
  id:
    `profile-address-${Date.now()}-${index}`,

  type:
    index === 0
      ? 'Home'
      : 'Work',

  address_line:
    '',

  pincode:
    '',

  is_default:
    index === 0,
});

/* =========================================================
 * ADDRESS HELPERS
 * ========================================================= */

const addressToFullLine = address => {
  if (!address) {
    return '';
  }

  if (address.address_line) {
    return String(
      address.address_line,
    ).trim();
  }

  return [
    address.addressLine1 ??
      address.address_line_1,

    address.addressLine2 ??
      address.address_line_2,

    address.suburb ??
      address.city,

    address.state,

    address.country,
  ]
    .filter(Boolean)
    .map(value =>
      String(value).trim(),
    )
    .filter(Boolean)
    .join(', ');
};

/* =========================================================
 * CONVERT LOCAL ADDRESS -> API ADDRESS
 * ========================================================= */

const localAddressToApiAddress =
  address => ({
    type:
      String(
        address?.type ??
          address?.address_type ??
          'Home',
      ).trim(),

    address_line:
      addressToFullLine(
        address,
      ),

    pincode:
      String(
        address?.pincode ??
          address?.postcode ??
          '',
      ).trim(),

    is_default:
      Boolean(
        address?.is_default ??
          address?.isDefault ??
          false,
      ),
  });

/* =========================================================
 * CONVERT API ADDRESS -> LOCAL ADDRESS
 * ========================================================= */

const apiAddressToLocalAddress = (
  address,
  index,
  profile = {},
) => ({
  id:
    String(
      address?.id ??
        `address-${Date.now()}-${index}`,
    ),

  type:
    address?.type ??
    address?.address_type ??
    (
      index === 0
        ? 'Home'
        : 'Work'
    ),

  name:
    address?.name ??
    address?.full_name ??
    profile?.name ??
    `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),

  phone:
    address?.phone ??
    address?.mobile ??
    profile?.phone ??
    '',

  addressLine1:
    address?.addressLine1 ??
    address?.address_line_1 ??
    address?.address_line ??
    address?.address ??
    '',

  addressLine2:
    address?.addressLine2 ??
    address?.address_line_2 ??
    '',

  suburb:
    address?.suburb ??
    address?.city ??
    '',

  city:
    address?.city ??
    address?.suburb ??
    '',

  state:
    address?.state ??
    '',

  postcode:
    String(
      address?.postcode ??
        address?.pincode ??
        '',
    ),

  pincode:
    String(
      address?.pincode ??
        address?.postcode ??
        '',
    ),

  country:
    address?.country ??
    'Australia',

  deliveryInstructions:
    address?.deliveryInstructions ??
    address?.delivery_instructions ??
    '',

  isDefault:
    Boolean(
      address?.isDefault ??
        address?.is_default ??
        false,
    ),

  is_default:
    Boolean(
      address?.is_default ??
        address?.isDefault ??
        false,
    ),

  address_line:
    addressToFullLine(
      address,
    ),
});

/* =========================================================
 * ENSURE ONE DEFAULT
 * ========================================================= */

const ensureOneDefaultAddress =
  addresses => {
    if (
      !Array.isArray(addresses) ||
      addresses.length === 0
    ) {
      return [];
    }

    const hasDefault =
      addresses.some(
        item =>
          Boolean(
            item?.isDefault ??
              item?.is_default,
          ),
      );

    if (hasDefault) {
      return addresses.map(item => ({
        ...item,

        isDefault:
          Boolean(
            item?.isDefault ??
              item?.is_default,
          ),

        is_default:
          Boolean(
            item?.is_default ??
              item?.isDefault,
          ),
      }));
    }

    return addresses.map(
      (
        item,
        index,
      ) => ({
        ...item,

        isDefault:
          index === 0,

        is_default:
          index === 0,
      }),
    );
  };

/* =========================================================
 * PROFILE
 * ========================================================= */

const Profile = ({
  navigation,
}) => {
  const {
    width,
  } = useWindowDimensions();

  /* =======================================================
   * PROFILE
   * ======================================================= */

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  /* =======================================================
   * ADDRESS LIST USED BY PROFILE UI
   * ======================================================= */

  const [
    localAddresses,
    setLocalAddresses,
  ] = useState([]);

  /* =======================================================
   * LOGOUT
   * ======================================================= */

  const [
    logoutLoading,
    setLogoutLoading,
  ] = useState(false);

  const [
    logoutPopupVisible,
    setLogoutPopupVisible,
  ] = useState(false);

  /* =======================================================
   * EDIT PROFILE
   * ======================================================= */

  const [
    editProfileVisible,
    setEditProfileVisible,
  ] = useState(false);

  const [
    updatingProfile,
    setUpdatingProfile,
  ] = useState(false);

  const [
    updateSuccessVisible,
    setUpdateSuccessVisible,
  ] = useState(false);

  /* =======================================================
   * IMAGE
   * ======================================================= */

  const [
    photoOptionVisible,
    setPhotoOptionVisible,
  ] = useState(false);

  const [
    selectedProfileImage,
    setSelectedProfileImage,
  ] = useState(null);

  const [
    selectingPhoto,
    setSelectingPhoto,
  ] = useState(false);

  /* =======================================================
   * FORM
   * ======================================================= */

  const [
    firstName,
    setFirstName,
  ] = useState('');

  const [
    lastName,
    setLastName,
  ] = useState('');

  const [
    phone,
    setPhone,
  ] = useState('');

  const [
    email,
    setEmail,
  ] = useState('');

  const [
    oldPassword,
    setOldPassword,
  ] = useState('');

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    showOldPassword,
    setShowOldPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [
    editAddresses,
    setEditAddresses,
  ] = useState([
    createEmptyAddress(
      0,
    ),
  ]);

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const responsive =
    useMemo(
      () => {
        const isTablet =
          width >= 768;

        return {
          isTablet,

          contentWidth:
            isTablet
              ? Math.min(
                  width - 80,
                  720,
                )
              : width,

          padding:
            isTablet
              ? 28
              : 14,

          avatarSize:
            isTablet
              ? 105
              : 82,
        };
      },
      [
        width,
      ],
    );

  /* =======================================================
   * EXTRACT PROFILE
   * ======================================================= */

  const extractProfile =
    result =>
      result?.data?.customer ??
      result?.data?.user ??
      result?.data?.profile ??
      result?.data ??
      result?.customer ??
      result?.user ??
      result?.profile ??
      result;

  /* =======================================================
   * READ LOCAL ADDRESSES
   * ======================================================= */

  const loadLocalAddresses =
    useCallback(
      async (
        profileData = profile,
      ) => {
        try {
          const stored =
            await AsyncStorage.getItem(
              ADDRESS_STORAGE_KEY,
            );

          if (!stored) {
            setLocalAddresses(
              [],
            );

            return [];
          }

          const parsed =
            JSON.parse(
              stored,
            );

          if (
            !Array.isArray(
              parsed,
            )
          ) {
            setLocalAddresses(
              [],
            );

            return [];
          }

          const normalized =
            ensureOneDefaultAddress(
              parsed.map(
                (
                  item,
                  index,
                ) =>
                  apiAddressToLocalAddress(
                    item,
                    index,
                    profileData ?? {},
                  ),
              ),
            );

          setLocalAddresses(
            normalized,
          );

          return normalized;
        } catch (
          addressError
        ) {
          console.log(
            'LOAD LOCAL ADDRESS ERROR:',
            addressError,
          );

          setLocalAddresses(
            [],
          );

          return [];
        }
      },
      [
        profile,
      ],
    );

  /* =======================================================
   * SAVE ADDRESSES TO SHARED STORAGE
   * ======================================================= */

  const saveAddressesToStorage =
    async (
      addresses,
      profileData = profile,
    ) => {
      const normalized =
        ensureOneDefaultAddress(
          addresses.map(
            (
              address,
              index,
            ) =>
              apiAddressToLocalAddress(
                address,
                index,
                profileData ?? {},
              ),
          ),
        );

      await AsyncStorage.setItem(
        ADDRESS_STORAGE_KEY,
        JSON.stringify(
          normalized,
        ),
      );

      setLocalAddresses(
        normalized,
      );

      return normalized;
    };

  /* =======================================================
   * PROFILE IMAGE STORAGE
   * ======================================================= */

  const loadStoredProfileImage =
    async () => {
      try {
        const stored =
          await AsyncStorage.getItem(
            PROFILE_IMAGE_STORAGE_KEY,
          );

        if (!stored) {
          return;
        }

        const parsed =
          JSON.parse(
            stored,
          );

        if (
          parsed?.uri
        ) {
          setSelectedProfileImage(
            parsed,
          );
        }
      } catch (
        imageError
      ) {
        console.log(
          'PROFILE IMAGE STORAGE ERROR:',
          imageError,
        );
      }
    };

  /* =======================================================
   * FETCH PROFILE
   * ======================================================= */

  const fetchProfile =
    useCallback(
      async ({
        showLoader = true,
      } = {}) => {
        try {
          if (
            showLoader
          ) {
            setLoading(
              true,
            );
          }

          setError(
            null,
          );

          const token =
            await AsyncStorage.getItem(
              'token',
            );

          if (!token) {
            throw new Error(
              'Authentication token not found.',
            );
          }

          const response =
            await fetch(
              PROFILE_API_URL,
              {
                method:
                  'GET',

                headers: {
                  Accept:
                    'application/json',

                  Authorization:
                    `Bearer ${token}`,
                },
              },
            );

          const text =
            await response.text();

          let result =
            {};

          try {
            result =
              text
                ? JSON.parse(
                    text,
                  )
                : {};
          } catch {
            throw new Error(
              'Invalid profile response.',
            );
          }

          console.log(
            'PROFILE STATUS:',
            response.status,
          );

          console.log(
            'PROFILE RESPONSE:',
            JSON.stringify(
              result,
              null,
              2,
            ),
          );

          if (
            !response.ok
          ) {
            /*
             * Do not automatically delete token here
             * unless we explicitly know the session
             * has expired.
             */

            throw new Error(
              result?.message ??
                result?.error ??
                'Unable to load profile.',
            );
          }

          const profileData =
            extractProfile(
              result,
            );

          setProfile(
            profileData,
          );

          /* =============================================
           * If local storage already has addresses,
           * preserve local source because all 3 screens
           * use it.
           * ============================================= */

          const stored =
            await AsyncStorage.getItem(
              ADDRESS_STORAGE_KEY,
            );

          let storedAddresses =
            [];

          try {
            storedAddresses =
              stored
                ? JSON.parse(
                    stored,
                  )
                : [];
          } catch {
            storedAddresses =
              [];
          }

          if (
            Array.isArray(
              storedAddresses,
            ) &&
            storedAddresses.length > 0
          ) {
            await loadLocalAddresses(
              profileData,
            );
          } else if (
            Array.isArray(
              profileData?.addresses,
            ) &&
            profileData.addresses.length > 0
          ) {
            await saveAddressesToStorage(
              profileData.addresses,
              profileData,
            );
          } else {
            await loadLocalAddresses(
              profileData,
            );
          }
        } catch (
          fetchError
        ) {
          console.log(
            'PROFILE ERROR:',
            fetchError,
          );

          setError(
            fetchError?.message ??
              'Unable to load profile.',
          );
        } finally {
          if (
            showLoader
          ) {
            setLoading(
              false,
            );
          }
        }
      },
      [
        loadLocalAddresses,
      ],
    );

  /* =======================================================
   * INITIAL
   * ======================================================= */

  useEffect(
    () => {
      fetchProfile();

      loadStoredProfileImage();
    },
    [],
  );

  /* =======================================================
   * RELOAD WHEN COMING BACK FROM ADDRESS PAGE
   * ======================================================= */

  useFocusEffect(
    useCallback(
      () => {
        loadLocalAddresses();
        loadStoredProfileImage();
      },
      [
        loadLocalAddresses,
      ],
    ),
  );

  /* =======================================================
   * POPULATE EDIT FORM
   * ======================================================= */

  const populateEditForm =
    async () => {
      let resolvedFirstName =
        profile?.first_name ??
        profile?.firstName ??
        '';

      let resolvedLastName =
        profile?.last_name ??
        profile?.lastName ??
        '';

      if (
        !resolvedFirstName &&
        profile?.name
      ) {
        const parts =
          String(
            profile.name,
          )
            .trim()
            .split(
              /\s+/,
            );

        resolvedFirstName =
          parts[0] ??
          '';

        resolvedLastName =
          parts
            .slice(
              1,
            )
            .join(
              ' ',
            );
      }

      setFirstName(
        String(
          resolvedFirstName,
        ),
      );

      setLastName(
        String(
          resolvedLastName,
        ),
      );

      setPhone(
        String(
          profile?.phone ??
            profile?.mobile ??
            '',
        ),
      );

      setEmail(
        String(
          profile?.email ??
            '',
        ),
      );

      const stored =
        await loadLocalAddresses();

      const sourceAddresses =
        stored.length > 0
          ? stored
          : (
              Array.isArray(
                profile?.addresses,
              )
                ? profile.addresses
                : []
            );

      if (
        sourceAddresses.length > 0
      ) {
        setEditAddresses(
          sourceAddresses.map(
            (
              address,
              index,
            ) => ({
              id:
                address?.id ??
                `profile-${index}`,

              type:
                address?.type ??
                'Home',

              address_line:
                addressToFullLine(
                  address,
                ),

              pincode:
                String(
                  address?.pincode ??
                    address?.postcode ??
                    '',
                ),

              is_default:
                Boolean(
                  address?.is_default ??
                    address?.isDefault ??
                    index === 0,
                ),
            }),
          ),
        );
      } else {
        setEditAddresses([
          createEmptyAddress(
            0,
          ),
        ]);
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setEditProfileVisible(
        true,
      );
    };

  /* =======================================================
   * EDIT ADDRESS
   * ======================================================= */

  const updateAddressField =
    (
      index,
      field,
      value,
    ) => {
      setEditAddresses(
        current =>
          current.map(
            (
              item,
              itemIndex,
            ) =>
              itemIndex === index
                ? {
                    ...item,
                    [field]:
                      value,
                  }
                : item,
          ),
      );
    };

  const setDefaultAddress =
    index => {
      setEditAddresses(
        current =>
          current.map(
            (
              item,
              itemIndex,
            ) => ({
              ...item,

              is_default:
                itemIndex === index,
            }),
          ),
      );
    };

  const addAddressInProfile =
    () => {
      setEditAddresses(
        current => [
          ...current,

          createEmptyAddress(
            current.length,
          ),
        ],
      );
    };

  const removeAddressInProfile =
    index => {
      if (
        editAddresses.length <=
        1
      ) {
        Alert.alert(
          'Address Required',
          'At least one address is required.',
        );

        return;
      }

      let updated =
        editAddresses.filter(
          (
            _,
            itemIndex,
          ) =>
            itemIndex !== index,
        );

      if (
        !updated.some(
          item =>
            item.is_default,
        )
      ) {
        updated =
          updated.map(
            (
              item,
              itemIndex,
            ) => ({
              ...item,

              is_default:
                itemIndex === 0,
            }),
          );
      }

      setEditAddresses(
        updated,
      );
    };

  /* =======================================================
   * VALIDATE
   * ======================================================= */

  const validate =
    () => {
      if (
        !firstName.trim()
      ) {
        Alert.alert(
          'Required',
          'Please enter your first name.',
        );

        return false;
      }

      if (
        !lastName.trim()
      ) {
        Alert.alert(
          'Required',
          'Please enter your last name.',
        );

        return false;
      }

      if (
        !phone.trim()
      ) {
        Alert.alert(
          'Required',
          'Please enter your phone.',
        );

        return false;
      }

      if (
        !email.trim()
      ) {
        Alert.alert(
          'Required',
          'Please enter your email.',
        );

        return false;
      }

      for (
        let index = 0;
        index < editAddresses.length;
        index += 1
      ) {
        const address =
          editAddresses[index];

        if (
          !String(
            address?.address_line ??
              '',
          ).trim()
        ) {
          Alert.alert(
            'Address Required',
            `Please enter address ${
              index + 1
            }.`,
          );

          return false;
        }

        if (
          !String(
            address?.pincode ??
              '',
          ).trim()
        ) {
          Alert.alert(
            'Pincode Required',
            `Please enter pincode for address ${
              index + 1
            }.`,
          );

          return false;
        }
      }

      if (
        newPassword ||
        oldPassword ||
        confirmPassword
      ) {
        if (
          !oldPassword
        ) {
          Alert.alert(
            'Password',
            'Please enter your current password.',
          );

          return false;
        }

        if (
          !newPassword
        ) {
          Alert.alert(
            'Password',
            'Please enter a new password.',
          );

          return false;
        }

        if (
          newPassword !==
          confirmPassword
        ) {
          Alert.alert(
            'Password',
            'Password confirmation does not match.',
          );

          return false;
        }
      }

      return true;
    };

  /* =======================================================
   * UPDATE PROFILE
   * ======================================================= */

  const handleUpdateProfile =
    async () => {
      if (
        updatingProfile ||
        !validate()
      ) {
        return;
      }

      try {
        setUpdatingProfile(
          true,
        );

        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (!token) {
          Alert.alert(
            'Login Required',
            'Please login again.',
          );

          return;
        }

        const addressesPayload =
          editAddresses.map(
            address => ({
              type:
                String(
                  address?.type ??
                    'Home',
                ).trim(),

              address_line:
                String(
                  address?.address_line ??
                    '',
                ).trim(),

              pincode:
                String(
                  address?.pincode ??
                    '',
                ).trim(),

              is_default:
                Boolean(
                  address?.is_default,
                ),
            }),
          );

        const payload = {
          first_name:
            firstName.trim(),

          last_name:
            lastName.trim(),

          phone:
            phone.trim(),

          email:
            email.trim(),

          addresses:
            addressesPayload,
        };

        if (
          oldPassword ||
          newPassword ||
          confirmPassword
        ) {
          payload.old_password =
            oldPassword;

          payload.new_password =
            newPassword;

          payload.new_password_confirmation =
            confirmPassword;
        }

        console.log(
          'PROFILE EDIT PAYLOAD:',
          JSON.stringify(
            {
              ...payload,

              old_password:
                payload.old_password
                  ? '********'
                  : undefined,

              new_password:
                payload.new_password
                  ? '********'
                  : undefined,

              new_password_confirmation:
                payload.new_password_confirmation
                  ? '********'
                  : undefined,
            },
            null,
            2,
          ),
        );

        const response =
          await fetch(
            PROFILE_EDIT_API_URL,
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

        const text =
          await response.text();

        let result =
          {};

        try {
          result =
            text
              ? JSON.parse(
                  text,
                )
              : {};
        } catch {
          result = {};
        }

        console.log(
          'PROFILE EDIT STATUS:',
          response.status,
        );

        console.log(
          'PROFILE EDIT RESPONSE:',
          text,
        );

        /*
         * IMPORTANT CHANGE:
         *
         * DO NOT delete the token
         * DO NOT redirect to Login
         * merely because this edit endpoint
         * returns 401/403.
         */

        if (
          response.status ===
            401 ||
          response.status ===
            403
        ) {
          throw new Error(
            result?.message ??
              'Profile update was not authorized. Please verify the profile edit API authentication.',
          );
        }

        if (
          response.status ===
            422
        ) {
          const messages =
            result?.errors
              ? Object.values(
                  result.errors,
                ).reduce(
                  (
                    all,
                    item,
                  ) =>
                    all.concat(
                      Array.isArray(
                        item,
                      )
                        ? item
                        : [
                            item,
                          ],
                    ),
                  [],
                )
              : [];

          throw new Error(
            messages[0] ??
              result?.message ??
              'Please check your profile data.',
          );
        }

        if (
          !response.ok ||
          result?.success ===
            false
        ) {
          throw new Error(
            result?.message ??
              result?.error ??
              'Unable to update profile.',
          );
        }

        /* =============================================
         * SAVE SAME ADDRESSES FOR ADDRESS LIST
         * ============================================= */

        const localList =
          addressesPayload.map(
            (
              item,
              index,
            ) => ({
              id:
                editAddresses[index]
                  ?.id ??
                `address-${Date.now()}-${index}`,

              type:
                item.type,

              name:
                `${firstName.trim()} ${lastName.trim()}`.trim(),

              phone:
                phone.trim(),

              addressLine1:
                item.address_line,

              addressLine2:
                '',

              suburb:
                '',

              city:
                '',

              state:
                '',

              postcode:
                item.pincode,

              pincode:
                item.pincode,

              country:
                'Australia',

              deliveryInstructions:
                '',

              isDefault:
                item.is_default,

              is_default:
                item.is_default,

              address_line:
                item.address_line,
            }),
          );

        await saveAddressesToStorage(
          localList,
          {
            ...profile,

            first_name:
              firstName.trim(),

            last_name:
              lastName.trim(),

            phone:
              phone.trim(),
          },
        );

        const defaultAddress =
          addressesPayload.find(
            item =>
              item.is_default,
          ) ??
          addressesPayload[0];

        setProfile(
          current => ({
            ...current,

            first_name:
              firstName.trim(),

            last_name:
              lastName.trim(),

            name:
              `${firstName.trim()} ${lastName.trim()}`.trim(),

            phone:
              phone.trim(),

            email:
              email.trim(),

            addresses:
              addressesPayload,

            address:
              defaultAddress?.address_line ??
              '',

            pincode:
              defaultAddress?.pincode ??
              '',
          }),
        );

        setEditProfileVisible(
          false,
        );

        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');

        setUpdateSuccessVisible(
          true,
        );
      } catch (
        updateError
      ) {
        console.log(
          'PROFILE UPDATE ERROR:',
          updateError,
        );

        Alert.alert(
          'Profile Update Failed',
          updateError?.message ??
            'Unable to update profile.',
        );
      } finally {
        setUpdatingProfile(
          false,
        );
      }
    };

  /* =======================================================
   * CAMERA
   * ======================================================= */

  const requestCameraPermission =
    async () => {
      if (
        Platform.OS !==
        'android'
      ) {
        return true;
      }

      const result =
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );

      return (
        result ===
        PermissionsAndroid.RESULTS.GRANTED
      );
    };

  const saveSelectedImage =
    async response => {
      if (
        response?.didCancel
      ) {
        return;
      }

      if (
        response?.errorCode
      ) {
        Alert.alert(
          'Image Error',
          response?.errorMessage ??
            'Unable to select image.',
        );

        return;
      }

      const asset =
        response?.assets?.[0];

      if (
        !asset?.uri
      ) {
        return;
      }

      const imageData = {
        uri:
          asset.uri,

        type:
          asset.type ??
          'image/jpeg',

        fileName:
          asset.fileName ??
          `profile-${Date.now()}.jpg`,
      };

      setSelectedProfileImage(
        imageData,
      );

      /*
       * Persist photo locally because
       * supplied edit API has no image field.
       */

      await AsyncStorage.setItem(
        PROFILE_IMAGE_STORAGE_KEY,
        JSON.stringify(
          imageData,
        ),
      );
    };

  const takePhoto =
    async () => {
      if (
        selectingPhoto
      ) {
        return;
      }

      try {
        setSelectingPhoto(
          true,
        );

        const allowed =
          await requestCameraPermission();

        if (!allowed) {
          Alert.alert(
            'Permission Required',
            'Camera permission is required.',
          );

          return;
        }

        setPhotoOptionVisible(
          false,
        );

        const response =
          await launchCamera({
            mediaType:
              'photo',

            cameraType:
              'front',

            quality:
              0.8,

            saveToPhotos:
              false,
          });

        await saveSelectedImage(
          response,
        );
      } finally {
        setSelectingPhoto(
          false,
        );
      }
    };

  const chooseGallery =
    async () => {
      if (
        selectingPhoto
      ) {
        return;
      }

      try {
        setSelectingPhoto(
          true,
        );

        setPhotoOptionVisible(
          false,
        );

        const response =
          await launchImageLibrary({
            mediaType:
              'photo',

            selectionLimit:
              1,

            quality:
              0.8,
          });

        await saveSelectedImage(
          response,
        );
      } catch (
        galleryError
      ) {
        Alert.alert(
          'Gallery Error',
          galleryError?.message ??
            'Unable to open gallery.',
        );
      } finally {
        setSelectingPhoto(
          false,
        );
      }
    };

  /* =======================================================
   * LOGOUT
   * ======================================================= */

  const performLogout =
    async () => {
      try {
        setLogoutLoading(
          true,
        );

        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (token) {
          await fetch(
            LOGOUT_API_URL,
            {
              method:
                'POST',

              headers: {
                Accept:
                  'application/json',

                Authorization:
                  `Bearer ${token}`,
              },
            },
          );
        }
      } catch (
        logoutError
      ) {
        console.log(
          'LOGOUT ERROR:',
          logoutError,
        );
      } finally {
        await removeFcmToken();

        await AsyncStorage.removeItem(
          'token',
        );

        await AsyncStorage.removeItem(
          'user',
        );

        setLogoutLoading(
          false,
        );

        setLogoutPopupVisible(
          false,
        );

        navigation.reset({
          index:
            0,

          routes: [
            {
              name:
                'Login',
            },
          ],
        });
      }
    };

  /* =======================================================
   * DISPLAY
   * ======================================================= */

  const displayFirstName =
    profile?.first_name ??
    '';

  const displayLastName =
    profile?.last_name ??
    '';

  const userName =
    `${displayFirstName} ${displayLastName}`.trim() ||
    profile?.name ||
    'Customer';

  const userEmail =
    profile?.email ??
    'No email';

  const userPhone =
    profile?.phone ??
    'Not provided';

  const defaultAddress =
    localAddresses.find(
      item =>
        item.isDefault,
    ) ??
    localAddresses[0];

  const userAddress =
    defaultAddress
      ? addressToFullLine(
          defaultAddress,
        )
      : (
          typeof profile?.address ===
            'string'
            ? profile.address
            : 'No address available'
        );

  const userPincode =
    defaultAddress?.postcode ??
    defaultAddress?.pincode ??
    profile?.pincode ??
    '';

  const serverImage =
    profile?.profile_image ??
    profile?.image ??
    profile?.avatar ??
    null;

  const profileImageSource =
    selectedProfileImage?.uri
      ? {
          uri:
            selectedProfileImage.uri,
        }
      : serverImage
        ? {
            uri:
              serverImage,
          }
        : require('../assets/user-profile.jpg');

  /* =======================================================
   * LOADING
   * ======================================================= */

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.center
          }
        >
          <ActivityIndicator
            size="large"
            color="#A00B0F"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading Profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFF9F6"
        />

        <View
          style={[
            styles.screen,

            {
              width:
                responsive.contentWidth,
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={[
              styles.scroll,

              {
                paddingHorizontal:
                  responsive.padding,
              },
            ]}
          >
            {/* HEADER */}

            <View
              style={
                styles.header
              }
            >
              <Pressable
                style={
                  styles.backButton
                }
                onPress={() =>
                  navigation.canGoBack()
                    ? navigation.goBack()
                    : navigation.navigate(
                        'Home',
                      )
                }
              >
                <Image
                  source={require('../assets/login-icons/back.png')}
                  style={
                    styles.icon
                  }
                />
              </Pressable>

              <View>
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  MY ACCOUNT
                </Text>

                <Text
                  style={
                    styles.title
                  }
                >
                  Profile
                </Text>
              </View>
            </View>

            {/* PROFILE CARD */}

            <View
              style={
                styles.profileCard
              }
            >
              <View>
                <Image
                  source={
                    profileImageSource
                  }
                  style={{
                    width:
                      responsive.avatarSize,

                    height:
                      responsive.avatarSize,

                    borderRadius:
                      responsive.avatarSize /
                      2,
                  }}
                />

                <TouchableOpacity
                  style={
                    styles.cameraButton
                  }
                  onPress={() =>
                    setPhotoOptionVisible(
                      true,
                    )
                  }
                >
                  <Image
                    source={require('../assets/login-icons/camera.png')}
                    style={
                      styles.cameraIcon
                    }
                  />
                </TouchableOpacity>
              </View>

              <View
                style={
                  styles.profileText
                }
              >
                <Text
                  style={
                    styles.name
                  }
                >
                  {userName}
                </Text>

                <Text
                  style={
                    styles.email
                  }
                >
                  {userEmail}
                </Text>

                <Text
                  style={
                    styles.phone
                  }
                >
                  {userPhone}
                </Text>
              </View>

              <TouchableOpacity
                style={
                  styles.editButton
                }
                onPress={
                  populateEditForm
                }
              >
                <Image
                  source={require('../assets/login-icons/edit.png')}
                  style={
                    styles.icon
                  }
                />
              </TouchableOpacity>
            </View>

             {/* ORDERS */}

            <Section
              title="Orders"
            >
              <MenuRow
                title="Your Orders"
                subtitle="View your previous tiffin orders"
                image={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                onPress={() =>
                  navigation.navigate(
                    'PreviousOrder',
                  )
                }
              />
            </Section>

            {/* DETAILS */}

            <Section
              title="Personal Details"
            >
              <InfoRow
                label="Full Name"
                value={
                  userName
                }
              />

              <InfoRow
                label="Email Address"
                value={
                  userEmail
                }
              />

              <InfoRow
                label="Mobile Number"
                value={
                  userPhone
                }
              />
            </Section>

            {/* ADDRESS */}

            <Section
              title="Delivery Addresses"
              rightText="Manage"
              onRightPress={() =>
                navigation.navigate(
                  'AddressList',
                )
              }
            >
              <TouchableOpacity
                style={
                  styles.addressCard
                }
                onPress={() =>
                  navigation.navigate(
                    'AddressList',
                  )
                }
              >
                <Image
                  source={require('../assets/login-icons/home-1.png')}
                  style={
                    styles.addressIcon
                  }
                />

                <View
                  style={{
                    flex:
                      1,
                  }}
                >
                  <View
                    style={
                      styles.addressTitleRow
                    }
                  >
                    <Text
                      style={
                        styles.addressType
                      }
                    >
                      {defaultAddress?.type ??
                        'Home'}
                    </Text>

                    <View
                      style={
                        styles.defaultBadge
                      }
                    >
                      <Text
                        style={
                          styles.defaultText
                        }
                      >
                        Default
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.addressText
                    }
                  >
                    {userAddress}
                  </Text>

                  {!!userPincode && (
                    <Text
                      style={
                        styles.addressText
                      }
                    >
                      {userPincode}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </Section>

            {/* PAYMENT */}

            <Section
              title="Payment & Billing"
            >
              <MenuRow
                title="Payment Details"
                subtitle="View current weekly total"
                image={require('../assets/login-icons/wallet.png')}
                onPress={() =>
                  navigation.navigate(
                    'PaymentDetails',
                  )
                }
              />

              <MenuRow
                title="Invoices"
                subtitle="View generated weekly invoices"
                image={require('../assets/login-icons/invoice.png')}
                onPress={() =>
                  navigation.navigate(
                    'WeeklyInvoice',
                  )
                }
              />
            </Section>

           

            {/* LOGOUT */}

            <TouchableOpacity
              style={
                styles.logoutButton
              }
              onPress={() =>
                setLogoutPopupVisible(
                  true,
                )
              }
            >
              <Image
                source={require('../assets/login-icons/logout-light.png')}
                style={
                  styles.logoutIcon
                }
              />

              <Text
                style={
                  styles.logoutText
                }
              >
                Log Out
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* ================================================= */}
      {/* PHOTO MODAL */}
      {/* ================================================= */}

      <Modal
        visible={
          photoOptionVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPhotoOptionVisible(
            false,
          )
        }
      >
        <Pressable
          style={
            styles.overlay
          }
          onPress={() =>
            setPhotoOptionVisible(
              false,
            )
          }
        >
          <Pressable
            style={
              styles.photoModal
            }
            onPress={() => {}}
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Profile Photo
            </Text>

            <TouchableOpacity
              style={
                styles.photoOption
              }
              onPress={
                takePhoto
              }
            >
              <Image
                source={require('../assets/login-icons/camera.png')}
                style={
                  styles.photoIcon
                }
              />

              <Text
                style={
                  styles.photoOptionText
                }
              >
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.photoOption
              }
              onPress={
                chooseGallery
              }
            >
              <Text
                style={
                  styles.galleryEmoji
                }
              >
                ▣
              </Text>

              <Text
                style={
                  styles.photoOptionText
                }
              >
                Choose from Gallery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.cancelModalButton
              }
              onPress={() =>
                setPhotoOptionVisible(
                  false,
                )
              }
            >
              <Text
                style={
                  styles.cancelModalText
                }
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================================================= */}
      {/* EDIT PROFILE */}
      {/* ================================================= */}

      <Modal
        visible={
          editProfileVisible
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setEditProfileVisible(
            false,
          )
        }
      >
        <View
          style={
            styles.editOverlay
          }
        >
          <SafeAreaView
            style={
              styles.editSafeArea
            }
          >
            <View
              style={
                styles.editContainer
              }
            >
              <View
                style={
                  styles.editHeader
                }
              >
                <TouchableOpacity
                  style={
                    styles.closeButton
                  }
                  onPress={() =>
                    setEditProfileVisible(
                      false,
                    )
                  }
                >
                  <Text
                    style={
                      styles.closeText
                    }
                  >
                    ×
                  </Text>
                </TouchableOpacity>

                <View>
                  <Text
                    style={
                      styles.eyebrow
                    }
                  >
                    ACCOUNT SETTINGS
                  </Text>

                  <Text
                    style={
                      styles.editHeaderTitle
                    }
                  >
                    Edit Profile
                  </Text>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={
                  false
                }
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={
                  styles.editScroll
                }
              >
                <EditInput
                  label="First Name"
                  value={
                    firstName
                  }
                  onChangeText={
                    setFirstName
                  }
                />

                <EditInput
                  label="Last Name"
                  value={
                    lastName
                  }
                  onChangeText={
                    setLastName
                  }
                />

                <EditInput
                  label="Phone"
                  value={
                    phone
                  }
                  onChangeText={
                    setPhone
                  }
                  keyboardType="phone-pad"
                />

                <EditInput
                  label="Email"
                  value={
                    email
                  }
                  onChangeText={
                    setEmail
                  }
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <View
                  style={
                    styles.addressEditHeader
                  }
                >
                  <Text
                    style={
                      styles.sectionHeading
                    }
                  >
                    Addresses
                  </Text>

                  <TouchableOpacity
                    style={
                      styles.addSmallButton
                    }
                    onPress={
                      addAddressInProfile
                    }
                  >
                    <Text
                      style={
                        styles.addSmallText
                      }
                    >
                      + Add Address
                    </Text>
                  </TouchableOpacity>
                </View>

                {editAddresses.map(
                  (
                    address,
                    index,
                  ) => (
                    <View
                      key={
                        String(
                          address.id ??
                            index,
                        )
                      }
                      style={
                        styles.editAddressCard
                      }
                    >
                      <View
                        style={
                          styles.editAddressTop
                        }
                      >
                        <Text
                          style={
                            styles.editAddressTitle
                          }
                        >
                          Address {index + 1}
                        </Text>

                        {editAddresses.length >
                          1 && (
                          <TouchableOpacity
                            onPress={() =>
                              removeAddressInProfile(
                                index,
                              )
                            }
                          >
                            <Text
                              style={
                                styles.removeText
                              }
                            >
                              Remove
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <EditInput
                        label="Type"
                        value={
                          address.type
                        }
                        onChangeText={value =>
                          updateAddressField(
                            index,
                            'type',
                            value,
                          )
                        }
                      />

                      <EditInput
                        label="Address"
                        value={
                          address.address_line
                        }
                        onChangeText={value =>
                          updateAddressField(
                            index,
                            'address_line',
                            value,
                          )
                        }
                        multiline
                      />

                      <EditInput
                        label="Pincode"
                        value={
                          address.pincode
                        }
                        onChangeText={value =>
                          updateAddressField(
                            index,
                            'pincode',
                            value,
                          )
                        }
                        keyboardType="number-pad"
                      />

                      <View
                        style={
                          styles.defaultRow
                        }
                      >
                        <Text
                          style={
                            styles.defaultRowText
                          }
                        >
                          Default Address
                        </Text>

                        <Switch
                          value={
                            address.is_default
                          }
                          onValueChange={() =>
                            setDefaultAddress(
                              index,
                            )
                          }
                        />
                      </View>
                    </View>
                  ),
                )}

                <Text
                  style={
                    styles.sectionHeading
                  }
                >
                  Change Password
                </Text>

                <PasswordInput
                  label="Current Password"
                  value={
                    oldPassword
                  }
                  onChangeText={
                    setOldPassword
                  }
                  visible={
                    showOldPassword
                  }
                  onToggle={() =>
                    setShowOldPassword(
                      value =>
                        !value,
                    )
                  }
                />

                <PasswordInput
                  label="New Password"
                  value={
                    newPassword
                  }
                  onChangeText={
                    setNewPassword
                  }
                  visible={
                    showNewPassword
                  }
                  onToggle={() =>
                    setShowNewPassword(
                      value =>
                        !value,
                    )
                  }
                />

                <PasswordInput
                  label="Confirm Password"
                  value={
                    confirmPassword
                  }
                  onChangeText={
                    setConfirmPassword
                  }
                  visible={
                    showConfirmPassword
                  }
                  onToggle={() =>
                    setShowConfirmPassword(
                      value =>
                        !value,
                    )
                  }
                />

                <TouchableOpacity
                  style={[
                    styles.saveButton,

                    updatingProfile && {
                      opacity:
                        0.6,
                    },
                  ]}
                  disabled={
                    updatingProfile
                  }
                  onPress={
                    handleUpdateProfile
                  }
                >
                  {updatingProfile ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.saveText
                      }
                    >
                      Save Changes
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* SUCCESS */}

      <Modal
        visible={
          updateSuccessVisible
        }
        transparent
        animationType="fade"
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={
              styles.successModal
            }
          >
            <Text
              style={
                styles.successIcon
              }
            >
              ✓
            </Text>

            <Text
              style={
                styles.modalTitle
              }
            >
              Profile Updated
            </Text>

            <Text
              style={
                styles.modalDescription
              }
            >
              Your details and addresses have been updated successfully.
            </Text>

            <TouchableOpacity
              style={
                styles.saveButton
              }
              onPress={() =>
                setUpdateSuccessVisible(
                  false,
                )
              }
            >
              <Text
                style={
                  styles.saveText
                }
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* LOGOUT */}

      <Modal
        visible={
          logoutPopupVisible
        }
        transparent
        animationType="fade"
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={
              styles.successModal
            }
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Log Out?
            </Text>

            <Text
              style={
                styles.modalDescription
              }
            >
              Are you sure you want to log out?
            </Text>

            <View
              style={
                styles.modalActions
              }
            >
              <TouchableOpacity
                style={
                  styles.modalCancel
                }
                onPress={() =>
                  setLogoutPopupVisible(
                    false,
                  )
                }
              >
                <Text>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.modalLogout
                }
                onPress={
                  performLogout
                }
              >
                {logoutLoading ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.saveText
                    }
                  >
                    Log Out
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

/* =========================================================
 * COMPONENTS
 * ========================================================= */

const Section = ({
  title,
  children,
  rightText,
  onRightPress,
}) => (
  <View
    style={
      styles.section
    }
  >
    <View
      style={
        styles.sectionTitleRow
      }
    >
      <Text
        style={
          styles.sectionHeading
        }
      >
        {title}
      </Text>

      {!!rightText && (
        <TouchableOpacity
          onPress={
            onRightPress
          }
        >
          <Text
            style={
              styles.manageText
            }
          >
            {rightText}
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {children}
  </View>
);

const InfoRow = ({
  label,
  value,
}) => (
  <View
    style={
      styles.infoRow
    }
  >
    <Text
      style={
        styles.infoLabel
      }
    >
      {label}
    </Text>

    <Text
      style={
        styles.infoValue
      }
    >
      {value}
    </Text>
  </View>
);

const MenuRow = ({
  title,
  subtitle,
  image,
  onPress,
}) => (
  <TouchableOpacity
    style={
      styles.menuRow
    }
    onPress={
      onPress
    }
  >
    <View
      style={
        styles.menuIconBox
      }
    >
      <Image
        source={
          image
        }
        style={
          styles.icon
        }
      />
    </View>

    <View
      style={{
        flex:
          1,
      }}
    >
      <Text
        style={
          styles.menuTitle
        }
      >
        {title}
      </Text>

      <Text
        style={
          styles.menuSubtitle
        }
      >
        {subtitle}
      </Text>
    </View>

    <Image
      source={require('../assets/login-icons/next.png')}
      style={
        styles.arrow
      }
    />
  </TouchableOpacity>
);

const EditInput = ({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
}) => (
  <View
    style={
      styles.field
    }
  >
    <Text
      style={
        styles.fieldLabel
      }
    >
      {label}
    </Text>

    <TextInput
      value={
        value
      }
      onChangeText={
        onChangeText
      }
      keyboardType={
        keyboardType
      }
      autoCapitalize={
        autoCapitalize
      }
      multiline={
        multiline
      }
      textAlignVertical={
        multiline
          ? 'top'
          : 'center'
      }
      style={[
        styles.input,

        multiline && {
          minHeight:
            80,
        },
      ]}
    />
  </View>
);

const PasswordInput = ({
  label,
  value,
  onChangeText,
  visible,
  onToggle,
}) => (
  <View
    style={
      styles.field
    }
  >
    <Text
      style={
        styles.fieldLabel
      }
    >
      {label}
    </Text>

    <View
      style={
        styles.passwordWrap
      }
    >
      <TextInput
        value={
          value
        }
        onChangeText={
          onChangeText
        }
        secureTextEntry={
          !visible
        }
        style={
          styles.passwordInput
        }
      />

      <TouchableOpacity
        onPress={
          onToggle
        }
      >
        <Text
          style={
            styles.showText
          }
        >
          {visible
            ? 'HIDE'
            : 'SHOW'}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default Profile;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        '#FFF9F6',
    },

    screen: {
      flex:
        1,

      alignSelf:
        'center',
    },

    scroll: {
      paddingTop:
        10,

      paddingBottom:
        110,
    },

    center: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    loadingText: {
      marginTop:
        10,

      fontWeight:
        '700',
    },

    header: {
      flexDirection:
        'row',

      alignItems:
        'center',

      marginBottom:
        14,
    },

    backButton: {
      width:
        42,

      height:
        42,

      borderRadius:
        12,

      backgroundColor:
        '#FFFFFF',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        12,

      borderWidth:
        1,

      borderColor:
        '#EEE5E1',
    },

    icon: {
      width:
        20,

      height:
        20,

      resizeMode:
        'contain',
    },

    eyebrow: {
      fontSize:
        8,

      color:
        '#A00B0F',

      fontWeight:
        '900',

      letterSpacing:
        1,
    },

    title: {
      fontSize:
        23,

      fontWeight:
        '900',

      color:
        '#2B201B',
    },

    profileCard: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        18,

      padding:
        14,

      borderWidth:
        1,

      borderColor:
        '#EEE5E1',

      marginBottom:
        14,
    },

    cameraButton: {
      position:
        'absolute',

      right:
        -6,

      bottom:
        -5,

      width:
        35,

      height:
        35,

      borderRadius:
        18,

      backgroundColor:
        '#A00B0F',

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth:
        3,

      borderColor:
        '#FFFFFF',
    },

    cameraIcon: {
      width:
        17,

      height:
        17,

      tintColor:
        '#FFFFFF',
    },

    profileText: {
      flex:
        1,

      marginLeft:
        15,
    },

    name: {
      fontSize:
        17,

      fontWeight:
        '900',

      color:
        '#2D211C',
    },

    email: {
      fontSize:
        9,

      color:
        '#8E817B',

      marginTop:
        4,
    },

    phone: {
      fontSize:
        8,

      color:
        '#A00B0F',

      marginTop:
        3,
    },

    editButton: {
      width:
        38,

      height:
        38,

      borderRadius:
        12,

      backgroundColor:
        '#FFF0F0',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    section: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        16,

      borderWidth:
        1,

      borderColor:
        '#EEE5E1',

      padding:
        13,

      marginBottom:
        14,
    },

    sectionTitleRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      marginBottom:
        8,
    },

    sectionHeading: {
      fontSize:
        15,

      fontWeight:
        '900',

      color:
        '#332721',

      marginVertical:
        8,
    },

    manageText: {
      color:
        '#A00B0F',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    infoRow: {
      minHeight:
        48,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#F2ECE9',
    },

    infoLabel: {
      color:
        '#8C7C76',

      fontSize:
        9,
    },

    infoValue: {
      color:
        '#3A2D28',

      fontSize:
        9,

      fontWeight:
        '700',
    },

    addressCard: {
      flexDirection:
        'row',

      alignItems:
        'center',

      padding:
        11,

      backgroundColor:
        '#FFF9F6',

      borderRadius:
        13,
    },

    addressIcon: {
      width:
        28,

      height:
        28,

      marginRight:
        10,

      resizeMode:
        'contain',
    },

    addressTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    addressType: {
      fontSize:
        10,

      fontWeight:
        '900',
    },

    defaultBadge: {
      backgroundColor:
        '#FBE2E2',

      marginLeft:
        7,

      borderRadius:
        8,

      paddingHorizontal:
        6,

      paddingVertical:
        2,
    },

    defaultText: {
      color:
        '#A00B0F',

      fontSize:
        6,

      fontWeight:
        '900',
    },

    addressText: {
      color:
        '#867871',

      fontSize:
        8,

      lineHeight:
        12,

      marginTop:
        3,
    },

    menuRow: {
      minHeight:
        62,

      flexDirection:
        'row',

      alignItems:
        'center',

      padding:
        10,

      backgroundColor:
        '#FFF9F6',

      borderRadius:
        12,

      marginBottom:
        9,
    },

    menuIconBox: {
      width:
        40,

      height:
        40,

      borderRadius:
        11,

      backgroundColor:
        '#FFF0EA',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        10,
    },

    menuTitle: {
      fontSize:
        10,

      fontWeight:
        '900',
    },

    menuSubtitle: {
      fontSize:
        8,

      color:
        '#92837C',

      marginTop:
        3,
    },

    arrow: {
      width:
        17,

      height:
        17,

      opacity:
        0.6,
    },

    logoutButton: {
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

    logoutIcon: {
      width:
        18,

      height:
        18,
    },

    logoutText: {
      color:
        '#FFFFFF',

      fontWeight:
        '900',

      marginLeft:
        8,
    },

    overlay: {
      flex:
        1,

      backgroundColor:
        'rgba(0,0,0,0.60)',

      alignItems:
        'center',

      justifyContent:
        'center',

      padding:
        20,
    },

    photoModal: {
      width:
        '100%',

      maxWidth:
        380,

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        22,

      padding:
        20,
    },

    modalTitle: {
      fontSize:
        19,

      fontWeight:
        '900',

      textAlign:
        'center',

      color:
        '#2D211C',
    },

    modalDescription: {
      color:
        '#82736D',

      fontSize:
        9,

      textAlign:
        'center',

      marginTop:
        7,
    },

    photoOption: {
      minHeight:
        54,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF9F6',

      borderRadius:
        12,

      paddingHorizontal:
        12,

      marginTop:
        10,
    },

    photoIcon: {
      width:
        22,

      height:
        22,

      tintColor:
        '#A00B0F',

      marginRight:
        10,
    },

    galleryEmoji: {
      color:
        '#A00B0F',

      fontSize:
        22,

      marginRight:
        10,
    },

    photoOptionText: {
      fontWeight:
        '800',
    },

    cancelModalButton: {
      minHeight:
        46,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        12,

      backgroundColor:
        '#F5F1EF',

      borderRadius:
        12,
    },

    cancelModalText: {
      fontWeight:
        '800',
    },

    editOverlay: {
      flex:
        1,

      justifyContent:
        'flex-end',

      backgroundColor:
        'rgba(0,0,0,0.60)',
    },

    editSafeArea: {
      flex:
        1,

      justifyContent:
        'flex-end',

      backgroundColor:
        'transparent',
    },

    editContainer: {
      height:
        '94%',

      backgroundColor:
        '#FFF9F6',

      borderTopLeftRadius:
        26,

      borderTopRightRadius:
        26,

      overflow:
        'hidden',
    },

    editHeader: {
      minHeight:
        70,

      backgroundColor:
        '#FFFFFF',

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        14,

      borderBottomWidth:
        1,

      borderBottomColor:
        '#EEE5E1',
    },

    closeButton: {
      width:
        40,

      height:
        40,

      borderRadius:
        12,

      backgroundColor:
        '#F6F2F0',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        12,
    },

    closeText: {
      fontSize:
        24,

      color:
        '#6E625D',
    },

    editHeaderTitle: {
      fontSize:
        19,

      fontWeight:
        '900',
    },

    editScroll: {
      padding:
        14,

      paddingBottom:
        50,
    },

    field: {
      marginBottom:
        12,
    },

    fieldLabel: {
      color:
        '#574943',

      fontSize:
        9,

      fontWeight:
        '800',

      marginBottom:
        6,
    },

    input: {
      minHeight:
        47,

      borderRadius:
        11,

      borderWidth:
        1,

      borderColor:
        '#EAE1DD',

      backgroundColor:
        '#FFFFFF',

      paddingHorizontal:
        11,

      fontSize:
        10,
    },

    passwordWrap: {
      minHeight:
        47,

      borderWidth:
        1,

      borderColor:
        '#EAE1DD',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingRight:
        12,
    },

    passwordInput: {
      flex:
        1,

      paddingHorizontal:
        11,
    },

    showText: {
      color:
        '#A00B0F',

      fontSize:
        7,

      fontWeight:
        '900',
    },

    addressEditHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    addSmallButton: {
      paddingHorizontal:
        10,

      paddingVertical:
        8,

      borderRadius:
        9,

      backgroundColor:
        '#FFF0F0',
    },

    addSmallText: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '900',
    },

    editAddressCard: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        14,

      borderWidth:
        1,

      borderColor:
        '#EEE5E1',

      padding:
        12,

      marginBottom:
        12,
    },

    editAddressTop: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    editAddressTitle: {
      fontWeight:
        '900',
    },

    removeText: {
      color:
        '#D34444',

      fontSize:
        8,

      fontWeight:
        '900',
    },

    defaultRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',
    },

    defaultRowText: {
      fontWeight:
        '800',

      fontSize:
        9,
    },

    saveButton: {
      minHeight:
        50,

      backgroundColor:
        '#A00B0F',

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        15,
    },

    saveText: {
      color:
        '#FFFFFF',

      fontWeight:
        '900',
    },

    successModal: {
      width:
        '100%',

      maxWidth:
        360,

      borderRadius:
        22,

      backgroundColor:
        '#FFFFFF',

      padding:
        22,
    },

    successIcon: {
      width:
        65,

      height:
        65,

      lineHeight:
        65,

      borderRadius:
        33,

      alignSelf:
        'center',

      textAlign:
        'center',

      backgroundColor:
        '#2F975D',

      color:
        '#FFFFFF',

      fontSize:
        30,

      fontWeight:
        '900',

      marginBottom:
        12,
    },

    modalActions: {
      flexDirection:
        'row',

      marginTop:
        15,
    },

    modalCancel: {
      flex:
        1,

      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F5F1EF',

      borderRadius:
        11,

      marginRight:
        5,
    },

    modalLogout: {
      flex:
        1,

      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        11,

      marginLeft:
        5,
    },
  });