const mongoose = require("mongoose");

const coverLetterSchema = new mongoose.Schema({
  header: {
    applicantName: { type: String, required: true },
    date: { type: String, required: true },
    companyName: { type: String, required: true },
    companyAddress: { type: String, required: true },
  },
  salutation: { type: String, required: true },
  introduction: { type: String, required: true },
  body: { type: [String], required: true },
  closing: {
    callToAction: { type: String, required: true },
    signature: { type: String, required: true },
  },
});

module.exports = coverLetterSchema;