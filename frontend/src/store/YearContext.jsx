import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const YearContext = createContext(null);

// ── Academic-year helpers ──────────────────────────────────────────────
// An academic year is defined by a configurable start month and end month.
// When the end month is earlier than the start month (e.g. Jun → Mar) the
// year spans two calendar years and is labelled "2025-2026"; otherwise it
// stays within one calendar year and is labelled "2025".
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const spansTwoYears = (startMonth, endMonth) => endMonth < startMonth;

const startCalYearOf = (date, startMonth) => {
  const m = date.getMonth() + 1, y = date.getFullYear();
  return m >= startMonth ? y : y - 1;
};

export const ayString = (startCalYear, startMonth, endMonth) =>
  spansTwoYears(startMonth, endMonth) ? `${startCalYear}-${startCalYear + 1}` : `${startCalYear}`;

const ayRange = (startCalYear, startMonth, endMonth) => {
  const endCalYear = spansTwoYears(startMonth, endMonth) ? startCalYear + 1 : startCalYear;
  return {
    startDate: fmtDate(new Date(startCalYear, startMonth - 1, 1)),
    endDate: fmtDate(new Date(endCalYear, endMonth, 0)), // last day of endMonth
  };
};

const ayMonths = (startCalYear, startMonth, endMonth) => {
  const endCalYear = spansTwoYears(startMonth, endMonth) ? startCalYear + 1 : startCalYear;
  return { fromYear: startCalYear, fromMonth: startMonth, toYear: endCalYear, toMonth: endMonth };
};

export const YearProvider = ({ children }) => {
  const { user } = useAuth();

  const { data: schoolData } = useQuery({
    queryKey: ['school'],
    queryFn: () => api.get('/school'),
    enabled: !!user && user.role !== 'super_admin',
    staleTime: 5 * 60 * 1000,
  });
  const school = schoolData?.school;

  const startMonth = school?.academicYear?.startMonth || 6;
  const endMonth = school?.academicYear?.endMonth || 3;

  // Build the list of selectable academic years: from the year the school
  // started using the software (createdAt) up to the current academic year.
  const availableYears = useMemo(() => {
    const now = new Date();
    const currentStart = startCalYearOf(now, startMonth);
    const firstStart = school?.createdAt
      ? startCalYearOf(new Date(school.createdAt), startMonth)
      : currentStart;
    const years = [];
    for (let y = currentStart; y >= firstStart; y--) {
      years.push({
        value: ayString(y, startMonth, endMonth),
        label: ayString(y, startMonth, endMonth),
        startCalYear: y,
      });
    }
    return years;
  }, [school?.createdAt, startMonth, endMonth]);

  const currentYear = availableYears[0]?.value || ayString(new Date().getFullYear(), startMonth, endMonth);

  const storageKey = `selectedYear:${school?._id || 'default'}`;
  const [selectedYear, setSelectedYearState] = useState(currentYear);

  // Restore persisted selection once school config is known; fall back to current.
  useEffect(() => {
    if (!school?._id) return;
    const saved = localStorage.getItem(storageKey);
    if (saved && availableYears.some(y => y.value === saved)) {
      setSelectedYearState(saved);
    } else {
      setSelectedYearState(currentYear);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school?._id, currentYear, availableYears.length]);

  const setSelectedYear = (val) => {
    setSelectedYearState(val);
    localStorage.setItem(storageKey, val);
  };

  const selected = availableYears.find(y => y.value === selectedYear) || availableYears[0];
  const startCalYear = selected?.startCalYear ?? startCalYearOf(new Date(), startMonth);

  const value = {
    selectedYear,
    setSelectedYear,
    availableYears,
    startMonth,
    endMonth,
    isCurrent: selectedYear === currentYear,
    // Date range for date-based modules (Expenses, Attendance)
    range: ayRange(startCalYear, startMonth, endMonth),
    // (year, month) bounds for Salary's numeric-key filter
    months: ayMonths(startCalYear, startMonth, endMonth),
  };

  return <YearContext.Provider value={value}>{children}</YearContext.Provider>;
};

export const useYear = () => {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error('useYear must be used within YearProvider');
  return ctx;
};
