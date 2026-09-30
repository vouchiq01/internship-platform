import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`API listening on :${config.port}`);
});
