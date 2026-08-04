import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ============================================================
   IoT-Enabled Solar Studs: Speed Monitoring System
   Frontend prototype (mock data only, no backend wiring yet)

   Entities follow the ERD in Section 3.3.13:
     Admin          (admin_id, username, password, email, role)
     ZebraLaneStud  (stud_id, status, speed_threshold)
     VehicleEvent   (event_id, stud_id, speed, event_date,
                     event_time, overspeed_flag)
     TrafficLog     (log_id, event_id, speed, date, time,
                     alert_triggered)
   ============================================================ */

const DEFAULT_THRESHOLD = 30; // km/h, per Ordinance No. 10551-2007
const CALENDAR_YEAR = 2026;   // Figure 3.18 specifies a 2026 calendar

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------- mock data generation (deterministic) ---------- */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function buildMockEvents() {
  const rand = mulberry32(20260326);
  const events = [];
  let eventId = 1;

  // Generate detections across January–August 2026
  for (let month = 0; month < 8; month++) {
    const daysInMonth = new Date(CALENDAR_YEAR, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      // roughly 45% of days have recorded activity
      if (rand() > 0.45) continue;

      const count = 4 + Math.floor(rand() * 14);
      for (let i = 0; i < count; i++) {
        // traffic concentrated around morning and afternoon peaks
        const peak = rand() < 0.5 ? 7 : 12;
        const hour = Math.min(
          22,
          Math.max(5, peak + Math.floor(rand() * 6) - 1)
        );
        const minute = Math.floor(rand() * 60);
        const second = Math.floor(rand() * 60);

        // speeds skew above the 30 km/h limit, matching field observations
        const base = 22 + rand() * 30;
        const speed = Math.round(base * 100) / 100;

        events.push({
          event_id: eventId++,
          stud_id: rand() < 0.5 ? "SDS-01" : "SDS-02",
          speed,
          event_date: `${CALENDAR_YEAR}-${pad(month + 1)}-${pad(day)}`,
          event_time: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
          overspeed_flag: speed > DEFAULT_THRESHOLD,
        });
      }
    }
  }

  events.sort((a, b) =>
    (a.event_date + a.event_time).localeCompare(b.event_date + b.event_time)
  );
  return events;
}

const INITIAL_EVENTS = buildMockEvents();

const INITIAL_STUDS = [
  {
    stud_id: "SDS-01",
    type: "Speed Detection Stud",
    location: "Patag, Entry Point",
    status: "Active",
    speed_threshold: DEFAULT_THRESHOLD,
  },
  {
    stud_id: "SDS-02",
    type: "Speed Detection Stud",
    location: "Patag, Exit Point (50 m)",
    status: "Active",
    speed_threshold: DEFAULT_THRESHOLD,
  },
  {
    stud_id: "ZLS-01",
    type: "Zebra Lane Stud",
    location: "Patag, Crosswalk (Left)",
    status: "Active",
    speed_threshold: DEFAULT_THRESHOLD,
  },
  {
    stud_id: "ZLS-02",
    type: "Zebra Lane Stud",
    location: "Patag, Crosswalk (Right)",
    status: "Fail-Safe",
    speed_threshold: DEFAULT_THRESHOLD,
  },
];

const ADMIN = {
  admin_id: 1,
  username: "admin",
  password: "admin123",
  email: "admin@ustp.edu.ph",
  role: "System Administrator",
};

/* ---------- small shared pieces ---------- */

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

function PageTitle({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function StatCard({ label, value, note }) {
  return (
    <div className="border border-gray-300 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {note && <p className="text-xs text-gray-500 mt-1">{note}</p>}
    </div>
  );
}

function RemarkTag({ over }) {
  return (
    <span
      className={
        over
          ? "text-red-700 font-medium"
          : "text-gray-600"
      }
    >
      {over ? "Overspeeding" : "Normal"}
    </span>
  );
}

function StatusTag({ status }) {
  const map = {
    Active: "text-green-700",
    "Fail-Safe": "text-yellow-700",
    "Not Working": "text-red-700",
  };
  return <span className={`font-medium ${map[status] || ""}`}>{status}</span>;
}

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-gray-500">
        {message}
      </td>
    </tr>
  );
}

/* ---------- login ---------- */

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (username === ADMIN.username && password === ADMIN.password) {
      setError("");
      onLogin();
    } else {
      setError("Incorrect username or password. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm border border-gray-300 bg-white p-6">
        <h1 className="text-lg font-semibold text-gray-900">
          Speed Monitoring System
        </h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          IoT-Enabled Solar Studs: Administrator Login
        </p>

        <label className="block text-sm text-gray-700 mb-1">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full border border-gray-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:border-gray-600"
        />

        <label className="block text-sm text-gray-700 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full border border-gray-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:border-gray-600"
        />

        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

        <button
          onClick={submit}
          className="w-full bg-gray-900 text-white text-sm py-2 hover:bg-gray-700"
        >
          Log in
        </button>

        <p className="text-xs text-gray-500 mt-4">
          Demo credentials: admin / admin123
        </p>
      </div>
    </div>
  );
}

/* ---------- calendar (Figure 3.18) ---------- */

function SpeedMonitoringPage({ events, selectedDate, onSelectDate }) {
  const [month, setMonth] = useState(2); // March 2026

  const countsByDate = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      map[e.event_date] = (map[e.event_date] || 0) + 1;
    });
    return map;
  }, [events]);

  const firstDay = new Date(CALENDAR_YEAR, month, 1).getDay();
  const daysInMonth = new Date(CALENDAR_YEAR, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <PageTitle
        title="Speed Monitoring"
        subtitle={`Select a date to review its recorded traffic logs. Calendar year ${CALENDAR_YEAR}.`}
      />

      <div className="border border-gray-300 bg-white">
        <div className="flex items-center justify-between border-b border-gray-300 px-4 py-3">
          <button
            onClick={() => setMonth((m) => Math.max(0, m - 1))}
            disabled={month === 0}
            className="text-sm px-3 py-1 border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            Previous
          </button>
          <p className="text-sm font-medium text-gray-900">
            {MONTHS[month]} {CALENDAR_YEAR}
          </p>
          <button
            onClick={() => setMonth((m) => Math.min(11, m + 1))}
            disabled={month === 11}
            className="text-sm px-3 py-1 border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-300">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-xs text-gray-500 text-center py-2 border-r border-gray-200 last:border-r-0"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null)
              return <div key={i} className="h-20 border-r border-b border-gray-200 bg-gray-50" />;

            const iso = `${CALENDAR_YEAR}-${pad(month + 1)}-${pad(day)}`;
            const count = countsByDate[iso] || 0;
            const isSelected = selectedDate === iso;

            return (
              <button
                key={i}
                onClick={() => count > 0 && onSelectDate(iso)}
                disabled={count === 0}
                className={`h-20 border-r border-b border-gray-200 p-2 text-left align-top ${
                  isSelected
                    ? "bg-gray-900 text-white"
                    : count > 0
                    ? "bg-white hover:bg-gray-100"
                    : "bg-gray-50 text-gray-400 cursor-default"
                }`}
              >
                <span className="text-sm">{day}</span>
                {count > 0 && (
                  <span
                    className={`block text-xs mt-1 ${
                      isSelected ? "text-gray-200" : "text-gray-600"
                    }`}
                  >
                    {count} records
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-gray-600 mt-4">
        {selectedDate
          ? `Selected date: ${formatDate(selectedDate)}. Open Speed Records to view the log.`
          : "No date selected yet."}
      </p>
    </div>
  );
}

/* ---------- speed records (Figure 3.19) ---------- */

function SpeedRecordsPage({ events, selectedDate, threshold }) {
  const [sortKey, setSortKey] = useState("event_time");
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState("all");

  const rows = useMemo(() => {
    let list = events.filter((e) => e.event_date === selectedDate);
    if (filter === "over") list = list.filter((e) => e.speed > threshold);
    if (filter === "normal") list = list.filter((e) => e.speed <= threshold);

    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
  }, [events, selectedDate, filter, sortKey, sortAsc, threshold]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const arrow = (key) => (sortKey === key ? (sortAsc ? " ▲" : " ▼") : "");

  if (!selectedDate) {
    return (
      <div>
        <PageTitle title="Speed Records" />
        <div className="border border-gray-300 bg-white p-6 text-sm text-gray-600">
          Pick a date on the Speed Monitoring calendar to load its records.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Speed Records"
        subtitle={`Vehicle detections logged on ${formatDate(selectedDate)}.`}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-sm text-gray-600">Filter:</span>
        {[
          ["all", "All records"],
          ["over", "Overspeeding only"],
          ["normal", "Within limit"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-sm px-3 py-1 border ${
              filter === key
                ? "bg-gray-900 text-white border-gray-900"
                : "border-gray-300 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-auto">
          {rows.length} record{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              {[
                ["event_date", "Date"],
                ["event_time", "Time"],
                ["speed", "Speed (km/h)"],
                ["overspeed_flag", "Remarks"],
              ].map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-200 select-none"
                >
                  {label}
                  {arrow(key)}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium text-gray-700">
                Stud ID
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5} message="No records match this filter." />
            ) : (
              rows.map((e) => (
                <tr key={e.event_id} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-3 py-2">{formatDate(e.event_date)}</td>
                  <td className="px-3 py-2">{e.event_time}</td>
                  <td className="px-3 py-2">{e.speed.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <RemarkTag over={e.speed > threshold} />
                  </td>
                  <td className="px-3 py-2 text-gray-600">{e.stud_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- real-time traffic logs ---------- */

function RealtimeLogsPage({ events, liveEvents, threshold }) {
  const combined = useMemo(
    () => [...liveEvents].slice(0, 40),
    [liveEvents]
  );

  return (
    <div>
      <PageTitle
        title="Real-Time Traffic Logs"
        subtitle="Detections streamed from the deployed studs as they are recorded."
      />

      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full bg-green-600 inline-block" />
        <span className="text-sm text-gray-600">
          Receiving data. New detections appear at the top.
        </span>
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-left font-medium text-gray-700">Log ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Time</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Speed (km/h)</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Stud ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Alert Triggered</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {combined.length === 0 ? (
              <EmptyRow colSpan={7} message="Waiting for incoming detections." />
            ) : (
              combined.map((e) => (
                <tr key={e.event_id} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-3 py-2 text-gray-600">LOG-{e.event_id}</td>
                  <td className="px-3 py-2">{formatDate(e.event_date)}</td>
                  <td className="px-3 py-2">{e.event_time}</td>
                  <td className="px-3 py-2">{e.speed.toFixed(2)}</td>
                  <td className="px-3 py-2 text-gray-600">{e.stud_id}</td>
                  <td className="px-3 py-2">{e.speed > threshold ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    <RemarkTag over={e.speed > threshold} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- overspeeding events ---------- */

function OverspeedingPage({ events, threshold }) {
  const [month, setMonth] = useState("all");

  const rows = useMemo(() => {
    let list = events.filter((e) => e.speed > threshold);
    if (month !== "all") {
      list = list.filter((e) => e.event_date.split("-")[1] === month);
    }
    return list.slice(-200).reverse();
  }, [events, threshold, month]);

  return (
    <div>
      <PageTitle
        title="Overspeeding Events"
        subtitle={`Vehicles recorded above the ${threshold} km/h limit.`}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-sm text-gray-600">Month:</span>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="all">All months</option>
          {MONTHS.slice(0, 8).map((m, i) => (
            <option key={m} value={pad(i + 1)}>
              {m} {CALENDAR_YEAR}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500 ml-auto">
          Showing {rows.length} most recent violations
        </span>
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-left font-medium text-gray-700">Event ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Time</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Speed (km/h)</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Over Limit By</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Stud ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={6} message="No violations recorded for this period." />
            ) : (
              rows.map((e) => (
                <tr key={e.event_id} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-3 py-2 text-gray-600">EVT-{e.event_id}</td>
                  <td className="px-3 py-2">{formatDate(e.event_date)}</td>
                  <td className="px-3 py-2">{e.event_time}</td>
                  <td className="px-3 py-2 text-red-700 font-medium">
                    {e.speed.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    +{(e.speed - threshold).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{e.stud_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- analytics ---------- */

function AnalyticsPage({ events, threshold }) {
  const stats = useMemo(() => {
    const total = events.length;
    const violations = events.filter((e) => e.speed > threshold).length;
    const avg =
      total === 0 ? 0 : events.reduce((s, e) => s + e.speed, 0) / total;
    const max = total === 0 ? 0 : Math.max(...events.map((e) => e.speed));

    const byMonth = MONTHS.slice(0, 8).map((m, i) => {
      const key = pad(i + 1);
      const inMonth = events.filter((e) => e.event_date.split("-")[1] === key);
      return {
        month: m.slice(0, 3),
        detections: inMonth.length,
        violations: inMonth.filter((e) => e.speed > threshold).length,
      };
    });

    const byHour = {};
    events.forEach((e) => {
      if (e.speed > threshold) {
        const h = e.event_time.slice(0, 2);
        byHour[h] = (byHour[h] || 0) + 1;
      }
    });
    const hourData = Object.keys(byHour)
      .sort()
      .map((h) => ({ hour: `${h}:00`, violations: byHour[h] }));

    const peak = hourData.reduce(
      (best, cur) => (cur.violations > (best?.violations || 0) ? cur : best),
      null
    );

    return { total, violations, avg, max, byMonth, hourData, peak };
  }, [events, threshold]);

  const rate =
    stats.total === 0 ? 0 : (stats.violations / stats.total) * 100;

  return (
    <div>
      <PageTitle
        title="Analytics"
        subtitle="Summary of detections and overspeeding activity across all logged data."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total detections" value={stats.total} />
        <StatCard label="Violations" value={stats.violations} />
        <StatCard label="Violation rate" value={`${rate.toFixed(1)}%`} />
        <StatCard
          label="Average speed"
          value={`${stats.avg.toFixed(2)} km/h`}
          note={`Limit: ${threshold} km/h`}
        />
        <StatCard
          label="Peak violation hour"
          value={stats.peak ? stats.peak.hour : "N/A"}
          note={stats.peak ? `${stats.peak.violations} violations` : ""}
        />
      </div>

      <div className="border border-gray-300 bg-white p-4 mb-6">
        <p className="text-sm font-medium text-gray-800 mb-3">
          Detections and violations by month
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="detections" fill="#9ca3af" name="Detections" />
              <Bar dataKey="violations" fill="#b91c1c" name="Violations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border border-gray-300 bg-white p-4">
        <p className="text-sm font-medium text-gray-800 mb-3">
          Violations by hour of day
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.hourData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="violations" fill="#374151" name="Violations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ---------- solar stud status (Figure 3.20) ---------- */

function StudStatusPage({ studs, onUpdateStud }) {
  const total = studs.length;
  const failSafe = studs.filter((s) => s.status === "Fail-Safe").length;
  const notWorking = studs.filter((s) => s.status === "Not Working").length;
  const active = studs.filter((s) => s.status === "Active").length;

  return (
    <div>
      <PageTitle
        title="Solar Stud Status"
        subtitle="Health of every deployed stud, with the speed threshold used for overspeed detection."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total studs" value={total} />
        <StatCard label="Active" value={active} note="Operating normally" />
        <StatCard
          label="Fail-safe mode"
          value={failSafe}
          note="Yellow LED, needs inspection"
        />
        <StatCard label="Not working" value={notWorking} note="No response" />
      </div>

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-left font-medium text-gray-700">Stud ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Type</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Location</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">
                Speed threshold (km/h)
              </th>
            </tr>
          </thead>
          <tbody>
            {studs.map((s) => (
              <tr key={s.stud_id} className="border-b border-gray-200 last:border-b-0">
                <td className="px-3 py-2 text-gray-600">{s.stud_id}</td>
                <td className="px-3 py-2">{s.type}</td>
                <td className="px-3 py-2">{s.location}</td>
                <td className="px-3 py-2">
                  <select
                    value={s.status}
                    onChange={(e) =>
                      onUpdateStud(s.stud_id, { status: e.target.value })
                    }
                    className="border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option>Active</option>
                    <option>Fail-Safe</option>
                    <option>Not Working</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="1"
                    value={s.speed_threshold}
                    onChange={(e) =>
                      onUpdateStud(s.stud_id, {
                        speed_threshold: Number(e.target.value) || 0,
                      })
                    }
                    className="w-24 border border-gray-300 px-2 py-1 text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-gray-300 bg-white p-4 mt-6">
        <p className="text-sm font-medium text-gray-800 mb-2">LED indicator guide</p>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>
            <span className="text-gray-900 font-medium">White (steady)</span>: vehicle
            within the speed limit; standard path guidance during low light.
          </li>
          <li>
            <span className="text-red-700 font-medium">Red (flashing)</span>:
            overspeeding vehicle detected; warns drivers and pedestrians.
          </li>
          <li>
            <span className="text-yellow-700 font-medium">Yellow (slow pulse)</span>:
            fail-safe mode; sensor, network, or battery fault detected.
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ---------- graph page (Figure 3.21) ---------- */

function GraphPage({ events, selectedDate, threshold }) {
  const dayEvents = useMemo(
    () => events.filter((e) => e.event_date === selectedDate),
    [events, selectedDate]
  );

  const chartData = useMemo(() => {
    const buckets = {};
    dayEvents
      .filter((e) => e.speed > threshold)
      .forEach((e) => {
        const hm = e.event_time.slice(0, 5);
        buckets[hm] = (buckets[hm] || 0) + 1;
      });
    return Object.keys(buckets)
      .sort()
      .map((k) => ({ time: k, events: buckets[k] }));
  }, [dayEvents, threshold]);

  if (!selectedDate) {
    return (
      <div>
        <PageTitle title="Speed Monitoring Graph" />
        <div className="border border-gray-300 bg-white p-6 text-sm text-gray-600">
          Pick a date on the Speed Monitoring calendar to plot its results.
        </div>
      </div>
    );
  }

  const violations = dayEvents.filter((e) => e.speed > threshold);

  return (
    <div>
      <PageTitle
        title="Speed Monitoring Graph"
        subtitle={`Overspeeding frequency by timestamp for ${formatDate(selectedDate)}.`}
      />

      <div className="border border-gray-300 bg-white p-4 mb-6">
        <div className="h-72">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              No overspeeding events recorded on this date.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="events" fill="#b91c1c" name="Overspeeding events" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <p className="text-sm font-medium text-gray-800 mb-2">
        Filtered records, overspeeding only ({violations.length})
      </p>
      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Time</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Speed (km/h)</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {violations.length === 0 ? (
              <EmptyRow colSpan={4} message="No overspeeding events on this date." />
            ) : (
              violations.map((e) => (
                <tr key={e.event_id} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-3 py-2">{formatDate(e.event_date)}</td>
                  <td className="px-3 py-2">{e.event_time}</td>
                  <td className="px-3 py-2">{e.speed.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <RemarkTag over />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- shell ---------- */

const NAV = [
  ["monitoring", "Speed Monitoring"],
  ["records", "Speed Records"],
  ["realtime", "Real-Time Logs"],
  ["overspeeding", "Overspeeding Events"],
  ["analytics", "Analytics"],
  ["studs", "Solar Stud Status"],
  ["graph", "Graph"],
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState("monitoring");
  const [selectedDate, setSelectedDate] = useState("2026-03-26");
  const [studs, setStuds] = useState(INITIAL_STUDS);
  const [events] = useState(INITIAL_EVENTS);
  const [liveEvents, setLiveEvents] = useState(() =>
    [...INITIAL_EVENTS].slice(-20).reverse()
  );

  const threshold = studs[0]?.speed_threshold ?? DEFAULT_THRESHOLD;

  // Simulated incoming detections for the real-time log view
  useEffect(() => {
    if (!loggedIn) return;
    const id = setInterval(() => {
      const now = new Date();
      const speed = Math.round((20 + Math.random() * 32) * 100) / 100;
      setLiveEvents((prev) => [
        {
          event_id: 900000 + prev.length,
          stud_id: Math.random() < 0.5 ? "SDS-01" : "SDS-02",
          speed,
          event_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
            now.getDate()
          )}`,
          event_time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
            now.getSeconds()
          )}`,
          overspeed_flag: speed > threshold,
        },
        ...prev,
      ]);
    }, 6000);
    return () => clearInterval(id);
  }, [loggedIn, threshold]);

  const updateStud = (id, patch) =>
    setStuds((prev) =>
      prev.map((s) => (s.stud_id === id ? { ...s, ...patch } : s))
    );

  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-300">
        <div className="px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="text-base font-semibold text-gray-900">
              Speed Monitoring System
            </h1>
            <p className="text-xs text-gray-500">
              IoT-Enabled Solar Studs at Patag, Cagayan de Oro City
            </p>
          </div>
          <span className="text-sm text-gray-600">
            {ADMIN.username} · {ADMIN.role}
          </span>
          <button
            onClick={() => setLoggedIn(false)}
            className="text-sm px-3 py-1 border border-gray-300 hover:bg-gray-100"
          >
            Log out
          </button>
        </div>

        <nav className="px-4 flex flex-wrap gap-1 border-t border-gray-200">
          {NAV.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={`text-sm px-3 py-2 border-b-2 ${
                page === key
                  ? "border-gray-900 text-gray-900 font-medium"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="p-4 max-w-6xl mx-auto">
        {page === "monitoring" && (
          <SpeedMonitoringPage
            events={events}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setPage("records");
            }}
          />
        )}
        {page === "records" && (
          <SpeedRecordsPage
            events={events}
            selectedDate={selectedDate}
            threshold={threshold}
          />
        )}
        {page === "realtime" && (
          <RealtimeLogsPage
            events={events}
            liveEvents={liveEvents}
            threshold={threshold}
          />
        )}
        {page === "overspeeding" && (
          <OverspeedingPage events={events} threshold={threshold} />
        )}
        {page === "analytics" && (
          <AnalyticsPage events={events} threshold={threshold} />
        )}
        {page === "studs" && (
          <StudStatusPage studs={studs} onUpdateStud={updateStud} />
        )}
        {page === "graph" && (
          <GraphPage
            events={events}
            selectedDate={selectedDate}
            threshold={threshold}
          />
        )}
      </main>
    </div>
  );
}
