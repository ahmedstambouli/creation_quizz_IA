const mongoos = require("mongoose")
const Schema = mongoos.Schema;

const QuizSchema = mongoos.Schema({
  userId: {type: Schema.Types.ObjectId,ref: 'Utilisateur',required: true, },
 question: { type: String, required: false },
  answer: { type: String, required: false },
  date: { type: Date, default: Date.now }
});
const Quiz = mongoos.model('Quiz', QuizSchema);

module.exports = Quiz;