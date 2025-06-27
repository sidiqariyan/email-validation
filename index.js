const express = require('express');
const path = require('path');
const EmailValidator = require('./emailValidator'); // Import the EmailValidator class directly

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize email validator with faster settings
const emailValidator = new EmailValidator({
  timeout: 2500,     // 4 seconds for SMTP timeout
  retryAttempts: 1,  // Reduced retry attempts for faster response
  verbose: false
});

// Routes
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Email Validator',
    result: null,
    email: ''
  });
});

app.post('/validate', async (req, res) => {
  const { email } = req.body;
 
  if (!email) {
    return res.render('index', {
      title: 'Email Validator',
      result: null,
      email: '',
      error: 'Please enter an email address'
    });
  }

  try {
    const result = await emailValidator.validateEmail(email.trim());
    res.render('index', {
      title: 'Email Validator',
      result: result,
      email: email,
      error: null
    });
  } catch (error) {
    res.render('index', {
      title: 'Email Validator',
      result: null,
      email: email,
      error: `Validation failed: ${error.message}`
    });
  }
});

app.post('/validate-batch', async (req, res) => {
  const { emails } = req.body;
 
  if (!emails) {
    return res.json({ error: 'Please provide emails' });
  }

  try {
    const emailList = emails.split(',').map(email => email.trim()).filter(email => email);
    const results = await emailValidator.validateBatch(emailList);
    res.json({ results });
  } catch (error) {
    res.json({ error: `Batch validation failed: ${error.message}` });
  }
});

// API endpoint for single email validation
app.post('/api/validate', async (req, res) => {
  const { email } = req.body;
 
  if (!email) {
    return res.json({ error: 'Email is required' });
  }

  try {
    const result = await emailValidator.validateEmail(email.trim());
    res.json(result);
  } catch (error) {
    res.json({ error: `Validation failed: ${error.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Email Validator Server running on http://localhost:${PORT}`);
});