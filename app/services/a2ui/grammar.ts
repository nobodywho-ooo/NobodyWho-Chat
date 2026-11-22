// Whole-turn streaming grammar for A2UI on OpenUI Lang.
//
// When A2UI is on, the chat's sampler is constrained with a whole-turn grammar
// so the model can write normal prose (and think, and use other tools through
// nobodywho's own tool-call path) BUT the moment it emits `<ui>`, its contents
// are forced to be valid OpenUI Lang statements until `</ui>` — which
// structurally forbids the JSX/HTML drift tiny models otherwise fall into. It
// is the same "switch on a begin marker" idea nobodywho uses for tool calls.
//
// The `block` rule below is a statement-oriented subset of the OpenUI Lang
// 1.0 syntax: `identifier = Expression` per line, `root` first, positional
// arguments, strings/numbers/booleans/null/arrays/objects, references,
// `$name` state, component calls and `@` action/function calls. It must
// stay in lock-step with the component library in `lang.ts` (the test suite
// checks leftovers against it).
//
// Rules are deliberately single-line (nobodywho's GBNF->Lark converter breaks
// a top-level rule body at a newline).
//
// NB: A2UI_STREAM_GBNF is a String.raw template on purpose — the source text
// must be byte-identical to what the sampler receives (an earlier non-raw
// template silently escaped \\x00 etc. into control bytes, and the app's
// rendered string then failed llguidance's parser while the same-looking file
// passed on a server — measured). Keep char classes to [^…] ranges/sets
// without escapes; dchar allows \\ only, schar has no escapes at all.

// Master switch. ON — the sampler-chain fix (SamplerPresets.constrainWithGrammar
// builds the right top_k/top_p/temperature/dist chain) makes constrained
// decoding reliable on the small local models; the whitespace-stall guard in
// useChatGeneration stays as a safety net.
export const A2UI_CONSTRAINED = true;

// The whole-turn GBNF fed to `SamplerPresets.constrainWithGrammar`.
export const A2UI_STREAM_GBNF = String.raw`root ::= segment*
segment ::= prose | uiblock
# prose may not contain any '<' — tags can only appear via a real <ui> block.
# NB: String.raw on purpose (see header comment); keep this rule as-is.
prose ::= ([^<])+
uiblock ::= "<ui>" ws block ws "</ui>"
ws ::= [ \t\n]*
# One statement per line; root must come first (prompt says so). A statement
# is [identifier = Expression], then at least one newline before the next.
block ::= stmt (nl stmt)*
nl ::= "\n" ws
stmt ::= ident ws "=" ws expr
expr ::= call | array | object | string | number | boolean | null | reference
call ::= name ws "(" ws args ws ")"
# Only real components may be constructed; made-up names are not expressible.
# [@Name] covers built-in functions/actions (ToAssistant, OpenUrl, Set,
# Reset, Sum, Count, …) inside action slots and expressions.
name ::= "Stack" | "TextContent" | "Icon" | "Image" | "Card" | "Divider" | "Button" | "Input" | "CheckBox" | "Slider" | "ChoicePicker" | "List" | "Tabs" | "Map" | "@" ident
args ::= (arg ("," ws arg)*)?
arg ::= expr
reference ::= "$"? ident ("." ident | "[" number "]")*
ident ::= [a-zA-Z_] [a-zA-Z0-9_]*
array ::= "[" ws items ws "]"
items ::= (expr ("," ws expr)*)?
object ::= "{" ws fields ws "}"
fields ::= (field ("," ws field)*)?
field ::= key ws ":" ws expr
key ::= ident | string
number ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)?
boolean ::= "true" | "false"
null ::= "null"
string ::= dquote | squote
dquote ::= "\"" dchar* "\""
squote ::= "'" schar* "'"
dchar ::= [^"\\\n] | "\\" ["\\/bfnrt]
schar ::= [^'\n]`;

// Hand-readable GBNF pendant of the same constraint — present so the grammar
// can be applied verbatim on a llama.cpp server outside this app, where tools
// are configured with a plain `--grammar-file` instead of the app chain.
export const A2UI_GBNF = A2UI_STREAM_GBNF;