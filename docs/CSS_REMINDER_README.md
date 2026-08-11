# CSS Group Payment Reminder Email Script

This script sends reminder emails to accepted CSS members, EA applicants, committee staff, admin/staff users, and EB members to remind them to pay their membership fee and join the official CSS Group on Facebook.

## Target Recipients

The script automatically identifies and sends emails to:

1. **Accepted Member Applicants** - Users with accepted member applications
2. **Accepted EA Applicants** - Users with accepted Executive Assistant applications
3. **Accepted Committee Staff** - Users with accepted committee staff applications
4. **Admin/Staff Users** - Users with admin or super_admin roles
5. **EB Members** - Users with Executive Board profiles

## Prerequisites

### Environment Variables

Make sure these environment variables are set in your `.env.local` file:

```env
# Brevo Email Service
BREVO_API_KEY="your-brevo-api-key-here"
BREVO_FROM_EMAIL="noreply@yourdomain.com"

# Database
DATABASE_URL="your-postgresql-connection-string"
```

### Dependencies

The script uses existing project dependencies:

- `@prisma/client` - Database access
- `@getbrevo/brevo` - Email sending service

## Usage

### Method 1: Using npm script (Recommended)

```bash
npm run send-css-reminder
```

### Method 2: Direct execution

```bash
node send-css-group-reminder.js
```

## What the Script Does

1. **Queries Database**: Fetches all target users from the database
2. **Removes Duplicates**: Ensures each user receives only one email
3. **Sends Emails**: Sends personalized reminder emails to each user
4. **Provides Summary**: Shows success/failure statistics

## Email Content

The email includes:

- Professional CSSApply branding
- Personalized greeting with user's name
- Clear call-to-action to join the CSS Group
- Facebook group link: `https://fb.me/g/6WRg4o62h/xpTx6zKB`
- Instructions about membership fee payment
- Contact information for questions

## Output Example

```
🎯 CSS Group Payment Reminder Email Script
==========================================

✅ Environment variables validated
🔍 Fetching target users...
📊 Found 45 unique target users:
   - Accepted Members: 20
   - Accepted EAs: 8
   - Accepted Committee Staff: 12
   - Admin/Staff: 3
   - EB Members: 2
📤 Sending emails to 45 users...
✅ Sent to John Doe (john.doe@example.com)
✅ Sent to Jane Smith (jane.smith@example.com)
...

📊 Email Campaign Summary:
✅ Successfully sent: 44
❌ Failed to send: 1
📧 Total recipients: 45

🎉 CSS Group reminder email campaign completed!
```

## Error Handling

- **Environment Validation**: Checks for required environment variables
- **Database Errors**: Handles database connection issues gracefully
- **Email Failures**: Continues sending even if some emails fail
- **Rate Limiting**: Adds small delays between emails to avoid rate limits
- **Cleanup**: Properly disconnects from database on exit

## Safety Features

- **Duplicate Prevention**: Removes duplicate recipients based on email address
- **Graceful Interruption**: Handles Ctrl+C and termination signals
- **Detailed Logging**: Provides comprehensive logs for debugging
- **Error Reporting**: Lists all failed emails with error details

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**

   ```
   ❌ Missing required environment variables:
      - BREVO_API_KEY
   ```

   **Solution**: Set the required environment variables in `.env.local`

2. **Database Connection Error**

   ```
   ❌ Error fetching target users: Error: connect ECONNREFUSED
   ```

   **Solution**: Check your `DATABASE_URL` and ensure the database is running

3. **Email Sending Failures**
   ```
   ❌ Error sending email to user@example.com: Invalid API key
   ```
   **Solution**: Verify your `BREVO_API_KEY` and `BREVO_FROM_EMAIL` are correct

### Debug Mode

To see more detailed output, you can modify the script to include additional logging or run it in a development environment where console.log output is more verbose.

## Customization

### Modifying Email Content

Edit the `createReminderEmailTemplate` function in `send-css-group-reminder.js` to customize:

- Email subject
- Email body content
- Styling and branding
- Call-to-action text

### Adding Recipients

To include additional user types, modify the `getTargetUsers` function to add new database queries.

### Changing the Facebook Link

Update the `CSS_GROUP_LINK` constant at the top of the script.

## Security Notes

- The script uses environment variables for sensitive information
- Email addresses are logged for debugging purposes
- No sensitive user data is exposed in logs
- Database queries use Prisma's built-in security features

## Support

If you encounter issues with this script:

1. Check the troubleshooting section above
2. Verify all environment variables are set correctly
3. Ensure the database is accessible
4. Check Brevo API credentials and sender email verification
5. Review the detailed error logs provided by the script
