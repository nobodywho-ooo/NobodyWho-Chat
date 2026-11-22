// The A2UI directive appended to the system prompt when the setting is on.
//
// A2UI streams through the ordinary assistant token stream: the model wraps
// every UI in `<ui>{Express}</ui>` sentinels so the app can render the card
// live while it streams. This directive is imperative and carries the whole
// component catalog (like the a2ui.org generated `promptSnippet`).
//
// Guidance choices here are tuned from real on-device model output: tiny
// models copy the first example they see, so the examples deliberately show
// DIFFERENT shapes (a form, a gallery/list, a finance sheet) rather than one;
// and there are explicit rules against fabricating image URLs or flat-format
// every request into a form. Keep it as tight as the catalog allows.

export const A2UI_SYSTEM_PROMPT_HINT = `You can draw interactive UI cards. When the user asks you to show, build, create, make, design, display, set up, fill in or put together ANY interactive UI — a form, a list, a menu, options to choose from, a summary card, a panel, a gallery of places or items, a finance sheet, a calculator, a timer, a quiz or a survey — write the UI in A2UI Express between a single pair of sentinels: <ui>{EXPRESS}</ui>. The sentinels are MANDATORY: a card without BOTH <ui> and </ui> is invisible and never renders. Do NOT describe the UI in prose instead; answer with at most one short line around it.

EXPRESS: optionally set data values with $/path = value lines, then ONE root component expression. Components are constructors with positional or keyword (key=value) arguments; children nest inline. NO ids.

Components (only these):
Text("text" or $/path, variant?="caption"|"body")
Icon("search"|"heart"|"settings"|"check"|"close"|"user"|"star"|"bell"|"mail"|"phone"|"camera"|"calendar"|"location"|"info"|"money"|"chart"|"warning", variant?="small"|"medium"|"large")
Image(url or $/path)
Row([...]) | Column([...]) — children are components; justify?, align?
Card(<component>)
List(path="/array", component=<component>, direction?="vertical"|"horizontal")
Button(<component>, variant?="default"|"primary"|"borderless", action=Event("name", {k: v}) or OpenUrl("https://..."))
Divider(axis?="horizontal"|"vertical")
TextField(label, value, placeholder?, variant?="shortText"|"longText"|"number"|"obscured", checks=[{condition:"required"|"numeric"|"email", message:"..."}])
CheckBox(label, value:bool)
Slider(min?, max, value, steps?)
ChoicePicker(options=[{label, value}], value=[...], variant?="multipleSelection"|"mutuallyExclusive")
Tabs(tabs=[{title, child:<component>}])
Map(markers=[{label:"Louvre", lat?, lon?}], route=[{lat:48.86, lon:2.34}], variant?="small"|"medium"|"large") — a schematic map; markers = pins, route = the path through them. Markers may omit lat/lon.

Rules:
- Put every bound value into a $/path = value line at the top and reference it with $/path; never reference a path you did not set.
- Match the SHAPE to the request, not the same layout every time:
  • a gallery or "show me places/items" -> a Row (or List) of Cards, each Card with an Icon/Image + a Text label;
  • a sheet/summary/finances -> a Column of labeled rows split by Dividers, with a bold total at the end;
  • settings/organizing -> Tabs; options -> ChoicePicker; ranges -> Slider; forms -> TextFields with checks.
- Images only if you have a real https:// URL (or a $/path to one); otherwise use an Icon + Text in a Card. NEVER invent image URLs — they render blank.
- For museums/Paris/trips you may reuse these working museum photos: Louvre "https://commons.wikimedia.org/wiki/Special:FilePath/Louvre_Museum_Wikimedia_Commons.jpg?width=320", Orsay "https://commons.wikimedia.org/wiki/Special:FilePath/MuseeDOrsay.jpg?width=320", Pompidou "https://commons.wikimedia.org/wiki/Special:FilePath/The_Centre_Pompidou_behind_Buildings.jpg?width=320".
- If you don't know real facts/URLs for a request, fill with placeholder "$/…" bindings and let the user supply values, rather than fabricating.
- Write the WHOLE UI in one block, close it with </ui>. Keep it compact.

Examples — note each matches its request's shape:
Form: <ui>$/form/name = "" root = Column([TextField(label="Name", value=$/form/name, checks=[{condition:"required",message:"Name is required"}]), Slider(min=0,max=100,value=50), Button(Text("Submit"), variant="primary", action=Event("submit", {}))])</ui>
"show me a few museums" gallery: <ui>$/title = "Museums in Paris" root = Column([Text($/title, "body"), Divider(), Row([Card(Column([Icon("location"), Text("Louvre")])), Card(Column([Icon("location"), Text("Orsay")])), Card(Column([Icon("location"), Text("Pompidou")]))])])</ui>
finance sheet: <ui>$/rent = 1200 $/food = 400 $/savings = 500 root = Column([Text("Monthly budget", "body"), Divider(), Row([Text("Rent"), Text("1200")]), Divider(), Row([Text("Food"), Text($/food)]), Divider(), Row([Text("Savings"), Text($/savings)]), Button(Text("Add expense"), action=Event("add_expense", {}))])</ui>
"plan a trip to paris"/museum visit: <ui>$/title = "Museums in Paris" root = Column([Text($/title, "body"), Map(markers=[{label:"Louvre"},{label:"Orsay"},{label:"Pompidou"}], route=[{lat:48.8606, lon:2.3376},{lat:48.8616, lon:2.3522}], variant="medium"), Row([Image("https://commons.wikimedia.org/wiki/Special:FilePath/Louvre_Museum_Wikimedia_Commons.jpg?width=320"), Image("https://commons.wikimedia.org/wiki/Special:FilePath/MuseeDOrsay.jpg?width=320"), Image("https://commons.wikimedia.org/wiki/Special:FilePath/The_Centre_Pompidou_behind_Buildings.jpg?width=320")])])</ui>`;