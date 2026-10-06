const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const activeJobs = db.prepare("SELECT count(*) as count FROM jobs WHERE status = 'In Progress'").get().count;
    const readyJobs = db.prepare("SELECT count(*) as count FROM jobs WHERE status = 'Ready for Delivery'").get().count;
    const deliveredJobs = db.prepare("SELECT count(*) as count FROM jobs WHERE status = 'Delivered'").get().count;
    const totalJobs = db.prepare("SELECT count(*) as count FROM jobs").get().count;

    const pendingInquiries = db.prepare("SELECT count(*) as count FROM inquiries WHERE status = 'New'").get().count;
    const totalInquiries = db.prepare("SELECT count(*) as count FROM inquiries").get().count;

    const financialStats = db.prepare(`
      SELECT
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(advance_paid), 0) as collected_payments,
        COALESCE(SUM(balance_due), 0) as pending_balance
      FROM jobs
    `).get();

    const lowStockCount = db.prepare("SELECT count(*) as count FROM inventory WHERE quantity <= min_threshold").get().count;

    // Pipeline stage breakdown
    const stageBreakdown = db.prepare(`
      SELECT current_stage, count(*) as count
      FROM jobs
      WHERE status IN ('In Progress', 'Ready for Delivery')
      GROUP BY current_stage
    `).all();

    // Recent 5 jobs
    const recentJobs = db.prepare('SELECT id, tracking_code, customer_name, bike_model, current_stage, stage_progress, status FROM jobs ORDER BY id DESC LIMIT 5').all();

    // Recent 5 inquiries
    const recentInquiries = db.prepare('SELECT id, tracking_code, customer_name, customer_phone, bike_model, service_type, status, created_at FROM inquiries ORDER BY id DESC LIMIT 5').all();

    res.json({
      success: true,
      metrics: {
        activeJobs,
        readyJobs,
        deliveredJobs,
        totalJobs,
        pendingInquiries,
        totalInquiries,
        totalRevenue: financialStats.total_revenue,
        collectedPayments: financialStats.collected_payments,
        pendingBalance: financialStats.pending_balance,
        lowStockCount
      },
      stageBreakdown,
      recentJobs,
      recentInquiries
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
