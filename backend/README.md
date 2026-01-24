# Python Email Service Setup Guide

## Prerequisites
- Python 3.8 or higher
- Gmail account (or any SMTP provider)

## Installation Steps

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Email Settings

Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

Edit `.env` and add your credentials:
```
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ADMIN_EMAIL=support@yourdomain.com
```

### 3. Generate Gmail App Password

For Gmail (recommended):
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Click "Security" → "2-Step Verification" → Enable it
3. Go to "App passwords" → Create new app password
4. Copy the password to `.env` file

### 4. Start the Email Service

```bash
python email_service.py
```

The server will run on `http://localhost:5000`

### 5. Update Your Frontend

Add these functions to your `script.js`:

```javascript
// Send support ticket with email notification
async function submitSupportTicket(ticketData) {
    // Submit to Firebase first
    await window.fbSubmitTicket(ticketData);
    
    // Send email notification
    try {
        await fetch('http://localhost:5000/api/send-support-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ticketData)
        });
        console.log("✅ Email sent!");
    } catch (e) {
        console.error("Email failed:", e);
    }
}

// Send feedback with email notification
async function submitFeedback(feedbackData) {
    // Submit to Firebase first
    await window.fbSubmitFeedback(feedbackData);
    
    // Send email notification
    try {
        await fetch('http://localhost:5000/api/send-feedback-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedbackData)
        });
        console.log("✅ Email sent!");
    } catch (e) {
        console.error("Email failed:", e);
    }
}
```

## Testing

Test the email service:
```bash
curl -X POST http://localhost:5000/api/send-support-email \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","type":"Technical","desc":"Test ticket"}'
```

## Production Deployment

For production, use **gunicorn**:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 email_service:app
```

Or deploy to:
- **Heroku**: `git push heroku main`
- **PythonAnywhere**: Upload files and configure WSGI
- **AWS/Google Cloud**: Deploy as containerized app

## Troubleshooting

**"Authentication failed"**
- Double-check your App Password (not your regular password)
- Ensure 2FA is enabled on Gmail

**"Connection refused"**
- Check firewall settings
- Verify SMTP port (587 for TLS)

**CORS errors**
- Update `CORS(app)` to allow your frontend domain in production
