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
// schema constrains, for review and for the docs, and (b) so the same
// constraint can be applied verbatim on a llama.cpp server outside this app,
// where tools are configured with a plain `--grammar-file` instead of JSON
// Schemas. Keep it in lock-step with `schema.ts` — the test suite checks the
// two agree on the component set.

// The `\"` pairs below are GBNF's own escaped quotes, written through a
// template literal, so the escape is deliberate — not a mistake.
/* eslint-disable no-useless-escape */
export const A2UI_GBNF = `
# A2UI render_ui argument — on-device catalog subset (mirrors schema.ts).
# Digits and string bodies deliberately reuse the same rules as the rest of
# the JSON, so the vocabulary stays small.

root   ::= "{" ws "\\\"components\\\"" ws ":" ws "[" ws component (ws "," ws component)* ws "]" ws
           (ws "," ws "\\\"dataModel\\\"" ws ":" ws object)? ws "}"

component ::= text | image | row | column | list | card | divider | button
            | textfield | checkbox | slider | choicepicker

id-pair     ::= "\\\"id\\\"" ws ":" ws string
weight-pair ::= "\\\"weight\\\"" ws ":" ws number

text ::= "{" ws "\\\"component\\\":\\\"Text\\\"" ws "," ws id-pair ws ","
          ws "\\\"text\\\"" ws ":" ws value ws
         ("\\\"" ws "," ws "\\\"variant\\\"" ws ":" ws ("\\\"caption\\\"" | "\\\"body\\\""))? ws
         ("," ws weight-pair)? ws "}"

image ::= "{" ws "\\\"component\\\":\\\"Image\\\"" ws "," ws id-pair ws ","
          ws "\\\"url\\\"" ws ":" ws value ws
         ("," ws "\\\"description\\\"" ws ":" ws value)? ws
         ("," ws "\\\"fit\\\"" ws ":" ws fit-enum)? ws
         ("," ws "\\\"variant\\\"" ws ":" ws image-variant)? ws
         ("," ws weight-pair)? ws "}"
fit-enum      ::= "\\\"contain\\\"" | "\\\"cover\\\"" | "\\\"fill\\\"" | "\\\"none\\\"" | "\\\"scaleDown\\\""
image-variant ::= "\\\"avatar\\\"" | "\\\"smallFeature\\\"" | "\\\"mediumFeature\\\"" | "\\\"largeFeature\\\""

row    ::= "{" ws "\\\"component\\\":\\\"Row\\\"" ws "," ws id-pair ws ","
            ws "\\\"children\\\"" ws ":" ws id-list ws
           ("," ws "\\\"justify\\\"" ws ":" ws row-justify)? ws
           ("," ws "\\\"align\\\"" ws ":" ws align)? ws "}"
column ::= "{" ws "\\\"component\\\":\\\"Column\\\"" ws "," ws id-pair ws ","
            ws "\\\"children\\\"" ws ":" ws id-list ws
           ("," ws "\\\"justify\\\"" ws ":" ws column-justify)? ws
           ("," ws "\\\"align\\\"" ws ":" ws align)? ws "}"

id-list ::= "[" ws "]" | "[" ws string (ws "," ws string)* ws "]"
row-justify    ::= "\\\"center\\\"" | "\\\"end\\\"" | "\\\"spaceAround\\\"" | "\\\"spaceBetween\\\"" | "\\\"spaceEvenly\\\"" | "\\\"start\\\"" | "\\\"stretch\\\""
column-justify ::= "\\\"start\\\"" | "\\\"center\\\"" | "\\\"end\\\"" | "\\\"spaceBetween\\\"" | "\\\"spaceAround\\\"" | "\\\"spaceEvenly\\\"" | "\\\"stretch\\\""
align ::= "\\\"start\\\"" | "\\\"center\\\"" | "\\\"end\\\"" | "\\\"stretch\\\""

list ::= "{" ws "\\\"component\\\":\\\"List\\\"" ws "," ws id-pair ws ","
          ws "\\\"children\\\"" ws ":" ws "{" ws
          "\\\"path\\\"" ws ":" ws string ws "," ws
          "\\\"componentId\\\"" ws ":" ws string ws "}" ws
         ("," ws "\\\"direction\\\"" ws ":" ws ("\\\"vertical\\\"" | "\\\"horizontal\\\""))? ws
         ("," ws "\\\"align\\\"" ws ":" ws align)? ws "}"

card    ::= "{" ws "\\\"component\\\":\\\"Card\\\"" ws "," ws id-pair ws ","
             ws "\\\"child\\\"" ws ":" ws string ws "}"
divider ::= "{" ws "\\\"component\\\":\\\"Divider\\\"" ws "," ws id-pair ws
            ("," ws "\\\"axis\\\"" ws ":" ws ("\\\"horizontal\\\"" | "\\\"vertical\\\""))? ws "}"

button ::= "{" ws "\\\"component\\\":\\\"Button\\\"" ws "," ws id-pair ws ","
            ws "\\\"child\\\"" ws ":" ws string ws "," ws
            ws "\\\"action\\\"" ws ":" ws action ws
           ("," ws "\\\"variant\\\"" ws ":" ws ("\\\"default\\\"" | "\\\"primary\\\"" | "\\\"borderless\\\""))? ws "}"

action ::= "{" ws "\\\"event\\\"" ws ":" ws "{" ws
            "\\\"name\\\"" ws ":" ws string ws
            ("," ws "\\\"context\\\"" ws ":" ws object)? ws "}" ws "}"
          | "{" ws "\\\"openUrl\\\"" ws ":" ws "{" ws
            "\\\"url\\\"" ws ":" ws value ws "}" ws "}"

textfield ::= "{" ws "\\\"component\\\":\\\"TextField\\\"" ws "," ws id-pair ws ","
               ws "\\\"label\\\"" ws ":" ws value ws "," ws
               ws "\\\"value\\\"" ws ":" ws value ws
              ("," ws "\\\"placeholder\\\"" ws ":" ws value)? ws
              ("," ws "\\\"variant\\\"" ws ":" ws textfield-variant)? ws
              ("," ws weight-pair)? ws "}"
textfield-variant ::= "\\\"longText\\\"" | "\\\"number\\\"" | "\\\"shortText\\\"" | "\\\"obscured\\\""

checkbox ::= "{" ws "\\\"component\\\":\\\"CheckBox\\\"" ws "," ws id-pair ws ","
              ws "\\\"label\\\"" ws ":" ws value ws "," ws
              ws "\\\"value\\\"" ws ":" ws bool-value ws
             ("," ws weight-pair)? ws "}"

slider ::= "{" ws "\\\"component\\\":\\\"Slider\\\"" ws "," ws id-pair ws ","
            ws "\\\"value\\\"" ws ":" ws num-value ws "," ws
            ws "\\\"max\\\"" ws ":" ws number ws
           ("," ws "\\\"min\\\"" ws ":" ws number)? ws
           ("," ws "\\\"label\\\"" ws ":" ws value)? ws
           ("," ws "\\\"steps\\\"" ws ":" ws number)? ws
           ("," ws weight-pair)? ws "}"

choicepicker ::= "{" ws "\\\"component\\\":\\\"ChoicePicker\\\"" ws "," ws id-pair ws ","
                  ws "\\\"options\\\"" ws ":" ws "[" ws option (ws "," ws option)* ws "]" ws ","
                  ws "\\\"value\\\"" ws ":" ws value ws
                 ("," ws "\\\"label\\\"" ws ":" ws value)? ws
                 ("," ws "\\\"variant\\\"" ws ":" ws ("\\\"multipleSelection\\\"" | "\\\"mutuallyExclusive\\\""))? ws
                 ("," ws "\\\"displayStyle\\\"" ws ":" ws ("\\\"checkbox\\\"" | "\\\"chips\\\""))? ws
                 ("," ws weight-pair)? ws "}"
option ::= "{" ws "\\\"label\\\"" ws ":" ws value ws "," ws
            "\\\"value\\\"" ws ":" ws string ws "}"

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
