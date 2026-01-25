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

# SMTP Configuration (Sender)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465  # Use port 465 for SSL configuration
MAIL_SENDER_EMAIL = os.environ.get("MAIL_SENDER_EMAIL", "your-email@gmail.com")
MAIL_SENDER_PASSWORD = os.environ.get("MAIL_SENDER_PASSWORD", "your-app-password")

# IMAP & Admin Configuration (Receiver)
IMAP_SERVER = "imap.gmail.com"
IMAP_PORT = 993
MAIL_RECEIVER_EMAIL = os.environ.get("MAIL_RECEIVER_EMAIL", "docustorecollegeerp@gmail.com")
MAIL_RECEIVER_PASSWORD = os.environ.get("MAIL_RECEIVER_PASSWORD", "your-app-password")

SMTP_DEBUG = os.environ.get("SMTP_DEBUG", "0") in ["1", "true", "True"]

def send_email(to_email, subject, body, html_body=None):
    """Send an email using SMTP_SSL on port 465."""
    server = None
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = MAIL_SENDER_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject

        # Add plain text and HTML versions
        msg.attach(MIMEText(body, 'plain'))
        if html_body:
            msg.attach(MIMEText(html_body, 'html'))

        # Use SMTP_SSL for Port 465
        print(f"Connecting to {SMTP_SERVER}:{SMTP_PORT}...")
        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=30)
        
        if SMTP_DEBUG:
            server.set_debuglevel(1)

        try:
            # Masked logging for verification on Render
            masked_email = f"{MAIL_SENDER_EMAIL[:3]}...{MAIL_SENDER_EMAIL[-3:]}" if len(MAIL_SENDER_EMAIL) > 6 else "***"
            masked_pass = f"{MAIL_SENDER_PASSWORD[:2]}...{MAIL_SENDER_PASSWORD[-2:]}" if len(MAIL_SENDER_PASSWORD) > 4 else "***"
            print(f"Logging in as {masked_email} (Length: {len(MAIL_SENDER_EMAIL)})")
            print(f"Using password starting with '{MAIL_SENDER_PASSWORD[:2]}...' (Length: {len(MAIL_SENDER_PASSWORD)})")
            
            server.login(MAIL_SENDER_EMAIL, MAIL_SENDER_PASSWORD)
            print("Login successful. Sending email...")
            server.sendmail(MAIL_SENDER_EMAIL, to_email, msg.as_string())
            print("Email sent successfully.")
            server.quit()
            return True, None
        except smtplib.SMTPAuthenticationError as auth_err:
            print(f"Authentication failed: {auth_err}")
            if server:
                server.quit()
            return False, "Authentication failed. Check your email and app-specific password."
        except Exception as e:
            print(f"Error during SMTP session: {e}")
            if server:
                try:
                    server.quit()
                except:
                    pass
            return False, str(e)

    except Exception as e:
        print(f"Connection failed: {e}")
        return False, f"Connection failed: {str(e)}"

@app.route('/api/send-support-email', methods=['POST'])
def send_support_email():
    """Send support ticket notification to admin only"""
    data = request.json
    
    user_email = data.get('email')
    ticket_type = data.get('type')
    description = data.get('desc')
    
    if not all([user_email, ticket_type, description]):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Send ONLY to Admin (docustorecollegeerp@gmail.com)
    subject = f"Support Ticket - {ticket_type}"
    body = f"""
New Support Ticket Received

From: {user_email}
Type: {ticket_type}

Description:
{description}

Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff8c00 0%, #ffa500 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">🎫 New Support Ticket</h1>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
                <div style="background: white; padding: 20px; border-left: 4px solid #ff8c00; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0 0 10px 0;"><strong>📧 From:</strong> {escape(user_email)}</p>
                    <p style="margin: 0 0 10px 0;"><strong>📋 Type:</strong> {escape(ticket_type)}</p>
                    <p style="margin: 0 0 10px 0;"><strong>📝 Description:</strong></p>
                    <p style="margin: 0; color: #555; background: #eee; padding: 15px; border-radius: 4px;">{escape(description)}</p>
                    <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
                        Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                    </p>
                </div>
            </div>
        </body>
    </html>
    """
    
    sent, err = send_email(MAIL_RECEIVER_EMAIL, subject, body, html_body)
    
    if sent:
        return jsonify({"success": True, "message": "Support ticket notification sent to admin"}), 200
    else:
        return jsonify({"success": False, "message": "Failed to send email to admin", "error": err}), 500

@app.route('/api/send-feedback-notification', methods=['POST'])
def send_feedback_notification():
    """Send feedback notification to admin only"""
    data = request.json
    
    name = data.get('name')
    rating = data.get('rating')
    comment = data.get('comment')
    email = data.get('email', "No Email Provided")
    
    if not all([name, rating, comment]):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Send ONLY to Admin (docustorecollegeerp@gmail.com)
    subject = f"New Feedback Received From: {name}"
    body = f"""
New Feedback Received

From: {name}
Email: {email}
Rating: {rating} / 5

Comment:
"{comment}"

Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff8c00 0%, #ffa500 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">✨ New User Feedback</h1>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
                <div style="background: white; padding: 20px; border-left: 4px solid #ff8c00; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0 0 10px 0;"><strong>👤 Name:</strong> {escape(name)}</p>
                    <p style="margin: 0 0 10px 0;"><strong>📧 Email:</strong> {escape(email)}</p>
                    <p style="margin: 0 0 10px 0;"><strong>⭐ Rating:</strong> {rating} / 5</p>
                    <p style="margin: 0 0 10px 0;"><strong>💬 Comment:</strong></p>
                    <p style="margin: 0; color: #555; background: #eee; padding: 15px; border-radius: 4px;">"{escape(comment)}"</p>
                    <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
                        Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                    </p>
                </div>
            </div>
        </body>
    </html>
    """
    
    sent, err = send_email(MAIL_RECEIVER_EMAIL, subject, body, html_body)
    
    if sent:
        return jsonify({"success": True, "message": "Feedback notification sent to admin"}), 200
    else:
        return jsonify({"success": False, "message": "Failed to send email to admin", "error": err}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "email-service"}), 200


def fetch_unseen_emails(max_messages=10):
    """Fetch unseen emails from the Gmail account via IMAP."""
    results = []
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(MAIL_RECEIVER_EMAIL, MAIL_RECEIVER_PASSWORD)
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
        mail.login(MAIL_RECEIVER_EMAIL, MAIL_RECEIVER_PASSWORD)
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
