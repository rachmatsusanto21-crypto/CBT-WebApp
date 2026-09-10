import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { StudentExam } from './components/StudentExam';
import { RealtimeMonitoring } from './components/RealtimeMonitoring';
import { ExamManager } from './components/ExamManager';
import { PrintExamView } from './components/PrintExamView';
import { ResultsTable } from './components/ResultsTable';
import { GASCodeViewer } from './components/GASCodeViewer';
import { Exam, Student, SchoolSettings, MonitoringStudent, ExamResult } from './types';
import { initialExams, initialStudents, initialSchoolSettings } from './initialData';

export default function App() {
  // Mode: 'siswa' or 'admin'
  const [currentMode, setCurrentMode] = useState<'siswa' | 'admin'>('siswa');
  const [adminTab, setAdminTab] = useState<'monitoring' | 'bank-soal' | 'cetak' | 'rekap' | 'gas'>('monitoring');

  // Core Data State
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(initialSchoolSettings);
  const [monitoringList, setMonitoringList] = useState<MonitoringStudent[]>([]);
  const [resultsList, setResultsList] = useState<ExamResult[]>([]);
  const [selectedPrintExam, setSelectedPrintExam] = useState<Exam | null>(null);

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
      />

      {/* Main Content Area */}
      <div className="flex-1">
        {currentMode === 'siswa' ? (
          <StudentExam
            students={students}
            exams={exams}
            schoolSettings={schoolSettings}
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
