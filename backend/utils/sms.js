const twilio = require('twilio');
const SmsLog = require('../models/SmsLog');
const School = require('../models/School');
const otpStore = new Map(); // phone -> { otp, expiresAt }

const translations = {
  en: {
    absent: (name, date, period) => `Dear Parent, Your child ${name} was marked ABSENT for Period ${period} on ${date}. Contact school for details.`,
    consecutive_absent: (name, days) => `Alert: ${name} has been absent for ${days} consecutive days. Please contact school immediately.`,
    fee_reminder: (name, amount, due) => `Dear Parent, Fee of Rs.${amount} for ${name} is due on ${due}. Please pay at the earliest.`,
    fee_paid: (name, amount, receipt) => `Fee payment of Rs.${amount} received for ${name}. Receipt No: ${receipt}. Thank you.`,
    exam_schedule: (name, exam, date) => `Dear Parent, ${name}'s ${exam} exam is scheduled on ${date}. Please ensure your child is prepared.`,
    result_published: (name, exam, percent) => `Dear Parent, Result for ${name} in ${exam} has been published. Percentage: ${percent}%. Login to view details.`,
    invitation: (name, portal, user, pass) => `Welcome ${name}! Your school portal login - URL: ${portal} | Username: ${user} | Password: ${pass}`,
    timetable: (className, day) => `Timetable for ${className} on ${day} has been updated. Login to view details.`,
    salary_paid: (name, amount, month) => `Dear ${name}, Your salary of Rs.${amount} for ${month} has been processed. Login to view payslip.`,
    otp: (otp) => `Your OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`,
    holiday: (name) => `Holiday Notice: ${name}. School will remain closed. Have a great day!`,
    emergency: (msg) => `URGENT: ${msg}. Please contact school immediately.`,
    ptmeeting: (date, time) => `Parent-Teacher Meeting is scheduled on ${date} at ${time}. Your presence is requested.`,
    homework: (subject, desc) => `Homework assigned for ${subject}: ${desc}. Due tomorrow.`,
    circular: (title) => `New Circular: ${title}. Please login to the school portal to read more.`,
    transport: (route, delay) => `Transport Alert: Route ${route} is delayed by ${delay} minutes. Please plan accordingly.`
  },
  ta: {
    absent: (name, date, period) => `அன்பான பெற்றோர், ${name} ${date} அன்று ${period}வது பாடவேளையில் வருகைப்பதிவில் இல்லை.`,
    consecutive_absent: (name, days) => `${name} தொடர்ந்து ${days} நாட்களாக பள்ளிக்கு வரவில்லை.`,
    fee_reminder: (name, amount, due) => `${name} இன் கட்டணம் Rs.${amount} ${due} தேதிக்குள் செலுத்தவும்.`,
    fee_paid: (name, amount, receipt) => `${name} இன் Rs.${amount} கட்டணம் பெறப்பட்டது. ரசீது: ${receipt}.`,
    exam_schedule: (name, exam, date) => `${name} யின் ${exam} தேர்வு ${date} அன்று நடைபெறும்.`,
    result_published: (name, exam, percent) => `${name} யின் ${exam} முடிவு வெளியிடப்பட்டது. சதவீதம்: ${percent}%.`,
    invitation: (name, portal, user, pass) => `வணக்கம் ${name}! URL: ${portal} | பயனர்: ${user} | கடவுச்சொல்: ${pass}`,
    timetable: (className, day) => `${className} வகுப்பின் ${day} அட்டவணை புதுப்பிக்கப்பட்டது.`,
    salary_paid: (name, amount, month) => `${name} அவர்களுக்கு ${month} சம்பளம் Rs.${amount} வழங்கப்பட்டது.`,
    otp: (otp) => `உங்கள் OTP: ${otp}. 10 நிமிடங்களுக்கு செல்லுபடியாகும்.`,
    holiday: (name) => `விடுமுறை அறிவிப்பு: ${name}. பள்ளி மூடப்பட்டிருக்கும்.`,
    emergency: (msg) => `அவசர அறிவிப்பு: ${msg}. உடனே பள்ளியை தொடர்பு கொள்ளவும்.`,
    ptmeeting: (date, time) => `பெற்றோர்-ஆசிரியர் கூட்டம் ${date} அன்று ${time} மணிக்கு நடைபெறும்.`,
    homework: (subject, desc) => `${subject} பாடத்திற்கு வீட்டுப்பாடம்: ${desc}.`,
    circular: (title) => `புதிய சுற்றறிக்கை: ${title}.`,
    transport: (route, delay) => `போக்குவரத்து தாமதம்: ${route} பாதை ${delay} நிமிடங்கள் தாமதமாகும்.`
  },
  hi: {
    absent: (name, date, period) => `प्रिय अभिभावक, ${name} ${date} को ${period}वीं कक्षा में अनुपस्थित था/थी।`,
    fee_reminder: (name, amount, due) => `प्रिय अभिभावक, ${name} की फीस Rs.${amount} ${due} तक देय है।`,
    fee_paid: (name, amount, receipt) => `${name} की Rs.${amount} फीस प्राप्त हुई। रसीद: ${receipt}।`,
    otp: (otp) => `आपका OTP ${otp} है। 10 मिनट के लिए वैध।`,
    invitation: (name, portal, user, pass) => `स्वागत ${name}! पोर्टल URL: ${portal} | उपयोगकर्ता: ${user} | पासवर्ड: ${pass}`,
    holiday: (name) => `अवकाश सूचना: ${name}। स्कूल बंद रहेगा।`,
    emergency: (msg) => `आपातकाल: ${msg}। कृपया तुरंत संपर्क करें।`,
    circular: (title) => `नया परिपत्र: ${title}।`
  },
  te: {
    absent: (name, date, period) => `ప్రియమైన తల్లిదండ్రులకు, ${name} ${date}న ${period}వ పీరియడ్‌లో హాజరు కాలేదు.`,
    fee_reminder: (name, amount, due) => `${name} రుసుము Rs.${amount} ${due} తేదీ లోపు చెల్లించండి.`,
    otp: (otp) => `మీ OTP ${otp}. 10 నిమిషాలు చెల్లుబాటు అవుతుంది.`,
    invitation: (name, portal, user, pass) => `స్వాగతం ${name}! URL: ${portal} | వినియోగదారు: ${user} | పాస్‌వర్డ్: ${pass}`
  }
};

const getClient = (school) => {
  const sid = school.smsConfig?.twilioSid || process.env.TWILIO_ACCOUNT_SID;
  const token = school.smsConfig?.twilioToken || process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio credentials not configured');
  return twilio(sid, token);
};

const buildMsgParams = (school, body, toPhone, channel = 'sms') => {
  const isWA = channel === 'whatsapp';
  const to = isWA ? `whatsapp:${toPhone}` : toPhone;
  const params = { body, to };
  const msid = school.smsConfig?.messagingServiceSid || process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (msid) {
    params.messagingServiceSid = msid;
  } else if (isWA) {
    const waNum = school.smsConfig?.whatsappNumber || process.env.TWILIO_WHATSAPP_NUMBER;
    if (!waNum) throw new Error('WhatsApp number not configured in SMS settings');
    params.from = `whatsapp:${waNum.replace('whatsapp:', '')}`;
  } else {
    const from = school.smsConfig?.twilioPhone || process.env.TWILIO_PHONE_NUMBER;
    if (!from) throw new Error('No sender configured — set Messaging Service SID in SMS settings');
    params.from = from;
  }
  return params;
};

const formatPhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  return phone.trim().startsWith('+') ? `+${cleaned}` : `+91${cleaned}`;
};

// Core send function
const sendSMS = async (schoolId, to, messageType, params = [], language = 'en', recipientInfo = {}, channel = 'sms') => {
  try {
    const school = await School.findById(schoolId);
    // Accept if legacy `enabled` OR if either channel-specific flag is set
    const isEnabled = school?.smsConfig?.enabled || school?.smsConfig?.smsEnabled || school?.smsConfig?.whatsappEnabled;
    if (!isEnabled) return { success: false, message: 'SMS disabled' };
    if (!school.smsConfig.notifications?.[messageType] && !['otp','invitation','general'].includes(messageType)) {
      return { success: false, message: `Notification type '${messageType}' is disabled` };
    }
    const lang = language || school.smsConfig.defaultLanguage || 'en';
    const templateFn = translations[lang]?.[messageType] || translations['en']?.[messageType];
    if (!templateFn) return { success: false, message: 'Message template not found' };
    const message = templateFn(...params);
    const toPhone = formatPhone(to);
    if (!toPhone) return { success: false, message: 'Invalid phone number' };
    const client = getClient(school);
    const msgParams = buildMsgParams(school, message, toPhone, channel);
    if (process.env.BACKEND_URL) msgParams.statusCallback = `${process.env.BACKEND_URL}/api/sms/webhook`;
    const result = await client.messages.create(msgParams);
    await SmsLog.create({ school: schoolId, to: toPhone, message, language: lang, type: messageType, channel, status: 'pending', twilioSid: result.sid, sentAt: new Date(), recipient: recipientInfo });
    return { success: true, sid: result.sid };
  } catch (err) {
    await SmsLog.create({ school: schoolId, to, message: `Failed: ${messageType}`, language, type: messageType, channel, status: 'failed', error: err.message, recipient: recipientInfo }).catch(() => {});
    return { success: false, message: err.message };
  }
};

// Send custom message
const sendCustomSMS = async (schoolId, to, message, type = 'general', recipientInfo = {}, campaignId = null, channel = 'sms') => {
  try {
    const school = await School.findById(schoolId);
    const isEnabled = school?.smsConfig?.enabled || school?.smsConfig?.smsEnabled || school?.smsConfig?.whatsappEnabled;
    if (!isEnabled) return { success: false, message: 'SMS disabled' };
    const toPhone = formatPhone(to);
    if (!toPhone) return { success: false, message: 'Invalid phone number' };
    const client = getClient(school);
    const msgParams = buildMsgParams(school, message, toPhone, channel);
    if (process.env.BACKEND_URL) msgParams.statusCallback = `${process.env.BACKEND_URL}/api/sms/webhook`;
    const result = await client.messages.create(msgParams);
    await SmsLog.create({ school: schoolId, to: toPhone, recipientName: recipientInfo.name, message, type, channel, status: 'pending', twilioSid: result.sid, sentAt: new Date(), recipient: recipientInfo, campaign: campaignId });
    return { success: true, sid: result.sid };
  } catch (err) {
    await SmsLog.create({ school: schoolId, to, recipientName: recipientInfo?.name, message, type, channel, status: 'failed', error: err.message, sentAt: new Date(), recipient: recipientInfo, campaign: campaignId }).catch(() => {});
    return { success: false, message: err.message };
  }
};

// Bulk send
const sendBulkSMS = async (schoolId, recipients, message, type = 'general', campaignId = null, channel = 'sms') => {
  const results = { sent: 0, failed: 0, errors: [] };
  for (const r of recipients) {
    const res = await sendCustomSMS(schoolId, r.phone, message, type, { name: r.name, student: r.studentId, employee: r.employeeId, parent: r.parentId }, campaignId, channel);
    if (res.success) results.sent++;
    else { results.failed++; results.errors.push({ phone: r.phone, error: res.message }); }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
};

// OTP
const sendOTP = async (schoolId, phone) => {
  try {
    const school = await School.findById(schoolId);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    otpStore.set(phone, { otp, expiresAt });
    const toPhone = formatPhone(phone);
    const lang = school?.smsConfig?.defaultLanguage || 'en';
    const message = (translations[lang]?.otp || translations.en.otp)(otp);
    const client = getClient(school);
    await client.messages.create(buildMsgParams(school, message, toPhone));
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

const verifyOTP = (phone, otp) => {
  const record = otpStore.get(phone);
  if (!record) return { valid: false, message: 'OTP not found or expired' };
  if (Date.now() > record.expiresAt) { otpStore.delete(phone); return { valid: false, message: 'OTP expired' }; }
  if (record.otp !== otp) return { valid: false, message: 'Invalid OTP' };
  otpStore.delete(phone);
  return { valid: true };
};

// Delivery status webhook update
const updateDeliveryStatus = async (twilioSid, status) => {
  // Map Twilio's status to our status field
  const statusMap = {
    queued:       'pending',
    sending:      'pending',
    sent:         'sent',        // carrier accepted, not yet delivered
    delivered:    'delivered',
    undelivered:  'undelivered', // carrier rejected / unverified number
    failed:       'failed',      // Twilio could not send (bad credentials, trial limit, etc.)
  };
  const mappedStatus = statusMap[status] || 'pending';
  await SmsLog.findOneAndUpdate(
    { twilioSid },
    {
      status: mappedStatus,
      deliveryStatus: status,   // keep original Twilio status string for debugging
      ...(mappedStatus === 'delivered' && { deliveredAt: new Date() }),
      ...(mappedStatus === 'failed' || mappedStatus === 'undelivered'
        ? { error: `Twilio status: ${status}` } : {})
    }
  );
};

module.exports = { sendSMS, sendCustomSMS, sendBulkSMS, sendOTP, verifyOTP, updateDeliveryStatus, translations, formatPhone };
