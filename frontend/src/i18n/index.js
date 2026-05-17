import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      dashboard: 'Dashboard',
      students: 'Students',
      employees: 'Employees',
      classes: 'Classes',
      subjects: 'Subjects',
      attendance: 'Attendance',
      fees: 'Fees',
      salary: 'Salary',
      timetable: 'Timetable',
      exams: 'Exams',
      expenses: 'Expenses',
      transport: 'Transport',
      reports: 'Reports',
      settings: 'Settings',
      sms: 'SMS Services',
      idCards: 'ID Cards',
      // Common
      add: 'Add',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
      print: 'Print',
      download: 'Download',
      view: 'View',
      actions: 'Actions',
      status: 'Status',
      date: 'Date',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      // Roles
      admin: 'Admin',
      teacher: 'Teacher',
      student: 'Student',
      parent: 'Parent',
      accountant: 'Accountant',
      principal: 'Principal',
      maintenance: 'Maintenance',
      correspondent: 'Correspondent',
    }
  },
  ta: {
    translation: {
      dashboard: 'டாஷ்போர்டு',
      students: 'மாணவர்கள்',
      employees: 'ஊழியர்கள்',
      classes: 'வகுப்புகள்',
      subjects: 'பாடங்கள்',
      attendance: 'வருகைப்பதிவு',
      fees: 'கட்டணம்',
      salary: 'சம்பளம்',
      timetable: 'நேர அட்டவணை',
      exams: 'தேர்வுகள்',
      expenses: 'செலவுகள்',
      transport: 'போக்குவரத்து',
      reports: 'அறிக்கைகள்',
      settings: 'அமைப்புகள்',
      sms: 'SMS சேவைகள்',
      idCards: 'அடையாள அட்டைகள்',
      add: 'சேர்க்க',
      edit: 'திருத்து',
      delete: 'நீக்கு',
      save: 'சேமி',
      cancel: 'ரத்துசெய்',
      search: 'தேடல்',
      filter: 'வடிகட்டி',
      export: 'ஏற்றுமதி',
      print: 'அச்சிடு',
      download: 'பதிவிறக்கம்',
      view: 'பார்',
      actions: 'செயல்கள்',
      status: 'நிலை',
      date: 'தேதி',
      name: 'பெயர்',
      email: 'மின்னஞ்சல்',
      phone: 'தொலைபேசி',
      address: 'முகவரி',
      admin: 'நிர்வாகி',
      teacher: 'ஆசிரியர்',
      student: 'மாணவர்',
      parent: 'பெற்றோர்',
      accountant: 'கணக்காளர்',
      principal: 'முதல்வர்',
      maintenance: 'பராமரிப்பு',
      correspondent: 'கரஸ்பாண்டர்',
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;
