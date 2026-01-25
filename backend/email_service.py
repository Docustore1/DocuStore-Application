# Email Service for Document Store - FIXED VERSION 2.0
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
# Explicitly allow all origins for API to prevent CORS issues on Render
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Load environment variables
load_dotenv()

# SMTP Configuration
SMTP_SERVER = "smtp.gmail.com"
MAIL_SENDER_EMAIL = os.environ.get("MAIL_SENDER_EMAIL")
MAIL_SENDER_PASSWORD = os.environ.get("MAIL_SENDER_PASSWORD")
MAIL_RECEIVER_EMAIL = os.environ.get("MAIL_RECEIVER_EMAIL", "docustorecollegeerp@gmail.com")
MAIL_RECEIVER_PASSWORD = os.environ.get("MAIL_RECEIVER_PASSWORD")

# IMAP Configuration
IMAP_SERVER = "imap.gmail.com"
IMAP_PORT = 993

def send_email(to_email, subject, body, html_body=None, user_email=None):
    """Send an email with port fallback and detailed logging."""
    msg = MIMEMultipart('alternative')
    msg['From'] = f"DocuStore Notifications <{MAIL_SENDER_EMAIL}>"
    msg['To'] = to_email
    msg['Reply-To'] = user_email if user_email else MAIL_SENDER_EMAIL
    msg['Subject'] = subject
    
    msg.attach(MIMEText(body, 'plain'))
    if html_body:
        msg.attach(MIMEText(html_body, 'html'))

    # Try Port 587 (STARTTLS) then 465 (SSL)
    ports = [(587, False), (465, True)]
    last_error = "None"

    for port, use_ssl in ports:
        server = None
        try:
            print(f"DEBUG: Attempting port {port}...")
            if use_ssl:
                server = smtplib.SMTP_SSL(SMTP_SERVER, port, timeout=10)
            else:
                server = smtplib.SMTP(SMTP_SERVER, port, timeout=10)
                server.starttls()
            
            server.login(MAIL_SENDER_EMAIL, MAIL_SENDER_PASSWORD)
            server.sendmail(MAIL_SENDER_EMAIL, to_email, msg.as_string())
            server.quit()
            print(f"DEBUG: Success on port {port}")
            return True, None
        except Exception as e:
            last_error = str(e)
            print(f"DEBUG: Port {port} failed: {last_error}")
            if server:
                try: server.close()
                except: pass
            continue
            
    return False, last_error

@app.route('/api/send-support-email', methods=['POST'])
def send_support_email():
    data = request.json
    user_email = data.get('email')
    ticket_type = data.get('type')
    description = data.get('desc')
    
    if not all([user_email, ticket_type, description]):
        return jsonify({"error": "Missing fields"}), 400
    
    subject = f"Support Ticket - {ticket_type}"
    body = f"From: {user_email}\nType: {ticket_type}\n\n{description}"
    
    sent, err = send_email(MAIL_RECEIVER_EMAIL, subject, body, user_email=user_email)
    if sent:
        return jsonify({"success": True}), 200
    return jsonify({"success": False, "error": err}), 500

@app.route('/api/send-feedback-notification', methods=['POST'])
def send_feedback_notification():
    data = request.json
    name = data.get('name')
    rating = data.get('rating')
    comment = data.get('comment')
    email = data.get('email', "No Email")
    
    if not all([name, rating, comment]):
        return jsonify({"error": "Missing fields"}), 400
    
    subject = f"New Feedback From: {name}"
    body = f"From: {name} ({email})\nRating: {rating}/5\n\n{comment}"
    
    sent, err = send_email(MAIL_RECEIVER_EMAIL, subject, body, user_email=email)
    if sent:
        return jsonify({"success": True}), 200
    return jsonify({"success": False, "error": err}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
