// PARA Memo Server v1.1
const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function classify(content) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `메모를 PARA 방법론에 따라 분류해. 반드시 아래 중 하나만 답해:
- todo: 해야 할 일, 약속, 일정, 행동이 필요한 것
- reference: 생각, 아이디어, 명언, 참고 자료, 정보, 메모

한 단어만 답해.`
        },
        { role: "user", content }
      ],
      max_tokens: 10
    });
    const answer = res.choices[0].message.content.trim().toLowerCase();
    return answer.includes("reference") ? "reference" : "todo";
  } catch (e) {
    console.error("AI 분류 실패:", e.message);
    return "todo";
  }
}

// DB 생성 + 테이블 만들기
const dbPath = process.env.DB_PATH || path.join(__dirname, "memo.db");
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'todo',
    done INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);
// 기존 테이블에 done 컬럼 없으면 추가
try { db.exec("ALTER TABLE memos ADD COLUMN done INTEGER DEFAULT 0"); } catch(e) {}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

function renderMemo(m, showCheck) {
  const checked = m.done ? "checked" : "";
  const style = m.done ? "text-decoration:line-through; color:#aaa;" : "";
  return `
    <div style="display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid #eee;">
      ${showCheck ? `<input type="checkbox" ${checked} onchange="toggle(${m.id}, this.checked)" style="margin-top:4px; width:18px; height:18px; cursor:pointer;">` : ""}
      <div style="flex:1;">
        <div style="${style}">${m.content}</div>
        <div style="font-size:12px; color:#aaa; margin-top:4px;">${m.created_at}</div>
      </div>
    </div>`;
}

// 메인 페이지
app.get("/", (req, res) => {
  const todos = db.prepare("SELECT * FROM memos WHERE category='todo' AND done=0 ORDER BY created_at DESC").all();
  const refs = db.prepare("SELECT * FROM memos WHERE category='reference' AND done=0 ORDER BY created_at DESC").all();
  const dones = db.prepare("SELECT * FROM memos WHERE done=1 ORDER BY created_at DESC LIMIT 20").all();

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="apple-mobile-web-app-capable" content="yes">
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
      <meta name="theme-color" content="#333333">
      <link rel="manifest" href="/manifest.json">
      <link rel="apple-touch-icon" href="/icon.svg">
      <title>PARA 메모</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; color: #333; }
        h1 { font-size: 24px; margin-bottom: 20px; }
        h2 { font-size: 16px; color: #666; margin: 24px 0 8px; }
        textarea { width: 100%; height: 60px; padding: 10px; font-size: 16px; border: 2px solid #ddd; border-radius: 8px; resize: vertical; box-sizing: border-box; }
        button { margin-top: 8px; padding: 10px 24px; font-size: 16px; background: #333; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
        button:hover { background: #555; }
        .section { margin-bottom: 16px; }
        .toggle-done { background: none; border: none; color: #aaa; cursor: pointer; font-size: 14px; padding: 0; margin: 0; }
        .empty { color: #ccc; font-size: 14px; padding: 8px 0; }
      </style>
    </head>
    <body>
      <h1>PARA 메모</h1>
      <form method="POST" action="/memo">
        <textarea name="content" placeholder="메모를 입력하세요..." required></textarea>
        <button type="submit">저장</button>
      </form>

      <div class="section">
        <h2>📌 해야 할 것 (${todos.length})</h2>
        ${todos.length ? todos.map(m => renderMemo(m, true)).join("") : '<div class="empty">없음</div>'}
      </div>

      <div class="section">
        <h2>
          <span class="toggle-done" onclick="document.getElementById('refList').style.display = document.getElementById('refList').style.display === 'none' ? 'block' : 'none'">
            💡 참고 / 아이디어 (${refs.length}) ▾
          </span>
        </h2>
        <div id="refList" style="display:none;">
          ${refs.length ? refs.map(m => renderMemo(m, false)).join("") : '<div class="empty">없음</div>'}
        </div>
      </div>

      <div class="section">
        <h2>
          <span class="toggle-done" onclick="document.getElementById('doneList').style.display = document.getElementById('doneList').style.display === 'none' ? 'block' : 'none'">
            ✅ 완료 (${dones.length}) ▾
          </span>
        </h2>
        <div id="doneList" style="display:none;">
          ${dones.length ? dones.map(m => renderMemo(m, true)).join("") : '<div class="empty">없음</div>'}
        </div>
      </div>

      <script>
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.register("/sw.js");
        }

        document.querySelector("textarea").addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.target.form.submit();
          }
        });

        function toggle(id, done) {
          fetch("/memo/" + id + "/toggle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done: done ? 1 : 0 })
          }).then(() => location.reload());
        }
      </script>
    </body>
    </html>
  `);
});

// 메모 저장 (AI 분류)
app.post("/memo", async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).send("내용을 입력하세요");
  const category = await classify(content);
  db.prepare("INSERT INTO memos (content, category) VALUES (?, ?)").run(content, category);
  res.redirect("/");
});

// 체크박스 토글
app.post("/memo/:id/toggle", (req, res) => {
  const { done } = req.body;
  db.prepare("UPDATE memos SET done = ? WHERE id = ?").run(done, req.params.id);
  res.json({ ok: true });
});

// API - 메모 목록
app.get("/api/memos", (req, res) => {
  const memos = db.prepare("SELECT * FROM memos ORDER BY created_at DESC").all();
  res.json(memos);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`메모 서버 실행 중: http://localhost:${PORT}`);
});
