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

  const loginUrl = `${process.env['FRONTEND_URL'] || 'https://drivedrop.us.com'}/login`;

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
    `${licenseFrontUrl ? '✓' : '✗'} Driver License (Front)`,
    `${licenseBackUrl ? '✓' : '✗'} Driver License (Back)`,
    `${proofOfAddressUrl ? '✓' : '✗'} Proof of Address`,
    `${insuranceProofUrl ? '✓' : '✗'} Insurance Document`
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

export default router;
