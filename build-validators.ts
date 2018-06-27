import * as TJS from "typescript-json-schema";
import * as path from "path";
import * as fs from "fs";

// This script is run through npm to rebuild interface validators whenever
// they happen to have changed. It spits the output back out into a TS file at
// src/validators/validators.ts - it isn't actually TypeScript, it's just JavaScript,
// but making it a .ts file means we get autocomplete etc.

// We're manually listing these files right now, but maybe at some point we'll just end
// up including the whole interface directory?

const program = TJS.getProgramFromFiles(
  [
    path.join(__dirname, "src", "interface", "fcm-requests.ts"),
    path.join(__dirname, "src", "interface", "env.ts"),
    path.join(__dirname, "src", "interface", "subscription-types.ts")
  ],
  null,
  null
);

const generator = TJS.buildGenerator(program, {
  // The flag ensures that validation will fail if any required properties are not included
  required: true,
  // Conversely, this one ensure it will fail if there are any extra properties in the object
  // that aren't in the schema.
  noExtraProps: true
});

// Again, we're manually defining these, but maybe we don't need to. The resulting JSON file would
// be larger, but this never goes to the client, so it can't matter that much.

let interfaces = [
  "FCMMessage",
  "FCMTokenMessage",
  "FCMTopicMessage",
  "FCMConditionMessage",
  "EnvironmentVariables",
  "iOSSubscription",
  "WebSubscription"
];

let result = generator.getSchemaForSymbols(interfaces);

fs.writeFileSync(
  path.join(__dirname, "src", "validators", "validators.ts"),
  `// This file is automatically generated by "npm run build-interface-validation". Do not edit it directly.
  
  export default ` + JSON.stringify(result, null, 2)
);
