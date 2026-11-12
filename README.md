# Browser tools

`md_2_pdf.html` renders Markdown for browser printing. Review issue 17 is fixed
with DOMPurify 3.4.17, included locally in `vendor/` with its license. Keep that
folder alongside the page when copying or publishing it.

Rendered HTML is sanitized before entering the live preview. Scripts, event
handlers, dangerous URLs, raw SVG/MathML, embedded documents, forms, styles and
DOM-clobbering attributes are excluded. Markdown tables, code, ordinary links
and TeX text remain supported; MathJax typesets the sanitized preview afterward.
A missing sanitizer refuses rendering, and errors are displayed as plain text.
MathJax also loads its [safe extension](https://docs.mathjax.org/en/v3.2/options/safe.html)
to filter URLs and attributes generated from TeX. A failed MathJax startup leaves
the sanitized TeX as text.

Run `npm ci` then `npm test` to exercise real Markdown parsing and the vendored
sanitizer in jsdom, including malicious HTML, malformed namespaces, URL payloads,
normal formatting and unavailable-library behavior.
