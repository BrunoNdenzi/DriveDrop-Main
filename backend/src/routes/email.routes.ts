/**
 * Email routes - Send transactional emails via Brevo
 */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '@utils/error';
import { successResponse } from '@utils/response';
import brevoService from '../services/BrevoService';

const router = Router();

/**
 * Send welcome email
 * POST /api/v1/emails/send-welcome
 */
router.post('/send-welcome', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, lastName, role } = req.body;

  if (!email || !firstName || !role) {
    return res.status(400).json({
      error: 'Missing required fields: email, firstName, role'
    });
  }

  // Validate role
  const validRoles = ['client', 'driver', 'broker'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      error: 'Invalid role. Must be: client, driver, or broker'
    });
  }

  // Determine template type based on role
  const templateMap: Record<string, string> = {
    client: 'client_welcome',
    driver: 'driver_welcome',
    broker: 'broker_welcome'
  };

  const templateType = templateMap[role];
  const dashboardUrl = `${process.env['FRONTEND_URL'] || 'https://drivedrop.us.com'}/dashboard/${role}`;

  // Send welcome email via Brevo
  const success = await brevoService.sendEmail({
    to: [{ email, name: `${firstName} ${lastName || ''}`.trim() }],
    templateType: templateType as any,
    templateData: {
      firstName,
      lastName: lastName || '',
      email,
      dashboardUrl,
      supportEmail: 'support@drivedrop.us.com',
    }
  });

  if (!success) {
    console.error(`Failed to send ${role} welcome email to ${email}`);
    return res.status(500).json({
      error: 'Failed to send welcome email'
    });
  }

  return res.status(200).json(successResponse({
    message: 'Welcome email sent successfully',
    email,
    templateType
  }));
}));

/**
 * Send driver application received email
 * POST /api/v1/emails/send-driver-application-received
 */
router.post('/send-driver-application-received', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, fullName, applicationId } = req.body;

  if (!email || !firstName || !applicationId) {
    return res.status(400).json({
      error: 'Missing required fields: email, firstName, applicationId'
    });
  }

  const success = await brevoService.sendEmail({
    to: [{ email, name: fullName || firstName }],
    templateType: 'driver_application_received',
    templateData: {
      firstName,
      fullName: fullName || firstName,
      applicationId: applicationId.substring(0, 8).toUpperCase(),
    }
  });

  if (!success) {
    console.error(`Failed to send driver application received email to ${email}`);
    return res.status(500).json({
      error: 'Failed to send email'
    });
  }

  return res.status(200).json(successResponse({
    message: 'Driver application received email sent successfully',
    email
  }));
}));

/**
 * Send driver application approved email
 * POST /api/v1/emails/send-driver-application-approved
 */
router.post('/send-driver-application-approved', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, fullName, temporaryPassword, adminComment } = req.body;

  if (!email || !firstName || !temporaryPassword) {
    return res.status(400).json({
      error: 'Missing required fields: email, firstName, temporaryPassword'
    });
  }

  const loginUrl = `${process.env['FRONTEND_URL'] || 'https://www.drivedrop.us.com'}/login`;

  // Build admin comment HTML if provided
  const adminCommentHtml = adminComment ? `
    <div style="background-color:#eff6ff;border-left:3px solid #3b82f6;padding:12px 16px;margin:20px 0;border-radius:0 6px 6px 0;font-size:13px;color:#1e40af;">
      <strong>Admin Note:</strong> ${adminComment}
    </div>
  ` : '';

  const success = await brevoService.sendEmail({
    to: [{ email, name: fullName || firstName }],
    templateType: 'driver_application_approved',
    templateData: {
      firstName,
      fullName: fullName || firstName,
      email,
      temporaryPassword,
      loginUrl,
      adminCommentHtml
    }
  });

  if (!success) {
    console.error(`Failed to send driver approval email to ${email}`);
    return res.status(500).json({
      error: 'Failed to send approval email'
    });
  }

  return res.status(200).json(successResponse({
    message: 'Driver approval email sent successfully',
    email
  }));
}));

/**
 * Send admin notification for new driver application
 * POST /api/v1/emails/send-admin-driver-application
 */
router.post('/send-admin-driver-application', asyncHandler(async (req: Request, res: Response) => {
  const { email, fullName, phone, licenseState, applicationId, submittedAt, 
          licenseFrontUrl, licenseBackUrl, proofOfAddressUrl, insuranceProofUrl } = req.body;

  if (!email || !fullName || !applicationId) {
    return res.status(400).json({
      error: 'Missing required fields: email, fullName, applicationId'
    });
  }

  const reviewUrl = `${process.env['FRONTEND_URL'] || 'https://drivedrop.us.com'}/dashboard/admin/driver-applications`;

  // Format documents status as a simple string
  const documentsStatus = [
    `${licenseFrontUrl ? 'âœ“' : 'âœ—'} Driver License (Front)`,
    `${licenseBackUrl ? 'âœ“' : 'âœ—'} Driver License (Back)`,
    `${proofOfAddressUrl ? 'âœ“' : 'âœ—'} Proof of Address`,
    `${insuranceProofUrl ? 'âœ“' : 'âœ—'} Insurance Document`
  ].join('<br>');

  const success = await brevoService.sendEmail({
    to: [{ email: 'infos@drivedrop.us.com', name: 'DriveDrop Admin' }],
    templateType: 'admin_driver_application',
    templateData: {
      fullName,
      email,
      phone: phone || 'N/A',
      licenseState: licenseState || 'N/A',
      applicationId: applicationId.substring(0, 8).toUpperCase(),
      submittedAt: submittedAt || new Date().toLocaleString(),
      documentsStatus,
      reviewUrl
    }
  });

  if (!success) {
    console.error('Failed to send admin driver application notification');
    return res.status(500).json({
      error: 'Failed to send admin notification'
    });
  }

  return res.status(200).json(successResponse({
    message: 'Admin notification sent successfully'
  }));
}));

/**
 * Send service lead notification
 * POST /api/v1/emails/send-service-lead
 */
router.post('/send-service-lead', asyncHandler(async (req: Request, res: Response) => {
  const { service, name, phone, email, message, extras } = req.body;

  if (!service || !name || !phone) {
    return res.status(400).json({ error: 'Missing required fields: service, name, phone' });
  }

  const serviceLabels: Record<string, string> = {
    tiles: 'Tile Supply & Delivery',
    'tree-removal': 'Tree Removal',
    delivery: 'Local Van Delivery',
    freight: 'Freight Forwarding',
  };
  const serviceName = serviceLabels[service] || service;

  const submittedAt = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  // Build optional email row
  const emailRow = email
    ? `<tr>
        <td style="padding:5px 0;color:#6b7280;font-size:13px;">Email</td>
        <td style="padding:5px 0;font-size:13px;font-weight:600;">
          <a href="mailto:${email}" style="color:#3b82f6;text-decoration:none;">${email}</a>
        </td>
       </tr>`
    : '';

  // Build extras section
  const extrasHtml = extras && Object.keys(extras).length > 0
    ? `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:14px 18px;margin:16px 0;border-radius:0 6px 6px 0;font-size:13px;">
        <strong style="color:#374151;">Details</strong>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
          ${Object.entries(extras).map(([k, v]) =>
            `<tr>
              <td style="padding:4px 0;color:#6b7280;width:40%;text-transform:capitalize;">${String(k).replace(/_/g, ' ')}</td>
              <td style="padding:4px 0;font-weight:600;color:#111827;">${v}</td>
             </tr>`
          ).join('')}
        </table>
       </div>`
    : '';

  // Build message section
  const messageHtml = message
    ? `<div style="background:#f0f9ff;border-left:3px solid #3b82f6;padding:14px 18px;margin:16px 0;border-radius:0 6px 6px 0;font-size:13px;">
        <strong style="color:#374151;">Message</strong>
        <p style="margin:6px 0 0;color:#374151;line-height:1.6;">${message}</p>
       </div>`
    : '';

  const success = await brevoService.sendEmail({
    to: [{ email: 'infos@drivedrop.us.com', name: 'DriveDrop Team' }],
    templateType: 'service_lead',
    templateData: {
      serviceName,
      contactName: name,
      phone,
      emailRow,
      extrasHtml,
      messageHtml,
      submittedAt,
    }
  });

  if (!success) {
    return res.status(500).json({ error: 'Failed to send lead notification' });
  }

  return res.status(200).json(successResponse({ message: 'Lead notification sent' }));
}));

/**
 * Send document approval/rejection status to driver
 * POST /emails/send-document-status
 */
router.post('/send-document-status', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, documentType, status, rejectionReason } = req.body;

  if (!email || !documentType || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Missing required fields: email, documentType, status (approved|rejected)' });
  }

  const isApproved = status === 'approved';
  const dashboardUrl = `${process.env['FRONTEND_URL'] || 'https://drivedrop.us.com'}/dashboard/driver/documents`;

  const statusBlock = isApproved
    ? `<div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:14px;font-weight:700;color:#166534;">Document Approved</p>
        <p style="margin:6px 0 0;font-size:13px;color:#16a34a;">Your document has been verified and approved. You are good to go!</p>
       </div>`
    : `<div style="background:#fef2f2;border-left:3px solid #ef4444;padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:14px;font-weight:700;color:#991b1b;">Document Rejected</p>
        <p style="margin:6px 0 0;font-size:13px;color:#dc2626;">Please upload a new document. Reason:</p>
        <p style="margin:8px 0 0;font-size:13px;color:#7f1d1d;font-style:italic;">"${rejectionReason || 'No reason provided'}"</p>
       </div>`;

  const success = await brevoService.sendEmail({
    to: [{ email, name: firstName || 'Driver' }],
    templateType: 'document_status_updated',
    templateData: {
      firstName: firstName || 'Driver',
      documentType,
      statusLabel: isApproved ? 'approved' : 'rejected',
      statusBlock,
      dashboardUrl,
    }
  });

  if (!success) {
    return res.status(500).json({ error: 'Failed to send document status email' });
  }

  return res.status(200).json(successResponse({ message: 'Document status email sent' }));
}));

/**
 * Send service payment confirmation to customer
 * POST /emails/send-service-payment-confirmation
 */
router.post('/send-service-payment-confirmation', asyncHandler(async (req: Request, res: Response) => {
  const { email, customerName, serviceName, bookingRef, amount } = req.body;

  if (!email || !customerName || !serviceName || !bookingRef || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const paidDate = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const success = await brevoService.sendEmail({
    to: [{ email, name: customerName }],
    templateType: 'service_payment_confirmation',
    templateData: {
      customerName,
      serviceName,
      bookingRef,
      amount,
      paidDate,
    }
  });

  // Also notify internal team
  await brevoService.sendEmail({
    to: [{ email: 'infos@drivedrop.us.com', name: 'DriveDrop Services' }],
    templateType: 'service_payment_confirmation',
    templateData: {
      customerName,
      serviceName,
      bookingRef,
      amount,
      paidDate,
    }
  });

  if (!success) {
    return res.status(500).json({ error: 'Failed to send payment confirmation' });
  }

  return res.status(200).json(successResponse({ message: 'Payment confirmation sent' }));
}));

export default router;

