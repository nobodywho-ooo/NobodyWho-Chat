// The A2UI directive appended to the system prompt when the setting is on.
//
// A2UI streams through the ordinary assistant token stream: the model wraps
// every UI in `<ui>{Express}</ui>` sentinels so the app can render the card
// live while it streams. The inner format is A2UI "Express" — a compact
// `Component(args)` DSL that is ~3× fewer tokens than JSON, which matters on
// small on-device models. This directive is imperative and carries the whole
// component catalog (like the a2ui.org generated `promptSnippet`). Keep it as
// tight as the catalog allows: it competes for context with the user's prompt.

export const A2UI_SYSTEM_PROMPT_HINT = `You can draw interactive UI cards. When the user asks you to show, build, create, make, design, display, set up, fill in or put together ANY interactive UI — a form, a list, a menu, options to choose from, a summary card, a panel, a calculator, a timer, a quiz, a survey — write the UI in A2UI Express between a single pair of sentinels: <ui>{EXPRESS}</ui>. Do NOT describe the UI in prose instead; answer with at most one short line around it.

EXPRESS format: optionally set data values with $/path = value lines, then one root component expression. Components are constructors with positional or keyword (key=value) arguments; children nest inline.

Components (only these):
Text("text" or $/path, variant?="caption"|"body")
Icon("search"|"heart"|"settings"|"check"|"close"|"user"|"star"|"bell"|"mail"|"phone"|"camera"|"calendar"|"location"|"info"|"warning"|"play"|"share"|"send"|"trash", variant?="small"|"medium"|"large")
Image(url or $/path)
Row([...]) | Column([...]) — children are component constructors; justify?, align?
Card(<component>)
List(path="/array/in/data", component=<component>, direction?="vertical"|"horizontal")
Button(<component>, variant?="default"|"primary"|"borderless", action=Event("name", {k: v}) or OpenUrl("https://..."))
Divider(axis?="horizontal"|"vertical")
TextField(label, value, placeholder?, variant?="shortText"|"longText"|"number"|"obscured", checks=[{condition:"required"|"numeric"|"email", message:"..."}])
CheckBox(label, value:bool)
Slider(min?, max, value, steps?)
ChoicePicker(options=[{label, value}], value=[...], variant?="multipleSelection"|"mutuallyExclusive", displayStyle?="checkbox"|"chips")
Tabs(tabs=[{title, child:<component>}])

Rules:
- Put every bound value into a $/path = value line at the top, and reference it with $/path; never reference a path you did not set.
- Refer to the root as root = <Component(...)> (or just write the <Component(...)> expression). Nest children inline — do NOT use ids/names.
- Write the WHOLE UI in one block, then close it with </ui>.
- Keep the block compact.

Example: <ui>$/form/name = "" root = Column([TextField(label="Name", value=$/form/name), Slider(min=0, max=100, value=50), Button(Text("Submit"), variant="primary", action=Event("submit", {}))])</ui>`;