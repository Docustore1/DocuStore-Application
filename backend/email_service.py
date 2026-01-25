# Email Service for Document Store - SendGrid Version
# Python Flask backend with SendGrid API integration

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import os
from html import escape
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Load environment variables
load_dotenv()

@app.route('/')
def home():
    return jsonify({
        "message": "DocuStore Email Service API is running",
        "provider": "SendGrid",
        "endpoints": {
            "health": "/health",
            "support": "/api/send-support-email (POST)",
            "feedback": "/api/send-feedback-notification (POST)"
        },
        "status": "online"
    }), 200

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
MAIL_SENDER_EMAIL = os.environ.get("MAIL_SENDER_EMAIL", "techbyte659@gmail.com")
MAIL_RECEIVER_EMAIL = os.environ.get("MAIL_RECEIVER_EMAIL", "docustorecollegeerp@gmail.com")

def send_email(to_email, subject, body, html_body=None, user_email=None):
    """Send an email using SendGrid API."""
    try:
        # Create sender with display name
        from_email = Email(MAIL_SENDER_EMAIL, "DocuStore Notifications")
        
        # Create recipient
        to = To(to_email)
        
        # Use HTML if provided, otherwise plain text
        if html_body:
            content = Content("text/html", html_body)
        else:
            content = Content("text/plain", body)
        
        # Create Mail object
        mail = Mail(from_email, to, subject, content)
        
        # Set reply-to if user email is provided
        if user_email:
            mail.reply_to = Email(user_email)
        
        # Send via SendGrid
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(mail)
        
        print(f"DEBUG: SendGrid response status: {response.status_code}")
        
        if response.status_code in [200, 201, 202]:
            return True, None
        else:
            return False, f"SendGrid returned status {response.status_code}"
            
    except Exception as e:
        error_msg = str(e)
        print(f"DEBUG: SendGrid error: {error_msg}")
        return False, error_msg

@app.route('/api/send-support-email', methods=['POST'])
def send_support_email():
    """Send support ticket notification to admin only"""
    data = request.json
    
    user_email = data.get('email')
    ticket_type = data.get('type')
    description = data.get('desc')
    
    if not all([user_email, ticket_type, description]):
        return jsonify({"error": "Missing required fields"}), 400
    
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
    
    sent, err = send_email(MAIL_RECEIVER_EMAIL, subject, body, html_body, user_email=user_email)
    
    if sent:
        return jsonify({"success": True, "message": "Support ticket sent via SendGrid"}), 200
    else:
        return jsonify({"success": False, "message": "Failed to send email", "error": err}), 500

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
    
    subject = f"New Feedback From: {name}"
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
    
    sent, err = send_email(MAIL_RECEIVER_EMAIL, subject, body, html_body, user_email=email)
    
    if sent:
        return jsonify({"success": True, "message": "Feedback sent via SendGrid"}), 200
    else:
        return jsonify({"success": False, "message": "Failed to send email", "error": err}), 500

@app.route('/health', methods=['GET'])
def health():
    has_api_key = bool(SENDGRID_API_KEY and len(SENDGRID_API_KEY) > 10)
    return jsonify({
        "status": "healthy",
        "service": "email-service-sendgrid",
        "api_key_configured": has_api_key
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
