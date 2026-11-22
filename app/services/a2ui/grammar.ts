// Hand-readable GBNF pendant of the `render_ui` constraint.
//
// The *operative* constrained grammar is derived at runtime: when a chat has
// tools and a sampler, nobodywho compiles the tool JSON Schemas — here
// `A2UI_UI_SCHEMA` from `schema.ts` — into the llguidance Lark grammar that
// constrains the model while it emits a tool call. No GBNF string is fed to
// the sampler; a whole-turn grammar would sit in the chain next to that
// auto-generated tool grammar and intersect away the model's prose.
//
// This file exists (a) as the human-readable statement of exactly what the
// schema constrains and (b) so the same constraint can be applied verbatim on
// a llama.cpp server outside this app, where tools are configured with a
// plain `--grammar-file` instead of JSON Schemas. Components nest by value
// (no id registry), matching schema.ts. Keep the two in lock-step — the test
// suite checks them against the same component set.

// The `\"` pairs below are GBNF's own escaped quotes, written through a
// template literal, so the escape is deliberate — not a mistake.
/* eslint-disable no-useless-escape */
export const A2UI_GBNF = `
# A2UI render_ui argument — on-device catalog subset (mirrors schema.ts).

root      ::= "{" ws "\\\"components\\\"" ws ":" ws "[" ws component (ws "," ws component)* ws "]" ws
              (ws "," ws "\\\"dataModel\\\"" ws ":" ws object)? ws "}"

component ::= text | icon | image | row | column | list | card | divider | button
            | textfield | checkbox | slider | choicepicker | tabs

icon ::= "{" ws "\\\"component\\\":\\\"Icon\\\"" ws "," ws
          "\\\"name\\\"" ws ":" ws string ws
         ("," ws "\\\"variant\\\"" ws ":" ws ("\\\"small\\\"" | "\\\"medium\\\"" | "\\\"large\\\""))? ws
         ("," ws weight-pair)? ws "}"

tabs ::= "{" ws "\\\"component\\\":\\\"Tabs\\\"" ws "," ws
          "\\\"tabs\\\"" ws ":" ws "[" ws tab (ws "," ws tab)* ws "]" ws "}"
tab   ::= "{" ws "\\\"title\\\"" ws ":" ws value ws "," ws
          "\\\"child\\\"" ws ":" ws component ws "}"

children-list ::= "[" ws component (ws "," ws component)* ws "]"

text ::= "{" ws "\\\"component\\\":\\\"Text\\\"" ws ","
          ws "\\\"text\\\"" ws ":" ws value ws
         ("," ws "\\\"variant\\\"" ws ":" ws ("\\\"caption\\\"" | "\\\"body\\\""))? ws
         ("," ws weight-pair)? ws "}"

image ::= "{" ws "\\\"component\\\":\\\"Image\\\"" ws ","
          ws "\\\"url\\\"" ws ":" ws value ws
         ("," ws "\\\"description\\\"" ws ":" ws value)? ws
         ("," ws "\\\"fit\\\"" ws ":" ws fit-enum)? ws
         ("," ws "\\\"variant\\\"" ws ":" ws image-variant)? ws
         ("," ws weight-pair)? ws "}"
fit-enum      ::= "\\\"contain\\\"" | "\\\"cover\\\"" | "\\\"fill\\\"" | "\\\"none\\\"" | "\\\"scaleDown\\\""
image-variant ::= "\\\"avatar\\\"" | "\\\"smallFeature\\\"" | "\\\"mediumFeature\\\"" | "\\\"largeFeature\\\""

row    ::= "{" ws "\\\"component\\\":\\\"Row\\\"" ws "," ws
            "\\\"children\\\"" ws ":" ws children-list ws
           ("," ws "\\\"justify\\\"" ws ":" ws row-justify)? ws
           ("," ws "\\\"align\\\"" ws ":" ws align)? ws "}"
column ::= "{" ws "\\\"component\\\":\\\"Column\\\"" ws "," ws
            "\\\"children\\\"" ws ":" ws children-list ws
           ("," ws "\\\"justify\\\"" ws ":" ws column-justify)? ws
           ("," ws "\\\"align\\\"" ws ":" ws align)? ws "}"

row-justify    ::= "\\\"center\\\"" | "\\\"end\\\"" | "\\\"spaceAround\\\"" | "\\\"spaceBetween\\\"" | "\\\"spaceEvenly\\\"" | "\\\"start\\\"" | "\\\"stretch\\\""
column-justify ::= "\\\"start\\\"" | "\\\"center\\\"" | "\\\"end\\\"" | "\\\"spaceBetween\\\"" | "\\\"spaceAround\\\"" | "\\\"spaceEvenly\\\"" | "\\\"stretch\\\""
align ::= "\\\"start\\\"" | "\\\"center\\\"" | "\\\"end\\\"" | "\\\"stretch\\\""

list ::= "{" ws "\\\"component\\\":\\\"List\\\"" ws "," ws
          "\\\"children\\\"" ws ":" ws "{" ws
          "\\\"path\\\"" ws ":" ws string ws "," ws
          "\\\"component\\\"" ws ":" ws component ws "}" ws
         ("," ws "\\\"direction\\\"" ws ":" ws ("\\\"vertical\\\"" | "\\\"horizontal\\\""))? ws
         ("," ws "\\\"align\\\"" ws ":" ws align)? ws "}"

card    ::= "{" ws "\\\"component\\\":\\\"Card\\\"" ws "," ws
             "\\\"child\\\"" ws ":" ws component ws "}"
divider ::= "{" ws "\\\"component\\\":\\\"Divider\\\"" ws
            ("," ws "\\\"axis\\\"" ws ":" ws ("\\\"horizontal\\\"" | "\\\"vertical\\\""))? ws "}"

button ::= "{" ws "\\\"component\\\":\\\"Button\\\"" ws "," ws
            "\\\"child\\\"" ws ":" ws component ws "," ws
            "\\\"action\\\"" ws ":" ws action ws
           ("," ws "\\\"variant\\\"" ws ":" ws ("\\\"default\\\"" | "\\\"primary\\\"" | "\\\"borderless\\\""))? ws "}"

action ::= "{" ws "\\\"event\\\"" ws ":" ws "{" ws
            "\\\"name\\\"" ws ":" ws string ws
            ("," ws "\\\"context\\\"" ws ":" ws object)? ws "}" ws "}"
          | "{" ws "\\\"openUrl\\\"" ws ":" ws "{" ws
            "\\\"url\\\"" ws ":" ws value ws "}" ws "}"

textfield ::= "{" ws "\\\"component\\\":\\\"TextField\\\"" ws "," ws
               "\\\"label\\\"" ws ":" ws value ws "," ws
               "\\\"value\\\"" ws ":" ws value ws
              ("," ws "\\\"placeholder\\\"" ws ":" ws value)? ws
              ("," ws "\\\"variant\\\"" ws ":" ws textfield-variant)? ws
              ("," ws "\\\"@checks\\\"" ws ":" ws "[" ws check (ws "," ws check)* ws "]")? ws
              ("," ws weight-pair)? ws "}"
textfield-variant ::= "\\\"longText\\\"" | "\\\"number\\\"" | "\\\"shortText\\\"" | "\\\"obscured\\\""
check ::= "{" ws "\\\"condition\\\"" ws ":" ws ("\\\"required\\\"" | "\\\"numeric\\\"" | "\\\"email\\\"") ws
          ("," ws "\\\"message\\\"" ws ":" ws value)? ws "}"

checkbox ::= "{" ws "\\\"component\\\":\\\"CheckBox\\\"" ws "," ws
              "\\\"label\\\"" ws ":" ws value ws "," ws
              "\\\"value\\\"" ws ":" ws bool-value ws
             ("," ws weight-pair)? ws "}"

slider ::= "{" ws "\\\"component\\\":\\\"Slider\\\"" ws "," ws
            "\\\"value\\\"" ws ":" ws num-value ws "," ws
            "\\\"max\\\"" ws ":" ws number ws
           ("," ws "\\\"min\\\"" ws ":" ws number)? ws
           ("," ws "\\\"label\\\"" ws ":" ws value)? ws
           ("," ws "\\\"steps\\\"" ws ":" ws number)? ws
           ("," ws weight-pair)? ws "}"

choicepicker ::= "{" ws "\\\"component\\\":\\\"ChoicePicker\\\"" ws "," ws
                  "\\\"options\\\"" ws ":" ws "[" ws option (ws "," ws option)* ws "]" ws ","
                  "\\\"value\\\"" ws ":" ws value ws
                 ("," ws "\\\"label\\\"" ws ":" ws value)? ws
                 ("," ws "\\\"variant\\\"" ws ":" ws ("\\\"multipleSelection\\\"" | "\\\"mutuallyExclusive\\\""))? ws
                 ("," ws "\\\"displayStyle\\\"" ws ":" ws ("\\\"checkbox\\\"" | "\\\"chips\\\""))? ws
                 ("," ws weight-pair)? ws "}"
option ::= "{" ws "\\\"label\\\"" ws ":" ws value ws "," ws
            "\\\"value\\\"" ws ":" ws string ws "}"

weight-pair ::= "\\\"weight\\\"" ws ":" ws number

# Values: literals or {"@path": "/x/y"} bindings
value      ::= string | number | "false" | "true" | binding
bool-value ::= "false" | "true" | binding
num-value  ::= number | binding
binding ::= "{" ws "\\\"@path\\\"" ws ":" ws string ws "}"

# Generic JSON
object  ::= "{" ws "}" | "{" ws string ws ":" ws json-value (ws "," ws string ws ":" ws json-value)* ws "}"
json-value ::= object | array | string | number | "true" | "false" | "null"
array   ::= "[" ws "]" | "[" ws json-value (ws "," ws json-value)* ws "]"
string  ::= "\\\"" char* "\\\""
char    ::= [^"\\\\\\x00-\\x1F\\x7F] | "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F])
number  ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)? (("e" | "E") ("+" | "-")? [0-9]+)?
ws      ::= [ \\t\\n]*
`.trim();

// --- Whole-turn streaming grammar -------------------------------------------
// When A2UI is on, the chat's sampler is constrained with a whole-turn grammar
// so the model can write normal prose (and think, and use other tools through
// nobodywho's own tool-call path) BUT the moment it emits `<ui>`, the JSON
// inside is forced to match the A2UI object grammar until `</ui>`. This is the
// same "switch on a begin marker" idea nobodywho uses for tool calls, expressed
// in GBNF: `prose` matches any text that does not contain the literal sequence
// `<ui>`, so a `<ui>` routes to the constrained block instead.

// Master switch: set to false to fall back to unconstrained streaming
// (the tolerant parser + validator still render valid cards).
export const A2UI_CONSTRAINED = true;

// nobodywho's GBNF→Lark converter breaks a rule body at a newline (only rules
// nested in `(...)` may wrap), so the object grammar must be single-line per
// rule before it is embedded in the stream grammar. `A2UI_GBNF` above stays
// hand-formatted for readability; this collapses it for the converter.
const normalizeGbnf = (gbnf: string): string => {
  const lines: string[] = [];
  let buffer: string | null = null;
  for (const raw of gbnf.split('\n')) {
    const line = raw.trim();
    if (line.length === 0) {
      continue;
    }
    if (line.startsWith('#')) {
      lines.push(line);
    } else if (line.includes('::=')) {
      if (buffer !== null) {
        lines.push(buffer);
      }
      buffer = line;
    } else {
      buffer = buffer === null ? line : `${buffer} ${line}`;
    }
  }
  if (buffer !== null) {
    lines.push(buffer);
  }
  return lines.join('\n');
};

// The UI object grammar, promoted from its `root` rule to a reusable `ui` rule
// so the wrapper can reference it.
const UI_OBJECT_GBNF = normalizeGbnf(A2UI_GBNF).replace(/^root\s+::=/m, 'ui ::=');

// The whole-turn GBNF fed to `SamplerPresets.constrainWithGrammar`.
export const A2UI_STREAM_GBNF = `root ::= segment*
segment ::= prose | uiblock
# prose: maximal text that does not contain the literal "<ui>"
prose ::= ([^<] | "<" [^u] | "<u" [^i] | "<ui" [^>])+
uiblock ::= "<ui>" ws ui ws "</ui>"
${UI_OBJECT_GBNF}
`.trim();
