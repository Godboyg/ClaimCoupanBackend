// server.js (Backend - Node.js + Express)
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors());

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/coupons", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(()=>{
    console.log("db connected");
});

const Coupon = mongoose.model("Coupon", new mongoose.Schema({
  code: String,
  claimed: { type: Boolean, default: false },
}));

const Claim = mongoose.model("Claim", new mongoose.Schema({
  couponID: mongoose.Schema.Types.ObjectId,
  ipAddress: String,
  claimedAt: { type: Date, default: Date.now },
}));

// Helper function to check claim eligibility
async function canClaim(ip) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentClaim = await Claim.findOne({ ipAddress: ip, claimedAt: { $gte: oneHourAgo } });
  return !recentClaim;
} 

// API to claim a coupon
app.get("/api/coupons/claim", async (req, res) => {
  const userIP = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  if (!(await canClaim(userIP))) {
    return res.status(403).json({ message: "You have already claimed a coupon. Try again later." });
  }
  const coupon = await Coupon.findOne({ claimed: false });
  if (!coupon) return res.status(404).json({ message: "No coupons available." });
  
  coupon.claimed = true;
  await coupon.save();
  await Claim.create({ couponID: coupon._id, ipAddress: userIP });

  res.cookie("coupon_claimed", "true", { maxAge: 60 * 60 * 1000, httpOnly: true });
  res.json({ message: "Coupon claimed successfully!", code: coupon.code });
});

// API to check claim status
app.get("/api/coupons/status", async (req, res) => {
  const userIP = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentClaim = await Claim.findOne({ ipAddress: userIP, claimedAt: { $gte: oneHourAgo } });
  
  if (recentClaim) {
    const remainingTime = Math.ceil((recentClaim.claimedAt.getTime() + 60 * 60 * 1000 - Date.now()) / 1000);
    return res.json({ canClaim: false, remainingTime });
  }
  res.json({ canClaim: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));