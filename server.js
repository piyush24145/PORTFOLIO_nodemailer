require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fetch = require("node-fetch");

const app = express();

// ==================== CORS ====================
const allowedOrigins = [
  process.env.FRONTEND_URL, // frontend deployed URL
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman or server requests
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
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5, // max 5 requests per window per IP
  message: { success: false, msg: "Too many requests. Try again later." },
});

app.use("/send-email", limiter);

// ==================== CONTACT ROUTE ====================
app.post("/send-email", async (req, res) => {
  const { name, email, message, token } = req.body;

  if (!name || !email || !message || !token) {
    return res.status(400).json({ success: false, msg: "All fields required" });
  }

  try {
    // ===== reCAPTCHA VERIFY =====
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${token}`;
    const captchaRes = await fetch(verifyUrl, { method: "POST" });
    const captchaData = await captchaRes.json();

    if (!captchaData.success) {
      return res.status(400).json({ success: false, msg: "reCAPTCHA failed" });
    }

    // ===== Nodemailer =====
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
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
