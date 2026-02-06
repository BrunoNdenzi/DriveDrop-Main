import brevoService from '../services/BrevoService';

/**
 * BREVO EMAIL SERVICE - USAGE EXAMPLES
 * 
 * Import and use in your routes/controllers
 */

// Example 1: Send Welcome Email on User Registration
export async function onUserRegistered(user: any) {
  await brevoService.sendWelcomeEmail(
    { email: user.email, name: user.fullName },
    user.role, // 'client', 'driver', or 'broker'
    {
      firstName: user.firstName,
      dashboardUrl: `https://drivedrop.us.com/dashboard/${user.role}`,
    }
  );
}

// Example 2: Send Shipment Created Notification
export async function onShipmentCreated(shipment: any, customer: any) {
  await brevoService.sendShipmentNotification(
    { email: customer.email, name: customer.fullName },
    'shipment_created',
    {
      firstName: customer.firstName,
      shipmentId: shipment.id,
      vehicleYear: shipment.vehicle.year,
      vehicleMake: shipment.vehicle.make,
      vehicleModel: shipment.vehicle.model,
      pickupCity: shipment.pickup.city,
      pickupState: shipment.pickup.state,
      deliveryCity: shipment.delivery.city,
      deliveryState: shipment.delivery.state,
      pickupDate: new Date(shipment.pickupDate).toLocaleDateString(),
      status: shipment.status.toUpperCase(),
    }
  );
}

// Example 3: Send Carrier Assigned Notification
export async function onCarrierAssigned(shipment: any, customer: any, driver: any) {
  await brevoService.sendShipmentNotification(
    { email: customer.email, name: customer.fullName },
    'carrier_assigned',
    {
      firstName: customer.firstName,
      shipmentId: shipment.id,
      carrierName: driver.companyName,
      driverName: driver.fullName,
      driverPhone: driver.phone,
      driverRating: driver.rating || '5.0',
      pickupDate: new Date(shipment.pickupDate).toLocaleDateString(),
      pickupTime: new Date(shipment.pickupDate).toLocaleTimeString(),
      deliveryDate: new Date(shipment.estimatedDelivery).toLocaleDateString(),
    }
  );
}

// Example 4: Send New Load Available to Driver
export async function notifyDriverNewLoad(driver: any, load: any) {
  await brevoService.sendLoadNotification(
    { email: driver.email, name: driver.fullName },
    'load_available',
    {
      firstName: driver.firstName,
      loadId: load.id,
      pickupCity: load.pickup.city,
      pickupState: load.pickup.state,
      deliveryCity: load.delivery.city,
      deliveryState: load.delivery.state,
      distance: load.distance,
      pickupDate: new Date(load.pickupDate).toLocaleDateString(),
      vehicleYear: load.vehicle.year,
      vehicleMake: load.vehicle.make,
      vehicleModel: load.vehicle.model,
      rate: `$${load.rate}`,
      route: `${load.pickup.city}, ${load.pickup.state} → ${load.delivery.city}, ${load.delivery.state}`,
    }
  );
}

// Example 5: Send Load Assigned Confirmation to Driver
export async function onLoadAssignedToDriver(driver: any, load: any, customer: any) {
  await brevoService.sendLoadNotification(
    { email: driver.email, name: driver.fullName },
    'load_assigned',
    {
      firstName: driver.firstName,
      loadId: load.id,
      pickupAddress: `${load.pickup.address}, ${load.pickup.city}, ${load.pickup.state}`,
      deliveryAddress: `${load.delivery.address}, ${load.delivery.city}, ${load.delivery.state}`,
      pickupDate: new Date(load.pickupDate).toLocaleDateString(),
      pickupTime: new Date(load.pickupDate).toLocaleTimeString(),
      customerName: customer.fullName,
      customerPhone: customer.phone,
      rate: `$${load.rate}`,
    }
  );
}

// Example 6: Send Password Reset
export async function onPasswordResetRequest(user: any, resetToken: string) {
  await brevoService.sendPasswordReset(
    { email: user.email, name: user.fullName },
    resetToken
  );
}

// Example 7: Send Email Verification
export async function onUserSignup(user: any, verificationToken: string) {
  await brevoService.sendEmailVerification(
    { email: user.email, name: user.fullName },
    verificationToken
  );
}

// Example 8: Send Pickup Confirmation
export async function onVehiclePickedUp(shipment: any, customer: any, driver: any) {
  await brevoService.sendShipmentNotification(
    { email: customer.email, name: customer.fullName },
    'pickup_confirmed',
    {
      firstName: customer.firstName,
      shipmentId: shipment.id,
      vehicleYear: shipment.vehicle.year,
      vehicleMake: shipment.vehicle.make,
      vehicleModel: shipment.vehicle.model,
      pickupTime: new Date(shipment.actualPickupTime).toLocaleTimeString(),
      pickupDate: new Date(shipment.actualPickupTime).toLocaleDateString(),
      pickupAddress: `${shipment.pickup.address}, ${shipment.pickup.city}`,
      driverName: driver.fullName,
      estimatedDelivery: new Date(shipment.estimatedDelivery).toLocaleDateString(),
    }
  );
}

// Example 9: Send Delivery Confirmation
export async function onVehicleDelivered(shipment: any, customer: any) {
  await brevoService.sendShipmentNotification(
    { email: customer.email, name: customer.fullName },
    'delivery_confirmed',
    {
      firstName: customer.firstName,
      shipmentId: shipment.id,
      vehicleYear: shipment.vehicle.year,
      vehicleMake: shipment.vehicle.make,
      vehicleModel: shipment.vehicle.model,
      deliveryTime: new Date(shipment.actualDeliveryTime).toLocaleTimeString(),
      deliveryDate: new Date(shipment.actualDeliveryTime).toLocaleDateString(),
      deliveryAddress: `${shipment.delivery.address}, ${shipment.delivery.city}`,
      receiverName: shipment.receiverName,
      totalMiles: shipment.totalDistance,
      transitDays: Math.ceil((new Date(shipment.actualDeliveryTime).getTime() - new Date(shipment.actualPickupTime).getTime()) / (1000 * 60 * 60 * 24)),
      reviewUrl: `https://drivedrop.us.com/review/${shipment.id}`,
      dashboardUrl: 'https://drivedrop.us.com/dashboard/client',
    }
  );
}

// Example 10: Get Email Statistics
export async function getEmailStats(userId?: string) {
  const stats = await brevoService.getEmailStats(userId, 30); // Last 30 days
  console.log('Email Stats:', stats);
  return stats;
}

/**
 * HOW TO USE IN YOUR ROUTES:
 * 
 * // In your signup route:
 * app.post('/api/auth/signup', async (req, res) => {
 *   const user = await createUser(req.body);
 *   await onUserRegistered(user);
 *   res.json({ success: true });
 * });
 * 
 * // In your create shipment route:
 * app.post('/api/shipments', async (req, res) => {
 *   const shipment = await createShipment(req.body);
 *   await onShipmentCreated(shipment, req.user);
 *   res.json({ shipment });
 * });
 * 
 * // In your assign driver route:
 * app.post('/api/shipments/:id/assign', async (req, res) => {
 *   const shipment = await assignDriver(req.params.id, req.body.driverId);
 *   await onCarrierAssigned(shipment, shipment.customer, shipment.driver);
 *   res.json({ success: true });
 * });
 */
