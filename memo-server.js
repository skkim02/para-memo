const express = require("express");
const Database = require("better-sqlite3");

// DB 생성 + 테이블 만들기
const path = require("path");
const dbPath = process.env.DB_PATH || path.join(__dirname, "memo.db");
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    category TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 메인 페이지 - 메모 입력 + 목록
app.get("/", (req, res) => {
  const memos = db.prepare("SELECT * FROM memos ORDER BY created_at DESC").all();

  const memoList = memos.length
    ? memos.map(m => `
        <div style="border:1px solid #ddd; padding:12px; margin:8px 0; border-radius:8px;">
          <div style="font-size:14px; color:#888;">${m.created_at} ${m.category ? `| <b>${m.category}</b>` : ""}</div>
          <div style="margin-top:6px;">${m.content}</div>
        </div>`).join("")
    : "<p style='color:#999;'>메모가 없습니다. 첫 메모를 작성해보세요!</p>";

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>PARA 메모</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
        h1 { font-size: 24px; }
        textarea { width: 100%; height: 80px; padding: 10px; font-size: 16px; border: 2px solid #ddd; border-radius: 8px; resize: vertical; box-sizing: border-box; }
        button { margin-top: 8px; padding: 10px 24px; font-size: 16px; background: #333; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
        button:hover { background: #555; }
      </style>
    </head>
    <body>
      <h1>PARA 메모</h1>
      <form method="POST" action="/memo">
        <textarea name="content" placeholder="메모를 입력하세요..." required></textarea>
        <button type="submit">저장</button>
      </form>
      <hr style="margin: 24px 0;">
      <h2>메모 목록</h2>
      ${memoList}
    </body>
    </html>
  `);
});

// 메모 저장 API
app.post("/memo", (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).send("내용을 입력하세요");

  db.prepare("INSERT INTO memos (content) VALUES (?)").run(content);
  res.redirect("/");
});

// API - 메모 목록 (JSON)
app.get("/api/memos", (req, res) => {
  const memos = db.prepare("SELECT * FROM memos ORDER BY created_at DESC").all();
  res.json(memos);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`메모 서버 실행 중: http://localhost:${PORT}`);
});
