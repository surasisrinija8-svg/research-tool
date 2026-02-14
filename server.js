const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const cors = require("cors");
require("dotenv").config();

const Groq = require("groq-sdk");

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Home route
app.get("/", (req, res) => {
  res.send("Research Tool Backend Running 🚀");
});

// Upload page (Styled)
app.get("/test", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>AI Research Tool</title>
      <style>
        body { font-family: Arial; background: #f4f6f9; padding: 40px; }
        .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 600px; margin: auto; }
        h2 { margin-bottom: 20px; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
        button:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Upload Earnings Call Transcript (PDF)</h2>
        <form action="/upload" method="POST" enctype="multipart/form-data">
          <input type="file" name="file" required /><br><br>
          <button type="submit">Run AI Analysis</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Upload + AI Analysis
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded ❌");
    }

    const data = await pdfParse(req.file.buffer);
    const text = data.text;

    const prompt = `
Return STRICT JSON ONLY in this format:

{
  "management_tone": "",
  "confidence_level": "",
  "key_positives": [],
  "key_concerns": [],
  "forward_guidance": "",
  "capacity_utilization_trends": "",
  "growth_initiatives": []
}

Rules:
- Do NOT add markdown
- Do NOT add explanations
- If not mentioned, write "Not Mentioned"
- Only use transcript content

Transcript:
${text.slice(0, 12000)}
`;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are a structured financial analyst." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
    });

    const raw = response.choices[0].message.content;

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch (err) {
      console.error("Invalid JSON from AI:", raw);
      return res.status(500).send("AI returned invalid structured output ❌");
    }

    res.send(`
      <html>
      <head>
        <title>AI Analysis Result</title>
        <style>
          body { font-family: Arial; background: #f4f6f9; padding: 40px; }
          .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-width: 900px; margin: auto; }
          h3 { margin-top: 20px; }
          ul { padding-left: 20px; }
          a { display: inline-block; margin-top: 20px; color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>AI Analysis Complete ✅</h2>

          <h3>Management Tone</h3>
          <p>${analysis.management_tone}</p>

          <h3>Confidence Level</h3>
          <p>${analysis.confidence_level}</p>

          <h3>Key Positives</h3>
          <ul>${analysis.key_positives.map(p => `<li>${p}</li>`).join("")}</ul>

          <h3>Key Concerns</h3>
          <ul>${analysis.key_concerns.map(c => `<li>${c}</li>`).join("")}</ul>

          <h3>Forward Guidance</h3>
          <p>${analysis.forward_guidance}</p>

          <h3>Capacity Utilization Trends</h3>
          <p>${analysis.capacity_utilization_trends}</p>

          <h3>Growth Initiatives</h3>
          <ul>${analysis.growth_initiatives.map(g => `<li>${g}</li>`).join("")}</ul>

          <a href="/test">Analyze Another File</a>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("Groq Error:", error);
    res.status(500).send("Processing failed ❌");
  }
});

// Start server
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
