import app from './app.js';

const port = Number(process.env.PORT) || 5000;

app.listen(port, () => console.log(`AI Research Agent API listening on port ${port}`));

