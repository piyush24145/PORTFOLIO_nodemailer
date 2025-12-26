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
  "https://portfolio-cs85.vercel.app", // frontend deployed
  "https://www.yourdomain.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman / curl
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
  max: 20, // testing friendly
  message: { success: false, msg: "Too many requests. Try again later." },
});

app.use("/send-email", limiter);

// ==================== CONTACT ROUTE (reCAPTCHA v3 + Nodemailer) ====================
app.post("/send-email", async (req, res) => {
  const { name, email, message, token } = req.body;

  if (!name || !email || !message || !token) {
    return res.status(400).json({ success: false, msg: "All fields required" });
  }

  try {
    // ================= reCAPTCHA VERIFY =================
    const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";

    const captchaRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.RECAPTCHA_SECRET}&response=${token}`,
    });

    const captchaData = await captchaRes.json();
    console.log("🟡 CAPTCHA:", captchaData);

    if (!captchaData.success || captchaData.score < 0.5) {
      return res.status(400).json({
        success: false,
        msg: "reCAPTCHA failed",
      });
    }

    // ================= NODEMAILER =================
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 🔥 VERY IMPORTANT VERIFY
    transporter.verify((error, success) => {
      if (error) {
        console.log("❌ EMAIL VERIFY ERROR:", error);
      } else {
        console.log("✅ EMAIL SERVER READY");
      }
    });

    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,      // tumhara inbox
      replyTo: email,                  // visitor ka email
      subject: `Portfolio Contact from ${name}`,
      html: `
        <h3>New Portfolio Message</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b><br/>${message}</p>
      `,
    });

    console.log("📩 EMAIL SENT SUCCESSFULLY");

    res.json({ success: true, msg: "Email sent successfully!" });
  } catch (err) {
    console.error("❌ EMAIL ERROR:", err);
    res.status(500).json({ success: false, msg: "Email failed" });
  }
});


// ==================== SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


