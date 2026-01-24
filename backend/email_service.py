# Email Service for Document Store
# Python Flask backend with SMTP integration

from flask import Flask, request, jsonify
from flask_cors import CORS
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)  # Allow requests from your frontend

# SMTP Configuration
SMTP_SERVER = "smtp.gmail.com"  # Change to your SMTP server
SMTP_PORT = 587
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "your-email@gmail.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "your-app-password")

def send_email(to_email, subject, body, html_body=None):
    """Send an email using SMTP"""
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
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        
        # Send email
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

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
    
    sent = send_email(email, subject, body, html_body)
    
    if sent:
        return jsonify({"success": True, "message": "Confirmation email sent"}), 200
    else:
        return jsonify({"success": False, "message": "Failed to send email"}), 500

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
    
    sent = send_email(email, subject, body, html_body)
    
    if sent:
        return jsonify({"success": True, "message": "Thank you email sent"}), 200
    else:
        return jsonify({"success": False, "message": "Email failed but feedback saved"}), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "email-service"}), 200

if __name__ == '__main__':
    # Run the server
    # For production, use a proper WSGI server like gunicorn
    app.run(host='0.0.0.0', port=5000, debug=True)
