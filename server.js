const express = require("express");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const cors = require("cors");

app.use(express.json());

const qrCodesDir = path.join(__dirname, "qrcodes");
const scanCountsFile = path.join(__dirname, "scanCounts.json");

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// OR configure specific origins

// Ensure directories exist
if (!fs.existsSync(qrCodesDir)) fs.mkdirSync(qrCodesDir);

// Load existing scan counts from file (if available)
let scanCounts = {};
if (fs.existsSync(scanCountsFile)) {
  scanCounts = JSON.parse(fs.readFileSync(scanCountsFile, "utf-8"));
}

/**
 * Save scanCounts to file
 */
const saveScanCounts = () => {
  fs.writeFileSync(scanCountsFile, JSON.stringify(scanCounts, null, 2));
};

/**
 * Helper function to sanitize filenames
 */
const sanitizeFilename = (phoneNumber) => {
  return phoneNumber.replace(/[^a-zA-Z0-9]/g, "");
};

/**
 * Generate QR Code API
 */
const SERVER_URL = "https://qrcodegen-1-3su1.onrender.com";

app.post("/generate-qr", async (req, res) => {
  const { phoneNumbers } = req.body;

  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return res
      .status(400)
      .json({ error: "Please provide an array of phone numbers." });
  }

  try {
    const qrImages = [];

    for (const number of phoneNumbers) {
      const sanitizedNumber = sanitizeFilename(number);
      if (!scanCounts[sanitizedNumber]) {
        scanCounts[sanitizedNumber] = 0; // Initialize scan count
      }

      // Generate QR Code with a scan URL
      const scanUrl = `${SERVER_URL}/scan-qr?code=${sanitizedNumber}`;

      // Generate QR code as a data URL (base64 PNG)
      const qrImage = await QRCode.toDataURL(scanUrl);

      qrImages.push({ phone: number, qrCode: qrImage, scanUrl });
    }

    saveScanCounts(); // Save the updated scan counts
    res.json({ message: "QR codes generated successfully!", images: qrImages });
  } catch (error) {
    console.error("Error generating QR codes:", error);
    res.status(500).json({ error: "Failed to generate QR codes." });
  }
});

/**
 * Scan QR Code API
 */
app.get("/scan-qr", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: "Invalid QR Code." });
  }

  try {
    // Call API to check scan count
    const response = await fetch(`${SERVER_URL}/check-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error("Error scanning QR code:", error);
    res.status(500).json({ error: "Failed to scan QR code." });
  }
});

/**
 * Check Scan Count API
 */
app.post("/check-scan", (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Invalid request." });
  }

  scanCounts[code] = scanCounts[code] || 0; // Ensure scan count exists

  let message;
  if (scanCounts[code] === 0) {
    message = `✅ Offer redeemed successfully for ${code}`;
  } else {
    message = `❌ Offer already redeemed.`;
  }

  scanCounts[code] += 1;
  saveScanCounts(); // Save the updated scan count

  res.json({ message, scanCount: scanCounts[code] });
});

app.listen(PORT, () => console.log(`🚀 Server running on ${SERVER_URL}`));
