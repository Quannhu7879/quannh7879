import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "https://kmpkquvopkrfirsqzoiz.supabase.co";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttcGtxdXZvcGtyZmlyc3F6b2l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU1MzE4MSwiZXhwIjoyMTAwMTI5MTgxfQ.W-_Cs63OW2c9g6nXKiVGQJH8XjYUOrG84RcCyoIjfvU";

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    persistSession: false,
  }
});

// The SQL needed to initialize the table
const SETUP_SQL = `CREATE TABLE IF NOT EXISTS lucky_wheel_sessions (
  id TEXT PRIMARY KEY,
  names TEXT[] NOT NULL DEFAULT '{}',
  question_bank TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  remove_after_win BOOLEAN NOT NULL DEFAULT TRUE,
  student_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  history_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`;

// Initialize Gemini client lazily to prevent crash if key is missing
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- Supabase Proxy APIs ---

// Helper to determine if Postgres error corresponds to missing table
function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const code = err.code || "";
  const msg = err.message || "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (msg.toLowerCase().includes("relation") && msg.toLowerCase().includes("does not exist")) ||
    msg.toLowerCase().includes("could not find the table") ||
    msg.toLowerCase().includes("schema cache")
  );
}

// List all classes/sessions
app.get("/api/sessions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("lucky_wheel_sessions")
      .select("id, topic, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(200).json({
          error_type: "TABLE_MISSING",
          sql: SETUP_SQL,
          message: "Bảng database 'lucky_wheel_sessions' chưa được khởi tạo."
        });
      }
      throw error;
    }

    res.json({ success: true, sessions: data || [] });
  } catch (error: any) {
    console.error("Lỗi khi lấy danh sách lớp học:", error);
    res.status(500).json({ error: "Không thể lấy danh sách lớp học từ database.", details: error.message });
  }
});

// Get a single session's detail
app.get("/api/sessions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("lucky_wheel_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(200).json({
          error_type: "TABLE_MISSING",
          sql: SETUP_SQL,
          message: "Bảng database 'lucky_wheel_sessions' chưa được khởi tạo."
        });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Không tìm thấy lớp học này." });
    }

    res.json({ success: true, session: data });
  } catch (error: any) {
    console.error("Lỗi khi lấy thông tin lớp học:", error);
    res.status(500).json({ error: "Không thể lấy dữ liệu lớp học.", details: error.message });
  }
});

// Upsert (Save or Update) a session
app.post("/api/sessions/:id", async (req, res) => {
  const { id } = req.params;
  const { names, question_bank, topic, remove_after_win, student_scores, history_data } = req.body;

  try {
    const { data, error } = await supabase
      .from("lucky_wheel_sessions")
      .upsert({
        id,
        names: names || [],
        question_bank: question_bank || "",
        topic: topic || "",
        remove_after_win: remove_after_win !== false,
        student_scores: student_scores || {},
        history_data: history_data || [],
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(200).json({
          error_type: "TABLE_MISSING",
          sql: SETUP_SQL,
          message: "Bảng database 'lucky_wheel_sessions' chưa được khởi tạo."
        });
      }
      throw error;
    }

    res.json({ success: true, session: data?.[0] });
  } catch (error: any) {
    console.error("Lỗi khi lưu lớp học:", error);
    res.status(500).json({ error: "Không thể lưu dữ liệu lớp học.", details: error.message });
  }
});

// Delete a session
app.delete("/api/sessions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from("lucky_wheel_sessions")
      .delete()
      .eq("id", id);

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(200).json({
          error_type: "TABLE_MISSING",
          sql: SETUP_SQL,
          message: "Bảng database 'lucky_wheel_sessions' chưa được khởi tạo."
        });
      }
      throw error;
    }

    res.json({ success: true, message: `Đã xóa thành công lớp học "${id}".` });
  } catch (error: any) {
    console.error("Lỗi khi xóa lớp học:", error);
    res.status(500).json({ error: "Không thể xóa lớp học này.", details: error.message });
  }
});

// 2. API: Generate Questions from Topic using Gemini API with JSON Schema
app.post("/api/generate-questions", async (req, res) => {
  const { topic } = req.body;

  if (!topic || typeof topic !== "string" || topic.trim() === "") {
    return res.status(400).json({ error: "Vui lòng cung cấp chủ đề câu hỏi hợp lệ." });
  }

  try {
    const ai = getAIClient();
    const prompt = `Hãy tạo ra 10 câu hỏi trắc nghiệm hoặc câu hỏi ngắn gọn kèm đáp án phù hợp dành cho học sinh về chủ đề: "${topic}".`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Bạn là một giáo viên ra đề thi chuyên nghiệp và nhiều kinh nghiệm. Bạn luôn thiết kế câu hỏi ngắn gọn, rõ ràng, dễ hiểu và phù hợp với học sinh. Hãy trả về kết quả dưới dạng mảng JSON gồm các đối tượng có trường 'question' (nội dung câu hỏi) và 'answer' (nội dung đáp án tương ứng).",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: "Nội dung câu hỏi chi tiết, ngắn gọn, súc tích và có tính giáo dục.",
              },
              answer: {
                type: Type.STRING,
                description: "Nội dung đáp án chính xác, ngắn gọn, trực diện.",
              },
            },
            required: ["question", "answer"],
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Gemini returned empty response text");
    }

    const questions = JSON.parse(jsonText.trim());
    res.json({ success: true, questions });
  } catch (error: any) {
    console.error("Lỗi khi tạo câu hỏi bằng AI:", error);
    res.status(500).json({
      error: "Không thể tạo câu hỏi tự động bằng AI tại thời điểm này.",
      details: error?.message || error,
    });
  }
});

// Start server helper
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // In development, integrate Vite into Express
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built dist directory static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
