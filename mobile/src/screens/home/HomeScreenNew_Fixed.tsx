import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ClientTabParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type StatItem = {
  label: string;
  value: string;
  icon: string;
  color: string;
  formattedValue?: [string, string]; // Optional formatted value for splitting currency values
};

type RecentActivity = {
  id: string;
  title: string;
  time: string;
  icon: string;
  shipmentId?: string;
};

type HomeScreenProps = NativeStackScreenProps<ClientTabParamList, 'Home'>;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [userProfile]);

  const loadDashboardData = async () => {
    if (!userProfile?.id) return;
    
    try {
      setLoading(true);
      
      // Fetch shipments data
      const { data: shipmentsData, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('client_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching shipments:', error);
        // Set default empty data with graceful handling
        setStats([
          { label: 'Active Shipments', value: '0', icon: 'local-shipping', color: Colors.primary },
          { label: 'Completed', value: '0', icon: 'check-circle', color: Colors.success },
          { label: 'This Month', value: '$0', icon: 'trending-up', color: Colors.warning },
          { label: 'Total Spent', value: '$0', icon: 'account-balance-wallet', color: Colors.info },
        ]);
        setRecentActivity([]);
        return;
      }

      if (shipmentsData) {
        // Calculate stats
        const thisMonth = new Date();
        thisMonth.setDate(1);
        
        const thisMonthShipments = shipmentsData.filter((s: any) => 
          new Date(s.created_at) >= thisMonth
        );
        
        const activeShipments = shipmentsData.filter((s: any) => 
          ['pending', 'accepted', 'in_transit'].includes(s.status)
        ).length;

        const completedShipments = shipmentsData.filter((s: any) => s.status === 'delivered');
        const thisMonthSpent = thisMonthShipments
          .filter((s: any) => s.status === 'delivered')
          .reduce((sum: number, s: any) => sum + (s.final_price || s.estimated_price || 0), 0);

        const totalSpent = completedShipments
          .reduce((sum: number, s: any) => sum + (s.final_price || s.estimated_price || 0), 0);

        setStats([
          { 
            label: 'Active Shipments', 
            value: activeShipments.toString(),
            icon: 'local-shipping', 
            color: Colors.primary 
          },
          { 
            label: 'Completed', 
            value: completedShipments.length.toString(),
            icon: 'check-circle', 
            color: Colors.success 
          },
          { 
            label: 'This Month', 
            value: `$${thisMonthSpent.toFixed(2)}`,
            icon: 'trending-up', 
            color: Colors.warning 
          },
          { 
            label: 'Total Spent', 
            value: `$${totalSpent.toFixed(2)}`,
            icon: 'account-balance-wallet', 
            color: Colors.info 
          },
        ]);

        // Generate recent activity from shipments
        const activities: RecentActivity[] = [];
        
        shipmentsData.slice(0, 5).forEach((shipment: any) => {
          const timeAgo = getTimeAgo(shipment.updated_at);
          let activityTitle = '';
          let icon = 'local-shipping';
          
          switch (shipment.status) {
            case 'pending':
              activityTitle = `Shipment #${shipment.id.substring(0, 8)} created`;
              icon = 'add-circle';
              break;
            case 'accepted':
              activityTitle = `Driver assigned to shipment #${shipment.id.substring(0, 8)}`;
              icon = 'person-add';
              break;
            case 'in_transit':
              activityTitle = `Shipment #${shipment.id.substring(0, 8)} in transit`;
              icon = 'local-shipping';
              break;
            case 'delivered':
              activityTitle = `Shipment #${shipment.id.substring(0, 8)} delivered`;
              icon = 'check-circle';
              break;
            default:
              activityTitle = `Shipment #${shipment.id.substring(0, 8)} updated`;
              icon = 'update';
          }

          activities.push({
            id: shipment.id,
            title: activityTitle,
            time: timeAgo,
            icon,
            shipmentId: shipment.id,
          });
        });

        setRecentActivity(activities);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getUserInitial = () => {
    if (userProfile?.first_name) {
      return userProfile.first_name.charAt(0).toUpperCase();
    }
    if (userProfile?.email) {
      return userProfile.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleActivityPress = (activity: RecentActivity) => {
    if (activity.shipmentId) {
      // Navigate to the Shipments tab which can show shipment details
      navigation.navigate('Shipments', { initialFilter: 'active' });
    }
  };

  const quickActions = [
    {
      title: 'New Shipment',
      icon: 'add-circle',
      onPress: () => navigation.navigate('Shipments'),
    },
    {
      title: 'Track Shipment',
      icon: 'location-on',
      onPress: () => navigation.navigate('Shipments', { initialFilter: 'active' }),
    },
    {
      title: 'Get Quote',
      icon: 'request-quote',
      onPress: () => navigation.navigate('Shipments'),
    },
    {
      title: 'History',
      icon: 'history',
      onPress: () => navigation.navigate('Shipments', { initialFilter: 'past' }),
    },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

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
              {userProfile?.first_name || userProfile?.email?.split('@')[0] || 'User'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.text.primary} />
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Banner Card */}
        <Card variant="elevated" padding="lg" style={styles.bannerCard}>
          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTitle}>🚛 Need to ship a vehicle?</Text>
              <Text style={styles.bannerSubtitle}>Get instant quotes from trusted carriers</Text>
              <Button
                title="Get Quote Now"
                variant="primary"
                size="sm"
                onPress={() => navigation.navigate('Shipments')}
                style={styles.bannerButton}
              />
            </View>
            <View style={styles.bannerRight}>
              <Image
                source={{ uri: 'https://via.placeholder.com/80x60/007AFF/FFFFFF?text=🚛' }}
                style={styles.bannerImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Card>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <Card key={index} variant="default" padding="base" style={styles.statCard}>
                <View style={styles.statContent}>
                  <MaterialIcons name={stat.icon as any} size={24} color={stat.color} />
                  <View style={styles.statTextContainer}>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                onPress={action.onPress}
              >
                <Card variant="default" padding="base" style={styles.actionCardInner}>
                  <MaterialIcons name={action.icon as any} size={28} color={Colors.primary} />
                  <Text style={styles.actionTitle}>{action.title}</Text>
                </Card>
              </TouchableOpacity>
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
          
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
              <Card key={activity.id} variant="default" padding="base" style={styles.activityCard}>
                <TouchableOpacity
                  style={styles.activityItem}
                  onPress={() => handleActivityPress(activity)}
                >
                  <MaterialIcons name={activity.icon as any} size={20} color={Colors.primary} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              </Card>
            ))
          ) : (
            <Card variant="default" padding="lg" style={styles.emptyCard}>
              <View style={styles.emptyState}>
                <MaterialIcons name="inbox" size={48} color={Colors.text.disabled} />
                <Text style={styles.emptyTitle}>No recent activity</Text>
                <Text style={styles.emptySubtitle}>Your shipment activities will appear here</Text>
              </View>
            </Card>
          )}
        </View>

        {/* Promotional Card */}
        <Card variant="elevated" padding="lg" style={styles.promoCard}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>🎉 Special Offer</Text>
            <Text style={styles.promoSubtitle}>Get 15% off your next shipment with code DRIVE15</Text>
            <Button
              title="Learn More"
              variant="secondary"
              size="sm"
              onPress={() => {}}
              style={styles.promoButton}
            />
          </View>
        </Card>

        {/* Bottom padding for safe area */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, // Spacing.4
    paddingTop: 48, // Spacing.12
    paddingBottom: 16, // Spacing.4
    backgroundColor: Colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16, // Spacing.4
  },
  avatarText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.inverse,
  },
  greeting: {
    flex: 1,
  },
  greetingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  userName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  notificationButton: {
    position: 'relative',
    padding: 8, // Spacing.2
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
    paddingHorizontal: 16, // Spacing.4
  },
  section: {
    marginBottom: 24, // Spacing.6
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: 16, // Spacing.4
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8, // Spacing.2
  },
  viewAllText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.medium,
  },
  bannerCard: {
    marginBottom: 24, // Spacing.6
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerLeft: {
    flex: 1,
    marginRight: 16, // Spacing.4
  },
  bannerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: 8, // Spacing.2
  },
  bannerSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: 16, // Spacing.4
    lineHeight: 20,
  },
  bannerButton: {
    alignSelf: 'flex-start',
  },
  bannerRight: {
    alignItems: 'center',
  },
  bannerImage: {
    width: 80,
    height: 60,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4, // -Spacing.1
  },
  statCard: {
    width: '48%',
    marginHorizontal: 4, // Spacing.1
    marginBottom: 12, // Spacing.3
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16, // Spacing.4
  },
  statTextContainer: {
    alignItems: 'center',
    marginTop: 8, // Spacing.2
  },
  statValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginTop: 8, // Spacing.2
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24, // Spacing.6
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    marginBottom: 8, // Spacing.2
  },
  actionCardInner: {
    alignItems: 'center',
    paddingVertical: 16, // Spacing.4
  },
  actionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginTop: 12, // Spacing.3
    textAlign: 'center',
  },
  activityCard: {
    marginBottom: 12, // Spacing.3
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16, // Spacing.4
  },
  activityContent: {
    flex: 1,
    marginLeft: 12, // Spacing.3
  },
  activityTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
  },
  emptyCard: {
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24, // Spacing.6
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginTop: 16, // Spacing.4
    marginBottom: 8, // Spacing.2
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  promoCard: {
    marginBottom: 24, // Spacing.6
  },
  promoContent: {
    alignItems: 'center',
  },
  promoTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: 8, // Spacing.2
    textAlign: 'center',
  },
  promoSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16, // Spacing.4
    lineHeight: 20,
  },
  promoButton: {
    alignSelf: 'center',
  },
  bottomPadding: {
    height: 48, // Spacing.12
  },
});