const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email error:', err.message);
    return { success: false, error: err.message };
  }
};

const invitationEmail = (name, email, password, portalUrl, role) => ({
  to: email,
  subject: 'Welcome to School Management Portal - Your Login Credentials',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">School Management Portal</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        <h2 style="color: #1e3a5f;">Welcome, ${name}!</h2>
        <p>Your account has been created as <strong>${role}</strong>. Here are your login credentials:</p>
        <div style="background: #f0f4ff; border: 1px solid #2563eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Portal URL:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
        </div>
        <p style="color: #e74c3c;"><strong>Important:</strong> Please change your password after first login.</p>
        <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; margin-top: 10px;">Login Now</a>
      </div>
    </div>
  `
});

module.exports = { sendEmail, invitationEmail };
