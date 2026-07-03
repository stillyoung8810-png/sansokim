/// <reference types="jest" />

import {
  createAttendanceCalendar,
  getYearMonthFromKstDate,
  markAttendanceOnCalendar,
} from "./attendancePolicy";

describe("attendancePolicy", () => {
  it("creates day cells for the selected month", () => {
    const calendar = createAttendanceCalendar({
      year: 2026,
      month: 7,
      todayKst: "2026-07-03",
      attendedDatesKst: ["2026-07-01"],
    });

    expect(calendar.year).toBe(2026);
    expect(calendar.month).toBe(7);
    expect(calendar.cells).toHaveLength(31);
    expect(calendar.cells[0]).toEqual({
      dateKst: "2026-07-01",
      dayOfMonth: 1,
      isToday: false,
      hasAttended: true,
    });
    expect(calendar.cells[2]).toEqual({
      dateKst: "2026-07-03",
      dayOfMonth: 3,
      isToday: true,
      hasAttended: false,
    });
  });

  it("handles leap-year February", () => {
    const calendar = createAttendanceCalendar({
      year: 2024,
      month: 2,
      todayKst: "2024-02-29",
      attendedDatesKst: ["2024-02-29"],
    });

    expect(calendar.cells).toHaveLength(29);
    expect(calendar.cells[28]).toEqual({
      dateKst: "2024-02-29",
      dayOfMonth: 29,
      isToday: true,
      hasAttended: true,
    });
  });

  it("returns an empty calendar for invalid months", () => {
    expect(
      createAttendanceCalendar({
        year: 2026,
        month: 13,
        todayKst: "2026-07-03",
        attendedDatesKst: [],
      }).cells,
    ).toEqual([]);
  });

  it("marks a day as attended without changing other cells", () => {
    const calendar = createAttendanceCalendar({
      year: 2026,
      month: 7,
      todayKst: "2026-07-03",
      attendedDatesKst: [],
    });

    const nextCalendar = markAttendanceOnCalendar({
      calendar,
      dateKst: "2026-07-03",
    });

    expect(nextCalendar.cells[2]?.hasAttended).toBe(true);
    expect(nextCalendar.cells[1]?.hasAttended).toBe(false);
  });

  it("parses year and month from a KST date string", () => {
    expect(getYearMonthFromKstDate("2026-07-03")).toEqual({
      year: 2026,
      month: 7,
    });
    expect(getYearMonthFromKstDate("2026-13-03")).toBeNull();
    expect(getYearMonthFromKstDate("20260703")).toBeNull();
  });
});
