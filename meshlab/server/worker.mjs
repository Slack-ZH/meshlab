import { createChatApi } from './chat-api.mjs';

// The deployed entry point always requires a chat access code.
const handle = createChatApi();
export default {
  fetch(request, env) {
    return handle(request, env);
  }
};
