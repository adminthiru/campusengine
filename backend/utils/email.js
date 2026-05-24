const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,        // false = STARTTLS on port 587
    requireTLS: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS  // Gmail App Password (16 chars, no spaces)
    },
    tls: { rejectUnauthorized: false }
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

const invitationEmail = (name, email, password, portalUrl, role, schoolName = 'School') => ({
  to: email,
  subject: `Your Teacher App Credentials — ${schoolName}`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6fb;padding:24px;">
      <div style="background:linear-gradient(135deg,#1a56e8,#3b82f6);border-radius:12px 12px 0 0;padding:32px 28px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:white;letter-spacing:-0.5px;">${schoolName}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;">School Management App</div>
      </div>
      <div style="background:white;border-radius:0 0 12px 12px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <h2 style="margin:0 0 6px;color:#0f172a;font-size:20px;">Welcome, ${name}! 👋</h2>
        <p style="color:#64748b;font-size:14px;margin:0 0 6px;">Your account has been set up as <strong style="color:#1a56e8;text-transform:capitalize;">${role}</strong> at <strong style="color:#0f172a;">${schoolName}</strong>.</p>
        <p style="color:#64748b;font-size:14px;margin:0 0 24px;">You can now log in to the <strong style="color:#0f172a;">Teacher App</strong> using the credentials below.</p>

        <div style="background:#f0f7ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:20px 22px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:8px 0;color:#64748b;width:110px;">Login ID</td>
              <td style="padding:8px 0;font-weight:600;color:#0f172a;">${email}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;border-top:1px solid #e0eaff;">Password</td>
              <td style="padding:8px 0;border-top:1px solid #e0eaff;">
                <span style="background:#1a56e8;color:white;padding:4px 16px;border-radius:6px;font-family:monospace;font-size:15px;font-weight:700;letter-spacing:1.5px;">${password}</span>
              </td>
            </tr>
          </table>
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#166534;">
          ✅ <strong>Next step:</strong> Open the Teacher App, log in with the credentials above, and change your password immediately from your profile settings.
        </div>

        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;font-size:13px;color:#9a3412;">
          ⚠️ <strong>Keep it safe:</strong> Do not share your login credentials with anyone. Contact your school administrator if you have any issues.
        </div>

        <p style="font-size:12px;color:#94a3b8;margin-top:28px;border-top:1px solid #f1f5f9;padding-top:16px;">
          This email was sent by ${schoolName}. If you didn't expect this, please contact your school administrator.
        </p>
      </div>
    </div>
  `
});

module.exports = { sendEmail, invitationEmail };
