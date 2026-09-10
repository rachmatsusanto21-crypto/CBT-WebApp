import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { initialExams, initialStudents, initialSchoolSettings, initialSavedPackages, EDUCATIONAL_IMAGE_PRESETS } from "./src/initialData";
import { Exam, Student, SchoolSettings, MonitoringStudent, ExamResult, Question, SavedQuestionPackage, QuestionType, ExamType } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// In-Memory Database
let exams: Exam[] = [...initialExams];
let students: Student[] = [...initialStudents];
let schoolSettings: SchoolSettings = { ...initialSchoolSettings };
let savedPackages: SavedQuestionPackage[] = [...initialSavedPackages];
let monitoringList: Map<string, MonitoringStudent> = new Map();
let examResults: ExamResult[] = [];

// Initialize AI Client
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Initial state
app.get("/api/initial-state", (req, res) => {
  res.json({
    exams,
    students,
    schoolSettings,
    savedPackages,
    monitoring: Array.from(monitoringList.values()),
    results: examResults,
  });
});

// Update school settings
app.put("/api/settings", (req, res) => {
  try {
    const updated = req.body;
    schoolSettings = { ...schoolSettings, ...updated };
    res.json({ success: true, schoolSettings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// MANAJEMEN DATA SISWA APIs
// ========================

// Get all students
app.get("/api/students", (req, res) => {
  res.json({ success: true, students });
});

// Add single student
app.post("/api/students", (req, res) => {
  try {
    const { name, nisn, className, gender, noAbsen, status } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Nama siswa wajib diisi" });
    }
    const newStudent: Student = {
      id: "std-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      name: name.trim(),
      nisn: (nisn || "00" + Math.floor(10000000 + Math.random() * 90000000)).trim(),
      class: className || "X-MIPA 1",
      gender: gender || "L",
      noAbsen: noAbsen ? Number(noAbsen) : students.length + 1,
      status: status || "Aktif",
    };
    students.push(newStudent);
    res.json({ success: true, student: newStudent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk import students
app.post("/api/students/bulk", (req, res) => {
  try {
    const { students: rawList } = req.body;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return res.status(400).json({ error: "Data siswa massal tidak valid atau kosong" });
    }

    const createdList: Student[] = [];
    rawList.forEach((item: any, idx: number) => {
      if (item && item.name) {
        const std: Student = {
          id: "std-" + Date.now() + "-" + idx,
          name: item.name.trim(),
          nisn: (item.nisn || "00" + Math.floor(10000000 + Math.random() * 90000000)).trim(),
          class: item.class || item.className || "X-MIPA 1",
          gender: item.gender === "P" ? "P" : "L",
          noAbsen: item.noAbsen ? Number(item.noAbsen) : idx + 1,
          status: item.status || "Aktif",
        };
        students.push(std);
        createdList.push(std);
      }
    });

    res.json({ success: true, count: createdList.length, students: createdList });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update student
app.put("/api/students/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, nisn, className, gender, noAbsen, status } = req.body;
    const index = students.findIndex((s) => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Siswa tidak ditemukan" });
    }
    students[index] = {
      ...students[index],
      name: name !== undefined ? name.trim() : students[index].name,
      nisn: nisn !== undefined ? nisn.trim() : students[index].nisn,
      class: className !== undefined ? className : students[index].class,
      gender: gender !== undefined ? gender : students[index].gender,
      noAbsen: noAbsen !== undefined ? Number(noAbsen) : students[index].noAbsen,
      status: status !== undefined ? status : students[index].status,
    };
    res.json({ success: true, student: students[index] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete student
app.delete("/api/students/:id", (req, res) => {
  try {
    const { id } = req.params;
    students = students.filter((s) => s.id !== id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk delete students
app.post("/api/students/bulk-delete", (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "Daftar ID siswa tidak valid" });
    }
    const idSet = new Set(ids);
    const beforeCount = students.length;
    students = students.filter((s) => !idSet.has(s.id));
    const deletedCount = beforeCount - students.length;
    res.json({ success: true, count: deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// RIWAYAT SOAL & DEPLOYMENT APIs
// ========================

// Get question history
app.get("/api/question-history", (req, res) => {
  res.json({ success: true, packages: savedPackages });
});

// Save question package to history
app.post("/api/question-history", (req, res) => {
  try {
    const {
      title,
      subject,
      grade,
      examType,
      topic,
      difficulty,
      questionType,
      questions,
    } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Daftar butir soal tidak boleh kosong" });
    }

    const newPackage: SavedQuestionPackage = {
      id: "pkg-" + Date.now(),
      title: title || `Paket Soal: ${subject || "Umum"} (${examType || "Penilaian"})`,
      subject: subject || "Umum",
      grade: grade || "Kelas X",
      examType: examType || "Penilaian Akhir Bab",
      topic: topic || "-",
      difficulty: difficulty || "Sedang",
      questionCount: questions.length,
      questionType: questionType || "pilihan_ganda",
      questions: questions.map((q: any, idx: number) => ({
        id: q.id || `q-${Date.now()}-${idx}`,
        number: idx + 1,
        question: q.question,
        questionType: q.questionType || questionType || "pilihan_ganda",
        imageUrl: q.imageUrl || undefined,
        options: q.options || { a: "", b: "", c: "", d: "" },
        correctAnswer: q.correctAnswer || "a",
        correctAnswers: q.correctAnswers || undefined,
        explanation: q.explanation || "",
        category: q.category || subject || "Umum",
      })),
      savedAt: new Date().toISOString(),
      isDeployed: false,
    };

    savedPackages.unshift(newPackage);
    res.json({ success: true, package: newPackage });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete package from history
app.delete("/api/question-history/:id", (req, res) => {
  try {
    const { id } = req.params;
    savedPackages = savedPackages.filter((p) => p.id !== id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Deploy questions from history directly into active exams
app.post("/api/question-history/deploy", (req, res) => {
  try {
    const { packageId, code, token, durationMinutes, title, examType } = req.body;
    const pkg = savedPackages.find((p) => p.id === packageId);
    if (!pkg) {
      return res.status(404).json({ error: "Paket soal tidak ditemukan dalam riwayat" });
    }

    // Generate smart exam code e.g. "PAN201", "IPS305", "JAW102"
    const prefix = (pkg.subject || "CBT")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 3)
      .toUpperCase();
    const generatedCode = code || `${prefix}${Math.floor(100 + Math.random() * 900)}`;
    const generatedToken = (token || `CBT${new Date().getFullYear()}`).trim().toUpperCase();

    const deployedExam: Exam = {
      id: "exam-" + Date.now(),
      code: generatedCode.trim().toUpperCase(),
      title: title || pkg.title,
      subject: pkg.subject,
      grade: pkg.grade,
      examType: examType || pkg.examType || "Penilaian Akhir Bab",
      token: generatedToken,
      durationMinutes: Number(durationMinutes) || (pkg.questionCount > 25 ? 60 : 30),
      questions: pkg.questions,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    exams.unshift(deployedExam);

    // Update package status in history
    pkg.isDeployed = true;
    pkg.deployedExamCode = deployedExam.code;

    res.json({ success: true, exam: deployedExam, package: pkg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create exam
app.post("/api/exams", (req, res) => {
  try {
    const newExam: Exam = req.body;
    if (!newExam.code || !newExam.token || !newExam.title) {
      return res.status(400).json({ error: "Kode soal, token, dan judul wajib diisi" });
    }
    newExam.id = "exam-" + Date.now();
    newExam.createdAt = new Date().toISOString();
    newExam.isActive = true;
    exams.unshift(newExam);
    res.json({ success: true, exam: newExam });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Real-time monitoring ping
app.post("/api/monitoring/ping", (req, res) => {
  try {
    const { studentName, examCode, progress, answeredCount, totalQuestions, status } = req.body;
    const key = `${studentName}_${examCode}`;
    const existing = monitoringList.get(key);

    const updated: MonitoringStudent = {
      studentName,
      examCode,
      progress: typeof progress === "number" ? Math.min(100, Math.max(0, Math.round(progress))) : 0,
      answeredCount: answeredCount || 0,
      totalQuestions: totalQuestions || 0,
      status: status || (existing?.status === "Terdiskualifikasi" ? "Terdiskualifikasi" : "Mengerjakan"),
      tabSwitches: existing ? existing.tabSwitches : 0,
      lastPing: new Date().toLocaleTimeString("id-ID"),
      violationsLog: existing ? existing.violationsLog : [],
    };

    monitoringList.set(key, updated);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Anti-Cheat: Record violation
app.post("/api/monitoring/violation", (req, res) => {
  try {
    const { studentName, examCode, violationType, detail } = req.body;
    const key = `${studentName}_${examCode}`;
    let student = monitoringList.get(key);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID");

    const violation = {
      id: "v-" + Date.now(),
      timestamp: timeStr,
      type: violationType || "Keluar Tab",
      detail: detail || "Terdeteksi beralih dari jendela/tab ujian CBT",
    };

    if (student) {
      student.tabSwitches += 1;
      student.status = "Terdeteksi Keluar Tab";
      student.lastPing = timeStr;
      student.violationsLog.unshift(violation);
    } else {
      student = {
        studentName,
        examCode,
        progress: 0,
        answeredCount: 0,
        totalQuestions: 0,
        status: "Terdeteksi Keluar Tab",
        tabSwitches: 1,
        lastPing: timeStr,
        violationsLog: [violation],
      };
      monitoringList.set(key, student);
    }

    res.json({ success: true, tabSwitches: student.tabSwitches, violation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin reset or clear monitoring
app.post("/api/monitoring/reset", (req, res) => {
  try {
    const { studentName, examCode } = req.body;
    const key = `${studentName}_${examCode}`;
    const student = monitoringList.get(key);
    if (student) {
      student.status = "Mengerjakan";
      res.json({ success: true, student });
    } else {
      res.status(404).json({ error: "Siswa tidak ditemukan dalam monitoring" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get active monitoring
app.get("/api/monitoring", (req, res) => {
  res.json({
    students: Array.from(monitoringList.values()),
    timestamp: new Date().toISOString(),
  });
});

// Submit Exam & Remedial Recommendation (Gemini AI)
app.post("/api/submit-exam", async (req, res) => {
  try {
    const {
      studentName,
      nisn,
      className,
      examCode,
      examTitle,
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      percentage,
      wrongAnswers,
      tabSwitches,
    } = req.body;

    let remedialReport = "";

    // Generate AI Remedial Analysis if there are wrong answers and API key exists
    if (wrongAnswers && wrongAnswers.length > 0 && apiKey) {
      try {
        const wrongListText = wrongAnswers
          .map(
            (w: any, idx: number) =>
              `${idx + 1}. Soal: "${w.question}" | Jawaban Siswa: "${w.studentAnswer}" | Jawaban Benar: "${w.correctAnswer}" | Konsep: "${w.explanation || ''}"`
          )
          .join("\n");

        const prompt = `Sebagai Guru & Pakar Evaluasi Pendidikan Indonesia, buatlah analisis remedial dan pengayaan yang mendalam, edukatif, dan menyemangati untuk siswa berikut:
Nama Siswa: ${studentName}
Mata Pelajaran / Ujian: ${examTitle} (${examCode})
Skor: ${score} / 100 (${correctCount} benar dari ${totalQuestions} soal)

Daftar Soal yang Salah Dijawab oleh Siswa:
${wrongListText}

Berikan respon terstruktur dengan format Markdown yang rapi dalam Bahasa Indonesia:
### 1. 🔍 Diagnosa Kelemahan Konsep
(Analisis letak miskonsepsi atau materi yang belum dikuasai)

### 2. 📖 Rangkuman Materi Kunci & Trik Pemahaman
(Jelaskan secara ringkas konsep esensial dan rumus/cara pengerjaan yang benar agar siswa mengerti mengapa jawaban aslinya keliru)

### 3. ✍️ 2 Contoh Soal Remedial Mandiri + Kunci & Pembahasan Singkat
(Buatkan 2 soal baru yang setara untuk latihan pemulihan mandiri)

### 4. 🌟 Pesan Motivasi Guru
(Kalimat apresiasi atas usaha siswa dan motivasi positif untuk terus belajar)`;

        const geminiRes = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
        });

        remedialReport = geminiRes.text || "Analisis remedial telah disiapkan.";
      } catch (aiErr: any) {
        console.error("Gemini Remedial error:", aiErr);
        remedialReport = `Catatan Guru: Siswa perlu mengulang konsep pada ${wrongAnswers.length} soal yang belum tepat, khususnya materi dasar dan ketelitian pengerjaan.`;
      }
    } else if (wrongAnswers && wrongAnswers.length === 0) {
      remedialReport = `🎉 Selamat ${studentName}! Nilai Anda sempurna (100). Pertahankan prestasi ini dan silakan pelajari materi pengayaan tingkat lanjut untuk memperluas wawasan!`;
    }

    const result: ExamResult = {
      id: "res-" + Date.now(),
      timestamp: new Date().toLocaleString("id-ID"),
      studentName,
      nisn: nisn || "-",
      className: className || "-",
      examCode,
      examTitle,
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      percentage: percentage || `${Math.round((correctCount / totalQuestions) * 100)}%`,
      wrongAnswers: wrongAnswers || [],
      remedialReport,
      tabSwitches: tabSwitches || 0,
    };

    examResults.unshift(result);

    // Update monitoring status to 'Selesai'
    const key = `${studentName}_${examCode}`;
    const mon = monitoringList.get(key);
    if (mon) {
      mon.status = "Selesai";
      mon.progress = 100;
      mon.answeredCount = totalQuestions;
    }

    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Exam Results
app.get("/api/results", (req, res) => {
  res.json({ results: examResults });
});

// Gemini AI: Generate Exam Questions
app.post("/api/gemini/generate-questions", async (req, res) => {
  try {
    const {
      topic,
      grade,
      subject = "Umum",
      count = 5,
      difficulty = "Sedang",
      questionType = "pilihan_ganda",
      examType = "Penilaian Akhir Bab",
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topik atau kisi-kisi soal wajib diisi" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan di environment" });
    }

    const safeCount = Math.min(50, Math.max(1, Number(count) || 5));

    let typeGuideline = "";
    if (questionType === "pilihan_ganda") {
      typeGuideline = `Seluruh soal harus berbentuk Pilihan Ganda dengan 4 pilihan (a, b, c, d) dan 1 jawaban benar mutlak. correctAnswer harus berupa salah satu dari 'a', 'b', 'c', atau 'd'.`;
    } else if (questionType === "pilihan_ganda_kompleks") {
      typeGuideline = `Seluruh soal berbentuk Pilihan Ganda Kompleks (Multi-Jawaban). Berikan 4 pilihan (a, b, c, d) di mana terdapat 2 atau lebih jawaban yang benar. Sertakan 'correctAnswers' berupa array huruf kecil (contoh: ["a", "c"]). 'correctAnswer' diisi huruf pertama jawaban benar.`;
    } else if (questionType === "benar_salah") {
      typeGuideline = `Seluruh soal berbentuk Benar / Salah. Teks pertanyaan menyajikan stimulus dan sebuah pernyataan logis. options a diisi "Benar" dan options b diisi "Salah" (options c dan d beri "-"). correctAnswer diisi "a" jika pernyataan Benar, atau "b" jika Salah.`;
    } else if (questionType === "isian_singkat") {
      typeGuideline = `Seluruh soal berbentuk Isian Singkat. Pertanyaan menguji istilah, rumus, nama konsep, atau angka penting. options beri teks alternatif pengecoh singkat, correctAnswer diisi kata kunci atau jawaban eksak singkat (1-3 kata).`;
    } else if (questionType === "uraian") {
      typeGuideline = `Seluruh soal berbentuk Soal Uraian / Essay Terbuka yang mendalam. options beri aspek penilaian (a: Aspek Pemahaman, b: Analisis, c: Solusi, d: Kesimpulan), correctAnswer diisi ringkasan jawaban inti, dan explanation diisi rubrik penilaian lengkap beserta poin-poin jawaban yang diharapkan.`;
    } else {
      typeGuideline = `Variasikan butir soal dengan proporsi: sebagian Pilihan Ganda (PG), sebagian Benar/Salah, dan sebagian Isian Singkat.`;
    }

    const prompt = `Anda adalah pakar pembuat instrumen asesmen dan kisi-kisi naskah ujian standar Kurikulum Merdeka Indonesia dan Taksonomi Bloom & Anderson.
Tugas Anda adalah merumuskan butir naskah soal berkualitas tinggi, teruji, dan valid untuk:
- Jenis Ujian: ${examType}
- Mata Pelajaran: ${subject}
- Jenjang / Tingkat Kelas: ${grade || "Semua Jenjang (SD, SMP, atau SMA/SMK)"}
- Topik / Instruksi Pembagian Bentuk Soal: ${topic}
- Tingkat Kesulitan: ${difficulty}
- Pilihan Bentuk Soal Awal: ${questionType}
- Target Total Butir: ${safeCount} soal

PANDUAN MULTI BENTUK SOAL:
1. Analisis teks Topik/Instruksi pengguna. Jika pengguna menentukan jumlah per bentuk soal secara spesifik (misalnya: "10 soal pilihan ganda, 10 isian pendek, dan 5 soal uraian" atau proporsi sejenis), PRIORITASKAN DAN PATUHI PERSIS pembagian bentuk soal dan jumlah butir tersebut!
2. Jika bentuk soal dipilih "campuran" dan tidak ada instruksi khusus di topik, buatlah komposisi proporsional: 60% pilihan_ganda, 20% isian_singkat, dan 20% uraian.
3. Jenis bentuk soal yang valid untuk field 'questionType': 'pilihan_ganda', 'isian_singkat', 'uraian', 'pilihan_ganda_kompleks', atau 'benar_salah'.

PANDUAN TAKSONOMI BLOOM & ANDERSON (C1 - C6):
- Setiap butir soal WAJIB ditentukan level kognitifnya:
  * C1 (Mengingat/Remembering): menyebutkan, mengidentifikasi fakta/istilah.
  * C2 (Memahami/Understanding): menjelaskan konsep, membedakan, merangkum.
  * C3 (Menerapkan/Applying): menghitung, menerapkan rumus/aturan pada kasus baru.
  * C4 (Menganalisis/Analyzing): menelaah data, grafik, memecah masalah, sebab-akibat.
  * C5 (Mengevaluasi/Evaluating): menilai argumen, mengkritisi, memutuskan solusi terbaik.
  * C6 (Mencipta/Creating): merancang solusi, merumuskan hipotesis, menyusun ide baru.
- Berikan deskripsi level kognitif yang jelas pada field 'cognitiveDescription'.
- Tuliskan indikator pencapaian kompetensi pada field 'competencyIndicator' untuk tabel kisi-kisi resmi.

PANDUAN PENSKORAN & KATA KUNCI (KEYWORDS AI SCORING):
- Untuk soal 'isian_singkat' dan 'uraian', WAJIB sertakan 2 sampai 6 kata kunci penting (field 'keywords') yang wajib ada dalam jawaban siswa agar sistem CBT dapat melakukan penskoran otomatis berbasis kecocokan kata kunci!
- Berikan bobot skor (field 'scoreWeight'): standar pilihan ganda = 1, isian singkat = 2, uraian = 4 atau 5.
- Berikan panduan rubrik penskoran pada field 'rubricGuide' untuk soal uraian/esai.

Ketentuan Format Output:
- Kembalikan HANYA JSON array sesuai responseSchema yang ditentukan tanpa teks pengantar atau markdown block.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: "Teks pertanyaan lengkap beserta stimulus narasi/kasus jika ada",
              },
              questionType: {
                type: Type.STRING,
                description: "Jenis bentuk soal: pilihan_ganda, isian_singkat, uraian, pilihan_ganda_kompleks, atau benar_salah",
              },
              cognitiveLevel: {
                type: Type.STRING,
                description: "Tingkat kognitif Taksonomi Bloom & Anderson: C1, C2, C3, C4, C5, atau C6",
              },
              cognitiveDescription: {
                type: Type.STRING,
                description: "Deskripsi operasional level kognitif untuk dokumen kisi-kisi, contoh: C4 - Menganalisis hubungan sebab-akibat",
              },
              competencyIndicator: {
                type: Type.STRING,
                description: "Indikator soal resmi, contoh: Disajikan stimulus kasus, siswa mampu menentukan solusi pemecahan masalah",
              },
              scoreWeight: {
                type: Type.NUMBER,
                description: "Bobot skor maksimal butir soal (misal PG: 1, Isian: 2, Uraian: 4)",
              },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Daftar kata kunci esensial untuk penskoran otomatis AI pada soal isian dan uraian",
              },
              rubricGuide: {
                type: Type.STRING,
                description: "Pedoman dan rubrik penskoran untuk dokumen kisi-kisi",
              },
              options: {
                type: Type.OBJECT,
                properties: {
                  a: { type: Type.STRING, description: "Opsi A" },
                  b: { type: Type.STRING, description: "Opsi B" },
                  c: { type: Type.STRING, description: "Opsi C" },
                  d: { type: Type.STRING, description: "Opsi D" },
                },
                required: ["a", "b", "c", "d"],
              },
              correctAnswer: {
                type: Type.STRING,
                description: "Kunci jawaban utama (a/b/c/d untuk PG/BS atau teks jawaban inti untuk isian/uraian)",
              },
              correctAnswers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array jawaban benar jika bentuk pilihan ganda kompleks, contoh: ['a', 'c']",
              },
              explanation: {
                type: Type.STRING,
                description: "Pembahasan konsep edukatif lengkap",
              },
              category: {
                type: Type.STRING,
                description: "Materi pokok / subtopik",
              },
            },
            required: ["question", "questionType", "options", "correctAnswer", "explanation", "cognitiveLevel"],
          },
        },
      },
    });

    const rawText = response.text || "[]";
    let questionsRaw: any[] = [];
    try {
      questionsRaw = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        questionsRaw = JSON.parse(match[0]);
      }
    }

    // Determine matching preset image for subject if appropriate
    const matchingPreset = EDUCATIONAL_IMAGE_PRESETS.find(
      (p) =>
        p.category.toLowerCase().includes(subject.toLowerCase()) ||
        subject.toLowerCase().includes(p.category.toLowerCase())
    );

    const formattedQuestions: Question[] = questionsRaw.map((q, idx) => {
      // Suggest image for the first question if subject matches
      const hasImage = matchingPreset && idx === 0;
      const qType = (q.questionType as QuestionType) || (questionType !== "campuran" ? (questionType as QuestionType) : "pilihan_ganda");
      
      // Default score weight if not generated
      let defaultWeight = 1;
      if (qType === "uraian") defaultWeight = 4;
      else if (qType === "isian_singkat") defaultWeight = 2;

      const cLevel = q.cognitiveLevel ? q.cognitiveLevel.toUpperCase() : "C3";

      return {
        id: "q-gen-" + Date.now() + "-" + idx,
        number: idx + 1,
        question: q.question,
        questionType: qType,
        imageUrl: hasImage ? matchingPreset.url : undefined,
        cognitiveLevel: cLevel,
        cognitiveDescription: q.cognitiveDescription || `Level ${cLevel}`,
        competencyIndicator: q.competencyIndicator || `Disajikan materi ${q.category || topic}, siswa mampu menyelesaikan soal terkait.`,
        scoreWeight: q.scoreWeight && q.scoreWeight > 0 ? q.scoreWeight : defaultWeight,
        keywords: Array.isArray(q.keywords) && q.keywords.length > 0 
          ? q.keywords 
          : (qType === "isian_singkat" ? [q.correctAnswer || ""] : undefined),
        rubricGuide: q.rubricGuide || undefined,
        options: {
          a: q.options?.a || "",
          b: q.options?.b || "",
          c: q.options?.c || "",
          d: q.options?.d || "",
        },
        correctAnswer: (q.correctAnswer || "a").toString().trim(),
        correctAnswers: Array.isArray(q.correctAnswers) ? q.correctAnswers.map((x: string) => x.toLowerCase()) : undefined,
        explanation: q.explanation || "",
        category: q.category || topic,
      };
    });

    res.json({ success: true, count: formattedQuestions.length, questions: formattedQuestions });
  } catch (err: any) {
    console.error("Gemini Question Generator error:", err);
    res.status(500).json({ error: err.message || "Gagal membuat soal dengan AI" });
  }
});

// Vite middleware for development & static fallback for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CBT Web App Sekolah running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
