# Email Service for Document Store
# Python Flask backend with SMTP integration

from flask import Flask, request, jsonify
from flask_cors import CORS
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os
import imaplib
import email
from email.header import decode_header
from html import escape
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)  # Allow requests from your frontend

# Load environment variables from .env if present
load_dotenv()

# SMTP Configuration
SMTP_SERVER = "smtp.gmail.com"  # Change to your SMTP server
SMTP_PORT = 587
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "your-email@gmail.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "your-app-password")
IMAP_SERVER = "imap.gmail.com"
IMAP_PORT = 993
SMTP_DEBUG = os.environ.get("SMTP_DEBUG", "0") in ["1", "true", "True"]

def send_email(to_email, subject, body, html_body=None):
    """Send an email using SMTP.

    Returns (success: bool, error_message: Optional[str])
    """
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject

        # Add plain text and HTML versions
        msg.attach(MIMEText(body, 'plain'))
        if html_body:
            msg.attach(MIMEText(html_body, 'html'))

        # Connect to SMTP server
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=30)
        server.ehlo()
        server.starttls()
        server.ehlo()
        if SMTP_DEBUG:
            server.set_debuglevel(1)

        try:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
        except smtplib.SMTPAuthenticationError as auth_err:
            server.quit()
            return False, f"Authentication failed: {auth_err}"

        # Send email
        server.send_message(msg)
        server.quit()

        return True, None
    except Exception as e:
        try:
            server.quit()
        except Exception:
            pass
        err = str(e)
        print(f"Error sending email: {err}")
        return False, err

@app.route('/api/send-support-email', methods=['POST'])
def send_support_email():
    """Send support ticket confirmation email to user"""
    data = request.json
    
    email = data.get('email')
    ticket_type = data.get('type')
    description = data.get('desc')
    
    if not all([email, ticket_type, description]):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Confirmation email to user
    subject = "Support Ticket Received - MS College Document Store"
    body = f"""
Dear User,

Thank you for contacting MS College Document Store support.

We have received your ticket and will review it shortly.

Ticket Details:
Type: {ticket_type}
Description: {description}
Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Best regards,
MS College Support Team
"""
    
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff8c00 0%, #ffa500 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">Support Ticket Received</h1>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
                <p>Dear User,</p>
                <p>Thank you for contacting <strong>MS College Document Store</strong> support.</p>
                <p>We have received your ticket and will review it shortly.</p>
                
                <div style="background: white; padding: 20px; border-left: 4px solid #ff8c00; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0 0 10px 0;"><strong>Ticket Type:</strong> {ticket_type}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Description:</strong></p>
                    <p style="margin: 0; color: #555;">{description}</p>
                    <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
                        Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                    </p>
                </div>
                
                <p>Best regards,<br/>
                <strong>MS College Support Team</strong></p>
            </div>
            
            <div style="background: #333; padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>This is an automated confirmation email from MS College Document Store</p>
            </div>
        </body>
    </html>
    """
    
    sent, err = send_email(email, subject, body, html_body)

    if sent:
        return jsonify({"success": True, "message": "Confirmation email sent"}), 200
    else:
        return jsonify({"success": False, "message": "Failed to send email", "error": err}), 500

@app.route('/api/send-feedback-notification', methods=['POST'])
def send_feedback_notification():
    """Send feedback confirmation email to user"""
    data = request.json
    
    name = data.get('name')
    rating = data.get('rating')
    comment = data.get('comment')
    email = data.get('email', None)  # Optional
    
    if not all([name, rating, comment]):
        return jsonify({"error": "Missing required fields"}), 400
    
    # If no email provided, just return success (feedback saved to Firebase)
    if not email:
        return jsonify({"success": True, "message": "Feedback saved"}), 200
    
    # Thank you email to user
    subject = "Thank You for Your Feedback - MS College Document Store"
    body = f"""
Dear {name},

Thank you for taking the time to share your feedback with MS College Document Store!

Your {rating}-star rating and comments help us improve our service.

Your Feedback:
"{comment}"

We appreciate your input!

Best regards,
MS College Team
"""
    
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff8c00 0%, #ffa500 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">Thank You!</h1>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
                <p>Dear {name},</p>
                <p>Thank you for taking the time to share your feedback with <strong>MS College Document Store</strong>!</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <div style="font-size: 32px; color: #ffa500; margin-bottom: 10px;">
                        {'⭐' * int(rating)}
                    </div>
                    <p style="font-style: italic; color: #555; margin: 15px 0;">
                        "{comment}"
                    </p>
                </div>
                
                <p>Your feedback helps us improve our service!</p>
                
                <p>Best regards,<br/>
                <strong>MS College Team</strong></p>
            </div>
            
            <div style="background: #333; padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>This is an automated thank you email from MS College Document Store</p>
            </div>
        </body>
    </html>
    """
    
    # Send to user
    results = []
    try:
        sent_user, err_user = send_email(email, subject, body, html_body)
        results.append({"to": email, "sent": sent_user, "error": err_user})
    except Exception as e:
        results.append({"to": email, "sent": False, "error": str(e)})

    # Send admin copy to SMTP_EMAIL (owner)
    try:
        admin_subject = f"New Feedback Received - {name or 'Anonymous'}"
        admin_body = f"Feedback received from {name or 'Anonymous'} ({email or 'no email provided'}).\n\nRating: {rating}\n\nComment:\n{comment}\n\nSubmitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        admin_html = f"<html><body><h2>New Feedback Received</h2><p><strong>From:</strong> {escape(email or 'Anonymous')}</p><p><strong>Rating:</strong> {rating}</p><p><strong>Comment:</strong><br/>{escape(comment)}</p><p style=\"color:#999;\">Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p></body></html>"
        sent_admin, err_admin = send_email(SMTP_EMAIL, admin_subject, admin_body, admin_html)
        results.append({"to": SMTP_EMAIL, "sent": sent_admin, "error": err_admin})
    except Exception as e:
        results.append({"to": SMTP_EMAIL, "sent": False, "error": str(e)})

    ok = any(r.get('sent') for r in results)
    if ok:
        return jsonify({"success": True, "message": "Thank you email sent", "results": results}), 200
    else:
        return jsonify({"success": False, "message": "Email failed but feedback saved", "results": results}), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "email-service"}), 200


def fetch_unseen_emails(max_messages=10):
    """Fetch unseen emails from the Gmail account via IMAP."""
    results = []
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(SMTP_EMAIL, SMTP_PASSWORD)
        mail.select("inbox")

        typ, data = mail.search(None, 'UNSEEN')
        if typ != 'OK':
            return results

        ids = data[0].split()
        # Limit number of fetched messages
        ids = ids[-max_messages:]

        for msg_id in ids:
            typ, msg_data = mail.fetch(msg_id, '(RFC822)')
            if typ != 'OK':
                continue

            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)

            # Decode subject
            subj, enc = decode_header(msg.get('Subject', ''))[0]
            if isinstance(subj, bytes):
                subj = subj.decode(enc or 'utf-8', errors='ignore')

            from_ = msg.get('From')
            date_ = msg.get('Date')

            # Get a text snippet
            snippet = ''
            if msg.is_multipart():
                for part in msg.walk():
                    ctype = part.get_content_type()
                    cdisp = str(part.get('Content-Disposition'))
                    if ctype == 'text/plain' and 'attachment' not in cdisp:
                        payload = part.get_payload(decode=True)
                        if payload:
                            snippet = payload.decode(part.get_content_charset() or 'utf-8', errors='ignore')
                            break
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    snippet = payload.decode(msg.get_content_charset() or 'utf-8', errors='ignore')

            results.append({
                'id': msg_id.decode('utf-8'),
                'subject': subj,
                'from': from_,
                'date': date_,
                'snippet': snippet[:500]
            })

        mail.logout()
    except Exception as e:
        print(f"Error fetching emails: {e}")

    return results


@app.route('/api/fetch-emails', methods=['GET'])
def api_fetch_emails():
    """API endpoint to fetch unseen emails (read-only)."""
    try:
        max_messages = int(request.args.get('max', 10))
    except Exception:
        max_messages = 10

    emails = fetch_unseen_emails(max_messages=max_messages)
    return jsonify({'emails': emails}), 200


def search_emails_by_subject(subject, max_messages=20):
    results = []
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(SMTP_EMAIL, SMTP_PASSWORD)
        mail.select('inbox')

        # Search by subject (case-insensitive)
        typ, data = mail.search(None, '(SUBJECT "' + subject.replace('"', '') + '")')
        if typ != 'OK':
            mail.logout()
            return results

        ids = data[0].split()
        ids = ids[-max_messages:]

        for msg_id in ids:
            typ, msg_data = mail.fetch(msg_id, '(RFC822)')
            if typ != 'OK':
                continue
            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)
            subj, enc = decode_header(msg.get('Subject', ''))[0]
            if isinstance(subj, bytes):
                subj = subj.decode(enc or 'utf-8', errors='ignore')
            from_ = msg.get('From')
            date_ = msg.get('Date')
            snippet = ''
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == 'text/plain' and 'attachment' not in str(part.get('Content-Disposition')):
                        payload = part.get_payload(decode=True)
                        if payload:
                            snippet = payload.decode(part.get_content_charset() or 'utf-8', errors='ignore')
                            break
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    snippet = payload.decode(msg.get_content_charset() or 'utf-8', errors='ignore')

            results.append({'id': msg_id.decode('utf-8'), 'subject': subj, 'from': from_, 'date': date_, 'snippet': snippet[:500]})

        mail.logout()
    except Exception as e:
        print(f"Error searching emails: {e}")
    return results


@app.route('/api/search-emails', methods=['GET'])
def api_search_emails():
    subject = request.args.get('subject', '')
    try:
        max_messages = int(request.args.get('max', 20))
    except Exception:
        max_messages = 20

    if not subject:
        return jsonify({'error': 'subject parameter required'}), 400

    emails = search_emails_by_subject(subject, max_messages=max_messages)
    return jsonify({'emails': emails}), 200


@app.route('/api/test-email', methods=['POST'])
def api_test_email():
    """Endpoint to test sending an email and return server errors for debugging.

    JSON body: {"email": "recipient@example.com", "subject": "sub", "body": "text"}
    """
    data = request.json or {}
    to_email = data.get('email')
    subject = data.get('subject', 'Test message from DocuStore')
    body = data.get('body', 'This is a test message.')

    if not to_email:
        return jsonify({"error": "Missing 'email' in request body"}), 400

    sent, err = send_email(to_email, subject, body)
    if sent:
        return jsonify({"success": True, "message": "Test email sent"}), 200
    else:
        return jsonify({"success": False, "message": "Test email failed", "error": err}), 500

if __name__ == '__main__':
    # Run the server
    # For production, use a proper WSGI server like gunicorn
    app.run(host='0.0.0.0', port=5000, debug=True)
