import {oa,$ as $$1,v,ba}from'./chunk-F67Q5GTR.js';import {Server}from'@modelcontextprotocol/sdk/server/index.js';import {ListToolsRequestSchema,CallToolRequestSchema}from'@modelcontextprotocol/sdk/types.js';import a from'dedent';import {z}from'zod';import {zodToJsonSchema}from'zod-to-json-schema';import {detect}from'@antfu/ni';async function k(n,{withFallback:e}={withFallback:false}){let r=await detect({programmatic:true,cwd:n});if(r==="yarn@berry")return "yarn";if(r==="pnpm@6")return "pnpm";if(r==="bun")return "bun";if(r==="deno")return "deno";if(!e)return r??"npm";let i=process.env.npm_config_user_agent||"";return i.startsWith("yarn")?"yarn":i.startsWith("pnpm")?"pnpm":i.startsWith("bun")?"bun":"npm"}async function b(n){let e=await k(n);return e==="pnpm"?"pnpm dlx":e==="bun"?"bunx":"npx"}var C="shadcn@latest";async function g(n){return `${await b(process.cwd())} ${C} ${n}`}async function u(n=process.cwd()){return {registries:(await ba(n,{useCache:false})).registries}}function y(n,e){let{query:r,registries:i}=e||{},s=n.items.map(c=>{let f=[`- ${c.name}`];return c.type&&f.push(`(${c.type})`),c.description&&f.push(`- ${c.description}`),c.registry&&f.push(`[${c.registry}]`),f.push(`
  Add command: \`${g(`add ${c.addCommandArgument}`)}\``),f.join(" ")}),o=`Found ${n.pagination.total} items`;r&&(o+=` matching "${r}"`),i&&i.length>0&&(o+=` in registries ${i.join(", ")}`),o+=":";let m=`Showing items ${n.pagination.offset+1}-${Math.min(n.pagination.offset+n.pagination.limit,n.pagination.total)} of ${n.pagination.total}:`,d=`${o}

${m}

${s.join(`

`)}`;return n.pagination.hasMore&&(d+=`

More items available. Use offset: ${n.pagination.offset+n.pagination.limit} to see the next page.`),d}function w(n){return n.map(e=>[`## ${e.name}`,e.description?`
${e.description}
`:"",e.type?`**Type:** ${e.type}`:"",e.files&&e.files.length>0?`**Files:** ${e.files.length} file(s)`:"",e.dependencies&&e.dependencies.length>0?`**Dependencies:** ${e.dependencies.join(", ")}`:"",e.devDependencies&&e.devDependencies.length>0?`**Dev Dependencies:** ${e.devDependencies.join(", ")}`:""].filter(Boolean).join(`
`))}function $(n,e){let r=n.map(s=>{let o=[`## Example: ${s.name}`,s.description?`
${s.description}
`:""];return s.files?.length&&s.files.forEach(m=>{m.content&&(o.push(`### Code (${m.path}):
`),o.push("```tsx"),o.push(m.content),o.push("```"));}),o.filter(Boolean).join(`
`)});return `# Usage Examples

Found ${n.length} example${n.length>1?"s":""} matching "${e}":
`+r.join(`

---

`)}var j=new Server({name:"shadcn",version:"1.0.0"},{capabilities:{resources:{},tools:{}}});j.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:"get_project_registries",description:"Get configured registry names from components.json - Returns error if no components.json exists (use init_project to create one)",inputSchema:zodToJsonSchema(z.object({}))},{name:"list_items_in_registries",description:"List items from registries (requires components.json - use init_project if missing)",inputSchema:zodToJsonSchema(z.object({registries:z.array(z.string()).describe("Array of registry names to search (e.g., ['@shadcn', '@acme'])"),limit:z.number().optional().describe("Maximum number of items to return"),offset:z.number().optional().describe("Number of items to skip for pagination")}))},{name:"search_items_in_registries",description:"Search for components in registries using fuzzy matching (requires components.json). After finding an item, use get_item_examples_from_registries to see usage examples.",inputSchema:zodToJsonSchema(z.object({registries:z.array(z.string()).describe("Array of registry names to search (e.g., ['@shadcn', '@acme'])"),query:z.string().describe("Search query string for fuzzy matching against item names and descriptions"),limit:z.number().optional().describe("Maximum number of items to return"),offset:z.number().optional().describe("Number of items to skip for pagination")}))},{name:"view_items_in_registries",description:"View detailed information about specific registry items including the name, description, type and files content. For usage examples, use get_item_examples_from_registries instead.",inputSchema:zodToJsonSchema(z.object({items:z.array(z.string()).describe("Array of item names with registry prefix (e.g., ['@shadcn/button', '@shadcn/card'])")}))},{name:"get_item_examples_from_registries",description:"Find usage examples and demos with their complete code. Search for patterns like 'accordion-demo', 'button example', 'card-demo', etc. Returns full implementation code with dependencies.",inputSchema:zodToJsonSchema(z.object({registries:z.array(z.string()).describe("Array of registry names to search (e.g., ['@shadcn', '@acme'])"),query:z.string().describe("Search query for examples (e.g., 'accordion-demo', 'button demo', 'card example', 'tooltip-demo', 'example-booking-form', 'example-hero'). Common patterns: '{item-name}-demo', '{item-name} example', 'example {item-name}'")}))},{name:"get_add_command_for_items",description:"Get the shadcn CLI add command for specific items in a registry. This is useful for adding one or more components to your project.",inputSchema:zodToJsonSchema(z.object({items:z.array(z.string()).describe("Array of items to get the add command for prefixed with the registry name (e.g., ['@shadcn/button', '@shadcn/card'])")}))},{name:"get_audit_checklist",description:"After creating new components or generating new code files, use this tool for a quick checklist to verify that everything is working as expected. Make sure to run the tool after all required steps have been completed.",inputSchema:zodToJsonSchema(z.object({}))}]}));j.setRequestHandler(CallToolRequestSchema,async n=>{try{if(!n.params.arguments)throw new Error("No tool arguments provided.");switch(n.params.name){case "get_project_registries":{let e=await u(process.cwd());return e?.registries?{content:[{type:"text",text:a`The following registries are configured in the current project:

                ${Object.keys(e.registries).map(r=>`- ${r}`).join(`
`)}

                You can view the items in a registry by running:
                \`${await g("view @name-of-registry")}\`

                For example: \`${await g("view @shadcn")}\` or \`${await g("view @shadcn @acme")}\` to view multiple registries.
                `}]}:{content:[{type:"text",text:a`No components.json found or no registries configured.

                To fix this:
                1. Use the \`init\` command to create a components.json file
                2. Or manually create components.json with a registries section`}]}}case "search_items_in_registries":{let r=z.object({registries:z.array(z.string()),query:z.string(),limit:z.number().optional(),offset:z.number().optional()}).parse(n.params.arguments),i=await oa(r.registries,{query:r.query,limit:r.limit,offset:r.offset,config:await u(process.cwd()),useCache:!1});return i.items.length===0?{content:[{type:"text",text:a`No items found matching "${r.query}" in registries ${r.registries.join(", ")}, Try searching with a different query or registry.`}]}:{content:[{type:"text",text:y(i,{query:r.query,registries:r.registries})}]}}case "list_items_in_registries":{let r=z.object({registries:z.array(z.string()),limit:z.number().optional(),offset:z.number().optional(),cwd:z.string().optional()}).parse(n.params.arguments),i=await oa(r.registries,{limit:r.limit,offset:r.offset,config:await u(process.cwd()),useCache:!1});return i.items.length===0?{content:[{type:"text",text:a`No items found in registries ${r.registries.join(", ")}.`}]}:{content:[{type:"text",text:y(i,{registries:r.registries})}]}}case "view_items_in_registries":{let r=z.object({items:z.array(z.string())}).parse(n.params.arguments),i=await $$1(r.items,{config:await u(process.cwd()),useCache:!1});if(i?.length===0)return {content:[{type:"text",text:a`No items found for: ${r.items.join(", ")}

                Make sure the item names are correct and include the registry prefix (e.g., @shadcn/button).`}]};let s=w(i);return {content:[{type:"text",text:a`Item Details:

              ${s.join(`

---

`)}`}]}}case "get_item_examples_from_registries":{let r=z.object({query:z.string(),registries:z.array(z.string())}).parse(n.params.arguments),i=await u(),s=await oa(r.registries,{query:r.query,config:i,useCache:!1});if(s.items.length===0)return {content:[{type:"text",text:a`No examples found for query "${r.query}".

                Try searching with patterns like:
                - "accordion-demo" for accordion examples
                - "button demo" or "button example"
                - Component name followed by "-demo" or "example"

                You can also:
                1. Use search_items_in_registries to find all items matching your query
                2. View the main component with view_items_in_registries for inline usage documentation`}]};let o=s.items.map(d=>d.addCommandArgument),m=await $$1(o,{config:i,useCache:!1});return {content:[{type:"text",text:$(m,r.query)}]}}case "get_add_command_for_items":{let e=z.object({items:z.array(z.string())}).parse(n.params.arguments);return {content:[{type:"text",text:await g(`add ${e.items.join(" ")}`)}]}}case "get_audit_checklist":return {content:[{type:"text",text:a`## Component Audit Checklist

              After adding or generating components, check the following common issues:

              - [ ] Ensure imports are correct i.e named vs default imports
              - [ ] If using next/image, ensure images.remotePatterns next.config.js is configured correctly.
              - [ ] Ensure all dependencies are installed.
              - [ ] Check for linting errors or warnings
              - [ ] Check for TypeScript errors
              - [ ] Use the Playwright MCP if available.
              `}]};default:throw new Error(`Tool ${n.params.name} not found`)}}catch(e){if(e instanceof z.ZodError)return {content:[{type:"text",text:a`Invalid input parameters:
              ${e.errors.map(i=>`- ${i.path.join(".")}: ${i.message}`).join(`
`)}
              `}],isError:true};if(e instanceof v){let i=e.message;return e.suggestion&&(i+=`

\u{1F4A1} ${e.suggestion}`),e.context&&(i+=`

Context: ${JSON.stringify(e.context,null,2)}`),{content:[{type:"text",text:a`Error (${e.code}): ${i}`}],isError:true}}let r=e instanceof Error?e.message:String(e);return {content:[{type:"text",text:a`Error: ${r}`}],isError:true}}});export{k as a,j as b};//# sourceMappingURL=chunk-UOTHKX3D.js.map
//# sourceMappingURL=chunk-UOTHKX3D.js.map