import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { StudentExam } from './components/StudentExam';
import { RealtimeMonitoring } from './components/RealtimeMonitoring';
import { ExamManager } from './components/ExamManager';
import { QuestionHistoryView } from './components/QuestionHistoryView';
import { StudentManager } from './components/StudentManager';
import { PrintExamView } from './components/PrintExamView';
import { ResultsTable } from './components/ResultsTable';
import { GASCodeViewer } from './components/GASCodeViewer';
import { SettingsManager } from './components/SettingsManager';
import { Exam, Student, SchoolSettings, MonitoringStudent, ExamResult, SavedQuestionPackage, ExamType } from './types';
import { initialExams, initialStudents, initialSchoolSettings, initialSavedPackages } from './initialData';
import { safeFetchJson } from './utils/apiHelper';

export default function App() {
  // Mode: 'siswa' or 'admin'
  const [currentMode, setCurrentMode] = useState<'siswa' | 'admin'>('siswa');
  const [adminTab, setAdminTab] = useState<'monitoring' | 'bank-soal' | 'riwayat-soal' | 'data-siswa' | 'cetak' | 'rekap' | 'gas' | 'settings'>('monitoring');

  // Core Data State with localStorage cache fallback
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const cached = localStorage.getItem('cbt_students_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return initialStudents;
  });
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(initialSchoolSettings);
  const [savedPackages, setSavedPackages] = useState<SavedQuestionPackage[]>(initialSavedPackages);
  const [monitoringList, setMonitoringList] = useState<MonitoringStudent[]>([]);
  const [resultsList, setResultsList] = useState<ExamResult[]>([]);
  const [selectedPrintExam, setSelectedPrintExam] = useState<Exam | null>(null);
  const [preselectedStudent, setPreselectedStudent] = useState<Student | null>(null);

  // Read URL query parameter "?mode=siswa" or "?mode=admin"
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      if (modeParam === 'admin') {
        setCurrentMode('admin');
      } else if (modeParam === 'siswa') {
        setCurrentMode('siswa');
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // Fetch initial state from Express server safely
  const loadInitialData = async () => {
    try {
      const { ok, data } = await safeFetchJson('/api/initial-state');
      if (ok && data) {
        if (data.exams && data.exams.length > 0) setExams(data.exams);
        if (data.students && data.students.length > 0) {
          setStudents((prev) => {
            const serverIds = new Set(data.students.map((s: Student) => s.id));
            const locallyAdded = prev.filter((p) => !serverIds.has(p.id));
            const merged = [...data.students, ...locallyAdded];
            try {
              localStorage.setItem('cbt_students_cache', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
        if (data.schoolSettings) setSchoolSettings(data.schoolSettings);
        if (data.savedPackages && data.savedPackages.length > 0) setSavedPackages(data.savedPackages);
        if (data.monitoring) setMonitoringList(data.monitoring);
        if (data.results) setResultsList(data.results);
      }
    } catch (err) {
      console.warn('Using local initial data state:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Handle Exam creation
  const handleExamCreated = (newExam: Exam) => {
    setExams((prev) => [newExam, ...prev]);
  };

  // Handle Settings update
  const handleUpdateSettings = async (newSettings: SchoolSettings) => {
    setSchoolSettings(newSettings);
    try {
      await safeFetchJson('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch (err) {
      console.error('Failed to persist settings:', err);
    }
  };

  // Handle Deploy Question Package
  const handleDeployPackage = async (
    pkg: SavedQuestionPackage,
    config: { token: string; code: string; duration: number; title: string; examType: ExamType }
  ) => {
    try {
      const { ok, data, error } = await safeFetchJson('/api/question-history/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          code: config.code,
          token: config.token,
          durationMinutes: config.duration,
          title: config.title,
          examType: config.examType,
        }),
      });

      if (!ok || !data) {
        throw new Error(error || 'Gagal mendeploy paket soal.');
      }

      if (data.exam) {
        setExams((prev) => [data.exam, ...prev.filter((e) => e.id !== data.exam.id)]);
      }

      // Mark deployed in savedPackages
      setSavedPackages((prev) =>
        prev.map((p) =>
          p.id === pkg.id
            ? { ...p, isDeployed: true, deployedExamId: data.exam?.id, deployedExamCode: data.exam?.code }
            : p
        )
      );
    } catch (err) {
      console.error('Failed to deploy package:', err);
      throw err;
    }
  };

  // Handle Delete Question Package
  const handleDeletePackage = async (id: string) => {
    try {
      await safeFetchJson(`/api/question-history/${id}`, { method: 'DELETE' });
      setSavedPackages((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete question package:', err);
      throw err;
    }
  };

  // Handle Student CRUD with optimistic update & local cache persistence
  const handleAddStudent = async (student: Student) => {
    // 1. Immediately update UI state & localStorage
    setStudents((prev) => {
      const exists = prev.some((s) => s.id === student.id);
      const updated = exists ? prev.map((s) => (s.id === student.id ? student : s)) : [...prev, student];
      try {
        localStorage.setItem('cbt_students_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Background sync to Express server
    try {
      const { ok, data } = await safeFetchJson('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: student.id,
          name: student.name,
          nisn: student.nisn,
          className: student.class,
          gender: student.gender,
          noAbsen: student.noAbsen,
          status: student.status,
        }),
      });
      if (ok && data?.student) {
        setStudents((prev) => {
          const synced = prev.map((s) => (s.id === student.id ? data.student : s));
          try {
            localStorage.setItem('cbt_students_cache', JSON.stringify(synced));
          } catch {}
          return synced;
        });
      }
    } catch (err) {
      console.warn('Background student sync warning:', err);
    }
  };

  const handleUpdateStudent = async (student: Student) => {
    // 1. Immediately update UI state & localStorage
    setStudents((prev) => {
      const updated = prev.map((s) => (s.id === student.id ? student : s));
      try {
        localStorage.setItem('cbt_students_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Background sync to Express server
    try {
      await safeFetchJson(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: student.name,
          nisn: student.nisn,
          className: student.class,
          gender: student.gender,
          noAbsen: student.noAbsen,
          status: student.status,
        }),
      });
    } catch (err) {
      console.warn('Background student update warning:', err);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    // 1. Immediately update UI state & localStorage
    setStudents((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem('cbt_students_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Background sync to Express server
    try {
      await safeFetchJson(`/api/students/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Background student delete warning:', err);
    }
  };

  const handleBulkAddStudents = async (newStudents: Student[]) => {
    // 1. Immediately update UI state & localStorage
    setStudents((prev) => {
      const updated = [...prev, ...newStudents];
      try {
        localStorage.setItem('cbt_students_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Background sync to Express server
    try {
      const { ok, data } = await safeFetchJson('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: newStudents.map((s) => ({
            id: s.id,
            name: s.name,
            nisn: s.nisn,
            className: s.class,
            gender: s.gender,
            noAbsen: s.noAbsen,
            status: s.status,
          })),
        }),
      });
      if (ok && data?.students) {
        setStudents((prev) => {
          const map = new Map(data.students.map((s: Student) => [s.name + '-' + s.nisn, s]));
          const synced = prev.map((s) => map.get(s.name + '-' + s.nisn) || s);
          try {
            localStorage.setItem('cbt_students_cache', JSON.stringify(synced));
          } catch {}
          return synced;
        });
      }
    } catch (err) {
      console.warn('Background bulk student sync warning:', err);
    }
  };

  // Manually refresh and sync students with server and localStorage
  const handleRefreshStudents = async () => {
    try {
      const { ok, data } = await safeFetchJson('/api/students');
      if (ok && data?.students) {
        setStudents((prev) => {
          const serverMap = new Map(data.students.map((s: Student) => [s.id, s]));
          const localOnly = prev.filter((p) => !serverMap.has(p.id));
          const merged = [...data.students, ...localOnly];
          try {
            localStorage.setItem('cbt_students_cache', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    } catch (err) {
      console.warn('Refresh student sync warning:', err);
    }
  };

  // Switch to Student mode with pre-selected student
  const handleSelectStudentForExam = (student: Student) => {
    setPreselectedStudent(student);
    setCurrentMode('siswa');
  };

  // Handle Exam submission from student
  const handleExamSubmitted = (newResult: ExamResult) => {
    setResultsList((prev) => [newResult, ...prev]);
    loadInitialData();
  };

  // Count active violations for warning badge
  const activeViolationsCount = monitoringList.filter((m) => m.tabSwitches > 0).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Universal Navigation Header */}
      <Navbar
        currentMode={currentMode}
        setMode={setCurrentMode}
        adminTab={adminTab}
        setAdminTab={setAdminTab}
        schoolName={schoolSettings.namaSekolah}
        activeViolationsCount={activeViolationsCount}
        savedPackagesCount={savedPackages.length}
        studentsCount={students.length}
      />

      {/* Main Content Area */}
      <div className="flex-1">
        {currentMode === 'siswa' ? (
          <StudentExam
            students={students}
            exams={exams}
            schoolSettings={schoolSettings}
            preselectedStudent={preselectedStudent}
            onViolationOccurred={loadInitialData}
            onExamSubmitted={handleExamSubmitted}
          />
        ) : (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {adminTab === 'monitoring' && (
              <RealtimeMonitoring
                initialStudents={monitoringList}
                onRefreshRequest={loadInitialData}
              />
            )}

            {adminTab === 'bank-soal' && (
              <ExamManager
                exams={exams}
                onExamCreated={handleExamCreated}
                onSelectPrintExam={(ex) => {
                  setSelectedPrintExam(ex);
                  setAdminTab('cetak');
                }}
                onNavigateToSettings={() => setAdminTab('settings')}
              />
            )}

            {adminTab === 'riwayat-soal' && (
              <QuestionHistoryView
                packages={savedPackages}
                onDeployPackage={handleDeployPackage}
                onDeletePackage={handleDeletePackage}
                onSelectPrintExam={(ex) => {
                  setSelectedPrintExam(ex);
                  setAdminTab('cetak');
                }}
                onNavigateToAI={() => setAdminTab('bank-soal')}
              />
            )}

            {adminTab === 'data-siswa' && (
              <StudentManager
                students={students}
                onAddStudent={handleAddStudent}
                onUpdateStudent={handleUpdateStudent}
                onDeleteStudent={handleDeleteStudent}
                onBulkAddStudents={handleBulkAddStudents}
                onSelectStudentForExam={handleSelectStudentForExam}
                onRefreshStudents={handleRefreshStudents}
              />
            )}

            {adminTab === 'cetak' && (
              <PrintExamView
                exams={exams}
                schoolSettings={schoolSettings}
                onUpdateSettings={handleUpdateSettings}
                defaultSelectedExam={selectedPrintExam}
              />
            )}

            {adminTab === 'rekap' && (
              <ResultsTable
                results={resultsList}
                schoolSettings={schoolSettings}
              />
            )}

            {adminTab === 'gas' && <GASCodeViewer />}

            {adminTab === 'settings' && <SettingsManager />}
          </main>
        )}
      </div>
    </div>
  );
}
