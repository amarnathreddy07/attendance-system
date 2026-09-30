import { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { RECORD_STATUS } from '../db/db.js';
import { getSessionsForClass } from '../db/repositories.js';
import { fromDateKey, formatDate, getMonthGrid } from '../lib/utils.js';
import { BackLink, EmptyState, PageHeader } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

function SessionRow({ session, klass, counts, sessionLabel }) {
  const navigate = useNavigate();
  const pct = counts.total ? ((counts.present / counts.total) * 100).toFixed(1) : '0.0';
  const day = fromDateKey(session.date);
  return (
    <button
      onClick={() => navigate(`/classes/${klass.id}/history/${session.id}`)}
      className="card flex w-full items-center gap-4 p-4 text-left transition hover:shadow-lift"
    >
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <span className="text-lg font-black leading-none">{day.getDate()}</span>
        <span className="text-[10px] font-bold uppercase">
          {day.toLocaleDateString('en-US', { month: 'short' })}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-900">{sessionLabel || formatDate(day)}</p>
        <p className="text-sm text-slate-500">
          {counts.present} / {counts.total} present
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            Number(pct) >= 75 ? 'bg-emerald-50 text-emerald-700' : Number(pct) >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {pct}%
        </span>
        <Icon d={Icons.arrowLeft} className="h-4 w-4 rotate-180 text-slate-400" />
      </div>
    </button>
  );
}

export default function AttendanceHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const klass = useLiveQuery(() => db.classes.get(id), [id]);
  const sessions = useLiveQuery(() => getSessionsForClass(id), [id]);
  const rosterTotal = useLiveQuery(
    async () => db.students.where('class_id').equals(id).filter((s) => s.status === 'active').count(),
    [id]
  );
  const [month, setMonth] = useState(new Date());
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedDate = searchParams.get('date') || todayKey;
  const setSelectedDate = (val) => setSearchParams((p) => { const np = new URLSearchParams(p); if (!val) np.delete('date'); else np.set('date', val); return np; });

  const allRecords = useLiveQuery(
    async () => {
      if (!sessions || sessions.length === 0) return {};
      const ids = sessions.map((s) => s.id);
      const recs = await db.attendance_records.where('attendance_session_id').anyOf(ids).toArray();
      const map = {};
      for (const r of recs) {
        if (!map[r.attendance_session_id]) map[r.attendance_session_id] = [];
        map[r.attendance_session_id].push(r);
      }
      return map;
    },
    [sessions?.length]
  );

  const rows = useMemo(() => {
    const total = rosterTotal ?? null;
    const sessionList = sessions || [];

    const dayCount = {};
    for (const s of sessionList) {
      dayCount[s.date] = (dayCount[s.date] || 0) + 1;
    }

    const dayIndex = {};
    return sessionList.map((s) => {
      const recs = allRecords?.[s.id] || [];
      dayCount[s.date] = dayCount[s.date] || 0;
      dayIndex[s.date] = (dayIndex[s.date] || 0) + 1;
      const idx = dayIndex[s.date];
      const count = dayCount[s.date] || 0;
      const sessionLabel = count > 1 ? `Session ${idx}` : formatDate(fromDateKey(s.date));
      return {
        session: s,
        sessionLabel,
        counts: {
          total: total ?? recs.length,
          present: recs.filter((r) => r.status === RECORD_STATUS.PRESENT).length,
          absent: recs.filter((r) => r.status === RECORD_STATUS.ABSENT).length,
        },
      };
    });
  }, [sessions, allRecords, rosterTotal]);

  const sessionByDate = useMemo(() => {
    const map = {};
    for (const row of rows) {
      if (!map[row.session.date]) map[row.session.date] = [];
      map[row.session.date].push(row);
    }
    return map;
  }, [rows]);

  const selectedSessions = selectedDate ? sessionByDate[selectedDate] || [] : [];

  const monthGrid = useMemo(() => getMonthGrid(month), [month]);
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month);

  if (!klass) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <BackLink to="/history" label="Back to Attendance History" />
      </div>
      <PageHeader title="Attendance History" subtitle={klass.class_name} />

      {rows.length > 0 ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="card p-4 sm:p-5 lg:w-[520px] shrink-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                ← Previous
              </button>
              <div className="text-center">
                <p className="text-lg font-black text-slate-900">{monthLabel}</p>
                <p className="text-xs text-slate-500">Local attendance records</p>
              </div>
              <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                Next →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthGrid.cells.map((date) => {
                const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const hasSessions = !!sessionByDate[dayKey];
                const isCurrentMonth = date.getMonth() === month.getMonth();
                const now = new Date();
                const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const isToday = dayKey === todayKey;
                const isSelected = selectedDate === dayKey;
                const sessionsOnDay = sessionByDate[dayKey] || [];
                const totalCount = sessionsOnDay.reduce((sum, s) => sum + s.counts.total, 0);
                return (
                  <button
                    key={`${dayKey}-cell`}
                    onClick={() => setSelectedDate(isSelected ? null : dayKey)}
                    className={[
                      'relative flex min-h-[64px] flex-col rounded-lg border p-1 text-left transition',
                      isToday ? 'border-brand-300 bg-brand-50 ring-2 ring-brand-300' : isCurrentMonth ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 text-slate-400',
                      hasSessions && !isToday ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50' : '',
                      isToday ? '' : 'hover:bg-slate-50',
                      isSelected ? 'ring-2 ring-brand-500 border-brand-300' : '',
                    ].join(' ')}
                  >
                    <span className="text-xs font-bold">{date.getDate()}</span>
                    {hasSessions ? (
                      <div className="mt-auto">
                        <div className="text-[10px] font-bold text-emerald-700">✓</div>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {selectedDate ? (
              <>
                <div className="mb-3 mt-5 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{formatDate(fromDateKey(selectedDate))}</h3>
                  {selectedDate === todayKey ? (
                    <button className="btn-secondary text-sm" disabled>
                      <Icon d={Icons.check} className="h-4 w-4" /> Today
                    </button>
                  ) : (
                    <button className="btn-secondary text-sm" onClick={() => { setMonth(new Date()); setSelectedDate(todayKey); }}>
                      <Icon d={Icons.home} className="h-4 w-4" /> Back to Today
                    </button>
                  )}
                </div>
                {selectedSessions.length > 0 ? (
                  <div className="space-y-3">
                    {selectedSessions.map(({ session, counts, sessionLabel }) => (
                      <SessionRow key={session.id} session={session} klass={klass} counts={counts} sessionLabel={sessionLabel} />
                    ))}
                  </div>
                ) : (
                  <div className="card flex flex-col items-center justify-center p-8 text-center">
                    <Icon d={Icons.history} className="h-10 w-10 text-slate-300" />
                    <p className="mt-3 font-semibold text-slate-700">No sessions found</p>
                    <p className="text-sm text-slate-500">No attendance was taken on this date.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="card flex flex-col items-center justify-center p-8 text-center">
                <Icon d={Icons.calendar} className="h-10 w-10 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">Select a date</p>
                <p className="text-sm text-slate-500">Click a day on the calendar to view its sessions.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Icons.history}
          title="No attendance recorded yet"
          message="Attendance you submit will appear here, stored locally on this device."
        />
      )}
    </div>
  );
}
