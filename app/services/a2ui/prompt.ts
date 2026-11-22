// The A2UI directive appended to the system prompt when the setting is on.
//
// A2UI now works through the normal assistant token stream: the model wraps
// every UI in `<ui>{...}</ui>` sentinels so the app can render the card live
// while it streams. There is no `render_ui` tool — a tool call's
// JSON is invisible until the call completes, which is exactly what streaming
// must not wait for. So the instruction is imperative and carries the whole
// component catalog (which used to be the tool description).
//
// Keep it as tight as the catalog allows: it competes for context with the
// user's own system prompt.

export const A2UI_SYSTEM_PROMPT_HINT = `You can draw interactive UI cards that the user can interact with. When the user asks you to show, build, create, make, design, display, set up, fill in or put together ANY interactive UI — a form, a list, a menu, options to choose from, a summary card, a panel, a calculator, a timer, a quiz, a survey — write the UI as JSON between a single pair of sentinels: <ui>{UI JSON}</ui>. Do NOT describe the UI in prose instead, and answer with at most one short line around it.

UI JSON format: {"components":[...], "dataModel":{...}}. Components nest by value: Row/Column list full child objects in "children", Card/Button hold one full child object in "child", List holds a template object. NO ids, NO references — write each child inline.

Components (only these):
Text{text, variant?:"caption"|"body"}
Icon{name, variant?:"small"|"medium"|"large"} — e.g. search, heart, settings, check, close, user, star, bell, mail, phone, camera, calendar, location, info, warning, play, share, send, trash
Image{url, description?}
Row|Column{children:[<components>], justify?, align?}
Card{child:<component>}
List{children:{path,component:<component>}, direction?:"vertical"|"horizontal"}
Button{child:<component>, variant?:"default"|"primary"|"borderless", action:{"event":{"name":"..."}}|{"openUrl":{"url":"https://..."}}}
Divider{axis?:"horizontal"|"vertical"}
TextField{label, value, placeholder?, variant?:"shortText"|"longText"|"number"|"obscured", @checks?:[{"condition":"required"|"numeric"|"email", "message":"..."}]}
CheckBox{label, value:bool}
Slider{min?, max, value, steps?}
ChoicePicker{label?, options:[{"label","value"}], value:[...], variant?:"multipleSelection"|"mutuallyExclusive"}
Tabs{tabs:[{"title":"...", "child":<component>}]}

Rules:
- Put every value you bind into "dataModel" and reference it with {"@path":"/a/b"} — never reference a path you did not put there; if there is no data, write a literal string instead.
- Write the WHOLE UI in one block, then close it with </ui>.
- Keep the JSON small.

Example: <ui>{"components":[{"component":"Column","children":[{"component":"TextField","label":"Name","value":{"@path":"/form/name"}},{"component":"Slider","min":0,"max":100,"value":50},{"component":"Button","child":{"component":"Text","text":"Submit"},"variant":"primary","action":{"event":{"name":"submit"}}}]}],"dataModel":{"form":{"name":""}}}</ui>`;
