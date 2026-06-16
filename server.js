const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

let gameState = {
    currentQuestion: -1,
    players: {},
    gameStarted: false,
    gameEnded: false
};

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);
    
    socket.on('join', (playerName) => {
        gameState.players[socket.id] = {
            id: socket.id,
            name: playerName,
            score: 0,
            answers: []
        };
        
        io.emit('playerJoined', {
            player: gameState.players[socket.id],
            totalPlayers: Object.keys(gameState.players).length
        });
        
        if (gameState.gameStarted && !gameState.gameEnded) {
            socket.emit('gameState', {
                currentQuestion: gameState.currentQuestion,
                question: questions[gameState.currentQuestion],
                totalQuestions: questions.length
            });
        }
    });
    
    socket.on('startGame', () => {
        gameState.gameStarted = true;
        gameState.currentQuestion = 0;
        gameState.gameEnded = false;
        Object.keys(gameState.players).forEach(id => {
            gameState.players[id].score = 0;
            gameState.players[id].answers = [];
        });
        
        io.emit('gameStarted', {
            currentQuestion: 0,
            question: questions[0],
            totalQuestions: questions.length
        });
    });
    
    socket.on('submitAnswer', (answer) => {
        const player = gameState.players[socket.id];
        if (!player || gameState.currentQuestion < 0) return;
        
        const question = questions[gameState.currentQuestion];
        const isCorrect = answer === question.correct;
        
        if (isCorrect) {
            player.score += 1;
        }
        
        player.answers.push({
            question: gameState.currentQuestion,
            answer: answer,
            correct: isCorrect
        });
        
        socket.emit('answerResult', {
            correct: isCorrect,
            correctAnswer: question.correct,
            feedback: question.feedback
        });
        
        io.emit('leaderboard', getLeaderboard());
    });
    
    socket.on('nextQuestion', () => {
        gameState.currentQuestion++;
        
        if (gameState.currentQuestion >= questions.length) {
            gameState.gameEnded = true;
            io.emit('gameEnded', {
                leaderboard: getLeaderboard()
            });
        } else {
            io.emit('nextQuestion', {
                currentQuestion: gameState.currentQuestion,
                question: questions[gameState.currentQuestion],
                totalQuestions: questions.length
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete gameState.players[socket.id];
        io.emit('playerLeft', {
            playerId: socket.id,
            totalPlayers: Object.keys(gameState.players).length
        });
    });
});

function getLeaderboard() {
    return Object.values(gameState.players)
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
            rank: index + 1,
            name: player.name,
            score: player.score
        }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port ' + PORT);
});
