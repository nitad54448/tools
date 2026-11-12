const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../md_2_pdf.html'),'utf8');
const app=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
async function harness({sanitizer=true}={}){
  const {JSDOM}=await import('jsdom'),{marked}=await import('marked');
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.test/md_2_pdf.html'});
  const w=dom.window;w.console={log(){},error(){},warn(){}};w.marked=marked;
  w.MathJax={startup:{promise:Promise.resolve()},typesetClear(){},typesetPromise(){return Promise.resolve();}};
  if(sanitizer)w.eval(fs.readFileSync(path.join(__dirname,'../vendor/purify.min.js'),'utf8'));
  w.eval(app);await Promise.resolve();
  return {window:w,preview:w.document.getElementById('preview'),async render(text){w.document.getElementById('editor').value=text;await w.renderMarkdown();}};
}
test('imported active HTML loses handlers, executable elements and dangerous URLs',async()=>{
  const h=await harness();
  await h.render('<img src=x onerror="window.pwned=1">\n<script>window.pwned=1</script>\n'+
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>\n<object data="javascript:alert(1)"></object>\n'+
    '<svg onload="alert(1)"><a href="javascript:alert(1)">x</a></svg>\n'+
    '<a href="java&#x73;cript:alert(1)" onclick="alert(1)">bad</a>\n'+
    '<a href="data:text/html;base64,PHNjcmlwdD4=">data</a>\n'+
    '<form id="editor"><input name="innerHTML"></form>\n<style>body{display:none}</style>');
  assert.equal(h.preview.querySelector('script,iframe,object,embed,svg,form,input,style'),null);
  for(const el of h.preview.querySelectorAll('*'))for(const attr of el.attributes){
    assert(!/^on/i.test(attr.name),attr.name);assert(!['id','name','style','srcdoc'].includes(attr.name),attr.name);
    if(['href','src'].includes(attr.name))assert(!/^(?:javascript|vbscript|data:text\/html):/i.test(attr.value));
  }
  assert.equal(h.window.pwned,undefined);h.window.close();
});
test('malformed mixed-namespace markup is sanitized by the vendored library',async()=>{
  const h=await harness();
  await h.render('<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">');
  assert.equal(h.preview.querySelector('math,svg,script,style,[onerror]'),null);h.window.close();
});
test('normal Markdown, tables, safe links and TeX remain available',async()=>{
  const h=await harness();
  await h.render('# Heading\n\n**bold** and `code` with $x^2$\n\n'+
    '| A | B |\n|---|---|\n| 1 | 2 |\n\n[web](https://example.com) [mail](mailto:person@example.com)');
  assert.equal(h.preview.querySelector('h1').textContent,'Heading');
  assert(h.preview.querySelector('strong'));assert(h.preview.querySelector('code'));assert(h.preview.querySelector('table'));
  assert(h.preview.textContent.includes('$x^2$'));assert.equal(h.preview.querySelectorAll('a[href]').length,2);
  h.window.close();
});
test('missing sanitizer refuses rendering and clears old preview content',async()=>{
  const h=await harness({sanitizer:false});await h.render('<img src=x onerror=alert(1)>');
  assert.match(h.preview.textContent,/HTML sanitizer unavailable/);assert.equal(h.preview.querySelector('img'),null);h.window.close();
});
test('render exceptions display text instead of interpreting error messages as HTML',async()=>{
  const h=await harness();h.window.marked={parse(){throw Error('<img src=x onerror=alert(1)>');}};
  await h.render('anything');assert(h.preview.textContent.includes('<img'));assert.equal(h.preview.querySelector('img'),null);h.window.close();
});
test('vendored sanitizer matches the pinned dependency',()=>{
  const actual=fs.readFileSync(path.join(__dirname,'../vendor/purify.min.js'));
  const expected=fs.readFileSync(path.join(__dirname,'../node_modules/dompurify/dist/purify.min.js'));
  assert(actual.equals(expected));
});
test('MathJax config loads URL filtering and refuses executable protocols',()=>{
  const config=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)][1][1];
  // The first script tag is Tailwind; the next block is the MathJax config.
  const ctx={window:{}};vm.runInNewContext(config,ctx);
  assert(ctx.window.MathJax.loader.load.includes('ui/safe'));
  const safety=ctx.window.MathJax.options.safeOptions;
  assert.equal(safety.allow.URLs,'safe');assert.equal(safety.safeProtocols.javascript,false);
  assert.equal(safety.safeProtocols.data,false);assert.equal(safety.safeProtocols.file,false);
});
