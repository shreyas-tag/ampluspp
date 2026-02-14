const DATE_LOCALE = 'en-US';

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const formatTime = (value) =>
  new Intl.DateTimeFormat(DATE_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(value));

const formatDateUpper = (value) => {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat(DATE_LOCALE, { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat(DATE_LOCALE, { month: 'short' }).format(date).toUpperCase();
  const year = new Intl.DateTimeFormat(DATE_LOCALE, { year: 'numeric' }).format(date);
  return `${day} ${month} ${year}`;
};

const getStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameWeek = (target, reference) => {
  const ref = new Date(reference);
  const day = ref.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  return target >= weekStart && target < weekEnd;
};

export const formatAbsoluteDate = (value) => {
  if (!value || !isValidDate(value)) return '-';
  return formatDateUpper(value);
};

export const formatAbsoluteDateTime = (value) => {
  if (!value || !isValidDate(value)) return '-';
  return `${formatDateUpper(value)}, ${formatTime(value)}`;
};

export const formatSmartDateTime = (value) => {
  if (!value || !isValidDate(value)) return '-';
  const target = new Date(value);
  const now = new Date();
  const startToday = getStartOfDay(now);
  const startTarget = getStartOfDay(target);
  const diffDays = Math.round((startToday.getTime() - startTarget.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return `Today, ${formatTime(target)}`;
  if (diffDays === 1) return `Yesterday, ${formatTime(target)}`;
  if (diffDays > 1 && diffDays <= 6 && isSameWeek(target, now)) {
    const dayLabel = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: 'long' }).format(target);
    return `${dayLabel}, ${formatTime(target)}`;
  }
  return formatAbsoluteDateTime(target);
};
