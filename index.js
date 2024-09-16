const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Database connection (replace with your MongoDB URI)
mongoose.connect('mongodb://localhost:27017/habitsDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB', err);
});

// User Schema
const UserSchema = new mongoose.Schema({
    username: String,
    password: String
});

const User = mongoose.model('User', UserSchema);

// Habit Schema
const HabitSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    duration: Number,
    frequency: String
});

const Habit = mongoose.model('Habit', HabitSchema);

// Register user
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).send('User registered');
});

// Login user
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
        return res.status(400).send('User not found');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).send('Invalid password');
    }
    const token = jwt.sign({ userId: user._id }, 'SECRET_KEY');
    res.send({ token });
});

// Middleware for authentication
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send('Unauthorized');
    jwt.verify(token, 'SECRET_KEY', (err, decoded) => {
        if (err) return res.status(401).send('Unauthorized');
        req.userId = decoded.userId;
        next();
    });
};

// Create a new habit
app.post('/habits', authMiddleware, async (req, res) => {
    const { name, duration, frequency } = req.body;
    const habit = new Habit({ userId: req.userId, name, duration, frequency });
    await habit.save();
    res.status(201).send(habit);
});

// Get habits for the logged-in user
app.get('/habits', authMiddleware, async (req, res) => {
    const habits = await Habit.find({ userId: req.userId });
    res.send(habits);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
