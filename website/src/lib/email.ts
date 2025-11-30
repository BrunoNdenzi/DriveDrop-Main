import nodemailer from 'nodemailer'

// Create transporter using Gmail SMTP (fallback configuration)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'infos@calkons.com',
    pass: process.env.SMTP_PASS || 'vjnkgiuitlyyuwxs',
  },
})

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: from || process.env.SMTP_FROM || 'DriveDrop <infos@calkons.com>',
      to,
      subject,
      html,
    })

    console.log('✅ Email sent successfully:', { 
      messageId: info.messageId, 
      to, 
      subject 
    })
    return info
  } catch (error) {
    console.error('❌ Error sending email:', error)
    throw error
  }
}
