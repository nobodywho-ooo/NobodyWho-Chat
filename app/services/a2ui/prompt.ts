// The A2UI directive appended to the system prompt when the setting is on.
//
// A2UI streams through the ordinary assistant token stream: the model wraps
// every UI in `<ui>{openui-lang}</ui>` sentinels so the app can render the
// card live while it streams. The language is OpenUI Lang (openui.com/docs),
// a line-oriented `identifier = Expression` DSL that the official
// @openuidev/lang-core parser validates.
//
// Prompt-size discipline is measured: the local Q-quant models copy the
// examples, so this stays as short as it can while still showing the shapes.
// A long generated spec drowned the small models — they started
// "root = Stack([" from the example and bailed mid-Map (server-verified: the
// same grammar + model with a tiny prompt completes the whole card).

export const A2UI_SYSTEM_PROMPT_HINT = `You can draw interactive UI cards. When the user asks you to show, build, create, make, design, display, set up, fill in or put together ANY interactive UI — a form, a list, a menu, options to choose from, a summary card, a panel, a gallery of places or items, a finance sheet, a calculator, a quiz or a survey — write the UI in OpenUI Lang between a single pair of sentinels: <ui>...</ui>. The sentinels are MANDATORY: a card without BOTH <ui> and </ui> is invisible and never renders. Write ONE block, keep it compact, close it with </ui>, then at most one short line of prose.

OpenUI Lang is one statement per line: identifier = Expression. Put root = Stack([...]) FIRST so the card shell streams in early. Arguments are positional. Strings use "double quotes".

Components (only these, all others fail to render):
Stack(children, orientation?, gap?)
TextContent(text)
Icon(name, size?)
Image(url, variant?, caption?)
Card(children, title?)
Divider()
Button(label, action?)
Input(label?, value?, placeholder?, inputType?)
CheckBox(label, value?)
Slider(label, min, max, value?)
ChoicePicker(label?, options?, selected?)
List(items, orientation?)
Map(markers, route?, variant?)

Rules:
- NEST shapes: gallery -> Stack horizontal of Cards; trip -> Map + photos; form -> Inputs. Match the shape to the request.
- Images only when you have a real https:// URL; NEVER invent URLs (they render blank); otherwise use an Icon + Text instead.
- Map markers/route take real lat/lon decimals; do not invent fine-grained coordinates — rounded city-level numbers (e.g. 48.9, 2.3) are fine, or set label-only pins.

Example (trip card — copy this shape; the WHOLE card is ONE root statement; Map is fine WITHOUT a variant):
<ui>root = Stack([TextContent("Trip"), Map([{label:"Stop A", lat:48.9, lon:2.3},{label:"Stop B", lat:48.9, lon:2.3}], [{lat:48.9, lon:2.3},{lat:48.9, lon:2.3}])])</ui>

Example (settings/controls — toggles are CheckBox, ranges are Slider):
<ui>root = Stack([TextContent("Settings"), CheckBox("Dark mode", true), CheckBox("Notifications", false), Slider("Volume", 0, 100, 60)])</ui>

Example (form — inputs are Input, action is a Button):
<ui>root = Stack([Input("Name", "", "Your name", "text"), Button("Order", @ToAssistant("Ordered"))])</ui>

Example (comparison — side-by-side Cards; series of facts under each name):
<ui>root = Stack([TextContent("PhoneX vs PhoneY"), Stack([Card([TextContent("PhoneX"), TextContent("6.1 in")]), Card([TextContent("PhoneY"), TextContent("6.7 in")])], "horizontal")])</ui>

Example (controls — a Button that switches local state uses @Set($name, value); display it with $name ? "…" : "…" — do NOT send a chat message for a plain start/reset):
<ui>root = Stack([TextContent($running ? "Running" : "Ready"), Button("Start", @Set($running, true)), Button("Reset", @Set($running, false))])</ui>`.trim();