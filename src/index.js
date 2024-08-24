const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require("mongoose");
const dotenv = require('dotenv');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const userModel = require("../model/Utilisateur");
const Quiz = require('../model/Quizz');
const ReponseUtilisateur = require('../model/ReponseUtilisateur');
dotenv.config(); // Load environment variables

const app = express();

// Initialize Telegram bot
const TELEGRAM_BOT_TOKEN = "7123459278:AAGGY8MzuWi8ZvWeyJ00oCjNIyrN_9agvN4";
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

const userSessions = {};


async function calculateUserRank(userId) {
  const allUsers = await userModel.find().sort({ score: -1 }); // Trier les utilisateurs par score décroissant
  const userIndex = allUsers.findIndex(user => user.id == userId);
console.log(userIndex);

  // Calculer le rang basé sur l'index (index + 1)
  return userIndex + 1;
}


// Function to handle user responses based on their session state
async function handleUserResponse(message) {
  const chatId = message.from.id;
  const text = message.text.toLowerCase();

  if ( text.includes("rapport")) {
    // Send the PDF report when the user types "rapport"
    await sendPDFReport(chatId, chatId); // We are using chatId for both parameters since userId is the same as chatId in your structure.
    return ;
  }
  if(text.includes("statistique"))
  {
    // Send the statistics when the user types "statistique "
    const statistics = await getUserStatistics(chatId);
      bot.sendMessage(chatId, statistics) 
    return;
  }

  if (!userSessions[chatId]) {
    // Initialize a new session if not already present
    userSessions[chatId] = { stage: 1, context: {} };
    bot.sendMessage(chatId, "Bonjour ! Je vais vous aider à créer un quiz interactif. Quel est votre domaine d'étude ou d'intérêt ? (par exemple, sciences, histoire, géographie)");
    return;
  }

  const userSession = userSessions[chatId];

  switch (userSession.stage) {
    case 1:
      userSession.context.domaine = text;
      userSession.stage = 2;
      bot.sendMessage(chatId, "Merci ! Quel est votre niveau d'éducation ou de compétence ? (par exemple, débutant, intermédiaire, avancé)");
      break;
    case 2:
      userSession.context.niveau = text;
      userSession.stage = 3;
      bot.sendMessage(chatId, "Merci ! Quel type de questions préférez-vous ? (par exemple, choix multiples, vrai/faux, réponse courte)");
      break;
    case 3:
      userSession.context.typeQuestion = text;
      userSession.stage = 4;
      bot.sendMessage(chatId, "Merci pour ces informations ! Je vais maintenant générer une question de quiz pour vous.");

      // Generate a quiz question based on the collected context
      const { responseText, quizId } = await generateQuizQuestion(userSession.context, chatId);
      // Update the correct in the database
      await userModel.findOneAndUpdate({ id: chatId }, {
        $inc: { quiz_totale: 1 }

      });
      userSession.quizId = quizId;

      userSession.stage = 5;
      bot.sendMessage(chatId, responseText);
      break;

    case 5:
      // Check if the user's answer is correct
      const isCorrect = await checkUserAnswer(userSession.quizId, text);
      // Update the user's correct answer count if the answer is correct
      
      bot.sendMessage(chatId, isCorrect ? "Correct! 🎉 ! Bien joué." : "Incorrect 🚨. Réessayez ou attendez la prochaine question.");
      if (isCorrect) {
        await userModel.findOneAndUpdate({ id: chatId }, {
          $inc: { correct: 1 },
          rank: await calculateUserRank(chatId)

        });
      }
      // Retrieve the updated user data to calculate the score
      const user = await userModel.findOne({ id: chatId });
      const score = (user.correct / user.quiz_totale) * 100;

      // Update the user's score
      await userModel.findOneAndUpdate({ id: chatId }, { score });

      // Save the user's response in the database
      const utilisateur = await userModel.findOne({ id: chatId });
      const newResponse = new ReponseUtilisateur({
        userId: utilisateur._id,
        quizId: userSession.quizId,
        idtelegrame: chatId,
        userAnswer: text,
        isCorrect
      });
      await newResponse.save();
      console.log("User response saved to the database.");

      break;
    default:
      bot.sendMessage(chatId, "Je ne suis pas sûr de ce que vous voulez dire. Veuillez recommencer.");
      delete userSessions[chatId]; // Reset session on invalid state
      break;
  }
}


async function generateQuizQuestion(context, chatId) {
  const apigimini = "AIzaSyBgFbZJN4kt1ydH6yv_EVAs-UegCAmPZUY";
  const genAI = new GoogleGenerativeAI(apigimini);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
  Créez une question de quiz basée sur les informations suivantes :
  - Domaine : ${context.domaine}
  - Niveau : ${context.niveau}
  - Type de question : ${context.typeQuestion}
  Veuillez créer une question intéressante et appropriée, et fournir la réponse correcte dans le format suivant :"Question de quiz":<votre quetsion et choix> "Réponse : <votre réponse ici>".
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();
    console.log('Full AI Response:', responseText);

    // Regex to separate the question and answer
    const questionMatch = responseText.indexOf("Question de quiz");
    const answerStart = responseText.indexOf("Réponse");

    if (questionMatch === -1 || answerStart === -1) {
      throw new Error("Failed to find question or answer in AI response.");
    }

    //console.log("questionmatch:",questionMatch);
    const questionText = responseText.substring(questionMatch + "Question de quiz :".length, answerStart).trim();
    const correctAnswesr = responseText.substring(answerStart + "Réponse :".length).trim();
    const correctAnswesrz = cleanText(correctAnswesr)
    console.log(correctAnswesrz);


    console.log("questionText:", questionText);
    console.log("correctAnswesr:", correctAnswesr);






    // Retrieve the user from the database
    const utilisateur = await userModel.findOne({ id: chatId });

    //Save the question and answer to the database
    const newQuiz = new Quiz({
      question: questionText,
      answer: correctAnswesrz,
      userId: utilisateur._id,

    });

    const savedQuiz = await newQuiz.save();
    console.log('Quiz question and correct answer saved to the database.');

    // Mask the correct answer in the response text
    const maskedResponse = questionText.replace(correctAnswesr, '**Réponse masquée**');

    // Return the formatted response to the user
    return { responseText: maskedResponse, quizId: savedQuiz._id };
  } catch (error) {
    console.error("Error generating quiz question:", error.message);
    return { responseText: "Désolé, je n'ai pas pu générer une question pour le moment." };
  }
}

async function checkUserAnswer(quizId, userAnswer) {
  try {
    // Retrieve the quiz from the database
    const quiz = await Quiz.findById(quizId);

    //console.log('quiz:', quiz);
    if (!quiz) {
      throw new Error("Quiz not found.");
    }

    // Compare the user's answer with the correct answer
    return quiz.answer.trim().toLowerCase() === userAnswer.trim().toLowerCase();
  } catch (error) {
    console.error("Error checking user answer:", error.message);
    return false;
  }
}


function cleanText(text) {
  // Enlève les guillemets autour du texte et nettoie les espaces superflus
  return text.replace(/^"|"$/g, '').trim();
}

// ! get statestique apré terminer le quiz 
async function getUserStatistics(chatId) {
  try {
    // Retrieve the user from the database
    const user = await userModel.findOne({ id: chatId });

    if (!user) {
      throw new Error("User not found.");
    }

    const rank = await calculateUserRank(chatId);

    const statistics = `
    Voici vos statistiques :
    - Nombre total de quiz : ${user.quiz_totale}
    - Nombre de réponses correctes : ${user.correct}
    - Score : ${user.score.toFixed(2)}%
    - Rang : ${rank}
    `;

    return statistics;
  } catch (error) {
    console.error("Error retrieving user statistics:", error.message);
    return "Désolé, je n'ai pas pu récupérer vos statistiques pour le moment.";
  }
}



// Register or update a user in the database
async function registerUser(message) {
  try {
    const id = message.from.id;
    const first_name = message.from.first_name;
    const last_name = message.from.last_name || '';
    const username = message.from.username || '';
    const correct = 0;
    const quiz_totale = 0;
    const score = 0;

    let utilisateur = await userModel.findOne({ id });

    if (!utilisateur) {
      utilisateur = new userModel({
        id,
        first_name,
        last_name,
        username,
        correct,
        quiz_totale,
        score
      });
      await utilisateur.save();
      console.log(`User ${first_name} registered in the database.`);
    } else {
      console.log(`User ${first_name} already exists in the database.`);
    }
  } catch (error) {
    console.error("Error registering user:", error);
  }
}

// Handle incoming messages
bot.on('message', async (message) => {
  console.log(message);
  const chatId = message.from.id;
  const text = message.text.toLowerCase();


  // Register the user
  await registerUser(message);

  // Handle user responses and manage the quiz setup process
  await handleUserResponse(message);

  
});


// Envoyer le rapport PDF
async function sendPDFReport(chatId, idtelegrame) {
  try {
    // Générer le rapport PDF
    const filePath = await generatePDFReport(idtelegrame);

    // Envoyer le fichier PDF à l'utilisateur avec le type de contenu spécifié
    await bot.sendDocument(chatId, filePath, {}, { contentType: 'application/pdf' });

    // Nettoyer le fichier après l'envoi
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Erreur lors de la suppression du fichier ${filePath} :`, err.message);
      } else {
        console.log(`Fichier ${filePath} supprimé avec succès.`);
      }
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi du rapport PDF :", error.message);
    bot.sendMessage(chatId, "Désolé, je n'ai pas pu envoyer le rapport PDF.");
  }
}

// Générer le rapport PDF
async function generatePDFReport(idtelegrame) {
  const reportsDir = path.join(__dirname, 'reports');

  // Vérifier si le répertoire des rapports existe, et le créer s'il n'existe pas
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, `user_${idtelegrame}_report.pdf`);
  const doc = new PDFDocument();

  // Créer un flux d'écriture pour écrire le fichier PDF
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  doc.fontSize(18).text('Rapport de Réponses de l\'Utilisateur', { align: 'center' });
  doc.moveDown();

  // Récupérer les réponses des utilisateurs en utilisant idtelegrame
  const responses = await ReponseUtilisateur.find({ idtelegrame }).populate('quizId');

  if (responses.length === 0) {
    doc.text('Aucune réponse trouvée pour cet utilisateur.');
  } else {
    doc.fontSize(14).text('Réponses :', { underline: true });
    doc.moveDown();

    responses.forEach(response => {
      doc.fontSize(12).text(`ID Quiz : ${response.quizId._id}`);
      doc.text(`Question : ${response.quizId.question}`);
      doc.text(`Votre Réponse : ${response.userAnswer}`);
      doc.text(`Réponse Correcte : ${response.quizId.answer}`);
      doc.text(`Correct : ${response.isCorrect ? 'Oui' : 'Non'}`);
      doc.moveDown();
    });
  }

  doc.end();

  // Attendre que le PDF soit complètement écrit
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  return filePath;
}




// Configure database and server settings
const port = process.env.PORT || 3000;
const mongoUrl = process.env.MONGO_URL;

mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Database connected");
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Error connecting to database:", err);
  });
