# Brevo Email Integration Setup

This document explains how to set up Brevo email integration for the CSS Apply application.

## Prerequisites

1. A Brevo account (formerly Sendinblue)
2. Access to your Brevo API key

## Setup Steps

### 1. Get Your Brevo API Key

1. Log in to your [Brevo account](https://app.brevo.com/)
2. Go to **Settings** > **API Keys**
3. Create a new API key or use an existing one
4. Copy the API key

### 2. Configure Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Brevo Email Service
BREVO_API_KEY="your-brevo-api-key-here"
BREVO_FROM_EMAIL="noreply@yourdomain.com"
```

**Important Notes:**

- Replace `your-brevo-api-key-here` with your actual Brevo API key
- Replace `noreply@yourdomain.com` with a verified sender email address in your Brevo account
- The sender email must be verified in your Brevo account to send emails

### 3. Verify Sender Email

1. In your Brevo dashboard, go to **Settings** > **Senders & IP**
2. Add and verify the email address you want to use as the sender
3. This email will appear as the "From" address in all application confirmation emails

## Features

The email integration includes:

### Automatic Email Notifications

When users submit applications, they automatically receive confirmation emails for:

1. **Member Applications** - Basic membership applications
2. **Committee Staff Applications** - Applications for committee positions
3. **Executive Assistant Applications** - Applications for executive assistant roles

### Email Templates

Each application type has a customized email template that includes:

- Professional CSS Apply branding
- Application details (student number, application type, choices)
- Status information
- Contact information for questions

### Error Handling

- Email sending failures don't affect application submission
- All email errors are logged for debugging
- Applications are processed even if email delivery fails

## Testing

To test the email functionality:

1. Ensure your environment variables are set correctly
2. Submit a test application through the application form
3. Check the console logs for email sending status
4. Verify the email is received in the applicant's inbox

## Troubleshooting

### Common Issues

1. **"Invalid API key" error**
   - Verify your `BREVO_API_KEY` is correct
   - Ensure the API key has the necessary permissions

2. **"Sender not verified" error**
   - Verify the sender email in your Brevo account
   - Update `BREVO_FROM_EMAIL` to use a verified sender

3. **Emails not being received**
   - Check spam/junk folders
   - Verify the recipient email address is correct
   - Check Brevo dashboard for delivery status

### Debug Mode

To enable detailed logging, check the console output when submitting applications. The system logs:

- Successful email sends with message IDs
- Failed email attempts with error details

## Security Notes

- Never commit your actual API keys to version control
- Use environment variables for all sensitive configuration
- Regularly rotate your API keys for security
- Monitor your Brevo account for unusual activity

## Support

For Brevo-specific issues, refer to the [Brevo API documentation](https://developers.brevo.com/).
