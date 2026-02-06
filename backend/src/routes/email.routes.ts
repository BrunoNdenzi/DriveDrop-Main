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

export default router;
