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
import { GoogleDriveManager } from './components/GoogleDriveManager';
import { Exam, Student, SchoolSettings, MonitoringStudent, ExamResult, SavedQuestionPackage, ExamType } from './types';
import { initialExams, initialStudents, initialSchoolSettings, initialSavedPackages } from './initialData';
import { safeFetchJson } from './utils/apiHelper';
import { getCachedAccessToken } from './services/firebaseAuth';
import { saveFullBackupToDrive } from './services/googleDriveService';

// Import the database instance we just configured
import { db } from "./firebase"; 
import { collection, addDoc } from "firebase/firestore";

// Example function using the imported 'db'
async function saveEntry() {
  try {
    await addDoc(collection(db, "logs"), {
      message: "App initialized successfully!",
      createdAt: new Date()
    });
    console.info("Firestore entry saved successfully (logs).");
  } catch (error) {
    console.warn("Firestore saveEntry info:", error);
  }
}

// Helper to get initial exams safely respecting cache & deleted list
const getInitialExams = (): Exam[] => {
  try {
    const deletedRaw = localStorage.getItem('cbt_deleted_exam_ids');
    const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    const deletedSet = new Set(deletedIds);

    const cachedRaw = localStorage.getItem('cbt_exams_cache');
    if (cachedRaw) {
      const parsed: Exam[] = JSON.parse(cachedRaw);
      if (Array.isArray(parsed)) {
        return parsed.filter((e) => !deletedSet.has(e.id));
      }
    }
    return initialExams.filter((e) => !deletedSet.has(e.id));
  } catch {
    return initialExams;
  }
};

// Helper to get initial saved question packages safely respecting cache & deleted list
const getInitialSavedPackages = (): SavedQuestionPackage[] => {
  try {
    const deletedRaw = localStorage.getItem('cbt_deleted_package_ids');
    const deletedIds: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    const deletedSet = new Set(deletedIds);

    const cachedRaw = localStorage.getItem('cbt_saved_packages_cache');
    if (cachedRaw) {
      const parsed: SavedQuestionPackage[] = JSON.parse(cachedRaw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p) => !deletedSet.has(p.id));
      }
    }
    return initialSavedPackages.filter((p) => !deletedSet.has(p.id));
  } catch {
    return initialSavedPackages;
  }
};

export default function App() {
  // Mode: 'siswa' or 'admin'
  const [currentMode, setCurrentMode] = useState<'siswa' | 'admin'>('siswa');
  const [adminTab, setAdminTab] = useState<'monitoring' | 'bank-soal' | 'riwayat-soal' | 'data-siswa' | 'cetak' | 'rekap' | 'gas' | 'settings' | 'gdrive'>('monitoring');

  // Core Data State with localStorage cache fallback
  const [exams, setExams] = useState<Exam[]>(getInitialExams);
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
  const [savedPackages, setSavedPackages] = useState<SavedQuestionPackage[]>(getInitialSavedPackages);
  const [monitoringList, setMonitoringList] = useState<MonitoringStudent[]>([]);
  const [resultsList, setResultsList] = useState<ExamResult[]>([]);
  const [selectedPrintExam, setSelectedPrintExam] = useState<Exam | null>(null);
  const [preselectedStudent, setPreselectedStudent] = useState<Student | null>(null);
  const [preselectedExam, setPreselectedExam] = useState<Exam | null>(null);

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
        // Read deleted IDs to ensure deleted items never get resurrected on reload
        const deletedExamIds: string[] = (() => {
          try {
            const raw = localStorage.getItem('cbt_deleted_exam_ids');
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        })();
        const deletedExamSet = new Set(deletedExamIds);

        const deletedPackageIds: string[] = (() => {
          try {
            const raw = localStorage.getItem('cbt_deleted_package_ids');
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        })();
        const deletedPackageSet = new Set(deletedPackageIds);

        if (data.exams && Array.isArray(data.exams)) {
          const validServerExams = data.exams.filter((e: Exam) => !deletedExamSet.has(e.id));
          setExams((prev) => {
            const serverMap = new Map(validServerExams.map((e: Exam) => [e.id, e]));
            const localOnly = prev.filter((e) => !deletedExamSet.has(e.id) && !serverMap.has(e.id));
            const merged = [...validServerExams, ...localOnly];
            try {
              localStorage.setItem('cbt_exams_cache', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

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

        if (data.savedPackages && Array.isArray(data.savedPackages)) {
          const validServerPackages = data.savedPackages.filter((p: SavedQuestionPackage) => !deletedPackageSet.has(p.id));
          setSavedPackages((prev) => {
            const serverMap = new Map(validServerPackages.map((p: SavedQuestionPackage) => [p.id, p]));
            const localOnly = prev.filter((p) => !deletedPackageSet.has(p.id) && !serverMap.has(p.id));
            const merged = [...validServerPackages, ...localOnly];
            try {
              localStorage.setItem('cbt_saved_packages_cache', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        if (data.monitoring) setMonitoringList(data.monitoring);
        if (data.results) setResultsList(data.results);
      }
    } catch (err) {
      console.warn('Using local initial data state:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
    saveEntry();
  }, []);

  // Handle Exam creation
  const handleExamCreated = (newExam: Exam) => {
    setExams((prev) => {
      const exists = prev.some((e) => e.id === newExam.id);
      const updated = exists ? prev.map((e) => (e.id === newExam.id ? newExam : e)) : [newExam, ...prev];
      try {
        localStorage.setItem('cbt_exams_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    safeFetchJson('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExam),
    }).catch(() => {});
  };

  // Handle Exam update (Edit)
  const handleUpdateExam = async (updatedExam: Exam) => {
    setExams((prev) => {
      const updated = prev.map((e) => (e.id === updatedExam.id ? updatedExam : e));
      try {
        localStorage.setItem('cbt_exams_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await safeFetchJson(`/api/exams/${updatedExam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedExam),
      });
    } catch (err) {
      console.warn('Backend update exam warning:', err);
    }
  };

  // Handle Exam delete (Hapus)
  const handleDeleteExam = async (id: string) => {
    // 1. Immediately remove from React state and localStorage cache
    setExams((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      try {
        localStorage.setItem('cbt_exams_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Blacklist ID in localStorage so it never re-appears upon reload
    try {
      const deletedRaw = localStorage.getItem('cbt_deleted_exam_ids');
      const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        localStorage.setItem('cbt_deleted_exam_ids', JSON.stringify(deletedList));
      }
    } catch {}

    // 3. Inform backend
    try {
      await safeFetchJson(`/api/exams/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Backend delete exam warning:', err);
    }
  };

  // Handle Save to Question History
  const handleSaveToHistory = (pkg: SavedQuestionPackage) => {
    setSavedPackages((prev) => {
      const exists = prev.some((p) => p.id === pkg.id);
      const updated = exists ? prev.map((p) => (p.id === pkg.id ? pkg : p)) : [pkg, ...prev];
      try {
        localStorage.setItem('cbt_saved_packages_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    safeFetchJson('/api/question-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pkg),
    }).catch(() => {});
  };

  // Handle Select Exam for Student Mode test
  const handleSelectExamForStudent = (exam: Exam) => {
    setPreselectedExam(exam);
    setCurrentMode('siswa');
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

  // Handle Deploy Question Package (Fail-safe with instant local state)
  const handleDeployPackage = async (
    pkg: SavedQuestionPackage,
    config: { token: string; code: string; duration: number; title: string; examType: ExamType }
  ) => {
    try {
      const newExam: Exam = {
        id: 'exam-' + Date.now(),
        code: config.code.trim().toUpperCase(),
        title: config.title.trim() || pkg.title,
        subject: pkg.subject,
        grade: pkg.grade,
        examType: config.examType || pkg.examType,
        token: config.token.trim().toUpperCase(),
        durationMinutes: Number(config.duration) || 30,
        questions: pkg.questions,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      // 1. Immediately create exam in active exams state & cache (guaranteed success)
      handleExamCreated(newExam);

      // 2. Mark deployed in savedPackages
      setSavedPackages((prev) => {
        const updated = prev.map((p) =>
          p.id === pkg.id
            ? { ...p, isDeployed: true, deployedExamCode: newExam.code }
            : p
        );
        try {
          localStorage.setItem('cbt_saved_packages_cache', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // 3. Attempt server deploy in background
      safeFetchJson('/api/question-history/deploy', {
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
      }).catch((e) => console.warn('Server sync history deploy warning:', e));
    } catch (err) {
      console.error('Failed to deploy package:', err);
      throw err;
    }
  };

  // Handle Delete Question Package
  const handleDeletePackage = async (id: string) => {
    // 1. Immediately remove from React state & localStorage
    setSavedPackages((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('cbt_saved_packages_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Blacklist ID so it never re-appears upon reload
    try {
      const deletedRaw = localStorage.getItem('cbt_deleted_package_ids');
      const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        localStorage.setItem('cbt_deleted_package_ids', JSON.stringify(deletedList));
      }
    } catch {}

    // 3. Inform backend
    try {
      await safeFetchJson(`/api/question-history/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete question package:', err);
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

  // Handle newly loaded exam from direct student link or Google Drive
  const handleExamLoaded = (loadedExam: Exam) => {
    setExams((prev) => {
      const exists = prev.some((e) => e.id === loadedExam.id || e.code === loadedExam.code);
      if (exists) {
        return prev.map((e) => (e.id === loadedExam.id || e.code === loadedExam.code ? loadedExam : e));
      }
      const updated = [loadedExam, ...prev];
      try {
        localStorage.setItem('cbt_exams_cache', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Purge sample/demo data (AI Studio defaults) so only user-created content exists
  const handlePurgeSampleData = async () => {
    // 1. Filter out sample exams
    const realExams = exams.filter((e) => e.id !== 'exam-1' && e.id !== 'exam-2' && e.code !== 'MAT101' && e.code !== 'IPA202');
    setExams(realExams);
    try {
      const deletedExamIds = ['exam-1', 'exam-2'];
      localStorage.setItem('cbt_deleted_exam_ids', JSON.stringify(deletedExamIds));
      localStorage.setItem('cbt_exams_cache', JSON.stringify(realExams));
    } catch {}

    // 2. Filter out sample packages
    const realPackages = savedPackages.filter((p) => p.id !== 'pkg-pancasila-1' && !(p.title && p.title.toLowerCase().includes('pancasila')));
    setSavedPackages(realPackages);
    try {
      const deletedPkgIds = ['pkg-pancasila-1'];
      localStorage.setItem('cbt_deleted_package_ids', JSON.stringify(deletedPkgIds));
      localStorage.setItem('cbt_saved_packages_cache', JSON.stringify(realPackages));
    } catch {}

    // 3. Filter out sample students
    const realStudents = students.filter((s) => !(/^std-(10|[1-9])$/.test(s.id)) && s.name !== 'Ahmad Dahlan');
    setStudents(realStudents);
    try {
      localStorage.setItem('cbt_students_cache', JSON.stringify(realStudents));
    } catch {}

    // 4. Notify backend server
    await safeFetchJson('/api/purge-sample-data', { method: 'POST' }).catch(() => {});

    // 5. If Google Drive is connected, push clean backup immediately
    const token = getCachedAccessToken();
    if (token) {
      await saveFullBackupToDrive(
        {
          exams: realExams,
          savedPackages: realPackages,
          students: realStudents,
          schoolSettings,
          timestamp: new Date().toISOString(),
        },
        token
      ).catch(() => {});
    }
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
            preselectedExam={preselectedExam}
            onViolationOccurred={loadInitialData}
            onExamSubmitted={handleExamSubmitted}
            onExamLoaded={handleExamLoaded}
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
                onUpdateExam={handleUpdateExam}
                onDeleteExam={handleDeleteExam}
                onSelectExamForStudent={handleSelectExamForStudent}
                onSaveToHistory={handleSaveToHistory}
                onOpenHistory={() => setAdminTab('riwayat-soal')}
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
                onStudentsLoaded={(loadedStudents) => {
                  setStudents((prev) => {
                    const loadedMap = new Map(loadedStudents.map((s) => [s.id, s]));
                    const filtered = prev.filter((s) => !loadedMap.has(s.id));
                    const merged = [...loadedStudents, ...filtered];
                    try {
                      localStorage.setItem('cbt_students_cache', JSON.stringify(merged));
                    } catch {}
                    return merged;
                  });
                }}
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

            {adminTab === 'gdrive' && (
              <GoogleDriveManager
                exams={exams}
                savedPackages={savedPackages}
                students={students}
                schoolSettings={schoolSettings}
                onExamsLoaded={(loadedExams) => {
                  setExams((prev) => {
                    const loadedMap = new Map(loadedExams.map((e) => [e.id, e]));
                    const filtered = prev.filter((e) => !loadedMap.has(e.id));
                    const merged = [...loadedExams, ...filtered];
                    try {
                      localStorage.setItem('cbt_exams_cache', JSON.stringify(merged));
                    } catch {}
                    return merged;
                  });
                }}
                onPackagesLoaded={(loadedPkgs) => {
                  setSavedPackages((prev) => {
                    const loadedMap = new Map(loadedPkgs.map((p) => [p.id, p]));
                    const filtered = prev.filter((p) => !loadedMap.has(p.id));
                    const merged = [...loadedPkgs, ...filtered];
                    try {
                      localStorage.setItem('cbt_saved_packages_cache', JSON.stringify(merged));
                    } catch {}
                    return merged;
                  });
                }}
                onStudentsLoaded={(loadedStudents) => {
                  setStudents((prev) => {
                    const loadedMap = new Map(loadedStudents.map((s) => [s.id, s]));
                    const filtered = prev.filter((s) => !loadedMap.has(s.id));
                    const merged = [...loadedStudents, ...filtered];
                    try {
                      localStorage.setItem('cbt_students_cache', JSON.stringify(merged));
                    } catch {}
                    return merged;
                  });
                }}
                onPurgeSampleData={handlePurgeSampleData}
              />
            )}

            {adminTab === 'settings' && <SettingsManager />}
          </main>
        )}
      </div>
    </div>
  );
}
