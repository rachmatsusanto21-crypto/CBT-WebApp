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
import { Exam, Student, SchoolSettings, MonitoringStudent, ExamResult, SavedQuestionPackage, ExamType } from './types';
import { initialExams, initialStudents, initialSchoolSettings, initialSavedPackages } from './initialData';

export default function App() {
  // Mode: 'siswa' or 'admin'
  const [currentMode, setCurrentMode] = useState<'siswa' | 'admin'>('siswa');
  const [adminTab, setAdminTab] = useState<'monitoring' | 'bank-soal' | 'riwayat-soal' | 'data-siswa' | 'cetak' | 'rekap' | 'gas'>('monitoring');

  // Core Data State
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [students, setStudents] = useState<Student[]>(initialStudents);
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

  // Fetch initial state from Express server
  const loadInitialData = async () => {
    try {
      const res = await fetch('/api/initial-state');
      if (res.ok) {
        const data = await res.json();
        if (data.exams && data.exams.length > 0) setExams(data.exams);
        if (data.students && data.students.length > 0) setStudents(data.students);
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
      await fetch('/api/settings', {
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
      const res = await fetch('/api/question-history/deploy', {
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

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mendeploy paket soal.');
      }

      const data = await res.json();
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
      await fetch(`/api/question-history/${id}`, { method: 'DELETE' });
      setSavedPackages((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete question package:', err);
      throw err;
    }
  };

  // Handle Student CRUD
  const handleAddStudent = async (student: Student) => {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
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
      if (res.ok) {
        const data = await res.json();
        if (data.student) {
          setStudents((prev) => [...prev, data.student]);
        }
      } else {
        setStudents((prev) => [...prev, student]);
      }
    } catch (err) {
      setStudents((prev) => [...prev, student]);
    }
  };

  const handleUpdateStudent = async (student: Student) => {
    try {
      await fetch(`/api/students/${student.id}`, {
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
      setStudents((prev) => prev.map((s) => (s.id === student.id ? student : s)));
    } catch (err) {
      setStudents((prev) => prev.map((s) => (s.id === student.id ? student : s)));
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' });
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setStudents((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleBulkAddStudents = async (newStudents: Student[]) => {
    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: newStudents }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.students) {
          setStudents((prev) => [...prev, ...data.students]);
        }
      } else {
        setStudents((prev) => [...prev, ...newStudents]);
      }
    } catch (err) {
      setStudents((prev) => [...prev, ...newStudents]);
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
          </main>
        )}
      </div>
    </div>
  );
}
