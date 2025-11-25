import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
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
      from: from || process.env.SMTP_FROM || 'DriveDrop <noreply@drivedrop.com>',
      to,
      subject,
      html,
    })

    console.log('Email sent:', info.messageId)
    return info
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}
