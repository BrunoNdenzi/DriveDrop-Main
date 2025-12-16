import { TourConfig } from '@/types/onboarding';
import { createStep } from './tour-config';

// CLIENT DASHBOARD TOUR
export const clientDashboardTour: TourConfig = {
  tourType: 'dashboard',
  steps: [
    createStep(
      '#client-dashboard',
      'Welcome to Your Dashboard! 🚚',
      'This is your central hub for managing all your shipments. Let\'s take a quick tour to show you around.',
      { popover: { side: 'bottom', align: 'center' } }
    ),
    createStep(
      '[data-tour="create-shipment"]',
      'Create a New Shipment',
      'Click here to create a new shipment. You can enter pickup and delivery details, add special instructions, and get instant pricing.',
      { popover: { side: 'right', align: 'start' } }
    ),
    createStep(
      '[data-tour="active-shipments"]',
      'Active Shipments',
      'View and track all your current shipments in real-time. See status updates, driver location, and estimated delivery times.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="shipment-history"]',
      'Shipment History',
      'Access your complete shipment history, including invoices, receipts, and tracking details.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="payment-methods"]',
      'Payment Methods',
      'Manage your payment methods here. Add credit cards or other payment options for faster checkout.',
      { popover: { side: 'left', align: 'start' } }
    ),
    createStep(
      '[data-tour="profile-settings"]',
      'Profile & Settings',
      'Update your profile information, notification preferences, and account settings.',
      { popover: { side: 'bottom', align: 'end' } }
    ),
  ],
};

// DRIVER DASHBOARD TOUR
export const driverDashboardTour: TourConfig = {
  tourType: 'driver',
  steps: [
    createStep(
      '#driver-dashboard',
      'Welcome Driver! 🚚',
      'Your dashboard shows available jobs, active deliveries, and your earnings. Let\'s explore the features.',
      { popover: { side: 'bottom', align: 'center' } }
    ),
    createStep(
      '[data-tour="available-jobs"]',
      'Available Jobs',
      'Browse available delivery jobs in your area. Filter by distance, pay, and delivery time.',
      { popover: { side: 'right', align: 'start' } }
    ),
    createStep(
      '[data-tour="active-deliveries"]',
      'Active Deliveries',
      'Track your current deliveries. Get navigation, customer contact info, and delivery instructions.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="earnings"]',
      'Earnings Overview',
      'View your earnings, pending payouts, and payment history. Track your daily, weekly, and monthly income.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="driver-status"]',
      'Online Status',
      'Toggle your availability here. When online, you\'ll receive job notifications.',
      { popover: { side: 'left', align: 'center' } }
    ),
    createStep(
      '[data-tour="documents"]',
      'Documents & Verification',
      'Upload and manage your license, insurance, and vehicle documents. Keep them up-to-date for continuous access.',
      { popover: { side: 'bottom', align: 'start' } }
    ),
  ],
};

// ADMIN DASHBOARD TOUR
export const adminDashboardTour: TourConfig = {
  tourType: 'admin',
  steps: [
    createStep(
      '#admin-dashboard',
      'Admin Control Center 🎯',
      'Welcome to the admin panel. Manage all aspects of DriveDrop from this central hub.',
      { popover: { side: 'bottom', align: 'center' } }
    ),
    createStep(
      '[data-tour="analytics"]',
      'Analytics & Insights',
      'View real-time platform metrics: active shipments, revenue, driver performance, and customer satisfaction.',
      { popover: { side: 'right', align: 'start' } }
    ),
    createStep(
      '[data-tour="driver-management"]',
      'Driver Management',
      'Approve driver applications, manage verifications, track performance, and handle disputes.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="pricing-config"]',
      'Pricing Configuration',
      'Set dynamic pricing rules, base rates, distance multipliers, and special event pricing.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="shipments-overview"]',
      'All Shipments',
      'Monitor all platform shipments. Filter by status, intervene if needed, and resolve customer issues.',
      { popover: { side: 'left', align: 'start' } }
    ),
    createStep(
      '[data-tour="user-management"]',
      'User Management',
      'Manage client accounts, brokers, and platform users. Handle account issues and permissions.',
      { popover: { side: 'bottom', align: 'start' } }
    ),
  ],
};

// BROKER DASHBOARD TOUR
export const brokerDashboardTour: TourConfig = {
  tourType: 'broker',
  steps: [
    createStep(
      '#broker-dashboard',
      'Broker Dashboard 📊',
      'Manage your client relationships, carrier network, and commission earnings from one place.',
      { popover: { side: 'bottom', align: 'center' } }
    ),
    createStep(
      '[data-tour="client-management"]',
      'Client Management',
      'View and manage your client accounts. Track their shipping activity and relationship status.',
      { popover: { side: 'right', align: 'start' } }
    ),
    createStep(
      '[data-tour="carrier-network"]',
      'Carrier Network',
      'Manage your carrier relationships. Invite carriers, set commission rates, and track performance.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="assignments"]',
      'Active Assignments',
      'Track shipments assigned to your carriers. Monitor progress and ensure on-time delivery.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="commission-earnings"]',
      'Commission & Earnings',
      'View your commission earnings, pending payouts, and revenue breakdown by client and carrier.',
      { popover: { side: 'left', align: 'start' } }
    ),
    createStep(
      '[data-tour="reports"]',
      'Reports & Analytics',
      'Generate detailed reports on your brokerage performance, client activity, and carrier metrics.',
      { popover: { side: 'bottom', align: 'start' } }
    ),
  ],
};

// SHIPMENT CREATION TOUR
export const shipmentCreationTour: TourConfig = {
  tourType: 'shipment_creation',
  steps: [
    createStep(
      '[data-tour="pickup-address"]',
      'Pickup Location 📍',
      'Enter the pickup address. We\'ll use this to calculate distance and pricing. Be as specific as possible.',
      { popover: { side: 'right', align: 'start' } }
    ),
    createStep(
      '[data-tour="delivery-address"]',
      'Delivery Location 🎯',
      'Enter the delivery destination. Include apartment numbers, gate codes, or special access instructions.',
      { popover: { side: 'right', align: 'start' } }
    ),
    createStep(
      '[data-tour="special-instructions"]',
      'Special Instructions 📝',
      'Add detailed instructions for the driver: parking info, building access, contact preferences, handling requirements.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="vehicle-selection"]',
      'Vehicle Type 🚐',
      'Choose the right vehicle for your shipment. Larger vehicles cost more but can handle bigger items.',
      { popover: { side: 'left', align: 'start' } }
    ),
    createStep(
      '[data-tour="pricing-preview"]',
      'Instant Price Quote 💰',
      'See your price breakdown in real-time. Pricing updates based on distance, vehicle type, and demand.',
      { popover: { side: 'left', align: 'center' } }
    ),
    createStep(
      '[data-tour="photo-upload"]',
      'Item Photos 📸',
      'Upload photos of your items. This helps drivers prepare and provides proof of condition.',
      { popover: { side: 'top', align: 'start' } }
    ),
    createStep(
      '[data-tour="submit-shipment"]',
      'Create & Pay 🎉',
      'Review everything and submit. You\'ll be taken to secure payment, then we\'ll find a driver immediately!',
      { popover: { side: 'top', align: 'end' } }
    ),
  ],
};

// TRACKING TOUR
export const trackingTour: TourConfig = {
  tourType: 'tracking',
  steps: [
    createStep(
      '[data-tour="live-map"]',
      'Live Tracking Map 🗺️',
      'Watch your shipment move in real-time. The driver\'s location updates automatically every few seconds.',
      { popover: { side: 'bottom', align: 'center' } }
    ),
    createStep(
      '[data-tour="status-timeline"]',
      'Shipment Timeline ⏱️',
      'See every step of your shipment journey: created, driver assigned, picked up, in transit, delivered.',
      { popover: { side: 'right', align: 'start' } }
    ),
    createStep(
      '[data-tour="driver-info"]',
      'Driver Information 👤',
      'View your driver\'s name, photo, rating, and contact info. Call or message them directly if needed.',
      { popover: { side: 'left', align: 'start' } }
    ),
    createStep(
      '[data-tour="eta"]',
      'Estimated Arrival ⏰',
      'See the estimated delivery time. This updates based on traffic and driver progress.',
      { popover: { side: 'top', align: 'center' } }
    ),
    createStep(
      '[data-tour="delivery-proof"]',
      'Delivery Confirmation ✅',
      'Once delivered, you\'ll see proof of delivery photos and signature. Rate your experience!',
      { popover: { side: 'left', align: 'end' } }
    ),
  ],
};
