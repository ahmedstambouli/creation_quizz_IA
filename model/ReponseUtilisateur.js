const mongoos = require("mongoose")
const Schema=mongoos.Schema;

const ReponseUtilisateurSchema = mongoos.Schema({
    userId: {type: mongoos.Schema.Types.ObjectId,ref: "Utilisateur",required: true},
    quizId: {type: mongoos.Schema.Types.ObjectId,ref: "Quiz",required: true},
    idtelegrame:{type:String,require:true},
    userAnswer: {type: String, required: true},
    isCorrect: {type: Boolean,required: true},
    timestamp: {type: Date,default: Date.now}
  });
  
  const ReponseUtilisateur=mongoos.model("ReponseUtilisateur", ReponseUtilisateurSchema);
  module.exports = ReponseUtilisateur;
  