const twilio = require('twilio');
const SmsLog = require('../models/SmsLog');
const School = require('../models/School');

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
    salary_paid: (name, amount, month) => `Dear ${name}, Your salary of Rs.${amount} for ${month} has been processed. Login to view payslip.`
  },
  ta: {
    absent: (name, date, period) => `அன்பான பெற்றோர்களுக்கு, உங்கள் குழந்தை ${name} ${date} அன்று ${period}வது பாடவேளையில் வருகைப்பதிவில் இல்லை.`,
    consecutive_absent: (name, days) => `எச்சரிக்கை: ${name} தொடர்ந்து ${days} நாட்களாக பள்ளிக்கு வரவில்லை. உடனே தொடர்பு கொள்ளவும்.`,
    fee_reminder: (name, amount, due) => `அன்பான பெற்றோர், ${name} யின் கட்டணம் Rs.${amount} ${due} தேதிக்குள் செலுத்தவும்.`,
    fee_paid: (name, amount, receipt) => `${name} இன் Rs.${amount} கட்டணம் பெறப்பட்டது. ரசீது எண்: ${receipt}. நன்றி.`,
    exam_schedule: (name, exam, date) => `${name} யின் ${exam} தேர்வு ${date} அன்று நடைபெறும். தயார்படுங்கள்.`,
    result_published: (name, exam, percent) => `${name} யின் ${exam} முடிவு வெளியிடப்பட்டது. சதவீதம்: ${percent}%. விவரங்களுக்கு உள்நுழையவும்.`,
    invitation: (name, portal, user, pass) => `வணக்கம் ${name}! போர்டல் URL: ${portal} | பயனர்பெயர்: ${user} | கடவுச்சொல்: ${pass}`,
    timetable: (className, day) => `${className} வகுப்பின் ${day} அட்டவணை புதுப்பிக்கப்பட்டது.`,
    salary_paid: (name, amount, month) => `${name} அவர்களுக்கு ${month} மாத சம்பளம் Rs.${amount} வழங்கப்பட்டது.`
  }
};

const sendSMS = async (schoolId, to, messageType, params, language = 'en', recipientInfo = {}) => {
  try {
    const school = await School.findById(schoolId);
    if (!school || !school.smsConfig.enabled) return { success: false, message: 'SMS disabled' };

    const sid = school.smsConfig.twilioSid || process.env.TWILIO_ACCOUNT_SID;
    const token = school.smsConfig.twilioToken || process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = school.smsConfig.twilioPhone || process.env.TWILIO_PHONE_NUMBER;

    const lang = language || 'en';
    const templateFn = translations[lang]?.[messageType] || translations['en']?.[messageType];
    if (!templateFn) return { success: false, message: 'Message template not found' };

    const message = templateFn(...params);

    const client = twilio(sid, token);
    const result = await client.messages.create({
      body: message,
      from: fromPhone,
      to: to.startsWith('+') ? to : `+91${to}`
    });

    await SmsLog.create({
      school: schoolId,
      to,
      message,
      language: lang,
      type: messageType,
      status: 'sent',
      twilioSid: result.sid,
      sentAt: new Date(),
      recipient: recipientInfo
    });

    return { success: true, sid: result.sid };
  } catch (err) {
    await SmsLog.create({
      school: schoolId,
      to,
      message: `Failed: ${messageType}`,
      language,
      type: messageType,
      status: 'failed',
      error: err.message,
      recipient: recipientInfo
    }).catch(() => {});
    return { success: false, message: err.message };
  }
};

module.exports = { sendSMS, translations };
