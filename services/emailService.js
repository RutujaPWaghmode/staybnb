const amqp = require("amqplib");
const nodemailer = require("nodemailer");

// Queue name for email notifications
const EMAIL_QUEUE = "email_notifications";

// RabbitMQ connection URL
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "your-email@gmail.com",
      pass: process.env.SMTP_PASS || "your-app-password",
    },
  });
};

// Email templates
const emailTemplates = {
  // Booking confirmation email
  bookingConfirmation: (data) => ({
    subject: `Booking Confirmed - ${data.propertyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .price { font-size: 24px; color: #16A34A; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; padding: 12px 24px; background: #EF4444; color: white; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Confirmed! 🎉</h1>
          </div>
          <div class="content">
            <p>Dear ${data.guestName},</p>
            <p>Your booking has been confirmed. Here are your booking details:</p>
            
            <div class="details">
              <h3>${data.propertyName}</h3>
              <p>📍 ${data.location}</p>
              <hr>
              <p><strong>Booking ID:</strong> ${data.bookingId}</p>
              <p><strong>Check-in:</strong> ${data.checkIn}</p>
              <p><strong>Check-out:</strong> ${data.checkOut}</p>
              <p><strong>Nights:</strong> ${data.nights}</p>
              <hr>
              <p class="price">Total: ₹${data.totalPrice.toLocaleString("en-IN")}</p>
            </div>
            
            <p>Thank you for choosing Airbnb Clone!</p>
            <p><a href="${process.env.APP_URL || "http://localhost:8090"}/bookings/my" class="btn">View My Bookings</a></p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact us at support@airbnbclone.com</p>
            <p>© ${new Date().getFullYear()} Airbnb Clone. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // Payment success email
  paymentSuccess: (data) => ({
    subject: `Payment Successful - ₹${data.amount.toLocaleString("en-IN")}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #16A34A; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .amount { font-size: 28px; color: #16A34A; font-weight: bold; text-align: center; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Successful ✓</h1>
          </div>
          <div class="content">
            <p>Dear ${data.guestName},</p>
            <p>We have received your payment successfully.</p>
            
            <div class="details">
              <p class="amount">₹${data.amount.toLocaleString("en-IN")}</p>
              <hr>
              <p><strong>Payment ID:</strong> ${data.paymentId}</p>
              <p><strong>Booking ID:</strong> ${data.bookingId}</p>
              <p><strong>Property:</strong> ${data.propertyName}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString("en-IN")}</p>
            </div>
            
            <p>Your booking is now confirmed. You can download your invoice from the booking details page.</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
            <p>© ${new Date().getFullYear()} Airbnb Clone. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // Booking cancellation email
  bookingCancellation: (data) => ({
    subject: `Booking Cancelled - ${data.propertyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .refund { background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 15px 0; }
          .refund-amount { font-size: 24px; color: #16A34A; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; padding: 12px 24px; background: #EF4444; color: white; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Cancelled</h1>
          </div>
          <div class="content">
            <p>Dear ${data.guestName},</p>
            <p>Your booking has been cancelled as requested.</p>
            
            <div class="details">
              <p><strong>Booking ID:</strong> ${data.bookingId}</p>
              <p><strong>Property:</strong> ${data.propertyName}</p>
              <p><strong>Check-in:</strong> ${data.checkIn}</p>
              <p><strong>Check-out:</strong> ${data.checkOut}</p>
              <p><strong>Original Amount:</strong> ₹${data.totalPrice.toLocaleString("en-IN")}</p>
              ${data.cancellationReason ? `<p><strong>Reason:</strong> ${data.cancellationReason}</p>` : ''}
            </div>
            
            ${data.refundAmount > 0 ? `
            <div class="refund">
              <h3 style="margin-top: 0; color: #1E40AF;">Refund Details</h3>
              <p><strong>Refund Percentage:</strong> ${data.refundPercent}%</p>
              <p class="refund-amount">Refund Amount: ₹${data.refundAmount.toLocaleString("en-IN")}</p>
              <p style="font-size: 12px; color: #666; margin-bottom: 0;">
                Your refund will be processed within 5-7 business days to your original payment method.
              </p>
            </div>
            ` : `
            <div class="refund" style="background: #FEF2F2; border-left-color: #DC2626;">
              <p style="margin: 0; color: #991B1B;">
                <strong>No refund applicable</strong> - Cancellation was made too close to the check-in date.
              </p>
            </div>
            `}
            
            <p>If this was a mistake or you have questions, please contact our support team.</p>
            <p><a href="${process.env.APP_URL || "http://localhost:8090"}/homes" class="btn">Browse Properties</a></p>
          </div>
          <div class="footer">
            <p>Thank you for using Airbnb Clone.</p>
            <p>© ${new Date().getFullYear()} Airbnb Clone. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

// Connection and channel cache
let connection = null;
let channel = null;

/**
 * Connect to RabbitMQ and create channel
 */
const connectRabbitMQ = async () => {
  try {
    if (connection && channel) {
      return { connection, channel };
    }

    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(EMAIL_QUEUE, { durable: true });

    console.log("Connected to RabbitMQ");

    connection.on("close", () => {
      console.log("RabbitMQ connection closed");
      connection = null;
      channel = null;
    });

    return { connection, channel };
  } catch (error) {
    console.error("RabbitMQ connection error:", error.message);
    // Return null but don't crash - emails will be sent directly
    return { connection: null, channel: null };
  }
};

/**
 * Send email notification to queue
 * Falls back to direct send if RabbitMQ is unavailable
 */
const queueEmail = async (type, data) => {
  try {
    const { channel } = await connectRabbitMQ();

    if (channel) {
      // Queue the email for async processing
      const message = JSON.stringify({ type, data, timestamp: new Date() });
      channel.sendToQueue(EMAIL_QUEUE, Buffer.from(message), { persistent: true });
      console.log(`Email queued: ${type} for ${data.email}`);
      return true;
    } else {
      // Fallback: send directly if RabbitMQ unavailable
      console.log("RabbitMQ unavailable, sending email directly");
      await sendEmailDirect(type, data);
      return true;
    }
  } catch (error) {
    console.error("Queue email error:", error.message);
    // Try direct send as fallback
    try {
      await sendEmailDirect(type, data);
      return true;
    } catch (e) {
      console.error("Direct email also failed:", e.message);
      return false;
    }
  }
};

/**
 * Send email directly (used as fallback or by consumer)
 */
const sendEmailDirect = async (type, data) => {
  try {
    const template = emailTemplates[type];
    if (!template) {
      throw new Error(`Unknown email template: ${type}`);
    }

    const { subject, html } = template(data);
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Airbnb Clone" <${process.env.SMTP_USER || "noreply@airbnbclone.com"}>`,
      to: data.email,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${type} to ${data.email} - ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Send email error (${type}):`, error.message);
    throw error;
  }
};

/**
 * Start email consumer (process queued emails)
 * Call this in app.js to start processing emails
 */
const startEmailConsumer = async () => {
  try {
    const { channel } = await connectRabbitMQ();

    if (!channel) {
      console.log("Email consumer not started - RabbitMQ unavailable");
      return;
    }

    console.log("Email consumer started, waiting for messages...");

    channel.consume(
      EMAIL_QUEUE,
      async (msg) => {
        if (msg) {
          try {
            const { type, data } = JSON.parse(msg.content.toString());
            await sendEmailDirect(type, data);
            channel.ack(msg);
          } catch (error) {
            console.error("Email consumer error:", error.message);
            // Negative ack - requeue the message
            channel.nack(msg, false, true);
          }
        }
      },
      { noAck: false }
    );
  } catch (error) {
    console.error("Start consumer error:", error.message);
  }
};

// Export functions
module.exports = {
  queueEmail,
  sendEmailDirect,
  startEmailConsumer,
  connectRabbitMQ,
  // Email types for reference
  EMAIL_TYPES: {
    BOOKING_CONFIRMATION: "bookingConfirmation",
    PAYMENT_SUCCESS: "paymentSuccess",
    BOOKING_CANCELLATION: "bookingCancellation",
  },
};
