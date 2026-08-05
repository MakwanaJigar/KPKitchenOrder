import React, {useMemo, useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ionicons from 'react-native-vector-icons/Ionicons';

const Profile = ({navigation}) => {
  const {width} = useWindowDimensions();

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(true);

  const [autoRenewEnabled, setAutoRenewEnabled] =
    useState(false);

  const responsive = useMemo(() => {
    const isTablet = width >= 768;

    return {
      isTablet,
      contentWidth: isTablet ? Math.min(width - 80, 720) : width,
      horizontalPadding: isTablet ? 28 : 14,
      avatarSize: isTablet ? 105 : 82,
    };
  }, [width]);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{name: 'Login'}],
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF9F6"
      />

      <View
        style={[
          styles.screenContainer,
          {
            width: responsive.contentWidth,
          },
        ]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal:
                responsive.horizontalPadding,
            },
          ]}>
          {/* Header */}

          <View style={styles.header}>
            <View>
              <Text style={styles.headerEyebrow}>
                MY ACCOUNT
              </Text>

              <Text style={styles.headerTitle}>
                Profile
              </Text>
            </View>

            <Pressable
              hitSlop={10}
              style={styles.notificationButton}
              onPress={() =>
                navigation.navigate('Notifications')
              }>
                <Image
                source={require('../assets/login-icons/notification.png')}
                style={styles.passwordEyes}
              />
              {/* <Ionicons
                name="notifications-outline"
                size={20}
                color="#B54F24"
              /> */}

              <View style={styles.notificationDot} />
            </Pressable>
          </View>

          {/* Profile information */}

          <View style={styles.profileSection}>
            <View>
              <Image
                source={require('../assets/user-profile.jpg')}
                style={[
                  styles.profileImage,
                  {
                    width: responsive.avatarSize,
                    height: responsive.avatarSize,
                    borderRadius:
                      responsive.avatarSize / 2,
                  },
                ]}
                resizeMode="cover"
              />

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.cameraButton}
                onPress={() =>
                  console.log('Change photo pressed')
                }>
                     <Image
                source={require('../assets/login-icons/camera.png')}
                style={styles.passwordEyes}
              />
              </TouchableOpacity>
            </View>

            <View style={styles.profileDetails}>
              <Text
                numberOfLines={1}
                style={styles.userName}>
                Julian Henderson
              </Text>

              <Text
                numberOfLines={1}
                style={styles.userEmail}>
                julianhenderson@example.com
              </Text>
            </View>

            <Pressable
              hitSlop={10}
              style={styles.editProfileButton}
              onPress={() =>
                navigation.navigate('EditProfile')
              }>
                 <Image
                source={require('../assets/login-icons/edit.png')}
                style={styles.passwordEyes}
              />
              {/* <Ionicons
                name="create-outline"
                size={17}
                color="#B54F24"
              /> */}
            </Pressable>
          </View>

          {/* Personal details */}

          <SectionCard
            title="Personal Details"
            icon="person-outline">
            <ProfileInformationRow
              label="Full Name"
              value="Julian Henderson"
            />

            <ProfileInformationRow
              label="Email Address"
              value="julianhenderson@example.com"
            />

            <ProfileInformationRow
              label="Mobile Number"
              value="+61 400 000 000"
            />

            <ProfileInformationRow
              label="Dietary Preference"
              value="Standard"
              showBorder={false}
            />
          </SectionCard>

          {/* Subscription */}

          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionTopRow}>
              <View style={styles.subscriptionIconContainer}>
                {/* <Ionicons
                  name="restaurant"
                  size={21}
                  color="#FFFFFF"
                /> */}
                <Image
                source={require('../assets/login-icons/credit-card.png')}
                style={styles.passwordEyes}
              />
              </View>

              <View style={styles.subscriptionHeading}>
                <Text style={styles.subscriptionLabel}>
                  ACTIVE SUBSCRIPTION
                </Text>

                <Text style={styles.subscriptionTitle}>
                  Weekly Meal Plan
                </Text>
              </View>

              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>
                  Active
                </Text>
              </View>
            </View>

            <View style={styles.subscriptionInformation}>
              <View style={styles.subscriptionColumn}>
                <Text style={styles.subscriptionInfoLabel}>
                  Next Billing
                </Text>

                <Text style={styles.subscriptionInfoValue}>
                  05 Aug 2026
                </Text>
              </View>

              <View style={styles.subscriptionDivider} />

              <View style={styles.subscriptionColumn}>
                <Text style={styles.subscriptionInfoLabel}>
                  Weekly Total
                </Text>

                <Text style={styles.subscriptionInfoValue}>
                  $75.00
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.managePlanButton}
              onPress={() =>
                navigation.navigate('Subscription')
              }>
              <Text style={styles.managePlanText}>
                Manage Plan
              </Text>
            </TouchableOpacity>
          </View>

          {/* Delivery addresses */}

          <SectionCard
            title="Delivery Addresses"
            icon="location-outline"
            rightText="Manage"
            onRightPress={() =>
              navigation.navigate('Address')
            }>
            <Pressable
              style={styles.addressContainer}
              onPress={() =>
                navigation.navigate('Address')
              }>
              <View style={styles.addressIconContainer}>
                <Image
                source={require('../assets/login-icons/home.png')}
                style={styles.passwordEyes}
              />
              </View>

              <View style={styles.addressDetails}>
                <View style={styles.addressTitleRow}>
                  <Text style={styles.addressTitle}>
                    Home
                  </Text>

                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>
                      Default
                    </Text>
                  </View>
                </View>

                <Text style={styles.addressText}>
                  123 Baker Street, Melbourne
                </Text>

                <Text style={styles.addressText}>
                  VIC 3000, Australia
                </Text>
              </View>

              <Image
                source={require('../assets/login-icons/location.png')}
                style={styles.passwordEyes}
              />
            </Pressable>
          </SectionCard>

          {/* Payment methods */}

          <SectionCard
            title="Payment Methods"
            icon="card-outline"
            rightText="Manage"
            onRightPress={() =>
              navigation.navigate('PaymentMethods')
            }>
            <Pressable
              style={styles.paymentContainer}
              onPress={() =>
                navigation.navigate('PaymentMethods')
              }>
              <View style={styles.paymentIconContainer}>
                <Image
                source={require('../assets/login-icons/payment-credit-card.png')}
                style={styles.passwordEyes}
              />
              </View>

              <View style={styles.paymentDetails}>
                <Text style={styles.paymentTitle}>
                  Visa ending in 4242
                </Text>

                <Text style={styles.paymentSubtitle}>
                  Expires 08/29
                </Text>
              </View>

              <View style={styles.defaultPaymentBadge}>
                <Text style={styles.defaultPaymentText}>
                  Default
                </Text>
              </View>
            </Pressable>
          </SectionCard>

          {/* Account preferences */}

          <SectionCard
            title="Account Preferences"
            icon="settings-outline">
            <PreferenceRow
              icon="notifications-outline"
              title="Push Notifications"
              subtitle="Receive order and delivery updates"
              showSwitch
              switchValue={notificationsEnabled}
              onSwitchChange={setNotificationsEnabled}
            />

            <PreferenceRow
              icon="repeat-outline"
              title="Auto-Renew Subscription"
              subtitle="Automatically renew your weekly plan"
              showSwitch
              switchValue={autoRenewEnabled}
              onSwitchChange={setAutoRenewEnabled}
            />

            {/* <PreferenceRow
              icon="language-outline"
              title="Language"
              subtitle="English"
              onPress={() =>
                navigation.navigate('Language')
              }
            /> */}

            {/* <PreferenceRow
              icon="shield-checkmark-outline"
              title="Privacy and Security"
              subtitle="Password and account security"
              onPress={() =>
                navigation.navigate('PrivacySecurity')
              }
              showBorder={false}
            /> */}
          </SectionCard>

          {/* Help and support */}

          {/* <SectionCard
            title="Help & Support"
            icon="help-circle-outline">
            <NavigationRow
              icon="chatbubble-ellipses-outline"
              title="Contact Support"
              onPress={() =>
                navigation.navigate('Support')
              }
            />

            <NavigationRow
              icon="document-text-outline"
              title="Terms and Conditions"
              onPress={() =>
                navigation.navigate('Terms')
              }
            />

            <NavigationRow
              icon="lock-closed-outline"
              title="Privacy Policy"
              onPress={() =>
                navigation.navigate('PrivacyPolicy')
              }
              showBorder={false}
            />
          </SectionCard> */}

          {/* Logout */}

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.logoutButton}
            onPress={handleLogout}>
            <Text style={styles.logoutText}>
              Log Out
            </Text>

          </TouchableOpacity>

          <Text style={styles.versionText}>
            App Version 1.0.0
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const SectionCard = ({
  title,
  children,
  rightText,
  onRightPress,
}) => {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderTitle}>
          <Text style={styles.sectionTitle}>
            {title}
          </Text>
        </View>

        {rightText ? (
          <Pressable
            hitSlop={10}
            onPress={onRightPress}>
            <Text style={styles.sectionRightText}>
              {rightText}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {children}
    </View>
  );
};

const ProfileInformationRow = ({
  label,
  value,
  showBorder = true,
}) => {
  return (
    <View
      style={[
        styles.informationRow,
        !showBorder && styles.noBorder,
      ]}>
      <Text style={styles.informationLabel}>
        {label}
      </Text>

      <Text
        numberOfLines={1}
        style={styles.informationValue}>
        {value}
      </Text>
    </View>
  );
};

const PreferenceRow = ({
  icon,
  title,
  subtitle,
  onPress,
  showSwitch = false,
  switchValue,
  onSwitchChange,
  showBorder = true,
}) => {
  const content = (
    <>

      <View style={styles.preferenceDetails}>
        <Text style={styles.preferenceTitle}>
          {title}
        </Text>

        <Text style={styles.preferenceSubtitle}>
          {subtitle}
        </Text>
      </View>

      {showSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{
            false: '#DDD7D2',
            true: '#E6A27E',
          }}
          thumbColor={
            switchValue ? '#B64D19' : '#FFFFFF'
          }
        />
      ) : (
        <Ionicons
          name="chevron-forward"
          size={17}
          color="#958C88"
        />
      )}
    </>
  );

  if (showSwitch) {
    return (
      <View
        style={[
          styles.preferenceRow,
          !showBorder && styles.noBorder,
        ]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      style={[
        styles.preferenceRow,
        !showBorder && styles.noBorder,
      ]}
      onPress={onPress}>
      {content}
    </Pressable>
  );
};

const NavigationRow = ({
  icon,
  title,
  onPress,
  showBorder = true,
}) => {
  return (
    <Pressable
      style={[
        styles.navigationRow,
        !showBorder && styles.noBorder,
      ]}
      onPress={onPress}>
      <View style={styles.navigationIcon}>
        <Ionicons
          name={icon}
          size={18}
          color="#B54F24"
        />
      </View>

      <Text style={styles.navigationTitle}>
        {title}
      </Text>

      <Ionicons
        name="chevron-forward"
        size={17}
        color="#958C88"
      />
    </Pressable>
  );
};

export default Profile;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F0ED',
  },

  screenContainer: {
    flex: 1,
    alignSelf: 'center',
    backgroundColor: '#FFF9F6',
  },

  scrollContent: {
    paddingTop: 12,
    paddingBottom: 120,
  },

  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  headerEyebrow: {
    color: '#A84B20',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  headerTitle: {
    color: '#231815',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },

  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE5E0',
    borderRadius: 14,
  },

  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 6,
    height: 6,
    backgroundColor: '#A84B20',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 3,
  },

  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE5E0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 13,

    shadowColor: '#583829',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,

    elevation: 2,
  },

  profileImage: {
    backgroundColor: '#E8DDD7',
  },

  cameraButton: {
    position: 'absolute',
    right: -8,
    bottom: -10,
    width: 37,
    height: 37,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    // borderWidth: 2,
    // borderColor: '#FFFFFF',
    borderRadius: 50,
  },

  profileDetails: {
    flex: 1,
    marginLeft: 13,
    paddingRight: 8,
  },

  userName: {
    color: '#221714',
    fontSize: 17,
    fontWeight: '900',
  },

  userEmail: {
    color: '#8B7770',
    fontSize: 10,
    marginTop: 4,
  },

  membershipBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0E7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
  },

  membershipText: {
    color: '#A00B0F',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 4,
  },

  editProfileButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1E9',
    borderRadius: 12,
  },

  sectionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE5E0',
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 3,
    marginBottom: 13,

    shadowColor: '#503328',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,

    elevation: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  sectionHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionTitle: {
    color: '#2B1D18',
    fontSize: 20,
    fontWeight: '800',
  },

  sectionRightText: {
    color: '#A84B20',
    fontSize: 10,
    fontWeight: '700',
  },

  informationRow: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8E4',
  },

  informationLabel: {
    flex: 0.42,
    color: '#8A7670',
    fontSize: 10,
  },

  informationValue: {
    flex: 0.58,
    color: '#32231E',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },

  noBorder: {
    borderBottomWidth: 0,
  },

  subscriptionCard: {
    width: '100%',
    backgroundColor: '#A00B0F',
    borderRadius: 18,
    padding: 14,
    marginBottom: 13,

    shadowColor: '#A00B0F',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.22,
    shadowRadius: 10,

    elevation: 5,
  },

  subscriptionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  subscriptionIconContainer: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 13,
  },

  subscriptionHeading: {
    flex: 1,
    marginLeft: 10,
  },

  subscriptionLabel: {
    color: '#FFE0D1',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
  },

  subscriptionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },

  activeBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  activeBadgeText: {
    color: '#A00B0F',
    fontSize: 8,
    fontWeight: '800',
  },

  subscriptionInformation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 13,
  },

  subscriptionColumn: {
    flex: 1,
    alignItems: 'center',
  },

  subscriptionInfoLabel: {
    color: '#FFD8C5',
    fontSize: 8,
  },

  subscriptionInfoValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },

  subscriptionDivider: {
    width: 1,
    height: 27,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  managePlanButton: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    marginTop: 11,
  },

  managePlanText: {
    color: '#A00B0F',
    fontSize: 11,
    fontWeight: '800',
    marginRight: 6,
  },

  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9F6',
    borderWidth: 1,
    borderColor: '#EFE4DE',
    borderRadius: 13,
    padding: 11,
    marginBottom: 11,
  },

  addressIconContainer: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#30241F',
    borderRadius: 12,
    marginRight: 10,
  },

  addressDetails: {
    flex: 1,
  },

  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  addressTitle: {
    color: '#2C201B',
    fontSize: 11,
    fontWeight: '800',
  },

  defaultBadge: {
    backgroundColor: '#FBE4D8',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 6,
  },

  defaultBadgeText: {
    color: '#A00B0F',
    fontSize: 7,
    fontWeight: '700',
  },

  addressText: {
    color: '#87766F',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 2,
  },

  paymentContainer: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9F6',
    borderWidth: 1,
    borderColor: '#EFE4DE',
    borderRadius: 13,
    padding: 10,
    marginBottom: 11,
  },

  paymentIconContainer: {
    width: 39,
    height: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D221D',
    borderRadius: 11,
    marginRight: 10,
  },

  paymentDetails: {
    flex: 1,
  },

  paymentTitle: {
    color: '#2D201B',
    fontSize: 11,
    fontWeight: '800',
  },

  paymentSubtitle: {
    color: '#897871',
    fontSize: 8,
    marginTop: 3,
  },

  defaultPaymentBadge: {
    backgroundColor: '#FBE4D8',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  defaultPaymentText: {
    color: '#A00B0F',
    fontSize: 7,
    fontWeight: '700',
  },

  preferenceRow: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8E4',
  },

  preferenceIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E8',
    borderRadius: 11,
    marginRight: 10,
  },

  preferenceDetails: {
    flex: 1,
    paddingRight: 8,
  },

  preferenceTitle: {
    color: '#30231E',
    fontSize: 10,
    fontWeight: '700',
  },

  preferenceSubtitle: {
    color: '#908079',
    fontSize: 8,
    marginTop: 3,
  },

  navigationRow: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8E4',
  },

  navigationIcon: {
    width: 35,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E8',
    borderRadius: 10,
    marginRight: 10,
  },

  navigationTitle: {
    flex: 1,
    color: '#30231E',
    fontSize: 10,
    fontWeight: '700',
  },

  logoutButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A00B0F',
    borderRadius: 14,
    marginBottom: 14,
  },

  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 7,
  },

  versionText: {
    color: '#AA9C96',
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 8,
  },
    passwordEyes: {
    width: 20,
    height: 20,
  },
});