// models/DailyChallenge.js
const mongoose = require('mongoose');

const dailyChallengeSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: false },
  usersParticipated: [{ type: Number }],
  responses: [{
    user: { type: Number },
    userAnswer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true }
  }]
});

module.exports = mongoose.model('DailyChallenge', dailyChallengeSchema);
