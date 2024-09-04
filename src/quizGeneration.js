// quizGeneration.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateDailyQuizQuestion() {
    const apigimini = "AIzaSyBgFbZJN4kt1ydH6yv_EVAs-UegCAmPZUY";
    const genAI = new GoogleGenerativeAI(apigimini);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
    const prompt = `Créez une question de quiz aléatoire pour le défi du jour. Veuillez fournir la question et la réponse correcte dans le format suivant :"Question de quiz":<votre question> "Réponse : <votre réponse ici>"`;
  
    try {
      const result = await model.generateContent(prompt);
      const responseText = await result.response.text();
  
      const questionMatch = responseText.indexOf("Question de quiz");
      const answerStart = responseText.indexOf("Réponse");
  
      if (questionMatch === -1 || answerStart === -1) {
        throw new Error("Failed to find question or answer in AI response.");
      }
  
      const questionText = responseText.substring(questionMatch + "Question de quiz :".length, answerStart).trim();
      const correctAnswer = responseText.substring(answerStart + "Réponse :".length).trim();
  
      return { question: questionText, answer: cleanText(correctAnswer) };
    } catch (error) {
      console.error("Error generating daily quiz question:", error.message);
      return { question: "Désolé, je n'ai pas pu générer une question pour le moment.", answer: "" };
    }
  }
  
  function cleanText(text) {
    return text.replace(/^"|"$/g, '').trim();
  }
  
  module.exports =  generateDailyQuizQuestion ;
  