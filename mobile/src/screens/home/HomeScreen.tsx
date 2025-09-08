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
  Alert,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ClientTabParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { ShipmentService } from '../../services/shipmentService';

// Define notification type
type Notification = {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  shipmentId?: string;
  type: 'pickup' | 'transit' | 'delivery' | 'other';
};

type StatItem = {
  label: string;
  value: string;
  rawValue?: number; // Store the raw number value for currency stats
  icon: string;
  color: string;
  isCurrency?: boolean; // Flag to identify currency values
};

type HomeScreenProps = NativeStackScreenProps<ClientTabParamList, 'Home'>;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeShipments, setActiveShipments] = useState<number>(0);
  const [pendingShipments, setPendingShipments] = useState<number>(0);
  const [completedShipments, setCompletedShipments] = useState<number>(0);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  // Sample notifications for the user
  const [userNotifications, setUserNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Shipment Picked Up',
      message: 'Your shipment #DR001 has been picked up by the carrier',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      isRead: false,
      shipmentId: 'DR001',
      type: 'pickup'
    },
    {
      id: '2',
      title: 'Shipment In Transit',
      message: 'Your shipment #DR002 is now in transit',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      isRead: false,
      shipmentId: 'DR002',
      type: 'transit'
    }
  ]);
  
  // Compute number of unread notifications
  const notifications = userNotifications.filter(n => !n.isRead).length;

  // Helper function to format monetary values
  const formatCurrencyValue = (value: string) => {
    // Extract currency symbol and amount
    const match = value.match(/^(\$|€|£|¥)(.+)$/);
    if (match) {
      const symbol = match[1];
      const amount = match[2];
      
      // Log for debugging
      console.log('Currency format:', { original: value, symbol, amount });
      
      return {
        symbol,
        amount
      };
    }
    return null;
  };

  // Format a number as a currency string - improved approach
  const formatCurrency = (amount: number): string => {
    // Use toLocaleString to format the number with commas
    return amount.toLocaleString('en-US', {
      maximumFractionDigits: 0 // No decimal places
    });
  };

  // Fetch user's shipment data
  const fetchShipmentData = async (isRefreshing = false) => {
    if (!userProfile?.id) return;
    
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      
      // Fetch active shipments (accepted, in_transit)
      const activeData = await ShipmentService.getClientShipments(
        userProfile.id, 
        ['accepted', 'in_transit']
      );
      
      // Fetch pending shipments
      const pendingData = await ShipmentService.getClientShipments(
        userProfile.id,
        ['pending']
      );
      
      // Fetch completed shipments
      const completedData = await ShipmentService.getClientShipments(
        userProfile.id, 
        ['delivered']
      );
      
      // Calculate total spent from completed shipments
      const total = completedData.reduce((sum, shipment) => {
        // Use final_price if available, otherwise use estimated_price
        const shipmentCost = shipment.final_price || shipment.estimated_price || 0;
        // Ensure we're dealing with numbers
        const cost = typeof shipmentCost === 'string' ? parseFloat(shipmentCost) : shipmentCost;
        return sum + cost;
      }, 0);
      
      // Log the calculated total for debugging
      console.log('Calculated total spent:', total);
      
      setActiveShipments(activeData.length);
      setPendingShipments(pendingData.length);
      setCompletedShipments(completedData.length);
      setTotalSpent(total);
      
      // In a real app, we would fetch notifications from the backend
      // For now, we're just using the sample data defined in state
    } catch (error) {
      console.error('Error fetching shipment stats:', error);
      // Set default values in case of error
      setActiveShipments(0);
      setPendingShipments(0);
      setCompletedShipments(0);
      setTotalSpent(0);
    } finally {
      setLoading(false);
      if (isRefreshing) {
        setRefreshing(false);
      }
    }
  };
  
  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchShipmentData(true);
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchShipmentData();
  }, [userProfile?.id]);
  
  // Handle notification click
  const handleNotificationPress = (notification: Notification) => {
    // Mark the notification as read
    const updatedNotifications = userNotifications.map(n => 
      n.id === notification.id ? {...n, isRead: true} : n
    );
    setUserNotifications(updatedNotifications);
    
    // Navigate to the shipment detail if there's a shipmentId
    if (notification.shipmentId) {
      // Here you would navigate to the shipment detail screen
      // For now, we'll just close the modal and show an alert
      setShowNotifications(false);
      Alert.alert(
        "Shipment Details",
        `Viewing details for shipment ${notification.shipmentId}`,
        [{ text: "OK" }]
      );
    }
  };
  
  // Render a single notification item
  const renderNotificationItem = (notification: Notification) => {
    const getIconForType = (type: string) => {
      switch (type) {
        case 'pickup': return 'local-shipping';
        case 'transit': return 'directions';
        case 'delivery': return 'check-circle';
        default: return 'notifications';
      }
    };
    
    const getColorForType = (type: string) => {
      switch (type) {
        case 'pickup': return Colors.primary;
        case 'transit': return Colors.warning;
        case 'delivery': return Colors.success;
        default: return Colors.text.secondary;
      }
    };
    
    // Format the timestamp to relative time (e.g. "2 hours ago")
    const formatRelativeTime = (date: Date) => {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.round(diffMs / (1000 * 60));
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minutes ago`;
      
      const diffHours = Math.round(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hours ago`;
      
      const diffDays = Math.round(diffHours / 24);
      return `${diffDays} days ago`;
    };
    
    return (
      <TouchableOpacity 
        key={notification.id} 
        style={[
          styles.notificationItem, 
          !notification.isRead && styles.unreadNotification
        ]}
        onPress={() => handleNotificationPress(notification)}
      >
        <View style={[styles.notificationIconContainer, { backgroundColor: getColorForType(notification.type) + '15' }]}>
          <MaterialIcons name={getIconForType(notification.type) as any} size={24} color={getColorForType(notification.type)} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationMessage}>{notification.message}</Text>
          <Text style={styles.notificationTime}>{formatRelativeTime(notification.timestamp)}</Text>
        </View>
        {!notification.isRead && <View style={styles.unreadIndicator} />}
      </TouchableOpacity>
    );
  };
  
  // Render the notifications modal
  const renderNotificationsModal = () => {
    if (!showNotifications) return null;
    
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotifications(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {userNotifications.length > 0 ? (
              userNotifications
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .map(renderNotificationItem)
            ) : (
              <View style={styles.emptyNotifications}>
                <MaterialIcons name="notifications-off" size={40} color={Colors.text.secondary} />
                <Text style={styles.emptyNotificationsText}>No notifications</Text>
              </View>
            )}
          </ScrollView>
          
          {notifications > 0 && (
            <TouchableOpacity 
              style={styles.markAllReadButton}
              onPress={() => {
                const updatedNotifications = userNotifications.map(n => ({...n, isRead: true}));
                setUserNotifications(updatedNotifications);
              }}
            >
              <Text style={styles.markAllReadText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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

  // Generate stats array using real data
  const quickStats = [
    { 
      label: 'Active Shipments', 
      value: activeShipments.toString(), 
      icon: 'local-shipping', 
      color: Colors.primary 
    },
    { 
      label: 'Completed', 
      value: completedShipments.toString(), 
      icon: 'check-circle', 
      color: Colors.success 
    },
    { 
      label: 'Total Paid', 
      value: "$" + totalSpent.toString(), // Simple string concatenation to avoid formatting issues
      rawValue: totalSpent,
      icon: 'account-balance-wallet', 
      color: Colors.secondary,
      isCurrency: true
    },
  ];
  
  // Log the stats for debugging
  console.log('Quick stats:', quickStats.map(s => ({
    label: s.label, 
    value: s.value,
    rawValue: s.rawValue
  })));

  // Handle support action to show contact options
  // Create a component for the notifications modal
  const [showNotifications, setShowNotifications] = useState(false);

  const handleNotifications = () => {
    if (notifications > 0) {
      Alert.alert(
        "Notifications",
        "You have " + notifications + " unread notifications",
        [
          {
            text: "View All",
            onPress: () => setShowNotifications(true)
          },
          {
            text: "Mark All Read",
            onPress: () => {
              // Mark all notifications as read
              const updatedNotifications = userNotifications.map(n => ({...n, isRead: true}));
              setUserNotifications(updatedNotifications);
            }
          },
          {
            text: "Close",
            style: "cancel"
          }
        ]
      );
    } else {
      Alert.alert(
        "Notifications",
        "You have no new notifications",
        [
          {
            text: "View All",
            onPress: () => setShowNotifications(true)
          },
          {
            text: "Close",
            style: "cancel"
          }
        ]
      );
    }
  };

  const handleSupport = () => {
    Alert.alert(
      "Contact Support",
      "How would you like to contact our support team?",
      [
        {
          text: "Email",
          onPress: () => {
            // Open email client with support email
            Linking.openURL('mailto:support@drivedrop.us.com?subject=DriveDrop Support Request');
          }
        },
        {
          text: "Call",
          onPress: () => {
            // Open phone dialer with support phone number
            Linking.openURL('tel:+17042662317');
          }
        },
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  };

  const quickActions = [
    { 
      title: 'Track Shipment', 
      icon: 'my-location', 
      onPress: handleTrackShipment,
      description: 'Find your shipments',
      color: '#4CAF50' // Green
    },
    { 
      title: 'Support', 
      icon: 'headset-mic', 
      onPress: handleSupport,
      description: 'Contact our team',
      color: '#2196F3' // Blue
    },
    { 
      title: 'History', 
      icon: 'history', 
      onPress: () => navigation.navigate('Shipments'),
      description: 'View past shipments',
      color: '#9C27B0' // Purple
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
        
        <TouchableOpacity style={styles.notificationButton} onPress={handleNotifications}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.text.primary} />
          {notifications > 0 && <View style={styles.notificationBadge}>
            {notifications > 1 && <Text style={styles.notificationCount}>{notifications}</Text>}
          </View>}
        </TouchableOpacity>
      </View>
      
      {/* Notifications Modal */}
      {showNotifications && renderNotificationsModal()}

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }>
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
                onPress={handleCreateShipment}
                style={styles.bannerButton}
              />
            </View>
            <MaterialIcons name="directions-car" size={60} color={Colors.primary} style={styles.bannerIcon} />
          </View>
        </Card>

        {/* Enhanced Stats Dashboard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Dashboard</Text>
          
          {loading ? (
            // Loading state - show a single loading card
            <Card variant="elevated" padding="lg" style={styles.statsDashboardCard}>
              <View style={styles.loadingDashboard}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading your stats...</Text>
              </View>
            </Card>
          ) : (
            // Actual data - display in a visually appealing dashboard
            <Card variant="elevated" padding="lg" style={styles.statsDashboardCard}>
              <View style={styles.dashboardHeader}>
                <Text style={styles.dashboardTitle}>Shipping Summary</Text>
                <TouchableOpacity onPress={onRefresh}>
                  <MaterialIcons name="refresh" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              
              {/* Active Shipments - Horizontal layout with icon and details */}
              <View style={styles.statRow}>
                <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '20' }]}>
                  <MaterialIcons name="local-shipping" size={24} color={Colors.primary} />
                </View>
                <View style={styles.statDetails}>
                  <Text style={styles.statTitle}>Active Shipments</Text>
                  <Text style={styles.statDescription}>Currently in transit or pending</Text>
                </View>
                <Text style={styles.statHighlight}>{activeShipments}</Text>
              </View>
              
              <View style={styles.divider} />
              
              {/* Completed Shipments */}
              <View style={styles.statRow}>
                <View style={[styles.iconContainer, { backgroundColor: Colors.success + '20' }]}>
                  <MaterialIcons name="check-circle" size={24} color={Colors.success} />
                </View>
                <View style={styles.statDetails}>
                  <Text style={styles.statTitle}>Completed</Text>
                  <Text style={styles.statDescription}>Successfully delivered</Text>
                </View>
                <Text style={styles.statHighlight}>{completedShipments}</Text>
              </View>
              
              <View style={styles.divider} />
              
              {/* Pending Shipments */}
              <View style={styles.statRow}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF9800' + '20' }]}>
                  <MaterialIcons name="hourglass-empty" size={24} color="#FF9800" />
                </View>
                <View style={styles.statDetails}>
                  <Text style={styles.statTitle}>Pending Shipments</Text>
                  <Text style={styles.statDescription}>Awaiting processing</Text>
                </View>
                <Text style={styles.statHighlight}>{pendingShipments}</Text>
              </View>
              
              {/* Total Paid - With special currency styling (moved to bottom) */}
              <View style={styles.divider} />
              <View style={styles.statRow}>
                <View style={[styles.iconContainer, { backgroundColor: Colors.secondary + '20' }]}>
                  <MaterialIcons name="account-balance-wallet" size={24} color={Colors.secondary} />
                </View>
                <View style={styles.statDetails}>
                  <Text style={styles.statTitle}>Total Paid</Text>
                  <Text style={styles.statDescription}>All completed shipments</Text>
                </View>
                <View style={styles.currencyContainer}>
                  <Text style={styles.currencySymbolLarge}>$</Text>
                  <Text style={styles.statHighlight}>{formatCurrency(totalSpent)}</Text>
                </View>
              </View>
            </Card>
          )}
        </View>

        {/* Create Shipment CTA */}
        <Card variant="outlined" padding="lg" style={styles.ctaCard}>
          <View style={styles.ctaContent}>
            <MaterialIcons name="add-circle-outline" size={32} color={Colors.primary} />
            <Text style={styles.ctaTitle}>Create New Shipment</Text>
            <Text style={styles.ctaSubtitle}>Get quotes and book your vehicle transport</Text>
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
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                onPress={action.onPress}
                style={styles.quickActionButton}
              >
                <View style={[styles.quickActionIconContainer, { backgroundColor: action.color + '15' }]}>
                  <MaterialIcons name={action.icon as any} size={28} color={action.color} />
                </View>
                <View style={styles.quickActionTextContainer}>
                  <Text style={styles.quickActionTitle}>{action.title}</Text>
                  <Text style={styles.quickActionDescription}>{action.description}</Text>
                </View>
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
          
          <Card variant="default" padding="base" style={styles.activityCard}>
            <View style={styles.activityItem}>
              <MaterialIcons name="local-shipping" size={20} color={Colors.primary} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Shipment #DR001 picked up</Text>
                <Text style={styles.activityTime}>2 hours ago</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
            </View>
          </Card>
        </View>

        {/* Promotional Banner */}
        <Card variant="elevated" padding="lg" style={styles.promoCard}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>🎉 Special Offer</Text>
            <Text style={styles.promoSubtitle}>Get 15% off your next shipment with code DRIVE15</Text>
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
    paddingLeft: Spacing[6],
    paddingRight: Spacing[10], // Increase right padding to push the icon to the left
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[4], // Add margin to move it further to the left
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 2, // Move the badge closer to the bell icon
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCount: {
    color: '#FFFFFF', // Use literal white color
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    paddingHorizontal: 2,
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
    height: 110, // Fixed height for all cards
    justifyContent: 'space-between', // Distribute space evenly
    paddingVertical: Spacing[2],
  },
  statValue: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginTop: Spacing[2],
    height: 35, // Fixed height for value area
    textAlignVertical: 'center', // Center text vertically
    textAlign: 'center', // Center horizontally for better alignment with non-currency values
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing[1],
  },
  formattedValueContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Changed to center for better alignment
    justifyContent: 'center',
    marginTop: Spacing[2],
    height: 35, // Match height of regular statValue
  },
  loadingContainer: {
    height: 35, // Match height of statValue for consistent layout
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  currencySymbol: {
    fontSize: Typography.fontSize.sm, // Smaller than the main value
    fontWeight: Typography.fontWeight.bold,
    color: Colors.secondary, // Different color for distinction
    marginRight: -2, // Tighten spacing between symbol and amount
    marginTop: -3, // Adjust vertical alignment
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
  // New Dashboard Stats Styles
  statsDashboardCard: {
    marginTop: Spacing[2],
  },
  loadingDashboard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[6],
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing[3],
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  dashboardTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[3],
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  statDetails: {
    flex: 1,
  },
  statTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  statDescription: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  statHighlight: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing[1],
  },
  currencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbolLarge: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.secondary,
    marginRight: 2,
  },
  // New Quick Actions styles
  quickActionsGrid: {
    marginTop: Spacing[2],
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    marginBottom: Spacing[3],
    shadowColor: Colors.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing[4],
  },
  quickActionTextContainer: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
  },
  
  // Notification Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  modalContent: {
    maxHeight: 400,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  unreadNotification: {
    backgroundColor: Colors.primary + '10', // Light tint of primary color
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing[3],
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing[1],
  },
  notificationMessage: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    marginBottom: Spacing[1],
  },
  notificationTime: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    opacity: 0.7,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: Spacing[2],
  },
  emptyNotifications: {
    padding: Spacing[8],
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyNotificationsText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing[2],
  },
  markAllReadButton: {
    padding: Spacing[4],
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  markAllReadText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.medium,
  },
});
