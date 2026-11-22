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
Stack(children, orientation? "vertical"|"horizontal", gap? "xs"|"sm"|"md")
TextContent(text)
Icon(name, size? "small"|"medium"|"large")
Image(url, variant? "thumb"|"full", caption?)
Card(children, title?)
Divider()
Button(label, action?) — action: @ToAssistant("...") or @OpenUrl("...")
Input(label?, value?, placeholder?, inputType? "text"|"number"|"email"|"password")
CheckBox(label, value? false)
Slider(label, min, max, value?)
ChoicePicker(label?, options=[...], selected?)
List(items, orientation? "vertical"|"horizontal")
Tabs(tabs=[{label, content: [components]}])
Map(markers=[{label, lat?, lon?}], route?=[{lat, lon}], variant? "small"|"medium"|"large")

Rules:
- NEST shapes: gallery -> Stack horizontal of Cards; trip -> Map + photos; form -> Inputs. Match the shape to the request.
- Images only when you have a real https:// URL; NEVER invent URLs (they render blank). For Paris museums reuse: Louvre https://commons.wikimedia.org/wiki/Special:FilePath/Louvre_Museum_Wikimedia_Commons.jpg?width=320, Orsay .../MuseeDOrsay.jpg?width=320, Pompidou .../The_Centre_Pompidou_behind_Buildings.jpg?width=320.
- Map coordinates are real lat/lon: Louvre 48.8606, 2.3376; Eiffel 48.8584, 2.2944; Orsay 48.86, 2.3266; Pompidou 48.8613, 2.3522; Versailles 48.8049, 2.1204; Vincennes 48.842, 2.4386.

Example (short trip card — copy this shape; the WHOLE card is ONE root statement):
<ui>root = Stack([TextContent("Paris museums"), Map([{label:"Louvre", lat:48.9, lon:2.3},{label:"Orsay", lat:48.9, lon:2.3}], [{lat:48.9, lon:2.3},{lat:48.9, lon:2.3}], "medium")])</ui>`.trim();