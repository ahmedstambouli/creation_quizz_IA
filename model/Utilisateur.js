const mongoos =require("mongoose")

const UtilisateurSchema=mongoos.Schema({
    id:{type:String},
    first_name:{type:String},
    last_name:{type:String},
    username:{type:String},
    correct:{type:Number},
    quiz_totale:{type:Number},
    score:{type:Number},


})

const Utilisateur=mongoos.model("Utilisateur",UtilisateurSchema)
module.exports=Utilisateur;