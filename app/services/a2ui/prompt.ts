// The A2UI directive appended to the system prompt when the setting is on.
//
// Tool descriptions ride in the prompt automatically, but small local models
// read the system prompt more reliably than a tool definition buried at the
// end of the message template — especially the correlation "the user asked
// for a UI ⇒ call render_ui". Keep this short: it competes for context with
// the user's own system prompt.

export const A2UI_SYSTEM_PROMPT_HINT = `You can draw interactive UI cards in the chat by calling the render_ui tool.

When the user asks you to show, build, create, make, design or display a UI — a form, a list, a menu, options to choose from, a summary card, a control panel — call render_ui with the UI as its "ui" argument, then briefly mention what you rendered. The tool description lists the exact components and the required JSON shape; follow it strictly.`;
