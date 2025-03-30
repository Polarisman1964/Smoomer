const express = require('express');
const cors = require('cors'); // Add this line
const routes = require('./routes');

const app = express();
app.use(express.json());
app.use(cors()); // Add this line to enable CORS

app.use('/', routes);

console.log("SMS API is running");

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
