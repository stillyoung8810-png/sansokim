export type AttendanceDayCell = {
  readonly dateKst: string;
  readonly dayOfMonth: number;
  readonly isToday: boolean;
  readonly hasAttended: boolean;
};

export type AttendanceCalendarState = {
  readonly year: number;
  readonly month: number;
  readonly cells: readonly AttendanceDayCell[];
};

export type AttendanceYearMonth = {
  readonly year: number;
  readonly month: number;
};

export function createAttendanceCalendar(params: {
  readonly year: number;
  readonly month: number;
  readonly todayKst: string;
  readonly attendedDatesKst: readonly string[];
}): AttendanceCalendarState {
  const daysInMonth = getDaysInMonth(params.year, params.month);
  const attendedSet = new Set(params.attendedDatesKst);
  const cells = Array.from({ length: daysInMonth }, (_unused, dayIndex) => {
    const dayOfMonth = dayIndex + 1;
    const dateKst = formatKstDateString({
      year: params.year,
      month: params.month,
      dayOfMonth,
    });

    return {
      dateKst,
      dayOfMonth,
      isToday: dateKst === params.todayKst,
      hasAttended: attendedSet.has(dateKst),
    };
  });

  return {
    year: params.year,
    month: params.month,
    cells,
  };
}

export function markAttendanceOnCalendar(params: {
  readonly calendar: AttendanceCalendarState;
  readonly dateKst: string;
}): AttendanceCalendarState {
  return {
    ...params.calendar,
    cells: params.calendar.cells.map((cell) =>
      cell.dateKst === params.dateKst ? { ...cell, hasAttended: true } : cell,
    ),
  };
}

export function getYearMonthFromKstDate(
  dateKst: string,
): AttendanceYearMonth | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateKst);
  if (match == null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function getDaysInMonth(year: number, month: number): number {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return 0;
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatKstDateString(params: {
  readonly year: number;
  readonly month: number;
  readonly dayOfMonth: number;
}): string {
  const month = String(params.month).padStart(2, "0");
  const day = String(params.dayOfMonth).padStart(2, "0");

  return `${params.year}-${month}-${day}`;
}
