require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fetch = require("node-fetch");

const app = express();

// ==================== CORS ====================
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "https://portfolio.com",
  "https://www.yourdomain.com",
  "https://portfolio-cs85.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman, curl etc.
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

app.use(express.json());

// ==================== RATE LIMITER ====================
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // pehle 5 tha, ab 20 requests allowed
  message: { success: false, msg: "Too many requests. Try again later." },
});

app.use("/send-email", limiter);


// ==================== CONTACT ROUTE (reCAPTCHA v3) ====================
app.post("/send-email", async (req, res) => {
  const { name, email, message, token } = req.body;

  if (!name || !email || !message || !token) {
    return res.status(400).json({ success: false, msg: "All fields required" });
  }

  try {
    // ===== reCAPTCHA v3 VERIFY =====
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${token}`;
    const captchaRes = await fetch(verifyUrl, { method: "POST" });
    const captchaData = await captchaRes.json();

    // Check success + score
    if (!captchaData.success || captchaData.score < 0.5) {
      return res.status(400).json({
        success: false,
        msg: "reCAPTCHA verification failed. Are you a robot?",
      });
    }

    // Optional: check action
    if (captchaData.action !== "contact_form") {
      return res.status(400).json({
        success: false,
        msg: "reCAPTCHA action mismatch",
      });
    }

    // ===== NODEMAILER =====
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // App Password recommended
      },
    });

    await transporter.sendMail({
      from: email,
      to: process.env.EMAIL_USER,
      subject: `Portfolio Contact from ${name}`,
      text: message,
    });

    res.json({ success: true, msg: "Email sent successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

