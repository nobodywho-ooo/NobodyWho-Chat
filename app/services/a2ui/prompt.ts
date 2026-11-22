// The A2UI directive appended to the system prompt when the setting is on.
//
// A2UI streams through the ordinary assistant token stream: the model wraps
// every UI in `<ui>{openui-lang}</ui>` sentinels so the app can render the
// card live while it streams. The language is OpenUI Lang (openui.com/docs),
// a line-oriented `identifier = Expression` DSL that the official
// @openuidev/lang-core parser validates.
//
// Guidance choices here are tuned from real on-device model output: tiny
// models copy the first example they see, so the examples deliberately show
// DIFFERENT shapes (a form, a gallery, a finance sheet, a trip with map)
// rather than one; and there are explicit rules against fabricating image
// URLs. The generated spec section (component signatures, syntax, actions,
// streaming rules) comes from @openuidev/lang-core's prompt generator over
// the component library in lang.ts.

import { generateUiSpecPrompt } from './lang';

// The generated spec leads with an absolute "your ENTIRE response must be
// OpenUI Lang" sentence that contradicts our sentinel design (prose around a
// single <ui> block), so it is reworded inline.
export const A2UI_SYSTEM_PROMPT_HINT = `You can draw interactive UI cards. When the user asks you to show, build, create, make, design, display, set up, fill in or put together ANY interactive UI — a form, a list, a menu, options to choose from, a summary card, a panel, a gallery of places or items, a finance sheet, a calculator, a timer, a quiz or a survey — write the UI in OpenUI Lang between a single pair of sentinels: <ui>root = Stack([...])</ui>. The sentinels are MANDATORY: a card without BOTH <ui> and </ui> is invisible and never renders. Do NOT describe the UI in prose instead; answer with at most one short line around it.

OpenUI Lang is line-oriented: one statement per line, put root = Stack([...]) FIRST so the card shell streams in early. Arguments are positional. Strings use "double quotes".

Components (only these, all others fail to render):
Stack(children, orientation?="vertical"|"horizontal", gap?="xs"|"sm"|"md")
TextContent(text)
Icon(name, size?="small"|"medium"|"large")
Image(url, variant?="thumb"|"full", caption?)  — url must be a REAL working https:// URL or "null"
Card(children, title?)  — a raised box (one museum, hotel or result)
Divider()
Button(label, action?)  — action is @ToAssistant("...") or @OpenUrl("...")
Input(label?, value?, placeholder?, inputType?="text"|"number"|"email"|"password")
CheckBox(label, value?=false)
Slider(label, min, max, value?)
ChoicePicker(label?, options=[...], selected?)
List(items, orientation?="vertical"|"horizontal")  — items are components or plain values
Tabs(tabs=[{label, content: [components]}])
Map(markers=[{label, lat?, lon?}], route?=[{lat, lon}], variant?="small"|"medium"|"large")

Rules:
- NEST shapes: a Stack of Cards for a gallery, a Map over a route for a trip, a form of Inputs for data entry. Match the SHAPE to the request.
- Images only when you have a real https:// URL; otherwise use an Icon + Text. NEVER invent image URLs — they render blank. For museums/Paris/trips you may reuse these working photos: Louvre "https://commons.wikimedia.org/wiki/Special:FilePath/Louvre_Museum_Wikimedia_Commons.jpg?width=320", Orsay "https://commons.wikimedia.org/wiki/Special:FilePath/MuseeDOrsay.jpg?width=320", Pompidou "https://commons.wikimedia.org/wiki/Special:FilePath/The_Centre_Pompidou_behind_Buildings.jpg?width=320".
- Map coordinates are real lat/lon (Louvre 48.8606, 2.3376; Eiffel 48.8584, 2.2944; Orsay 48.8600, 2.3266; Pompidou 48.8613, 2.3522; Versailles 48.8049, 2.1204; Vincennes 48.8420, 2.4386).
- Keep the WHOLE UI in ONE <ui> block, one statement per line, close with </ui>. Keep it compact.

Examples — note each matches its request's shape:
Form: <ui>root = Stack([Input("Name", "", "Enter name", "text"), Slider("Budget", 0, 100, 50), Button("Submit", @ToAssistant("Submitted"))])</ui>
Gallery: <ui>root = Stack([TextContent("Museums in Paris"), Divider(), Stack([Card([Icon("location"), TextContent("Louvre")]), Card([Icon("location"), TextContent("Orsay")]), Card([Icon("location"), TextContent("Pompidou")])], "horizontal")])</ui>
Finance sheet: <ui>root = Stack([TextContent("Monthly budget"), Divider(), Stack([TextContent("Rent"), TextContent("1200")], "horizontal"), Divider(), Stack([TextContent("Food"), TextContent("400")], "horizontal"), Divider(), Button("Add expense", @ToAssistant("Add expense"))])</ui>
Trip with map and photos: <ui>root = Stack([TextContent("Paris and around"), Map([{label:"Louvre", lat:48.8606, lon:2.3376},{label:"Versailles", lat:48.8049, lon:2.1204},{label:"Vincennes", lat:48.8420, lon:2.4386}], [{lat:48.8606, lon:2.3376},{lat:48.8049, lon:2.1204},{lat:48.8420, lon:2.4386}], "medium"), Stack([Image("https://commons.wikimedia.org/wiki/Special:FilePath/Louvre_Museum_Wikimedia_Commons.jpg?width=320"), Image("https://commons.wikimedia.org/wiki/Special:FilePath/MuseeDOrsay.jpg?width=320"), Image("https://commons.wikimedia.org/wiki/Special:FilePath/The_Centre_Pompidou_behind_Buildings.jpg?width=320")], "horizontal")])</ui>

=== Language spec ===
${generateUiSpecPrompt().replace(
  'Your ENTIRE response must be valid openui-lang code — no markdown, no explanations, just openui-lang.',
  'Inside a <ui>…</ui> block, your ENTIRE content must be valid openui-lang code — no markdown, no extra text inside the block.',
)}`.trim();