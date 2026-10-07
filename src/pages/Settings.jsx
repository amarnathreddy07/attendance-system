import { useRef, useState } from 'react';
import db from '../db/db.js';
import { exportBackup, downloadBackup, importBackup } from '../lib/backup.js';
import { useApp } from '../state/AppContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import InstallApp from '../components/InstallApp.jsx';
import { PageHeader } from '../components/ui.jsx';
import Modal, { Confirm } from '../components/Modal.jsx';
import { Icons, Icon } from '../components/icons.jsx';

function Section({ title, subtitle, children }) {
  return (
    <section className="card p-5">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { pushToast, teacher, isAdmin, pendingSync, syncNow } = useApp();
  const { signOut } = useAuth();

  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [clearStep, setClearStep] = useState('backup');
  const [clearConfirmCode, setClearConfirmCode] = useState('');
  const [clearUserInput, setClearUserInput] = useState('');
  const fileRef = useRef(null);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader title="Settings" subtitle="Your account, local data and sync status." />

      <div className="space-y-5">
        <Section
          title="Account"
          subtitle="Your role and class access are managed by an administrator on the server."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label">Name</p>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
                {teacher?.name || '—'}
              </p>
            </div>
            <div>
              <p className="label">Email</p>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {teacher?.email || '—'}
              </p>
            </div>
            <div>
              <p className="label">Role</p>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium capitalize text-slate-900">
                {teacher?.role || '—'}
                {isAdmin ? ' · full admin access' : ''}
              </p>
            </div>
            <div>
              <p className="label">Offline queue</p>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {pendingSync > 0
                  ? `${pendingSync} change${pendingSync === 1 ? '' : 's'} waiting to sync`
                  : 'Everything is synced'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="btn-secondary"
              onClick={async () => {
                try {
                  const result = await syncNow();
                  pushToast({
                    type: result.failed ? 'error' : 'success',
                    title: result.failed ? 'Some changes could not sync' : 'Sync complete',
                    message:
                      result.failed > 0
                        ? `${result.failed} item(s) are queued and will retry automatically.`
                        : `${result.synced} change(s) sent to the class sheet.`,
                  });
                } catch (err) {
                  pushToast({ type: 'error', title: 'Sync failed', message: err.message });
                }
              }}
            >
              Sync now
            </button>
            <button
              className="btn-primary"
              onClick={async () => {
                await signOut();
              }}
            >
              Sign out
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Profile changes (name, role, class access) are made by an administrator in the Admin area or
            directly in the class sheet.
          </p>
        </Section>

        <Section title="Local Data" subtitle="Your data lives in this browser. Back it up regularly.">
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="flex items-start gap-2 font-medium">
              <Icon d={Icons.warning} className="mt-0.5 h-4 w-4 shrink-0" />
              Your attendance data is stored locally. Export a backup regularly to avoid losing data if this
              browser/device is reset. Backups are never uploaded anywhere.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn-primary"
              onClick={async () => {
                const backup = await exportBackup();
                downloadBackup(backup);
                pushToast({ type: 'success', title: 'Backup exported', message: 'Downloaded a local backup file.' });
              }}
            >
              <Icon d={Icons.download} className="h-4 w-4" /> Export Local Data
            </button>
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <Icon d={Icons.upload} className="h-4 w-4" /> Import Local Data
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const data = JSON.parse(String(reader.result || ''));
                    setImportError('');
                    setImportOpen(data);
                  } catch {
                    setImportError('This file is not valid JSON.');
                    setImportOpen(null);
                  }
                };
                reader.readAsText(f);
              }}
            />
            <div className="flex-1" />
            <button
              className="btn-danger"
              onClick={() => {
                setClearStep('backup');
                setClearOpen(true);
              }}
            >
              <Icon d={Icons.trash} className="h-4 w-4" /> Clear All Local Data
            </button>
          </div>
        </Section>

        <InstallApp />

        <Section title="Privacy" subtitle="What happens with your data.">
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <Icon d={Icons.lock} className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Attendance is written to the class sheet through the AttendIt backend after you sign in.
              Classes, students and history are cached in this browser (IndexedDB) for offline use.
            </li>
            <li className="flex items-start gap-2">
              <Icon d={Icons.info} className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              Changes made offline stay queued on this device until they sync. Nothing is deleted silently —
              failed syncs are retried and can be reviewed in the offline queue.
            </li>
          </ul>
        </Section>
      </div>

      <Modal open={!!importOpen} onClose={() => setImportOpen(null)} title="Import Local Data" size="sm">
        <p className="text-sm leading-6 text-slate-600">
          Importing will merge the backup into this browser. Records with the same ID are replaced; everything else is
          added. Use this to restore your data on a new computer.
        </p>
        {importError && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{importError}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setImportOpen(null)}>Cancel</button>
          <button
            className="btn-primary"
            onClick={async () => {
              try {
                await importBackup(importOpen);
                setImportOpen(null);
                pushToast({ type: 'success', title: 'Data imported', message: 'Your backup was restored.' });
              } catch (err) {
                setImportError(err.message);
              }
            }}
          >
            Import Data
          </button>
        </div>
      </Modal>

      <Modal
        open={clearOpen}
        onClose={() => {
          setClearOpen(false);
          setClearStep('backup');
          setClearConfirmCode('');
          setClearUserInput('');
        }}
        title={clearStep === 'backup' ? 'Create a backup first?' : 'Clear all local data?'}
        size="sm"
      >
        {clearStep === 'backup' ? (
          <>
            <p className="text-sm leading-6 text-slate-600">
              Since you are deleting everything, are you sure you don't want a backup? You can export your data now or continue without it.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => {
                setClearStep('confirm');
                const code = String(Math.floor(Math.random() * 90000) + 10000);
                setClearConfirmCode(code);
                setClearUserInput('');
              }}>
                Continue Without Backup
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  try {
                    const backup = await exportBackup();
                    downloadBackup(backup);
                    pushToast({ type: 'success', title: 'Backup exported', message: 'Downloaded a local backup file.' });
                    setClearStep('confirm');
                    const code = String(Math.floor(Math.random() * 90000) + 10000);
                    setClearConfirmCode(code);
                    setClearUserInput('');
                  } catch (err) {
                    pushToast({ type: 'error', title: 'Export failed', message: err.message });
                  }
                }}
              >
                <Icon d={Icons.download} className="h-4 w-4" /> Export Backup
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-slate-600">
              This permanently deletes your profile, classes, students and attendance from this browser.
            </p>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Type these numbers to confirm:</p>
                <p className="mt-2 font-mono text-2xl font-black text-amber-900">{clearConfirmCode.split('').join(' ')}</p>
              </div>
              <div>
                <label className="label text-sm" htmlFor="clear-confirm-input">
                  Confirmation Code
                </label>
                <input
                  id="clear-confirm-input"
                  type="text"
                  className="input font-mono text-lg tracking-wider"
                  placeholder="Enter the numbers above"
                  value={clearUserInput}
                  onChange={(e) => setClearUserInput(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
                {clearUserInput && clearUserInput !== clearConfirmCode && (
                  <p className="mt-2 text-xs font-medium text-rose-600">Numbers don't match</p>
                )}
                {clearUserInput === clearConfirmCode && (
                  <p className="mt-2 text-xs font-medium text-emerald-600">Verified — ready to delete</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => {
                setClearOpen(false);
                setClearStep('backup');
                setClearConfirmCode('');
                setClearUserInput('');
              }}>
                Cancel
              </button>
              <button
                className="btn-danger"
                disabled={clearUserInput !== clearConfirmCode}
                onClick={async () => {
                  try {
                    await Promise.all(
                      ['teachers', 'classes', 'students', 'attendance_sessions', 'attendance_records', 'settings'].map((t) =>
                        db.table(t).clear()
                      )
                    );
                    setClearOpen(false);
                    pushToast({ type: 'info', title: 'All data cleared', message: 'You can set up your profile again.' });
                    window.location.reload();
                  } catch (err) {
                    pushToast({ type: 'error', title: 'Error clearing data', message: err.message });
                  }
                }}
              >
                Clear Everything
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
