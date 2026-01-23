export const uid = () => {
  return "C" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7).toUpperCase();
};

export const lastDayOfMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

export const addMonthsSafe = (date: Date, monthsToAdd: number) => {
  const y = date.getFullYear();
  const m0 = date.getMonth();
  const d = date.getDate();
  const targetM0 = m0 + monthsToAdd;
  const targetY = y + Math.floor(targetM0 / 12);
  const normalizedM0 = ((targetM0 % 12) + 12) % 12;
  const ld = lastDayOfMonth(targetY, normalizedM0);
  const targetD = Math.min(d, ld);
  return new Date(targetY, normalizedM0, targetD);
};

export const parseDate = (v: string | null) => {
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
};

export const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatCurrency = (val: number | null) => {
  if (val === null || val === undefined) return "________";
  return val.toLocaleString("ko-KR") + "원";
};

export const buildSchedule = (firstDate: Date, cycleMonths: number, contractStart: Date | null, contractEnd: Date) => {
  const out: string[] = [];
  if (!cycleMonths) return out;
  const minDate = contractStart || new Date("1970-01-01T00:00:00");
  let cur = new Date(firstDate.getTime());
  
  // Align cur to be >= minDate if needed (logic from original)
  while (cur < minDate) {
    cur = addMonthsSafe(cur, cycleMonths);
  }
  
  while (cur <= contractEnd) {
    out.push(fmt(cur));
    cur = addMonthsSafe(cur, cycleMonths);
  }
  return out;
};

export const calculateSchedule = (
  cycleMonths: number, 
  firstDateStr: string, 
  contractStartStr: string, 
  contractEndStr: string
) => {
  const firstDate = parseDate(firstDateStr);
  const contractStart = parseDate(contractStartStr);
  const contractEnd = parseDate(contractEndStr);

  if (!firstDate || !cycleMonths || !contractEnd) {
    return null;
  }

  const schedule = buildSchedule(firstDate, cycleMonths, contractStart, contractEnd);
  return {
    cycleMonths,
    firstDate: fmt(firstDate),
    contractStart: contractStart ? fmt(contractStart) : null,
    contractEnd: fmt(contractEnd),
    schedule
  };
};

// --- URL State Management ---

export const encodeState = (data: any): string => {
  try {
    const json = JSON.stringify(data);
    // Encode for URL safely, handling Unicode (Korean)
    return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g,
      function toSolidBytes(match, p1) {
        return String.fromCharCode(parseInt(p1, 16));
      }));
  } catch (e) {
    console.error("Encoding failed", e);
    return "";
  }
};

export const decodeState = (encoded: string): any | null => {
  try {
    const json = decodeURIComponent(atob(encoded).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  } catch (e) {
    console.error("Decoding failed", e);
    return null;
  }
};