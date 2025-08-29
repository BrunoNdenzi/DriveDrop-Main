import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ClientTabParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

type HomeScreenProps = NativeStackScreenProps<ClientTabParamList, 'Home'>;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { userProfile } = useAuth();

  const getUserInitial = () => {
    if (userProfile?.first_name) {
      return userProfile.first_name.charAt(0).toUpperCase();
    }
    return 'C';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleCreateShipment = () => {
    // Navigate to parent stack navigator to access CreateShipment screen
    navigation.getParent()?.navigate('CreateShipment');
  };

  const handleTrackShipment = () => {
    navigation.navigate('Shipments');
  };

  const quickStats = [
    {
      label: 'Active Shipments',
      value: '2',
      icon: 'local-shipping',
      color: Colors.primary,
    },
    {
      label: 'Completed',
      value: '12',
      icon: 'check-circle',
      color: Colors.success,
    },
    {
      label: 'This Month',
      value: '$2,450',
      icon: 'account-balance-wallet',
      color: Colors.secondary,
    },
  ];

  const quickActions = [
    {
      title: 'Track Shipment',
      icon: 'my-location',
      onPress: handleTrackShipment,
    },
    { title: 'Get Quote', icon: 'calculate', onPress: handleCreateShipment },
    { title: 'Support', icon: 'headset-mic', onPress: () => {} },
    {
      title: 'History',
      icon: 'history',
      onPress: () => navigation.navigate('Shipments'),
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getUserInitial()}</Text>
          </View>
          <View style={styles.greeting}>
            <Text style={styles.greetingText}>{getGreeting()},</Text>
            <Text style={styles.userName}>
              {userProfile?.first_name || 'Client'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.notificationButton}>
          <MaterialIcons
            name="notifications-none"
            size={24}
            color={Colors.text.primary}
          />
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner Card */}
        <Card variant="elevated" padding="lg" style={styles.bannerCard}>
          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTitle}>🚛 Need to ship a vehicle?</Text>
              <Text style={styles.bannerSubtitle}>
                Get instant quotes from trusted carriers
              </Text>
              <Button
                title="Get Quote Now"
                variant="primary"
                size="sm"
                onPress={handleCreateShipment}
                style={styles.bannerButton}
              />
            </View>
            <MaterialIcons
              name="directions-car"
              size={60}
              color={Colors.primary}
              style={styles.bannerIcon}
            />
          </View>
        </Card>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            {quickStats.map((stat, index) => (
              <Card
                key={index}
                variant="default"
                padding="base"
                style={styles.statCard}
              >
                <MaterialIcons
                  name={stat.icon as any}
                  size={24}
                  color={stat.color}
                />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </Card>
            ))}
          </View>
        </View>

        {/* Create Shipment CTA */}
        <Card variant="outlined" padding="lg" style={styles.ctaCard}>
          <View style={styles.ctaContent}>
            <MaterialIcons
              name="add-circle-outline"
              size={32}
              color={Colors.primary}
            />
            <Text style={styles.ctaTitle}>Create New Shipment</Text>
            <Text style={styles.ctaSubtitle}>
              Get quotes and book your vehicle transport
            </Text>
          </View>
          <Button
            title="Start Booking"
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleCreateShipment}
          />
        </Card>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <Card
                key={index}
                variant="default"
                padding="base"
                touchable
                onPress={action.onPress}
                style={styles.actionCard}
              >
                <MaterialIcons
                  name={action.icon as any}
                  size={28}
                  color={Colors.primary}
                />
                <Text style={styles.actionTitle}>{action.title}</Text>
              </Card>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Shipments')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <Card variant="default" padding="base" style={styles.activityCard}>
            <View style={styles.activityItem}>
              <MaterialIcons
                name="local-shipping"
                size={20}
                color={Colors.primary}
              />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>
                  Shipment #DR001 picked up
                </Text>
                <Text style={styles.activityTime}>2 hours ago</Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={Colors.text.secondary}
              />
            </View>
          </Card>
        </View>

        {/* Promotional Banner */}
        <Card variant="elevated" padding="lg" style={styles.promoCard}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>🎉 Special Offer</Text>
            <Text style={styles.promoSubtitle}>
              Get 15% off your next shipment with code DRIVE15
            </Text>
            <Button
              title="Learn More"
              variant="outline"
              size="sm"
              onPress={() => {}}
              style={styles.promoButton}
            />
          </View>
        </Card>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: Spacing[6],
    paddingHorizontal: Spacing[6],
    backgroundColor: Colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing[3],
  },
  avatarText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.inverse,
  },
  greeting: {
    flex: 1,
  },
  greetingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  userName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  notificationButton: {
    position: 'relative',
    padding: Spacing[2],
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing[6],
  },
  bannerCard: {
    marginTop: Spacing[6],
    backgroundColor: Colors.brand.primary[50],
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerLeft: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing[2],
  },
  bannerSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing[4],
  },
  bannerButton: {
    alignSelf: 'flex-start',
  },
  bannerIcon: {
    opacity: 0.7,
  },
  section: {
    marginTop: Spacing[8],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing[4],
  },
  viewAllText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing[1],
  },
  statValue: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginTop: Spacing[2],
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing[1],
  },
  ctaCard: {
    marginTop: Spacing[8],
    alignItems: 'center',
  },
  ctaContent: {
    alignItems: 'center',
    marginBottom: Spacing[6],
  },
  ctaTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginTop: Spacing[3],
    marginBottom: Spacing[2],
  },
  ctaSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  actionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginTop: Spacing[2],
    textAlign: 'center',
  },
  activityCard: {
    marginTop: Spacing[2],
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: Spacing[3],
  },
  activityTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
  },
  activityTime: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: Spacing[1],
  },
  promoCard: {
    marginTop: Spacing[8],
    backgroundColor: Colors.brand.secondary[50],
  },
  promoContent: {
    alignItems: 'center',
  },
  promoTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing[2],
  },
  promoSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing[4],
  },
  promoButton: {
    alignSelf: 'center',
  },
  bottomSpacing: {
    height: Spacing[8],
  },
});
