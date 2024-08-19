const express = require("express");

const TelegramBot = require("node-telegram-bot-api");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require("mongoose");
const dotenv = require('dotenv');

const axios = require("axios");
const user = require("../model/Utilisateur")

const app = express();


dotenv.config(); // Load environment variables

// Initialiser le bot Telegram
const TELEGRAM_BOT_TOKEN = '7123459278:AAGGY8MzuWi8ZvWeyJ00oCjNIyrN_9agvN4';
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

const userSessions = {};

// Fonction pour générer une question de quiz
async function generateQuizQuestion(theme, difficulty) {
  const apigimini = "AIzaSyBgFbZJN4kt1ydH6yv_EVAs-UegCAmPZUY";

  const genAI = new GoogleGenerativeAI(apigimini);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Create a ${difficulty} quiz question about ${theme} with 4 possible answers. Provide the correct answer as well.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Assume the response text is in the format "Question: ..., A) ..., B) ..., C) ..., D) ... Correct Answer: ..."
    const splitResponse = responseText.split('Correct Answer:');
    if (splitResponse.length < 2) throw new Error("Correct Answer not found");

    const question = splitResponse[0].trim();
    const fullCorrectAnswer = splitResponse[1].trim();
    const correctAnswer = fullCorrectAnswer.match(/[A-Za-z]/)?.[0]; // Extract first letter (e.g., A, B, C...)

    return { question, correctAnswer };

  } catch (error) {
    console.error("Error generating quiz question:", error.message);
    return { question: "Sorry, I couldn't generate a question at this time.", correctAnswer: null };
  }
}

// Enregistrer un utilisateur dans la base de données
async function registerUser(message) {
  try {
    const id = message.from.id;
    const first_name = message.from.first_name;
    const last_name = message.from.last_name || ''; // Last name might be optional
    const username = message.from.username || '';
    const correct=0;
    const quiz_totale=0;
    const score=0;

    // Check if user already exists in the database
    let utilisateur = await user.findOne({ id });

    if (!utilisateur) {
      // If user doesn't exist, create a new one
      utilisateur = new user({
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

// Gérer les messages du bot Telegram
bot.on('message', async (message) => {
  console.log(message);
  
  const chatId = message.from.id;
  const text = message.text.toLowerCase();
 

   // Register the user when they first interact with the bot
   await registerUser(message);
  
  
  // Vérifier si l'utilisateur a envoyé une commande de quiz
  if (text.startsWith("/quiz")) {
    const parts = text.split(" ");
    console.log(parts);
    
    if (parts.length < 3) {
      bot.sendMessage(chatId, "Please provide both a theme and difficulty level. Example: /quiz science easy");
      return;
    }

    const theme = parts[1];
    const difficulty = parts[2];

    const validDifficulties = ["easy", "medium", "hard"];
    if (!validDifficulties.includes(difficulty)) {
      bot.sendMessage(chatId, "Invalid difficulty level. Please choose from easy, medium, or hard.");
      return;
    }

    // Générer une question de quiz
    const { question, correctAnswer } = await generateQuizQuestion(theme, difficulty);

    if (correctAnswer) {
      // Initialiser la session de l'utilisateur avec un score et des statistiques de quiz s'il n'a pas encore de session
      if (!userSessions[chatId]) {
        userSessions[chatId] = { score: 0, totalQuizzes: 0, correctAnswers: 0, correctAnswer };
      } else {
        userSessions[chatId].correctAnswer = correctAnswer;
      }

      // Envoyer la question de quiz à l'utilisateur
      bot.sendMessage(chatId, question);
    } else {
      bot.sendMessage(chatId, "Sorry, there was an error generating the quiz question.");
    }

  } else if (userSessions[chatId] && userSessions[chatId].correctAnswer) {
    // Vérifier si la réponse de l'utilisateur est correcte
    const correctAnswer = userSessions[chatId].correctAnswer.toLowerCase().trim();

    // Mettre à jour le total des quiz
    userSessions[chatId].totalQuizzes += 1;
    // Update the correct in the database
    await user.findOneAndUpdate({ id: chatId }, {
        $inc: { quiz_totale: 1 }

    });
    
    if (text === correctAnswer.toLowerCase()) {
      // Augmenter les réponses correctes de l'utilisateur s'il a répondu correctement
      userSessions[chatId].correctAnswers += 1;

      bot.sendMessage(chatId, `Correct! 🎉 Your score is now: ${userSessions[chatId].correctAnswers}/${userSessions[chatId].totalQuizzes}`);
       // Update the correct in the database
       await user.findOneAndUpdate({ id: chatId }, {
        $inc: { correct: 1 }
      });
    } else {
      bot.sendMessage(chatId, `Incorrect. The correct answer was ${userSessions[chatId].correctAnswer}. Your score is: ${userSessions[chatId].correctAnswers}/${userSessions[chatId].totalQuizzes}`);
    }

    // Supprimer la réponse correcte après la réponse de l'utilisateur
    delete userSessions[chatId].correctAnswer;

  }
  else if (text.startsWith("/score")){
    // Afficher le score de l'utilisateur
     try {
      const utilisateur = await user.findOne({ id: chatId });
 
      if (utilisateur) {
        const totalQuizzes = utilisateur.quiz_totale;
        const correctAnswers = utilisateur.correct;
        await user.findOneAndUpdate({ id: chatId }, {
          score: correctAnswers/totalQuizzes
        });
        

        // Envoyer les statistiques de l'utilisateur
        bot.sendMessage(chatId, `Your quiz statistics:\nTotal Quizzes: ${totalQuizzes}\nCorrect Answers: ${correctAnswers}`);
      } else {
        bot.sendMessage(chatId, "You haven't taken any quizzes yet!");
      }
      
    } catch (error) {
      console.error("Error retrieving user score:", error);
      bot.sendMessage(chatId, "Sorry, there was an error retrieving your score.");
    }
  }
  else {
    bot.sendMessage(chatId, "Hello! You can ask me to generate a quiz by typing /quiz <theme> <difficulty>.");
  }
});


//cette écriture paramètre de base de données et port de cette serveure  
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